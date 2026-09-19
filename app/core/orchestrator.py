"""
Orquestación multi-agente con LangGraph.

Flujo:
    Agente 1 (Investigador RAG)
        ↓
    Agente 2 (Productor de contenido)
        ↓
    Agente 3 (Crítico / Revisor)
        ↓
    LangGraph decide:
        ├── score suficiente → FIN
        └── score bajo       → reintentar Agente 2
"""

from __future__ import annotations

import hashlib
import os
from functools import lru_cache
from typing import Optional, TypedDict

from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from tenacity import retry, stop_after_attempt, wait_exponential

from agente1_investigador import (
    AgenteInvestigadorRAG,
    ChunkResultado,
)
from agente2_productor import (
    AgenteProductorContenido,
    ParametrosGeneracion,
)
from agente3_critico import (
    AgenteCriticoContenido,
    CriticoGenerationError,
)

from app.core.schemas import (
    ContenidoAdaptado as NuevaMenteContenidoAdaptado,
    EvaluacionCalidad,
    FormatoSalida,
    SolicitudAdaptacion,
)


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

load_dotenv()

MIN_ANCLAJE_FUENTE_SCORE = float(
    os.getenv("MIN_ANCLAJE_FUENTE_SCORE", "0.75")
)

MAX_REDACCION_RETRIES = int(
    os.getenv("MAX_REDACCION_RETRIES", "2")
)


class LLMGenerationError(Exception):
    """Error al invocar o validar una salida generada por un LLM."""


# ---------------------------------------------------------------------------
# Clientes / agentes
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def obtener_investigador() -> AgenteInvestigadorRAG:
    api_key = os.getenv("COHERE_API_KEY")

    if not api_key:
        raise LLMGenerationError(
            "No existe COHERE_API_KEY en las variables de entorno."
        )

    return AgenteInvestigadorRAG(
        cohere_api_key=api_key,
        embedding_model=os.getenv(
            "COHERE_EMBEDDING_MODEL",
            "embed-multilingual-v3.0",
        ),
        chroma_path=os.getenv(
            "AGENTE1_CHROMA_PATH",
            "./chroma_db",
        ),
        collection_name=os.getenv(
            "AGENTE1_COLLECTION_NAME",
            "nuevamente_documentos",
        ),
    )


@lru_cache(maxsize=1)
def obtener_productor() -> AgenteProductorContenido:
    api_key = os.getenv("COHERE_API_KEY")

    if not api_key:
        raise LLMGenerationError(
            "No existe COHERE_API_KEY en las variables de entorno."
        )

    return AgenteProductorContenido(
        api_key=api_key,
        modelo=os.getenv(
            "COHERE_MODEL",
            "command-a-03-2025",
        ),
    )


@lru_cache(maxsize=1)
def obtener_critico() -> AgenteCriticoContenido:
    api_key = os.getenv("COHERE_API_KEY")

    if not api_key:
        raise LLMGenerationError(
            "No existe COHERE_API_KEY en las variables de entorno."
        )

    return AgenteCriticoContenido(
        api_key=api_key,
        modelo=os.getenv(
            "COHERE_MODEL",
            "command-a-03-2025",
        ),
    )


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _crear_documento_id(
    solicitud: SolicitudAdaptacion,
) -> str:
    """
    Genera un ID estable a partir del título y contenido del documento.
    """

    base = (
        f"{solicitud.documento_titulo}\n"
        f"{solicitud.documento_contenido}"
    )

    return hashlib.sha256(
        base.encode("utf-8")
    ).hexdigest()[:20]


# ---------------------------------------------------------------------------
# Adaptación de parámetros para Agente 2
# ---------------------------------------------------------------------------

def _crear_parametros_generacion(
    solicitud: SolicitudAdaptacion,
    feedback_critico: Optional[str] = None,
) -> ParametrosGeneracion:
    """
    Traduce los modelos de NuevaMente al contrato esperado por Agente 2.
    """

    formatos = {
        FormatoSalida.TUTORIAL:
            "Guía Práctica Paso a Paso",
        FormatoSalida.FLASHCARDS:
            "Flashcards",
        FormatoSalida.QUIZ:
            "Quiz Interactivo con Justificaciones",
        FormatoSalida.RESUMEN_TLDR:
            "Resumen Ejecutivo (TL;DR)",
        FormatoSalida.GUION_CLASE:
            "Guion de Clase / Video",
    }

    nichos_validos = {
        "Fintech",
        "Salud",
        "E-commerce",
        "General",
    }

    nicho = solicitud.nicho_sector.strip()

    if nicho not in nichos_validos:
        nicho = "General"

    tema_consulta = (
        f"{solicitud.documento_titulo}\n"
        f"Nivel de detalle solicitado: "
        f"{solicitud.nivel_detalle.value}"
    )

    if feedback_critico:
        tema_consulta += (
            "\n\nCorrección obligatoria indicada por el crítico:\n"
            f"{feedback_critico}"
        )

    return ParametrosGeneracion(
        perfil_destinatario=solicitud.perfil_destinatario.value,
        formato_salida=formatos[solicitud.formato_salida],
        nicho_sector=nicho,
        tema_consulta=tema_consulta,
    )


