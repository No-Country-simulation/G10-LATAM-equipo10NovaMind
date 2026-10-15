"""
Sincronización de Supabase → Oracle Autonomous Database (espejo de solo lectura).

- Supabase sigue siendo la base principal: la app nunca lee ni escribe en Oracle.
- Copia incremental por tabla: filas con (updated_at, clave) mayor que la marca guardada
  en ESPEJO_MARCAS, paginadas por keyset (no por offset, que salta filas si cambian a mitad).
- Reconciliación opcional: borra del espejo las filas que ya no existen en Supabase
  (p. ej. una cuenta eliminada). Se niega a borrar en masa si la fuente parece vacía.
- Cada tabla es independiente: si una falla, las demás se copian igual y el error
  queda en ESPEJO_MARCAS.ULTIMO_ERROR.
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Protocol, Sequence, Set, Tuple

import httpx

from app.espejo.tablas import TABLAS, Tabla

logger = logging.getLogger("nuevamente.espejo")

Clave = Tuple[str, ...]
# (updated_at tal cual lo devuelve PostgREST, *clave primaria)
Marca = Tuple[str, ...]


# --- Fuente: PostgREST con la clave de servicio --------------------------------------
def validar_clave_servicio(clave: str) -> None:
    """Con la clave pública, RLS devuelve listas vacías sin error y la reconciliación vaciaría el espejo."""
    if clave.startswith("sb_secret_"):
        return
    try:
        cuerpo = clave.split(".")[1]
        rol = json.loads(base64.urlsafe_b64decode(cuerpo + "=" * (-len(cuerpo) % 4))).get("role")
    except (IndexError, ValueError):
        rol = None
    if rol != "service_role":
        raise ValueError(
            "SUPABASE_SERVICE_ROLE_KEY debe ser la clave secreta (sb_secret_… o JWT service_role), "
            "no la publishable/anon."
        )


def _literal(valor: Any) -> str:
    return '"' + str(valor).replace("\\", "\\\\").replace('"', '\\"') + '"'


def filtro_keyset(campos: Sequence[str], valores: Sequence[Any]) -> str:
    """(c1 > v1) OR (c1 = v1 AND c2 > v2) OR … en la sintaxis `or=(…)` de PostgREST."""
    partes = []
    for i, campo in enumerate(campos):
        condiciones = [f"{c}.eq.{_literal(v)}" for c, v in zip(campos[:i], valores[:i])]
        condiciones.append(f"{campo}.gt.{_literal(valores[i])}")
        partes.append(condiciones[0] if len(condiciones) == 1 else f"and({','.join(condiciones)})")
    return f"({','.join(partes)})"


class Fuente(Protocol):
    def cambios(self, tabla: Tabla, despues: Optional[Marca], limite: int) -> List[Dict[str, Any]]: ...

    def claves(self, tabla: Tabla, despues: Optional[Clave], limite: int) -> List[Clave]: ...


class FuenteSupabase:
    def __init__(
        self,
        url: str,
        clave_servicio: str,
        *,
        timeout_s: float = 30.0,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        validar_clave_servicio(clave_servicio)
        cabeceras = {"apikey": clave_servicio}
        if not clave_servicio.startswith("sb_secret_"):
            cabeceras["Authorization"] = "Bearer " + clave_servicio  # las claves JWT antiguas van también aquí
        self._http = httpx.Client(
            base_url=url.rstrip("/") + "/rest/v1",
            headers=cabeceras,
            timeout=timeout_s,
            transport=transport,
            trust_env=False,
        )

    def close(self) -> None:
        self._http.close()

    def _get(self, tabla: Tabla, params: Dict[str, str]) -> List[Dict[str, Any]]:
        r = self._http.get("/" + tabla.nombre, params=params)
        if r.status_code != 200:
            raise RuntimeError(f"Supabase respondió HTTP {r.status_code} al leer {tabla.nombre}.")
        return r.json()

    def cambios(self, tabla: Tabla, despues: Optional[Marca], limite: int) -> List[Dict[str, Any]]:
        campos = ("updated_at", *tabla.claves)
        params = {
            "select": ",".join(tabla.nombres),
            "order": ",".join(f"{c}.asc" for c in campos),
            "limit": str(limite),
        }
        if despues:
            params["or"] = filtro_keyset(campos, despues)
        return self._get(tabla, params)

    def claves(self, tabla: Tabla, despues: Optional[Clave], limite: int) -> List[Clave]:
        params = {
            "select": ",".join(tabla.claves),
            "order": ",".join(f"{c}.asc" for c in tabla.claves),
            "limit": str(limite),
        }
        if despues:
            params["or"] = filtro_keyset(tabla.claves, despues)
        return [tuple(str(f[c]) for c in tabla.claves) for f in self._get(tabla, params)]


# --- Destino: Oracle (python-oracledb en modo thin) ------------------------------------
def a_utc(valor: str) -> datetime:
    """timestamptz de PostgREST → TIMESTAMP de Oracle sin zona, siempre en UTC."""
    fecha = datetime.fromisoformat(valor.replace("Z", "+00:00"))
    if fecha.tzinfo is not None:
        fecha = fecha.astimezone(timezone.utc).replace(tzinfo=None)
    return fecha


def convertir(tabla: Tabla, fila: Dict[str, Any]) -> List[Any]:
    valores = []
    for c in tabla.columnas:
        v = fila.get(c.nombre)
        if v is None:
            valores.append(None)
        elif c.tipo == "json":
            valores.append(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
        elif c.tipo == "fecha":
            valores.append(a_utc(v))
        elif c.tipo == "numero":
            valores.append(v)
        else:
            valores.append(str(v))
    return valores


def sql_merge(tabla: Tabla) -> str:
    claves = set(tabla.claves)
    destino = {c.nombre: c.destino for c in tabla.columnas}
    origen = ", ".join(f":{i} AS {c.destino}" for i, c in enumerate(tabla.columnas, 1))
    union = " AND ".join(f"d.{destino[k]} = s.{destino[k]}" for k in tabla.claves)
    cambios = ", ".join(f"d.{c.destino} = s.{c.destino}" for c in tabla.columnas if c.nombre not in claves)
    columnas = ", ".join(c.destino for c in tabla.columnas)
    valores = ", ".join(f"s.{c.destino}" for c in tabla.columnas)
    ahora = "SYS_EXTRACT_UTC(SYSTIMESTAMP)"
    return (
        f"MERGE INTO {tabla.nombre} d USING (SELECT {origen} FROM dual) s ON ({union}) "
        f"WHEN MATCHED THEN UPDATE SET {cambios}, d.espejado_en = {ahora} "
        f"WHEN NOT MATCHED THEN INSERT ({columnas}, espejado_en) VALUES ({valores}, {ahora})"
    )


_SQL_MARCA = (
    "MERGE INTO espejo_marcas m USING (SELECT :tabla AS tabla FROM dual) s ON (m.tabla = s.tabla) "
    "WHEN MATCHED THEN UPDATE SET m.marca_updated_at = :fecha, m.marca_clave = :clave, "
    "m.filas_copiadas = m.filas_copiadas + :n "
    "WHEN NOT MATCHED THEN INSERT (tabla, marca_updated_at, marca_clave, filas_copiadas) "
    "VALUES (:tabla, :fecha, :clave, :n)"
)
_SQL_REGISTRO = (
    "MERGE INTO espejo_marcas m USING (SELECT :tabla AS tabla FROM dual) s ON (m.tabla = s.tabla) "
    "WHEN MATCHED THEN UPDATE SET m.ultima_ejecucion = SYS_EXTRACT_UTC(SYSTIMESTAMP), m.ultimo_error = :error "
    "WHEN NOT MATCHED THEN INSERT (tabla, filas_copiadas, ultima_ejecucion, ultimo_error) "
    "VALUES (:tabla, 0, SYS_EXTRACT_UTC(SYSTIMESTAMP), :error)"
)


class Destino(Protocol):
    def marca(self, tabla: Tabla) -> Optional[Marca]: ...

    def guardar(self, tabla: Tabla, filas: List[Dict[str, Any]], marca: Marca) -> None: ...

    def claves(self, tabla: Tabla) -> Set[Clave]: ...

    def borrar(self, tabla: Tabla, claves: Iterable[Clave]) -> None: ...

    def registrar(self, tabla: Tabla, error: Optional[str]) -> None: ...


class DestinoOracle:
    def __init__(self, conexion: Any) -> None:
        self._cx = conexion

    def marca(self, tabla: Tabla) -> Optional[Marca]:
        with self._cx.cursor() as cur:
            cur.execute(
                "SELECT marca_updated_at, marca_clave FROM espejo_marcas WHERE tabla = :tabla",
                tabla=tabla.nombre,
            )
            fila = cur.fetchone()
        if not fila or fila[0] is None:
            return None
        return (fila[0], *json.loads(fila[1]))

    def guardar(self, tabla: Tabla, filas: List[Dict[str, Any]], marca: Marca) -> None:
        import oracledb

        tipos = {
            "texto": oracledb.DB_TYPE_VARCHAR, "clob": oracledb.DB_TYPE_CLOB, "json": oracledb.DB_TYPE_CLOB,
            "numero": oracledb.DB_TYPE_NUMBER, "fecha": oracledb.DB_TYPE_TIMESTAMP,
        }
        with self._cx.cursor() as cur:
            cur.setinputsizes(*(tipos[c.tipo] for c in tabla.columnas))
            cur.executemany(sql_merge(tabla), [convertir(tabla, f) for f in filas])
        with self._cx.cursor() as cur:
            # La marca avanza en la misma transacción que las filas: un corte no deja huecos.
            cur.execute(_SQL_MARCA, tabla=tabla.nombre, fecha=marca[0], clave=json.dumps(list(marca[1:])), n=len(filas))
        self._cx.commit()

    def claves(self, tabla: Tabla) -> Set[Clave]:
        columnas = ", ".join(tabla.columna(k).destino for k in tabla.claves)
        with self._cx.cursor() as cur:
            cur.execute(f"SELECT {columnas} FROM {tabla.nombre}")
            return {tuple(fila) for fila in cur}

    def borrar(self, tabla: Tabla, claves: Iterable[Clave]) -> None:
        condicion = " AND ".join(f"{tabla.columna(k).destino} = :{i}" for i, k in enumerate(tabla.claves, 1))
        with self._cx.cursor() as cur:
            cur.executemany(f"DELETE FROM {tabla.nombre} WHERE {condicion}", [list(c) for c in claves])
        self._cx.commit()

    def registrar(self, tabla: Tabla, error: Optional[str]) -> None:
        with self._cx.cursor() as cur:
            cur.execute(_SQL_REGISTRO, tabla=tabla.nombre, error=error)
        self._cx.commit()


# --- Orquestación ----------------------------------------------------------------------
@dataclass
class Resultado:
    tabla: str
    copiadas: int = 0
    borradas: int = 0
    error: str = ""


class Sincronizador:
    def __init__(
        self,
        fuente: Fuente,
        destino: Destino,
        *,
        lote: int = 500,
        tablas: Sequence[Tabla] = TABLAS,
        max_borrado: float = 0.5,
    ) -> None:
        self.fuente = fuente
        self.destino = destino
        self.lote = lote
        self.tablas = tablas
        self.max_borrado = max_borrado

    def ejecutar(self, reconciliar: bool = False, forzar_borrado: bool = False) -> List[Resultado]:
        resultados = []
        for tabla in self.tablas:
            res = Resultado(tabla.nombre)
            try:
                res.copiadas = self._copiar(tabla)
                if reconciliar:
                    res.borradas = self._reconciliar(tabla, forzar_borrado)
            except Exception as exc:  # una tabla rota no detiene las demás
                res.error = f"{type(exc).__name__}: {exc}"[:500]
                logger.error("[espejo] %s: %s", tabla.nombre, res.error)
            try:
                self.destino.registrar(tabla, res.error or None)
            except Exception as exc:
                logger.error("[espejo] %s: no se pudo registrar la ejecución (%s).", tabla.nombre, exc)
            resultados.append(res)
        return resultados

    def _copiar(self, tabla: Tabla) -> int:
        marca = self.destino.marca(tabla)
        total = 0
        while True:
            filas = self.fuente.cambios(tabla, marca, self.lote)
            if not filas:
                return total
            ultima = filas[-1]
            marca = (ultima["updated_at"], *(str(ultima[k]) for k in tabla.claves))
            self.destino.guardar(tabla, filas, marca)
            total += len(filas)
            if len(filas) < self.lote:
                return total

    def _reconciliar(self, tabla: Tabla, forzar: bool) -> int:
        en_fuente: Set[Clave] = set()
        despues: Optional[Clave] = None
        while True:
            claves = self.fuente.claves(tabla, despues, self.lote)
            en_fuente.update(claves)
            if len(claves) < self.lote:
                break
            despues = claves[-1]
        en_espejo = self.destino.claves(tabla)
        sobran = en_espejo - en_fuente
        if not sobran:
            return 0
        if not forzar and len(sobran) > max(10, self.max_borrado * len(en_espejo)):
            raise RuntimeError(
                f"Se borrarían {len(sobran)} de {len(en_espejo)} filas del espejo. "
                "Revisa la clave de Supabase o repite con --forzar-borrado."
            )
        self.destino.borrar(tabla, sobran)
        return len(sobran)


def conectar_oracle(usuario: str, clave: str, dsn: str, wallet_dir: str = "", wallet_clave: str = "") -> Any:
    import oracledb

    opciones: Dict[str, Any] = {"user": usuario, "password": clave, "dsn": dsn}
    if wallet_dir:  # mTLS con el wallet de la base; sin wallet, TLS de una vía (requiere ACL en la ADB)
        opciones.update(config_dir=wallet_dir, wallet_location=wallet_dir, wallet_password=wallet_clave or None)
    return oracledb.connect(**opciones)
