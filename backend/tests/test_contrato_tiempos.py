"""
Contrato de la Estación 04: modelo de tiempo único y procedencia honesta.

El fixture dorado contracts/fixtures/director_cut_golden.json se comparte con
frontend/tests/microclassTiming.test.ts: si la fórmula diverge entre lados,
falla uno de los dos.
"""

import json
from pathlib import Path

import pytest

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.core.schemas import (
    AlmacenamientoOCI,
    EscenaDirectorCut,
    EvaluacionCalidad,
    SolicitudAdaptacion,
    VideoJobSpec,
    contar_palabras,
    duracion_locucion,
    formatear_tramo,
)

FIXTURE = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "director_cut_golden.json"
CASOS = json.loads(FIXTURE.read_text(encoding="utf-8"))["casos"]

DOCUMENTO = (
    "El kernel de Linux administra la memoria swap en disco para evitar errores OOM. "
    "Cuando la memoria RAM se agota, las páginas inactivas se trasladan al archivo de intercambio. "
    "En OCI Always Free conviene crear un archivo swap de dos gigabytes en instancias pequeñas."
)
GUION_40 = " ".join(("palabra " * 40).split())


def _escena(n: int, guion: str, **extra) -> dict:
    return {
        "id": f"sc-{n}",
        "escena": n,
        "tiempo": "00:00 - 00:18",
        "titulo": f"Escena {n}",
        "guion_locutor": guion,
        "storyboard_visual": "Plano",
        "consejo_pedagogico": "Consejo",
        **extra,
    }


@pytest.fixture
def solicitud() -> SolicitudAdaptacion:
    return SolicitudAdaptacion(
        documento_titulo="Memoria Swap en OCI",
        documento_contenido=DOCUMENTO,
        perfil_destinatario="Principiante",
        formato_salida="Paquete Educativo Completo (5 Estaciones)",
        nicho_sector="Tecnología e Informática",
    )


@pytest.fixture
def cadena() -> CadenaColaborativaMultiModelo:
    return CadenaColaborativaMultiModelo()


# ---------------------------------------------------------------------------
# Modelo de tiempo (fixture dorado compartido con el frontend)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("caso", CASOS, ids=[c["nombre"] for c in CASOS])
def test_fixture_dorado_funciones(caso):
    esperado = caso["esperado"]
    palabras = [contar_palabras(g) for g in caso["guiones"]]
    duraciones = [duracion_locucion(p, caso["wpm"]) for p in palabras]
    assert palabras == esperado["palabras"]
    assert duraciones == esperado["duraciones"]


@pytest.mark.parametrize("caso", CASOS, ids=[c["nombre"] for c in CASOS])
def test_fixture_dorado_video_job_spec(caso):
    spec = VideoJobSpec(
        video_job_id="vjob-test",
        document_id="doc-test",
        wpm=caso["wpm"],
        escenas=[_escena(i, g) for i, g in enumerate(caso["guiones"], start=1)],
    )
    esperado = caso["esperado"]
    assert [e.estimacion_palabras for e in spec.escenas] == esperado["palabras"]
    assert [e.duracion_segundos for e in spec.escenas] == esperado["duraciones"]
    assert [e.tiempo for e in spec.escenas] == esperado["tiempos"]
    assert spec.total_palabras == esperado["total_palabras"]
    assert spec.duracion_total_estimada == esperado["duracion_total"]


def test_spec_descarta_totales_y_estimaciones_inconsistentes():
    """Valores entrantes del LLM o de un cliente nunca sobreviven al validador."""
    spec = VideoJobSpec(
        video_job_id="vjob-x",
        document_id="doc-x",
        wpm=160,
        total_palabras=999,
        duracion_total_estimada=1.0,
        escenas=[_escena(1, GUION_40, estimacion_palabras=28, duracion_segundos=18.0)],
    )
    assert spec.escenas[0].estimacion_palabras == 40
    assert spec.escenas[0].duracion_segundos == duracion_locucion(40, 160) == 15.0
    assert spec.total_palabras == 40
    assert spec.duracion_total_estimada == 15.0


def test_escena_aislada_usa_wpm_base():
    escena = EscenaDirectorCut.model_validate(_escena(1, GUION_40, estimacion_palabras=28, duracion_segundos=18.0))
    assert escena.estimacion_palabras == 40
    assert escena.duracion_segundos == 17.4


def test_formatear_tramo():
    assert formatear_tramo(0, 17.4) == "00:00 - 00:17"
    assert formatear_tramo(59.9, 62.5) == "00:59 - 01:02"


# ---------------------------------------------------------------------------
# Normalizador: entradas defectuosas del LLM no tumban la cadena
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "escena_cruda",
    [
        {"guion_locutor": GUION_40, "estimacion_palabras": "40 palabras"},
        {"guion_locutor": GUION_40, "titulo": "   "},
        {"guion_locutor": GUION_40, "fuentes": [{"chunk_id": "x", "texto_fuente": "   "}]},
        {"guion_locutor": GUION_40, "duracion_segundos": "dieciocho"},
        {"guion_locutor": GUION_40, "fuentes": "no es lista"},
    ],
    ids=["estimacion_texto", "titulo_blanco", "fuente_blanca", "duracion_texto", "fuentes_no_lista"],
)
def test_normalizador_repara_sin_excepcion(cadena, solicitud, escena_cruda):
    paquete = cadena._normalizar_paquete_base({"director_cut": [escena_cruda]}, solicitud)
    escena = paquete["director_cut"][0]
    assert escena["estimacion_palabras"] == 40
    assert escena["duracion_segundos"] == 17.4


