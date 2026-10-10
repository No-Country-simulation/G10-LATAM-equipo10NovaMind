"""
backend/tests/test_cadena_colaborativa_y_pdf.py
-----------------------------------------------
Pruebas unitarias para:
1. Cadena Colaborativa Multi-Modelo (Normalización defensiva y estructura Pydantic)
2. Generador de Dossiers PDF Estandarizados (ReportLab)
3. Servicio de Despacho Silencioso por Correo (Modo simulación / OCI)
4. Endpoints REST con selector de modo_rag ('vectorless' y 'clasico')
"""

import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.core.schemas import RespuestaAdaptacion, SolicitudAdaptacion
from app.main import app
from app.servicios.generador_pdf import GeneradorPDFEducativo
from app.servicios.servicio_correo import ServicioCorreo


@pytest.fixture
def solicitud_ejemplo():
    return SolicitudAdaptacion(
        documento_titulo="Fundamentos de Microservicios",
        documento_contenido=(
            "Los microservicios son un enfoque arquitectónico y organizativo para el desarrollo de software "
            "donde el software se compone de pequeños servicios independientes que se comunican a través de "
            "API bien definidas. Estos servicios son propiedad de equipos pequeños y autónomos. Las arquitecturas "
            "de microservicios hacen que las aplicaciones sean más fáciles de escalar y más rápidas de desarrollar."
        ),
        perfil_destinatario="Principiante / Transición de Carrera",
        formato_salida="Paquete Educativo Completo (5 Estaciones)",
        nicho_sector="Fintech",
        nivel_detalle="Didáctico",
    )


def test_normalizacion_paquete_base_defensiva(solicitud_ejemplo):
    """Verifica que un paquete crudo o con strings en lugar de diccionarios se normalice perfectamente."""
    cadena = CadenaColaborativaMultiModelo(gemini_api_key="mock", groq_api_key="mock", cohere_api_key="mock")

    paquete_crudo = {
        "titulo": "Microservicios Test",
        "resumen_ninja": "Este es un párrafo de resumen en formato string simple.",
        "flashcards": "no es lista",
        "tutorial": None,
        "quiz": [{"pregunta": "¿Qué es?", "opciones": ["A", "B"], "respuesta_correcta": "0"}],
    }

    norm = cadena._normalizar_paquete_base(paquete_crudo, solicitud_ejemplo)

    assert isinstance(norm["resumen_ninja"], dict)
    assert norm["resumen_ninja"]["analogia_central"] == "Este es un párrafo de resumen en formato string simple."
    assert len(norm["resumen_ninja"]["conceptos_clave"]) >= 1
    assert isinstance(norm["flashcards"], list)
    assert isinstance(norm["tutorial"], list)
    assert isinstance(norm["diagrama_mermaid"], str)
    assert "flowchart" in norm["diagrama_mermaid"]
    assert isinstance(norm["quiz"], list)
    assert norm["quiz"][0]["respuesta_correcta"] == 0