# ---------------------------------------------------------------------------
# Conversión de salida del Agente 2 al schema de NuevaMente
# ---------------------------------------------------------------------------

def _convertir_paquete_a_nuevamente(
    paquete,
    formato: FormatoSalida,
) -> NuevaMenteContenidoAdaptado:
    """
    Convierte la salida del Agente 2 al contrato de NuevaMente.
    """

    generado = paquete.contenido_adaptado.model_dump(
        exclude_none=True
    )

    items_origen = generado.get("items") or []
    items_destino = []

    # ------------------------------------------------------------------
    # Flashcards
    # ------------------------------------------------------------------

    if formato == FormatoSalida.FLASHCARDS:
        for item in items_origen:
            items_destino.append(
                {
                    "frente": item.get("frente"),
                    "dorso": item.get("dorso"),
                    "pista_didactica": item.get(
                        "pista_didactica"
                    ),
                }
            )

    # ------------------------------------------------------------------
    # Quiz
    # ------------------------------------------------------------------

    elif formato == FormatoSalida.QUIZ:
        for item in items_origen:
            items_destino.append(
                {
                    "pregunta": item.get("pregunta"),
                    "opciones": item.get("opciones"),
                    "respuesta_correcta": item.get(
                        "respuesta_correcta"
                    ),
                    "justificacion": item.get(
                        "justificacion"
                    ),
                }
            )

    # ------------------------------------------------------------------
    # Tutorial
    # ------------------------------------------------------------------

    elif formato == FormatoSalida.TUTORIAL:
        for item in items_origen:
            items_destino.append(
                {
                    "paso_titulo": item.get(
                        "titulo",
                        item.get("paso_titulo"),
                    ),
                    "paso_contenido": item.get(
                        "instruccion",
                        item.get("paso_contenido"),
                    ),
                }
            )

    # ------------------------------------------------------------------
    # Guion de clase / video
    # ------------------------------------------------------------------

    elif formato == FormatoSalida.GUION_CLASE:
        for indice, item in enumerate(
            items_origen,
            start=1,
        ):
            partes_escena = []

            minuto = item.get("minuto_aproximado")
            apoyo = item.get("apoyo_visual_sugerido")

            if minuto:
                partes_escena.append(
                    f"Minuto {minuto}"
                )

            if apoyo:
                partes_escena.append(str(apoyo))

            escena = " — ".join(partes_escena)

            if not escena:
                escena = f"Escena {indice}"

            items_destino.append(
                {
                    "escena": escena,
                    "narracion": item.get("narracion"),
                }
            )

    # ------------------------------------------------------------------
    # TL;DR
    # ------------------------------------------------------------------

    elif formato == FormatoSalida.RESUMEN_TLDR:
        lineas = []

        for item in items_origen:
            punto = item.get("punto")
            importancia = item.get("por_que_importa")

            if punto and importancia:
                lineas.append(
                    f"- **{punto}**: {importancia}"
                )
            elif punto:
                lineas.append(
                    f"- **{punto}**"
                )

        return NuevaMenteContenidoAdaptado(
            titulo=generado["titulo"],
            introduccion_contextualizada=generado[
                "introduccion_contextualizada"
            ],
            items=[],
            resumen_markdown="\n".join(lineas),
        )

    else:
        raise LLMGenerationError(
            f"Formato no soportado: {formato}"
        )

    return NuevaMenteContenidoAdaptado(
        titulo=generado["titulo"],
        introduccion_contextualizada=generado[
            "introduccion_contextualizada"
        ],
        items=items_destino,
        resumen_markdown=None,
    )


# ---------------------------------------------------------------------------
# Estado del grafo
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    solicitud: SolicitudAdaptacion
    fragmentos: str
    chunks_rag: list[ChunkResultado]

    contenido_adaptado: Optional[
        NuevaMenteContenidoAdaptado
    ]

    evaluacion: Optional[EvaluacionCalidad]

    intentos_redaccion: int

    feedback_critico: Optional[str]


