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
from app.servicios.servicio_gemini import (
    ClienteGemini,
    limpiar_modelos_agotados,
    modelo_esta_agotado,
)

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
    gemini_summary_fallback_model="respaldo-resumen",
    gemini_resources_fallback_model="respaldo-recursos",
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
        "glosario": [
            {"termino": "Swap", "definicion": "Memoria en disco.", "cita": C1},
            {"termino": "NAT Gateway", "definicion": "Salida a internet.", "cita": C2},
            {"termino": "Pod", "definicion": "Inventado.", "cita": FALSA},
        ],
        "objetivos_aprendizaje": ["Configurar swap", "Explicar el NAT Gateway", "configurar  swap"],
    }


def salida_c() -> dict:
    return {
        "cuestionario": [
            _pregunta("¿Qué usa la subred privada?", ["Internet GW", "NAT Gateway", "DRG", "LPG"]),
            _pregunta("¿Pregunta con opciones repetidas?", ["A", "a", "B", "C"]),
            _pregunta("¿Qué reparte el balanceador?", ["Memoria", "Tráfico", "Discos", "Claves"], C3),
            _pregunta("¿Qué evita la swap?", ["Reinicios", "El OOM killer", "Latencia", "Costes"], C1),
        ],
    }


def salida_b2(diagrama: str = "flowchart TD\n  A[Subred] --> B[NAT]", palabras_escena: int = 40) -> dict:
    escena = lambda i, cita: {  # noqa: E731
        "titulo": f"Escena {i}", "guion_locutor": _palabras(palabras_escena, f"e{i}p"),
        "storyboard_visual": "Plano.", "consejo_pedagogico": "Pausa.", "objetivo_pedagogico": "Comprender.",
        "visual": {"tipo": "ppt_concepto", "titulo": "Idea", "puntos_clave": ["a", "b"]},
        "palabra_clave_imagen": "network router", "citas": [cita],
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
    if instr.startswith("Eres el examinador"):
        return "C"
    if instr.startswith("Eres el editor de locución"):
        return "AJUSTE"
    return "B2"


class Simulador:
    """Responde por tarea; registra el orden de llegada y la simultaneidad."""

    def __init__(self, respuestas=None, retrasos=None):
        self.respuestas = {"A": salida_a, "B1": salida_b1, "B2": salida_b2, "C": salida_c, **(respuestas or {})}
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
    assert sorted(t for t, _ in sim.peticiones) == ["A", "B1", "B2", "C"]
    assert sim.max_en_vuelo == 3  # B no espera a A
    assert sim.peticiones[-1][0] == "C"  # el cuestionario, al final


def test_el_cuestionario_pregunta_por_lo_que_ensenaron_las_otras_estaciones():
    sim = Simulador()
    respuesta, _ = _generar(sim)
    instr = next(c["system_instruction"] for t, c in sim.peticiones if t == "C")
    temario = instr.split("TEMARIO ENSEÑADO:", 1)[1]
    assert "NAT Gateway: Salida de subredes privadas." in temario        # estación 1
    assert "¿Por dónde sale una subred privada? → NAT Gateway." in temario  # estación 2
    assert "Crear swap: Crea el archivo." in temario                     # estación 3
    assert "ESTACIÓN 4 · VIDEO" in temario
    assert respuesta.contenido_adaptado.estado_recursos["cuestionario"].tarea == "C"


def test_sin_estaciones_previas_no_se_genera_el_cuestionario():
    error = lambda: httpx.Response(400, json={"error": {"message": "x"}})  # noqa: E731
    sim = Simulador(respuestas={"A": error, "B1": error, "B2": error})
    with pytest.raises(GeneracionParalelaError):
        _generar(sim)
    assert "C" not in [t for t, _ in sim.peticiones]


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
    assert modelos == {"A": "modelo-resumen", "B1": "otro-modelo-lite", "B2": "otro-modelo-lite",
                       "C": "otro-modelo-lite"}
    assert all(cuerpo["store"] is False for _, cuerpo in sim.peticiones)


def _saturado():
    return httpx.Response(503, json={"error": {"message": "high demand"}})


def test_modelo_saturado_pasa_al_respaldo_sin_reintentar():
    sim = Simulador()
    original = sim.__call__

    async def por_modelo(request):
        if json.loads(request.content)["model"] == "modelo-resumen":
            sim.peticiones.append(("A", json.loads(request.content)))
            return _saturado()
        return await original(request)

    respuesta, eventos = _generar(por_modelo)
    assert [c["model"] for t, c in sim.peticiones if t == "A"] == ["modelo-resumen", "respaldo-resumen"]
    estado = respuesta.contenido_adaptado.estado_recursos["resumen"]
    assert estado.estado == "completado" and estado.modelo == "respaldo-resumen"
    # Visible en la barra del recurso y en las advertencias del paquete
    respaldo = "generado con el modelo de respaldo respaldo-resumen porque modelo-resumen no respondió"
    assert respaldo in estado.avisos
    assert any(respaldo in a for a in respuesta.advertencias)
    assert all(respaldo not in a for a in respuesta.contenido_adaptado.estado_recursos["flashcards"].avisos)
    aviso = next(e for e in eventos if e["tipo"] == "tarea" and e["estado"] == "respaldo")
    assert aviso == {"tipo": "tarea", "tarea": "A", "estado": "respaldo", "modelo": "respaldo-resumen",
                     "modelo_principal": "modelo-resumen", "error_codigo": "servidor"}


def test_error_de_la_peticion_no_gasta_el_respaldo():
    sim = Simulador(respuestas={"A": lambda: httpx.Response(400, json={"error": {"message": "x"}})})
    respuesta, _ = _generar(sim)
    assert [c["model"] for t, c in sim.peticiones if t == "A"] == ["modelo-resumen"]
    assert respuesta.contenido_adaptado.estado_recursos["resumen"].error_codigo == "peticion_invalida"


def test_sin_respaldo_configurado_falla_como_antes():
    sim = Simulador(respuestas={"B1": _saturado})
    config = replace(CONFIG, gemini_resources_fallback_model=None)
    respuesta, _ = _generar(sim, config=config)
    assert [c["model"] for t, c in sim.peticiones if t == "B1"] == ["modelo-recursos"]
    assert respuesta.contenido_adaptado.estado_recursos["flashcards"].error_codigo == "servidor"


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


def test_las_citas_verificadas_llevan_el_contexto_real_para_el_visor():
    respuesta, _ = _generar(Simulador())
    c = respuesta.contenido_adaptado
    contexto = c.resumen_ninja["conceptos_clave"][1]["fuente"]["contexto"]  # NAT Gateway, página 2
    assert contexto["fragmento"] == C2
    # No cruza a otras páginas: lo que rodea la cita es solo de la página 2
    assert (contexto["antes"] + contexto["fragmento"] + contexto["despues"]).strip() == P2.strip()
    # La cita inventada no tiene contexto: el visor no muestra nada que no esté en el documento
    assert "contexto" not in c.flashcards[-1]["fuente"]


def test_guion_reutiliza_el_contrato_de_tiempos():
    respuesta, _ = _generar(Simulador())
    spec = respuesta.contenido_adaptado.video_job_spec
    assert spec.total_palabras == 120 and spec.duracion_total_estimada <= 60
    assert [e.origen for e in spec.escenas] == ["llm"] * 3
    assert [e.fuentes[0].pagina for e in spec.escenas] == [1, 2, 3]
    assert spec.estado == "contract_ready"  # la narración es bajo demanda, no se lanza aquí


def test_las_citas_verificadas_del_guion_llevan_contexto_para_el_visor_de_la_estacion_4():
    respuesta, _ = _generar(Simulador())
    escena = respuesta.contenido_adaptado.video_job_spec.escenas[1]  # cita de la página 2
    fuente = escena.fuentes[0]
    assert fuente.verificada and fuente.contexto is not None
    assert fuente.contexto.fragmento in P2
    assert (fuente.contexto.antes + fuente.contexto.fragmento + fuente.contexto.despues).strip() == P2.strip()
    # Viaja también en el director_cut que recibe el front
    assert respuesta.contenido_adaptado.director_cut[1]["fuentes"][0]["contexto"]["fragmento"] == fuente.contexto.fragmento


def test_una_cita_del_guion_no_verificada_no_lleva_contexto():
    from app.agentes.generacion_paralela import _normalizador

    crudas = [{"id": "sc-1", "titulo": "T", "guion_locutor": "Texto de la escena.",
               "fuentes": [{"chunk_id": "x", "texto_fuente": "Esta frase no aparece en ningún documento real"}]}]
    escenas, _ = _normalizador()._normalizar_director_cut(crudas, SOLICITUD)
    assert not escenas[0].fuentes[0].verificada and escenas[0].fuentes[0].contexto is None


def _avisos_guion(eventos):
    return next(e["estado"]["avisos"] for e in eventos if e["tipo"] == "recurso" and e["recurso"] == "guion")


def test_guion_dentro_del_rango_no_gasta_la_llamada_de_ajuste():
    sim = Simulador()
    _generar(sim)
    assert "AJUSTE" not in [t for t, _ in sim.peticiones]


def test_guion_largo_se_acorta_antes_de_publicar_y_se_avisa():
    acortado = lambda: {"guiones": [_palabras(38, f"c{i}p") for i in range(1, 4)]}  # noqa: E731
    sim = Simulador({"B2": lambda: salida_b2(palabras_escena=50), "AJUSTE": acortado})
    respuesta, eventos = _generar(sim)
    spec = respuesta.contenido_adaptado.video_job_spec
    assert spec.total_palabras == 114 and spec.escenas[0].guion_locutor.startswith("c1p0")
    assert any("acortado por IA de 150 a 114 palabras" in a for a in _avisos_guion(eventos))
    # Solo recibe el guion, no el documento: barata y sin material para añadir contenido
    (cuerpo,) = [c for t, c in sim.peticiones if t == "AJUSTE"]
    assert "e1p0" in json.dumps(cuerpo) and "NAT Gateway" not in json.dumps(cuerpo)
    # Los demás recursos de B2 no cambian
    assert "tutorial" in _recursos(eventos) and "diagrama" in _recursos(eventos)


@pytest.mark.parametrize("ajuste", [
    lambda: {"guiones": [_palabras(45, "x") for _ in range(3)]},   # 135: sigue largo
    lambda: {"guiones": [_palabras(30, "x")]},                      # faltan escenas
    lambda: httpx.Response(503, json={"error": {"code": 503, "status": "UNAVAILABLE"}}),
])
def test_si_el_ajuste_no_cumple_queda_el_guion_original_con_aviso(ajuste):
    sim = Simulador({"B2": lambda: salida_b2(palabras_escena=50), "AJUSTE": ajuste})
    respuesta, eventos = _generar(sim)
    assert respuesta.contenido_adaptado.video_job_spec.total_palabras == 150
    avisos = _avisos_guion(eventos)
    assert any("no se pudo acortar" in a for a in avisos)
    assert any("150 palabras (objetivo 110-125)" in a for a in avisos)


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


def test_repetir_con_todo_reutilizado_no_vuelve_a_auditar():
    from app.servicios.registro_tareas import RegistroMemoria

    registro, auditor, sim = RegistroMemoria(max_filas=100), Auditor(), Simulador()
    primera, _ = _generar(sim, auditor=auditor, registro=registro)
    peticiones = len(sim.peticiones)
    segunda, eventos = _generar(sim, auditor=auditor, registro=registro)
    assert len(sim.peticiones) == peticiones  # ninguna llamada nueva a Gemini
    assert len(auditor.llamadas) == 1  # ni al auditor: mismo veredicto
    assert segunda.evaluacion_calidad.anclaje_fuente_score == primera.evaluacion_calidad.anclaje_fuente_score
    assert any(e["tipo"] == "tarea" and e["estado"] == "reutilizada" for e in eventos)


def test_una_auditoria_fallida_no_se_recuerda():
    from app.servicios.registro_tareas import RegistroMemoria

    registro = RegistroMemoria(max_filas=100)
    _generar(Simulador(), auditor=Auditor({"auditoria_ejecutada": False}), registro=registro)
    auditor = Auditor()
    _generar(Simulador(), auditor=auditor, registro=registro)
    assert len(auditor.llamadas) == 1  # se reintenta en la siguiente generación


# --- Resiliencia y procedencia de 429 -------------------------------------------------
def test_respaldo_indica_cuota_diaria_y_no_gasta_llamada_posterior():
    limpiar_modelos_agotados()
    sim = Simulador()
    original = sim.__call__

    def _429_diario():
        return httpx.Response(429, json={
            "error": {
                "code": 429,
                "message": "Resource has been exhausted (check quota)",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [{"quotaId": "GenerateRequestsPerDay"}],
                    }
                ],
            }
        })

    async def por_modelo(request):
        cuerpo = json.loads(request.content)
        if cuerpo["model"] == "modelo-resumen":
            sim.peticiones.append(("A", cuerpo))
            return _429_diario()
        return await original(request)

    respuesta, eventos = _generar(por_modelo)
    assert [c["model"] for t, c in sim.peticiones if t == "A"] == ["modelo-resumen", "respaldo-resumen"]
    estado = respuesta.contenido_adaptado.estado_recursos["resumen"]
    assert estado.estado == "completado" and estado.modelo == "respaldo-resumen"
    aviso_esperado = "generado con el modelo de respaldo respaldo-resumen porque modelo-resumen no respondió (cuota diaria)"
    assert aviso_esperado in estado.avisos
    assert any(aviso_esperado in a for a in respuesta.advertencias)
    assert modelo_esta_agotado("modelo-resumen") is True

    # Segunda ejecución: el modelo-resumen no se llama ni una sola vez porque está agotado en memoria
    peticiones_antes = len(sim.peticiones)
    respuesta2, eventos2 = _generar(por_modelo)
    peticiones_a = [c["model"] for t, c in sim.peticiones[peticiones_antes:] if t == "A"]
    assert peticiones_a == ["respaldo-resumen"]  # directo al respaldo
    estado2 = respuesta2.contenido_adaptado.estado_recursos["resumen"]
    assert aviso_esperado in estado2.avisos
    limpiar_modelos_agotados()


