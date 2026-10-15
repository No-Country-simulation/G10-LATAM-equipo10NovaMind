"""
Espejo Supabase → Oracle: sin red ni Oracle. Supabase con MockTransport y destino en memoria.
"""

import base64
import json
import re
from datetime import datetime
from pathlib import Path

import httpx
import pytest

from app.espejo.__main__ import main
from app.espejo.sincronizador import (
    FuenteSupabase, Sincronizador, convertir, filtro_keyset, sql_merge, validar_clave_servicio,
)
from app.espejo.tablas import POR_NOMBRE, TABLAS

RAIZ = Path(__file__).resolve().parents[2]
CLAVE = "sb_secret_prueba"


def _jwt(rol):
    cuerpo = base64.urlsafe_b64encode(json.dumps({"role": rol}).encode()).decode().rstrip("=")
    return f"cabecera.{cuerpo}.firma"


# --- Dobles ------------------------------------------------------------------------------
class FuenteMemoria:
    def __init__(self, filas):
        self.filas = filas  # {tabla: [fila, ...]}
        self.rota = set()

    def _orden(self, tabla, campos):
        if tabla.nombre in self.rota:
            raise RuntimeError("Supabase respondió HTTP 500")
        return sorted(self.filas.get(tabla.nombre, []), key=lambda f: tuple(str(f[c]) for c in campos))

    def cambios(self, tabla, despues, limite):
        campos = ("updated_at", *tabla.claves)
        filas = [f for f in self._orden(tabla, campos) if not despues or tuple(str(f[c]) for c in campos) > despues]
        return filas[:limite]

    def claves(self, tabla, despues, limite):
        claves = [tuple(str(f[c]) for c in tabla.claves) for f in self._orden(tabla, tabla.claves)]
        return [c for c in claves if not despues or c > despues][:limite]


class DestinoMemoria:
    def __init__(self):
        self.filas, self.marcas, self.registros = {}, {}, {}

    def marca(self, tabla):
        return self.marcas.get(tabla.nombre)

    def guardar(self, tabla, filas, marca):
        convertir(tabla, filas[0])  # la conversión no debe fallar con datos reales
        destino = self.filas.setdefault(tabla.nombre, {})
        for f in filas:
            destino[tuple(str(f[k]) for k in tabla.claves)] = dict(f)
        self.marcas[tabla.nombre] = marca

    def claves(self, tabla):
        return set(self.filas.get(tabla.nombre, {}))

    def borrar(self, tabla, claves):
        for c in claves:
            del self.filas[tabla.nombre][c]

    def registrar(self, tabla, error):
        self.registros[tabla.nombre] = error


def _perfil(i, ts="2026-10-15T10:00:00.000001+00:00"):
    return {"id": f"00000000-0000-4000-8000-{i:012d}", "display_name": f"P{i}", "avatar_url": None,
            "created_at": ts, "updated_at": ts}


PERFILES = (POR_NOMBRE["profiles"],)


# --- El espejo no se desvía del esquema de Supabase ni del DDL de Oracle ----------------
def _columnas_supabase():
    columnas = {}
    for sql in sorted((RAIZ / "supabase" / "migrations").glob("*.sql")):
        texto = sql.read_text(encoding="utf-8")
        for tabla, cuerpo in re.findall(r"create table public\.(\w+) \((.*?)\n\);", texto, re.S):
            columnas[tabla] = {
                m.group(1) for linea in cuerpo.splitlines()
                if (m := re.match(r"\s+(\w+)\s", linea))
                and m.group(1) not in {"unique", "foreign", "primary", "check", "constraint"}
            }
        for tabla, columna in re.findall(r"alter table public\.(\w+)\s+add column (\w+)", texto):
            columnas[tabla].add(columna)
    return columnas


def _columnas_oracle():
    texto = (RAIZ / "oracle" / "espejo" / "001_espejo_supabase.sql").read_text(encoding="utf-8")
    return {
        tabla: {m.group(1) for linea in cuerpo.splitlines() if (m := re.match(r"\s+(\w+)\s", linea))} - {"PRIMARY"}
        for tabla, cuerpo in re.findall(r"CREATE TABLE (\w+) \((.*?)\n\);", texto, re.S)
    }


