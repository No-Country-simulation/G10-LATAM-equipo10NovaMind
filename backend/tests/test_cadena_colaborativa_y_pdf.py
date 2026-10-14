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
import smtplib
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.core.schemas import RespuestaAdaptacion, SolicitudAdaptacion
from app.main import app
from app.auth import Principal, require_user
from app.servicios.generador_pdf import GeneradorPDFEducativo
from app.servicios.servicio_correo import ServicioCorreo


@pytest.fixture(autouse=True)
def authenticated_test_context():
    app.dependency_overrides[require_user] = lambda: Principal('11111111-1111-4111-8111-111111111111', 'test-only')
    # Sin esto, ServicioCorreo() crea un cliente OCI real con las credenciales del .env y sube PDFs al bucket
    with patch('app.main.persist_result', side_effect=lambda principal, solicitud, respuesta: respuesta), \
         patch('app.main._ejecutar_tareas_segundo_plano'), \
         patch('app.servicios.servicio_correo.OCIObjectStorageClient', side_effect=ValueError("sin OCI en tests")):
        yield
    app.dependency_overrides.pop(require_user, None)


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
    # Sin cliente OCI no se presume ningún respaldo
    assert resultado["objeto_oci"] is None and "no se archivó" in resultado["mensaje"]


def test_el_recibo_usa_la_ruta_real_de_la_subida():
    servicio = ServicioCorreo()
    servicio.smtp_host = servicio.smtp_user = None
    servicio.cliente_oci = MagicMock()
    servicio.cliente_oci.subir_documento_original.return_value = "documentos-originales/doc-t.pdf"
    r = servicio.enviar_dossier_pedagogico_silencioso(
        destinatario="", titulo_documento="T", perfil="Principiante", nicho="General",
        contenido_adaptado={"introduccion_contextualizada": "Intro"},
    )
    assert r["objeto_oci"] == "documentos-originales/doc-t.pdf" and "archivado" in r["mensaje"]


def test_el_correo_del_destinatario_nunca_aparece_completo_en_los_logs(caplog):
    from app.servicios.servicio_correo import enmascarar_correo

    assert enmascarar_correo("alumno@ejemplo.com") == "al***@ejemplo.com"
    assert enmascarar_correo("") == "(sin destinatario)" and enmascarar_correo(None) == "(sin destinatario)"
    assert enmascarar_correo("sin-arroba") == "***"

    servicio = ServicioCorreo()
    servicio.smtp_host = None
    servicio.smtp_user = None
    with caplog.at_level("INFO", logger="novamind.servicio_correo"):
        servicio.enviar_dossier_pedagogico_silencioso(
            destinatario="alumno@ejemplo.com", titulo_documento="Arquitectura Cloud",
            perfil="Principiante", nicho="General", contenido_adaptado={"introduccion_contextualizada": "Intro"},
        )
    assert "alumno@ejemplo.com" not in caplog.text
    assert "al***@ejemplo.com" in caplog.text


def test_error_smtp_no_filtra_la_direccion_en_el_log(caplog):
    servicio = ServicioCorreo()
    servicio.smtp_host, servicio.smtp_user, servicio.smtp_from = "smtp.ejemplo.com", "envios@ejemplo.com", None

    class SmtpQueRechaza:
        def __init__(self, *a, **k):
            raise smtplib.SMTPRecipientsRefused({"alumno@ejemplo.com": (550, b"rechazado")})

    with patch("app.servicios.servicio_correo.smtplib.SMTP", SmtpQueRechaza), \
         caplog.at_level("INFO", logger="novamind.servicio_correo"):
        r = servicio.enviar_dossier_pedagogico_silencioso(
            destinatario="alumno@ejemplo.com", titulo_documento="T", perfil="Principiante", nicho="General",
            contenido_adaptado={"introduccion_contextualizada": "Intro"},
        )
    assert r["status"] == "error_smtp"
    assert "alumno@ejemplo.com" not in caplog.text and "SMTPRecipientsRefused" in caplog.text


def test_el_remitente_existe_tambien_en_la_clase_base(monkeypatch):
    monkeypatch.setenv("SMTP_USER", "envios@ejemplo.com")
    monkeypatch.delenv("SMTP_FROM", raising=False)
    assert ServicioCorreo().smtp_from == "envios@ejemplo.com"
    monkeypatch.setenv("SMTP_FROM", "NovaMind <no-responder@ejemplo.com>")
    assert ServicioCorreo().smtp_from == "NovaMind <no-responder@ejemplo.com>"


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
