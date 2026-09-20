"""
Configuración centralizada de NuevaMente.

Lee las variables de entorno (y el archivo .env si existe) UNA sola vez y las
valida, para que un valor mal escrito falle al arrancar y no a mitad de una
demo.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


class ConfigError(Exception):
    """Configuración ausente o inválida."""


def _leer_float(nombre: str, defecto: float, minimo: float, maximo: float) -> float:
    bruto = os.getenv(nombre)
    if bruto is None or not bruto.strip():
        return defecto
    try:
        valor = float(bruto)
    except ValueError as error:
        raise ConfigError(f"{nombre} debe ser un número (recibido: {bruto!r}).") from error
    if not (minimo <= valor <= maximo):
        raise ConfigError(f"{nombre} debe estar entre {minimo} y {maximo} (recibido: {valor}).")
    return valor


def _leer_int(nombre: str, defecto: int, minimo: int, maximo: int) -> int:
    bruto = os.getenv(nombre)
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

    @classmethod
    def desde_entorno(cls, cargar_dotenv: bool = True) -> "Config":
        if cargar_dotenv:
            load_dotenv()

        return cls(
            cohere_api_key=os.getenv("COHERE_API_KEY") or None,
            cohere_model=os.getenv("COHERE_MODEL", "command-a-03-2025"),
            embedding_model=os.getenv("COHERE_EMBEDDING_MODEL", "embed-multilingual-v3.0"),
            chroma_path=os.getenv("AGENTE1_CHROMA_PATH", "./chroma_db"),
            collection_name=os.getenv("AGENTE1_COLLECTION_NAME", "nuevamente_documentos"),
            top_k=_leer_int("TOP_K_CHUNKS", 6, 1, 30),
            min_score_retrieval=_leer_float("MIN_SCORE_RETRIEVAL", 0.60, 0.0, 1.0),
            min_anclaje_fuente_score=_leer_float("MIN_ANCLAJE_FUENTE_SCORE", 0.75, 0.0, 1.0),
            max_redaccion_retries=_leer_int("MAX_REDACCION_RETRIES", 2, 0, 5),
            api_reintentos=_leer_int("API_REINTENTOS", 3, 1, 6),
            api_espera_base_segundos=_leer_float("API_ESPERA_BASE_SEGUNDOS", 1.0, 0.0, 30.0),
        )

    def exigir_cohere(self) -> str:
        """Devuelve la API key o falla con un mensaje claro."""
        if not self.cohere_api_key:
            raise ConfigError(
                "Falta COHERE_API_KEY. Crea un archivo .env a partir de "
                ".env.example y pega tu clave."
            )
        return self.cohere_api_key
