"""
Etapa 2 · Cliente Gemini (Interactions API) con transporte simulado: sin red ni coste.
Las formas de respuesta replican las observadas en llamadas reales (2026-10-12).
"""

import asyncio
import base64
import io
import json
import logging
import wave
from typing import List

import httpx
import pytest
from pydantic import BaseModel, Field

from app.servicios.servicio_gemini import (
    ClienteGemini,
    GeminiError,
    esquema_json,
    limpiar_modelos_agotados,
    modelo_esta_agotado,
)

CLAVE = "AIzaClaveDePruebaQueNoDebeFiltrarse1234567"


class Concepto(BaseModel):
    concepto: str = Field(..., min_length=3)
    etiquetas: List[str] = Field(default_factory=list, max_length=5)


def _ok_texto(texto: str) -> httpx.Response:
    return httpx.Response(200, json={
        "status": "completed",
        "steps": [
            {"type": "thought", "signature": "xyz"},
            {"type": "model_output", "content": [{"type": "text", "text": texto}]},
        ],
        "usage": {"total_input_tokens": 12, "total_output_tokens": 30},
    })


def _wav(segundos: float = 1.5, hz: int = 24000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(hz)
        w.writeframes(b"\x00\x00" * int(segundos * hz))
    return buf.getvalue()


def _ok_audio(wav: bytes) -> httpx.Response:
    return httpx.Response(200, json={
        "status": "completed",
        "steps": [{"type": "model_output", "content": [
            {"type": "audio", "mime_type": "audio/wav", "data": base64.b64encode(wav).decode()}
        ]}],
        "usage": {"total_input_tokens": 9, "total_output_tokens": 61},
    })


class Guion:
    """Transporte que devuelve respuestas en orden y registra las peticiones."""

    def __init__(self, respuestas):
        self.respuestas = list(respuestas)
        self.peticiones: List[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.peticiones.append(request)
        r = self.respuestas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def _cliente(guion, esperas=None, **kw) -> ClienteGemini:
    async def dormir(s):
        if esperas is not None:
            esperas.append(s)

    return ClienteGemini(CLAVE, transport=httpx.MockTransport(guion), dormir=dormir, espera_base_s=0.01, **kw)


def _json(cliente, modelo="gemini-3.5-flash-lite", **kw):
    async def run():
        async with cliente:
            return await cliente.generar_json(
                modelo=modelo, instrucciones="i", entrada="e", esquema_salida=Concepto, **kw
            )

    return asyncio.run(run())


# --- Éxito y formato de petición --------------------------------------------------
def test_generar_json_ok_ignora_thought_y_valida():
    guion = Guion([_ok_texto('{"concepto": "Memoria swap", "etiquetas": ["linux"]}')])
    r = _json(_cliente(guion), thinking_level="minimal")
    assert r.datos.concepto == "Memoria swap"
    assert (r.uso.modelo, r.uso.intentos, r.uso.tokens_entrada, r.uso.tokens_salida) == ("gemini-3.5-flash-lite", 1, 12, 30)
    cuerpo = json.loads(guion.peticiones[0].content)
    assert cuerpo["store"] is False  # Google no conserva el documento
    assert cuerpo["response_format"]["mime_type"] == "application/json"
    assert cuerpo["generation_config"] == {"thinking_level": "minimal"}
    assert guion.peticiones[0].headers["x-goog-api-key"] == CLAVE
    assert guion.peticiones[0].url.path == "/v1beta/interactions"


def test_esquema_json_solo_usa_palabras_clave_soportadas():
    esquema = esquema_json(Concepto)
    assert esquema["required"] == ["concepto"]
    texto = json.dumps(esquema)
    assert "minLength" not in texto and "default" not in texto and "$ref" not in texto


# --- Reintentos ---------------------------------------------------------------------
def test_429_respeta_retry_after_y_reintenta():
    esperas = []
    guion = Guion([
        httpx.Response(429, headers={"retry-after": "7"}, json={"error": {"message": "quota", "code": "x"}}),
        _ok_texto('{"concepto": "Swap"}'),
    ])
    r = _json(_cliente(guion, esperas))
    assert r.uso.intentos == 2 and esperas == [7.0]


def test_503_usa_retryinfo_del_cuerpo():
    esperas = []
    guion = Guion([
        httpx.Response(503, json={"error": {"message": "busy", "details": [{"retryDelay": "3s"}]}}),
        _ok_texto('{"concepto": "Swap"}'),
    ])
    _json(_cliente(guion, esperas))
    assert esperas == [3.0]


def test_404_no_se_reintenta():
    guion = Guion([httpx.Response(404, json={"error": {"message": "Model not found", "code": "not_found"}})])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion))
    assert exc.value.codigo == "modelo_no_encontrado" and len(guion.peticiones) == 1