def test_respaldo_indica_cuota_por_minuto_cuando_falla():
    limpiar_modelos_agotados()
    sim = Simulador()
    original = sim.__call__

    def _429_minuto():
        return httpx.Response(429, json={
            "error": {
                "code": 429,
                "message": "Quota exceeded per minute",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [{"quotaId": "GenerateRequestsPerMinute"}],
                    },
                    {
                        "@type": "type.googleapis.com/google.rpc.RetryInfo",
                        "retryDelay": "25s",
                    },
                ],
            }
        })

    async def por_modelo(request):
        cuerpo = json.loads(request.content)
        if cuerpo["model"] == "modelo-resumen":
            sim.peticiones.append(("A", cuerpo))
            return _429_minuto()
        return await original(request)

    respuesta, eventos = _generar(por_modelo)
    estado = respuesta.contenido_adaptado.estado_recursos["resumen"]
    assert estado.estado == "completado" and estado.modelo == "respaldo-resumen"
    aviso_esperado = "generado con el modelo de respaldo respaldo-resumen porque modelo-resumen no respondió (cuota por minuto)"
    assert aviso_esperado in estado.avisos
    assert any(aviso_esperado in a for a in respuesta.advertencias)
    assert modelo_esta_agotado("modelo-resumen") is False


def test_respaldo_cuerpo_desconocido_mantiene_aviso_original():
    limpiar_modelos_agotados()
    sim = Simulador()
    original = sim.__call__

    async def por_modelo(request):
        cuerpo = json.loads(request.content)
        if cuerpo["model"] == "modelo-resumen":
            sim.peticiones.append(("A", cuerpo))
            return httpx.Response(429, text="Too Many Requests")
        return await original(request)

    respuesta, eventos = _generar(por_modelo)
    estado = respuesta.contenido_adaptado.estado_recursos["resumen"]
    assert estado.estado == "completado" and estado.modelo == "respaldo-resumen"
    aviso_esperado = "generado con el modelo de respaldo respaldo-resumen porque modelo-resumen no respondió"
    assert aviso_esperado in estado.avisos
    assert modelo_esta_agotado("modelo-resumen") is False


