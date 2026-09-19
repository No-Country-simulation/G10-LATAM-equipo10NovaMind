"""
Cliente de OCI Object Storage (capa Always Free).

Persiste:
  - documentos-originales/{doc_id}.{ext}
  - contenidos-generados/{doc_id}-{perfil}-{formato}.json

Requiere credenciales vía archivo de config estándar de OCI
(~/.oci/config), montado como volumen de solo lectura en el contenedor.
Nunca se hardcodean credenciales en el código ni en la imagen.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata

import oci
from oci.exceptions import ServiceError


class StorageUploadError(Exception):
    """Error al subir o leer un objeto de OCI Object Storage."""


def _slugify(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", normalizado).strip("-").lower()


class OCIObjectStorageClient:
    def __init__(self) -> None:
        config_file = os.getenv("OCI_CONFIG_FILE", "~/.oci/config")
        profile = os.getenv("OCI_CONFIG_PROFILE", "DEFAULT")

        self.namespace = os.environ["OCI_NAMESPACE"]
        self.bucket_name = os.environ["OCI_BUCKET_NAME"]

        config = oci.config.from_file(file_location=config_file, profile_name=profile)
        self.client = oci.object_storage.ObjectStorageClient(config)

    def _put(self, object_name: str, data: bytes, content_type: str) -> None:
        try:
            self.client.put_object(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=object_name,
                put_object_body=data,
                content_type=content_type,
            )
        except ServiceError as exc:
            raise StorageUploadError(
                f"Fallo al subir '{object_name}' a OCI Object Storage: {exc.message}"
            ) from exc

    def subir_documento_original(self, doc_id: str, extension: str, data: bytes) -> str:
        object_name = f"documentos-originales/{doc_id}{extension}"
        self._put(object_name, data, content_type="application/octet-stream")
        return object_name

    def subir_contenido_generado(
        self, doc_id: str, perfil: str, formato: str, payload: dict
    ) -> str:
        nombre = f"{doc_id}-{_slugify(perfil)}-{_slugify(formato)}.json"
        object_name = f"contenidos-generados/{nombre}"
        data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self._put(object_name, data, content_type="application/json")
        return object_name

    def existe_bucket(self) -> bool:
        try:
            self.client.get_bucket(namespace_name=self.namespace, bucket_name=self.bucket_name)
            return True
        except ServiceError:
            return False
