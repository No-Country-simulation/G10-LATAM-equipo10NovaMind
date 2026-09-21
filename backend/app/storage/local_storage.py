"""
Almacenamiento local simulado (Maqueta activa para OCI Object Storage).

Cumple con la interfaz Almacenador esperada por el orquestador LangGraph:
    Callable[[SolicitudAdaptacion, RespuestaAdaptacion], AlmacenamientoOCI]

Guarda:
    - data/outputs/documentos_originales/{doc_id}.txt
    - data/outputs/contenidos_generados/{doc_id}-{perfil}-{formato}.json

Permite probar el flujo E2E sin requerir credenciales activas de OCI,
manteniendo la arquitectura lista para activar el cliente real de OCI.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from pathlib import Path
from typing import Optional

from app.core.schemas import (
    AlmacenamientoOCI,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
)

logger = logging.getLogger("nuevamente.storage.local")


def _slugify(texto: str) -> str:
    normalizado = (
        unicodedata.normalize("NFKD", texto)
        .encode("ascii", "ignore")
        .decode()
    )
    return re.sub(r"[^a-zA-Z0-9]+", "-", normalizado).strip("-").lower()


def almacenador_local(
    solicitud: SolicitudAdaptacion,
    respuesta: RespuestaAdaptacion,
    directorio_base: str = "data/outputs",
) -> AlmacenamientoOCI:
    """
    Persiste el resultado de la adaptación en el sistema de archivos local
    simulando la estructura de buckets y objetos de OCI Object Storage.
    """
    try:
        base = Path(directorio_base)
        dir_docs = base / "documentos_originales"
        dir_generados = base / "contenidos_generados"
        dir_docs.mkdir(parents=True, exist_ok=True)
        dir_generados.mkdir(parents=True, exist_ok=True)

        doc_id = (
            respuesta.orquestacion.documento_id
            or _slugify(solicitud.documento_titulo)[:12]
        )

        # 1. Guardar documento original
        doc_original_path = dir_docs / f"{doc_id}.txt"
        if not doc_original_path.exists() and solicitud.documento_contenido:
            doc_original_path.write_text(
                solicitud.documento_contenido, encoding="utf-8"
            )

        # 2. Guardar contenido generado en JSON
        perfil_slug = _slugify(solicitud.perfil_destinatario)
        formato_slug = _slugify(solicitud.formato_salida)
        nombre_objeto = f"{doc_id}-{perfil_slug}-{formato_slug}.json"
        archivo_generado = dir_generados / nombre_objeto

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

        archivo_generado.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        logger.info(
            "Contenido persistido localmente (simulación OCI) en: %s",
            archivo_generado,
        )

        return AlmacenamientoOCI(
            bucket="local-mock-storage",
            objeto_id=f"contenidos_generados/{nombre_objeto}",
            status_upload="completado",
        )

    except Exception as exc:
        logger.warning(
            "Fallo en la persistencia local simulada de OCI: %s", exc
        )
        return AlmacenamientoOCI(
            bucket=None,
            objeto_id=None,
            status_upload="error",
        )
