"""
Cliente asíncrono de Gemini (Interactions API, POST /v1beta/interactions).

Formato verificado el 2026-10-12 contra la documentación oficial y llamadas reales:
- Texto: steps[type="model_output"].content[type="text"].text (puede venir precedido
  de un step "thought", que se ignora).
- Audio (TTS, unario): content[type="audio"] con `data` base64 de un WAV (RIFF),
  mono, 16 bits, 24 kHz.
- Error HTTP: {"error": {"message": ..., "code": ...}}.

Garantías:
- La clave solo viaja en la cabecera `x-goog-api-key`; nunca en logs ni en errores.
- `store: false` en todas las llamadas: Google no conserva el contenido del documento.
- Timeout por llamada, reintentos limitados con backoff (respeta Retry-After / RetryInfo
  en 429 y 5xx) y un límite de llamadas simultáneas por cliente (cuota por proyecto).
- Las respuestas JSON se validan contra un modelo Pydantic antes de devolverse.
"""

from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import random
import re
import time
import wave
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Generic, List, Optional, Tuple, Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

logger = logging.getLogger("novamind.servicio_gemini")

URL_BASE = "https://generativelanguage.googleapis.com/v1beta"
_ESTADOS_REINTENTABLES = {429, 500, 502, 503, 504}
_MAX_ESPERA_S = 30.0
# Voz (TTS): espera máxima por una cuota por minuto. La narración tiene 80 s de plazo en total.
ESPERA_MAX_CUOTA_MINUTO_VOZ_S = 45.0
_PATRON_CLAVE = re.compile(r"AIza[0-9A-Za-z_\-]{20,}")

M = TypeVar("M", bound=BaseModel)

# Modelos con cuota diaria agotada en memoria del proceso hasta la medianoche del Pacífico
_MODELOS_AGOTADOS_HASTA: Dict[str, float] = {}


