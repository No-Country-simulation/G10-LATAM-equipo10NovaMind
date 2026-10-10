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
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from dotenv import load_dotenv

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if (_ROOT_DIR / ".env").exists():
    load_dotenv(_ROOT_DIR / ".env")
load_dotenv()

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import ValidationError

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
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
from app.servicios.servicio_correo import ServicioCorreo

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
_cadena_singleton: Optional[CadenaColaborativaMultiModelo] = None
_servicio_correo_singleton: Optional[ServicioCorreo] = None

# Semáforo de concurrencia: límite de 5 solicitudes simultáneas para evitar encolamiento innecesario
_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(5)


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


def get_cadena_colaborativa() -> CadenaColaborativaMultiModelo:
    global _cadena_singleton
    if _cadena_singleton is None:
        _cadena_singleton = CadenaColaborativaMultiModelo()
    return _cadena_singleton


def get_servicio_correo() -> ServicioCorreo:
    global _servicio_correo_singleton
    if _servicio_correo_singleton is None:
        _servicio_correo_singleton = ServicioCorreo()
    return _servicio_correo_singleton


def _ejecutar_tareas_segundo_plano(
    solicitud: SolicitudAdaptacion,
    respuesta: RespuestaAdaptacion,
    email_destinatario: Optional[str] = None,
) -> None:
    """
    Tareas en segundo plano:
    1. RAG Silencioso: Indexa el documento original en ChromaDB sin bloquear la respuesta.
    2. Envío Silencioso: Genera el dossier PDF estandarizado (sin audiovisual) y lo envía/respalda en OCI.
    """
    # 1. Indexación silenciosa en ChromaDB
    try:
        orquestador = get_orquestador()
        if hasattr(orquestador, "indexador") and solicitud.documento_contenido:
            doc_id = solicitud.documento_id or (
                respuesta.orquestacion.documento_id if respuesta.orquestacion else "doc-auto"
            )
            orquestador.indexador.indexar(
                documento_id=doc_id,
                titulo=solicitud.documento_titulo,
                contenido=solicitud.documento_contenido,
            )
            logger.info("[background] Documento '%s' indexado silenciosamente en ChromaDB.", doc_id)
    except Exception as exc_idx:
        logger.warning("[background] Fallo no crítico en indexación silenciosa ChromaDB: %s", exc_idx)

    # 2. Despacho silencioso de PDF y correo
    try:
        servicio_correo = get_servicio_correo()
        contenido_dict = (
            respuesta.contenido_adaptado.model_dump()
            if hasattr(respuesta.contenido_adaptado, "model_dump")
            else (respuesta.contenido_adaptado or {})
        )
        destinatario = email_destinatario or os.getenv("CORREO_NOTIFICACION_DEFAULT", "estudiante@novamind.lat")
        anclaje = (
            respuesta.evaluacion_calidad.anclaje_fuente_score
            if respuesta.evaluacion_calidad
            else 0.95
        )
        servicio_correo.enviar_dossier_pedagogico_silencioso(
            destinatario=destinatario,
            titulo_documento=solicitud.documento_titulo,
            perfil=solicitud.perfil_destinatario,
            nicho=solicitud.nicho_sector,
            contenido_adaptado=contenido_dict,
            doc_id=solicitud.documento_id,
            anclaje_score=anclaje,
        )
    except Exception as exc_mail:
        logger.warning("[background] Fallo no crítico en despacho de PDF/correo: %s", exc_mail)


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
    documento_contenido: Optional[str] = None,
) -> SolicitudAdaptacion:
    """Extrae el contenido documental y valida los parámetros de la solicitud pedagógica."""
    contenido_texto = ""
    doc_titulo = titulo or "Documento Técnico"

    texto_candidato = (texto_directo or "").strip() or (documento_contenido or "").strip()

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
    elif texto_candidato:
        contenido_texto = texto_candidato
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
    background_tasks: BackgroundTasks,
    archivo: Optional[UploadFile] = File(None, description="Documento PDF, MD o TXT"),
    texto_directo: Optional[str] = Form(None, description="Texto alternativo si no se sube archivo"),
    titulo: Optional[str] = Form(None, description="Título del documento"),
    perfil_destinatario: str = Form(..., description="Perfil del estudiante"),
    formato_salida: str = Form(..., description="Formato pedagógico deseado"),
    nicho_sector: str = Form("General", description="Sector de contextualización"),
    nivel_detalle: str = Form("Didáctico", description="Nivel de profundidad pedagógica"),
    tema_consulta: Optional[str] = Form(None, description="Tema o pregunta focal"),
    documento_contenido: Optional[str] = Form(None, description="Contenido de texto (alias de texto_directo)"),
    modo_rag: str = Form("vectorless", description="Modo RAG: 'vectorless' (colaborativo ultrarrápido) o 'clasico' (LangGraph)"),
    email_notificacion: Optional[str] = Form(None, description="Correo electrónico opcional para recibir dossier en PDF"),
) -> RespuestaAdaptacion:
    """
    Endpoint principal: recibe el documento y los parámetros pedagógicos.
    Por defecto ejecuta la Cadena Colaborativa Multi-Modelo (Vectorless In-Context RAG + Groq LPU + Cohere).
    Si hay saturación o agotamiento de cuotas (Failover 2), conmuta al Orquestador Clásico notificando al usuario.
    En segundo plano indexa en ChromaDB y despacha el PDF estandarizado por correo.
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
        documento_contenido=documento_contenido,
    )

    respuesta: RespuestaAdaptacion

    if modo_rag.lower() == "vectorless":
        cadena = get_cadena_colaborativa()
        logger.info(
            "Iniciando Cadena Colaborativa Multi-Modelo (Vectorless): '%s' | %s | %s",
            solicitud.documento_titulo,
            solicitud.perfil_destinatario,
            solicitud.formato_salida,
        )
        try:
            async with _SEMAFORO_CONCURRENCIA:
                respuesta = await asyncio.to_thread(cadena.ejecutar, solicitud)
        except Exception as exc_cadena:
            logger.warning(
                "Fallo en Cadena Colaborativa (%s). Conmutando a Respaldo 2 (LangGraph Clásico)...",
                exc_cadena,
            )
            orquestador = get_orquestador()
            async with _SEMAFORO_CONCURRENCIA:
                respuesta = await asyncio.to_thread(orquestador.ejecutar, solicitud)
            respuesta.advertencias.append(
                "⚠️ Alta demanda detectada en la red ultrarrápida. Contenido procesado mediante orquestación LangGraph profunda con respaldo semántico."
            )
    else:
        # Modo Clásico directo (LangGraph + ChromaDB)
        orquestador = get_orquestador()
        logger.info(
            "Iniciando Orquestación Clásica LangGraph: '%s' | %s | %s",
            solicitud.documento_titulo,
            solicitud.perfil_destinatario,
            solicitud.formato_salida,
        )
        async with _SEMAFORO_CONCURRENCIA:
            respuesta = await asyncio.to_thread(orquestador.ejecutar, solicitud)

    duracion = respuesta.orquestacion.duracion_segundos if respuesta.orquestacion else 0.0
    logger.info("Adaptación finalizada con status: %s | Duración: %.2fs", respuesta.status, duracion)

    # Programar tareas silenciosas en background (ChromaDB + PDF correo)
    background_tasks.add_task(
        _ejecutar_tareas_segundo_plano,
        solicitud=solicitud,
        respuesta=respuesta,
        email_destinatario=email_notificacion,
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
    documento_contenido: Optional[str] = Form(None, description="Contenido de texto (alias de texto_directo)"),
    modo_rag: str = Form("vectorless", description="Modo RAG: 'vectorless' (colaborativo ultrarrápido) o 'clasico' (LangGraph)"),
    email_notificacion: Optional[str] = Form(None, description="Correo electrónico opcional para recibir dossier en PDF"),
) -> StreamingResponse:
    """
    Endpoint con Server-Sent Events (SSE) y heartbeats periódicos (cada 15s)
    para evitar el timeout 524 de Cloudflare (100s) durante orquestaciones complejas.
    Soporta modo colaborativo 'vectorless' ultrarrápido y modo 'clasico'.
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
        documento_contenido=documento_contenido,
    )

    async def generador_eventos() -> AsyncGenerator[str, None]:
        # 1. Evento inicial de conexión establecida
        yield f"data: {json.dumps({'tipo': 'inicio', 'mensaje': 'Solicitud recibida. Iniciando orquestación pedagógica...'}, ensure_ascii=False)}\n\n"

        cola_progreso: asyncio.Queue[tuple[str, int]] = asyncio.Queue()

        def _progreso_callback(mensaje: str, paso: int) -> None:
            try:
                cola_progreso.put_nowait((mensaje, paso))
            except Exception:
                pass

        async def _ejecutar():
            async with _SEMAFORO_CONCURRENCIA:
                if modo_rag.lower() == "vectorless":
                    cadena = get_cadena_colaborativa()
                    try:
                        return await asyncio.to_thread(cadena.ejecutar, solicitud, _progreso_callback)
                    except Exception as exc_cadena:
                        logger.warning(
                            "Fallo en Cadena Colaborativa stream (%s). Conmutando a Respaldo 2 (LangGraph Clásico)...",
                            exc_cadena,
                        )
                        cola_progreso.put_nowait((
                            "⚠️ Conmutando a Orquestador Clásico LangGraph por alta demanda...",
                            1,
                        ))
                        orquestador = get_orquestador()
                        resp = await asyncio.to_thread(orquestador.ejecutar, solicitud)
                        resp.advertencias.append(
                            "⚠️ Alta demanda detectada en la red ultrarrápida. Contenido procesado mediante orquestación LangGraph profunda con respaldo semántico."
                        )
                        return resp
                else:
                    orquestador = get_orquestador()
                    return await asyncio.to_thread(orquestador.ejecutar, solicitud)

        tarea = asyncio.create_task(_ejecutar())

        segundos_transcurridos = 0
        while not tarea.done():
            # Emitir mensajes de la cola si los hay
            while not cola_progreso.empty():
                try:
                    p_msg, p_paso = cola_progreso.get_nowait()
                    yield f"data: {json.dumps({'tipo': 'progreso', 'segundos': segundos_transcurridos, 'mensaje': p_msg, 'etapa': f'paso_{p_paso}', 'estacion_desbloqueada': p_paso}, ensure_ascii=False)}\n\n"
                except asyncio.QueueEmpty:
                    break

            try:
                await asyncio.wait_for(asyncio.shield(tarea), timeout=2.5)
            except asyncio.TimeoutError:
                segundos_transcurridos += 3
                # Keep-alive SSE
                yield f": ping - heartbeat ({segundos_transcurridos}s)\n\n"
                if modo_rag.lower() != "vectorless":
                    # Simulación de pasos para modo clásico
                    if segundos_transcurridos <= 6:
                        etapa = "ingesta"
                        estacion = 0
                        msg = "Agente 1 (RAG): Ingestando documento y extrayendo texto estructurado..."
                    elif segundos_transcurridos <= 18:
                        etapa = "investigacion"
                        estacion = 0
                        msg = "Agente 1 (RAG): Generando embeddings vectoriales y recuperando fragmentos..."
                    elif segundos_transcurridos <= 36:
                        etapa = "redaccion_estacion_1"
                        estacion = 0
                        msg = "Agente 2 (Productor): Redactando Estación 1 · Resumen Ninja (TL;DR)..."
                    elif segundos_transcurridos <= 60:
                        etapa = "redaccion_estacion_2"
                        estacion = 1
                        msg = "Agente 2 (Productor): Generando Estación 2 · Flashcard Quest 3D..."
                    elif segundos_transcurridos <= 85:
                        etapa = "redaccion_estacion_3"
                        estacion = 2
                        msg = "Agente 2 (Productor): Elaborando Estación 3 · Tutorial Quest (Laboratorio)..."
                    elif segundos_transcurridos <= 110:
                        etapa = "redaccion_estacion_4"
                        estacion = 3
                        msg = "Agente 2 (Productor): Diseñando Estación 4 · Director Cut (Storyboard)..."
                    elif segundos_transcurridos <= 135:
                        etapa = "redaccion_estacion_5"
                        estacion = 4
                        msg = "Agente 2 (Productor): Formulando Estación 5 · The Final Trial (Quiz RAG)..."
                    else:
                        etapa = "auditoria"
                        estacion = 4
                        msg = f"Agente 3 (Crítico): Auditando fidelidad RAG y anclaje a fuentes ({segundos_transcurridos}s)..."
                    yield f"data: {json.dumps({'tipo': 'progreso', 'segundos': segundos_transcurridos, 'mensaje': msg, 'etapa': etapa, 'estacion_desbloqueada': estacion}, ensure_ascii=False)}\n\n"

        # 3. Emisión de resultado final o error
        try:
            respuesta: RespuestaAdaptacion = tarea.result()
            # Despachar tareas silenciosas en segundo plano
            asyncio.create_task(
                asyncio.to_thread(
                    _ejecutar_tareas_segundo_plano,
                    solicitud=solicitud,
                    respuesta=respuesta,
                    email_destinatario=email_notificacion,
                )
            )
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


