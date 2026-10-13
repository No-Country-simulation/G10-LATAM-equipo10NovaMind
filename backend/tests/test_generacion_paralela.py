"""
Etapa 3 · Generación paralela (modo_rag="paralelo") con transporte Gemini simulado.

Cubre los criterios de aceptación: arranque concurrente, publicación del primer
recurso sin esperar al resto, aislamiento de errores, modelos por configuración,
comprobaciones deterministas antes de publicar y auditoría posterior.
"""

import asyncio
import json
from dataclasses import replace
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.agentes.generacion_paralela import GeneracionParalelaError, GeneradorParalelo
from app.auth import Principal, require_user
from app.core.config import Config
from app.core.schemas import RangoPagina, SolicitudAdaptacion
from app.servicios.servicio_gemini import ClienteGemini

CLAVE = "AIzaClaveDePruebaQueNoDebeFiltrarse1234567"

P1 = "La memoria swap evita que el kernel active el OOM killer en máquinas virtuales pequeñas. "
P2 = "Cada subred privada de la VCN usa una tabla de rutas hacia el NAT Gateway. "
P3 = "El balanceador público distribuye el tráfico entre instancias sanas del backend."
DOCUMENTO = P1 + P2 + P3
PAGINAS = [
    RangoPagina(numero=1, inicio=0, fin=len(P1)),
    RangoPagina(numero=2, inicio=len(P1), fin=len(P1) + len(P2)),
    RangoPagina(numero=3, inicio=len(P1) + len(P2), fin=len(DOCUMENTO)),
]
C1 = "evita que el kernel active el OOM killer"
C2 = "usa una tabla de rutas hacia el NAT Gateway"
C3 = "distribuye el tráfico entre instancias sanas"
FALSA = "Kubernetes reinicia los pods cada hora sin aviso"

SOLICITUD = SolicitudAdaptacion(
    documento_titulo="Redes y memoria en OCI",
    documento_contenido=DOCUMENTO,
    perfil_destinatario="Principiante",
    formato_salida="Paquete Educativo Completo (5 Estaciones)",
    paginas=PAGINAS,
)

CONFIG = replace(
    Config.desde_entorno(cargar_dotenv=False),
    gemini_summary_model="modelo-resumen",
    gemini_resources_model="modelo-recursos",
)


def _palabras(n: int, semilla: str) -> str:
    return " ".join(f"{semilla}{i}" for i in range(n))


def salida_a() -> dict:
    return {
        "introduccion_contextualizada": "Este documento te ayuda a operar redes y memoria en OCI.",
        "resumen_ejecutivo": "La swap protege la VM; las subredes privadas salen por NAT; el balanceador reparte tráfico.",
        "analogia_central": "La swap es como una bodega de emergencia.",
        "resumen_por_secciones": [{"seccion": "Memoria", "resumen": "Swap y OOM.", "cita": C1}],
        "conceptos_fundamentales": [
            {"concepto": "Swap", "explicacion": "Memoria de respaldo.", "cita": C1},
            {"concepto": "NAT Gateway", "explicacion": "Salida de subredes privadas.", "cita": C2},
            {"concepto": "swap ", "explicacion": "Duplicado.", "cita": C1},  # duplicado normalizado
            {"concepto": "Balanceador", "explicacion": "Reparte tráfico.", "cita": C3},
        ],
        "conclusiones": ["Configura swap antes de producción."],
    }


def _pregunta(texto, opciones, cita=C2):
    return {"pregunta": texto, "opciones": opciones, "indice_correcta": 1,
            "explicaciones": ["No.", "Sí, según el documento.", "No.", "No."], "cita": cita}