def test_concurrencia_por_modelo_y_jitter_ante_saturacion_respaldo():
    limpiar_modelos_agotados()
    # Las tres tareas comparten el mismo modelo principal y el mismo respaldo
    config_comun = replace(
        CONFIG,
        gemini_summary_model="modelo-comun",
        gemini_resources_model="modelo-comun",
        gemini_summary_fallback_model="respaldo-comun",
        gemini_resources_fallback_model="respaldo-comun",
        gemini_concurrencia_por_modelo=2,
    )

    en_vuelo_por_modelo = {"modelo-comun": 0, "respaldo-comun": 0}
    max_en_vuelo_por_modelo = {"modelo-comun": 0, "respaldo-comun": 0}
    jitters_dormidos = []

    async def dormir_con_registro(s):
        jitters_dormidos.append(s)
        await asyncio.sleep(0.001)

    async def handler(request):
        cuerpo = json.loads(request.content)
        mod = cuerpo["model"]
        en_vuelo_por_modelo[mod] += 1
        max_en_vuelo_por_modelo[mod] = max(max_en_vuelo_por_modelo[mod], en_vuelo_por_modelo[mod])
        await asyncio.sleep(0.02)
        en_vuelo_por_modelo[mod] -= 1

        if mod == "modelo-comun":
            # Todas las tareas fallan con 429 por minuto en el modelo común
            return httpx.Response(429, json={
                "error": {
                    "code": 429,
                    "message": "Resource exhausted",
                    "details": [
                        {"@type": "type.googleapis.com/google.rpc.QuotaFailure",
                         "violations": [{"quotaId": "GenerateRequestsPerMinute"}]},
                        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "20s"}
                    ]
                }
            })
        # En el respaldo: A falla también por saturación (503), pero B1 y B2 entregan recurso
        tarea = tarea_de(request)
        if tarea == "A":
            return httpx.Response(503, json={"error": {"message": "respaldo saturado"}})
        if tarea == "B1":
            return _ok(salida_b1())
        return _ok(salida_b2())

    eventos = []
    async def run():
        cliente = ClienteGemini(CLAVE, transport=httpx.MockTransport(handler), max_reintentos=0,
                                dormir=dormir_con_registro)
        async with cliente:
            gen = GeneradorParalelo(cliente, config_comun, auditor=Auditor(), dormir=dormir_con_registro)
            return await gen.generar(SOLICITUD, eventos.append)

    respuesta = asyncio.run(run())

    # El principal no se limita: las tres tareas de la generación salen a la vez, como siempre.
    # El respaldo, donde caen todas juntas, nunca supera el límite por modelo.
    assert max_en_vuelo_por_modelo["modelo-comun"] == 3
    assert max_en_vuelo_por_modelo["respaldo-comun"] <= 2

    # Se aplicó jitter antes de llamar al respaldo (para las 3 tareas que cayeron a la vez)
    assert len(jitters_dormidos) >= 3
    assert all(0.0 <= j <= 1.5 for j in jitters_dormidos)

    # Aislamiento: A falló en el respaldo sin tumbar los recursos de B1 y B2
    estados = respuesta.contenido_adaptado.estado_recursos
    assert estados["resumen"].estado == "fallido"
    assert estados["flashcards"].estado == "completado"
    assert estados["guion"].estado == "completado"


