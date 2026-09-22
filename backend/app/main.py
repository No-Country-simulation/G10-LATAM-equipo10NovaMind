"""
Backend de NuevaMente — API REST (FastAPI).
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Expone los servicios de adaptación educativa mediante LangGraph, Agentes y RAG.
Desacoplado del frontend Streamlit.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.core.config import ConfigError
from app.core.ingestion import IngestionError, cargar_documento_desde_bytes
from app.core.schemas import (
    FormatoSalida,
    NichoSector,
    NivelDetalle,
    PerfilDestinatario,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
)
from app.orquestador import OrquestadorNuevaMente, crear_orquestador

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nuevamente.backend")

app = FastAPI(
    title="NuevaMente API",
    description="Backend de Adaptación y Generación de Contenido Educativo con Agentes.",
    version="2.0.0",
)

# CORS habilitado para flexibilidad
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_orquestador_singleton: Optional[OrquestadorNuevaMente] = None


def get_orquestador() -> OrquestadorNuevaMente:
    global _orquestador_singleton
    if _orquestador_singleton is None:
        try:
            _orquestador_singleton = crear_orquestador()
        except ConfigError as exc:
            logger.error("Error de configuración al iniciar orquestador: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Configuración del orquestador incompleta: {exc}",
            ) from exc
    return _orquestador_singleton


@app.get("/health", tags=["Salud"])
def health() -> Dict[str, str]:
    """Healthcheck consumido por Docker Compose y frontend."""
    return {"status": "ok", "service": "nuevamente-backend"}


@app.get("/api/v1/config/opciones", tags=["Configuración"])
def obtener_opciones_configuracion() -> Dict[str, List[str]]:
    """
    Retorna los valores canónicos válidos para perfiles, formatos, nichos y niveles.
    Evita la duplicación hardcodeada en clientes (como Streamlit).
    """
    return {
        "perfiles_destinatario": [
            "Principiante / Transición de Carrera",
            "Desarrollador Junior / Semi Senior",
            "Líder Técnico / Arquitecto",
            "Gestor / Ejecutivo (No Técnico)",
        ],
        "formatos_salida": [
            "Guía Práctica Paso a Paso (Tutorial)",
            "Flashcards",
            "Quiz Interactivo con Justificaciones",
            "Resumen Ejecutivo (TL;DR)",
            "Guion de Clase / Video",
        ],
        "nichos_sector": [
            "Fintech",
            "Salud",
            "E-commerce",
            "General",
        ],
        "niveles_detalle": [
            "Didáctico",
            "Intermedio",
            "Profundo",
        ],
    }


@app.post(
    "/api/v1/adaptar",
    response_model=RespuestaAdaptacion,
    tags=["Adaptación Pedagógica"],
)
async def adaptar_contenido(
    archivo: Optional[UploadFile] = File(None, description="Documento PDF, MD o TXT"),
    texto_directo: Optional[str] = Form(None, description="Texto alternativo si no se sube archivo"),
    titulo: Optional[str] = Form(None, description="Título del documento"),
    perfil_destinatario: str = Form(..., description="Perfil del estudiante"),
    formato_salida: str = Form(..., description="Formato pedagógico deseado"),
    nicho_sector: str = Form("General", description="Sector de contextualización"),
    nivel_detalle: str = Form("Didáctico", description="Nivel de profundidad pedagógica"),
    tema_consulta: Optional[str] = Form(None, description="Tema o pregunta focal"),
) -> RespuestaAdaptacion:
    """
    Endpoint principal: recibe el documento y los parámetros pedagógicos,
    ejecuta el grafo multi-agente y devuelve el contenido adaptado con métricas.
    """
    # 1. Extracción de contenido (Ingesta)
    contenido_texto = ""
    doc_titulo = titulo or "Documento Técnico"

    if archivo and archivo.filename:
        contenido_bytes = await archivo.read()
        if not contenido_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo subido está vacío.",
            )
        try:
            doc_ingresado = cargar_documento_desde_bytes(
                contenido_bytes, archivo.filename, titulo=titulo
            )
            contenido_texto = doc_ingresado.texto
            doc_titulo = doc_ingresado.titulo
        except IngestionError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de ingesta: {exc}",
            ) from exc
    elif texto_directo and texto_directo.strip():
        contenido_texto = texto_directo.strip()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un archivo (PDF/MD/TXT) o el campo 'texto_directo'.",
        )

    # 2. Validación de Solicitud (Pydantic con normalización de alias)
    try:
        solicitud = SolicitudAdaptacion.model_validate(
            {
                "documento_titulo": doc_titulo,
                "documento_contenido": contenido_texto,
                "perfil_destinatario": perfil_destinatario,
                "formato_salida": formato_salida,
                "nicho_sector": nicho_sector,
                "nivel_detalle": nivel_detalle,
                "tema_consulta": tema_consulta,
            }
        )
    except ValidationError as exc:
        detalles = [
            f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
            for err in exc.errors()
        ]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="; ".join(detalles),
        ) from exc

    # 3. Ejecución de la Orquestación
    orquestador = get_orquestador()
    logger.info(
        "Iniciando orquestación: '%s' | %s | %s",
        solicitud.documento_titulo,
        solicitud.perfil_destinatario,
        solicitud.formato_salida,
    )

    respuesta = orquestador.ejecutar(solicitud)
    logger.info(
        "Orquestación finalizada con status: %s | Duración: %.2fs",
        respuesta.status,
        respuesta.orquestacion.duracion_segundos,
    )

    return respuesta


@app.exception_handler(IngestionError)
def handle_ingestion_error(_, exc: IngestionError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"status": "error", "mensaje": str(exc)},
    )


@app.get("/api/v1/paquetes", tags=["Persistencia OCI"])
def listar_paquetes() -> Dict[str, Any]:
    """Lista los paquetes generados en OCI Object Storage o almacenamiento local."""
    if os.getenv("OCI_NAMESPACE") and os.getenv("OCI_BUCKET_NAME"):
        try:
            from app.storage.oci_client import OCIObjectStorageClient
            cliente = OCIObjectStorageClient()
            return {"origen": "oci", "paquetes": cliente.listar_contenidos_generados()}
        except Exception as exc:
            logger.warning("Fallo al listar paquetes desde OCI: %s", exc)

    from pathlib import Path
    dir_gen = Path("data/outputs/contenidos_generados")
    archivos = []
    if dir_gen.exists():
        for f in dir_gen.glob("*.json"):
            archivos.append({
                "nombre": f.name,
                "tamanio_bytes": f.stat().st_size,
                "creado_en": str(f.stat().st_mtime),
            })
    return {"origen": "local", "paquetes": archivos}


@app.get("/api/v1/paquetes/{objeto_id:path}", tags=["Persistencia OCI"])
def descargar_paquete(objeto_id: str) -> Dict[str, Any]:
    """Descarga el contenido JSON de un paquete generado."""
    if os.getenv("OCI_NAMESPACE") and os.getenv("OCI_BUCKET_NAME"):
        try:
            from app.storage.oci_client import OCIObjectStorageClient
            cliente = OCIObjectStorageClient()
            datos = cliente.descargar_objeto(objeto_id)
            return json.loads(datos.decode("utf-8"))
        except Exception as exc:
            logger.warning("Fallo al descargar paquete desde OCI: %s", exc)

    from pathlib import Path
    archivo = Path("data/outputs/contenidos_generados") / Path(objeto_id).name
    if archivo.exists():
        return json.loads(archivo.read_text(encoding="utf-8"))
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")