def salida_b1() -> dict:
    return {
        "flashcards": [
            {"frente": "¿Qué evita la swap?", "dorso": "El OOM killer.", "pista_didactica": "Memoria.", "cita": C1},
            {"frente": "¿Qué evita la  SWAP?", "dorso": "Duplicada.", "pista_didactica": "x", "cita": C1},
            {"frente": "¿Por dónde sale una subred privada?", "dorso": "NAT Gateway.", "pista_didactica": "Rutas.", "cita": C2},
            {"frente": "¿Qué hace el balanceador?", "dorso": "Reparte tráfico.", "pista_didactica": "Carga.", "cita": FALSA},
        ],
        "cuestionario": [
            _pregunta("¿Qué usa la subred privada?", ["Internet GW", "NAT Gateway", "DRG", "LPG"]),
            _pregunta("¿Pregunta con opciones repetidas?", ["A", "a", "B", "C"]),
            _pregunta("¿Qué reparte el balanceador?", ["Memoria", "Tráfico", "Discos", "Claves"], C3),
            _pregunta("¿Qué evita la swap?", ["Reinicios", "El OOM killer", "Latencia", "Costes"], C1),
        ],
        "glosario": [
            {"termino": "Swap", "definicion": "Memoria en disco.", "cita": C1},
            {"termino": "NAT Gateway", "definicion": "Salida a internet.", "cita": C2},
            {"termino": "Pod", "definicion": "Inventado.", "cita": FALSA},
        ],
        "objetivos_aprendizaje": ["Configurar swap", "Explicar el NAT Gateway", "configurar  swap"],
    }


def salida_b2(diagrama: str = "flowchart TD\n  A[Subred] --> B[NAT]") -> dict:
    escena = lambda i, cita: {  # noqa: E731
        "titulo": f"Escena {i}", "guion_locutor": _palabras(40, f"e{i}p"),
        "storyboard_visual": "Plano.", "consejo_pedagogico": "Pausa.", "objetivo_pedagogico": "Comprender.",
        "visual": {"tipo": "ppt_concepto", "titulo": "Idea", "puntos_clave": ["a", "b"]}, "citas": [cita],
    }
    return {
        "guion": [escena(1, C1), escena(2, C2), escena(3, C3)],
        "diapositivas": [
            {"titulo": "Swap", "puntos_clave": ["OOM", "VM"], "concepto_visual": "Gráfico", "cita": C1},
            {"titulo": "Red", "puntos_clave": ["NAT", "Rutas"], "concepto_visual": "Diagrama", "cita": C2},
            {"titulo": "Carga", "puntos_clave": ["LB", "Sanas"], "concepto_visual": "Flechas", "cita": C3},
        ],
        "tutorial": [
            {"titulo": "Crear swap", "descripcion": "Crea el archivo.", "accion": "fallocate -l 4G /swapfile", "verificacion": "swapon --show"},
            {"titulo": "Rutas", "descripcion": "Revisa la tabla.", "accion": "oci network route-table list", "verificacion": "NAT presente"},
            {"titulo": "LB", "descripcion": "Revisa backends.", "accion": "oci lb backend list", "verificacion": "OK"},
        ],
        "diagrama_mermaid": diagrama,
    }


def _ok(datos: dict) -> httpx.Response:
    return httpx.Response(200, json={
        "status": "completed",
        "steps": [{"type": "model_output", "content": [{"type": "text", "text": json.dumps(datos)}]}],
        "usage": {"total_input_tokens": 100, "total_output_tokens": 50},
    })


def tarea_de(request: httpx.Request) -> str:
    instr = json.loads(request.content)["system_instruction"]
    if instr.startswith("Eres el redactor de síntesis"):
        return "A"
    if instr.startswith("Eres el diseñador de evaluación"):
        return "B1"
    return "B2"


class Simulador:
    """Responde por tarea; registra el orden de llegada y la simultaneidad."""

    def __init__(self, respuestas=None, retrasos=None):
        self.respuestas = {"A": salida_a, "B1": salida_b1, "B2": salida_b2, **(respuestas or {})}
        self.retrasos = retrasos or {}
        self.en_vuelo = 0
        self.max_en_vuelo = 0
        self.peticiones = []

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        tarea = tarea_de(request)
        self.peticiones.append((tarea, json.loads(request.content)))
        self.en_vuelo += 1
        self.max_en_vuelo = max(self.max_en_vuelo, self.en_vuelo)
        try:
            await asyncio.sleep(self.retrasos.get(tarea, 0.01))
            r = self.respuestas[tarea]()
            return r if isinstance(r, httpx.Response) else _ok(r)
        finally:
            self.en_vuelo -= 1


