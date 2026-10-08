"""
Contratos de datos de NuevaMente (tipado estricto con Pydantic).
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Este módulo es la ÚNICA fuente de verdad de los esquemas que comparten:
- el Agente 1 (Investigador RAG)
- el Agente 2 (Productor de contenido)
- el Agente 3 (Crítico / Revisor)
- el Orquestador LangGraph
- la interfaz (Streamlit / API) y el módulo de OCI

Incluye:
1. Enumeraciones (perfil, formato, nicho, nivel de detalle) con normalización
   de alias, para aceptar tanto "Principiante" (ejemplo del brief) como
   "Principiante / Transición de Carrera".
2. Esquema de la solicitud (entrada) y de la respuesta (salida) según el brief.
3. Validación estricta de los `items` según el formato pedagógico.
4. EvaluacionCalidad con `anclaje_fuente_score` CALCULADO en código a partir
   de las afirmaciones auditadas (no es un número inventado por el LLM).
"""

from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

# ----------------------------------------------------------------------
# Enumeraciones
# ----------------------------------------------------------------------

PerfilDestinatario = Literal[
    "Principiante / Transición de Carrera",
    "Desarrollador Junior / Semi Senior",
    "Líder Técnico / Arquitecto",
    "Gestor / Ejecutivo (No Técnico)",
]

FormatoSalida = Literal[
    "Paquete Educativo Completo (5 Estaciones)",
    "Guía Práctica Paso a Paso (Tutorial)",
    "Flashcards",
    "Quiz Interactivo con Justificaciones",
    "Resumen Ejecutivo (TL;DR)",
    "Guion de Clase / Video",
]

NichoSector = Literal[
    "Fintech",
    "Salud",
    "E-commerce",
    "General",
]

NivelDetalle = Literal["Didáctico", "Intermedio", "Profundo"]


