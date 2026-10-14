"""
Transcripción de imágenes y PDF escaneados con Gemini (una sola llamada por archivo).

Las citas literales, la auditoría de fidelidad y el RAG trabajan sobre texto: una imagen no
se puede citar. Por eso la imagen no se manda a cada tarea de generación: se transcribe una
vez, el usuario revisa ese texto y se genera desde él, marcado como transcripción IA. Una
cita "verificada" significa entonces "coincide con la transcripción", no con el original.

Política de contenido: se transcribe el texto visible y se describen los diagramas (esa
descripción va rotulada como generada por IA). Una fotografía sin texto ni diagrama no es
una fuente: se rechaza en lugar de describirla, porque una lección sobre lo que "se ve" en
ella sería contenido inventado.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Literal

from pydantic import BaseModel, Field

from app.core.config import Config
from app.core.ingestion import IngestionError, texto_con_marcadores
from app.core.schemas import MIN_CARACTERES_DOCUMENTO
from app.servicios.servicio_gemini import ClienteGemini, GeminiError, entrada_con_archivo

logger = logging.getLogger("novamind.transcripcion")

ORIGEN_TRANSCRIPCION = "transcripcion_ia"
# Datos inline: la petición entera debe quedar por debajo de 20 MB y el base64 ocupa 4/3.
MAX_BYTES_TRANSCRIPCION = 10 * 1024 * 1024
# ~1.100 tokens de entrada por página. El límite mantiene la llamada por debajo de los
# 100 s de Cloudflare: este endpoint responde de una vez, sin SSE ni heartbeats.
MAX_PAGINAS_TRANSCRIPCION = 15
# Plazo de todo el intento (principal + respaldo + reintentos). Medido el 2026-10-13: el
# principal transcribe 1-2 páginas en 2-4 s; los respaldos tardaron hasta 80 s con 503/429.
PLAZO_TOTAL_S = 85.0
_TIMEOUT_PRINCIPAL_S = 30.0
_MAX_TOKENS_SALIDA = 32_768
ROTULO_DIAGRAMA = "[Descripción del diagrama generada por IA]"


class PaginaTranscrita(BaseModel):
    numero: int = Field(..., ge=1, description="Número de página (1 para una imagen).")
    texto_visible: str = Field(
        ..., description="Todo el texto legible de la página, literal y en orden de lectura. Vacío si no hay texto."
    )
    descripcion_diagrama: str = Field(
        "", description="Solo si hay un diagrama, esquema, tabla o gráfico: componentes, etiquetas y relaciones."
    )


class TranscripcionModelo(BaseModel):
    contenido: Literal["texto", "diagrama", "texto_y_diagrama", "sin_contenido_util"]
    paginas: List[PaginaTranscrita]


_INSTRUCCIONES = """Eres un transcriptor de documentos técnicos. Recibes una imagen o un PDF escaneado.

