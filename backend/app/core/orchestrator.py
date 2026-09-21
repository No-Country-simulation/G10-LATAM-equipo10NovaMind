"""
Orquestación multi-agente con LangGraph.

Grafo:

    investigador -> redactor -> critico --(score OK)--> END
                        ^                |
                        |                | (score bajo y quedan reintentos)
                        +----------------+

El ciclo redactor<->critico es la pieza que justifica LangGraph por sobre una
chain lineal de LangChain: permite reescritura automática cuando el Agente
Crítico detecta baja fidelidad a la fuente (anclaje_fuente_score bajo el
umbral configurado), en vez de devolver contenido alucinado sin corrección.
"""

from __future__ import annotations

import json
import os
from typing import Optional, TypedDict

from langgraph.graph import END, StateGraph
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.prompts import (
    SYSTEM_CRITICO,
    SYSTEM_INVESTIGADOR,
    SYSTEM_REDACTOR,
    construir_prompt_critico,
    construir_prompt_redactor,
)
from app.core.rag_pipeline import recuperar_chunks_relevantes
from app.core.schemas import (
    ContenidoAdaptado,
    EvaluacionCalidad,
    SolicitudAdaptacion,
)

MIN_ANCLAJE_FUENTE_SCORE = float(os.getenv("MIN_ANCLAJE_FUENTE_SCORE", "0.75"))
MAX_REDACCION_RETRIES = int(os.getenv("MAX_REDACCION_RETRIES", "2"))


class LLMGenerationError(Exception):
    """Error al invocar el LLM o al parsear su salida estructurada."""


# ---------------------------------------------------------------------------
# Factory de LLM: abstrae el proveedor detrás de una interfaz común
# (permite cambiar Gemini <-> Ollama <-> Claude con una sola variable de env)
# ---------------------------------------------------------------------------

def get_llm(temperature: float = 0.3):
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    if provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            google_api_key=os.environ["GEMINI_API_KEY"],
            temperature=temperature,
        )

    if provider == "ollama":
        from langchain_ollama import ChatOllama

        return ChatOllama(
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.getenv("OLLAMA_MODEL", "llama3.1"),
            temperature=temperature,
        )

    if provider == "claude":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            model=os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
            api_key=os.environ["ANTHROPIC_API_KEY"],
            temperature=temperature,
        )

    raise LLMGenerationError(f"LLM_PROVIDER no soportado: '{provider}'")


def _parsear_json_llm(texto: str) -> dict:
    """
    Limpia fences de markdown (```json ... ```) que algunos proveedores
    agregan igual pese a pedir "solo JSON", y parsea el resultado.
    """
    limpio = texto.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(limpio)
    except json.JSONDecodeError as exc:
        raise LLMGenerationError(f"El LLM no devolvió JSON válido: {exc}\n---\n{texto}") from exc


# ---------------------------------------------------------------------------
# Estado del grafo
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    solicitud: SolicitudAdaptacion
    fragmentos: str
    contenido_adaptado: Optional[ContenidoAdaptado]
    evaluacion: Optional[EvaluacionCalidad]
    intentos_redaccion: int
    feedback_critico: Optional[str]


# ---------------------------------------------------------------------------
# Nodos
# ---------------------------------------------------------------------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def nodo_investigador(state: AgentState) -> AgentState:
    llm = get_llm(temperature=0.0)
    solicitud = state["solicitud"]

    query = llm.invoke(
        [
            ("system", SYSTEM_INVESTIGADOR),
            ("human", f"Tema: {solicitud.documento_titulo}. "
                      f"Nicho: {solicitud.nicho_sector}."),
        ]
    ).content

    chunks = recuperar_chunks_relevantes(query=query, k=6)
    fragmentos = "\n\n---\n\n".join(c.texto for c in chunks) or solicitud.documento_contenido

    return {**state, "fragmentos": fragmentos}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def nodo_redactor(state: AgentState) -> AgentState:
    llm = get_llm(temperature=0.4)
    solicitud = state["solicitud"]

    prompt = construir_prompt_redactor(
        fragmentos=state["fragmentos"],
        perfil=solicitud.perfil_destinatario.value,
        formato=solicitud.formato_salida.value,
        nicho=solicitud.nicho_sector,
        nivel_detalle=solicitud.nivel_detalle.value,
        feedback_critico=state.get("feedback_critico"),
    )

    respuesta = llm.invoke([("system", SYSTEM_REDACTOR), ("human", prompt)]).content
    data = _parsear_json_llm(respuesta)

    try:
        contenido = ContenidoAdaptado.model_validate(data)
    except Exception as exc:  # noqa: BLE001
        raise LLMGenerationError(f"Salida del Redactor no cumple el esquema: {exc}") from exc

    return {
        **state,
        "contenido_adaptado": contenido,
        "intentos_redaccion": state["intentos_redaccion"] + 1,
    }


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def nodo_critico(state: AgentState) -> AgentState:
    llm = get_llm(temperature=0.0)

    prompt = construir_prompt_critico(
        contenido_generado=state["contenido_adaptado"].model_dump_json(),
        fragmentos=state["fragmentos"],
    )

    respuesta = llm.invoke([("system", SYSTEM_CRITICO), ("human", prompt)]).content
    data = _parsear_json_llm(respuesta)

    try:
        evaluacion = EvaluacionCalidad.model_validate(data)
    except Exception as exc:  # noqa: BLE001
        raise LLMGenerationError(f"Salida del Crítico no cumple el esquema: {exc}") from exc

    feedback = None
    if evaluacion.anclaje_fuente_score < MIN_ANCLAJE_FUENTE_SCORE:
        feedback = evaluacion.observaciones

    return {**state, "evaluacion": evaluacion, "feedback_critico": feedback}


def _decidir_despues_de_critico(state: AgentState) -> str:
    score_ok = (
        state["evaluacion"] is not None
        and state["evaluacion"].anclaje_fuente_score >= MIN_ANCLAJE_FUENTE_SCORE
    )
    quedan_intentos = state["intentos_redaccion"] < MAX_REDACCION_RETRIES

    if score_ok or not quedan_intentos:
        return "fin"
    return "reintentar"


# ---------------------------------------------------------------------------
# Construcción del grafo
# ---------------------------------------------------------------------------

def construir_grafo():
    grafo = StateGraph(AgentState)

    grafo.add_node("investigador", nodo_investigador)
    grafo.add_node("redactor", nodo_redactor)
    grafo.add_node("critico", nodo_critico)

    grafo.set_entry_point("investigador")
    grafo.add_edge("investigador", "redactor")
    grafo.add_edge("redactor", "critico")
    grafo.add_conditional_edges(
        "critico",
        _decidir_despues_de_critico,
        {"reintentar": "redactor", "fin": END},
    )

    return grafo.compile()


_GRAFO = None


def ejecutar_pipeline(solicitud: SolicitudAdaptacion) -> AgentState:
    """
    Punto de entrada usado por el endpoint FastAPI de app/main.py.
    Es la única función que el resto del backend expone hacia afuera de
    este módulo para ejecutar el grafo de agentes de punta a punta.
    """
    global _GRAFO
    if _GRAFO is None:
        _GRAFO = construir_grafo()

    estado_inicial: AgentState = {
        "solicitud": solicitud,
        "fragmentos": "",
        "contenido_adaptado": None,
        "evaluacion": None,
        "intentos_redaccion": 0,
        "feedback_critico": None,
    }

    return _GRAFO.invoke(estado_inicial)