def _normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y con espacios colapsados (para comparar alias)."""
    sin_tildes = "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.lower().split())


def _construir_mapa(canonicos: Dict[str, List[str]]) -> Dict[str, str]:
    mapa: Dict[str, str] = {}
    for canonico, alias in canonicos.items():
        mapa[_normalizar(canonico)] = canonico
        for a in alias:
            mapa[_normalizar(a)] = canonico
    return mapa


_MAPA_PERFIL = _construir_mapa(
    {
        "Principiante / Transición de Carrera": [
            "principiante",
            "transicion de carrera",
            "novato",
        ],
        "Desarrollador Junior / Semi Senior": [
            "junior",
            "semi senior",
            "semisenior",
            "desarrollador junior",
            "desarrollador",
            "intermedio",
        ],
        "Líder Técnico / Arquitecto": [
            "avanzado",
            "lider tecnico",
            "arquitecto",
            "senior",
        ],
        "Gestor / Ejecutivo (No Técnico)": [
            "gestor",
            "ejecutivo",
            "no tecnico",
            "gerente",
        ],
    }
)

_MAPA_FORMATO = _construir_mapa(
    {
        "Paquete Educativo Completo (5 Estaciones)": [
            "paquete educativo completo",
            "5 estaciones",
            "paquete completo",
            "completo",
            "todas las estaciones",
            "circuito completo",
        ],
        "Guía Práctica Paso a Paso (Tutorial)": [
            "guia practica paso a paso",
            "tutorial",
            "guia",
            "guia practica",
            "paso a paso",
        ],
        "Flashcards": [
            "flashcard",
            "flashcards de memorizacion",
            "tarjetas",
            "tarjetas de memorizacion",
        ],
        "Quiz Interactivo con Justificaciones": [
            "quiz",
            "quiz interactivo",
            "cuestionario",
        ],
        "Resumen Ejecutivo (TL;DR)": [
            "resumen",
            "resumen ejecutivo",
            "tl;dr",
            "tldr",
        ],
        "Guion de Clase / Video": ["guion", "guion de clase", "video"],
    }
)

_MAPA_NICHO = _construir_mapa(
    {
        "Fintech": ["finanzas"],
        "Salud": ["health", "healthcare"],
        "E-commerce": ["ecommerce", "comercio electronico", "tienda online"],
        "General": ["generico"],
    }
)

_MAPA_NIVEL = _construir_mapa(
    {
        "Didáctico": ["didactico", "basico"],
        "Intermedio": ["estandar", "medio"],
        "Profundo": ["avanzado", "detallado", "tecnico"],
    }
)


def _resolver_alias(
    valor: Any, mapa: Dict[str, str], nombre_campo: str
) -> Any:
    """Convierte un alias al valor canónico o falla con un mensaje claro."""
    if not isinstance(valor, str):
        return valor
    clave = _normalizar(valor)
    if clave in mapa:
        return mapa[clave]
    validos = sorted(set(mapa.values()))
    raise ValueError(
        f"'{valor}' no es un valor válido para {nombre_campo}. "
        f"Opciones: {', '.join(validos)}."
    )


# ----------------------------------------------------------------------
# Entrada
# ----------------------------------------------------------------------

MIN_CARACTERES_DOCUMENTO = 40
MAX_CARACTERES_DOCUMENTO = 400_000


class SolicitudAdaptacion(BaseModel):
    """
    Solicitud de adaptación educativa (entrada del sistema).

    Sigue el ejemplo del brief: documento_titulo, documento_contenido,
    perfil_destinatario, formato_salida, nicho_sector y nivel_detalle.
    Los campos `tema_consulta` y `documento_id` son opcionales.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    documento_titulo: str = Field(..., min_length=1, max_length=200)
    documento_contenido: str = Field(
        ...,
        min_length=MIN_CARACTERES_DOCUMENTO,
        max_length=MAX_CARACTERES_DOCUMENTO,
    )
    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: NichoSector = "General"
    nivel_detalle: NivelDetalle = "Didáctico"
    tema_consulta: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Consulta usada para recuperar chunks. "
        "Si no se indica, se usa el título del documento.",
    )
    documento_id: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Identificador estable del documento. "
        "Si no se indica, se calcula un hash del contenido.",
    )

    @field_validator("perfil_destinatario", mode="before")
    @classmethod
    def _perfil(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_PERFIL, "perfil_destinatario")

    @field_validator("formato_salida", mode="before")
    @classmethod
    def _formato(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_FORMATO, "formato_salida")

    @field_validator("nicho_sector", mode="before")
    @classmethod
    def _nicho(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_NICHO, "nicho_sector")

    @field_validator("nivel_detalle", mode="before")
    @classmethod
    def _nivel(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_NIVEL, "nivel_detalle")

    @field_validator("tema_consulta", "documento_id")
    @classmethod
    def _vacio_a_none(cls, v: Optional[str]) -> Optional[str]:
        return v or None


class ParametrosGeneracion(BaseModel):
    """Parámetros que recibe el Agente Productor."""

    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: NichoSector
    nivel_detalle: NivelDetalle = "Didáctico"
    tema_consulta: str = Field(
        ...,
        description="Tema o pregunta usada para buscar chunks relevantes",
    )


# ----------------------------------------------------------------------
# Salida del Agente 2
# ----------------------------------------------------------------------


class MetadatosSalida(BaseModel):
    perfil_aplicado: str
    formato_generado: str
    nicho_aplicado: str
    tiempo_estimado_estudio_minutos: int = Field(..., ge=1, le=600)
    conceptos_clave: List[str] = Field(..., min_length=1, max_length=10)
    prerrequisitos: List[str] = Field(default_factory=list, max_length=10)


class ContenidoAdaptado(BaseModel):
    titulo: str = Field(..., min_length=1)
    introduccion_contextualizada: str = Field(..., min_length=1)
    items: List[Dict[str, Any]] = Field(default_factory=list)
    resumen_ninja: Optional[Dict[str, Any]] = None
    flashcards: Optional[List[Dict[str, Any]]] = None
    tutorial: Optional[List[Dict[str, Any]]] = None
    director_cut: Optional[List[Dict[str, Any]]] = None
    quiz: Optional[List[Dict[str, Any]]] = None


class FuenteUtilizada(BaseModel):
    documento_id: str
    chunk_id: str
    texto_fuente: str


# ----------------------------------------------------------------------
# Contrato Audiovisual y Trazabilidad RAG (Estación 4 / VideoJobSpec)
# ----------------------------------------------------------------------


