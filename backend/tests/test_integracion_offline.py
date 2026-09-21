"""
Integración offline: el pipeline COMPLETO con los agentes reales
(chunking, ChromaDB, prompts, parseo, Pydantic) y solo el cliente de Cohere
simulado. Comprueba que los tres agentes y el orquestador encajan entre sí.

    python -m pytest tests/test_integracion_offline.py -v
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from types import SimpleNamespace
from typing import Any, Dict, List

try:
    from app.agentes.agente1_investigador import AgenteInvestigadorRAG
    from app.agentes.agente2_productor import AgenteProductorContenido
    from app.agentes.agente3_critico import AgenteCriticoContenido
except ImportError:
    from agente1_investigador import AgenteInvestigadorRAG
    from agente2_productor import AgenteProductorContenido
    from agente3_critico import AgenteCriticoContenido
from app.core.config import Config
from app.orquestador import OrquestadorNuevaMente

DOCUMENTO = (
    "La Virtual Cloud Network (VCN) es una red privada y personalizable "
    "configurada en Oracle Cloud Infrastructure. Similar a una red de centro de "
    "datos tradicional, la VCN ofrece control total sobre su entorno de red, "
    "incluyendo subredes publicas y privadas, tablas de enrutamiento, Internet "
    "Gateways, NAT Gateways y Security Lists para control de trafico mediante "
    "reglas de entrada (ingress) y salida (egress)."
)


def _embedding(texto: str, dim: int = 64) -> List[float]:
    """Embedding de prueba determinista: bolsa de palabras hasheada y normalizada."""
    v = [0.0] * dim
    for palabra in re.findall(r"\w+", texto.lower()):
        h = int(hashlib.md5(palabra.encode()).hexdigest(), 16)
        v[h % dim] += 1.0
    norma = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norma for x in v]


class CohereSimulado:
    """Imita ClientV2.embed y ClientV2.chat. Guarda los prompts para inspeccionarlos."""

    def __init__(self, evaluaciones: List[Dict[str, Any]]):
        self._evaluaciones = list(evaluaciones)
        self.prompts_productor: List[str] = []
        self.llamadas_embed = 0

    def embed(self, model, texts, input_type, embedding_types):
        self.llamadas_embed += 1
        return SimpleNamespace(
            embeddings=SimpleNamespace(float=[_embedding(t) for t in texts])
        )

    def chat(self, model, messages, response_format=None, temperature=0.0):
        sistema = messages[0]["content"]
        usuario = messages[1]["content"]
        if "auditor de fidelidad" in sistema:  # llamada del Crítico
            eleccion = self._evaluaciones.pop(0) if len(self._evaluaciones) > 1 else self._evaluaciones[0]
            return self._respuesta(eleccion)
        self.prompts_productor.append(usuario)  # llamada del Productor
        return self._respuesta(
            {
                "metadatos": {
                    "tiempo_estimado_estudio_minutos": 5,
                    "conceptos_clave": ["VCN", "Subredes", "Security Lists"],
                    "prerrequisitos": ["Nociones de redes"],
                },
                "contenido_adaptado": {
                    "titulo": "Dominando las redes en la nube",
                    "introduccion_contextualizada": "Imagina la VCN como tu barrio privado.",
                    "items": [
                        {"frente": f"Pregunta {i}", "dorso": f"Respuesta {i}", "pista_didactica": f"Pista {i}"}
                        for i in range(5)
                    ],
                },
            }
        )

    @staticmethod
    def _respuesta(objeto: Dict[str, Any]):
        return SimpleNamespace(
            message=SimpleNamespace(content=[SimpleNamespace(text=json.dumps(objeto))])
        )


def _armar(tmp_path, evaluaciones):
    cohere_falso = CohereSimulado(evaluaciones)

    investigador = AgenteInvestigadorRAG(
        cohere_api_key="clave-falsa", chroma_path=str(tmp_path / "chroma")
    )
    investigador.cohere_client = cohere_falso

    productor = AgenteProductorContenido(api_key="clave-falsa")
    productor._cliente = cohere_falso

    critico = AgenteCriticoContenido(api_key="clave-falsa")
    critico._cliente = cohere_falso

    config = Config(
        cohere_api_key="clave-falsa",
        cohere_model="m",
        embedding_model="e",
        chroma_path=str(tmp_path / "chroma"),
        collection_name="nuevamente_documentos",
        top_k=6,
        min_score_retrieval=0.0,
        min_anclaje_fuente_score=0.75,
        max_redaccion_retries=2,
        api_reintentos=2,
        api_espera_base_segundos=0.0,
    )
    return OrquestadorNuevaMente(investigador, productor, critico, config=config), cohere_falso


def _auditoria(respaldadas: List[bool]) -> Dict[str, Any]:
    return {
        "afirmaciones": [
            {
                "afirmacion": f"Afirmación {i}",
                "respaldada": ok,
                "chunk_id_evidencia": "x" if ok else None,
                "comentario": None if ok else "No aparece en la fuente",
            }
            for i, ok in enumerate(respaldadas)
        ],
        "claridad_pedagogica": "Alta",
        "observaciones": "Lenguaje adecuado.",
        "sugerencias_correccion": [] if all(respaldadas) else ["Elimina la Afirmación 2."],
    }


SOLICITUD = {
    "documento_titulo": "Introduccion a la Arquitectura de Redes VCN en OCI",
    "documento_contenido": DOCUMENTO,
    "perfil_destinatario": "Principiante",
    "formato_salida": "Flashcards",
    "nicho_sector": "General",
    "nivel_detalle": "Didactico",
}


def test_pipeline_completo_aprobado(tmp_path):
    orq, cohere_falso = _armar(tmp_path, [_auditoria([True, True, True])])

    r = orq.ejecutar(SOLICITUD)

    assert r.status == "exito"
    assert r.orquestacion.chunks_recuperados >= 1
    assert len(r.contenido_adaptado.items) == 5
    assert r.metadatos.prerrequisitos == ["Nociones de redes"]
    assert r.evaluacion_calidad.anclaje_fuente_score == 1.0
    # el JSON final es serializable (lo que consumirá la UI / OCI)
    json.loads(r.model_dump_json())


def test_pipeline_reintenta_con_feedback_real_en_el_prompt(tmp_path):
    orq, cohere_falso = _armar(
        tmp_path, [_auditoria([True, True, False]), _auditoria([True, True, True])]
    )

    r = orq.ejecutar(SOLICITUD)

    assert r.status == "exito"
    assert r.orquestacion.scores_por_intento == [0.6667, 1.0]
    assert "CORRECCIONES OBLIGATORIAS" not in cohere_falso.prompts_productor[0]
    assert "CORRECCIONES OBLIGATORIAS" in cohere_falso.prompts_productor[1]
    assert "Afirmación 2" in cohere_falso.prompts_productor[1]


def test_segundo_escenario_reutiliza_el_indice_sin_volver_a_embeber(tmp_path):
    orq, cohere_falso = _armar(tmp_path, [_auditoria([True, True, True])])

    orq.ejecutar(SOLICITUD)
    tras_primero = cohere_falso.llamadas_embed
    orq.ejecutar({**SOLICITUD, "formato_salida": "Flashcards", "perfil_destinatario": "Avanzado"})

    # 2.ª ejecución: solo se embebe la consulta (1 llamada), no el documento
    assert cohere_falso.llamadas_embed - tras_primero == 1
