"""
Cliente HTTP del frontend hacia la API REST del backend — NuevaMente.
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Totalmente desacoplado de la lógica de agentes, bases vectoriales o SDKs pesados.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional, Tuple

import requests

logger = logging.getLogger("nuevamente.frontend.client")

# Soporta BACKEND_API_URL (convención OCI / VM separada) o BACKEND_URL (convención local / Docker)
DEFAULT_BACKEND_URL = os.getenv("BACKEND_API_URL") or os.getenv("BACKEND_URL") or "http://localhost:8000"


# Opciones por defecto como fallback si el backend aún está iniciando
OPCIONES_FALLBACK: Dict[str, list[str]] = {
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


class BackendAPIClient:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or DEFAULT_BACKEND_URL).rstrip("/")

    def verificar_salud(self) -> Tuple[bool, str]:
        """Comprueba conectividad con el endpoint /health."""
        try:
            resp = requests.get(f"{self.base_url}/health", timeout=4)
            if resp.status_code == 200:
                return True, "Conectado al Backend"
            return False, f"Backend respondió con código {resp.status_code}"
        except Exception as exc:
            return False, f"No se pudo conectar al backend ({exc})"

    def obtener_opciones(self) -> Dict[str, list[str]]:
        """
        Obtiene las opciones canónicas desde el backend para garantizar sincronía de Enums.
        Retorna fallback si no está disponible.
        """
        try:
            resp = requests.get(f"{self.base_url}/api/v1/config/opciones", timeout=3)
            if resp.status_code == 200:
                return resp.json()
        except Exception as exc:
            logger.warning("Fallo al obtener opciones dinámicas, usando fallback: %s", exc)
        return OPCIONES_FALLBACK

    def adaptar_contenido(
        self,
        archivo_bytes: Optional[bytes] = None,
        nombre_archivo: Optional[str] = None,
        texto_directo: Optional[str] = None,
        titulo: Optional[str] = None,
        perfil: str = "",
        formato: str = "",
        nicho: str = "General",
        nivel: str = "Didáctico",
        tema_consulta: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Envía la petición a /api/v1/adaptar.
        Usa timeout de 180s para permitir que el ciclo de agentes y reintentos concluya con calma.
        """
        data = {
            "perfil_destinatario": perfil,
            "formato_salida": formato,
            "nicho_sector": nicho,
            "nivel_detalle": nivel,
        }
        if titulo:
            data["titulo"] = titulo
        if texto_directo:
            data["texto_directo"] = texto_directo
        if tema_consulta:
            data["tema_consulta"] = tema_consulta

        files = None
        if archivo_bytes and nombre_archivo:
            files = {"archivo": (nombre_archivo, archivo_bytes)}

        url = f"{self.base_url}/api/v1/adaptar"
        try:
            resp = requests.post(url, data=data, files=files, timeout=180)
            if resp.status_code == 200:
                return resp.json()

            # Error controlado del backend
            try:
                error_body = resp.json()
                mensaje = error_body.get("detail") or error_body.get("mensaje") or str(error_body)
            except Exception:
                mensaje = resp.text
            return {"status": "error", "error": {"mensaje_amigable": f"Error del servidor ({resp.status_code}): {mensaje}"}}

        except requests.exceptions.Timeout:
            return {
                "status": "error",
                "error": {
                    "mensaje_amigable": "Tiempo de espera agotado (Timeout de 180s). El documento es muy extenso o los agentes tardaron demasiado.",
                },
            }
        except requests.exceptions.ConnectionError:
            return {
                "status": "error",
                "error": {
                    "mensaje_amigable": f"No se pudo establecer conexión con el backend en {self.base_url}.",
                },
            }
        except Exception as exc:
            return {
                "status": "error",
                "error": {"mensaje_amigable": f"Error inesperado al contactar al backend: {exc}"},
            }

    def listar_paquetes(self) -> Dict[str, Any]:
        """Consulta los paquetes generados en el backend (guardados en OCI Object Storage o local)."""
        try:
            resp = requests.get(f"{self.base_url}/api/v1/paquetes", timeout=5)
            if resp.status_code == 200:
                return resp.json()
            return {"origen": "error", "paquetes": []}
        except Exception as exc:
            logger.warning("Fallo al listar paquetes desde backend: %s", exc)
            return {"origen": "desconectado", "paquetes": []}

    def descargar_paquete(self, nombre_objeto: str) -> Optional[Dict[str, Any]]:
        """Descarga el contenido JSON de un paquete desde el backend."""
        try:
            resp = requests.get(f"{self.base_url}/api/v1/paquetes/{nombre_objeto}", timeout=10)
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as exc:
            logger.warning("Fallo al descargar paquete '%s': %s", nombre_objeto, exc)
            return None