def test_las_tablas_del_espejo_cubren_todas_las_columnas_de_supabase():
    supabase = _columnas_supabase()
    assert set(supabase) == set(POR_NOMBRE)
    for tabla in TABLAS:
        assert set(tabla.nombres) == supabase[tabla.nombre], tabla.nombre


def test_el_ddl_de_oracle_coincide_con_la_especificacion():
    oracle = _columnas_oracle()
    assert set(oracle) == set(POR_NOMBRE) | {"espejo_marcas"}
    for tabla in TABLAS:
        assert oracle[tabla.nombre] == {c.destino for c in tabla.columnas} | {"espejado_en"}, tabla.nombre


# --- Clave de servicio -----------------------------------------------------------------
@pytest.mark.parametrize("clave", ["sb_publishable_abc", _jwt("anon"), "basura"])
def test_rechaza_claves_que_no_son_de_servicio(clave):
    # Con la clave pública RLS devuelve [] sin error: la reconciliación vaciaría el espejo.
    with pytest.raises(ValueError):
        validar_clave_servicio(clave)
    with pytest.raises(ValueError):
        FuenteSupabase("https://x.supabase.co", clave)


@pytest.mark.parametrize("clave", [CLAVE, _jwt("service_role")])
def test_acepta_claves_de_servicio(clave):
    validar_clave_servicio(clave)


# --- Consultas a PostgREST -------------------------------------------------------------
def test_filtro_keyset():
    assert filtro_keyset(["id"], ["a"]) == '(id.gt."a")'
    assert filtro_keyset(["updated_at", "user_id", "package_id"], ["t", "u", "p"]) == (
        '(updated_at.gt."t",and(updated_at.eq."t",user_id.gt."u"),'
        'and(updated_at.eq."t",user_id.eq."u",package_id.gt."p"))'
    )


def test_fuente_supabase_pide_columnas_orden_y_keyset():
    peticiones = []

    def responder(request):
        peticiones.append(request)
        return httpx.Response(200, json=[])

    fuente = FuenteSupabase("https://x.supabase.co/", CLAVE, transport=httpx.MockTransport(responder))
    tabla = POR_NOMBRE["learning_progress"]
    fuente.cambios(tabla, None, 50)
    fuente.cambios(tabla, ("t", "u", "p"), 50)
    fuente.claves(tabla, ("u", "p"), 50)

    primera, segunda, tercera = peticiones
    assert primera.url.path == "/rest/v1/learning_progress"
    assert primera.headers["apikey"] == CLAVE and "authorization" not in primera.headers
    assert primera.url.params["select"] == ",".join(tabla.nombres)
    assert primera.url.params["order"] == "updated_at.asc,user_id.asc,package_id.asc"
    assert primera.url.params["limit"] == "50" and "or" not in primera.url.params
    assert segunda.url.params["or"] == filtro_keyset(["updated_at", "user_id", "package_id"], ["t", "u", "p"])
    assert tercera.url.params["select"] == "user_id,package_id"
    assert tercera.url.params["or"] == filtro_keyset(["user_id", "package_id"], ["u", "p"])


def test_fuente_supabase_falla_si_postgrest_no_responde_200():
    fuente = FuenteSupabase(
        "https://x.supabase.co", _jwt("service_role"),
        transport=httpx.MockTransport(lambda r: httpx.Response(401, json={})),
    )
    with pytest.raises(RuntimeError, match="HTTP 401"):
        fuente.cambios(POR_NOMBRE["profiles"], None, 10)


# --- Conversión y SQL de Oracle --------------------------------------------------------
def test_convertir_serializa_json_y_pasa_fechas_a_utc():
    tabla = POR_NOMBRE["user_state"]
    fila = {"user_id": "u", "xp": 10, "streak_days": 0, "last_activity_at": "2026-10-15T05:00:00-05:00",
            "achievements": ["á"], "preferences": {}, "created_at": "2026-10-15T10:00:00.5+00:00",
            "updated_at": "2026-10-15T10:00:00.123456+00:00"}
    valores = dict(zip(tabla.nombres, convertir(tabla, fila)))
    assert valores["last_activity_at"] == datetime(2026, 10, 15, 10, 0)
    assert valores["created_at"] == datetime(2026, 10, 15, 10, 0, 0, 500000)
    assert valores["achievements"] == '["á"]' and valores["preferences"] == "{}"
    assert valores["xp"] == 10