def _obtener_directorio_documentos() -> Path:
    posibles = [
        Path(__file__).resolve().parents[2] / "data" / "documents",
        Path("data/documents").resolve(),
        Path("../data/documents").resolve(),
    ]
    for p in posibles:
        if p.exists() and p.is_dir():
            return p
    return posibles[0]


CATALOGO_DOCUMENTOS = [
    {
        "id": "guia-swap-oci",
        "nombre_archivo": "guia_optimizacion_swap_oci.md",
        "titulo": "Guía Técnica OCI: Optimización de Memoria y Swap de 4 GB",
        "nicho": "General",
        "perfil": "Principiante",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "markdown",
        "tamano_formato": "7.7 KB (Markdown)",
        "descripcion": "Arquitectura de memoria virtual y aprovisionamiento de 4 GB Swap en VM.Standard.E2.1.Micro para prevenir el OOM Killer sin costes en OCI Always Free.",
    },
    {
        "id": "apache-kafka",
        "nombre_archivo": "apache_kafka_introduction.md",
        "titulo": "Apache Kafka: Fundamentos y Arquitectura de Event Streaming",
        "nicho": "Fintech",
        "perfil": "Desarrollador Junior",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "markdown",
        "tamano_formato": "11.2 KB (Markdown)",
        "descripcion": "Fundamentos de Event Streaming distribuido, Topics, Particiones y Arquitectura de Microservicios reactivos en tiempo real.",
    },
    {
        "id": "enisa-threat-landscape",
        "nombre_archivo": "ENISA Threat Landscape 2026_Final.pdf",
        "titulo": "ENISA Threat Landscape: Ciberamenazas y Resiliencia Digital",
        "nicho": "General",
        "perfil": "Líder Técnico / Arquitecto",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "pdf",
        "tamano_formato": "8.4 MB (PDF Oficial)",
        "descripcion": "Informe exhaustivo de la Agencia Europea de Ciberseguridad sobre vectores de ataque, cadenas de suministro y ciberdefensa moderna.",
    },
    {
        "id": "snowflake-architecture",
        "nombre_archivo": "Snowflake_SIGMOD.pdf",
        "titulo": "Snowflake Elastic Data Warehouse (SIGMOD Paper)",
        "nicho": "General",
        "perfil": "Líder Técnico / Arquitecto",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "pdf",
        "tamano_formato": "909 KB (PDF Técnico)",
        "descripcion": "Paper académico oficial de SIGMOD sobre arquitectura elástica desacoplada de cómputo y almacenamiento en bases de datos analíticas cloud.",
    },
    {
        "id": "caballero-armadura",
        "nombre_archivo": "El caballero de la armadura oxidada - Robert-Fisher.pdf",
        "titulo": "El Caballero de la Armadura Oxidada (Pedagogía & Humanidades)",
        "nicho": "General",
        "perfil": "Principiante",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "pdf",
        "tamano_formato": "175 KB (PDF Literario)",
        "descripcion": "Obra alegórica de Robert Fisher sobre autoconocimiento, coraje reflexivo, barreras emocionales y transformación pedagógica.",
    },
]