def test_escena_sin_guion_se_sustituye_por_plantilla(cadena, solicitud):
    paquete = cadena._normalizar_paquete_base(
        {"director_cut": [_escena(1, GUION_40), {"titulo": "sin guion"}]}, solicitud
    )
    origenes = [e["origen"] for e in paquete["director_cut"]]
    assert origenes == ["llm", "plantilla"]
    assert "escena_2_plantilla" in paquete["video_job_spec"]["degradaciones"]


def test_puntos_clave_string_se_separa(cadena, solicitud):
    paquete = cadena._normalizar_paquete_base(
        {"director_cut": [{"guion_locutor": GUION_40, "visual": {"tipo": "ppt_concepto", "titulo": "T", "puntos_clave": "Swap, OOM; RAM"}}]},
        solicitud,
    )
    assert paquete["director_cut"][0]["visual"]["puntos_clave"] == ["Swap", "OOM", "RAM"]


def test_truncado_de_escenas_queda_registrado(cadena, solicitud):
    paquete = cadena._normalizar_paquete_base({"director_cut": [_escena(i, GUION_40) for i in range(1, 6)]}, solicitud)
    assert len(paquete["director_cut"]) == 3
    assert "escenas_truncadas_5_a_3" in paquete["video_job_spec"]["degradaciones"]


def test_plantilla_marcada_y_dentro_de_presupuesto(cadena, solicitud):
    paquete = cadena._normalizar_paquete_base({}, solicitud)
    spec = paquete["video_job_spec"]
    assert all(e["origen"] == "plantilla" for e in paquete["director_cut"])
    assert "director_cut_plantilla" in spec["degradaciones"]
    assert 110 <= spec["total_palabras"] <= 125
    assert spec["duracion_total_estimada"] <= 60


# ---------------------------------------------------------------------------
# Procedencia de las citas
# ---------------------------------------------------------------------------
def test_cita_literal_se_verifica_e_inventada_no(cadena, solicitud):
    fuentes = [
        {"chunk_id": "c1", "texto_fuente": "las páginas inactivas  se trasladan AL archivo de intercambio"},
        {"chunk_id": "c2", "texto_fuente": "Kubernetes reinicia los pods automáticamente cada hora"},
    ]
    paquete = cadena._normalizar_paquete_base({"director_cut": [_escena(1, GUION_40, fuentes=fuentes)]}, solicitud)
    resultado = paquete["director_cut"][0]["fuentes"]
    assert [(f["origen"], f["verificada"]) for f in resultado] == [("llm", True), ("llm", False)]
    assert resultado[0]["pagina"] is None  # no se inventa página


def test_sin_citas_se_usa_extracto_real_no_verificado(cadena, solicitud):
    paquete = cadena._normalizar_paquete_base({"director_cut": [_escena(1, GUION_40)]}, solicitud)
    fuente = paquete["director_cut"][0]["fuentes"][0]
    assert fuente["origen"] == "extracto_automatico"
    assert fuente["verificada"] is False
    assert fuente["texto_fuente"] in DOCUMENTO  # oración real, completa, del documento
    assert "escena_1_fuentes_automaticas" in paquete["video_job_spec"]["degradaciones"]


def test_renormalizacion_es_idempotente(cadena, solicitud):
    """La segunda pasada (tras Cohere) no puede blanquear la procedencia."""
    primera = cadena._normalizar_paquete_base({}, solicitud)
    segunda = cadena._normalizar_paquete_base(primera, solicitud)
    assert [e["origen"] for e in segunda["director_cut"]] == ["plantilla"] * 3
    assert all(not f["verificada"] for e in segunda["director_cut"] for f in e["fuentes"])
    assert set(primera["video_job_spec"]["degradaciones"]) <= set(segunda["video_job_spec"]["degradaciones"])


# ---------------------------------------------------------------------------
# Auditoría: sin scores inventados
# ---------------------------------------------------------------------------
def test_evaluacion_respeta_score_explicito():
    assert EvaluacionCalidad(anclaje_fuente_score=0.62).anclaje_fuente_score == 0.62


def test_evaluacion_no_ejecutada_no_tiene_score():
    ev = EvaluacionCalidad(anclaje_fuente_score=0.99, auditoria_ejecutada=False)
    assert ev.anclaje_fuente_score is None


def test_auditor_sin_clave_no_inventa_score(cadena, solicitud):
    cadena.groq_key = None
    resultado = cadena._paso2_auditar_con_groq({}, DOCUMENTO)
    assert resultado["auditoria_ejecutada"] is False
    assert resultado["anclaje_fuente_score"] is None


def test_ejecutar_con_auditor_caido_marca_advertencia(cadena, solicitud, monkeypatch):
    monkeypatch.setattr(cadena, "_paso1_generar_con_gemini", lambda s: {"director_cut": [_escena(1, GUION_40)]})
    monkeypatch.setattr(cadena, "_paso3_humanizar_con_cohere", lambda p, s: p)

    def auditor_caido(*_):
        raise TimeoutError("groq timeout")

    monkeypatch.setattr(cadena, "_paso2_auditar_con_groq", auditor_caido)
    monkeypatch.setattr(
        cadena, "_persistir_en_oci", lambda *a, **k: AlmacenamientoOCI(status_upload="omitido")
    )

    respuesta = cadena.ejecutar(solicitud)

    assert respuesta.status == "exito_con_advertencias"
    assert respuesta.evaluacion_calidad.auditoria_ejecutada is False
    assert respuesta.evaluacion_calidad.anclaje_fuente_score is None
    assert respuesta.orquestacion.scores_por_intento == []
    assert any("auditoría de fidelidad no se ejecutó" in a for a in respuesta.advertencias)
