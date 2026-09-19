"""
Ingesta y extracción de texto de documentos técnicos.

Soporta los tres formatos exigidos por el whitepaper: PDF, Markdown y texto plano.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


class IngestionError(Exception):
    """Error al extraer contenido de un documento de entrada."""


@dataclass
class DocumentoIngresado:
    doc_id: str
    titulo: str
    texto: str
    extension: str


_HEADER_FOOTER_PATTERN = re.compile(
    r"^(Programa ONE.*|Hackathon ONE G10.*)$", re.MULTILINE
)


def _limpiar_headers_repetidos(texto: str) -> str:
    """
    Elimina headers/footers repetidos página a página (típico en PDFs
    institucionales, como el propio whitepaper de este proyecto), para
    que no contaminen los chunks ni infeln el conteo de tokens.
    """
    return _HEADER_FOOTER_PATTERN.sub("", texto).strip()


def _extraer_pdf(path: Path) -> str:
    try:
        reader = PdfReader(str(path))
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"No se pudo abrir el PDF '{path.name}': {exc}") from exc

    paginas = []
    for i, page in enumerate(reader.pages):
        try:
            paginas.append(page.extract_text() or "")
        except Exception as exc:  # noqa: BLE001
            raise IngestionError(
                f"Fallo al extraer texto de la página {i + 1} de '{path.name}': {exc}"
            ) from exc

    texto_crudo = "\n".join(paginas)
    if not texto_crudo.strip():
        raise IngestionError(
            f"El PDF '{path.name}' no contiene texto extraíble "
            "(¿es un escaneo sin OCR?)."
        )
    return _limpiar_headers_repetidos(texto_crudo)


def _extraer_texto_plano(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception as exc:  # noqa: BLE001
        raise IngestionError(f"No se pudo leer '{path.name}': {exc}") from exc


def cargar_documento(path: str | Path, titulo: str | None = None) -> DocumentoIngresado:
    """
    Punto de entrada único de ingesta. Despacha según extensión del archivo.
    """
    path = Path(path)
    if not path.exists():
        raise IngestionError(f"El archivo '{path}' no existe.")

    extension = path.suffix.lower()

    if extension == ".pdf":
        texto = _extraer_pdf(path)
    elif extension in (".md", ".markdown", ".txt"):
        texto = _extraer_texto_plano(path)
    else:
        raise IngestionError(
            f"Formato no soportado: '{extension}'. "
            "Formatos válidos: .pdf, .md, .markdown, .txt"
        )

    return DocumentoIngresado(
        doc_id=str(uuid.uuid4())[:8],
        titulo=titulo or path.stem,
        texto=texto,
        extension=extension,
    )


def cargar_documento_desde_bytes(
    contenido: bytes, nombre_archivo: str, titulo: str | None = None
) -> DocumentoIngresado:
    """
    Variante para uso desde Streamlit (`st.file_uploader` entrega bytes en
    memoria, no una ruta en disco). Persiste a un archivo temporal en
    /app/data/documents para poder reutilizar `cargar_documento`.
    """
    destino_dir = Path("data/documents")
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / nombre_archivo

    with open(destino, "wb") as f:
        f.write(contenido)

    return cargar_documento(destino, titulo=titulo)