# ---------------------------------------------------------------------------
# Nodo 1 — Agente Investigador
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=2,
        max=10,
    ),
)
def nodo_investigador(
    state: AgentState,
) -> AgentState:
    solicitud = state["solicitud"]

    investigador = obtener_investigador()

    documento_id = _crear_documento_id(
        solicitud
    )

    investigador.ingerir_documento(
        documento_id=documento_id,
        documento_titulo=solicitud.documento_titulo,
        texto=solicitud.documento_contenido,
    )

    consulta = (
        f"{solicitud.documento_titulo}. "
        f"{solicitud.nicho_sector}"
    )

    chunks = investigador.buscar(
        consulta=consulta,
        top_k=6,
        documento_id=documento_id,
        min_score=0.0,
    )

    if not chunks:
        chunks = [
            ChunkResultado(
                texto=solicitud.documento_contenido,
                documento_id=documento_id,
                documento_titulo=solicitud.documento_titulo,
                chunk_id=f"{documento_id}-fallback",
                posicion=0,
                score=0.0,
            )
        ]

    fragmentos = "\n\n---\n\n".join(
        chunk.texto
        for chunk in chunks
    )

    return {
        **state,
        "fragmentos": fragmentos,
        "chunks_rag": chunks,
    }


# ---------------------------------------------------------------------------
# Nodo 2 — Agente Productor
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=2,
        max=10,
    ),
)
def nodo_redactor(
    state: AgentState,
) -> AgentState:
    solicitud = state["solicitud"]

    chunks = state.get(
        "chunks_rag",
        [],
    )

    if not chunks:
        raise LLMGenerationError(
            "El Agente Investigador no devolvió fragmentos."
        )

    productor = obtener_productor()

    parametros = _crear_parametros_generacion(
        solicitud=solicitud,
        feedback_critico=state.get(
            "feedback_critico"
        ),
    )

    paquete = productor.generar_contenido(
        chunks=chunks,
        parametros=parametros,
    )

    contenido = _convertir_paquete_a_nuevamente(
        paquete=paquete,
        formato=solicitud.formato_salida,
    )

    return {
        **state,
        "contenido_adaptado": contenido,
        "intentos_redaccion": (
            state["intentos_redaccion"] + 1
        ),
    }


# ---------------------------------------------------------------------------
# Nodo 3 — Agente Crítico
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=2,
        max=10,
    ),
)
def nodo_critico(
    state: AgentState,
) -> AgentState:
    contenido = state["contenido_adaptado"]

    if contenido is None:
        raise LLMGenerationError(
            "No existe contenido para evaluar."
        )

    critico = obtener_critico()

    try:
        evaluacion = critico.evaluar(
            contenido_generado=contenido,
            fragmentos=state["fragmentos"],
        )

    except CriticoGenerationError as exc:
        raise LLMGenerationError(
            str(exc)
        ) from exc

    feedback = None

    if (
        evaluacion.anclaje_fuente_score
        < MIN_ANCLAJE_FUENTE_SCORE
    ):
        feedback = evaluacion.observaciones

    return {
        **state,
        "evaluacion": evaluacion,
        "feedback_critico": feedback,
    }


# ---------------------------------------------------------------------------
# Decisión del ciclo Crítico → Productor
# ---------------------------------------------------------------------------

def _decidir_despues_de_critico(
    state: AgentState,
) -> str:
    evaluacion = state["evaluacion"]

    score_ok = (
        evaluacion is not None
        and evaluacion.anclaje_fuente_score
        >= MIN_ANCLAJE_FUENTE_SCORE
    )

    quedan_intentos = (
        state["intentos_redaccion"]
        < MAX_REDACCION_RETRIES
    )

    if score_ok or not quedan_intentos:
        return "fin"

    return "reintentar"


# ---------------------------------------------------------------------------
# Construcción del grafo
# ---------------------------------------------------------------------------

def construir_grafo():
    grafo = StateGraph(AgentState)

    grafo.add_node(
        "investigador",
        nodo_investigador,
    )

    grafo.add_node(
        "redactor",
        nodo_redactor,
    )

    grafo.add_node(
        "critico",
        nodo_critico,
    )

    grafo.set_entry_point(
        "investigador"
    )

    grafo.add_edge(
        "investigador",
        "redactor",
    )

    grafo.add_edge(
        "redactor",
        "critico",
    )

    grafo.add_conditional_edges(
        "critico",
        _decidir_despues_de_critico,
        {
            "reintentar": "redactor",
            "fin": END,
        },
    )

    return grafo.compile()


_GRAFO = None


# ---------------------------------------------------------------------------
# Punto de entrada público
# ---------------------------------------------------------------------------

def ejecutar_pipeline(
    solicitud: SolicitudAdaptacion,
) -> AgentState:
    """
    Ejecuta el pipeline completo de NuevaMente.

    Flujo:
        Investigador → Productor → Crítico
        → FIN o reintento del Productor.
    """

    global _GRAFO

    if _GRAFO is None:
        _GRAFO = construir_grafo()

    estado_inicial: AgentState = {
        "solicitud": solicitud,
        "fragmentos": "",
        "chunks_rag": [],
        "contenido_adaptado": None,
        "evaluacion": None,
        "intentos_redaccion": 0,
        "feedback_critico": None,
    }

    return _GRAFO.invoke(
        estado_inicial
    )