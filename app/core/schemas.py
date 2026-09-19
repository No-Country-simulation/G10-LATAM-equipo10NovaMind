"""
Esquemas Pydantic para NuevaMente.

Estos modelos son el contrato tipado que:
  1. Valida la entrada del usuario (Streamlit o REST).
  2. Fuerza el formato de salida del LLM (Structured Outputs).
  3. Cumple el requisito del whitepaper: "validación de esquemas de entrada
     y salida con tipado estricto".
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enums de parametrización (tal como los define el whitepaper)
# ---------------------------------------------------------------------------

class PerfilDestinatario(str, Enum):
    PRINCIPIANTE = "Principiante / Transición de Carrera"
    JUNIOR_SEMI_SENIOR = "Desarrollador Junior / Semi Senior"
    LIDER_ARQUITECTO = "Líder Técnico / Arquitecto"
    GESTOR_NO_TECNICO = "Gestor / Ejecutivo (No Técnico)"


class FormatoSalida(str, Enum):
    TUTORIAL = "Guía Práctica Paso a Paso (Tutorial)"
    FLASHCARDS = "Flashcards"
    QUIZ = "Quiz Interactivo con Justificaciones"
    RESUMEN_TLDR = "Resumen Ejecutivo (TL;DR)"
    GUION_CLASE = "Guion de Clase / Video"


class NivelDetalle(str, Enum):
    DIDACTICO = "Didactico"
    ESTANDAR = "Estandar"
    PROFUNDO = "Profundo"


class ClaridadPedagogica(str, Enum):
    BAJA = "Baja"
    MEDIA = "Media"
    ALTA = "Alta"


# ---------------------------------------------------------------------------
# Entrada (Solicitud)
# ---------------------------------------------------------------------------

class SolicitudAdaptacion(BaseModel):
    documento_titulo: str = Field(..., min_length=3, max_length=300)
    documento_contenido: str = Field(
        ..., min_length=20,
        description="Texto crudo extraído del PDF/Markdown/txt de entrada.",
    )
    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: str = Field(default="General", max_length=100)
    nivel_detalle: NivelDetalle = NivelDetalle.DIDACTICO

    @field_validator("documento_contenido")
    @classmethod
    def contenido_no_vacio(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("El contenido del documento no puede estar vacío.")
        return v


# ---------------------------------------------------------------------------
# Salida — contenido adaptado (estructura flexible según formato)
# ---------------------------------------------------------------------------

class ItemContenido(BaseModel):
    """
    Unidad atómica de contenido. Su forma varía según el formato de salida:
      - Flashcards -> frente / dorso / pista_didactica
      - Quiz       -> pregunta / opciones / respuesta_correcta / justificacion
      - Tutorial   -> paso_titulo / paso_contenido
      - Guion      -> escena / narracion
    Se modela de forma laxa (todos los campos opcionales) para admitir los
    distintos formatos sin duplicar cinco esquemas casi idénticos; el
    Agente Redactor solo completa los campos relevantes al formato pedido.
    """

    frente: Optional[str] = None
    dorso: Optional[str] = None
    pista_didactica: Optional[str] = None

    pregunta: Optional[str] = None
    opciones: Optional[list[str]] = None
    respuesta_correcta: Optional[str] = None
    justificacion: Optional[str] = None

    paso_titulo: Optional[str] = None
    paso_contenido: Optional[str] = None

    escena: Optional[str] = None
    narracion: Optional[str] = None


class ContenidoAdaptado(BaseModel):
    titulo: str
    introduccion_contextualizada: str
    items: list[ItemContenido] = Field(default_factory=list)
    resumen_markdown: Optional[str] = Field(
        default=None,
        description="Usado por formatos de texto corrido (TL;DR), donde 'items' no aplica.",
    )


class Metadatos(BaseModel):
    perfil_aplicado: str
    formato_generado: str
    tiempo_estimado_estudio_minutos: int = Field(ge=1, le=240)
    conceptos_clave: list[str] = Field(default_factory=list)


class EvaluacionCalidad(BaseModel):
    anclaje_fuente_score: float = Field(ge=0.0, le=1.0)
    claridad_pedagogica: ClaridadPedagogica
    observaciones: str


class AlmacenamientoOCI(BaseModel):
    bucket: str
    objeto_id: str
    status_upload: str  # "completado" | "pendiente" | "error"


class RespuestaAdaptacion(BaseModel):
    status: str  # "exito" | "error"
    metadatos: Optional[Metadatos] = None
    contenido_adaptado: Optional[ContenidoAdaptado] = None
    evaluacion_calidad: Optional[EvaluacionCalidad] = None
    almacenamiento_oci: Optional[AlmacenamientoOCI] = None
    error_detalle: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "exito",
                "metadatos": {
                    "perfil_aplicado": "Principiante",
                    "formato_generado": "Flashcards",
                    "tiempo_estimado_estudio_minutos": 5,
                    "conceptos_clave": ["VCN", "Subredes", "Internet Gateway"],
                },
            }
        }
    }


# ---------------------------------------------------------------------------
# Chunk indexado (para trazabilidad de fuente en el Vector Store)
# ---------------------------------------------------------------------------

class ChunkMetadata(BaseModel):
    doc_id: str
    doc_titulo: str
    chunk_index: int
    fuente_extracto: str = Field(
        max_length=280,
        description="Primeros caracteres del chunk, para citar la fuente en la UI.",
    )


class ChunkRecuperado(BaseModel):
    texto: str
    metadata: ChunkMetadata
    score: float
