"""
Proveedores de voz del video narrado, con una interfaz común (Sintetizador).

Orden de uso (lo decide el narrador): ElevenLabs → Gemini TTS. Una narración completa
se hace siempre con UN proveedor, para que las escenas no cambien de voz.

ElevenLabs (verificado el 2026-10-13 con la API real, plan free de 10 000 créditos/mes):
- eleven_flash_v2_5 cuesta 0,5 créditos por carácter: una narración de 60 s ≈ 375 créditos.
- /with-timestamps devuelve el tiempo de cada carácter: el teleprompter resalta la palabra
  exacta en lugar de estimarla.
- mp3_22050_32 (MP3 CBR de 32 kbps): ~240 KB por minuto, frente a ~2,8 MB del WAV de Gemini.
- A velocidad 1.0 habla ~125 palabras/min: el guion de 110-125 palabras rozaría los 60 s,
  por eso la velocidad natural es 1.1 y la "rápida" 1.2 (el máximo que admite la API).
- Si los créditos no alcanzan se avisa ANTES de llamar (y la API también lo rechaza:
  401 quota_exceeded); en ambos casos el narrador pasa a Gemini.
"""

from __future__ import annotations

import asyncio
import base64
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Sequence

import httpx

from app.core.schemas import contar_palabras
from app.servicios.servicio_gemini import ClienteGemini, GeminiError, sanear

URL_ELEVENLABS = "https://api.elevenlabs.io"
FORMATO_MP3 = "mp3_22050_32"
KBPS_MP3 = 32
# Créditos por carácter según el modelo (GET /v1/models → model_rates.character_cost_multiplier)
_MULTIPLICADOR_CREDITOS = {
    "eleven_flash_v2_5": 0.5, "eleven_turbo_v2_5": 0.5, "eleven_v4_turbo": 0.5,
    "eleven_multilingual_v2": 1.0, "eleven_v3": 1.0, "eleven_v4": 1.0,
}

ESTILO_NATURAL = "Narrador educativo en español neutro, claro y cercano."
ESTILO_AGIL = "Narrador educativo en español neutro, ritmo ágil y claro, sin pausas largas."
VELOCIDAD_NATURAL, VELOCIDAD_AGIL = 1.1, 1.2


@dataclass
class VozGenerada:
    audio: bytes
    mime_type: str
    extension: str
    duracion_s: float
    proveedor: str
    modelo: str
    voz: str
    # Fin (s) de cada palabra del texto, en el orden de contar_palabras; None si no se conoce
    tiempos_palabras: Optional[List[float]] = None


class ErrorVoz(Exception):
    """Fallo saneado de un proveedor de voz. Siempre permite probar el siguiente proveedor."""

    def __init__(self, codigo: str, mensaje: str):
        super().__init__(f"{codigo}: {mensaje}")
        self.codigo = codigo
        self.mensaje = sanear(mensaje)


class Sintetizador(Protocol):
    proveedor: str
    nombre: str  # para mostrar al usuario
    # Cada escena se cobra: el narrador pide primero la más larga sola para no pagar escenas que descartaría
    cobra_por_escena: bool

    @property
    def identidad(self) -> str:
        """Proveedor, modelo, voz y ajustes: entra en la huella de reutilización."""

    async def sin_presupuesto(self, textos: Sequence[str]) -> Optional[str]:
        """Aviso si no alcanza el presupuesto para estos textos (sin gastar nada); None si alcanza."""

    async def sintetizar(self, texto: str, *, rapido: bool = False) -> VozGenerada: ...

    async def aclose(self) -> None: ...