class FuenteRAG(BaseModel):
    """Cita exacta a un fragmento recuperado del RAG que respalda el guion."""

    chunk_id: str = Field(..., min_length=1)
    pagina: Optional[int] = None
    texto_fuente: str = Field(..., min_length=1)


class EspecificacionVisual(BaseModel):
    """Especificación visual determinista estructurada para la escena."""

    tipo: Literal["diagrama_bloques", "ppt_concepto", "palabras_clave", "comparativa"] = "ppt_concepto"
    titulo: str = Field(..., min_length=1)
    puntos_clave: List[str] = Field(default_factory=list)
    codigo_o_estructura: Optional[str] = None
    prompt_grafico: Optional[str] = None


class EscenaDirectorCut(BaseModel):
    """
    Escena pedagógica del Director Cut / Storyboard con trazabilidad RAG estricta
    y control de tiempo para microclases de narración corta (<= 60s).
    """

    id: str = Field(..., min_length=1)
    escena: int = Field(..., ge=1)
    tiempo: str = Field(..., min_length=1)
    duracion_segundos: Optional[float] = Field(default=15.0, ge=3.0, le=30.0)
    titulo: str = Field(..., min_length=1)
    guion_locutor: str = Field(..., min_length=1)
    estimacion_palabras: Optional[int] = None
    storyboard_visual: str = Field(..., min_length=1)
    consejo_pedagogico: str = Field(..., min_length=1)
    objetivo_pedagogico: Optional[str] = None
    visual: Optional[EspecificacionVisual] = None
    fuentes: List[FuenteRAG] = Field(default_factory=list)

    @model_validator(mode="after")
    def _calcular_palabras(self) -> "EscenaDirectorCut":
        if not self.estimacion_palabras and self.guion_locutor:
            self.estimacion_palabras = len(self.guion_locutor.split())
        return self


class VideoJobSpec(BaseModel):
    """
    Contrato diferido de generación audiovisual (contract_ready).
    Permite serializar el manifiesto JSON ligero (~4 KB) con trazabilidad RAG
    sin exigir renderizado binario en la instancia OCI Always Free.
    """

    video_job_id: str
    document_id: str
    target_duration: int = Field(default=50, le=60)
    max_duration: int = Field(default=60, le=60)
    aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    idioma: str = "es"
    estado: Literal[
        "queued",
        "retrieving_context",
        "planning",
        "contract_ready",
        "rendering",
        "completed",
        "failed",
    ] = "contract_ready"
    escenas: List[EscenaDirectorCut] = Field(default_factory=list)
    total_palabras: int = 0
    duracion_total_estimada: float = 0.0
    manifiesto_url_oci: Optional[str] = None
    video_url_oci: Optional[str] = None

    @model_validator(mode="after")
    def _calcular_totales(self) -> "VideoJobSpec":
        if self.escenas:
            calc_palabras = sum(
                (e.estimacion_palabras or len(e.guion_locutor.split()))
                for e in self.escenas
            )
            if not self.total_palabras:
                self.total_palabras = calc_palabras
            if not self.duracion_total_estimada:
                # ~2.3 palabras por segundo
                self.duracion_total_estimada = round(calc_palabras / 2.3, 1)
        return self



# ----------------------------------------------------------------------
# Salida del Agente 3 (Crítico)
# ----------------------------------------------------------------------


class AfirmacionEvaluada(BaseModel):
    """Una afirmación técnica del contenido y su verificación contra la fuente."""

    afirmacion: str = Field(..., min_length=1)
    respaldada: bool
    chunk_id_evidencia: Optional[str] = None
    comentario: Optional[str] = None