def test_json_invalido_y_luego_valido():
    guion = Guion([_ok_texto("{no es json"), _ok_texto('{"concepto": "Swap"}')])
    assert _json(_cliente(guion)).uso.intentos == 2


def test_esquema_invalido_agota_reintentos_limitados():
    guion = Guion([_ok_texto('{"concepto": "x"}')] * 3)  # min_length=3 falla siempre
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion, max_reintentos=2))
    assert exc.value.codigo == "esquema_invalido" and "concepto" in exc.value.mensaje
    assert len(guion.peticiones) == 3


def test_timeout_se_reintenta_y_luego_falla():
    guion = Guion([httpx.ReadTimeout("t")] * 2)
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion, max_reintentos=1))
    assert exc.value.codigo == "timeout" and len(guion.peticiones) == 2


def test_estado_incompleto_no_se_reintenta():
    guion = Guion([httpx.Response(200, json={"status": "incomplete", "steps": []})])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion))
    assert exc.value.codigo == "incompleto" and len(guion.peticiones) == 1


# --- Seguridad de logs y errores ------------------------------------------------------
def test_la_clave_nunca_aparece_en_errores_ni_logs(caplog):
    caplog.set_level(logging.DEBUG, logger="novamind.servicio_gemini")
    guion = Guion([httpx.Response(400, json={"error": {"message": f"API key {CLAVE} inválida"}})])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion))
    assert CLAVE not in str(exc.value.mensaje) and "[clave-oculta]" in exc.value.mensaje
    assert CLAVE not in caplog.text


def test_sin_clave_falla_al_construir():
    with pytest.raises(GeminiError) as exc:
        ClienteGemini("")
    assert exc.value.codigo == "sin_clave"


# --- Concurrencia -------------------------------------------------------------------
def test_limite_de_llamadas_simultaneas():
    en_vuelo = {"ahora": 0, "max": 0}

    async def handler(request):
        en_vuelo["ahora"] += 1
        en_vuelo["max"] = max(en_vuelo["max"], en_vuelo["ahora"])
        await asyncio.sleep(0.02)
        en_vuelo["ahora"] -= 1
        return _ok_texto('{"concepto": "Swap"}')

    async def run():
        async with ClienteGemini(CLAVE, transport=httpx.MockTransport(handler), max_concurrencia=2) as c:
            await asyncio.gather(*[
                c.generar_json(modelo="m", instrucciones="i", entrada="e", esquema_salida=Concepto) for _ in range(6)
            ])

    asyncio.run(run())
    assert en_vuelo["max"] == 2


# --- TTS ----------------------------------------------------------------------------
def test_sintetizar_voz_devuelve_wav_y_duracion_medida():
    guion = Guion([_ok_audio(_wav(1.5))])

    async def run():
        async with _cliente(guion) as c:
            return await c.sintetizar_voz(modelo="gemini-3.8-flash-lite-tts", texto="Hola", estilo="pausado y claro")

    audio = asyncio.run(run())
    assert audio.wav[:4] == b"RIFF" and audio.duracion_s == 1.5 and audio.sample_rate == 24000 and audio.canales == 1
    cuerpo = json.loads(guion.peticiones[0].content)
    assert cuerpo["response_format"] == {"type": "audio", "mime_type": "audio/wav"}
    assert cuerpo["generation_config"] == {"speech_config": [{"voice": "Kore"}]}
    assert cuerpo["input"][0]["content"][0]["annotations"] == [{"type": "speech_metadata", "style": "pausado y claro"}]


def test_audio_corrupto_se_reintenta():
    corrupto = httpx.Response(200, json={"status": "completed", "steps": [{"type": "model_output", "content": [
        {"type": "audio", "data": base64.b64encode(b"no es wav").decode()}]}]})
    guion = Guion([corrupto, _ok_audio(_wav(0.5))])

    async def run():
        async with _cliente(guion) as c:
            return await c.sintetizar_voz(modelo="m", texto="Hola")

    assert asyncio.run(run()).uso.intentos == 2