def test_limite_del_respaldo_es_del_proceso_no_de_cada_generacion():
    """Dos generaciones simultáneas comparten el límite del respaldo (antes era uno por petición)."""
    config_comun = replace(
        CONFIG,
        gemini_summary_model="principal-x", gemini_resources_model="principal-x",
        gemini_summary_fallback_model="respaldo-x", gemini_resources_fallback_model="respaldo-x",
        gemini_concurrencia_por_modelo=2,
    )
    en_vuelo = {"principal-x": 0, "respaldo-x": 0}
    maximo = {"principal-x": 0, "respaldo-x": 0}

    async def handler(request):
        mod = json.loads(request.content)["model"]
        en_vuelo[mod] += 1
        maximo[mod] = max(maximo[mod], en_vuelo[mod])
        await asyncio.sleep(0.02)
        en_vuelo[mod] -= 1
        if mod == "principal-x":
            return httpx.Response(503, json={"error": {"message": "saturado"}})
        tarea = tarea_de(request)
        return _ok(salida_a() if tarea == "A" else salida_b1() if tarea == "B1" else salida_b2())

    async def sin_espera(_s):
        await asyncio.sleep(0)

    async def run():
        cliente = ClienteGemini(CLAVE, transport=httpx.MockTransport(handler), max_reintentos=0,
                                max_concurrencia=10, dormir=sin_espera)
        async with cliente:
            def gen(prop):
                return GeneradorParalelo(cliente, config_comun, auditor=Auditor(), dormir=sin_espera,
                                         propietario=prop)
            # Otro documento, para que la segunda generación no se una a las tareas en vuelo de la primera
            otra = SOLICITUD.model_copy(update={"documento_contenido": DOCUMENTO + " Segunda versión."})
            return await asyncio.gather(gen("u1").generar(SOLICITUD), gen("u2").generar(otra))

    asyncio.run(run())
    assert maximo["principal-x"] == 6  # 3 tareas x 2 generaciones, sin límite
    assert maximo["respaldo-x"] <= 2   # 6 tareas en el respaldo, como mucho 2 a la vez