class Auditor:
    def __init__(self, resultado=None):
        self.llamadas = []
        self.resultado = resultado or {
            "auditoria_ejecutada": True, "anclaje_fuente_score": 0.9,
            "claridad_pedagogica": "Alta", "observaciones": "Afirmaciones respaldadas.",
        }

    def __call__(self, afirmaciones, documento):
        self.llamadas.append(afirmaciones)
        return dict(self.resultado)


def _generar(simulador, auditor=None, presupuesto_s=30.0, solicitud=SOLICITUD, config=CONFIG, registro=None):
    eventos = []

    async def run():
        cliente = ClienteGemini(CLAVE, transport=httpx.MockTransport(simulador), max_reintentos=0,
                                max_concurrencia=3, dormir=lambda _s: asyncio.sleep(0))
        async with cliente:
            gen = GeneradorParalelo(cliente, config, auditor=auditor or Auditor(), presupuesto_s=presupuesto_s,
                                    registro=registro)
            return await gen.generar(solicitud, eventos.append)

    return asyncio.run(run()), eventos


def _recursos(eventos, estado="completado"):
    return [e["recurso"] for e in eventos if e["tipo"] == "recurso" and e["estado"]["estado"] == estado]


# --- 1 y 2: concurrencia y publicación incremental --------------------------------
def test_las_tres_tareas_empiezan_a_la_vez():
    sim = Simulador(retrasos={"A": 0.2, "B1": 0.2, "B2": 0.2})
    _generar(sim)
    assert sorted(t for t, _ in sim.peticiones) == ["A", "B1", "B2"]
    assert sim.max_en_vuelo == 3  # B no espera a A


def test_el_primer_recurso_se_publica_sin_esperar_a_los_demas():
    sim = Simulador(retrasos={"A": 0.4, "B1": 0.01, "B2": 0.2})
    respuesta, eventos = _generar(sim)
    orden = [(e["tipo"], e.get("tarea") or e.get("recurso")) for e in eventos]
    assert orden.index(("recurso", "flashcards")) < orden.index(("tarea", "A"), 3)  # antes de que A termine
    assert _recursos(eventos)[0] == "flashcards"
    # Cada evento de recurso trae su parche de contenido y verificación pendiente
    primero = next(e for e in eventos if e["tipo"] == "recurso")
    assert primero["estado"]["verificacion"] == "pendiente" and "flashcards" in primero["campos"]
    assert respuesta.status == "exito_con_advertencias"  # hay avisos de citas y descartes


# --- 4: aislamiento de errores ------------------------------------------------------
def test_fallo_de_una_tarea_no_invalida_las_demas():
    sim = Simulador(respuestas={"A": lambda: httpx.Response(404, json={"error": {"message": "no"}})})
    respuesta, eventos = _generar(sim)
    assert set(_recursos(eventos, "fallido")) == {"resumen"}
    assert set(_recursos(eventos)) == {"flashcards", "cuestionario", "glosario", "objetivos",
                                       "guion", "diapositivas", "tutorial", "diagrama"}
    contenido = respuesta.contenido_adaptado
    assert contenido.resumen_ninja is None  # nunca se inventa un resumen de relleno
    assert contenido.estado_recursos["resumen"].error_codigo == "modelo_no_encontrado"
    assert any("«Resumen»" in a for a in respuesta.advertencias)
    assert contenido.flashcards and contenido.quiz and contenido.director_cut


def test_salida_invalida_de_b2_solo_afecta_a_sus_recursos():
    sim = Simulador(respuestas={"B2": lambda: {"guion": []}})
    respuesta, eventos = _generar(sim)
    assert set(_recursos(eventos, "fallido")) == {"guion", "diapositivas", "tutorial", "diagrama"}
    assert respuesta.contenido_adaptado.estado_recursos["guion"].error_codigo == "esquema_invalido"
    assert "resumen" in _recursos(eventos) and "cuestionario" in _recursos(eventos)


