"""
Configuración centralizada de NuevaMente.

Lee las variables de entorno (y el archivo .env si existe) UNA sola vez y las
valida, para que un valor mal escrito falle al arrancar y no a mitad de una
demo.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if (_ROOT_DIR / ".env").exists():
    load_dotenv(_ROOT_DIR / ".env")
load_dotenv()


class ConfigError(Exception):
    """Configuración ausente o inválida."""


def _leer_float(
    nombre: str,
    defecto: float,
    minimo: float,
    maximo: float,
    nombre_alternativo: Optional[str] = None,
) -> float:
    bruto = os.getenv(nombre)
    if (bruto is None or not bruto.strip()) and nombre_alternativo:
        bruto = os.getenv(nombre_alternativo)
    if bruto is None or not bruto.strip():
        return defecto
    try:
        valor = float(bruto)
    except ValueError as error:
        raise ConfigError(f"{nombre} debe ser un número (recibido: {bruto!r}).") from error
    if not (minimo <= valor <= maximo):
        raise ConfigError(f"{nombre} debe estar entre {minimo} y {maximo} (recibido: {valor}).")
    return valor


def _leer_int(
    nombre: str,
    defecto: int,
    minimo: int,
    maximo: int,
    nombre_alternativo: Optional[str] = None,
) -> int:
    bruto = os.getenv(nombre)
    if (bruto is None or not bruto.strip()) and nombre_alternativo:
        bruto = os.getenv(nombre_alternativo)
    if bruto is None or not bruto.strip():
        return defecto
    try:
        valor = int(bruto)
    except ValueError as error:
        raise ConfigError(f"{nombre} debe ser un entero (recibido: {bruto!r}).") from error
    if not (minimo <= valor <= maximo):
        raise ConfigError(f"{nombre} debe estar entre {minimo} y {maximo} (recibido: {valor}).")
    return valor


@dataclass(frozen=True)
class Config:
    # --- Cohere ---
    cohere_api_key: Optional[str]
    cohere_model: str
    embedding_model: str

    # --- Agente 1 (RAG) ---
    chroma_path: str
    collection_name: str
    top_k: int
    min_score_retrieval: float

    # --- Orquestación ---
    min_anclaje_fuente_score: float
    max_redaccion_retries: int
    api_reintentos: int
    api_espera_base_segundos: float

    # --- Multi-Proveedor & Resiliencia (Fase 9) ---
    cohere_model_critico: str = "command-r-08-2024"
    proveedor_critico: str = "gemini"
    modelo_critico: str = "gemini-2.5-flash"
    proveedor_critico_fallback: str = "groq"
    modelo_critico_fallback: str = "qwen/qwen3.8-27b"
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    presupuesto_tiempo_segundos: float = 75.0
    timeout_llamada_llm: float = 25.0
    entorno: str = "dev"

    # --- Generación paralela con Gemini (modo "paralelo") ---
    # Verificados contra GET /v1beta/models el 2026-10-12. Cambiar de modelo = cambiar el .env.
    gemini_summary_model: str = "gemini-3.5-flash-lite"
    gemini_resources_model: str = "gemini-3.5-flash-lite"
    # Respaldo si el principal no responde (429, 5xx, timeout). Medido con el ENISA (76k tokens)
    # el 2026-10-13: los principales dieron 503 "high demand"; 3.1-flash-lite entregó el JSON de
    # las tres tareas en 8-10 s. gemini-2.5-flash NO sirve: en /interactions ignora el esquema
    # y responde en markdown. Vacío en el .env = sin respaldo.
    gemini_summary_fallback_model: Optional[str] = "gemini-3.1-flash-lite"
    gemini_resources_fallback_model: Optional[str] = "gemini-3.1-flash-lite"
    gemini_tts_model: str = "gemini-3.8-flash-lite-tts"
    # Transcripción de imágenes y PDF escaneados (POST /api/v1/documentos/extraer). Medido el
    # 2026-10-13: 3.1-flash-lite transcribe literal una página escaneada en ~3 s (~1.100 tokens).
    # Respaldo: 3.8-flash y 3.7-flash agotaron la cuota (429); 3.5-flash-lite respondió tras 503.
    gemini_transcription_model: str = "gemini-3.1-flash-lite"
    gemini_transcription_fallback_model: Optional[str] = "gemini-3.5-flash-lite"

    # --- Voz del video narrado: ElevenLabs principal, Gemini TTS respaldo ---
    # Verificado el 2026-10-13: flash_v2_5 cuesta 0,5 créditos/carácter y habla español.
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_tts_model: str = "eleven_flash_v2_5"
    elevenlabs_voice_id: str = "Xb7hH8MSUJpSbSDYk0k2"  # Alice: "Clear, Engaging Educator"
    elevenlabs_voice_name: str = "Alice"

    @classmethod
    def desde_entorno(cls, cargar_dotenv: bool = True) -> "Config":
        if cargar_dotenv:
            load_dotenv()

        return cls(
            cohere_api_key=os.getenv("COHERE_API_KEY") or None,
            cohere_model=os.getenv("COHERE_MODEL", "command-r-08-2024"),
            embedding_model=(
                os.getenv("COHERE_EMBEDDING_MODEL")
                or os.getenv("EMBEDDING_MODEL")
                or "embed-multilingual-v3.0"
            ),
            chroma_path=(
                os.getenv("AGENTE1_CHROMA_PATH")
                or os.getenv("CHROMA_PATH")
                or "./chroma_db"
            ),
            collection_name=(
                os.getenv("AGENTE1_COLLECTION_NAME")
                or os.getenv("CHROMA_COLLECTION_NAME")
                or "nuevamente_documentos"
            ),
            top_k=_leer_int("TOP_K_CHUNKS", 6, 1, 30, nombre_alternativo="TOP_K"),
            min_score_retrieval=_leer_float("MIN_SCORE_RETRIEVAL", 0.60, 0.0, 1.0),
            min_anclaje_fuente_score=_leer_float("MIN_ANCLAJE_FUENTE_SCORE", 0.75, 0.0, 1.0),
            max_redaccion_retries=_leer_int("MAX_REDACCION_RETRIES", 2, 0, 5),
            api_reintentos=_leer_int("API_REINTENTOS", 3, 1, 6),
            api_espera_base_segundos=_leer_float("API_ESPERA_BASE_SEGUNDOS", 1.0, 0.0, 30.0),
            cohere_model_critico=os.getenv("COHERE_MODEL_CRITICO", "command-r-08-2024"),
            proveedor_critico=os.getenv("PROVEEDOR_CRITICO", "gemini").lower(),
            modelo_critico=os.getenv("MODELO_CRITICO", "gemini-2.5-flash"),
            proveedor_critico_fallback=os.getenv("PROVEEDOR_CRITICO_FALLBACK", "groq").lower(),
            modelo_critico_fallback=os.getenv("MODELO_CRITICO_FALLBACK", "qwen/qwen3.8-27b"),
            gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
            groq_api_key=os.getenv("GROQ_API_KEY") or None,
            presupuesto_tiempo_segundos=_leer_float("PRESUPUESTO_TIEMPO_SEGUNDOS", 180.0, 10.0, 300.0),
            timeout_llamada_llm=_leer_float("TIMEOUT_LLAMADA_LLM", 45.0, 5.0, 120.0),
            entorno=os.getenv("APP_ENV", "dev").lower(),
            gemini_summary_model=os.getenv("GEMINI_SUMMARY_MODEL") or "gemini-3.5-flash-lite",
            gemini_resources_model=os.getenv("GEMINI_RESOURCES_MODEL") or "gemini-3.5-flash-lite",
            gemini_summary_fallback_model=os.getenv("GEMINI_SUMMARY_FALLBACK_MODEL", "gemini-3.1-flash-lite") or None,
            gemini_resources_fallback_model=os.getenv("GEMINI_RESOURCES_FALLBACK_MODEL", "gemini-3.1-flash-lite") or None,
            gemini_tts_model=os.getenv("GEMINI_TTS_MODEL") or "gemini-3.8-flash-lite-tts",
            gemini_transcription_model=os.getenv("GEMINI_TRANSCRIPTION_MODEL") or "gemini-3.1-flash-lite",
            gemini_transcription_fallback_model=os.getenv("GEMINI_TRANSCRIPTION_FALLBACK_MODEL", "gemini-3.5-flash-lite") or None,
            elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY") or None,
            elevenlabs_tts_model=os.getenv("ELEVENLABS_TTS_MODEL") or "eleven_flash_v2_5",
            elevenlabs_voice_id=os.getenv("ELEVENLABS_VOICE_ID") or "Xb7hH8MSUJpSbSDYk0k2",
            elevenlabs_voice_name=os.getenv("ELEVENLABS_VOICE_NAME") or "Alice",
        )

    def exigir_cohere(self) -> str:
        """Devuelve la API key o falla con un mensaje claro."""
        if not self.cohere_api_key:
            raise ConfigError(
                "Falta COHERE_API_KEY. Crea un archivo .env a partir de "
                ".env.example y pega tu clave."
            )
        return self.cohere_api_key
