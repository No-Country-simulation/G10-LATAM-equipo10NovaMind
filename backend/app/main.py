"""
Backend de NuevaMente — API REST (FastAPI).
Desarrollado por: Equipo 10 (G10 - NuevaMente) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Expone los servicios de adaptación educativa mediante LangGraph, Agentes y RAG.
Desacoplado del frontend Streamlit.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from dataclasses import replace
from functools import lru_cache
from uuid import UUID
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

from dotenv import load_dotenv

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if (_ROOT_DIR / ".env").exists():
    load_dotenv(_ROOT_DIR / ".env")
load_dotenv()

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile, status, Depends
from app.auth import Principal, ensure_document, persist_result, private_query, require_user
from app.auth import rechazar_generacion_invitado, require_generador
from app.auth import settings as supabase_settings
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field, ValidationError

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.agentes.generacion_paralela import NOMBRES_RECURSO, GeneradorParalelo
from app.core.config import Config, ConfigError
from app.servicios.registro_tareas import RegistroMemoria, RegistroSupabase, RegistroTareas
from app.servicios.servicio_ampliacion import AmpliadorEscenas
from app.servicios.servicio_gemini import ClienteGemini, GeminiError
from app.servicios.servicio_imagenes import BuscadorImagenes
from app.servicios.preparacion_fotos import preparador_del_entorno
from app.servicios.servicio_narracion import Narrador, diapositivas_sin_voz
from app.servicios.servicio_voz import VozElevenLabs, VozGemini
from app.storage.almacen_narracion import almacen_del_entorno, prefijo_narraciones, ruta_segura
from app.integration.private_pipeline import PrivateCadena, PrivateCorreo, notification_recipient
from app.core.ingestion import (
    IngestionError,
    PdfSinTexto,
    cargar_documento,
    cargar_documento_desde_bytes,
    detectar_secciones,
    paginas_desde_marcadores,
    tipo_mime_imagen,
)
from app.servicios.servicio_transcripcion import ORIGEN_TRANSCRIPCION, transcribir
from app.core.schemas import (
    DIRECTIVAS_NICHO_SECTOR,
    DIRECTIVAS_PERFIL_DESTINATARIO,
    FormatoSalida,
    NichoSector,
    NivelDetalle,
    PerfilDestinatario,
    RespuestaAdaptacion,
    RespuestaAmpliacion,
    RespuestaNarracion,
    SolicitudAdaptacion,
    SolicitudAmpliacion,
    SolicitudNarracion,
    VideoJobSpec,
)
from app.orquestador import OrquestadorNuevaMente, crear_orquestador
from app.servicios.generador_pdf import GeneradorPDFEducativo
from app.servicios.servicio_correo import ServicioCorreo
from app.storage.oci_client import _slugify

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nuevamente.backend")

# Un cliente Gemini por proceso (y bucle de eventos): su semáforo reparte entre todas las
# solicitudes la cuota, que Google aplica por proyecto y no por usuario.
_GEMINI_MAX_CONCURRENCIA = int(os.getenv("GEMINI_MAX_CONCURRENCIA", "4"))
_CLIENTE_GEMINI: Optional[tuple] = None  # (bucle, ClienteGemini)


def _cliente_gemini() -> ClienteGemini:
    global _CLIENTE_GEMINI
    bucle = asyncio.get_running_loop()
    if _CLIENTE_GEMINI is None or _CLIENTE_GEMINI[0] is not bucle:
        cliente = ClienteGemini(Config.desde_entorno().gemini_api_key, max_concurrencia=_GEMINI_MAX_CONCURRENCIA)
        _CLIENTE_GEMINI = (bucle, cliente)
    return _CLIENTE_GEMINI[1]


@asynccontextmanager
async def _ciclo_de_vida(_app: FastAPI):
    yield
    if _CLIENTE_GEMINI is not None and _CLIENTE_GEMINI[0] is asyncio.get_running_loop():
        await _CLIENTE_GEMINI[1].aclose()


app = FastAPI(
    title="NuevaMente API",
    description="Backend de Adaptación y Generación de Contenido Educativo con Agentes.",
    version="2.0.0",
    lifespan=_ciclo_de_vida,
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


# Semáforo de concurrencia: límite de 5 solicitudes simultáneas para evitar encolamiento innecesario
_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(5)
# Los invitados comparten un token público: como máximo ocupan este número de los 5 cupos,
# de modo que nunca pueden dejar sin servicio a los usuarios autenticados.
_SEMAFORO_INVITADOS = asyncio.Semaphore(int(os.getenv("MAX_INVITADOS_CONCURRENTES", "2")))
MAX_BYTES_ARCHIVO = int(os.getenv("MAX_BYTES_ARCHIVO", str(15 * 1024 * 1024)))
TIEMPO_MAX_ADAPTACION_S = float(os.getenv("TIEMPO_MAX_ADAPTACION_S", "300"))
_TAREAS_FONDO: set = set()  # referencias fuertes: asyncio no retiene tareas sueltas


@asynccontextmanager
async def _cupo(principal: Principal):
    if principal.is_guest:
        async with _SEMAFORO_INVITADOS:
            async with _SEMAFORO_CONCURRENCIA:
                yield
    else:
        async with _SEMAFORO_CONCURRENCIA:
            yield


def _aviso_respaldo(exc: Exception) -> str:
    return (
        f"⚠️ La cadena colaborativa no completó la generación ({type(exc).__name__}); "
        "el contenido se generó con el orquestador clásico (LangGraph + ChromaDB)."
    )


def get_orquestador(principal: Principal) -> OrquestadorNuevaMente:
    # One isolated collection per owner. No tokens or per-user state in a singleton.
    cfg = Config.desde_entorno()
    cfg = replace(cfg, collection_name='owner_' + principal.user_id.replace('-', ''))
    from app.storage.private_storage import storage_for
    return crear_orquestador(config=cfg, almacenador=storage_for(principal.user_id))


def get_cadena_colaborativa(principal: Principal) -> CadenaColaborativaMultiModelo:
    return PrivateCadena(principal.user_id)


def get_servicio_correo(principal: Principal) -> ServicioCorreo:
    return PrivateCorreo(principal.user_id)


def get_generador_paralelo(principal: Principal, registro: Optional[RegistroTareas] = None) -> GeneradorParalelo:
    from app.storage.private_storage import storage_for
    cliente, cfg = _cliente_gemini(), Config.desde_entorno()
    return GeneradorParalelo(
        cliente,
        cfg,
        # Invitados: nada se archiva (comparten identidad).
        almacenar=None if principal.is_guest else storage_for(principal.user_id),
        registro=registro,
        propietario=principal.user_id,
        # Fotos del video buscadas (y las dudosas revisadas) mientras corre la tarea C
        preparar_fotos=preparador_del_entorno(cliente, cfg),
    )


_MAX_FILAS_CACHE_INVITADOS = int(os.getenv("MAX_FILAS_CACHE_INVITADOS", "200"))
# Invitados: caché en memoria del proceso (se pierde al reiniciar). Pensada para pruebas y
# demos: repetir el mismo documento no vuelve a gastar cuota. Es segura porque la clave
# incluye el hash del contenido (solo acierta quien sube ese mismo documento) y los
# invitados ya comparten identidad. ~9 filas por documento: 200 ≈ 20 documentos.
_REGISTRO_INVITADOS: Optional[RegistroMemoria] = (
    RegistroMemoria(max_filas=_MAX_FILAS_CACHE_INVITADOS) if _MAX_FILAS_CACHE_INVITADOS > 0 else None
)


async def _registro_tareas(principal: Principal, solicitud: SolicitudAdaptacion) -> Optional[RegistroTareas]:
    """
    Registro en generation_tasks (RLS con el JWT del usuario). La fila de `documents`
    se crea al empezar, no al final. Invitados: caché en memoria del proceso, sin Supabase.
    """
    if principal.is_guest:
        return _REGISTRO_INVITADOS
    try:
        document_id = await asyncio.to_thread(ensure_document, principal, solicitud)
        url, clave = supabase_settings()
        return RegistroSupabase(url, clave, principal.token, principal.user_id, document_id)
    except Exception as exc:
        logger.warning("Generación sin registro de tareas (%s).", type(exc).__name__)
        return None


ProgresoCallback = Optional[Any]  # Callable[[str, int], None], invocable desde hilos


async def _cadena_o_clasico(
    principal: Principal, solicitud: SolicitudAdaptacion, on_progress: ProgresoCallback = None
) -> RespuestaAdaptacion:
    """Cadena colaborativa; si falla, orquestador clásico (Respaldo 2)."""
    cadena = get_cadena_colaborativa(principal)
    try:
        args = (solicitud, on_progress) if on_progress else (solicitud,)
        return await asyncio.to_thread(cadena.ejecutar, *args)
    except Exception as exc_cadena:
        logger.warning(
            "Fallo en Cadena Colaborativa (%s). Conmutando a Respaldo 2 (LangGraph Clásico)...", exc_cadena
        )
        if on_progress:
            on_progress("⚠️ Conmutando a Orquestador Clásico LangGraph por alta demanda...", 1)
        resp = await asyncio.to_thread(get_orquestador(principal).ejecutar, solicitud)
        resp.advertencias.append(_aviso_respaldo(exc_cadena))
        return resp


async def _generar(
    principal: Principal,
    solicitud: SolicitudAdaptacion,
    modo_rag: str,
    publicar=None,
    on_progress: ProgresoCallback = None,
) -> RespuestaAdaptacion:
    resp = await _generar_segun_modo(principal, solicitud, modo_rag, publicar, on_progress)
    if solicitud.origen_contenido == ORIGEN_TRANSCRIPCION:
        resp.advertencias.insert(0, AVISO_TRANSCRIPCION)
    return resp


AVISO_TRANSCRIPCION = (
    "📷 El texto fuente es una transcripción hecha por IA de una imagen o un PDF escaneado: "
    "las citas se verificaron contra esa transcripción, no contra el original."
)


async def _generar_segun_modo(
    principal: Principal,
    solicitud: SolicitudAdaptacion,
    modo_rag: str,
    publicar=None,
    on_progress: ProgresoCallback = None,
) -> RespuestaAdaptacion:
    """paralelo → (cadena → clásico) · vectorless → (cadena → clásico) · otro → clásico."""
    modo = modo_rag.lower()
    if modo == "paralelo":
        registro = await _registro_tareas(principal, solicitud)
        try:
            generador = get_generador_paralelo(principal, registro)
            return await generador.generar(solicitud, publicar or (lambda _e: None))
        except Exception as exc_paralelo:  # sin clave, ninguna tarea útil, error inesperado
            logger.warning("Modo paralelo sin resultado (%s). Conmutando a la cadena colaborativa...", exc_paralelo)
            if on_progress:
                on_progress("⚠️ La generación paralela no respondió; conmutando a la cadena colaborativa...", 1)
            resp = await _cadena_o_clasico(principal, solicitud, on_progress)
            resp.advertencias.insert(
                0, f"⚠️ La generación paralela no produjo recursos ({type(exc_paralelo).__name__}); "
                   "se usó la cadena colaborativa.",
            )
            if resp.status == "exito":
                resp.status = "exito_con_advertencias"
            return resp
        finally:
            if registro is not None:
                await registro.aclose()
    if modo == "vectorless":
        return await _cadena_o_clasico(principal, solicitud, on_progress)
    return await asyncio.to_thread(get_orquestador(principal).ejecutar, solicitud)


# Estación que cada recurso del modo paralelo desbloquea en el frontend actual.
_ESTACION_POR_RECURSO = {"resumen": 0, "flashcards": 1, "tutorial": 2, "guion": 3, "cuestionario": 4}


def _ejecutar_tareas_segundo_plano(
    principal: Principal,
    solicitud: SolicitudAdaptacion,
    respuesta: RespuestaAdaptacion,
    email_destinatario: Optional[str] = None,
) -> None:
    """
    Tareas en segundo plano:
    1. RAG Silencioso: Indexa el documento original en ChromaDB sin bloquear la respuesta.
    2. Envío Silencioso: Genera el dossier PDF estandarizado (sin audiovisual) y lo envía/respalda en OCI.
    """
    if respuesta.status == 'error' or principal.is_guest:
        # Invitados: no se indexan ni archivan documentos en espacios compartidos.
        return
    # 1. Indexación silenciosa en ChromaDB
    try:
        orquestador = get_orquestador(principal)
        investigador = orquestador._investigador
        if solicitud.documento_contenido:
            doc_id = solicitud.documento_id or (
                respuesta.orquestacion.documento_id if respuesta.orquestacion else "doc-auto"
            )
            if investigador.contar_chunks(doc_id) == 0:
                investigador.ingerir_documento(doc_id, solicitud.documento_titulo, solicitud.documento_contenido)
            logger.info("[background] Documento '%s' indexado silenciosamente en ChromaDB.", doc_id)
    except Exception as exc_idx:
        logger.warning("[background] Fallo no crítico en indexación silenciosa ChromaDB: %s", exc_idx)

    # 2. Despacho silencioso de PDF y correo
    try:
        servicio_correo = get_servicio_correo(principal)
        contenido_dict = (
            respuesta.contenido_adaptado.model_dump()
            if hasattr(respuesta.contenido_adaptado, "model_dump")
            else (respuesta.contenido_adaptado or {})
        )
        destinatario = notification_recipient(principal, email_destinatario)
        anclaje = (
            respuesta.evaluacion_calidad.anclaje_fuente_score
            if respuesta.evaluacion_calidad
            else None
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
        "nichos_sector": list(DIRECTIVAS_NICHO_SECTOR.keys()),
        "niveles_detalle": [
            "Didáctico",
            "Intermedio",
            "Profundo",
        ],
    }


async def _leer_subida(archivo: UploadFile) -> bytes:
    contenido = await archivo.read(MAX_BYTES_ARCHIVO + 1)
    if len(contenido) > MAX_BYTES_ARCHIVO:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera el máximo de {MAX_BYTES_ARCHIVO // (1024 * 1024)} MB.",
        )
    if not contenido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo subido está vacío.",
        )
    return contenido


@app.post("/api/v1/documentos/extraer", tags=["Adaptación Pedagógica"])
async def extraer_documento(
    principal: Principal = Depends(require_user),
    archivo: UploadFile = File(..., description="PDF, MD, TXT o imagen (PNG, JPG, WEBP)"),
) -> Dict[str, Any]:
    """
    Texto que se usará como fuente, para revisarlo antes de generar. PDF con texto, MD y TXT
    se extraen tal cual (origen "documento"). Imágenes y PDF escaneados se transcriben con
    Gemini (origen "transcripcion_ia"): el cliente debe mostrar ese texto, dejar corregirlo y
    enviarlo después como `texto_directo` con `origen_contenido=transcripcion_ia`.
    """
    contenido = await _leer_subida(archivo)
    nombre = archivo.filename or "documento"
    titulo = Path(nombre.replace("\\", "/")).stem or "Documento"
    mime = tipo_mime_imagen(contenido, nombre)  # IngestionError → 400 si los bytes no cuadran
    paginas_pdf = 1
    if mime is None:
        try:
            doc = await asyncio.to_thread(cargar_documento_desde_bytes, contenido, nombre)
            return {
                "titulo": doc.titulo, "texto": doc.texto, "origen": "documento",
                "paginas": len(doc.paginas), "modelo": None, "advertencias": [],
            }
        except PdfSinTexto as exc:
            mime, paginas_pdf = "application/pdf", exc.num_paginas
    rechazar_generacion_invitado(principal)  # transcribir gasta cuota de Gemini
    try:
        async with _cupo(principal):
            resultado = await transcribir(
                _cliente_gemini(), Config.desde_entorno(), contenido, mime, paginas_esperadas=paginas_pdf,
            )
    except GeminiError as exc:
        logger.warning("Transcripción fallida (%s): %s", exc.codigo, exc.mensaje)
        detalle = (
            "La transcripción con IA no está configurada en este servidor."
            if exc.codigo in ("sin_clave", "no_autorizado")
            else f"No se pudo transcribir el archivo ahora ({exc.codigo}). Prueba de nuevo en unos minutos."
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detalle) from None
    return {
        "titulo": titulo, "texto": resultado.texto, "origen": ORIGEN_TRANSCRIPCION,
        "paginas": resultado.paginas, "modelo": resultado.modelo, "advertencias": resultado.advertencias,
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
    origen_contenido: Optional[str] = None,
) -> SolicitudAdaptacion:
    """Extrae el contenido documental y valida los parámetros de la solicitud pedagógica."""
    contenido_texto = ""
    doc_titulo = titulo or "Documento Técnico"
    paginas: List[Any] = []
    secciones: List[Any] = []
    origen = "documento"

    texto_candidato = (texto_directo or "").strip() or (documento_contenido or "").strip()

    if archivo and archivo.filename:
        contenido_bytes = await _leer_subida(archivo)
        try:
            doc_ingresado = cargar_documento_desde_bytes(
                contenido_bytes, archivo.filename, titulo=titulo
            )
            contenido_texto = doc_ingresado.texto
            doc_titulo = doc_ingresado.titulo
            paginas = doc_ingresado.paginas
            secciones = doc_ingresado.secciones
        except IngestionError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error de ingesta: {exc}",
            ) from exc
    elif texto_candidato and origen_contenido == ORIGEN_TRANSCRIPCION:
        # Transcripción de /api/v1/documentos/extraer, quizá corregida por el usuario: las
        # páginas salen de sus marcadores "[Página N]", nunca de posiciones que envíe el cliente.
        contenido_texto = texto_candidato
        origen = ORIGEN_TRANSCRIPCION
        paginas = paginas_desde_marcadores(texto_candidato)
        secciones = detectar_secciones(texto_candidato, ".pdf", paginas)
    elif texto_candidato:
        contenido_texto = texto_candidato
        # El texto pegado suele venir en Markdown; sin paginación real.
        secciones = detectar_secciones(texto_candidato, ".md")
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
                "paginas": paginas,
                "secciones": secciones,
                "origen_contenido": origen,
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
    principal: Principal = Depends(require_generador),
    archivo: Optional[UploadFile] = File(None, description="Documento PDF, MD o TXT"),
    texto_directo: Optional[str] = Form(None, description="Texto alternativo si no se sube archivo"),
    titulo: Optional[str] = Form(None, description="Título del documento"),
    perfil_destinatario: str = Form(..., description="Perfil del estudiante"),
    formato_salida: str = Form(..., description="Formato pedagógico deseado"),
    nicho_sector: str = Form("General", description="Sector de contextualización"),
    nivel_detalle: str = Form("Didáctico", description="Nivel de profundidad pedagógica"),
    tema_consulta: Optional[str] = Form(None, description="Tema o pregunta focal"),
    documento_contenido: Optional[str] = Form(None, description="Contenido de texto (alias de texto_directo)"),
    modo_rag: str = Form("vectorless", description="Modo RAG: 'vectorless' (cadena colaborativa), 'paralelo' (Gemini concurrente con publicación incremental) o 'clasico' (LangGraph)"),
    email_notificacion: Optional[str] = Form(None, description="Correo electrónico opcional para recibir dossier en PDF"),
    origen_contenido: Optional[str] = Form(None, description="'transcripcion_ia' si texto_directo es una transcripción de /api/v1/documentos/extraer"),
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
        origen_contenido=origen_contenido,
    )

    email_notificacion = notification_recipient(principal, email_notificacion)
    logger.info(
        "Iniciando adaptación (modo %s): '%s' | %s | %s",
        modo_rag, solicitud.documento_titulo, solicitud.perfil_destinatario, solicitud.formato_salida,
    )
    async with _cupo(principal):
        respuesta = await _generar(principal, solicitud, modo_rag)

    respuesta = await asyncio.to_thread(persist_result, principal, solicitud, respuesta)
    duracion = respuesta.orquestacion.duracion_segundos if respuesta.orquestacion else 0.0
    logger.info("Adaptación finalizada con status: %s | Duración: %.2fs", respuesta.status, duracion)

    # Programar tareas silenciosas en background (ChromaDB + PDF correo)
    background_tasks.add_task(
        _ejecutar_tareas_segundo_plano,
        principal=principal,
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
    principal: Principal = Depends(require_generador),
    archivo: Optional[UploadFile] = File(None, description="Documento PDF, MD o TXT"),
    texto_directo: Optional[str] = Form(None, description="Texto alternativo si no se sube archivo"),
    titulo: Optional[str] = Form(None, description="Título del documento"),
    perfil_destinatario: str = Form(..., description="Perfil del estudiante"),
    formato_salida: str = Form(..., description="Formato pedagógico deseado"),
    nicho_sector: str = Form("General", description="Sector de contextualización"),
    nivel_detalle: str = Form("Didáctico", description="Nivel de profundidad pedagógica"),
    tema_consulta: Optional[str] = Form(None, description="Tema o pregunta focal"),
    documento_contenido: Optional[str] = Form(None, description="Contenido de texto (alias de texto_directo)"),
    modo_rag: str = Form("vectorless", description="Modo RAG: 'vectorless' (cadena colaborativa), 'paralelo' (Gemini concurrente con publicación incremental) o 'clasico' (LangGraph)"),
    email_notificacion: Optional[str] = Form(None, description="Correo electrónico opcional para recibir dossier en PDF"),
    origen_contenido: Optional[str] = Form(None, description="'transcripcion_ia' si texto_directo es una transcripción de /api/v1/documentos/extraer"),
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
        origen_contenido=origen_contenido,
    )

    email_notificacion = notification_recipient(principal, email_notificacion)
    async def generador_eventos() -> AsyncGenerator[str, None]:
        # 1. Evento inicial de conexión establecida
        yield f"data: {json.dumps({'tipo': 'inicio', 'mensaje': 'Solicitud recibida. Iniciando orquestación pedagógica...'}, ensure_ascii=False)}\n\n"

        # Eventos ya formados ({'tipo': ...}); los de 'progreso' reciben 'segundos' al emitirse.
        cola_eventos: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        loop = asyncio.get_running_loop()
        modo = modo_rag.lower()
        estacion_max = 0

        def _evento_progreso(mensaje: str, paso: int, etapa: Optional[str] = None) -> Dict[str, Any]:
            return {'tipo': 'progreso', 'mensaje': mensaje, 'etapa': etapa or f'paso_{paso}', 'estacion_desbloqueada': paso}

        def _progreso_callback(mensaje: str, paso: int) -> None:
            # Invocado desde el hilo de la cadena: hay que volver al bucle de eventos.
            try:
                loop.call_soon_threadsafe(cola_eventos.put_nowait, _evento_progreso(mensaje, paso))
            except Exception:
                pass

        def _publicar(evento: Dict[str, Any]) -> None:
            """Eventos del modo paralelo (mismo bucle). Se traducen además a 'progreso'
            para que el frontend actual, que solo entiende 'progreso'/'resultado', avance."""
            nonlocal estacion_max
            cola_eventos.put_nowait(evento)
            if evento.get('tipo') == 'recurso' and evento['estado']['estado'] == 'completado':
                recurso = evento['recurso']
                estacion_max = max(estacion_max, _ESTACION_POR_RECURSO.get(recurso, 0))
                cola_eventos.put_nowait(_evento_progreso(
                    f"✅ {NOMBRES_RECURSO.get(recurso, recurso)} listo (verificación pendiente)",
                    estacion_max, etapa=f'recurso_{recurso}',
                ))
            elif evento.get('tipo') == 'tarea' and evento.get('tarea') == 'auditoria' and evento['estado'] == 'en_curso':
                cola_eventos.put_nowait(_evento_progreso(
                    "🛡️ Auditando la fidelidad de los recursos contra el documento...", estacion_max, etapa='auditoria',
                ))

        async def _ejecutar():
            async with _cupo(principal):
                resp = await _generar(
                    principal, solicitud, modo,
                    publicar=_publicar,
                    on_progress=_progreso_callback if modo in ("vectorless", "paralelo") else None,
                )
                return await asyncio.to_thread(persist_result, principal, solicitud, resp)

        tarea = asyncio.create_task(_ejecutar())

        inicio = time.monotonic()
        segundos_transcurridos = 0
        while not tarea.done():
            if time.monotonic() - inicio > TIEMPO_MAX_ADAPTACION_S:
                # Libera el cupo del semáforo. El hilo de trabajo no se puede interrumpir y
                # termina por su cuenta; su resultado se descarta.
                tarea.cancel()
                logger.error("Adaptación vía stream superó %.0fs; se cancela.", TIEMPO_MAX_ADAPTACION_S)
                yield f"data: {json.dumps({'tipo': 'error', 'detalle': 'La generación tardó demasiado. Inténtalo de nuevo en unos minutos.'}, ensure_ascii=False)}\n\n"
                return
            # Emitir los eventos acumulados (progreso y, en modo paralelo, recursos)
            while not cola_eventos.empty():
                try:
                    evento = cola_eventos.get_nowait()
                except asyncio.QueueEmpty:
                    break
                if evento.get('tipo') == 'progreso':
                    evento = {**evento, 'segundos': segundos_transcurridos}
                yield f"data: {json.dumps(evento, ensure_ascii=False, default=str)}\n\n"

            try:
                await asyncio.wait_for(asyncio.shield(tarea), timeout=2.5)
            except asyncio.TimeoutError:
                segundos_transcurridos = int(time.monotonic() - inicio)
                # Keep-alive SSE
                yield f": ping - heartbeat ({segundos_transcurridos}s)\n\n"
                if modo not in ("vectorless", "paralelo"):
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

        # Eventos que llegaron justo antes de terminar (último recurso, auditoría)
        while not cola_eventos.empty():
            evento = cola_eventos.get_nowait()
            if evento.get('tipo') == 'progreso':
                evento = {**evento, 'segundos': int(time.monotonic() - inicio)}
            yield f"data: {json.dumps(evento, ensure_ascii=False, default=str)}\n\n"

        # 3. Emisión de resultado final o error
        try:
            respuesta: RespuestaAdaptacion = tarea.result()
            # Despachar tareas silenciosas en segundo plano
            tarea_fondo = asyncio.create_task(
                asyncio.to_thread(
                    _ejecutar_tareas_segundo_plano,
                    principal=principal,
                    solicitud=solicitud,
                    respuesta=respuesta,
                    email_destinatario=email_notificacion,
                )
            )
            _TAREAS_FONDO.add(tarea_fondo)
            tarea_fondo.add_done_callback(_TAREAS_FONDO.discard)
            yield f"data: {json.dumps({'tipo': 'resultado', 'datos': respuesta.model_dump(mode='json')}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            logger.exception("Error en orquestación vía stream: %s", exc)
            # Al cliente solo se le muestra un mensaje seguro; el detalle técnico queda en el log.
            detalle = exc.detail if isinstance(exc, HTTPException) else "No se pudo completar la adaptación. Inténtalo de nuevo."
            yield f"data: {json.dumps({'tipo': 'error', 'detalle': detalle}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generador_eventos(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Etapa 6 · Video narrado bajo demanda (diapositivas + voz; el JSON es el guion)
# ---------------------------------------------------------------------------
_PATRON_DOCUMENTO = re.compile(r"doc-([0-9a-f]{16})")
_TIPOS_ARCHIVO_NARRACION = {".wav": "audio/wav", ".mp3": "audio/mpeg", ".json": "application/json"}


def _voces_narracion(voz_gemini: str) -> list:
    """ElevenLabs (principal) → Gemini TTS (respaldo, un modelo tras otro); solo los configurados."""
    cfg = Config.desde_entorno()
    voces: list = []
    if cfg.elevenlabs_api_key:
        voces.append(VozElevenLabs(
            cfg.elevenlabs_api_key, modelo=cfg.elevenlabs_tts_model,
            voz_id=cfg.elevenlabs_voice_id, voz_nombre=cfg.elevenlabs_voice_name,
        ))
    try:
        cliente = _cliente_gemini()
    except GeminiError:
        return voces  # sin GEMINI_API_KEY: queda solo ElevenLabs
    # Cada modelo TTS tiene su propia cuota gratuita: el principal y, en orden, sus respaldos
    for modelo in dict.fromkeys((cfg.gemini_tts_model, *cfg.gemini_tts_fallback_models)):
        voces.append(VozGemini(cliente, modelo, voz_gemini))
    return voces


async def _registro_narracion(principal: Principal, spec: VideoJobSpec) -> Optional[RegistroTareas]:
    """La fila de `documents` se localiza por la huella que ya lleva el guion (doc-<16 hex>)."""
    coincidencia = _PATRON_DOCUMENTO.fullmatch(spec.document_id)
    if principal.is_guest or not coincidencia:
        return None
    try:
        filas = await asyncio.to_thread(private_query, principal, "documents", {
            "select": "id", "user_id": "eq." + principal.user_id,
            "content_hash": f"like.{coincidencia.group(1)}*", "limit": "1",
        })
        if not filas:
            return None
        url, clave = supabase_settings()
        return RegistroSupabase(url, clave, principal.token, principal.user_id, filas[0]["id"])
    except Exception as exc:
        logger.warning("Narración sin registro de tareas (%s).", type(exc).__name__)
        return None


@app.post("/api/v1/narracion/generar", response_model=RespuestaNarracion, tags=["Video narrado"])
async def generar_narracion(
    solicitud: SolicitudNarracion, principal: Principal = Depends(require_user)
) -> RespuestaNarracion:
    """
    Convierte el guion (VideoJobSpec) en video narrado: voz por escena (ElevenLabs y, si no
    puede, Gemini TTS con la voz `voz`), duración medida (máximo 60 s) y fotos libres opcionales.
    Usuarios: se guarda en su almacén privado y se reutiliza si se pide de nuevo.
    Invitados: solo con PERMITIR_GENERACION_INVITADO (pregenerar muestras); el audio vuelve en la
    respuesta y no se guarda.
    Con voz_servidor=false (voz del navegador) solo se buscan las fotos: ni voz ni almacén.
    """
    if not solicitud.voz_servidor:
        buscador = BuscadorImagenes()
        try:
            async with _cupo(principal):
                return await diapositivas_sin_voz(solicitud, buscador)
        finally:
            await buscador.aclose()
    rechazar_generacion_invitado(principal)  # la voz del servidor gasta cuota (ElevenLabs, Gemini TTS)
    try:
        almacen = None if principal.is_guest else almacen_del_entorno()
    except ValueError as exc:
        logger.warning("Almacén de narración no disponible: %s", exc)
        raise HTTPException(503, "El almacenamiento privado de audio no está disponible.") from exc
    voces = _voces_narracion(solicitud.voz)
    if not voces:
        raise HTTPException(503, "La narración no está disponible: no hay servicio de voz configurado.")

    registro = await _registro_narracion(principal, solicitud.video_job_spec)
    buscador = BuscadorImagenes()
    try:
        narrador = Narrador(
            voces, buscador=buscador, almacen=almacen,
            prefijo=None if principal.is_guest else prefijo_narraciones(principal.user_id), registro=registro,
        )
        async with _cupo(principal):
            return await narrador.narrar(solicitud)
    finally:
        await buscador.aclose()
        for voz in voces:
            await voz.aclose()
        if registro is not None:
            await registro.aclose()


@app.post("/api/v1/narracion/ampliar", response_model=RespuestaAmpliacion, tags=["Video narrado"])
async def ampliar_escena(
    solicitud: SolicitudAmpliacion, _principal: Principal = Depends(require_generador)
) -> RespuestaAmpliacion:
    """
    "Profundizar concepto" (tipo guion) y "Enriquecer con IA" (tipo visual) del teleprompter.
    Llamada breve a Gemini desde el servidor, con caché: responde en menos de 30 s, sin SSE.
    No usa _cupo: no compite con las generaciones largas, y el cliente Gemini ya limita la concurrencia.
    """
    try:
        cliente = _cliente_gemini()
    except GeminiError as exc:
        raise HTTPException(503, "La ampliación no está disponible: falta la configuración de Gemini.") from exc
    cfg = Config.desde_entorno()
    ampliador = AmpliadorEscenas(cliente, cfg.gemini_resources_model, cfg.gemini_resources_fallback_model)
    return await ampliador.ampliar(solicitud)


@app.get("/api/v1/narracion/archivo/{ruta:path}", tags=["Video narrado"])
async def descargar_archivo_narracion(ruta: str, principal: Principal = Depends(require_user)) -> Response:
    """Audio o guion guardado del propio usuario (el bucket es privado: nunca hay URL pública)."""
    extension = Path(ruta).suffix.lower()
    if (
        principal.is_guest
        or extension not in _TIPOS_ARCHIVO_NARRACION
        or not ruta_segura(ruta)
        or not ruta.startswith(prefijo_narraciones(principal.user_id) + "/")
    ):
        raise HTTPException(404, "Archivo no encontrado.")
    try:
        datos = await asyncio.to_thread(almacen_del_entorno().leer, ruta)
    except Exception as exc:
        logger.warning("No se pudo leer %s del almacén: %s", extension, type(exc).__name__)
        raise HTTPException(503, "El almacenamiento privado de audio no está disponible.") from None
    if datos is None:
        raise HTTPException(404, "Archivo no encontrado.")
    return Response(
        content=datos, media_type=_TIPOS_ARCHIVO_NARRACION[extension],
        headers={"Cache-Control": "private, max-age=86400"},
    )


# ---------------------------------------------------------------------------
# Etapa 7 · Exportación de Dossier Pedagógico en PDF (ReportLab)
# ---------------------------------------------------------------------------
class SolicitudExportarPDF(BaseModel):
    titulo: Optional[str] = Field(None, description="Título del documento")
    perfil: Optional[str] = Field("General", description="Perfil pedagógico del estudiante")
    nicho: Optional[str] = Field("General", description="Sector de contextualización")
    contenido: Optional[Dict[str, Any]] = Field(None, description="Contenido adaptado (resumen, flashcards, tutorial, quiz, etc.)")
    anclaje_score: Optional[float] = Field(None, description="Puntaje de fidelidad RAG auditado (0.0 a 1.0)")
    paquete: Optional[Dict[str, Any]] = Field(None, description="Paquete pedagógico completo estructurado (AdaptedContentPackage)")


@app.post("/api/v1/exportar/pdf", tags=["Exportación"])
async def exportar_pdf(solicitud: SolicitudExportarPDF) -> Response:
    """
    Compila y descarga bajo demanda el Dossier Pedagógico oficial en formato PDF (ReportLab).
    Acepta tanto {titulo, perfil, nicho, contenido, anclaje_score} como el paquete completo estructurado.
    Disponible tanto para usuarios autenticados como para invitados / modo local.
    """
    contenido = solicitud.contenido
    titulo = solicitud.titulo
    perfil = solicitud.perfil or "General"
    nicho = solicitud.nicho or "General"
    anclaje = solicitud.anclaje_score

    if solicitud.paquete:
        pkg = solicitud.paquete
        if not contenido:
            contenido = pkg.get("contenido_adaptado") or {}
        if not titulo:
            contenido_titulo = contenido.get("titulo") if isinstance(contenido, dict) else None
            titulo = contenido_titulo or pkg.get("metadatos", {}).get("titulo") or "Dossier Educativo"
        if perfil == "General":
            perfil = pkg.get("metadatos", {}).get("perfil_aplicado") or perfil
        if anclaje is None:
            anclaje = pkg.get("evaluacion_calidad", {}).get("anclaje_fuente_score")

    if not isinstance(contenido, dict):
        contenido = {}
    if not titulo:
        titulo = contenido.get("titulo", "Dossier Educativo")

    generador = GeneradorPDFEducativo()
    try:
        pdf_bytes = await asyncio.to_thread(
            generador.generar_pdf_estandarizado,
            titulo=titulo,
            perfil=perfil,
            nicho=nicho,
            contenido=contenido,
            anclaje_score=anclaje,
        )
    except Exception as exc:
        logger.exception("Error al compilar el dossier PDF: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo compilar el PDF: {exc}",
        ) from exc

    slug = _slugify(titulo)[:25] if titulo else "educativo"
    nombre_archivo = f"Dossier_{slug}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nombre_archivo}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.exception_handler(IngestionError)
def handle_ingestion_error(_, exc: IngestionError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"status": "error", "mensaje": str(exc)},
    )


@app.get("/api/v1/paquetes", tags=["Historial privado"])
def listar_paquetes(principal: Principal = Depends(require_user)) -> Dict[str, Any]:
    rows = private_query(principal, 'learning_packages', {
        'select': 'id,title,created_at', 'user_id': 'eq.' + principal.user_id,
        'parameters': 'cs.{"application":"fullstack-v2"}',
        'order': 'created_at.desc', 'limit': '50',
    })
    return {'origen': 'supabase', 'paquetes': rows}


@app.get("/api/v1/paquetes/{objeto_id:path}", tags=["Historial privado"])
def descargar_paquete(objeto_id: str, principal: Principal = Depends(require_user)) -> Dict[str, Any]:
    try:
        package_id = str(UUID(objeto_id))
    except ValueError:
        raise HTTPException(404, 'Paquete no encontrado.') from None
    rows = private_query(principal, 'learning_packages', {
        'select': 'payload', 'id': 'eq.' + package_id, 'user_id': 'eq.' + principal.user_id,
    })
    if not rows:
        raise HTTPException(404, 'Paquete no encontrado.')
    return rows[0]['payload']


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
        "nicho": "Industria y Operaciones",
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
        "nicho": "Medicina y Salud",
        "perfil": "Líder Técnico / Arquitecto",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "pdf",
        "tamano_formato": "8.4 MB (PDF Oficial)",
        "descripcion": "Informe exhaustivo de la Agencia Europea de Ciberseguridad sobre vectores de ataque, cadenas de suministro y ciberdefensa moderna.",
    },
    {
        "id": "quijote-primera-parte",
        "nombre_archivo": "quijote_primera_parte_resumen.md",
        "titulo": "Don Quijote de la Mancha · Primera Parte (1605)",
        "nicho": "Leyes y Legal",
        "perfil": "Principiante",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "markdown",
        "tamano_formato": "15 KB (Markdown)",
        "descripcion": "Resumen del argumento de la primera parte (Cervantes, dominio público); texto de Wikipedia en español, CC BY-SA 4.0.",
    },
    {
        "id": "quijote-segunda-parte",
        "nombre_archivo": "quijote_segunda_parte_resumen.md",
        "titulo": "Don Quijote de la Mancha · Segunda Parte (1615)",
        "nicho": "Marketing y Ventas",
        "perfil": "Principiante",
        "formato_sugerido": "Paquete Educativo Completo (5 Estaciones)",
        "tipo": "markdown",
        "tamano_formato": "15 KB (Markdown)",
        "descripcion": "Resumen del argumento de la segunda parte (Cervantes, dominio público); texto de Wikipedia en español, CC BY-SA 4.0.",
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


@lru_cache(maxsize=8)
def _texto_documento_ejemplo(ruta: str, _modificado: float) -> Dict[str, Any]:
    """El ENISA tarda ~8 s en extraerse: se hace una vez por versión del archivo."""
    doc = cargar_documento(ruta)
    return {"titulo": doc.titulo, "texto": doc.texto, "origen": "documento",
            "paginas": len(doc.paginas), "modelo": None, "advertencias": []}


@app.get("/api/v1/documentos/ejemplos/{nombre_archivo}/texto", tags=["Biblioteca de Documentos"])
async def obtener_texto_documento_ejemplo(nombre_archivo: str) -> Dict[str, Any]:
    """Texto extraído de un documento del catálogo, para la vista previa (misma forma que /documentos/extraer)."""
    if Path(nombre_archivo).name not in {d["nombre_archivo"] for d in CATALOGO_DOCUMENTOS}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado en la biblioteca.")
    archivo = _obtener_directorio_documentos() / Path(nombre_archivo).name
    if not archivo.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado en la biblioteca.")
    return await asyncio.to_thread(_texto_documento_ejemplo, str(archivo), archivo.stat().st_mtime)

