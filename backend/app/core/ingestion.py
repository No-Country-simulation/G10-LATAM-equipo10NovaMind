"""
Ingesta y extracción de texto de documentos técnicos.

Soporta los tres formatos exigidos: PDF, Markdown y texto plano. Las imágenes y los PDF
escaneados no tienen texto extraíble: se transcriben aparte (servicio_transcripcion) y aquí
solo se reconocen (`tipo_mime_imagen`, `PdfSinTexto`) y se reconstruyen sus páginas
(`texto_con_marcadores`, `paginas_desde_marcadores`).

Además del texto, construye el contexto documental compartido que reutilizan
todas las tareas de generación: rangos de página (PDF) y secciones detectadas.
El texto resultante es idéntico al de versiones anteriores, de modo que los
identificadores por contenido (`calcular_documento_id`) no cambian.
"""

from __future__ import annotations

import re
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

from pypdf import PdfReader

from app.core.schemas import (
    MAX_SECCIONES_DOCUMENTO,
    RangoPagina,
    SeccionDocumento,
    pagina_de_offset,
)


class IngestionError(Exception):
    """Error al extraer contenido de un documento de entrada."""


class PdfSinTexto(IngestionError):
    """PDF sin capa de texto (escaneo): hay que transcribirlo."""

    def __init__(self, nombre: str, num_paginas: int):
        super().__init__(
            f"El PDF '{nombre}' no contiene texto extraíble (es un escaneo): "
            "transcríbelo primero (POST /api/v1/documentos/extraer)."
        )
        self.num_paginas = num_paginas


# Formatos de imagen que Gemini lee. La extensión la elige el cliente: se exige además la
# firma de los bytes, para no mandar a transcribir cualquier cosa renombrada.
EXTENSIONES_IMAGEN = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
_FIRMAS_IMAGEN = {
    "image/png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    "image/webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}
FORMATOS_VALIDOS = ".pdf, .md, .markdown, .txt, .png, .jpg, .jpeg, .webp"


def tipo_mime_imagen(contenido: bytes, nombre_archivo: str) -> Optional[str]:
    """MIME si la extensión es de imagen (None si no lo es); falla si los bytes no lo confirman."""
    nombre = Path(str(nombre_archivo).replace("\\", "/")).name
    mime = EXTENSIONES_IMAGEN.get(Path(nombre).suffix.lower())
    if mime is None:
        return None
    if not _FIRMAS_IMAGEN[mime](contenido):
        raise IngestionError(f"El archivo '{nombre}' no es una imagen {mime} válida.")
    return mime


# Una línea "[Página N]" por página transcrita. Sobrevive a que el usuario corrija el texto:
# las páginas se recalculan desde los marcadores y no desde posiciones guardadas.
_MARCADOR_PAGINA = re.compile(r"^\[Página (\d{1,4})\][ \t]*$", re.MULTILINE)


def texto_con_marcadores(paginas: List[str]) -> str:
    return "\n\n".join(f"[Página {n}]\n{texto.strip()}" for n, texto in enumerate(paginas, start=1))


def paginas_desde_marcadores(texto: str) -> List[RangoPagina]:
    """Rangos de página según los marcadores; si los números no crecen, sin paginación."""
    marcas = list(_MARCADOR_PAGINA.finditer(texto))
    numeros = [int(m.group(1)) for m in marcas]
    if not marcas or any(b <= a for a, b in zip(numeros, numeros[1:])):
        return []
    inicios = [m.start() for m in marcas] + [len(texto)]
    return [RangoPagina(numero=n, inicio=inicios[i], fin=inicios[i + 1]) for i, n in enumerate(numeros)]


@dataclass
class DocumentoIngresado:
    doc_id: str
    titulo: str
    texto: str
    extension: str
    # Rangos sobre `texto`; solo los PDF tienen paginación real.
    paginas: List[RangoPagina] = field(default_factory=list)
    secciones: List[SeccionDocumento] = field(default_factory=list)


_HEADER_FOOTER_PATTERN = re.compile(
    r"^(Programa ONE.*|Hackathon ONE G10.*)$", re.MULTILINE
)

# Encabezados Markdown: "# Título" ... "###### Título".
_ENCABEZADO_MD = re.compile(r"^(#{1,6})[ \t]+(\S.*?)[ \t#]*$", re.MULTILINE)
# Encabezados numerados de PDF: "1 Introducción", "2.3 Arquitectura de red".
# Sin punto final y con pocas palabras, para no confundirlos con listas o frases.
_ENCABEZADO_NUMERADO = re.compile(
    r"^(\d{1,2}(?:\.\d{1,2}){0,3})\.?[ \t]+([A-ZÁÉÍÓÚÑ][^\n]{1,90})$", re.MULTILINE
)
_MAX_PALABRAS_ENCABEZADO = 12


def _limpiar_headers_repetidos(texto: str) -> str:
    """
    Elimina headers/footers repetidos página a página (típico en PDFs
    institucionales), para que no contaminen los chunks ni inflen tokens.
    """
    return _HEADER_FOOTER_PATTERN.sub("", texto).strip()