def test_recurso_invalido_no_arrastra_a_los_de_su_misma_tarea():
    sim = Simulador(respuestas={"B2": lambda: salida_b2(diagrama="esto no es mermaid")})
    respuesta, eventos = _generar(sim)
    assert _recursos(eventos, "fallido") == ["diagrama"]
    assert respuesta.contenido_adaptado.diagrama_mermaid is None
    assert respuesta.contenido_adaptado.tutorial


def test_presupuesto_agotado_cancela_la_tarea_lenta_y_publica_el_resto():
    sim = Simulador(retrasos={"A": 5.0})
    respuesta, eventos = _generar(sim, presupuesto_s=0.3)
    assert respuesta.contenido_adaptado.estado_recursos["resumen"].error_codigo == "presupuesto_agotado"
    assert "flashcards" in _recursos(eventos)


def test_si_todo_falla_se_lanza_para_que_main_conmute():
    error = lambda: httpx.Response(400, json={"error": {"message": "x"}})  # noqa: E731
    with pytest.raises(GeneracionParalelaError):
        _generar(Simulador(respuestas={"A": error, "B1": error, "B2": error}))


# --- 6: modelos por configuración ---------------------------------------------------
def test_los_modelos_salen_de_la_configuracion():
    sim = Simulador()
    _generar(sim, config=replace(CONFIG, gemini_resources_model="otro-modelo-lite"))
    modelos = {t: cuerpo["model"] for t, cuerpo in sim.peticiones}
    assert modelos == {"A": "modelo-resumen", "B1": "otro-modelo-lite", "B2": "otro-modelo-lite"}
    assert all(cuerpo["store"] is False for _, cuerpo in sim.peticiones)


# --- Comprobaciones deterministas ----------------------------------------------------
def test_citas_paginas_y_duplicados():
    respuesta, _ = _generar(Simulador())
    c = respuesta.contenido_adaptado
    # Conceptos: el duplicado "swap " se descarta; la página sale del documento
    conceptos = c.resumen_ninja["conceptos_clave"]
    assert [x["texto"] for x in conceptos] == ["Swap", "NAT Gateway", "Balanceador"]
    assert [x["fuente"]["pagina"] for x in conceptos] == [1, 2, 3]
    assert all(x["verificado"] for x in conceptos)
    # Flashcards: duplicado eliminado; la cita inventada queda sin verificar y sin página
    assert len(c.flashcards) == 3
    falsa = c.flashcards[-1]["fuente"]
    assert falsa == {"texto": FALSA, "pagina": None, "verificada": False}
    estado = c.estado_recursos["flashcards"]
    assert (estado.citas_totales, estado.citas_verificadas) == (3, 2)
    assert any("1 de 3 citas" in a for a in estado.avisos)
    # Cuestionario: la pregunta con alternativas repetidas se descarta
    assert len(c.quiz) == 3 and all(q["respuesta_correcta"] == 1 for q in c.quiz)
    assert c.quiz[0]["justificacion_rag"] == "Sí, según el documento."
    assert c.objetivos_aprendizaje == ["Configurar swap", "Explicar el NAT Gateway"]


def test_guion_reutiliza_el_contrato_de_tiempos():
    respuesta, _ = _generar(Simulador())
    spec = respuesta.contenido_adaptado.video_job_spec
    assert spec.total_palabras == 120 and spec.duracion_total_estimada <= 60
    assert [e.origen for e in spec.escenas] == ["llm"] * 3
    assert [e.fuentes[0].pagina for e in spec.escenas] == [1, 2, 3]
    assert spec.estado == "contract_ready"  # la narración es bajo demanda, no se lanza aquí


# --- Auditoría posterior --------------------------------------------------------------
def test_auditoria_despues_de_publicar_y_estados_finales():
    auditor = Auditor()
    respuesta, eventos = _generar(Simulador(), auditor=auditor)
    tipos = [e["tipo"] for e in eventos]
    assert tipos.index("auditoria") > max(i for i, t in enumerate(tipos) if t == "recurso")
    muestra = auditor.llamadas[0]
    assert any(a.startswith("Resumen:") for a in muestra) and any(a.startswith("Glosario:") for a in muestra)
    estados = respuesta.contenido_adaptado.estado_recursos
    assert estados["cuestionario"].verificacion == "auditada"
    assert estados["diapositivas"].verificacion == "no_auditada"  # no se envió al auditor
    assert respuesta.evaluacion_calidad.anclaje_fuente_score == 0.9