class EvaluacionCalidad(BaseModel):
    """
    Evaluación de calidad del contenido generado.

    MÉTODO DE FIDELIDAD (defendible ante el jurado):
    el crítico lista las afirmaciones técnicas del contenido y marca cada una
    como respaldada o no por los fragmentos fuente. El `anclaje_fuente_score`
    NO lo escribe el LLM: se calcula aquí como
        afirmaciones respaldadas / afirmaciones totales.
    """

    anclaje_fuente_score: float = Field(default=0.0, ge=0.0, le=1.0)
    claridad_pedagogica: Literal["Alta", "Media", "Baja"]
    observaciones: str = ""
    afirmaciones: List[AfirmacionEvaluada] = Field(..., min_length=1)
    sugerencias_correccion: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _calcular_score(self) -> "EvaluacionCalidad":
        respaldadas = sum(1 for a in self.afirmaciones if a.respaldada)
        self.anclaje_fuente_score = round(
            respaldadas / len(self.afirmaciones), 4
        )
        return self

    @property
    def afirmaciones_no_respaldadas(self) -> List[AfirmacionEvaluada]:
        return [a for a in self.afirmaciones if not a.respaldada]


class PaqueteEducativo(BaseModel):
    """Paquete producido por el Agente 2."""

    status: Literal["exito", "error"]
    metadatos: MetadatosSalida
    contenido_adaptado: ContenidoAdaptado
    fuentes_utilizadas: List[FuenteUtilizada]
    evaluacion_calidad: Optional[EvaluacionCalidad] = None


# ----------------------------------------------------------------------
# Validación estricta de `items` según el formato
# ----------------------------------------------------------------------


class EstructuraInvalidaError(ValueError):
    """Los items generados no cumplen el esquema del formato pedido."""


