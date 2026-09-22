"""
Pruebas de la API REST de FastAPI (backend/app/main.py).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.schemas import (
    AfirmacionEvaluada,
    AlmacenamientoOCI,
    ContenidoAdaptado,
    EvaluacionCalidad,
    MetadatosSalida,
    MetricasOrquestacion,
    RespuestaAdaptacion,
)

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "nuevamente-backend"}


def test_config_opciones_endpoint():
    response = client.get("/api/v1/config/opciones")
    assert response.status_code == 200
    data = response.json()

    assert "perfiles_destinatario" in data
    assert "formatos_salida" in data
    assert "nichos_sector" in data
    assert "niveles_detalle" in data

    assert "Flashcards" in data["formatos_salida"]
    assert "Guía Práctica Paso a Paso (Tutorial)" in data["formatos_salida"]
    assert "Didáctico" in data["niveles_detalle"]


def test_adaptar_rechaza_solicitud_sin_documento():
    response = client.post(
        "/api/v1/adaptar",
        data={
            "perfil_destinatario": "Principiante / Transición de Carrera",
            "formato_salida": "Flashcards",
        },
    )
    assert response.status_code == 400
    assert "Debe proporcionar un archivo" in response.json()["detail"]


def test_adaptar_valida_esquema_con_texto_directo():
    # Simulamos respuesta exitosa del orquestador
    respuesta_mock = RespuestaAdaptacion(
        status="exito",
        metadatos=MetadatosSalida(
            perfil_aplicado="Principiante / Transición de Carrera",
            formato_generado="Flashcards",
            nicho_aplicado="General",
            tiempo_estimado_estudio_minutos=10,
            conceptos_clave=["VCN", "Subredes"],
        ),
        contenido_adaptado=ContenidoAdaptado(
            titulo="Flashcards de VCN",
            introduccion_contextualizada="Tarjetas de estudio para principiantes.",
            items=[
                {"frente": "¿Qué es VCN?", "dorso": "Red virtual en OCI", "concepto_clave": "VCN"}
            ] * 5,
        ),
        evaluacion_calidad=EvaluacionCalidad(
            anclaje_fuente_score=0.95,
            claridad_pedagogica="Alta",
            afirmaciones=[
                AfirmacionEvaluada(
                    afirmacion="VCN es una red virtual en Oracle Cloud.",
                    respaldada=True,
                    chunk_id_evidencia="chunk_01",
                )
            ],
        ),
        almacenamiento_oci=AlmacenamientoOCI(
            bucket="local-mock-storage",
            objeto_id="contenidos_generados/mock.json",
            status_upload="completado",
        ),
        orquestacion=MetricasOrquestacion(
            intentos_redaccion=1,
            scores_por_intento=[0.95],
            umbral_anclaje=0.75,
            max_reintentos=2,
            duracion_segundos=1.5,
        ),
    )

    with patch("app.main.get_orquestador") as mock_get_orq:
        mock_orq = MagicMock()
        mock_orq.ejecutar.return_value = respuesta_mock
        mock_get_orq.return_value = mock_orq

        response = client.post(
            "/api/v1/adaptar",
            data={
                "texto_directo": "La Virtual Cloud Network (VCN) es una red virtual personalizable en OCI.",
                "titulo": "Intro a VCN",
                "perfil_destinatario": "Principiante",  # Alias que debe normalizarse
                "formato_salida": "Flashcards",
                "nicho_sector": "General",
                "nivel_detalle": "Didáctico",
            },
        )

        assert response.status_code == 200
        resultado = response.json()
        assert resultado["status"] == "exito"
        assert resultado["contenido_adaptado"]["titulo"] == "Flashcards de VCN"
        assert len(resultado["contenido_adaptado"]["items"]) == 5
        assert resultado["evaluacion_calidad"]["anclaje_fuente_score"] == 1.0
        assert resultado["almacenamiento_oci"]["status_upload"] == "completado"


def test_listar_paquetes_endpoint():
    response = client.get("/api/v1/paquetes")
    assert response.status_code == 200
    data = response.json()
    assert "origen" in data
    assert "paquetes" in data
    assert isinstance(data["paquetes"], list)