def test_auditoria_no_ejecutada_no_inventa_score():
    auditor = Auditor({"auditoria_ejecutada": False, "anclaje_fuente_score": None, "observaciones": "sin clave"})
    respuesta, _ = _generar(Simulador(), auditor=auditor)
    assert respuesta.evaluacion_calidad.anclaje_fuente_score is None
    assert respuesta.evaluacion_calidad.auditoria_ejecutada is False
    assert all(e.verificacion == "no_auditada" for e in respuesta.contenido_adaptado.estado_recursos.values())
    assert any("no se ejecutó" in a for a in respuesta.advertencias)


def test_la_clave_no_aparece_en_eventos_ni_en_la_respuesta():
    respuesta, eventos = _generar(Simulador(respuestas={"A": lambda: httpx.Response(
        400, json={"error": {"message": f"clave {CLAVE} inválida"}})}))
    assert CLAVE not in json.dumps(eventos, default=str)
    assert CLAVE not in respuesta.model_dump_json()


# --- Endpoint SSE ------------------------------------------------------------------------
@pytest.fixture
def api():
    from app import main

    app_ = main.app
    app_.dependency_overrides[require_user] = lambda: Principal("11111111-1111-4111-8111-111111111111", "t")
    with patch("app.main.persist_result", side_effect=lambda p, s, r: r), \
         patch("app.main._ejecutar_tareas_segundo_plano"):
        yield main, TestClient(app_)
    app_.dependency_overrides.pop(require_user, None)


FORM = {
    "texto_directo": DOCUMENTO, "titulo": "Redes", "perfil_destinatario": "Principiante",
    "formato_salida": "Flashcards", "modo_rag": "paralelo",
}


def _eventos_sse(texto: str):
    return [json.loads(b[6:]) for b in texto.split("\n\n") if b.startswith("data: ")]


def test_stream_paralelo_publica_recursos_y_resultado(api):
    main, client = api

    def generador(_principal, _registro=None):
        cliente = ClienteGemini(CLAVE, transport=httpx.MockTransport(Simulador()), max_reintentos=0)
        return GeneradorParalelo(cliente, CONFIG, auditor=Auditor())

    with patch("app.main.get_generador_paralelo", side_effect=generador):
        r = client.post("/api/v1/adaptar/stream", data=FORM)
    eventos = _eventos_sse(r.text)
    tipos = [e["tipo"] for e in eventos]
    assert tipos[0] == "inicio" and tipos[-1] == "resultado"
    assert tipos.count("recurso") == 9 and "auditoria" in tipos
    # El frontend actual sigue avanzando con eventos 'progreso'
    assert any(e["tipo"] == "progreso" and e["etapa"] == "recurso_flashcards" for e in eventos)
    datos = eventos[-1]["datos"]
    assert datos["contenido_adaptado"]["items"] == datos["contenido_adaptado"]["flashcards"]
    assert datos["almacenamiento_oci"]["status_upload"] == "omitido"


def test_paralelo_falla_y_conmuta_a_la_cadena(api):
    _main, client = api
    respuesta_cadena, _ = _generar(Simulador())  # cualquier respuesta válida sirve como la de la cadena
    respuesta_cadena.status, respuesta_cadena.advertencias = "exito", []
    cadena = MagicMock()
    cadena.ejecutar.return_value = respuesta_cadena

    async def generar(*_a, **_k):
        raise GeneracionParalelaError("nada")

    falla = MagicMock(generar=generar)
    with patch("app.main.get_generador_paralelo", return_value=falla), \
         patch("app.main.get_cadena_colaborativa", return_value=cadena):
        r = client.post("/api/v1/adaptar", data=FORM)
    assert r.status_code == 200 and cadena.ejecutar.called
    cuerpo = r.json()
    assert cuerpo["status"] == "exito_con_advertencias"
    assert "generación paralela no produjo recursos" in cuerpo["advertencias"][0]