class _ItemBase(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ItemFlashcard(_ItemBase):
    frente: str = Field(..., min_length=1)
    dorso: str = Field(..., min_length=1)
    pista_didactica: str = Field(..., min_length=1)


class ItemQuiz(_ItemBase):
    pregunta: str = Field(..., min_length=1)
    opciones: List[str] = Field(..., min_length=4, max_length=4)
    respuesta_correcta: str = Field(..., min_length=1)
    justificacion: str = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _normalizar_quiz(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        opciones = data.get("opciones")
        respuesta = data.get("respuesta_correcta")
        if not isinstance(opciones, list) or not isinstance(respuesta, str):
            return data

        # Si ya coincide exactamente, no alterar nada
        if respuesta in opciones:
            return data

        import re

        def _limpiar(texto: str) -> str:
            return re.sub(r"^[A-Da-d][\).\s]+", "", str(texto)).strip()

        # Si la respuesta es una letra aislada 'A', 'B', 'C', 'D'
        letras = ["a", "b", "c", "d"]
        resp_lower = respuesta.strip().lower()
        if resp_lower in letras and len(opciones) == 4:
            idx = letras.index(resp_lower)
            data["respuesta_correcta"] = opciones[idx]
            return data

        # Si hay discrepancia por prefijos 'A) ' en opciones o respuesta
        opciones_limpias = [_limpiar(op) for op in opciones if isinstance(op, str)]
        resp_limpia = _limpiar(respuesta)
        if resp_limpia in opciones_limpias and len(opciones_limpias) == len(opciones):
            idx = opciones_limpias.index(resp_limpia)
            data["respuesta_correcta"] = opciones[idx]
            return data

        return data

    @model_validator(mode="after")
    def _respuesta_en_opciones(self) -> "ItemQuiz":
        if self.respuesta_correcta not in self.opciones:
            raise ValueError(
                "respuesta_correcta debe coincidir exactamente con una de "
                "las opciones"
            )
        if len(set(self.opciones)) != len(self.opciones):
            raise ValueError("las opciones no pueden repetirse")
        return self


class ItemPaso(_ItemBase):
    numero_paso: int = Field(..., ge=1)
    titulo: str = Field(..., min_length=1)
    instruccion: str = Field(..., min_length=1)


class ItemResumen(_ItemBase):
    punto: str = Field(..., min_length=1)
    por_que_importa: str = Field(..., min_length=1)


class ItemSegmentoGuion(_ItemBase):
    minuto_aproximado: Union[int, str]
    narracion: str = Field(..., min_length=1)
    apoyo_visual_sugerido: str = Field(..., min_length=1)


# formato -> (modelo del item, mínimo de items, máximo de items)
# Los rangos coinciden con las instrucciones del prompt del Agente 2.
ESQUEMA_POR_FORMATO: Dict[str, tuple] = {
    "Flashcards": (ItemFlashcard, 5, 10),
    "Quiz Interactivo con Justificaciones": (ItemQuiz, 5, 8),
    "Guía Práctica Paso a Paso (Tutorial)": (ItemPaso, 4, 10),
    "Resumen Ejecutivo (TL;DR)": (ItemResumen, 4, 6),
    "Guion de Clase / Video": (ItemSegmentoGuion, 4, 8),
}


def validar_items(
    formato: str, items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Valida (tipado estricto) los items generados y devuelve versiones limpias.

    Raises:
        EstructuraInvalidaError: con un mensaje pensado para que el Agente 2
            corrija su salida en el siguiente intento.
    """
    if formato == "Paquete Educativo Completo (5 Estaciones)":
        return items

    if formato not in ESQUEMA_POR_FORMATO:
        raise EstructuraInvalidaError(f"Formato desconocido: {formato}")

    modelo, minimo, maximo = ESQUEMA_POR_FORMATO[formato]

    if not (minimo <= len(items) <= maximo):
        raise EstructuraInvalidaError(
            f"Para '{formato}' se requieren entre {minimo} y {maximo} items; "
            f"se recibieron {len(items)}."
        )

    limpios: List[Dict[str, Any]] = []
    for posicion, item in enumerate(items, start=1):
        try:
            limpios.append(modelo.model_validate(item).model_dump())
        except ValidationError as error:
            detalle = "; ".join(
                f"{'.'.join(str(p) for p in e['loc']) or 'item'}: {e['msg']}"
                for e in error.errors()
            )
            raise EstructuraInvalidaError(
                f"El item {posicion} de '{formato}' es inválido: {detalle}"
            ) from error
    return limpios


# ----------------------------------------------------------------------
# Salida del sistema (respuesta final, según el brief)
# ----------------------------------------------------------------------

CodigoError = Literal[
    "ENTRADA_INVALIDA",
    "DOCUMENTO_VACIO",
    "SIN_CONTEXTO",
    "ERROR_GENERACION",
    "ERROR_CRITICO",
    "ERROR_INDEXACION",
    "ERROR_INESPERADO",
]


class ErrorFlujo(BaseModel):
    codigo: CodigoError
    etapa: str
    mensaje_amigable: str
    detalle_tecnico: Optional[str] = None


class AlmacenamientoOCI(BaseModel):
    bucket: Optional[str] = None
    objeto_id: Optional[str] = None
    status_upload: Literal["completado", "error", "omitido"]


class MetricasOrquestacion(BaseModel):
    intentos_redaccion: int = 0
    scores_por_intento: List[float] = Field(default_factory=list)
    umbral_anclaje: float
    max_reintentos: int
    duracion_segundos: float = 0.0
    documento_id: Optional[str] = None
    chunks_recuperados: int = 0


class RespuestaAdaptacion(BaseModel):
    """
    Respuesta final del sistema.

    status:
      - "exito": el crítico aprobó el contenido (score >= umbral).
      - "exito_con_advertencias": se agotaron los reintentos sin alcanzar el
        umbral; se entrega el MEJOR intento y se recomienda revisión humana.
      - "error": no se pudo generar contenido; ver `error`.
    """

    status: Literal["exito", "exito_con_advertencias", "error"]
    metadatos: Optional[MetadatosSalida] = None
    contenido_adaptado: Optional[ContenidoAdaptado] = None
    fuentes_utilizadas: List[FuenteUtilizada] = Field(default_factory=list)
    evaluacion_calidad: Optional[EvaluacionCalidad] = None
    almacenamiento_oci: Optional[AlmacenamientoOCI] = None
    advertencias: List[str] = Field(default_factory=list)
    error: Optional[ErrorFlujo] = None
    orquestacion: MetricasOrquestacion

    @model_validator(mode="after")
    def _coherencia(self) -> "RespuestaAdaptacion":
        if self.status == "error":
            if self.error is None:
                raise ValueError("status='error' requiere el campo 'error'.")
        else:
            if self.contenido_adaptado is None or self.metadatos is None:
                raise ValueError(
                    "Una respuesta exitosa requiere contenido y metadatos."
                )
        return self