def test_generador_pdf_estandarizado():
    """Verifica que el generador ReportLab cree bytes PDF válidos sin errores de layout."""
    generador = GeneradorPDFEducativo()
    contenido_mock = {
        "introduccion_contextualizada": "Introducción motivadora al curso de prueba.",
        "resumen_ninja": {
            "titulo": "Resumen Ejecutivo",
            "analogia_central": "La arquitectura es como una red de restaurantes independientes.",
            "conceptos_clave": [{"id": "c1", "texto": "Escalabilidad horizontal", "verificado": True}],
        },
        "flashcards": [
            {"id": "fc-1", "frente": "¿Qué es un microservicio?", "dorso": "Un servicio autónomo.", "pista_didactica": "Pequeño y modular"}
        ],
        "tutorial": [
            {"id": "t-1", "paso": 1, "titulo": "Diseño de API", "descripcion": "Definir OpenAPI spec.", "cli_command": "curl http://localhost/api", "verificacion": "HTTP 200"}
        ],
        "diagrama_mermaid": "flowchart TD\n    A[Cliente] --> B[API Gateway]\n    B --> C[Microservicio]",
        "quiz": [
            {"id": "q-1", "pregunta": "¿Cuál es la ventaja?", "opciones": ["Escalabilidad", "Monolito"], "respuesta_correcta": 0, "justificacion_rag": "La fuente lo afirma.", "cita_fuente": "Párrafo 1"}
        ],
    }

    pdf_bytes = generador.generar_pdf_estandarizado(
        titulo="Microservicios",
        perfil="Principiante",
        nicho="Fintech",
        contenido=contenido_mock,
        anclaje_score=0.98,
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


def test_servicio_correo_modo_simulacion():
    """Verifica que sin SMTP configurado se ejecute en modo simulación sin arrojar excepciones."""
    servicio = ServicioCorreo()
    # Forzar ausencia de credenciales SMTP
    servicio.smtp_host = None
    servicio.smtp_user = None

    resultado = servicio.enviar_dossier_pedagogico_silencioso(
        destinatario="alumno@ejemplo.com",
        titulo_documento="Arquitectura Cloud",
        perfil="Líder Técnico / Arquitecto",
        nicho="Salud",
        contenido_adaptado={"introduccion_contextualizada": "Intro Salud"},
    )

    assert resultado["status"] == "simulado"
    assert resultado["destinatario"] == "alumno@ejemplo.com"
    assert resultado["bytes_pdf"] > 500


def _crear_respuesta_mock() -> RespuestaAdaptacion:
    from app.core.schemas import (
        AfirmacionEvaluada,
        AlmacenamientoOCI,
        ContenidoAdaptado,
        EvaluacionCalidad,
        MetadatosSalida,
        MetricasOrquestacion,
    )
    return RespuestaAdaptacion(
        status="exito",
        metadatos=MetadatosSalida(
            perfil_aplicado="Principiante / Transición de Carrera",
            formato_generado="Flashcards",
            nicho_aplicado="General",
            tiempo_estimado_estudio_minutos=10,
            conceptos_clave=["Kafka", "Topics"],
        ),
        contenido_adaptado=ContenidoAdaptado(
            titulo="Kafka Intro",
            introduccion_contextualizada="Introducción a Kafka.",
            items=[{"frente": "Frente 1", "dorso": "Dorso 1"}],
        ),
        evaluacion_calidad=EvaluacionCalidad(
            anclaje_fuente_score=0.96,
            claridad_pedagogica="Alta",
            afirmaciones=[AfirmacionEvaluada(afirmacion="Kafka es distribuido", respaldada=True)],
        ),
        almacenamiento_oci=AlmacenamientoOCI(
            bucket="nuevamente-contenidos-educativos",
            objeto_id="contenidos_generados/mock.json",
            status_upload="completado",
        ),
        orquestacion=MetricasOrquestacion(
            intentos_redaccion=1,
            scores_por_intento=[0.96],
            umbral_anclaje=0.75,
            max_reintentos=2,
            duracion_segundos=1.2,
        ),
    )


def test_endpoint_adaptar_con_modo_rag_clasico():
    """Verifica que /api/v1/adaptar despache a get_orquestador cuando modo_rag='clasico'."""
    cliente = TestClient(app)
    form_data = {
        "texto_directo": (
            "Kafka es una plataforma distribuida de eventos con particiones replicadas "
            "que permite el procesamiento en tiempo real con latencias de milisegundos."
        ),
        "titulo": "Kafka Intro",
        "perfil_destinatario": "Principiante / Transición de Carrera",
        "formato_salida": "Flashcards",
        "nicho_sector": "General",
        "nivel_detalle": "Didáctico",
        "modo_rag": "clasico",
    }
    resp_mock = _crear_respuesta_mock()

    with patch("app.main.get_orquestador") as mock_get_orq, patch("app.main._ejecutar_tareas_segundo_plano"):
        mock_orq = MagicMock()
        mock_orq.ejecutar.return_value = resp_mock
        mock_get_orq.return_value = mock_orq

        resp = cliente.post("/api/v1/adaptar", data=form_data)
        assert resp.status_code == 200
        assert mock_orq.ejecutar.called


def test_endpoint_adaptar_con_modo_rag_vectorless():
    """Verifica que /api/v1/adaptar despache a get_cadena_colaborativa por defecto."""
    cliente = TestClient(app)
    form_data = {
        "texto_directo": (
            "Apache Kafka gestiona flujos continuos de registros con tolerancia a fallos "
            "y almacenamiento duradero en clústeres distribuidos."
        ),
        "titulo": "Kafka In Depth",
        "perfil_destinatario": "Principiante / Transición de Carrera",
        "formato_salida": "Flashcards",
        "nicho_sector": "General",
        "nivel_detalle": "Didáctico",
        "modo_rag": "vectorless",
    }
    resp_mock = _crear_respuesta_mock()

    with patch("app.main.get_cadena_colaborativa") as mock_get_cadena, patch("app.main._ejecutar_tareas_segundo_plano"):
        mock_cadena = MagicMock()
        mock_cadena.ejecutar.return_value = resp_mock
        mock_get_cadena.return_value = mock_cadena

        resp = cliente.post("/api/v1/adaptar", data=form_data)
        assert resp.status_code == 200
        assert mock_cadena.ejecutar.called
