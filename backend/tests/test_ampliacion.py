"""Ampliación de escenas del teleprompter (Estación 4): Gemini simulado, sin red ni coste."""

import asyncio
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import Principal, require_user
from app.core.schemas import EscenaParaAmpliar, SolicitudAmpliacion
from app.main import app
from app.servicios.servicio_ampliacion import AmpliadorEscenas, SalidaAmpliacion
from app.servicios.servicio_gemini import GeminiError, RespuestaJson, Uso, marcar_modelo_agotado

PRINCIPAL, RESPALDO = "modelo-principal", "modelo-respaldo"
TEXTO = "El documento explica que el swap usa el disco como memoria de reserva. " * 4


class GeminiSimulado:
    """Responde por modelo: una SalidaAmpliacion o una excepción. Guarda cada llamada."""

    def __init__(self, **por_modelo):
        self.por_modelo = por_modelo
        self.llamadas = []

    async def generar_json(self, *, modelo, instrucciones, entrada, esquema_salida, **kw):
        self.llamadas.append({"modelo": modelo, "instrucciones": instrucciones, "entrada": entrada, **kw})
        r = self.por_modelo[modelo]
        if isinstance(r, Exception):
            raise r
        return RespuestaJson(datos=r, uso=Uso(modelo=modelo, intentos=1, latencia_s=0.1))


def _solicitud(tipo="guion", pasajes=("El swap es espacio en disco que el sistema usa como memoria.",)):
    return SolicitudAmpliacion(tipo=tipo, escena=EscenaParaAmpliar(
        titulo="Qué es el swap", guion_locutor="El swap ayuda cuando falta memoria.",
        consejo_pedagogico="Relaciónalo con la RAM.", pasajes=list(pasajes)))


def _ampliar(cliente, solicitud=None, respaldo=RESPALDO):
    return asyncio.run(AmpliadorEscenas(cliente, PRINCIPAL, respaldo).ampliar(solicitud or _solicitud()))


def test_guion_ampliado_con_los_pasajes_en_la_entrada():
    cliente = GeminiSimulado(**{PRINCIPAL: SalidaAmpliacion(suficiente=True, texto=TEXTO)})
    r = _ampliar(cliente)
    assert r.status == "exito" and r.texto == TEXTO.strip() and r.modelo == PRINCIPAL
    assert r.origen == "ia_ampliado" and not r.desde_cache
    entrada = cliente.llamadas[0]["entrada"]
    assert "PASAJES LITERALES DEL DOCUMENTO" in entrada and "espacio en disco" in entrada
    assert "Explica únicamente lo que dicen los pasajes" in cliente.llamadas[0]["instrucciones"]


def test_guion_sin_pasajes_no_gasta_cuota():
    cliente = GeminiSimulado()
    r = _ampliar(cliente, _solicitud(pasajes=()))
    assert r.status == "sin_material" and cliente.llamadas == []


def test_la_visual_no_necesita_pasajes():
    cliente = GeminiSimulado(**{PRINCIPAL: SalidaAmpliacion(suficiente=True, texto="Plano medio de un servidor.")})
    r = _ampliar(cliente, _solicitud(tipo="visual", pasajes=()))
    assert r.status == "exito" and "director de arte" in cliente.llamadas[0]["instrucciones"]


def test_el_modelo_puede_negarse_a_inventar():
    cliente = GeminiSimulado(**{PRINCIPAL: SalidaAmpliacion(suficiente=False, texto="")})
    assert _ampliar(cliente).status == "sin_material"


def test_la_misma_escena_sale_de_la_cache():
    cliente = GeminiSimulado(**{PRINCIPAL: SalidaAmpliacion(suficiente=True, texto=TEXTO)})
    _ampliar(cliente)
    segunda = _ampliar(cliente)
    assert segunda.desde_cache and segunda.texto == TEXTO.strip() and len(cliente.llamadas) == 1
    # otra escena (otro pasaje) sí llama
    _ampliar(cliente, _solicitud(pasajes=("Otro pasaje distinto del documento.",)))
    assert len(cliente.llamadas) == 2


def test_cuota_agotada_pasa_al_respaldo():
    cliente = GeminiSimulado(**{
        PRINCIPAL: GeminiError("rate_limit", "429", reintentable=False),
        RESPALDO: SalidaAmpliacion(suficiente=True, texto=TEXTO),
    })
    r = _ampliar(cliente)
    assert r.status == "exito" and r.modelo == RESPALDO
    assert [c["modelo"] for c in cliente.llamadas] == [PRINCIPAL, RESPALDO]
    assert cliente.llamadas[0]["max_reintentos"] == 0


def test_modelo_agotado_en_memoria_va_directo_al_respaldo():
    marcar_modelo_agotado(PRINCIPAL)
    cliente = GeminiSimulado(**{RESPALDO: SalidaAmpliacion(suficiente=True, texto=TEXTO)})
    assert _ampliar(cliente).modelo == RESPALDO
    assert [c["modelo"] for c in cliente.llamadas] == [RESPALDO]


def test_error_sin_respaldo_no_se_guarda_en_cache():
    cliente = GeminiSimulado(**{PRINCIPAL: GeminiError("timeout", "lento", reintentable=True)})
    r = _ampliar(cliente, respaldo=None)
    assert r.status == "error" and "a tiempo" in r.mensaje
    cliente.por_modelo[PRINCIPAL] = SalidaAmpliacion(suficiente=True, texto=TEXTO)
    assert _ampliar(cliente, respaldo=None).status == "exito"


def test_una_ampliacion_demasiado_larga_se_rechaza():
    cliente = GeminiSimulado(**{PRINCIPAL: SalidaAmpliacion(suficiente=True, texto="palabra " * 400)})
    assert _ampliar(cliente).status == "error"


# --------------------------------------------------------------------- API
@pytest.fixture
def api():
    app.dependency_overrides[require_user] = lambda: Principal(
        "00000000-0000-0000-0000-000000000000", "guest-demo-token", is_guest=True)
    yield TestClient(app)
    app.dependency_overrides.pop(require_user, None)


def test_api_invitado_amplia(api):
    cliente = GeminiSimulado(**{
        "gemini-3.5-flash-lite": SalidaAmpliacion(suficiente=True, texto=TEXTO),
    })
    with patch("app.main._cliente_gemini", return_value=cliente), \
         patch.dict("os.environ", {"GEMINI_RESOURCES_MODEL": "gemini-3.5-flash-lite"}):
        r = api.post("/api/v1/narracion/ampliar", json=_solicitud().model_dump())
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "exito" and r.json()["origen"] == "ia_ampliado"


def test_api_rechaza_un_tipo_desconocido(api):
    datos = _solicitud().model_dump() | {"tipo": "otro"}
    assert api.post("/api/v1/narracion/ampliar", json=datos).status_code == 422