def test_merge_usa_nombres_de_oracle_y_no_actualiza_claves():
    sql = sql_merge(POR_NOMBRE["generation_tasks"])
    assert "resource_name" in sql and " resource " not in sql
    assert "d.id = s.id" in sql and "d.id = s.id," not in sql.split("UPDATE SET")[1]
    progreso = sql_merge(POR_NOMBRE["learning_progress"])
    assert "ON (d.user_id = s.user_id AND d.package_id = s.package_id)" in progreso


# --- Sincronización --------------------------------------------------------------------
def test_copia_incremental_desde_la_marca():
    fuente = FuenteMemoria({"profiles": [_perfil(i) for i in range(3)]})
    destino = DestinoMemoria()
    sinc = Sincronizador(fuente, destino, lote=2, tablas=PERFILES)

    assert sinc.ejecutar()[0].copiadas == 3
    assert sinc.ejecutar()[0].copiadas == 0  # nada nuevo

    fuente.filas["profiles"][1] = {**_perfil(1, "2026-10-15T11:00:00+00:00"), "display_name": "nuevo"}
    assert sinc.ejecutar()[0].copiadas == 1
    assert destino.filas["profiles"][("00000000-0000-4000-8000-000000000001",)]["display_name"] == "nuevo"
    assert destino.registros["profiles"] is None


def test_muchas_filas_con_el_mismo_updated_at_no_se_saltan():
    # Una transacción masiva en Postgres pone el mismo now() en todas las filas.
    fuente = FuenteMemoria({"profiles": [_perfil(i) for i in range(7)]})
    destino = DestinoMemoria()
    assert Sincronizador(fuente, destino, lote=3, tablas=PERFILES).ejecutar()[0].copiadas == 7
    assert len(destino.filas["profiles"]) == 7


def test_reconciliar_borra_lo_que_ya_no_esta_en_supabase():
    fuente = FuenteMemoria({"profiles": [_perfil(i) for i in range(30)]})
    destino = DestinoMemoria()
    sinc = Sincronizador(fuente, destino, lote=4, tablas=PERFILES)
    sinc.ejecutar()
    del fuente.filas["profiles"][5]

    assert sinc.ejecutar()[0].borradas == 0  # sin --reconciliar no se borra nada
    res = sinc.ejecutar(reconciliar=True)[0]
    assert res.borradas == 1 and len(destino.filas["profiles"]) == 29


def test_reconciliar_se_niega_a_vaciar_el_espejo():
    fuente = FuenteMemoria({"profiles": [_perfil(i) for i in range(30)]})
    destino = DestinoMemoria()
    sinc = Sincronizador(fuente, destino, tablas=PERFILES)
    sinc.ejecutar()
    fuente.filas["profiles"] = []  # p. ej. una clave sin permisos que devuelve listas vacías

    res = sinc.ejecutar(reconciliar=True)[0]
    assert "--forzar-borrado" in res.error and len(destino.filas["profiles"]) == 30
    assert destino.registros["profiles"] == res.error
    assert sinc.ejecutar(reconciliar=True, forzar_borrado=True)[0].borradas == 30


def test_una_tabla_rota_no_detiene_las_demas():
    fuente = FuenteMemoria({"profiles": [_perfil(1)], "user_state": []})
    fuente.rota.add("documents")
    destino = DestinoMemoria()
    resultados = {r.tabla: r for r in Sincronizador(fuente, destino).ejecutar()}

    assert "HTTP 500" in resultados["documents"].error
    assert resultados["profiles"].copiadas == 1 and not resultados["profiles"].error
    assert set(destino.registros) == set(POR_NOMBRE)


def test_main_sin_configuracion_sale_con_2(monkeypatch, capsys):
    monkeypatch.setattr("app.espejo.__main__.load_dotenv", lambda: None)
    for variable in ("SUPABASE_SERVICE_ROLE_KEY", "ORACLE_ESPEJO_USUARIO", "ORACLE_ESPEJO_CLAVE", "ORACLE_ESPEJO_DSN"):
        monkeypatch.delenv(variable, raising=False)
    assert main([]) == 2
    assert "SUPABASE_SERVICE_ROLE_KEY" in capsys.readouterr().err
