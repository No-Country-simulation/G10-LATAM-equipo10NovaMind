"""
Fotos del video preparadas por adelantado, mientras se genera el paquete.

En cuanto sale el guion (tarea B2) se buscan las fotos de sus escenas, en paralelo con la
tarea C. Así, cuando el usuario llega a la Estación 4 y pide la voz, las fotos ya están en
el guion y el botón solo espera la voz (el Narrador no busca las escenas que ya traen foto).

Las fotos dudosas (las de Wikimedia, que acertó 1 de 3 en la prueba del 2026-10-13 frente al
3 de 3 de Openverse) las revisa Gemini mirándolas, todas en UNA llamada. Si Gemini no
responde, la foto se queda: ya pasó los filtros de licencia, formato, tema y relevancia.
Una foto descartada deja la escena como diapositiva sin palabra clave (no se vuelve a buscar)
y con un aviso que dice por qué.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx
from pydantic import BaseModel, Field

from app.core.config import Config
from app.core.schemas import ImagenEscena, VideoJobSpec
from app.servicios.servicio_gemini import ClienteGemini, GeminiError
from app.servicios.servicio_imagenes import AGENTE, BuscadorImagenes
from app.servicios.servicio_narracion import buscar_fotos

logger = logging.getLogger("nuevamente.preparacion_fotos")

MAX_BYTES_FOTO = 2_000_000
TIPOS_FOTO = {"image/jpeg", "image/png", "image/webp"}
TIMEOUT_DESCARGA_S = 8.0
TIMEOUT_REVISION_S = 20.0

_INSTRUCCIONES = """Revisas fotos de fondo para las diapositivas de un video educativo.
Cada foto acompaña a una escena (título y texto locutado). Decide para CADA foto si sirve:
- sirve si muestra el objeto, el lugar o la actividad de la escena, o algo directamente relacionado;
- NO sirve si no tiene relación con la escena, si lo principal es texto legible, un logotipo,
  una persona reconocible en primer plano, un acto oficial o un evento, o algo delicado
  (violencia, accidentes, contenido sexual).