# --------------------------------------------------------------------- Gemini
class VozGemini:
    proveedor = "gemini"
    cobra_por_escena = False  # cuota gratuita: todas las escenas a la vez, sin esperar

    def __init__(self, cliente: ClienteGemini, modelo: str, voz: str = "Kore", *, timeout_s: float = 90.0):
        self._cliente, self._modelo, self._voz, self._timeout_s = cliente, modelo, voz, timeout_s
        self.nombre = f"Gemini ({voz})"

    @property
    def identidad(self) -> str:
        return f"gemini|{self._modelo}|{self._voz}|{ESTILO_NATURAL}|{ESTILO_AGIL}"

    async def sin_presupuesto(self, textos: Sequence[str]) -> Optional[str]:
        return None  # la cuota de Gemini no se puede consultar: se sabe al llamar (429)

    async def sintetizar(self, texto: str, *, rapido: bool = False) -> VozGenerada:
        try:
            audio = await self._cliente.sintetizar_voz(
                modelo=self._modelo, texto=texto, voz=self._voz,
                estilo=ESTILO_AGIL if rapido else ESTILO_NATURAL, timeout_s=self._timeout_s,
            )
        except GeminiError as exc:
            raise ErrorVoz(exc.codigo, exc.mensaje) from None
        return VozGenerada(
            audio=audio.wav, mime_type=audio.mime_type, extension="wav", duracion_s=audio.duracion_s,
            proveedor=self.proveedor, modelo=audio.uso.modelo, voz=self._voz,
        )

    async def aclose(self) -> None:
        return None  # el cliente Gemini es compartido por el proceso


# --------------------------------------------------------------------- ElevenLabs
def tiempos_por_palabra(texto: str, caracteres: List[str], fines: List[float]) -> Optional[List[float]]:
    """
    Fin de cada palabra a partir de la alineación por carácter. Se cortan las palabras con
    los mismos separadores que contar_palabras (y splitWords en el frontend), así el índice
    i corresponde a la palabra i del teleprompter. Si no cuadra, None: mejor estimar que mentir.
    """
    if len(caracteres) != len(fines) or not caracteres:
        return None
    tiempos: List[float] = []
    en_palabra = False
    for caracter, fin in zip(caracteres, fines):
        if contar_palabras(caracter) == 0:  # separador según el mismo criterio
            en_palabra = False
            continue
        if en_palabra:
            tiempos[-1] = fin
        else:
            tiempos.append(fin)
            en_palabra = True
    if len(tiempos) != contar_palabras(texto):
        return None
    return [round(t, 3) for t in tiempos]


def duracion_mp3_cbr(datos: bytes, kbps: int = KBPS_MP3) -> float:
    """Duración de un MP3 de tasa constante: bytes * 8 / bits por segundo."""
    return len(datos) * 8 / (kbps * 1000)


