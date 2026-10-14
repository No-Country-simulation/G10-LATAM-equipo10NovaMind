"""
Etapa 4 · Persistencia por recurso (generation_tasks), reutilización y deduplicación.
Sin red: Gemini simulado (ver test_generacion_paralela) y Supabase con MockTransport.
"""

import asyncio
import json
import re
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from app.agentes.generacion_paralela import NOMBRES_RECURSO, GeneradorParalelo, huella_tarea, tareas_para
from app.auth import Principal
from app.servicios.registro_tareas import COLUMNAS, RegistroMemoria, RegistroSupabase
from app.servicios.servicio_gemini import ClienteGemini

from test_generacion_paralela import CLAVE, CONFIG, SOLICITUD, Auditor, Simulador, _generar, salida_b2

USER = "11111111-1111-4111-8111-111111111111"
DOC = "22222222-2222-4222-8222-222222222222"
MIGRACION = Path(__file__).resolve().parents[2] / "supabase" / "migrations" / "202610120001_generation_tasks.sql"


def _tareas_llamadas(sim):
    return sorted(t for t, _ in sim.peticiones)


# --- Persistencia del estado de cada tarea --------------------------------------------
def test_cada_recurso_queda_registrado_con_su_estado_final():
    registro = RegistroMemoria()
    _generar(Simulador(), registro=registro)
    filas = {r: f for (_h, r), f in registro.filas.items()}
    assert set(filas) == set(NOMBRES_RECURSO)
    # La primera escritura de cada tarea marca sus recursos "en_curso" antes de llamar al modelo
    primeras = [lote for lote in registro.escrituras if lote[0]["status"] == "en_curso"]
    assert len(primeras) == 3
    for r, f in filas.items():
        assert f["status"] == "completado" and f["finished_at"] >= f["started_at"]
        assert f["model"] in ("modelo-resumen", "modelo-recursos") and f["attempts"] == 1
        assert set(f["result"]) == {"campos", "afirmaciones", "estado"}
        assert re.fullmatch(r"[0-9a-f]{64}", f["content_hash"])
    assert filas["cuestionario"]["verification"] == "auditada"
    assert filas["diapositivas"]["verification"] == "no_auditada"


def test_fallo_queda_registrado_con_codigo_y_mensaje_saneado():
    registro = RegistroMemoria()
    error = lambda: httpx.Response(429, json={"error": {"message": f"quota {CLAVE}"}})  # noqa: E731
    _generar(Simulador(respuestas={"A": error}), registro=registro)
    fila = next(f for (_h, r), f in registro.filas.items() if r == "resumen")
    assert (fila["status"], fila["error_code"]) == ("fallido", "rate_limit")
    assert fila["error_message"] == "cuota de Gemini agotada temporalmente"
    assert CLAVE not in json.dumps(registro.escrituras)


# --- Reutilización: no repetir lo ya completado ---------------------------------------
def test_segunda_generacion_identica_no_llama_a_gemini():
    registro = RegistroMemoria()
    _generar(Simulador(), registro=registro)
    sim = Simulador()
    respuesta, eventos = _generar(sim, registro=registro)
    assert sim.peticiones == []
    assert {e["estado"] for e in eventos if e["tipo"] == "tarea" and e["tarea"] != "auditoria"} == {"reutilizada"}
    estados = respuesta.contenido_adaptado.estado_recursos
    assert all(e.reutilizado for e in estados.values())
    assert estados["cuestionario"].verificacion == "auditada"  # la auditoría vuelve a ejecutarse
    assert respuesta.contenido_adaptado.quiz and respuesta.contenido_adaptado.video_job_spec


def test_un_recurso_fallido_no_obliga_a_repetir_las_tareas_completas():
    registro = RegistroMemoria()
    _generar(Simulador(respuestas={"B2": lambda: salida_b2(diagrama="no es mermaid")}), registro=registro)
    sim = Simulador()
    respuesta, eventos = _generar(sim, registro=registro)
    assert _tareas_llamadas(sim) == ["B2"]  # A y B1 se reutilizan
    estados = respuesta.contenido_adaptado.estado_recursos
    assert estados["diagrama"].estado == "completado" and not estados["diagrama"].reutilizado
    assert estados["guion"].reutilizado  # lo ya completado de B2 se conserva tal cual
    en_curso = next(e for e in eventos if e["tipo"] == "tarea" and e["tarea"] == "B2")
    assert en_curso["recursos"] == ["diagrama"]


