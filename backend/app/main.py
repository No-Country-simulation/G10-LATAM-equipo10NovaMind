"""
Backend de NuevaMente — API REST (FastAPI).
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Expone los servicios de adaptación educativa mediante LangGraph, Agentes y RAG.
Desacoplado del frontend Streamlit.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
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

# CORS habilitado con soporte explícito para desarrollo local (Vite/Streamlit) y producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8501",
        "http://127.0.0.1:8501",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_orquestador_singleton: Optional[OrquestadorNuevaMente] = None
# Semáforo de concurrencia: limita ejecuciones pesadas simultáneas para proteger la RAM de 1 GB en OCI Always Free
_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(1)


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
            "Paquete Educativo Completo (5 Estaciones)",
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


async def _extraer_solicitud(
    archivo: Optional[UploadFile],
    texto_directo: Optional[str],
    titulo: Optional[str],
    perfil_destinatario: str,
    formato_salida: str,
    nicho_sector: str,
    nivel_detalle: str,
    tema_consulta: Optional[str],
) -> SolicitudAdaptacion:
    """Extrae el contenido documental y valida los parámetros de la solicitud pedagógica."""
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

    try:
        return SolicitudAdaptacion.model_validate(
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
    Endpoint principal síncrono: recibe el documento y los parámetros pedagógicos,
    ejecuta el grafo multi-agente en hilo no bloqueante y devuelve el contenido adaptado con métricas.
    """
    solicitud = await _extraer_solicitud(
        archivo=archivo,
        texto_directo=texto_directo,
        titulo=titulo,
        perfil_destinatario=perfil_destinatario,
        formato_salida=formato_salida,
        nicho_sector=nicho_sector,
        nivel_detalle=nivel_detalle,
        tema_consulta=tema_consulta,
    )

    orquestador = get_orquestador()
    logger.info(
        "Iniciando orquestación: '%s' | %s | %s",
        solicitud.documento_titulo,
        solicitud.perfil_destinatario,
        solicitud.formato_salida,
    )

    async with _SEMAFORO_CONCURRENCIA:
        respuesta = await asyncio.to_thread(orquestador.ejecutar, solicitud)

    logger.info(
        "Orquestación finalizada con status: %s | Duración: %.2fs",
        respuesta.status,
        respuesta.orquestacion.duracion_segundos,
    )

    return respuesta


@app.post(
    "/api/v1/adaptar/stream",
    tags=["Adaptación Pedagógica"],
)
async def adaptar_contenido_stream(
    archivo: Optional[UploadFile] = File(None, description="Documento PDF, MD o TXT"),
    texto_directo: Optional[str] = Form(None, description="Texto alternativo si no se sube archivo"),
    titulo: Optional[str] = Form(None, description="Título del documento"),
    perfil_destinatario: str = Form(..., description="Perfil del estudiante"),
    formato_salida: str = Form(..., description="Formato pedagógico deseado"),
    nicho_sector: str = Form("General", description="Sector de contextualización"),
    nivel_detalle: str = Form("Didáctico", description="Nivel de profundidad pedagógica"),
    tema_consulta: Optional[str] = Form(None, description="Tema o pregunta focal"),
) -> StreamingResponse:
    """
    Endpoint con Server-Sent Events (SSE) y heartbeats periódicos (cada 15s)
    para evitar el timeout 524 de Cloudflare (100s) durante orquestaciones complejas.
    """
    solicitud = await _extraer_solicitud(
        archivo=archivo,
        texto_directo=texto_directo,
        titulo=titulo,
        perfil_destinatario=perfil_destinatario,
        formato_salida=formato_salida,
        nicho_sector=nicho_sector,
        nivel_detalle=nivel_detalle,
        tema_consulta=tema_consulta,
    )

    orquestador = get_orquestador()

    async def generador_eventos() -> AsyncGenerator[str, None]:
        # 1. Evento inicial de conexión establecida
        yield f"data: {json.dumps({'tipo': 'inicio', 'mensaje': 'Solicitud recibida. Iniciando orquestación pedagógica...'}, ensure_ascii=False)}\n\n"

        async def _ejecutar():
            async with _SEMAFORO_CONCURRENCIA:
                return await asyncio.to_thread(orquestador.ejecutar, solicitud)

        tarea = asyncio.create_task(_ejecutar())

        # 2. Bucle de heartbeats cada 15s mientras la tarea está en curso
        segundos_transcurridos = 0
        while not tarea.done():
            try:
                await asyncio.wait_for(asyncio.shield(tarea), timeout=15.0)
            except asyncio.TimeoutError:
                segundos_transcurridos += 15
                # Comentario SSE para mantener vivos proxies (Cloudflare / Nginx)
                yield f": ping - heartbeat anti-timeout ({segundos_transcurridos}s)\n\n"
                # Evento informativo para clientes SSE
                yield f"data: {json.dumps({'tipo': 'heartbeat', 'segundos': segundos_transcurridos, 'mensaje': f'Orquestando agentes ({segundos_transcurridos}s transcurridos)...'}, ensure_ascii=False)}\n\n"

        # 3. Emisión de resultado final o error
        try:
            respuesta: RespuestaAdaptacion = tarea.result()
            yield f"data: {json.dumps({'tipo': 'resultado', 'datos': respuesta.model_dump()}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.exception("Error en orquestación vía stream: %s", exc)
            yield f"data: {json.dumps({'tipo': 'error', 'detalle': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generador_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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

    posibles_dirs = [
        Path("data/outputs/contenidos_generados"),
        Path("backend/data/outputs/contenidos_generados"),
    ]
    archivos = []
    dir_gen = next((d for d in posibles_dirs if d.exists()), None)
    if dir_gen:
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
            prefijo = "contenidos-generados/"
            nombre_objeto_oci = (
                objeto_id if objeto_id.startswith(prefijo) else f"{prefijo}{objeto_id}"
            )
            try:
                datos = cliente.descargar_objeto(nombre_objeto_oci)
            except Exception:
                datos = cliente.descargar_objeto(objeto_id)
            return json.loads(datos.decode("utf-8"))
        except Exception as exc:
            logger.warning("Fallo al descargar paquete desde OCI: %s", exc)

    from pathlib import Path

    nombre_limpio = Path(objeto_id).name
    posibles_rutas = [
        Path("data/outputs/contenidos_generados") / nombre_limpio,
        Path("backend/data/outputs/contenidos_generados") / nombre_limpio,
    ]
    for archivo in posibles_rutas:
        if archivo.exists():
            return json.loads(archivo.read_text(encoding="utf-8"))
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paquete no encontrado.")