class VozElevenLabs:
    proveedor = "elevenlabs"
    cobra_por_escena = True

    def __init__(
        self,
        api_key: str,
        *,
        modelo: str = "eleven_flash_v2_5",
        voz_id: str,
        voz_nombre: str,
        # Una escena tarda ~1 s; 25 s deja al respaldo (Gemini) más de la mitad del plazo total
        timeout_s: float = 25.0,
        concurrencia: int = 2,  # el plan free admite pocas peticiones simultáneas
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        if not api_key:
            raise ErrorVoz("sin_clave", "ELEVENLABS_API_KEY no está configurada en el backend.")
        self._modelo, self._voz_id, self._voz_nombre = modelo, voz_id, voz_nombre
        self.nombre = f"ElevenLabs ({voz_nombre})"
        self._semaforo = asyncio.Semaphore(concurrencia)
        self._http = httpx.AsyncClient(
            base_url=URL_ELEVENLABS, headers={"xi-api-key": api_key}, timeout=timeout_s,
            transport=transport, trust_env=False,
        )

    @property
    def identidad(self) -> str:
        return f"elevenlabs|{self._modelo}|{self._voz_id}|{VELOCIDAD_NATURAL}|{VELOCIDAD_AGIL}|{FORMATO_MP3}"

    def creditos(self, textos: Sequence[str]) -> int:
        return math.ceil(sum(len(t) for t in textos) * _MULTIPLICADOR_CREDITOS.get(self._modelo, 1.0))

    async def sin_presupuesto(self, textos: Sequence[str]) -> Optional[str]:
        # Se presupuesta el peor caso: todas las escenas repetidas una vez con ritmo ágil.
        necesarios = 2 * self.creditos(textos)
        try:
            r = await self._http.get("/v1/user/subscription")
            r.raise_for_status()
            datos = r.json()
            restantes = int(datos["character_limit"]) - int(datos["character_count"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return None  # sin dato no se bloquea: la API rechazará si de verdad no alcanza
        if necesarios > restantes:
            return (f"ElevenLabs: quedan {restantes} créditos y esta narración puede necesitar "
                    f"hasta {necesarios}; se usó la voz de respaldo.")
        return None

    async def sintetizar(self, texto: str, *, rapido: bool = False) -> VozGenerada:
        cuerpo = {
            "text": texto, "model_id": self._modelo, "language_code": "es",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75,
                               "speed": VELOCIDAD_AGIL if rapido else VELOCIDAD_NATURAL},
        }
        try:
            async with self._semaforo:
                r = await self._http.post(
                    f"/v1/text-to-speech/{self._voz_id}/with-timestamps",
                    params={"output_format": FORMATO_MP3}, json=cuerpo,
                )
        except httpx.TimeoutException:
            raise ErrorVoz("timeout", "ElevenLabs no respondió a tiempo.") from None
        except httpx.TransportError as exc:
            raise ErrorVoz("red", type(exc).__name__) from None
        if r.status_code != 200:
            raise _error_elevenlabs(r)
        try:
            datos = r.json()
            audio = base64.b64decode(datos["audio_base64"], validate=True)
            alineacion = datos.get("alignment") or {}
            caracteres = list(alineacion.get("characters") or [])
            fines = [float(x) for x in alineacion.get("character_end_times_seconds") or []]
        except (ValueError, KeyError, TypeError):
            raise ErrorVoz("audio_invalido", "ElevenLabs devolvió una respuesta ilegible.") from None
        if not audio:
            raise ErrorVoz("audio_invalido", "ElevenLabs devolvió un audio vacío.")
        # Lo que suena es el archivo completo (incluye el silencio final): se toma la mayor.
        duracion = round(max(duracion_mp3_cbr(audio), fines[-1] if fines else 0.0), 3)
        return VozGenerada(
            audio=audio, mime_type="audio/mpeg", extension="mp3", duracion_s=duracion,
            proveedor=self.proveedor, modelo=self._modelo, voz=self._voz_nombre,
            tiempos_palabras=tiempos_por_palabra(texto, caracteres, fines),
        )

    async def aclose(self) -> None:
        await self._http.aclose()


def _error_elevenlabs(r: httpx.Response) -> ErrorVoz:
    detalle: Dict[str, Any] = {}
    try:
        cuerpo = r.json().get("detail")
        detalle = cuerpo if isinstance(cuerpo, dict) else {"message": str(cuerpo or "")}
    except ValueError:
        pass
    estado = str(detalle.get("status") or detalle.get("code") or "")
    mensaje = str(detalle.get("message") or f"HTTP {r.status_code}")
    # El tope de créditos puede ser de la cuenta o de la clave (p. ej. 1 000 por clave). El de la
    # clave no aparece en /v1/user/subscription, así que solo se sabe por este rechazo.
    if estado in ("quota_exceeded", "insufficient_credits") or any(
            p in f"{estado} {mensaje}".lower() for p in ("quota", "credit")):
        return ErrorVoz("sin_creditos", "Se agotaron los créditos de ElevenLabs.")
    if r.status_code in (401, 403):
        return ErrorVoz("no_autorizado", mensaje)
    if r.status_code == 429:
        return ErrorVoz("rate_limit", mensaje)
    if r.status_code >= 500:
        return ErrorVoz("servidor", mensaje)
    return ErrorVoz("peticion_invalida", mensaje)
