"""
Video narrado bajo demanda (Etapa 6): el VideoJobSpec es el guion; el "video" son 2 o 3
diapositivas que el navegador dibuja desde el JSON, cada una con su voz.

Al pulsar "Generar narración":
1. Si ya existe una narración idéntica (mismo guion y mismas voces) se reutiliza: 0 llamadas.
2. Fotos de fondo (opcionales) en bancos libres, en paralelo con la voz.
3. Voz por escena con el primer proveedor que pueda: ElevenLabs (principal) → Gemini TTS
   (respaldo). Toda la narración usa un solo proveedor, para que las escenas no cambien de voz.
4. La duración se MIDE del audio. Si la suma supera max_duration, se repiten las escenas
   más largas con ritmo ágil (una vez cada una). Si aun así no cabe: "excede_duracion"
   y no se guarda nada.
5. Usuarios: audio + JSON en el almacén privado (OCI o disco). Invitados: el audio viaja en
   la respuesta y nada se guarda.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence

from app.core.schemas import (
    AudioEscena,
    ImagenEscena,
    RespuestaNarracion,
    SolicitudNarracion,
    VideoJobSpec,
    redondear_decima,
)
from app.servicios.registro_tareas import RegistroTareas
from app.servicios.servicio_imagenes import BuscadorImagenes
from app.servicios.servicio_voz import ErrorVoz, Sintetizador, VozGenerada
from app.storage.almacen_narracion import AlmacenBinario

logger = logging.getLogger("novamind.servicio_narracion")

# Sube este número si cambia la medición o el formato guardado: invalida lo reutilizable.
VERSION_NARRACION = 2

_MENSAJES_ERROR = {
    "rate_limit": "La cuota gratuita de voz está agotada por ahora. Prueba de nuevo en unos minutos.",
    "sin_creditos": "Se agotaron los créditos de voz del mes. Prueba de nuevo más tarde.",
    "timeout": "El servicio de voz no respondió a tiempo. Prueba de nuevo.",
    "sin_clave": "El servidor no tiene configurado ningún servicio de voz.",
    "almacenamiento": "La voz se generó, pero no se pudo guardar. Prueba de nuevo.",
}


def huella_narracion(spec: VideoJobSpec, voces: Sequence[str]) -> str:
    base = {
        "guiones": [e.guion_locutor for e in spec.escenas],
        "voces": list(voces),
        "max_duracion": spec.max_duration,
        "version": VERSION_NARRACION,
    }
    return hashlib.sha256(json.dumps(base, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def _ahora() -> str:
    return datetime.now(timezone.utc).isoformat()


class Narrador:
    def __init__(
        self,
        voces: Sequence[Sintetizador],
        *,
        buscador: Optional[BuscadorImagenes] = None,
        almacen: Optional[AlmacenBinario] = None,
        prefijo: Optional[str] = None,
        registro: Optional[RegistroTareas] = None,
    ):
        if not voces:
            raise ValueError("Se necesita al menos un proveedor de voz.")
        if (almacen is None) != (prefijo is None):
            raise ValueError("almacen y prefijo van juntos (usuario) o ambos ausentes (invitado).")
        self._voces = list(voces)
        self._buscador = buscador
        self._almacen = almacen
        self._prefijo = prefijo
        self._registro = registro

    # ------------------------------------------------------------------ API
    async def narrar(self, solicitud: SolicitudNarracion) -> RespuestaNarracion:
        spec = solicitud.video_job_spec.model_copy(deep=True)
        huella = huella_narracion(spec, [v.identidad for v in self._voces])
        carpeta = f"{self._prefijo}/{huella}" if self._prefijo else None

        previa = await self._previa(carpeta)
        if previa is not None:
            return RespuestaNarracion(
                status="exito", video_job_spec=previa, duracion_total_real_s=previa.duracion_total_real,
                duraciones_medidas_s=[e.audio.duracion_real_s for e in previa.escenas if e.audio],
                reutilizado=True, proveedor=previa.escenas[0].audio.proveedor, almacenamiento=self._almacen.tipo,
            )

        inicio = _ahora()
        fotos = asyncio.create_task(self._fotos(spec) if solicitud.buscar_fotos else self._sin_fotos())
        avisos: List[str] = []
        audios: Optional[List[VozGenerada]] = None
        ultimo: Optional[ErrorVoz] = None
        for voz in self._voces:
            aviso = await voz.sin_presupuesto([e.guion_locutor for e in spec.escenas])
            if aviso:
                avisos.append(aviso)
                continue
            try:
                audios = await self._sintetizar(spec, voz)
                break
            except ErrorVoz as exc:
                ultimo = exc
                logger.warning("[narracion] %s falló (%s); se prueba el siguiente proveedor.", voz.nombre, exc.codigo)
                avisos.append(f"{voz.nombre} no estuvo disponible ({_MENSAJES_ERROR.get(exc.codigo, exc.codigo)}).")

        if audios is None:
            fotos.cancel()
            codigo = ultimo.codigo if ultimo else "sin_creditos"
            await self._registrar(huella, inicio, "fallido", codigo=codigo,
                                  mensaje=ultimo.mensaje if ultimo else "Sin presupuesto en ningún proveedor.")
            return RespuestaNarracion(
                status="error", video_job_spec=spec, error_codigo=codigo, almacenamiento=self._tipo_almacen(),
                advertencias=[_MENSAJES_ERROR.get(codigo, "No se pudo generar la voz. Prueba de nuevo."), *avisos],
            )
        imagenes, avisos_fotos = await fotos
        avisos.extend(avisos_fotos)
        proveedor = audios[0].proveedor

        medidas = [a.duracion_s for a in audios]
        total = redondear_decima(sum(medidas))
        if total > spec.max_duration:
            await self._registrar(huella, inicio, "fallido", codigo="excede_duracion", modelo=audios[0].modelo,
                                  mensaje=f"La voz dura {total:.1f} s; el máximo es {spec.max_duration} s.")
            return RespuestaNarracion(
                status="excede_duracion", video_job_spec=spec, duracion_total_real_s=total,
                duraciones_medidas_s=medidas, proveedor=proveedor, almacenamiento=self._tipo_almacen(),
                advertencias=[f"La narración real dura {total:.1f} s y supera el máximo de {spec.max_duration} s "
                              "incluso con ritmo ágil. Acorta el guion y vuelve a intentarlo."],
            )

        for escena, imagen in zip(spec.escenas, imagenes):
            if imagen is not None:
                escena.imagen = imagen
        for escena, audio in zip(spec.escenas, audios):
            escena.audio = AudioEscena(
                duracion_real_s=audio.duracion_s, voz=audio.voz, modelo=audio.modelo, proveedor=audio.proveedor,
                mime_type=audio.mime_type, tiempos_palabras=audio.tiempos_palabras,
            )
        spec.duracion_total_real = total
        spec.estado = "completed"

        en_linea: Dict[int, str] = {}
        if carpeta is None:  # invitado: nada se guarda en el servidor
            en_linea = {e.escena: base64.b64encode(a.audio).decode() for e, a in zip(spec.escenas, audios)}
        else:
            try:
                await self._guardar(spec, audios, carpeta)
            except Exception as exc:  # OCI caído, disco lleno...
                logger.exception("[narracion] No se pudo guardar la narración: %s", type(exc).__name__)
                await self._registrar(huella, inicio, "fallido", codigo="almacenamiento", modelo=audios[0].modelo,
                                      mensaje="No se pudo guardar el audio.")
                return RespuestaNarracion(
                    status="error", video_job_spec=solicitud.video_job_spec, error_codigo="almacenamiento",
                    advertencias=[_MENSAJES_ERROR["almacenamiento"]], almacenamiento=self._almacen.tipo,
                )
            await self._registrar(huella, inicio, "completado", spec=spec, modelo=audios[0].modelo)
        return RespuestaNarracion(
            status="exito", video_job_spec=spec, duracion_total_real_s=total, duraciones_medidas_s=medidas,
            proveedor=proveedor, advertencias=avisos, almacenamiento=self._tipo_almacen(), audios_en_linea=en_linea,
        )

    # ------------------------------------------------------------------ voz
    async def _sintetizar(self, spec: VideoJobSpec, voz: Sintetizador) -> List[VozGenerada]:
        audios = list(await asyncio.gather(*(voz.sintetizar(e.guion_locutor) for e in spec.escenas)))
        # Si no cabe, se repiten con ritmo ágil las escenas más largas primero, hasta que quepa.
        for i in sorted(range(len(audios)), key=lambda k: audios[k].duracion_s, reverse=True):
            if sum(a.duracion_s for a in audios) <= spec.max_duration:
                break
            agil = await voz.sintetizar(spec.escenas[i].guion_locutor, rapido=True)
            if agil.duracion_s < audios[i].duracion_s:
                audios[i] = agil
        return audios

    # ------------------------------------------------------------------ fotos
    @staticmethod
    async def _sin_fotos():
        return [], []

    async def _fotos(self, spec: VideoJobSpec):
        if self._buscador is None:
            return [None] * len(spec.escenas), []

        async def una(escena) -> Optional[ImagenEscena]:
            imagen = escena.imagen
            if imagen is None or imagen.tipo == "foto" or not imagen.palabra_clave:
                return None
            foto = await self._buscador.buscar(imagen.palabra_clave, escena.titulo)
            return foto.model_copy(update={"palabra_clave": imagen.palabra_clave}) if foto else None

        fotos = list(await asyncio.gather(*(una(e) for e in spec.escenas)))
        faltan = [e.escena for e, f in zip(spec.escenas, fotos)
                  if f is None and e.imagen and e.imagen.tipo != "foto" and e.imagen.palabra_clave]
        avisos = [f"Sin foto libre para la escena {n}: se muestra la diapositiva sola." for n in faltan]
        return fotos, avisos

    # ------------------------------------------------------------------ almacén
    def _tipo_almacen(self):
        return self._almacen.tipo if self._almacen else "en_linea"

    async def _previa(self, carpeta: Optional[str]) -> Optional[VideoJobSpec]:
        if carpeta is None:
            return None
        try:
            datos = await asyncio.to_thread(self._almacen.leer, f"{carpeta}/video_job_spec.json")
            if datos is None:
                return None
            spec = VideoJobSpec.model_validate_json(datos)
        except Exception as exc:  # una copia ilegible no bloquea: se regenera
            logger.warning("[narracion] Narración previa ilegible (%s); se regenera.", type(exc).__name__)
            return None
        return spec if spec.escenas and all(e.audio and e.audio.ruta for e in spec.escenas) else None

    async def _guardar(self, spec: VideoJobSpec, audios: List[VozGenerada], carpeta: str) -> None:
        for escena, audio in zip(spec.escenas, audios):
            ruta = f"{carpeta}/escena-{escena.escena}.{audio.extension}"
            await asyncio.to_thread(self._almacen.guardar, ruta, audio.audio, audio.mime_type)
            escena.audio.ruta = ruta
        spec.manifiesto_url_oci = f"{carpeta}/video_job_spec.json"
        # El JSON va al final: su presencia significa que todos los audios ya están guardados.
        await asyncio.to_thread(
            self._almacen.guardar, spec.manifiesto_url_oci,
            spec.model_dump_json().encode("utf-8"), "application/json",
        )

    async def _registrar(self, huella: str, inicio: str, estado: str, *, spec: Optional[VideoJobSpec] = None,
                         modelo: Optional[str] = None, codigo: Optional[str] = None,
                         mensaje: Optional[str] = None) -> None:
        """generation_tasks (recurso 'narracion', tarea 'tts'): mejor esfuerzo, nunca interrumpe."""
        if self._registro is None:
            return
        await self._registro.guardar([{
            "resource": "narracion", "task": "tts", "content_hash": huella, "status": estado,
            "model": modelo, "attempts": 1, "started_at": inicio, "finished_at": _ahora(),
            "result": {"duracion_total_real": spec.duracion_total_real, "escenas": len(spec.escenas),
                       "proveedor": spec.escenas[0].audio.proveedor} if spec else None,
            "result_storage_path": spec.manifiesto_url_oci if spec else None,
            "error_code": codigo, "error_message": mensaje,
        }])