def proxima_medianoche_pacifico() -> float:
    """Calcula el timestamp UTC de la próxima medianoche en hora del Pacífico (00:00:00 PT)."""
    try:
        from zoneinfo import ZoneInfo
        tz_pt = ZoneInfo("America/Los_Angeles")
        ahora_pt = datetime.now(tz_pt)
        medianoche_pt = (ahora_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return medianoche_pt.timestamp()
    except Exception:
        return time.time() + 86400.0


def marcar_modelo_agotado(modelo: str, hasta_ts: Optional[float] = None) -> None:
    """Marca un modelo como agotado en memoria del proceso hasta la medianoche del Pacífico."""
    if hasta_ts is None:
        hasta_ts = proxima_medianoche_pacifico()
    _MODELOS_AGOTADOS_HASTA[modelo] = hasta_ts
    logger.warning("[gemini] Modelo %s marcado como agotado hasta timestamp %.0f (medianoche Pacífico)", modelo, hasta_ts)


def modelo_esta_agotado(modelo: str) -> bool:
    """True si el modelo tiene su cuota diaria agotada en la memoria del proceso."""
    hasta = _MODELOS_AGOTADOS_HASTA.get(modelo)
    if hasta is None:
        return False
    if time.time() >= hasta:
        _MODELOS_AGOTADOS_HASTA.pop(modelo, None)
        return False
    return True


def limpiar_modelos_agotados() -> None:
    """Limpia el estado en memoria de modelos agotados (útil para pruebas)."""
    _MODELOS_AGOTADOS_HASTA.clear()


class GeminiError(Exception):
    """
    Error saneado de Gemini. `codigo` es estable y apto para persistir/mostrar:
    sin_clave | timeout | red | rate_limit | servidor | peticion_invalida | no_autorizado |
    modelo_no_encontrado | incompleto | sin_salida | json_invalido | esquema_invalido | audio_invalido
    """

    def __init__(
        self,
        codigo: str,
        mensaje: str,
        *,
        reintentable: bool = False,
        http_status: Optional[int] = None,
        tipo_cuota: Optional[str] = None,
        retry_after_s: Optional[float] = None,
    ):
        super().__init__(f"{codigo}: {mensaje}")
        self.codigo = codigo
        self.mensaje = sanear(mensaje)
        self.reintentable = reintentable
        self.http_status = http_status
        self.tipo_cuota = tipo_cuota  # "cuota_diaria" | "cuota_minuto" | "desconocido" | None
        self.retry_after_s = retry_after_s


def sanear(texto: str, maximo: int = 300) -> str:
    """Quita cualquier cosa con forma de clave y limita la longitud."""
    return _PATRON_CLAVE.sub("[clave-oculta]", str(texto))[:maximo]


@dataclass
class Uso:
    modelo: str
    intentos: int
    latencia_s: float
    tokens_entrada: int = 0
    tokens_salida: int = 0
    motivo_respaldo: Optional[str] = None


@dataclass
class RespuestaJson(Generic[M]):
    datos: M
    uso: Uso


@dataclass
class AudioGenerado:
    wav: bytes
    duracion_s: float
    sample_rate: int
    canales: int
    uso: Uso
    mime_type: str = "audio/wav"


def _segundos_de_espera(respuesta: Optional[httpx.Response], intento: int, espera_base_s: float) -> float:
    """Retry-After (cabecera) o RetryInfo.retryDelay (cuerpo); si no hay, backoff exponencial con jitter."""
    if respuesta is not None:
        cabecera = respuesta.headers.get("retry-after")
        if cabecera:
            try:
                return min(_MAX_ESPERA_S, max(0.0, float(cabecera)))
            except ValueError:
                pass
        try:
            detalles = respuesta.json().get("error", {}).get("details", [])
            for d in detalles if isinstance(detalles, list) else []:
                retraso = d.get("retryDelay") if isinstance(d, dict) else None
                if isinstance(retraso, str) and retraso.endswith("s"):
                    return min(_MAX_ESPERA_S, max(0.0, float(retraso[:-1])))
                elif isinstance(retraso, (int, float)):
                    return min(_MAX_ESPERA_S, max(0.0, float(retraso)))
        except (ValueError, AttributeError):
            pass
    return min(_MAX_ESPERA_S, espera_base_s * (2 ** intento) + random.uniform(0, espera_base_s))


def _clasificar_cuota_429(respuesta: httpx.Response) -> Tuple[str, Optional[float]]:
    """
    Clasifica un 429 según details de google.rpc.QuotaFailure y google.rpc.RetryInfo:
    Retorna (tipo_cuota, retry_after_s).
    tipo_cuota: "cuota_diaria" | "cuota_minuto" | "desconocido"
    """
    tipo_cuota = "desconocido"
    retry_after_s: Optional[float] = None

    try:
        cuerpo = respuesta.json()
    except Exception:
        cuerpo = {}

    err = cuerpo.get("error", {}) if isinstance(cuerpo, dict) else {}
    detalles = err.get("details", []) if isinstance(err, dict) else []
    if not isinstance(detalles, list):
        detalles = []

    for d in detalles:
        if not isinstance(d, dict):
            continue
        # 1. RetryInfo
        retraso = d.get("retryDelay")
        if isinstance(retraso, str) and retraso.endswith("s"):
            try:
                retry_after_s = float(retraso[:-1])
            except ValueError:
                pass
        elif isinstance(retraso, (int, float)):
            retry_after_s = float(retraso)

        # 2. QuotaFailure: si alguna violación es diaria, gana la diaria aunque también haya
        # violaciones por minuto (reintentar un modelo sin cuota del día solo gasta tiempo).
        violaciones = d.get("violations")
        for v in violaciones if isinstance(violaciones, list) else []:
            if not isinstance(v, dict):
                continue
            texto_violacion = f"{v.get('quotaId', '')} {v.get('description', '')}".lower()
            if any(k in texto_violacion for k in ("perday", "per_day", "per day")):
                tipo_cuota = "cuota_diaria"
            elif tipo_cuota == "desconocido" and any(
                k in texto_violacion for k in ("perminute", "per_minute", "per minute")
            ):
                tipo_cuota = "cuota_minuto"

    if retry_after_s is None:
        cabecera = respuesta.headers.get("retry-after")
        if cabecera:
            try:
                retry_after_s = float(cabecera)
            except ValueError:
                pass

    if tipo_cuota == "desconocido" and isinstance(err, dict):
        msg = str(err.get("message", "")).lower()
        if any(k in msg for k in ("perday", "per_day", "per day")):
            tipo_cuota = "cuota_diaria"
        elif any(k in msg for k in ("perminute", "per_minute", "per minute")):
            tipo_cuota = "cuota_minuto"

    return tipo_cuota, retry_after_s


def _error_http(respuesta: httpx.Response, modelo: Optional[str] = None) -> GeminiError:
    try:
        mensaje = respuesta.json().get("error", {}).get("message", "")
    except ValueError:
        mensaje = ""
    estado = respuesta.status_code
    mensaje = mensaje or f"HTTP {estado}"
    if estado == 429:
        tipo_cuota, retry_after_s = _clasificar_cuota_429(respuesta)
        if tipo_cuota == "cuota_diaria":
            if modelo:
                marcar_modelo_agotado(modelo)
            return GeminiError(
                "rate_limit",
                mensaje,
                reintentable=False,
                http_status=estado,
                tipo_cuota="cuota_diaria",
                retry_after_s=retry_after_s,
            )
        elif tipo_cuota == "cuota_minuto":
            return GeminiError(
                "rate_limit",
                mensaje,
                reintentable=True,
                http_status=estado,
                tipo_cuota="cuota_minuto",
                retry_after_s=retry_after_s,
            )
        else:
            return GeminiError(
                "rate_limit",
                mensaje,
                reintentable=True,
                http_status=estado,
                tipo_cuota="desconocido",
                retry_after_s=retry_after_s,
            )
    if estado >= 500:
        return GeminiError("servidor", mensaje, reintentable=estado in _ESTADOS_REINTENTABLES, http_status=estado)
    if estado in (401, 403):
        return GeminiError("no_autorizado", mensaje, http_status=estado)
    if estado == 404:
        return GeminiError("modelo_no_encontrado", mensaje, http_status=estado)
    return GeminiError("peticion_invalida", mensaje, http_status=estado)


def _contenidos_de_salida(cuerpo: Dict[str, Any], tipo: str) -> List[Dict[str, Any]]:
    estado = cuerpo.get("status")
    if estado != "completed":
        # incomplete (p. ej. max_output_tokens) o failed: no es un error transitorio
        raise GeminiError("incompleto", f"La interacción terminó con estado '{estado}'.")
    return [
        c
        for paso in cuerpo.get("steps") or []
        if isinstance(paso, dict) and paso.get("type") == "model_output"
        for c in paso.get("content") or []
        if isinstance(c, dict) and c.get("type") == tipo
    ]


def _uso(cuerpo: Dict[str, Any], modelo: str, intentos: int, inicio: float) -> Uso:
    usage = cuerpo.get("usage") or {}
    return Uso(
        modelo=modelo,
        intentos=intentos,
        latencia_s=round(time.perf_counter() - inicio, 3),
        tokens_entrada=int(usage.get("total_input_tokens") or 0),
        tokens_salida=int(usage.get("total_output_tokens") or 0),
    )


def entrada_con_archivo(texto: str, datos: bytes, mime_type: str) -> List[Dict[str, Any]]:
    """
    Entrada multimodal: texto + archivo inline (imagen o PDF). Verificado el 2026-10-13:
    content[type="image"|"document"] con `data` base64 y `mime_type`.
    """
    tipo = "document" if mime_type == "application/pdf" else "image"
    return [{"type": "user_input", "content": [
        {"type": "text", "text": texto},
        {"type": tipo, "data": base64.b64encode(datos).decode("ascii"), "mime_type": mime_type},
    ]}]


class ClienteGemini:
    """Un cliente por proceso: su semáforo limita las llamadas simultáneas a la cuota del proyecto."""

    def __init__(
        self,
        api_key: Optional[str],
        *,
        timeout_s: float = 60.0,
        max_reintentos: int = 2,
        espera_base_s: float = 1.0,
        max_concurrencia: int = 3,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        dormir=asyncio.sleep,
    ):
        if not api_key:
            raise GeminiError("sin_clave", "GEMINI_API_KEY no está configurada en el backend.")
        self._timeout_s = timeout_s
        self._max_reintentos = max_reintentos
        self._espera_base_s = espera_base_s
        self._semaforo = asyncio.Semaphore(max_concurrencia)
        self._dormir = dormir
        self._http = httpx.AsyncClient(
            base_url=URL_BASE,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            transport=transport,
            trust_env=False,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "ClienteGemini":
        return self

    async def __aexit__(self, *_exc) -> None:
        await self.aclose()

    # ------------------------------------------------------------------ núcleo
    async def _interactuar(self, cuerpo: Dict[str, Any], *, timeout_s: Optional[float], procesar,
                           max_reintentos: Optional[int] = None,
                           espera_max_cuota_minuto_s: float = 10.0, reintentos_cuota_minuto_max: int = 1):
        """POST con reintentos. `procesar(json, intentos, inicio)` puede lanzar GeminiError reintentable."""
        reintentos = self._max_reintentos if max_reintentos is None else max_reintentos
        modelo = cuerpo["model"]
        cuerpo = {**cuerpo, "store": False}
        inicio = time.perf_counter()

        if modelo_esta_agotado(modelo):
            raise GeminiError(
                "rate_limit",
                f"El modelo {modelo} tiene su cuota diaria agotada hasta la medianoche del Pacífico.",
                reintentable=False,
                http_status=429,
                tipo_cuota="cuota_diaria",
            )

        ultimo: Optional[GeminiError] = None
        intentos = 0
        reintentos_cuota_minuto = 0
        while True:
            intentos += 1
            respuesta: Optional[httpx.Response] = None
            try:
                async with self._semaforo:
                    respuesta = await self._http.post(
                        "/interactions", json=cuerpo, timeout=timeout_s or self._timeout_s
                    )
                if respuesta.status_code != 200:
                    raise _error_http(respuesta, modelo=modelo)
                return procesar(respuesta.json(), intentos, inicio)
            except GeminiError as exc:
                ultimo = exc
            except httpx.TimeoutException:
                ultimo = GeminiError("timeout", f"Sin respuesta en {timeout_s or self._timeout_s:.0f}s.", reintentable=True)
            except httpx.TransportError as exc:
                ultimo = GeminiError("red", type(exc).__name__, reintentable=True)
            except ValueError:
                ultimo = GeminiError("sin_salida", "La respuesta no es JSON.", reintentable=True)

            logger.warning(
                "[gemini] %s intento %d falló: %s (http=%s, tipo_cuota=%s)",
                modelo, intentos, ultimo.codigo, ultimo.http_status, getattr(ultimo, "tipo_cuota", None),
            )

            # Cuota diaria: nunca reintentar ese modelo
            if getattr(ultimo, "tipo_cuota", None) == "cuota_diaria":
                break

            # Cuota por minuto: reintentar si retryDelay cabe en la espera máxima y queda plazo; si no,
            # pasar al respaldo. Por defecto 1 vez y ≤ 10 s (la generación tiene modelo de respaldo).
            if getattr(ultimo, "tipo_cuota", None) == "cuota_minuto":
                retraso_s = (
                    ultimo.retry_after_s
                    if ultimo.retry_after_s is not None
                    else _segundos_de_espera(respuesta, intentos - 1, self._espera_base_s)
                )
                limite_s = timeout_s or self._timeout_s
                plazo_restante = limite_s - (time.perf_counter() - inicio)
                if (reintentos_cuota_minuto < reintentos_cuota_minuto_max and retraso_s <= espera_max_cuota_minuto_s
                        and plazo_restante > (retraso_s + 1.0)):
                    reintentos_cuota_minuto += 1
                    await self._dormir(retraso_s)
                    continue
                else:
                    break

            # Otros errores reintentables o cuota desconocida: mantener comportamiento actual
            if not ultimo.reintentable or (intentos - 1) >= reintentos:
                break
            await self._dormir(_segundos_de_espera(respuesta, intentos - 1, self._espera_base_s))
        assert ultimo is not None
        raise ultimo

    # ------------------------------------------------------------------ texto JSON
    async def generar_json(
        self,
        *,
        modelo: str,
        instrucciones: str,
        entrada: str | List[Dict[str, Any]],
        esquema_salida: Type[M],
        timeout_s: Optional[float] = None,
        thinking_level: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
        max_reintentos: Optional[int] = None,
    ) -> RespuestaJson[M]:
        """
        Genera JSON con esquema estructurado y lo valida con `esquema_salida` (Pydantic).
        `max_reintentos` sustituye al del cliente (0 si hay un modelo de respaldo esperando).
        `entrada` es texto o una entrada multimodal (`entrada_con_archivo`).
        """
        config: Dict[str, Any] = {}
        if thinking_level:
            config["thinking_level"] = thinking_level
        if max_output_tokens:
            config["max_output_tokens"] = max_output_tokens
        cuerpo: Dict[str, Any] = {
            "model": modelo,
            "system_instruction": instrucciones,
            "input": entrada,
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": esquema_json(esquema_salida),
            },
        }
        if config:
            cuerpo["generation_config"] = config

        def procesar(cuerpo_resp: Dict[str, Any], intentos: int, inicio: float) -> RespuestaJson[M]:
            textos = [c.get("text") or "" for c in _contenidos_de_salida(cuerpo_resp, "text")]
            texto = "".join(textos).strip()
            if not texto:
                raise GeminiError("sin_salida", "El modelo no devolvió texto.", reintentable=True)
            try:
                crudo = json.loads(texto)
            except json.JSONDecodeError:
                raise GeminiError("json_invalido", "La salida no es JSON válido.", reintentable=True) from None
            try:
                datos = esquema_salida.model_validate(crudo)
            except ValidationError as exc:
                campos = ", ".join(".".join(str(p) for p in e["loc"]) for e in exc.errors()[:5])
                raise GeminiError("esquema_invalido", f"Campos inválidos: {campos}", reintentable=True) from None
            uso = _uso(cuerpo_resp, modelo, intentos, inicio)
            logger.info("[gemini] %s ok en %.1fs (%d→%d tokens, %d intento/s)",
                        modelo, uso.latencia_s, uso.tokens_entrada, uso.tokens_salida, intentos)
            return RespuestaJson(datos=datos, uso=uso)

        return await self._interactuar(cuerpo, timeout_s=timeout_s, procesar=procesar,
                                       max_reintentos=max_reintentos)

    # ------------------------------------------------------------------ voz
    async def sintetizar_voz(
        self,
        *,
        modelo: str,
        texto: str,
        voz: str = "Kore",
        estilo: Optional[str] = None,
        timeout_s: Optional[float] = None,
    ) -> AudioGenerado:
        """Texto → WAV (unario). `estilo` va como anotación speech_metadata, no dentro del texto."""
        contenido: Dict[str, Any] = {"type": "text", "text": texto}
        if estilo:
            contenido["annotations"] = [{"type": "speech_metadata", "style": estilo}]
        cuerpo = {
            "model": modelo,
            "input": [{"type": "user_input", "content": [contenido]}],
            "response_format": {"type": "audio", "mime_type": "audio/wav"},
            "generation_config": {"speech_config": [{"voice": voz}]},
        }

        def procesar(cuerpo_resp: Dict[str, Any], intentos: int, inicio: float) -> AudioGenerado:
            audios = _contenidos_de_salida(cuerpo_resp, "audio")
            if not audios or not audios[-1].get("data"):
                raise GeminiError("sin_salida", "El modelo no devolvió audio.", reintentable=True)
            try:
                wav = base64.b64decode(audios[-1]["data"], validate=True)
                with wave.open(io.BytesIO(wav)) as w:
                    frames, hz, canales = w.getnframes(), w.getframerate(), w.getnchannels()
            except (ValueError, wave.Error, EOFError):
                raise GeminiError("audio_invalido", "El audio recibido no es un WAV válido.", reintentable=True) from None
            if hz <= 0 or frames <= 0:
                raise GeminiError("audio_invalido", "El WAV recibido está vacío.", reintentable=True)
            return AudioGenerado(
                wav=wav,
                duracion_s=round(frames / hz, 3),
                sample_rate=hz,
                canales=canales,
                uso=_uso(cuerpo_resp, modelo, intentos, inicio),
            )

        # La voz de Gemini es el último proveedor del servidor: ante una cuota por minuto conviene
        # esperar a que se renueve (el plazo de la narración la acota). Prueba en OCI del 14/10:
        # 429 por minuto en las 3 escenas y la narración se rindió con ~60 s de plazo libres.
        return await self._interactuar(cuerpo, timeout_s=timeout_s, procesar=procesar,
                                       espera_max_cuota_minuto_s=ESPERA_MAX_CUOTA_MINUTO_VOZ_S,
                                       reintentos_cuota_minuto_max=2)


# --------------------------------------------------------------------- esquemas
_CLAVES_SOPORTADAS = {
    "type", "properties", "required", "items", "enum", "description", "title",
    "minimum", "maximum", "minItems", "maxItems", "additionalProperties", "anyOf", "format",
}


def esquema_json(modelo: Type[BaseModel]) -> Dict[str, Any]:
    """
    JSON Schema de un modelo Pydantic, con $ref resueltos y solo palabras clave
    documentadas como soportadas (Pydantic añade otras como `default` o `maxLength`;
    esos límites se siguen validando en el lado servidor con Pydantic).
    """
    crudo = modelo.model_json_schema()
    definiciones = crudo.get("$defs", {})

    def limpiar(nodo: Any) -> Any:
        if isinstance(nodo, dict):
            if "$ref" in nodo:
                return limpiar(definiciones[nodo["$ref"].split("/")[-1]])
            salida = {}
            for clave, valor in nodo.items():
                if clave not in _CLAVES_SOPORTADAS:
                    continue
                if clave == "properties":
                    salida[clave] = {k: limpiar(v) for k, v in valor.items()}
                elif clave in ("items", "additionalProperties") and isinstance(valor, dict):
                    salida[clave] = limpiar(valor)
                elif clave == "anyOf":
                    salida[clave] = [limpiar(v) for v in valor]
                else:
                    salida[clave] = valor
            return salida
        return nodo

    return limpiar({k: v for k, v in crudo.items() if k != "$defs"})
