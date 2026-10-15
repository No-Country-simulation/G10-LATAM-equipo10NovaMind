"""
Tablas que se copian de Supabase (public.*) al espejo de Oracle.

Fuente de verdad del esquema: supabase/migrations/. El DDL de Oracle vive en
oracle/espejo/001_espejo_supabase.sql. test_espejo_oracle comprueba que los tres coinciden.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Tuple

# texto: VARCHAR2 · clob: CLOB · json: CLOB con IS JSON · numero: NUMBER · fecha: TIMESTAMP en UTC
TIPOS = ("texto", "clob", "json", "numero", "fecha")


@dataclass(frozen=True)
class Columna:
    nombre: str
    tipo: str
    oracle: str = ""  # nombre en Oracle cuando el de Supabase es palabra reservada

    @property
    def destino(self) -> str:
        return self.oracle or self.nombre


@dataclass(frozen=True)
class Tabla:
    nombre: str
    claves: Tuple[str, ...]
    columnas: Tuple[Columna, ...]

    @property
    def nombres(self) -> Tuple[str, ...]:
        return tuple(c.nombre for c in self.columnas)

    def columna(self, nombre: str) -> Columna:
        return next(c for c in self.columnas if c.nombre == nombre)


def _c(nombre: str, tipo: str = "texto", oracle: str = "") -> Columna:
    assert tipo in TIPOS, tipo
    return Columna(nombre, tipo, oracle)


_FECHAS = (_c("created_at", "fecha"), _c("updated_at", "fecha"))

TABLAS: Tuple[Tabla, ...] = (
    Tabla("profiles", ("id",), (
        _c("id"), _c("display_name"), _c("avatar_url"), *_FECHAS,
    )),
    Tabla("documents", ("id",), (
        _c("id"), _c("user_id"), _c("title"), _c("original_filename"), _c("mime_type"),
        _c("source_text", "clob"), _c("storage_provider"), _c("storage_path"),
        _c("size_bytes", "numero"), _c("content_hash"), *_FECHAS,
    )),
    Tabla("learning_packages", ("id",), (
        _c("id"), _c("user_id"), _c("document_id"), _c("title"), _c("parameters", "json"),
        _c("payload", "json"), _c("storage_provider"), _c("storage_path"), *_FECHAS,
    )),
    Tabla("learning_progress", ("user_id", "package_id"), (
        _c("user_id"), _c("package_id"), _c("current_step", "numero"),
        _c("active_station_index", "numero"), _c("completed_stations", "json"),
        _c("quiz_answers", "json"), _c("cognitive_shields", "numero"), *_FECHAS,
    )),
    Tabla("user_state", ("user_id",), (
        _c("user_id"), _c("xp", "numero"), _c("streak_days", "numero"),
        _c("last_activity_at", "fecha"), _c("achievements", "json"), _c("preferences", "json"), *_FECHAS,
    )),
    Tabla("generation_tasks", ("id",), (
        _c("id"), _c("user_id"), _c("document_id"), _c("resource", oracle="resource_name"),
        _c("task"), _c("content_hash"), _c("status"), _c("verification"), _c("model"),
        _c("attempts", "numero"), _c("latency_s", "numero"), _c("result", "json"),
        _c("result_storage_path"), _c("error_code"), _c("error_message"),
        _c("started_at", "fecha"), _c("finished_at", "fecha"), *_FECHAS,
    )),
)

POR_NOMBRE = {t.nombre: t for t in TABLAS}