def _extraer_pdf(path: Path) -> tuple[str, List[RangoPagina]]:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"No se pudo abrir el PDF '{path.name}': {exc}") from exc

    paginas: List[str] = []
    for i, page in enumerate(reader.pages):
        try:
            paginas.append(page.extract_text() or "")
        except Exception as exc:  # noqa: BLE001
            raise IngestionError(
                f"Fallo al extraer texto de la página {i + 1} de '{path.name}': {exc}"
            ) from exc

    if not "".join(paginas).strip():
        raise PdfSinTexto(path.name, len(paginas))

    # El patrón es por línea y las páginas se unen con "\n": limpiar cada página y luego
    # unir produce exactamente el mismo texto que unir y luego limpiar, pero conserva
    # dónde empieza cada página.
    limpias = [_HEADER_FOOTER_PATTERN.sub("", p) for p in paginas]
    unido = "\n".join(limpias)
    texto = unido.strip()
    desplazamiento = len(unido) - len(unido.lstrip())

    rangos: List[RangoPagina] = []
    cursor = 0
    for numero, pagina in enumerate(limpias, start=1):
        inicio = max(0, min(len(texto), cursor - desplazamiento))
        fin = max(inicio, min(len(texto), cursor + len(pagina) - desplazamiento))
        rangos.append(RangoPagina(numero=numero, inicio=inicio, fin=fin))
        cursor += len(pagina) + 1  # +1 por el "\n" de unión
    # El salto de línea que separa una página de la siguiente pertenece a la anterior.
    for actual, siguiente in zip(rangos, rangos[1:]):
        actual.fin = siguiente.inicio
    if rangos:
        rangos[-1].fin = len(texto)
    return texto, rangos


def _extraer_texto_plano(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"No se pudo leer '{path.name}': {exc}") from exc


def detectar_secciones(
    texto: str, extension: str, paginas: Optional[List[RangoPagina]] = None
) -> List[SeccionDocumento]:
    """
    Encabezados del documento con su posición. Heurística conservadora: Markdown usa
    `#`; PDF usa numeración ("2.1 Título"). Ante la duda, no se declara sección.
    """
    paginas = paginas or []
    secciones: List[SeccionDocumento] = []
    if extension in (".md", ".markdown"):
        for m in _ENCABEZADO_MD.finditer(texto):
            secciones.append(SeccionDocumento(
                titulo=m.group(2).strip()[:200],
                nivel=len(m.group(1)),
                inicio=m.start(),
                pagina=pagina_de_offset(paginas, m.start()),
            ))
    elif extension == ".pdf":
        for m in _ENCABEZADO_NUMERADO.finditer(texto):
            titulo = m.group(2).strip()
            if titulo.endswith((".", ",", ";", ":")) or len(titulo.split()) > _MAX_PALABRAS_ENCABEZADO:
                continue
            secciones.append(SeccionDocumento(
                titulo=f"{m.group(1)} {titulo}"[:200],
                nivel=min(6, m.group(1).count(".") + 1),
                inicio=m.start(),
                pagina=pagina_de_offset(paginas, m.start()),
            ))
    return secciones[:MAX_SECCIONES_DOCUMENTO]


def cargar_documento(path: str | Path, titulo: str | None = None) -> DocumentoIngresado:
    """
    Punto de entrada único de ingesta. Despacha según extensión del archivo.
    """
    path = Path(path)
    if not path.exists():
        raise IngestionError(f"El archivo '{path}' no existe.")

    extension = path.suffix.lower()
    paginas: List[RangoPagina] = []

    if extension == ".pdf":
        texto, paginas = _extraer_pdf(path)
    elif extension in (".md", ".markdown", ".txt"):
        texto = _extraer_texto_plano(path)
    else:
        if extension in EXTENSIONES_IMAGEN:
            raise IngestionError(
                "Las imágenes no tienen texto que extraer: transcríbelas primero "
                "(POST /api/v1/documentos/extraer) y genera desde esa transcripción."
            )
        raise IngestionError(
            f"Formato no soportado: '{extension}'. Formatos válidos: {FORMATOS_VALIDOS}"
        )

    return DocumentoIngresado(
        doc_id=str(uuid.uuid4())[:8],
        titulo=titulo or path.stem,
        texto=texto,
        extension=extension,
        paginas=paginas,
        secciones=detectar_secciones(texto, extension, paginas),
    )


def cargar_documento_desde_bytes(
    contenido: bytes, nombre_archivo: str, titulo: str | None = None
) -> DocumentoIngresado:
    """
    Variante para uso desde endpoints HTTP / subida de archivos (bytes en memoria).

    El nombre del archivo lo controla el cliente: solo se usa su extensión (para elegir
    el parser) y su nombre base (como título por defecto). Los bytes se escriben en un
    directorio temporal privado que se borra al terminar; nunca en data/documents,
    que es la biblioteca pública de ejemplos.
    """
    nombre_seguro = Path(str(nombre_archivo).replace("\\", "/")).name or "documento"
    extension = Path(nombre_seguro).suffix.lower()
    with tempfile.TemporaryDirectory(prefix="novamind-upload-") as tmp:
        destino = Path(tmp) / f"subida{extension}"
        destino.write_bytes(contenido)
        return cargar_documento(destino, titulo=titulo or Path(nombre_seguro).stem)