def test_cambiar_modelo_o_parametros_invalida_la_reutilizacion():
    registro = RegistroMemoria()
    _generar(Simulador(), registro=registro)
    sim = Simulador()
    _generar(sim, registro=registro, config=replace(CONFIG, gemini_resources_model="otro-modelo"))
    assert _tareas_llamadas(sim) == ["B1", "B2"]
    sim = Simulador()
    _generar(sim, registro=registro, solicitud=SOLICITUD.model_copy(update={"nivel_detalle": "Profundo"}))
    assert _tareas_llamadas(sim) == ["A", "B1", "B2"]


def test_resultado_previo_corrupto_se_regenera():
    registro = RegistroMemoria()
    _generar(Simulador(), registro=registro)
    for (_h, r), f in registro.filas.items():
        if r == "glosario":
            f["result"] = {"campos": "no-es-un-dict", "estado": {}}
    sim = Simulador()
    _generar(sim, registro=registro)
    assert _tareas_llamadas(sim) == ["B1"]


def test_la_huella_cambia_si_cambia_el_prompt():
    tarea = tareas_para(CONFIG)[0]
    assert huella_tarea(SOLICITUD, tarea) != huella_tarea(SOLICITUD, replace(tarea, instrucciones=tarea.instrucciones + "."))


# --- Deduplicación de solicitudes simultáneas -----------------------------------------
def test_dos_solicitudes_identicas_simultaneas_comparten_las_llamadas():
    sim = Simulador(retrasos={"A": 0.1, "B1": 0.1, "B2": 0.1})

    async def run():
        async with ClienteGemini(CLAVE, transport=httpx.MockTransport(sim), max_reintentos=0) as cliente:
            gen = lambda: GeneradorParalelo(cliente, CONFIG, auditor=Auditor(), propietario=USER)  # noqa: E731
            return await asyncio.gather(gen().generar(SOLICITUD), gen().generar(SOLICITUD))

    r1, r2 = asyncio.run(run())
    assert len(sim.peticiones) == 3  # no 6
    assert r1.contenido_adaptado.quiz == r2.contenido_adaptado.quiz


def test_propietarios_distintos_no_comparten_llamadas():
    sim = Simulador(retrasos={"A": 0.05, "B1": 0.05, "B2": 0.05})

    async def run():
        async with ClienteGemini(CLAVE, transport=httpx.MockTransport(sim), max_reintentos=0) as cliente:
            return await asyncio.gather(*(
                GeneradorParalelo(cliente, CONFIG, auditor=Auditor(), propietario=p).generar(SOLICITUD)
                for p in ("u1", "u2")
            ))

    asyncio.run(run())
    assert len(sim.peticiones) == 6


# --- RegistroSupabase (PostgREST) ------------------------------------------------------
class PostgREST:
    def __init__(self, estado_get=200, estado_post=201, filas=None):
        self.peticiones = []
        self.estado_get, self.estado_post, self.filas = estado_get, estado_post, filas or []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.peticiones.append(request)
        if request.method == "GET":
            return httpx.Response(self.estado_get, json=self.filas)
        return httpx.Response(self.estado_post)


def _registro(api):
    return RegistroSupabase("https://x.supabase.co", "sb_publishable", "jwt-usuario", USER, DOC,
                            transport=httpx.MockTransport(api))


def test_supabase_previos_filtra_por_huella_de_su_tarea():
    api = PostgREST(filas=[
        {"resource": "glosario", "task": "B1", "content_hash": "h1", "status": "completado", "result": {"campos": {}}},
        {"resource": "resumen", "task": "A", "content_hash": "h1", "status": "completado", "result": {"campos": {}}},
    ])

    async def run():
        reg = _registro(api)
        try:
            return await reg.previos({"A": "h0", "B1": "h1"})
        finally:
            await reg.aclose()

    assert set(asyncio.run(run())) == {"glosario"}  # la fila de A tiene la huella de otra tarea
    req = api.peticiones[0]
    assert req.url.path == "/rest/v1/generation_tasks"
    assert req.url.params["content_hash"] == "in.(h0,h1)" and req.url.params["status"] == "eq.completado"
    assert req.headers["authorization"] == "Bearer jwt-usuario"  # RLS con el JWT del usuario


