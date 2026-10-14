"""
Almacén privado de la narración: WAV por escena + VideoJobSpec (el guion del video).

Misma regla que private_storage: con OCI_KEY_FILE se usa el bucket OCI (y debe ser
privado); sin él, disco local bajo data/outputs. Todo vive bajo users/{user_id}/.
Las llamadas del SDK de OCI son bloqueantes: el narrador las ejecuta en un hilo.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional, Protocol
from uuid import UUID

DIRECTORIO_LOCAL = Path(__file__).resolve().parents[3] / "data" / "outputs"


class AlmacenBinario(Protocol):
    tipo: Literal["oci", "local"]

    def leer(self, ruta: str) -> Optional[bytes]:
        """Contenido del objeto, o None si no existe."""

    def guardar(self, ruta: str, datos: bytes, mime: str) -> None: ...


def prefijo_narraciones(user_id: str) -> str:
    return f"users/{UUID(user_id)}/narraciones"


def ruta_segura(ruta: str) -> bool:
    partes = ruta.split("/")
    return bool(ruta) and not ruta.startswith("/") and "\\" not in ruta and all(p not in ("", ".", "..") for p in partes)


class AlmacenLocal:
    tipo: Literal["oci", "local"] = "local"

    def __init__(self, base: Path = DIRECTORIO_LOCAL):
        self._base = base

    def _archivo(self, ruta: str) -> Path:
        if not ruta_segura(ruta):
            raise ValueError("Ruta de objeto inválida.")
        return self._base / ruta

    def leer(self, ruta: str) -> Optional[bytes]:
        archivo = self._archivo(ruta)
        return archivo.read_bytes() if archivo.is_file() else None

    def guardar(self, ruta: str, datos: bytes, mime: str) -> None:
        archivo = self._archivo(ruta)
        archivo.parent.mkdir(parents=True, exist_ok=True)
        archivo.write_bytes(datos)


class AlmacenOCI:
    tipo: Literal["oci", "local"] = "oci"

    def __init__(self) -> None:
        from app.storage.oci_client import OCIObjectStorageClient

        self._cliente = OCIObjectStorageClient()
        bucket = self._cliente.client.get_bucket(
            namespace_name=self._cliente.namespace, bucket_name=self._cliente.bucket_name
        ).data
        if getattr(bucket, "public_access_type", None) != "NoPublicAccess":
            raise ValueError("Los audios de usuarios requieren un bucket OCI privado.")

    def leer(self, ruta: str) -> Optional[bytes]:
        from oci.exceptions import ServiceError

        if not ruta_segura(ruta):
            raise ValueError("Ruta de objeto inválida.")
        try:
            respuesta = self._cliente.client.get_object(
                namespace_name=self._cliente.namespace, bucket_name=self._cliente.bucket_name, object_name=ruta
            )
        except ServiceError as exc:
            if exc.status == 404:
                return None
            raise
        return respuesta.data.content

    def guardar(self, ruta: str, datos: bytes, mime: str) -> None:
        if not ruta_segura(ruta):
            raise ValueError("Ruta de objeto inválida.")
        self._cliente._put(ruta, datos, mime)


def almacen_del_entorno() -> AlmacenBinario:
    """OCI si se configuró explícitamente (un PEM ausente es un error, no un respaldo a disco)."""
    if os.getenv("OCI_KEY_FILE"):
        if not Path(os.environ["OCI_KEY_FILE"]).is_file():
            raise ValueError("OCI_KEY_FILE está configurado pero el archivo no existe.")
        return AlmacenOCI()
    return AlmacenLocal()
