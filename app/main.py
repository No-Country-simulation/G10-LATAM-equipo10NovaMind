"""
API REST opcional (alternativa a Streamlit para el checklist: "interfaz
interactiva ... o API REST operativa"). Se levanta con APP_MODE=api.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app.core.ingestion import IngestionError
from app.core.orchestrator import LLMGenerationError, ejecutar_pipeline
from app.core.rag_pipeline import indexar_documento
from app.core.ingestion import cargar_documento
from app.core.schemas import RespuestaAdaptacion, SolicitudAdaptacion
from app.storage.oci_client import OCIObjectStorageClient, StorageUploadError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nuevamente")

app = FastAPI(
    title="NuevaMente API",
    description="Sistema Inteligente de Adaptación y Generación de Contenido Educativo",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/adaptar", response_model=RespuestaAdaptacion)
def adaptar_contenido(solicitud: SolicitudAdaptacion) -> RespuestaAdaptacion:
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

    metadatos = {
        "perfil_aplicado": solicitud.perfil_destinatario.value,
        "formato_generado": solicitud.formato_salida.value,
        "tiempo_estimado_estudio_minutos": _estimar_minutos(contenido),
        "conceptos_clave": _extraer_conceptos_clave(resultado["fragmentos"]),
    }

    almacenamiento = None
    try:
        oci_client = OCIObjectStorageClient()
        object_id = oci_client.subir_contenido_generado(
            doc_id=solicitud.documento_titulo[:40],
            perfil=solicitud.perfil_destinatario.value,
            formato=solicitud.formato_salida.value,
            payload=contenido.model_dump(),
        )
        almacenamiento = {
            "bucket": oci_client.bucket_name,
            "objeto_id": object_id,
            "status_upload": "completado",
        }
    except (StorageUploadError, KeyError) as exc:
        logger.warning("No se pudo subir a OCI Object Storage: %s", exc)
        almacenamiento = {
            "bucket": "N/A",
            "objeto_id": "N/A",
            "status_upload": "error",
        }

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
    """
    Extracción simple de candidatos a "conceptos clave" a partir de
    términos capitalizados recurrentes en los fragmentos recuperados.
    Es una heurística liviana, de respaldo; el Agente Redactor puede
    sobrescribir esta lista si el LLM identifica mejores candidatos.
    """
    import re
    from collections import Counter

    candidatos = re.findall(r"\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})*\b", fragmentos)
    conteo = Counter(candidatos)
    return [termino for termino, _ in conteo.most_common(top_n)]
