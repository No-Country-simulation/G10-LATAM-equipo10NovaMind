"""
Pruebas unitarias para el Agente Crítico Multi-Proveedor (backend/app/agentes/agente3_critico.py).
Valida llamadas a Gemini, Groq, Cohere y la lógica de conmutación por fallback ante timeouts o fallos HTTP.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest
import requests

from app.agentes.agente3_critico import AgenteCriticoContenido, CriticoGenerationError
from app.core.schemas import (
    ContenidoAdaptado,
    EvaluacionCalidad,
    ParametrosGeneracion,
)


@pytest.fixture
def contenido_ejemplo() -> ContenidoAdaptado:
    return ContenidoAdaptado(
        titulo="Tutorial de Redes Cloud",
        introduccion_contextualizada="Introducción a la arquitectura de redes virtuales.",
        items=[
            {
                "frente": "¿Qué es una VCN?",
                "dorso": "Es una Virtual Cloud Network privada y personalizable.",
                "concepto_clave": "VCN",
            }
        ],
    )


@pytest.fixture
def parametros_ejemplo() -> ParametrosGeneracion:
    return ParametrosGeneracion(
        perfil_destinatario="Principiante / Transición de Carrera",
        formato_salida="Flashcards",
        nicho_sector="General",
        nivel_detalle="Didáctico",
        tema_consulta="Conceptos de VCN",
    )


def test_critico_gemini_exito(contenido_ejemplo, parametros_ejemplo):
    """Verifica que el crítico invoque la API REST de Google Gemini y parsee el resultado JSON."""
    respuesta_gemini = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "afirmaciones": [
                                    {
                                        "afirmacion": "La VCN es una red virtual privada.",
                                        "respaldada": True,
                                        "chunk_id_evidencia": "chunk_01",
                                        "comentario": None,
                                    }
                                ],
                                "claridad_pedagogica": "Alta",
                                "observaciones": "Excelente precisión conceptual.",
                                "sugerencias_correccion": [],
                            })
                        }
                    ]
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = respuesta_gemini

    with patch("requests.post", return_value=mock_resp) as mock_post:
        critico = AgenteCriticoContenido(
            api_key="cohere-falso",
            gemini_api_key="gemini-fake-key",
            proveedor="gemini",
            modelo="gemini-2.5-flash",
            timeout=10.0,
        )

        evaluacion = critico.evaluar(
            contenido_generado=contenido_ejemplo,
            fragmentos="[chunk_id: chunk_01] La VCN es una red virtual.",
            parametros=parametros_ejemplo,
        )

        assert isinstance(evaluacion, EvaluacionCalidad)
        assert evaluacion.anclaje_fuente_score == 1.0
        assert evaluacion.claridad_pedagogica == "Alta"
        assert len(evaluacion.afirmaciones) == 1
        assert evaluacion.afirmaciones[0].chunk_id_evidencia == "chunk_01"
        assert mock_post.called
        assert "generativelanguage.googleapis.com" in mock_post.call_args[0][0]


def test_critico_groq_exito(contenido_ejemplo, parametros_ejemplo):
    """Verifica que el crítico invoque la API REST de Groq (estilo OpenAI) y parsee el resultado."""
    respuesta_groq = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "afirmaciones": [
                            {
                                "afirmacion": "VCN ofrece aislamiento de red.",
                                "respaldada": True,
                                "chunk_id_evidencia": "chunk_02",
                                "comentario": None,
                            }
                        ],
                        "claridad_pedagogica": "Media",
                        "observaciones": "Podría profundizar más en subredes.",
                        "sugerencias_correccion": ["Agregar un ejemplo práctico"],
                    })
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = respuesta_groq

    with patch("requests.post", return_value=mock_resp) as mock_post:
        critico = AgenteCriticoContenido(
            api_key="cohere-falso",
            groq_api_key="groq-fake-key",
            proveedor="groq",
            modelo="qwen/qwen3.8-27b",
            timeout=10.0,
        )

        evaluacion = critico.evaluar(
            contenido_generado=contenido_ejemplo,
            fragmentos="[chunk_id: chunk_02] VCN ofrece aislamiento de red.",
            parametros=parametros_ejemplo,
        )

        assert isinstance(evaluacion, EvaluacionCalidad)
        assert evaluacion.anclaje_fuente_score == 1.0
        assert evaluacion.claridad_pedagogica == "Media"
        assert len(evaluacion.sugerencias_correccion) == 1
        assert mock_post.called
        assert "api.groq.com" in mock_post.call_args[0][0]


def test_critico_fallback_automatico(contenido_ejemplo, parametros_ejemplo):
    """Verifica que si el proveedor primario (Gemini) falla por Timeout, conmute automáticamente al fallback (Groq)."""
    respuesta_groq = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "afirmaciones": [
                            {
                                "afirmacion": "La VCN es segura.",
                                "respaldada": True,
                                "chunk_id_evidencia": "chunk_03",
                                "comentario": None,
                            }
                        ],
                        "claridad_pedagogica": "Alta",
                        "observaciones": "Resuelto vía fallback.",
                        "sugerencias_correccion": [],
                    })
                }
            }
        ]
    }

    mock_resp_groq = MagicMock()
    mock_resp_groq.status_code = 200
    mock_resp_groq.json.return_value = respuesta_groq

    # Primer llamado lanza Timeout (Gemini), segundo llamado retorna éxito (Groq)
    with patch(
        "requests.post",
        side_effect=[
            requests.exceptions.Timeout("Gemini timeout 15s"),
            mock_resp_groq,
        ],
    ) as mock_post:
        critico = AgenteCriticoContenido(
            api_key="cohere-falso",
            gemini_api_key="gemini-fake-key",
            groq_api_key="groq-fake-key",
            proveedor="gemini",
            modelo="gemini-2.5-flash",
            proveedor_fallback="groq",
            modelo_fallback="qwen/qwen3.8-27b",
            timeout=5.0,
        )

        evaluacion = critico.evaluar(
            contenido_generado=contenido_ejemplo,
            fragmentos="[chunk_id: chunk_03] La VCN es segura.",
            parametros=parametros_ejemplo,
        )

        assert isinstance(evaluacion, EvaluacionCalidad)
        assert evaluacion.anclaje_fuente_score == 1.0
        assert evaluacion.observaciones == "Resuelto vía fallback."
        assert mock_post.call_count == 2


def test_critico_limpieza_markdown_json(contenido_ejemplo, parametros_ejemplo):
    """Verifica que el parser limpie bloques ```json ... ``` devueltos por el LLM."""
    json_crudo = (
        "```json\n"
        "{\n"
        '  "afirmaciones": [\n'
        '    {"afirmacion": "Prueba", "respaldada": true, "chunk_id_evidencia": "c1", "comentario": null}\n'
        "  ],\n"
        '  "claridad_pedagogica": "Alta",\n'
        '  "observaciones": "Formato con markdown.",\n'
        '  "sugerencias_correccion": []\n'
        "}\n"
        "```"
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": json_crudo}}]
    }

    with patch("requests.post", return_value=mock_resp):
        critico = AgenteCriticoContenido(
            api_key="cohere-falso",
            groq_api_key="groq-fake-key",
            proveedor="groq",
            modelo="qwen/qwen3.8-27b",
        )

        evaluacion = critico.evaluar(
            contenido_generado=contenido_ejemplo,
            fragmentos="[chunk_id: c1] Prueba",
            parametros=parametros_ejemplo,
        )

        assert isinstance(evaluacion, EvaluacionCalidad)
        assert evaluacion.anclaje_fuente_score == 1.0
        assert evaluacion.observaciones == "Formato con markdown."