def test_supabase_guardar_hace_upsert_en_lote_con_dueno_y_documento():
    api = PostgREST()

    async def run():
        reg = _registro(api)
        await reg.guardar([{"resource": "glosario", "task": "B1", "content_hash": "h", "status": "en_curso",
                            "started_at": "t"}])
        await reg.aclose()

    asyncio.run(run())
    req = api.peticiones[0]
    assert req.url.params["on_conflict"] == "user_id,content_hash,resource"
    assert "resolution=merge-duplicates" in req.headers["prefer"]
    (fila,) = json.loads(req.content)
    assert set(fila) == set(COLUMNAS) | {"user_id", "document_id"}
    assert (fila["user_id"], fila["document_id"]) == (USER, DOC)


def test_supabase_caido_no_interrumpe_la_generacion():
    api = PostgREST(estado_get=503, estado_post=503)
    registro = _registro(api)
    respuesta, _ = _generar(Simulador(), registro=registro)
    assert respuesta.contenido_adaptado.quiz
    assert registro.fallos >= 1
    assert any("registrar el estado" in a for a in respuesta.advertencias)


# --- Contrato con la migración ----------------------------------------------------------
def test_la_migracion_admite_todos_los_recursos_y_tareas():
    sql = MIGRACION.read_text(encoding="utf-8")
    recursos = set(re.findall(r"'([a-z]+)'", re.search(r"resource in \((.*?)\)\)", sql, re.S).group(1)))
    assert set(NOMBRES_RECURSO) <= recursos and "narracion" in recursos
    tareas = set(re.findall(r"'([A-Za-z0-9]+)'", re.search(r"task in \((.*?)\)\)", sql, re.S).group(1)))
    assert {t.id for t in tareas_para(CONFIG)} <= tareas
    for columna in COLUMNAS:
        assert re.search(rf"^\s+{columna} ", sql, re.M), columna
    assert "unique (user_id, content_hash, resource)" in sql


# --- main: Supabase para usuarios; caché en memoria compartida para invitados ------------
def test_invitados_usan_la_cache_en_memoria_y_usuarios_su_documento_creado_al_inicio():
    from app import main

    invitado = Principal("00000000-0000-0000-0000-000000000000", "guest", is_guest=True)
    with patch("app.main.ensure_document") as ensure_invitado:
        reg_invitado = asyncio.run(main._registro_tareas(invitado, SOLICITUD))
    assert reg_invitado is main._REGISTRO_INVITADOS and isinstance(reg_invitado, RegistroMemoria)
    ensure_invitado.assert_not_called()  # nada de un invitado llega a Supabase

    async def run():
        with patch("app.main.ensure_document", return_value=DOC) as ensure, \
             patch("app.main.supabase_settings", return_value=("https://x.supabase.co", "k")):
            reg = await main._registro_tareas(Principal(USER, "jwt"), SOLICITUD)
            await reg.aclose()
            return reg, ensure

    reg, ensure = asyncio.run(run())
    assert isinstance(reg, RegistroSupabase) and ensure.called

    with patch("app.main.ensure_document", side_effect=RuntimeError("supabase caído")):
        assert asyncio.run(main._registro_tareas(Principal(USER, "jwt"), SOLICITUD)) is None


def test_cache_de_invitados_acotada_y_sin_historial():
    reg = RegistroMemoria(max_filas=3)

    def fila(huella, recurso):
        return {"resource": recurso, "task": "A", "content_hash": huella, "status": "completado", "result": {"x": 1}}

    asyncio.run(reg.guardar([fila("h1", "resumen"), fila("h1", "glosario"), fila("h2", "resumen")]))
    asyncio.run(reg.guardar([fila("h1", "resumen")]))  # reescribir la deja como la más reciente
    asyncio.run(reg.guardar([fila("h3", "resumen")]))  # supera el tope: sale la más antigua
    assert set(reg.filas) == {("h2", "resumen"), ("h1", "resumen"), ("h3", "resumen")}
    assert reg.escrituras == []
    assert asyncio.run(reg.previos({"A": "h3"})) == {"resumen": {"x": 1}}
