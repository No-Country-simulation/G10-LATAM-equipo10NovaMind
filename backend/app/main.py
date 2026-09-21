"""
Backend de NuevaMente — API REST (FastAPI).

============================================================================
 ESTE SERVICIO ES EL ÚNICO DUEÑO DE LA LÓGICA DE NEGOCIO
============================================================================
Ingesta, chunking, embeddings, Vector Store, los 3 agentes de LangGraph y
la subida a OCI Object Storage viven EXCLUSIVAMENTE acá. El frontend
(servicio Streamlit, en otro contenedor) no importa ni un solo módulo de
`app/core` ni de `app/storage`: solo conoce estos endpoints HTTP.

Esto es lo que hace que sean dos SERVICIOS de verdad (no dos capas del
mismo proceso, como en el scaffold anterior): se pueden escalar,
desplegar, versionar y reiniciar por separado, y se comunican
exclusivamente por red.
============================================================================
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.ingestion import IngestionError, cargar_documento_desde_bytes
from app.core.orchestrator import LLMGenerationError, ejecutar_pipeline
from app.core.rag_pipeline import indexar_documento
from app.core.schemas import (
    FormatoSalida,
    Metadatos,
    NivelDetalle,
    PerfilDestinatario,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
)
from app.storage.oci_client import OCIObjectStorageClient, StorageUploadError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nuevamente-backend")

app = FastAPI(
    title="NuevaMente API",
    description=(
        "Backend de Sistema Inteligente de Adaptación y Generación de "
        "Contenido Educativo. Servicio independiente del frontend."
    ),
    version="0.2.0",
)


@app.get("/health")
def health() -> dict:
    """
    Usado por: el healthcheck del contenedor Docker y por el frontend
    (para mostrar el estado de conexión al backend antes de dejar operar
    al usuario).
    """
    return {"status": "ok", "service": "nuevamente-backend"}


# ============================================================================
# PUNTO DE ENTRADA HTTP (1/2) — Frontend -> Backend
# ============================================================================
# POST /adaptar recibe multipart/form-data (no JSON puro), porque el
# archivo original tiene que viajar como bytes crudos por la red: el
# frontend NO hace ingesta ni extracción de texto, eso es responsabilidad
# exclusiva del backend.
#
#   archivo               <- st.file_uploader(...) en el frontend
#   perfil_destinatario     <- st.selectbox(...) en el frontend
#   formato_salida            <- st.selectbox(...) en el frontend
#   nicho_sector                 <- st.text_input(...) en el frontend
#   nivel_detalle                   <- st.selectbox(...) en el frontend
# ============================================================================
@app.post("/adaptar", response_model=RespuestaAdaptacion)
async def adaptar_contenido(
    archivo: UploadFile = File(..., description="Documento técnico: PDF, Markdown o TXT"),
    perfil_destinatario: PerfilDestinatario = Form(...),
    formato_salida: FormatoSalida = Form(...),
    nicho_sector: str = Form(default="General"),
    nivel_detalle: NivelDetalle = Form(default=NivelDetalle.DIDACTICO),
) -> RespuestaAdaptacion:
    contenido_bytes = await archivo.read()

    try:
        doc = cargar_documento_desde_bytes(contenido_bytes, archivo.filename)
        n_chunks = indexar_documento(doc)
    except IngestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    solicitud = SolicitudAdaptacion(
        documento_titulo=doc.titulo,
        documento_contenido=doc.texto,
        perfil_destinatario=perfil_destinatario,
        formato_salida=formato_salida,
        nicho_sector=nicho_sector,
        nivel_detalle=nivel_detalle,
    )

    try:
        resultado = ejecutar_pipeline(solicitud)
    except LLMGenerationError as exc:
        logger.exception("Error de generación de LLM")
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error inesperado en el pipeline")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    contenido = resultado["contenido_adaptado"]
    evaluacion = resultado["evaluacion"]

    metadatos = Metadatos(
        perfil_aplicado=perfil_destinatario.value,
        formato_generado=formato_salida.value,
        tiempo_estimado_estudio_minutos=_estimar_minutos(contenido),
        conceptos_clave=_extraer_conceptos_clave(resultado["fragmentos"]),
    )

    almacenamiento = None
    try:
        oci_client = OCIObjectStorageClient()
        oci_client.subir_documento_original(doc.doc_id, doc.extension, contenido_bytes)
        object_id = oci_client.subir_contenido_generado(
            doc_id=doc.doc_id,
            perfil=perfil_destinatario.value,
            formato=formato_salida.value,
            payload=contenido.model_dump(),
        )
        almacenamiento = {
            "bucket": oci_client.bucket_name,
            "objeto_id": object_id,
            "status_upload": "completado",
        }
    except (StorageUploadError, KeyError) as exc:
        logger.warning("No se pudo subir a OCI Object Storage: %s", exc)
        almacenamiento = {"bucket": "N/A", "objeto_id": "N/A", "status_upload": "error"}

    logger.info("Documento '%s' procesado: %d chunks indexados", doc.titulo, n_chunks)

    # ========================================================================
    # PUNTO DE SALIDA HTTP (2/2) — Backend -> Frontend
    # ========================================================================
    # `RespuestaAdaptacion` es un modelo Pydantic; FastAPI lo serializa
    # automáticamente al JSON exacto que pide el whitepaper y lo devuelve
    # en el body de la respuesta HTTP (200). El frontend lo recibe como
    # un dict JSON plano — no comparte clases Python con el backend.
    # ========================================================================
    return RespuestaAdaptacion(
        status="exito",
        metadatos=metadatos,
        contenido_adaptado=contenido,
        evaluacion_calidad=evaluacion,
        almacenamiento_oci=almacenamiento,
    )


@app.exception_handler(IngestionError)
def handle_ingestion_error(_, exc: IngestionError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"status": "error", "error_detalle": str(exc)})


def _estimar_minutos(contenido) -> int:
    total_items = len(contenido.items) if contenido.items else 1
    return max(3, total_items * 2)


def _extraer_conceptos_clave(fragmentos: str, top_n: int = 5) -> list[str]:
    import re
    from collections import Counter

    candidatos = re.findall(
        r"\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})*\b", fragmentos
    )
    return [t for t, _ in Counter(candidatos).most_common(top_n)]