# --- Clasificación y resiliencia de 429 ------------------------------------------------
def test_429_cuota_diaria_no_reintenta_y_marca_agotado():
    limpiar_modelos_agotados()
    modelo = "gemini-test-cuota-diaria"
    resp_429 = httpx.Response(429, json={
        "error": {
            "code": 429,
            "message": "Resource has been exhausted (check quota)",
            "status": "RESOURCE_EXHAUSTED",
            "details": [
                {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [
                        {
                            "subject": "project:test-proj",
                            "description": "Quota exceeded for quota metric 'Requests per day'",
                            "quotaId": "GenerateRequestsPerDay",
                        }
                    ],
                }
            ],
        }
    })
    guion = Guion([resp_429])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion, max_reintentos=2), modelo=modelo)

    assert exc.value.codigo == "rate_limit"
    assert exc.value.tipo_cuota == "cuota_diaria"
    assert exc.value.reintentable is False
    assert len(guion.peticiones) == 1  # No reintenta
    assert modelo_esta_agotado(modelo) is True

    # La siguiente llamada con el mismo modelo falla de inmediato sin gastar llamada HTTP
    with pytest.raises(GeminiError) as exc2:
        _json(_cliente(guion, max_reintentos=2), modelo=modelo)
    assert exc2.value.tipo_cuota == "cuota_diaria"
    assert len(guion.peticiones) == 1  # Ninguna petición nueva enviada a la red
    limpiar_modelos_agotados()


def test_429_cuota_minuto_reintenta_si_retraso_menor_o_igual_a_10s():
    limpiar_modelos_agotados()
    esperas = []
    resp_429 = httpx.Response(429, json={
        "error": {
            "code": 429,
            "message": "Quota exceeded for quota metric 'Requests per minute'",
            "status": "RESOURCE_EXHAUSTED",
            "details": [
                {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [{"quotaId": "GenerateRequestsPerMinute"}],
                },
                {
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "4s",
                },
            ],
        }
    })
    guion = Guion([resp_429, _ok_texto('{"concepto": "Swap"}')])
    r = _json(_cliente(guion, esperas, max_reintentos=0), modelo="gemini-minuto-ok")
    assert r.uso.intentos == 2
    assert esperas == [4.0]
    assert modelo_esta_agotado("gemini-minuto-ok") is False


def test_429_cuota_minuto_no_reintenta_si_retraso_mayor_a_10s():
    limpiar_modelos_agotados()
    esperas = []
    resp_429 = httpx.Response(429, json={
        "error": {
            "code": 429,
            "message": "Quota exceeded per minute",
            "status": "RESOURCE_EXHAUSTED",
            "details": [
                {
                    "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                    "violations": [{"quotaId": "GenerateRequestsPerMinute"}],
                },
                {
                    "@type": "type.googleapis.com/google.rpc.RetryInfo",
                    "retryDelay": "37s",
                },
            ],
        }
    })
    guion = Guion([resp_429, _ok_texto('{"concepto": "Swap"}')])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion, esperas, max_reintentos=2), modelo="gemini-minuto-largo")

    assert exc.value.codigo == "rate_limit"
    assert exc.value.tipo_cuota == "cuota_minuto"
    assert exc.value.retry_after_s == 37.0
    assert len(guion.peticiones) == 1
    assert esperas == []  # No se quedó esperando 37s


def test_429_cuerpo_ilegible_mantiene_comportamiento():
    limpiar_modelos_agotados()
    esperas = []
    # 429 con cuerpo sin details ni formato RPC
    resp_429 = httpx.Response(429, headers={"retry-after": "5"}, text="Too Many Requests")
    guion = Guion([resp_429, _ok_texto('{"concepto": "Swap"}')])
    r = _json(_cliente(guion, esperas, max_reintentos=2), modelo="gemini-ilegible")
    assert r.uso.intentos == 2
    assert esperas == [5.0]
    assert modelo_esta_agotado("gemini-ilegible") is False


def test_429_con_violaciones_mixtas_gana_la_cuota_diaria():
    """Si Google lista una violación por minuto y otra diaria, el modelo no tiene cuota hoy."""
    modelo = "gemini-test-mixta"
    resp_429 = httpx.Response(429, json={"error": {"code": 429, "message": "exhausted", "details": [
        {"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [
            {"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"},
            {"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"},
        ]},
        {"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "5s"},
    ]}})
    guion = Guion([resp_429])
    with pytest.raises(GeminiError) as exc:
        _json(_cliente(guion, max_reintentos=2), modelo=modelo)
    assert exc.value.tipo_cuota == "cuota_diaria"
    assert len(guion.peticiones) == 1  # ni siquiera el reintento corto de la cuota por minuto
    assert modelo_esta_agotado(modelo) is True
