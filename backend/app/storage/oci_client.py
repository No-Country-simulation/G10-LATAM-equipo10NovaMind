"""
Cliente de OCI Object Storage (capa Always Free).

Persiste:
  - documentos-originales/{doc_id}.{ext}
  - contenidos-generados/{doc_id}-{perfil}-{formato}.json

Soporta dos modalidades de autenticación:
1. Archivo estándar de configuración OCI (~/.oci/config).
2. Variables de entorno directas (para entornos de despliegue nativo o CI):
   - OCI_USER, OCI_TENANCY, OCI_FINGERPRINT, OCI_KEY_FILE (o OCI_KEY_CONTENT), OCI_REGION.
"""

from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional

import oci
from oci.exceptions import ServiceError

from app.core.schemas import (
    AlmacenamientoOCI,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
)

logger = logging.getLogger("nuevamente.storage.oci")


class StorageUploadError(Exception):
    """Error al subir o leer un objeto de OCI Object Storage."""


def _slugify(texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", normalizado).strip("-").lower()


class OCIObjectStorageClient:
    def __init__(self) -> None:
        self.namespace = os.getenv("OCI_NAMESPACE", "")
        self.bucket_name = os.getenv("OCI_BUCKET_NAME", "")
        if not self.namespace or not self.bucket_name:
            raise ValueError(
                "Las variables de entorno OCI_NAMESPACE y OCI_BUCKET_NAME son obligatorias para OCI Object Storage."
            )

        config_file = os.getenv("OCI_CONFIG_FILE", os.path.expanduser("~/.oci/config"))
        profile = os.getenv("OCI_CONFIG_PROFILE", "DEFAULT")

        # Prioridad 1: Archivo de configuración existente
        if os.path.exists(config_file):
            config = oci.config.from_file(file_location=config_file, profile_name=profile)
        # Prioridad 2: Variables de entorno explícitas
        elif os.getenv("OCI_USER") and os.getenv("OCI_TENANCY"):
            key_content = os.getenv("OCI_KEY_CONTENT")
            key_file = os.getenv("OCI_KEY_FILE")
            config = {
                "user": os.getenv("OCI_USER"),
                "tenancy": os.getenv("OCI_TENANCY"),
                "fingerprint": os.getenv("OCI_FINGERPRINT"),
                "region": os.getenv("OCI_REGION", "sa-saopaulo-1"),
            }
            if key_file and os.path.exists(key_file):
                config["key_file"] = key_file
            elif key_content:
                config["key_content"] = key_content
            else:
                raise ValueError("Se requiere OCI_KEY_FILE o OCI_KEY_CONTENT para autenticación OCI sin config file.")
        else:
            raise ValueError(
                f"No se encontró archivo de configuración OCI en '{config_file}' "
                "ni variables de entorno OCI_USER / OCI_TENANCY."
            )

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

    def descargar_objeto(self, object_name: str) -> bytes:
        """Descarga el contenido binario o texto de un objeto."""
        try:
            resp = self.client.get_object(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=object_name,
            )
            return resp.data.content
        except ServiceError as exc:
            raise StorageUploadError(
                f"Error al descargar objeto '{object_name}' de OCI: {exc.message}"
            ) from exc

    def listar_contenidos_generados(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Lista los paquetes generados almacenados en el bucket."""
        try:
            resp = self.client.list_objects(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                prefix="contenidos-generados/",
                limit=limit,
                fields="name,size,timeCreated",
            )
            resultados = []
            for obj in resp.data.objects or []:
                resultados.append({
                    "nombre": obj.name,
                    "tamanio_bytes": obj.size,
                    "creado_en": str(obj.time_created) if obj.time_created else "",
                })
            return resultados
        except ServiceError as exc:
            logger.warning("Fallo al listar objetos de OCI Object Storage: %s", exc)
            return []

    def existe_bucket(self) -> bool:
        try:
            self.client.get_bucket(namespace_name=self.namespace, bucket_name=self.bucket_name)
            return True
        except ServiceError:
            return False


def almacenador_oci(
    solicitud: SolicitudAdaptacion,
    respuesta: RespuestaAdaptacion,
) -> AlmacenamientoOCI:
    """
    Función adaptadora para el orquestador LangGraph.
    Sube el documento original y el paquete generado a OCI Object Storage.
    """
    try:
        cliente = OCIObjectStorageClient()
        doc_id = (
            respuesta.orquestacion.documento_id
            or _slugify(solicitud.documento_titulo)[:12]
        )

        # 1. Guardar documento original
        if solicitud.documento_contenido:
            cliente.subir_documento_original(
                doc_id=doc_id,
                extension=".txt",
                data=solicitud.documento_contenido.encode("utf-8"),
            )

        # 2. Guardar paquete generado
        payload = {
            "solicitud": {
                "titulo": solicitud.documento_titulo,
                "perfil": solicitud.perfil_destinatario,
                "formato": solicitud.formato_salida,
                "nicho": solicitud.nicho_sector,
                "nivel": solicitud.nivel_detalle,
            },
            "metadatos": respuesta.metadatos.model_dump() if respuesta.metadatos else None,
            "contenido_adaptado": (
                respuesta.contenido_adaptado.model_dump()
                if respuesta.contenido_adaptado
                else None
            ),
            "evaluacion_calidad": (
                respuesta.evaluacion_calidad.model_dump()
                if respuesta.evaluacion_calidad
                else None
            ),
            "orquestacion": respuesta.orquestacion.model_dump(),
        }

        objeto_id = cliente.subir_contenido_generado(
            doc_id=doc_id,
            perfil=solicitud.perfil_destinatario,
            formato=solicitud.formato_salida,
            payload=payload,
        )

        logger.info("Persistencia completada en OCI Object Storage: %s", objeto_id)
        return AlmacenamientoOCI(
            bucket=cliente.bucket_name,
            objeto_id=objeto_id,
            status_upload="completado",
        )

    except Exception as exc:
        logger.warning("Fallo en persistencia hacia OCI Object Storage: %s", exc)
        return AlmacenamientoOCI(
            bucket=os.getenv("OCI_BUCKET_NAME"),
            objeto_id=None,
            status_upload="error",
        )
