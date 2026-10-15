"""
Ampliación de una escena del teleprompter (Estación 4): "Profundizar concepto" (guion) y
"Enriquecer con IA" (puesta en escena). Idea de origin/feature/newmind-edtech-oci, que llamaba a
Gemini desde el navegador con la clave a la vista; aquí la llamada es del servidor.

Reglas:
- El guion ampliado sale SOLO de los pasajes literales del documento (citas verificadas) y del
  guion breve. Sin pasajes no se llama al modelo: "sin_material". El modelo también puede
  responder que no alcanzan, en vez de inventar.
- La propuesta visual es creativa, pero no puede afirmar datos que no estén en la escena.
- Todo lo que devuelve es texto de IA no verificado (origen "ia_ampliado"); el navegador lo marca.
- Caché en memoria por huella: la misma escena no se vuelve a pagar mientras el proceso viva.
- Plazo total corto (sin SSE): principal con una parte del tiempo y, si falla por cuota,
  saturación o salida defectuosa, el modelo de respaldo con el resto.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import OrderedDict
from typing import Optional

from pydantic import BaseModel, Field

from app.core.schemas import RespuestaAmpliacion, SolicitudAmpliacion, contar_palabras
from app.servicios.servicio_gemini import ClienteGemini, GeminiError, modelo_esta_agotado

logger = logging.getLogger("nuevamente.ampliacion")

# Sube este número si cambian los prompts o las comprobaciones: invalida la caché.
VERSION_AMPLIACION = 2
MAX_CACHE = 256
TIMEOUT_PRINCIPAL_S = 18.0
TIMEOUT_RESPALDO_S = 12.0
MAX_PALABRAS = {"guion": 230, "visual": 130}

_REGLAS_COMUNES = """- Escribe en español, en prosa continua: sin viñetas, sin markdown, sin encabezados, sin asteriscos y sin URLs.
- No añadas cifras, nombres, comandos, productos, fechas ni ejemplos que no aparezcan en la escena o en los pasajes."""

_AMPLIAR_GUION = f"""Eres el docente de NuevaMente. Amplías el texto del teleprompter de una escena para que el estudiante comprenda el concepto con más calma.
Recibes la escena (título, guion breve y consejo pedagógico) y PASAJES LITERALES del documento original.
- Explica únicamente lo que dicen los pasajes y el guion breve: puedes reformular, ordenar las ideas, definir con palabras sencillas los términos que aparecen y relacionarlas entre sí y con el guion.
- No añadas causas, consecuencias ni metáforas que los pasajes no sostengan.
- La longitud depende del material: entre 60 y 180 palabras, en 1 a 3 párrafos, pensado para leerse en voz alta. Con pasajes breves, escribe una ampliación breve; es preferible a negarse.
- Responde suficiente=false (y texto vacío) solo si los pasajes no tratan el tema de la escena.
{_REGLAS_COMUNES}"""

_AMPLIAR_VISUAL = f"""Eres el director de arte de una clase en video de NuevaMente. Propones cómo mostrar en pantalla una escena.
- Un solo párrafo de entre 60 y 90 palabras.
- Describe el encuadre o plano, la ambientación y la paleta de color, los elementos en pantalla y una metáfora visual que ayude a entender la idea de la escena.
- Es una propuesta creativa: no afirmes nada técnico que no esté en el guion o en los pasajes, y no pongas texto ni cifras dentro de la imagen.
- Responde suficiente=false solo si la escena no tiene contenido que mostrar.
{_REGLAS_COMUNES}"""


class SalidaAmpliacion(BaseModel):
    suficiente: bool = Field(..., description="false si el material no alcanza para cumplir las reglas sin inventar")
    texto: str = Field("", description="La ampliación; vacía si suficiente es false")


_CACHE: "OrderedDict[str, RespuestaAmpliacion]" = OrderedDict()


def vaciar_cache() -> None:
    """Para los tests."""
    _CACHE.clear()


def huella_ampliacion(solicitud: SolicitudAmpliacion, modelo: str) -> str:
    base = {"version": VERSION_AMPLIACION, "modelo": modelo, **solicitud.model_dump()}
    return hashlib.sha256(json.dumps(base, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _entrada(solicitud: SolicitudAmpliacion) -> str:
    e = solicitud.escena
    partes = [f"TÍTULO DE LA ESCENA: {e.titulo}", f"GUION BREVE: {e.guion_locutor}"]
    if e.consejo_pedagogico:
        partes.append(f"CONSEJO PEDAGÓGICO: {e.consejo_pedagogico}")
    if e.storyboard_visual:
        partes.append(f"DESCRIPCIÓN VISUAL ACTUAL: {e.storyboard_visual}")
    if e.pasajes:
        partes.append("PASAJES LITERALES DEL DOCUMENTO:\n" + "\n\n".join(
            f"[{i}] {p}" for i, p in enumerate(e.pasajes, start=1)))
    return "\n\n".join(partes)


def _pasa_al_respaldo(exc: GeminiError) -> bool:
    return exc.reintentable or exc.codigo in ("modelo_no_encontrado", "rate_limit")


_MENSAJES_ERROR = {
    "rate_limit": "La cuota de Gemini está agotada por ahora. Prueba de nuevo en un minuto.",
    "timeout": "El modelo no respondió a tiempo. Prueba de nuevo.",
}


class AmpliadorEscenas:
    def __init__(self, cliente: ClienteGemini, modelo: str, respaldo: Optional[str] = None):
        self._cliente = cliente
        self._modelo = modelo
        self._respaldo = respaldo if respaldo and respaldo != modelo else None

    async def ampliar(self, solicitud: SolicitudAmpliacion) -> RespuestaAmpliacion:
        if solicitud.tipo == "guion" and not solicitud.escena.pasajes:
            # Sin texto del documento no hay de dónde ampliar: no se gasta cuota.
            return RespuestaAmpliacion(
                status="sin_material",
                mensaje="Esta escena no tiene citas verificadas del documento, así que no hay material para profundizar sin inventar.",
            )
        clave = huella_ampliacion(solicitud, self._modelo)
        if clave in _CACHE:
            _CACHE.move_to_end(clave)
            return _CACHE[clave].model_copy(update={"desde_cache": True})

        respuesta = await self._llamar(solicitud)
        if respuesta.status != "error":
            _CACHE[clave] = respuesta
            while len(_CACHE) > MAX_CACHE:
                _CACHE.popitem(last=False)
        return respuesta

    async def _llamar(self, solicitud: SolicitudAmpliacion) -> RespuestaAmpliacion:
        instrucciones = _AMPLIAR_GUION if solicitud.tipo == "guion" else _AMPLIAR_VISUAL
        entrada = _entrada(solicitud)

        async def con(modelo: str, timeout_s: float, reintentos: int):
            r = await self._cliente.generar_json(
                modelo=modelo, instrucciones=instrucciones, entrada=entrada, esquema_salida=SalidaAmpliacion,
                thinking_level="minimal", timeout_s=timeout_s, max_reintentos=reintentos,
            )
            return r.datos, r.uso.modelo

        try:
            if self._respaldo and modelo_esta_agotado(self._modelo):
                datos, modelo = await con(self._respaldo, TIMEOUT_RESPALDO_S, 0)
            else:
                try:
                    datos, modelo = await con(self._modelo, TIMEOUT_PRINCIPAL_S, 0 if self._respaldo else 1)
                except GeminiError as exc:
                    if not (self._respaldo and _pasa_al_respaldo(exc)):
                        raise
                    logger.warning("Ampliación: %s falló (%s); se usa %s.", self._modelo, exc.codigo, self._respaldo)
                    datos, modelo = await con(self._respaldo, TIMEOUT_RESPALDO_S, 0)
        except GeminiError as exc:
            logger.warning("Ampliación (%s) sin respuesta: %s.", solicitud.tipo, exc.codigo)
            return RespuestaAmpliacion(
                status="error", mensaje=_MENSAJES_ERROR.get(exc.codigo, "No se pudo generar la ampliación. Prueba de nuevo."))

        texto = datos.texto.strip()
        if not datos.suficiente or not texto:
            return RespuestaAmpliacion(
                status="sin_material", modelo=modelo,
                mensaje="El documento no da material suficiente para ampliar esta escena sin inventar.")
        if contar_palabras(texto) > MAX_PALABRAS[solicitud.tipo]:
            return RespuestaAmpliacion(status="error", modelo=modelo,
                                       mensaje="La ampliación salió demasiado larga. Prueba de nuevo.")
        return RespuestaAmpliacion(status="exito", texto=texto, modelo=modelo)