Reglas:
- Transcribe literalmente todo el texto visible: no corrijas, no resumas, no traduzcas y no completes palabras; escribe [ilegible] donde no se pueda leer.
- Conserva el orden de lectura, los títulos, las listas y los saltos de línea del original.
- descripcion_diagrama solo para diagramas, esquemas, tablas o gráficos: enumera componentes, etiquetas y relaciones (flechas, jerarquías, valores) sin interpretar más allá de lo dibujado. Vacío si no hay.
- Si es una fotografía o ilustración sin texto ni diagrama (personas, objetos, paisajes), responde contenido="sin_contenido_util" con la lista de páginas vacía: no describas la escena.
- Una entrada por página del PDF, en orden y numeradas desde 1; una sola entrada (numero=1) para una imagen."""


@dataclass
class Transcripcion:
    texto: str
    paginas: int
    modelo: str
    con_diagramas: bool
    advertencias: List[str] = field(default_factory=list)


def _pasa_al_respaldo(exc: GeminiError) -> bool:
    return exc.reintentable or exc.codigo == "modelo_no_encontrado"


async def _llamar(cliente: ClienteGemini, config: Config, entrada) -> tuple[TranscripcionModelo, str]:
    def llamada(modelo: str, **extra):
        return cliente.generar_json(
            modelo=modelo, instrucciones=_INSTRUCCIONES, entrada=entrada,
            esquema_salida=TranscripcionModelo, thinking_level="low",
            max_output_tokens=_MAX_TOKENS_SALIDA, **extra,
        )

    principal, respaldo = config.gemini_transcription_model, config.gemini_transcription_fallback_model
    if not respaldo or respaldo == principal:
        r = await llamada(principal, timeout_s=PLAZO_TOTAL_S)
        return r.datos, r.uso.modelo
    try:
        r = await llamada(principal, timeout_s=_TIMEOUT_PRINCIPAL_S, max_reintentos=0)
        return r.datos, r.uso.modelo
    except GeminiError as exc:
        if not _pasa_al_respaldo(exc):
            raise
        logger.warning("[transcripcion] %s falló (%s); se usa %s", principal, exc.codigo, respaldo)
    r = await llamada(respaldo, timeout_s=PLAZO_TOTAL_S - _TIMEOUT_PRINCIPAL_S)
    return r.datos, r.uso.modelo


async def _llamar_con_plazo(cliente: ClienteGemini, config: Config, entrada) -> tuple[TranscripcionModelo, str]:
    try:
        return await asyncio.wait_for(_llamar(cliente, config, entrada), timeout=PLAZO_TOTAL_S)
    except asyncio.TimeoutError:
        raise GeminiError("timeout", f"La transcripción no terminó en {PLAZO_TOTAL_S:.0f} s.", reintentable=True) from None


def _componer(datos: TranscripcionModelo, es_pdf: bool, paginas_esperadas: int) -> tuple[str, List[str]]:
    advertencias: List[str] = []
    paginas = sorted(datos.paginas, key=lambda p: p.numero)
    textos = []
    for p in paginas:
        partes = [p.texto_visible.strip()]
        if p.descripcion_diagrama.strip():
            partes.append(f"{ROTULO_DIAGRAMA}\n{p.descripcion_diagrama.strip()}")
        textos.append("\n\n".join(x for x in partes if x))
    if not es_pdf:
        return "\n\n".join(t for t in textos if t).strip(), advertencias
    numeros = [p.numero for p in paginas]
    if numeros != list(range(1, paginas_esperadas + 1)):
        # Una página falsa es peor que ninguna: sin marcadores, las citas no llevan página.
        advertencias.append(
            f"La transcripción no separó bien las {paginas_esperadas} páginas del PDF; "
            "las citas no indicarán número de página."
        )
        return "\n\n".join(t for t in textos if t).strip(), advertencias
    return texto_con_marcadores(textos), advertencias


async def transcribir(
    cliente: ClienteGemini,
    config: Config,
    datos: bytes,
    mime_type: str,
    *,
    paginas_esperadas: int = 1,
) -> Transcripcion:
    """
    Imagen o PDF escaneado → texto revisable. IngestionError si el archivo no sirve como
    fuente (demasiado grande, demasiadas páginas, sin texto ni diagrama); GeminiError si el
    modelo no responde.
    """
    es_pdf = mime_type == "application/pdf"
    if len(datos) > MAX_BYTES_TRANSCRIPCION:
        raise IngestionError(
            f"Para transcribir, el archivo debe pesar como máximo {MAX_BYTES_TRANSCRIPCION // (1024 * 1024)} MB."
        )
    if es_pdf and paginas_esperadas > MAX_PAGINAS_TRANSCRIPCION:
        raise IngestionError(
            f"El PDF escaneado tiene {paginas_esperadas} páginas; se transcriben como máximo "
            f"{MAX_PAGINAS_TRANSCRIPCION}. Divide el documento o súbelo con texto (OCR)."
        )
    entrada = entrada_con_archivo(
        f"Transcribe este {'PDF escaneado de ' + str(paginas_esperadas) + ' página(s)' if es_pdf else 'archivo de imagen'}.",
        datos, mime_type,
    )
    resultado, modelo = await _llamar_con_plazo(cliente, config, entrada)
    texto, advertencias = _componer(resultado, es_pdf, paginas_esperadas)
    literal = sum(len(p.texto_visible.strip()) for p in resultado.paginas)
    con_diagramas = any(p.descripcion_diagrama.strip() for p in resultado.paginas)
    if resultado.contenido == "sin_contenido_util" or len(texto) < MIN_CARACTERES_DOCUMENTO:
        raise IngestionError(
            "El archivo no contiene texto legible ni un diagrama del que generar material: "
            "una fotografía sin texto no es una fuente verificable."
        )
    if con_diagramas:
        advertencias.append(
            f"Incluye descripciones de diagramas redactadas por la IA ({ROTULO_DIAGRAMA}): "
            "revísalas, no son texto del original."
        )
    if literal < MIN_CARACTERES_DOCUMENTO * 5:
        advertencias.append("Hay poco texto: el material generado será breve.")
    logger.info("[transcripcion] %s: %d caracteres, %d página(s), modelo %s",
                mime_type, len(texto), max(1, len(resultado.paginas)), modelo)
    return Transcripcion(texto=texto, paginas=len(resultado.paginas), modelo=modelo,
                         con_diagramas=con_diagramas, advertencias=advertencias)