# ---------------------------------------------------------------------------
# Directivas de nivel de detalle
# ---------------------------------------------------------------------------
def test_cada_nivel_de_detalle_tiene_directiva():
    from typing import get_args

    from app.core.schemas import DIRECTIVAS_NIVEL_DETALLE, NivelDetalle

    assert set(DIRECTIVAS_NIVEL_DETALLE) == set(get_args(NivelDetalle))
    # El nivel profundo no puede empujar al modelo a inventar comandos o cifras
    assert "no lo inventes" in DIRECTIVAS_NIVEL_DETALLE["Profundo"]


def test_las_instrucciones_de_audiencia_llevan_la_directiva_del_nivel():
    from app.agentes.generacion_paralela import _instrucciones_audiencia
    from app.core.schemas import DIRECTIVAS_NIVEL_DETALLE

    profundo = SOLICITUD.model_copy(update={"nivel_detalle": "Profundo"})
    assert DIRECTIVAS_NIVEL_DETALLE["Profundo"] in _instrucciones_audiencia(profundo)
    assert DIRECTIVAS_NIVEL_DETALLE["Didáctico"] not in _instrucciones_audiencia(profundo)


def test_el_sector_se_limita_a_analogias_y_no_cambia_lo_que_dice_el_documento():
    # Prueba de nichos del 14/10: el guion de Leyes narraba «para cumplir la normativa optimizamos…»
    from app.agentes.generacion_paralela import _LIMITE_SECTOR, _TAREA_A, _TAREA_B2, _instrucciones_audiencia

    leyes = SOLICITUD.model_copy(update={"nicho_sector": "Leyes y Legal"})
    general = SOLICITUD.model_copy(update={"nicho_sector": "General"})
    assert _LIMITE_SECTOR in _instrucciones_audiencia(leyes)
    assert _LIMITE_SECTOR not in _instrucciones_audiencia(general)
    assert "Narra solo hechos del documento" in _TAREA_B2 and "UNA escena" in _TAREA_B2
    assert "sin presentarlo como escrito para su sector" in _TAREA_A


def test_cambiar_una_directiva_de_audiencia_invalida_la_huella(monkeypatch):
    from app.agentes import generacion_paralela as gp

    tarea = gp.tareas_para(CONFIG)[0]
    antes = gp.huella_tarea(SOLICITUD, tarea)
    monkeypatch.setitem(gp.DIRECTIVAS_NIVEL_DETALLE, SOLICITUD.nivel_detalle, "Otra directiva.")
    assert gp.huella_tarea(SOLICITUD, tarea) != antes
