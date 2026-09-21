"""
Cliente HTTP del backend de NuevaMente.

============================================================================
 ESTA ES LA ÚNICA FRONTERA DE COMUNICACIÓN CON EL BACKEND
============================================================================
Todo el frontend habla con el servicio backend exclusivamente a través de
las dos funciones públicas de este módulo. Ningún otro archivo del
frontend debe usar `requests`/`httpx` directamente, ni conocer la URL del
backend, ni el shape exacto de sus endpoints.

    ENTRADA (Frontend -> Backend) -> generar_contenido_adaptado(...)
        Arma el multipart/form-data y hace POST /adaptar

    SALIDA  (Backend -> Frontend) -> el dict JSON que ese POST devuelve
        (ya deserializado por `requests`, listo para que Streamlit lo lea
        con .get(...) sin depender de ninguna clase Pydantic del backend)
============================================================================
"""

from __future__ import annotations

import os

import requests

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000").rstrip("/")
TIMEOUT_SEGUNDOS = int(os.getenv("BACKEND_TIMEOUT_SEGUNDOS", "120"))


class BackendNoDisponibleError(Exception):
    """El backend no respondió o respondió con un error de red."""


class BackendRespuestaError(Exception):
    """El backend respondió, pero con un código de error HTTP (4xx/5xx)."""

    def __init__(self, status_code: int, detalle: str) -> None:
        self.status_code = status_code
        self.detalle = detalle
        super().__init__(f"[{status_code}] {detalle}")


def backend_disponible() -> bool:
    """
    GET /health — usado por la UI para mostrar un indicador de conexión
    antes de dejar que el usuario suba un archivo.
    """
    try:
        resp = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return resp.ok
    except requests.RequestException:
        return False


# ============================================================================
# PUNTO DE ENTRADA (Frontend -> Backend)
# ============================================================================
def generar_contenido_adaptado(
    *,
    archivo_bytes: bytes,
    nombre_archivo: str,
    perfil_destinatario: str,
    formato_salida: str,
    nicho_sector: str,
    nivel_detalle: str,
) -> dict:
    """
    POST /adaptar al backend, como multipart/form-data.

    Parámetros: exactamente los valores tomados de los widgets de
    Streamlit (ver `streamlit_app.py`), sin transformación de negocio
    alguna — esa lógica vive del otro lado de la red, en el backend.

    Devuelve el JSON de respuesta ya parseado (dict). Lanza
    `BackendRespuestaError` si el backend devolvió un error HTTP, o
    `BackendNoDisponibleError` si no se pudo establecer conexión.
    """
    files = {"archivo": (nombre_archivo, archivo_bytes)}
    data = {
        "perfil_destinatario": perfil_destinatario,
        "formato_salida": formato_salida,
        "nicho_sector": nicho_sector,
        "nivel_detalle": nivel_detalle,
    }

    try:
        resp = requests.post(
            f"{BACKEND_URL}/adaptar",
            files=files,
            data=data,
            timeout=TIMEOUT_SEGUNDOS,
        )
    except requests.RequestException as exc:
        raise BackendNoDisponibleError(
            f"No se pudo conectar al backend en {BACKEND_URL}: {exc}"
        ) from exc

    if not resp.ok:
        detalle = _extraer_detalle_error(resp)
        raise BackendRespuestaError(resp.status_code, detalle)

    # ========================================================================
    # PUNTO DE SALIDA (Backend -> Frontend)
    # ========================================================================
    # `resp.json()` es el único dato que cruza de vuelta hacia la UI. A
    # partir de acá es un dict plano; Streamlit lo renderiza con .get(...),
    # sin ningún import de clases del backend.
    # ========================================================================
    return resp.json()


def _extraer_detalle_error(resp: requests.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except ValueError:
        return resp.text