@app.get("/api/v1/documentos/ejemplos", tags=["Biblioteca de Documentos"])
def listar_documentos_ejemplo() -> List[Dict[str, Any]]:
    """Retorna la lista de documentos reales disponibles en data/documents/ para pruebas de orquestación."""
    directorio = _obtener_directorio_documentos()
    documentos_disponibles = []
    for doc in CATALOGO_DOCUMENTOS:
        ruta = directorio / doc["nombre_archivo"]
        item = dict(doc)
        item["existe"] = ruta.exists()
        if ruta.exists():
            item["tamano_bytes"] = ruta.stat().st_size
        documentos_disponibles.append(item)
    return documentos_disponibles


@app.get("/api/v1/documentos/ejemplos/{nombre_archivo}", tags=["Biblioteca de Documentos"])
def obtener_documento_ejemplo(nombre_archivo: str) -> FileResponse:
    """Descarga el archivo físico real desde data/documents/ para alimentarlo al pipeline."""
    directorio = _obtener_directorio_documentos()
    archivo = directorio / Path(nombre_archivo).name
    if not archivo.exists() or not archivo.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Documento '{nombre_archivo}' no encontrado en la biblioteca.",
        )
    media_type = "application/pdf" if archivo.suffix.lower() == ".pdf" else "text/markdown; charset=utf-8"
    return FileResponse(path=str(archivo), filename=archivo.name, media_type=media_type)