Ante la duda razonable sobre el tema, sirve: una foto genérica pero relacionada vale.
El motivo, en español y en menos de 15 palabras."""


class Veredicto(BaseModel):
    foto: int = Field(..., description="Número de la foto, empezando en 1")
    sirve: bool
    motivo: str = Field(..., max_length=200)


class SalidaRevision(BaseModel):
    veredictos: List[Veredicto]


@dataclass
class Candidata:
    titulo: str
    guion: str
    foto: ImagenEscena


class RevisorFotos:
    """Una llamada a Gemini (con modelo de respaldo) para todas las fotos dudosas de un guion."""

    def __init__(self, cliente: ClienteGemini, modelo: str, respaldo: Optional[str] = None, *,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        self._cliente = cliente
        self._modelos = [m for m in dict.fromkeys((modelo, respaldo)) if m]
        self._transport = transport

    async def revisar(self, candidatas: Sequence[Candidata]) -> List[Optional[str]]:
        """Por candidata: None si sirve (o no se pudo revisar) o el motivo del descarte."""
        sin_revisar: List[Optional[str]] = [None] * len(candidatas)
        imagenes = await self._descargar([c.foto.url or "" for c in candidatas])
        revisables = [(i, c, img) for i, (c, img) in enumerate(zip(candidatas, imagenes)) if img]
        if not revisables:
            return sin_revisar
        contenido: List[Dict[str, Any]] = [{"type": "text", "text": "Revisa estas fotos:"}]
        for n, (_, c, (datos, mime)) in enumerate(revisables, start=1):
            contenido.append({"type": "text", "text": f"Foto {n}. Escena «{c.titulo}»: {c.guion[:400]}"})
            contenido.append({"type": "image", "data": base64.b64encode(datos).decode("ascii"), "mime_type": mime})
        entrada = [{"type": "user_input", "content": contenido}]

        salida: Optional[SalidaRevision] = None
        for k, modelo in enumerate(self._modelos):
            try:
                r = await self._cliente.generar_json(
                    modelo=modelo, instrucciones=_INSTRUCCIONES, entrada=entrada, esquema_salida=SalidaRevision,
                    timeout_s=TIMEOUT_REVISION_S, max_reintentos=0 if k + 1 < len(self._modelos) else None,
                )
                salida = r.datos
                break
            except GeminiError as exc:
                logger.warning("[fotos] La revisión con %s falló (%s).", modelo, exc.codigo)
        if salida is None:
            return sin_revisar

        resultado = list(sin_revisar)
        for v in salida.veredictos:
            if not v.sirve and 1 <= v.foto <= len(revisables):
                resultado[revisables[v.foto - 1][0]] = v.motivo.strip() or "no corresponde a la escena"
        return resultado

    async def _descargar(self, urls: Sequence[str]) -> List[Optional[Tuple[bytes, str]]]:
        async with httpx.AsyncClient(timeout=TIMEOUT_DESCARGA_S, headers={"User-Agent": AGENTE},
                                     follow_redirects=True, trust_env=False, transport=self._transport) as http:
            async def una(url: str) -> Optional[Tuple[bytes, str]]:
                if not url.startswith("https://"):
                    return None
                try:
                    r = await http.get(url)
                    r.raise_for_status()
                except httpx.HTTPError as exc:
                    logger.warning("[fotos] No se pudo descargar una foto para revisarla (%s).", type(exc).__name__)
                    return None
                mime = r.headers.get("content-type", "").split(";")[0].strip().lower()
                if mime not in TIPOS_FOTO or not r.content or len(r.content) > MAX_BYTES_FOTO:
                    return None
                return r.content, mime
            return list(await asyncio.gather(*(una(u) for u in urls)))


@dataclass
class FotosPreparadas:
    imagenes: List[Optional[Dict[str, Any]]]  # por escena: imagen nueva, o None si no cambia
    avisos: List[str] = field(default_factory=list)


def es_dudosa(foto: ImagenEscena) -> bool:
    return foto.proveedor == "wikimedia"


class PreparadorFotos:
    """Busca las fotos de un guion y hace revisar las dudosas. Nunca lanza: ante un fallo, nada cambia."""

    def __init__(self, revisor: Optional[RevisorFotos] = None, *,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        self._revisor = revisor
        self._transport = transport

    async def __call__(self, spec_dict: Dict[str, Any]) -> FotosPreparadas:
        spec = VideoJobSpec.model_validate(spec_dict)
        buscador = BuscadorImagenes(transport=self._transport)
        try:
            fotos, _ = await buscar_fotos(buscador, spec)
        finally:
            await buscador.aclose()

        rechazos: List[Optional[str]] = [None] * len(fotos)
        dudosas = [i for i, f in enumerate(fotos) if f is not None and es_dudosa(f)]
        if dudosas and self._revisor is not None:
            veredictos = await self._revisor.revisar([
                Candidata(spec.escenas[i].titulo, spec.escenas[i].guion_locutor, fotos[i]) for i in dudosas
            ])
            for i, motivo in zip(dudosas, veredictos):
                rechazos[i] = motivo

        imagenes: List[Optional[Dict[str, Any]]] = []
        avisos: List[str] = []
        for escena, foto, motivo in zip(spec.escenas, fotos, rechazos):
            if motivo:
                # Sin palabra clave: el botón de voz no la vuelve a buscar (daría la misma foto)
                imagenes.append(ImagenEscena(tipo="diapositiva").model_dump())
                avisos.append(f"La foto de la escena {escena.escena} se descartó tras revisarla: {motivo}.")
            else:
                imagenes.append(foto.model_dump() if foto else None)
        return FotosPreparadas(imagenes, avisos)


def preparador_del_entorno(cliente: Optional[ClienteGemini], config: Config) -> PreparadorFotos:
    """Revisor con el modelo de transcripción (multimodal, verificado con imágenes el 2026-10-13)."""
    revisor = None
    if cliente is not None and config.gemini_transcription_model:
        revisor = RevisorFotos(cliente, config.gemini_transcription_model, config.gemini_transcription_fallback_model)
    return PreparadorFotos(revisor)
