"""
Registro del estado por recurso de la generación (tabla public.generation_tasks).

- RegistroSupabase: PostgREST con el JWT del usuario, de modo que RLS (own_rows)
  también impone la propiedad. Escrituras en lote con upsert sobre
  (user_id, content_hash, resource).
- RegistroMemoria: misma interfaz, sin red (pruebas).

El registro es de mejor esfuerzo: un fallo de Supabase se registra en el log y se
cuenta en `fallos`, pero nunca interrumpe la generación.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Protocol, Tuple

import httpx

logger = logging.getLogger("novamind.registro_tareas")

# Columnas de una fila; el lote de upsert de PostgREST exige las mismas claves en todas.
COLUMNAS = (
    "resource", "task", "content_hash", "status", "verification", "model", "attempts",
    "latency_s", "result", "result_storage_path", "error_code", "error_message", "started_at", "finished_at",
)


class RegistroTareas(Protocol):
    async def previos(self, huellas: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        """{tarea: huella} → {recurso: result} de las filas completadas con esa huella."""

    async def guardar(self, filas: List[Dict[str, Any]]) -> None:
        """Upsert de filas con las claves de COLUMNAS."""

    async def aclose(self) -> None: ...


def _completas(fila: Dict[str, Any]) -> Dict[str, Any]:
    desconocidas = set(fila) - set(COLUMNAS)
    if desconocidas:
        raise ValueError(f"Columnas desconocidas: {sorted(desconocidas)}")
    return {c: fila.get(c) for c in COLUMNAS}


def _filtrar_previos(filas: List[Dict[str, Any]], huellas: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
    return {
        f["resource"]: f["result"]
        for f in filas
        if f.get("status") == "completado"
        and isinstance(f.get("result"), dict)
        and huellas.get(f.get("task")) == f.get("content_hash")
    }


class RegistroSupabase:
    def __init__(
        self,
        url: str,
        clave_publica: str,
        token_usuario: str,
        user_id: str,
        document_id: str,
        *,
        timeout_s: float = 8.0,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self._user_id = user_id
        self._document_id = document_id
        self.fallos = 0
        self._http = httpx.AsyncClient(
            base_url=url.rstrip("/") + "/rest/v1",
            headers={"apikey": clave_publica, "Authorization": "Bearer " + token_usuario},
            timeout=timeout_s,
            transport=transport,
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def previos(self, huellas: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        if not huellas:
            return {}
        try:
            r = await self._http.get("/generation_tasks", params={
                "select": "resource,task,content_hash,status,result",
                "content_hash": f"in.({','.join(sorted(set(huellas.values())))})",
                "status": "eq.completado",
            })
            if r.status_code != 200:
                raise RuntimeError(f"HTTP {r.status_code}")
            return _filtrar_previos(r.json(), huellas)
        except (httpx.HTTPError, RuntimeError, ValueError) as exc:
            self.fallos += 1
            logger.warning("[registro] No se pudieron leer tareas previas (%s).", exc)
            return {}

    async def guardar(self, filas: List[Dict[str, Any]]) -> None:
        if not filas:
            return
        lote = [{**_completas(f), "user_id": self._user_id, "document_id": self._document_id} for f in filas]
        try:
            r = await self._http.post(
                "/generation_tasks",
                params={"on_conflict": "user_id,content_hash,resource"},
                json=lote,
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            )
            if r.status_code not in (200, 201, 204):
                raise RuntimeError(f"HTTP {r.status_code}")
        except (httpx.HTTPError, RuntimeError) as exc:
            self.fallos += 1
            logger.warning("[registro] No se pudieron guardar %d fila(s) de tareas (%s).", len(lote), exc)


class RegistroMemoria:
    def __init__(self) -> None:
        self.filas: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self.escrituras: List[List[Dict[str, Any]]] = []
        self.fallos = 0

    async def aclose(self) -> None:
        return None

    async def previos(self, huellas: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        return _filtrar_previos(list(self.filas.values()), huellas)

    async def guardar(self, filas: List[Dict[str, Any]]) -> None:
        lote = [_completas(f) for f in filas]
        self.escrituras.append(lote)
        for f in lote:
            self.filas[(f["content_hash"], f["resource"])] = f
