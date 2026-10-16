"""
Etapa 6 · Video narrado bajo demanda: voz medida, límite de 60 s, reutilización,
almacén privado por usuario y fotos libres filtradas. Sin red ni coste: Gemini y los
bancos de imágenes se simulan.
"""

from __future__ import annotations

import asyncio
import base64
import json
import time
from typing import Dict, List, Optional
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import Principal, require_user
from app.core.schemas import (
    EscenaDirectorCut,
    ImagenEscena,
    SolicitudAdaptacion,
    SolicitudNarracion,
    VideoJobSpec,
    duracion_disponible_voz,
    exceso_guion_narracion,
    silencios_tecnicos,
    velocidad_reproduccion,
)
from app.main import app
from app.servicios import servicio_narracion
from app.servicios.registro_tareas import RegistroMemoria
from app.servicios.servicio_gemini import AudioGenerado, GeminiError, Uso
from app.servicios.servicio_imagenes import BuscadorImagenes, elegir_openverse, elegir_wikimedia
from app.servicios.servicio_narracion import Narrador, huella_narracion
from app.servicios.servicio_voz import ESTILO_AGIL, VozGemini
from app.storage.almacen_narracion import AlmacenLocal, prefijo_narraciones

USUARIO = "11111111-1111-4111-8111-111111111111"
OTRO = "22222222-2222-4222-8222-222222222222"


def _escena(n: int, palabra: Optional[str] = "server rack") -> EscenaDirectorCut:
    return EscenaDirectorCut(
        id=f"sc-{n}", escena=n, tiempo="00:00 - 00:00", titulo=f"Escena {n}",
        guion_locutor=" ".join(f"palabra{n}x{i}" for i in range(40)),
        storyboard_visual="Diapositiva.", consejo_pedagogico="Pausa.",
        imagen=ImagenEscena(palabra_clave=palabra) if palabra else None,
    )


def _spec(n: int = 3) -> VideoJobSpec:
    return VideoJobSpec(video_job_id="vjob-doc-0123456789abcdef", document_id="doc-0123456789abcdef",
                        escenas=[_escena(i) for i in range(1, n + 1)])


class VozSimulada:
    """Duración por estilo: natural y ágil. Registra cada llamada."""

    def __init__(self, natural: float = 15.0, agil: float = 13.0, error: Optional[GeminiError] = None,
                 espera: float = 0.0, espera_agil: float = 0.0):
        self.natural, self.agil, self.error = natural, agil, error
        self.espera, self.espera_agil = espera, espera_agil  # segundos reales que tarda en responder
        self.llamadas: List[str] = []

    async def sintetizar_voz(self, *, modelo, texto, voz, estilo, timeout_s):
        self.llamadas.append(estilo)
        await asyncio.sleep(self.espera_agil if estilo == ESTILO_AGIL else self.espera)
        if self.error:
            raise self.error
        segundos = self.agil if estilo == ESTILO_AGIL else self.natural
        return AudioGenerado(wav=b"RIFF" + texto[:8].encode(), duracion_s=segundos, sample_rate=24000,
                             canales=1, uso=Uso(modelo=modelo, intentos=1, latencia_s=0.1))


class BancoSimulado:
    def __init__(self, con_foto: bool = True, espera: float = 0.0):
        self.con_foto, self.espera = con_foto, espera
        self.busquedas: List[str] = []

    async def buscar(self, palabra_clave, alt):
        self.busquedas.append(palabra_clave)
        await asyncio.sleep(self.espera)
        if not self.con_foto:
            return None
        return ImagenEscena(tipo="foto", url="https://api.openverse.org/v1/images/x/thumb/", alt=alt,
                            autor="motleypixel", licencia="CC BY 2.0", proveedor="openverse")


def _narrar(narrador: Narrador, spec: Optional[VideoJobSpec] = None, **kw):
    return asyncio.run(narrador.narrar(SolicitudNarracion(video_job_spec=spec or _spec(), **kw)))


# --------------------------------------------------------------------- narrador
def test_invitado_recibe_el_audio_en_linea_y_nada_se_guarda():
    voz, banco = VozSimulada(), BancoSimulado()
    r = _narrar(Narrador([VozGemini(voz, "tts-modelo")], buscador=banco))
    assert r.status == "exito" and r.almacenamiento == "en_linea"
    assert r.duracion_total_real_s == 45.0 and r.duraciones_medidas_s == [15.0, 15.0, 15.0]
    assert set(r.audios_en_linea) == {1, 2, 3}
    assert base64.b64decode(r.audios_en_linea[1]).startswith(b"RIFF")
    escena = r.video_job_spec.escenas[0]
    assert escena.audio.ruta is None and escena.audio.duracion_real_s == 15.0
    # La foto conserva la palabra clave con la que se buscó
    assert escena.imagen.tipo == "foto" and escena.imagen.palabra_clave == "server rack"
    assert r.video_job_spec.duracion_total_real == 45.0 and r.video_job_spec.estado == "completed"


def test_usuario_guarda_wav_y_guion_y_la_segunda_vez_no_llama_a_gemini(tmp_path):
    almacen, voz = AlmacenLocal(tmp_path), VozSimulada()
    prefijo = prefijo_narraciones(USUARIO)
    narrador = Narrador([VozGemini(voz, "tts-modelo")], buscador=BancoSimulado(), almacen=almacen, prefijo=prefijo)
    r = _narrar(narrador)
    assert r.status == "exito" and r.almacenamiento == "local" and not r.audios_en_linea
    rutas = [e.audio.ruta for e in r.video_job_spec.escenas]
    assert all(ruta.startswith(f"users/{USUARIO}/narraciones/") and ruta.endswith(".wav") for ruta in rutas)
    assert all((tmp_path / ruta).is_file() for ruta in rutas)
    guardado = json.loads((tmp_path / r.video_job_spec.manifiesto_url_oci).read_text(encoding="utf-8"))
    assert guardado["duracion_total_real"] == 45.0

    llamadas = len(voz.llamadas)
    r2 = _narrar(narrador)
    assert r2.reutilizado and r2.status == "exito" and len(voz.llamadas) == llamadas
    assert [e.audio.ruta for e in r2.video_job_spec.escenas] == rutas


def test_si_no_cabe_se_repiten_las_escenas_largas_con_ritmo_agil(tmp_path):
    voz = VozSimulada(natural=25.0, agil=18.0)  # 75 s → 18 + 18 + 18 = 54 s
    r = _narrar(Narrador([VozGemini(voz, "tts-modelo")]))
    assert r.status == "exito" and r.duracion_total_real_s == 54.0
    assert voz.llamadas.count(ESTILO_AGIL) == 3


def test_si_ni_con_ritmo_agil_cabe_no_se_guarda_nada(tmp_path):
    voz = VozSimulada(natural=25.0, agil=22.0)  # 66 s en el mejor caso
    narrador = Narrador([VozGemini(voz, "tts-modelo")], almacen=AlmacenLocal(tmp_path), prefijo=prefijo_narraciones(USUARIO))
    r = _narrar(narrador)
    assert r.status == "excede_duracion" and r.duracion_total_real_s == 66.0
    assert "60" in r.advertencias[0]
    assert all(e.audio is None for e in r.video_job_spec.escenas)
    assert not any(tmp_path.rglob("*"))


def test_si_se_pasa_por_poco_se_acepta_y_se_reproduce_mas_rapido(tmp_path):
    # 58,8 s tras el ritmo ágil; con 3 escenas la voz dispone de 60 − 2,4 s de silencios = 57,6 s
    voz = VozSimulada(natural=25.0, agil=19.6)
    narrador = Narrador([VozGemini(voz, "tts-modelo")], almacen=AlmacenLocal(tmp_path), prefijo=prefijo_narraciones(USUARIO))
    r = _narrar(narrador)
    assert r.status == "exito" and r.duracion_total_real_s == 58.8
    assert r.video_job_spec.velocidad_reproduccion == 1.021
    assert any("1.021×" in aviso for aviso in r.advertencias)
    # Lo reutilizado conserva la velocidad
    r2 = _narrar(narrador)
    assert r2.reutilizado and r2.video_job_spec.velocidad_reproduccion == 1.021


def test_los_silencios_tecnicos_cuentan_dentro_del_maximo():
    assert silencios_tecnicos(3) == 2.4 and silencios_tecnicos(2) == 1.6
    assert duracion_disponible_voz(60, 3) == 57.6
    # 58 s de voz cabían antes en 60 s; con los silencios hay que acelerarla
    voz = VozSimulada(natural=58 / 3, agil=58 / 3)
    r = _narrar(Narrador([VozGemini(voz, "tts-modelo")]))
    assert r.status == "exito" and r.video_job_spec.velocidad_reproduccion > 1.0
    # El tope previo del guion también descuenta los silencios
    assert exceso_guion_narracion(["hola " * 173], 60) is None
    aviso = exceso_guion_narracion(["hola " * 173], 60, 2.4)
    assert aviso is not None and "2.4 s de silencios" in aviso


def test_si_cabe_se_reproduce_a_velocidad_normal():
    r = _narrar(Narrador([VozGemini(VozSimulada(), "tts-modelo")]))
    assert r.video_job_spec.velocidad_reproduccion == 1.0
    assert not any("×" in aviso for aviso in r.advertencias)


def test_velocidad_de_reproduccion_tolera_hasta_un_5_por_ciento():
    assert velocidad_reproduccion(60.0, 60) == 1.0
    assert velocidad_reproduccion(60.1, 60) == 1.002  # siempre hacia arriba: nunca suena > 60 s
    assert velocidad_reproduccion(63.0, 60) == 1.05
    assert velocidad_reproduccion(63.1, 60) is None


def _spec_con_guiones(*guiones: str) -> VideoJobSpec:
    escenas = [_escena(i).model_copy(update={"guion_locutor": g}) for i, g in enumerate(guiones, 1)]
    return VideoJobSpec(video_job_id="vjob-doc-0123456789abcdef", document_id="doc-0123456789abcdef",
                        escenas=escenas)


def test_tope_del_guion_a_60_s_con_la_voz_mas_rapida():
    # 60 s × 1,05 × 165 palabras/min = 173 palabras
    assert exceso_guion_narracion(["hola " * 173], 60) is None
    assert "174 palabras" in exceso_guion_narracion(["hola " * 174], 60)
    # Los créditos se cobran por carácter: una "palabra" gigante tampoco pasa
    assert exceso_guion_narracion(["x" * 1800], 60) is not None


def test_guion_que_no_puede_caber_se_rechaza_sin_llamar_a_la_voz(tmp_path):
    voz, banco, registro = VozSimulada(), BancoSimulado(), RegistroMemoria()
    narrador = Narrador([VozGemini(voz, "tts-modelo")], buscador=banco, almacen=AlmacenLocal(tmp_path),
                        prefijo=prefijo_narraciones(USUARIO), registro=registro)
    largo = " ".join(f"p{i}" for i in range(60))
    r = _narrar(narrador, _spec_con_guiones(largo, largo, largo))  # 180 palabras
    assert r.status == "error" and r.error_codigo == "guion_largo"
    assert "180 palabras" in r.advertencias[0] and "no se gastó" in r.advertencias[0]
    assert voz.llamadas == [] and banco.busquedas == [] and not registro.filas
    assert not any(tmp_path.rglob("*"))


def test_plazo_agotado_no_prueba_el_respaldo_y_lo_explica(monkeypatch):
    monkeypatch.setattr(servicio_narracion, "PLAZO_VOZ_S", 0.2)
    lenta, respaldo, registro = VozSimulada(espera=5.0), VozSimulada(), RegistroMemoria()
    narrador = Narrador([VozGemini(lenta, "m1"), VozGemini(respaldo, "m2")], registro=registro)
    r = asyncio.run(narrador.narrar(SolicitudNarracion(video_job_spec=_spec(), buscar_fotos=False)))
    assert r.status == "error" and r.error_codigo == "plazo"
    assert "no estuvo lista" in r.advertencias[0]
    assert respaldo.llamadas == []  # sin tiempo para otro proveedor: acabaría en el 524


def test_plazo_durante_el_ritmo_agil_decide_con_la_voz_ya_pagada(monkeypatch):
    monkeypatch.setattr(servicio_narracion, "PLAZO_VOZ_S", 0.3)
    voz = VozSimulada(natural=19.6, espera_agil=5.0)  # 58,8 s: el ritmo ágil no llega a tiempo
    r = _narrar(Narrador([VozGemini(voz, "tts-modelo")]))
    assert r.status == "exito" and r.duracion_total_real_s == 58.8
    assert r.video_job_spec.velocidad_reproduccion == 1.021
    assert voz.llamadas.count(ESTILO_AGIL) == 1


def test_fotos_tardias_se_omiten_y_la_narracion_sigue(monkeypatch):
    monkeypatch.setattr(servicio_narracion, "PLAZO_VOZ_S", 0.1)
    monkeypatch.setattr(servicio_narracion, "MARGEN_FOTOS_S", 0.1)
    r = _narrar(Narrador([VozGemini(VozSimulada(), "tts-modelo")], buscador=BancoSimulado(espera=5.0)))
    assert r.status == "exito"
    assert all(e.imagen.tipo == "diapositiva" for e in r.video_job_spec.escenas)
    assert any("no llegaron a tiempo" in a for a in r.advertencias)


def test_cuota_agotada_devuelve_error_explicado_sin_guardar(tmp_path):
    voz = VozSimulada(error=GeminiError("rate_limit", "quota", reintentable=True, http_status=429))
    registro = RegistroMemoria()
    narrador = Narrador([VozGemini(voz, "tts-modelo")], almacen=AlmacenLocal(tmp_path),
                        prefijo=prefijo_narraciones(USUARIO), registro=registro)
    r = _narrar(narrador)
    assert r.status == "error" and r.error_codigo == "rate_limit"
    assert "cuota" in r.advertencias[0].lower()
    assert not any(tmp_path.rglob("*"))
    (fila,) = registro.filas.values()
    assert fila["status"] == "fallido" and fila["error_code"] == "rate_limit" and fila["task"] == "tts"


def test_registro_guarda_la_ruta_del_guion_y_no_el_audio(tmp_path):
    registro = RegistroMemoria()
    narrador = Narrador([VozGemini(VozSimulada(), "tts-modelo")], almacen=AlmacenLocal(tmp_path),
                        prefijo=prefijo_narraciones(USUARIO), registro=registro)
    r = _narrar(narrador)
    (fila,) = registro.filas.values()
    assert fila["resource"] == "narracion" and fila["status"] == "completado"
    assert fila["result_storage_path"] == r.video_job_spec.manifiesto_url_oci
    assert fila["content_hash"] == huella_narracion(_spec(), [VozGemini(VozSimulada(), "tts-modelo").identidad])
    assert "wav" not in json.dumps(fila["result"])


def test_sin_foto_la_escena_queda_como_diapositiva_y_se_avisa():
    r = _narrar(Narrador([VozGemini(VozSimulada(), "tts-modelo")], buscador=BancoSimulado(con_foto=False)))
    assert r.status == "exito"
    assert all(e.imagen.tipo == "diapositiva" for e in r.video_job_spec.escenas)
    assert len(r.advertencias) == 3


def test_buscar_fotos_desactivado_no_consulta_los_bancos():
    banco = BancoSimulado()
    _narrar(Narrador([VozGemini(VozSimulada(), "tts-modelo")], buscador=banco), buscar_fotos=False)
    assert banco.busquedas == []


def test_huella_cambia_con_el_guion_o_la_voz():
    kore, puck = VozGemini(VozSimulada(), "m", "Kore").identidad, VozGemini(VozSimulada(), "m", "Puck").identidad
    base = huella_narracion(_spec(), [kore])
    assert huella_narracion(_spec(), [puck]) != base
    assert huella_narracion(_spec(2), [kore]) != base
    assert huella_narracion(_spec(), [kore]) == base


def test_solicitud_rechaza_mas_de_tres_escenas():
    spec = VideoJobSpec(video_job_id="v", document_id="d", escenas=[_escena(i) for i in range(1, 5)])
    with pytest.raises(ValueError):
        SolicitudNarracion(video_job_spec=spec)


def test_almacen_local_rechaza_rutas_que_escapan(tmp_path):
    almacen = AlmacenLocal(tmp_path)
    for ruta in ("../fuera.wav", "/abs.wav", "users/a/../../b.wav", "users\\a.wav", ""):
        with pytest.raises(ValueError):
            almacen.guardar(ruta, b"x", "audio/wav")


# --------------------------------------------------------------------- fotos
_OV = {"license": "by-sa", "license_version": "2.0", "creator": "towo", "title": "Server rack",
       "thumbnail": "https://api.openverse.org/v1/images/1/thumb/", "foreign_landing_url": "https://flickr.com/1"}


def test_openverse_descarta_portadas_y_licencias_no_libres():
    candidatos = [
        {**_OV, "title": "Book cover: servers"},
        {**_OV, "license": "by-nc"},
        {**_OV, "creator": ""},
        {**_OV, "title": "Rack de servidores", "creator": "zdw"},
    ]
    foto = elegir_openverse(candidatos, "Escena 1")
    assert foto.autor == "zdw" and foto.licencia == "CC BY-SA 2.0" and foto.proveedor == "openverse"
    assert elegir_openverse(candidatos[:3], "x") is None


def _wm(titulo="File:Servers in a Rack.jpg", mime="image/jpeg", ancho=1600, alto=900, licencia="CC BY-SA 3.0",
        indice=1, categorias="Computer racks|Self-published work", descripcion="Servers in a rack", restricciones=""):
    return {"index": indice, "title": titulo, "imageinfo": [{
        "mime": mime, "width": ancho, "height": alto, "thumburl": "https://upload.wikimedia.org/x.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:x.jpg",
        "extmetadata": {"LicenseShortName": {"value": licencia},
                        "Artist": {"value": '<a href="//commons.wikimedia.org/wiki/User:Abigor">Abigor</a>'},
                        "Categories": {"value": categorias}, "ImageDescription": {"value": descripcion},
                        "Restrictions": {"value": restricciones}},
    }]}


def test_wikimedia_mira_categorias_y_tema_y_no_solo_el_titulo():
    # Casos reales del 2026-10-13 que pasaban el filtro por título
    rechazadas = [
        _wm(titulo="File:Data center infrastructure in the United States.jpg",
            categorias="PD US Government|Data centers|Maps showing 2025"),
        _wm(titulo="File:EFTA00002522 - Cluttered server rack filled with colorful cables.jpg",
            categorias="Computer racks|2019 FBI raid on Epstein's private island",
            descripcion="Part of Epstein Files released by the DOJ"),
        _wm(titulo="File:Soy milk brand event in Shibuya Stream.jpg", descripcion="Soy milk brand event"),
        _wm(restricciones="personality"),  # personas identificables
    ]
    assert elegir_wikimedia(rechazadas, "x") is None
    assert elegir_wikimedia(rechazadas + [_wm(titulo="File:Wikimedia Servers-0001 42.jpg", indice=9)], "x")


def test_wikimedia_solo_acepta_fotos_apaisadas_libres_y_sin_titulo_sospechoso():
    rechazadas = [
        _wm(titulo="File:Discover-A-Data-Center-book-cover-2023.jpg"),
        _wm(alto=1400),                     # vertical
        _wm(mime="image/png"),              # diagramas y logos suelen ser PNG/SVG
        _wm(ancho=640, alto=360),           # pequeña
        _wm(licencia="CC BY-NC 4.0"),       # no permite uso libre
    ]
    assert elegir_wikimedia(rechazadas, "x") is None
    foto = elegir_wikimedia(rechazadas + [_wm(indice=9)], "Escena 3")
    assert foto.autor == "Abigor" and foto.licencia == "CC BY-SA 3.0" and foto.proveedor == "wikimedia"


def test_palabra_clave_ambigua_no_consulta_los_bancos():
    consultas: List[str] = []

    def responder(request: httpx.Request) -> httpx.Response:
        consultas.append(request.url.host)
        return httpx.Response(200, json={"results": [_OV]})

    async def buscar(palabras: List[str]):
        b = BuscadorImagenes(transport=httpx.MockTransport(responder))
        try:
            return [await b.buscar(p, "Escena") for p in palabras]
        finally:
            await b.aclose()

    # el sentido literal engaña: nubes del cielo, ríos, el escritor Kafka
    ambiguas = ["cloud computing", "Event Streaming", "message broker", "apache kafka", "data pipelines",
                "error screen", "server warning"]
    assert asyncio.run(buscar(ambiguas)) == [None] * len(ambiguas)
    assert consultas == []
    # una palabra concreta sí se busca ("cloudy" o "upstream" no son la palabra ambigua)
    fotos = asyncio.run(buscar(["server room", "cloudy upstream"]))
    assert all(f and f.proveedor == "openverse" for f in fotos) and consultas == ["api.openverse.org"] * 2


def test_openverse_tiene_plazo_propio_y_el_peor_caso_cabe_en_la_narracion():
    from app.servicios.servicio_imagenes import TIMEOUT_OPENVERSE_S

    plazos: Dict[str, float] = {}

    def responder(request: httpx.Request) -> httpx.Response:
        plazos[request.url.host] = request.extensions["timeout"]["read"]
        return httpx.Response(200, json={"results": [], "query": {"pages": {}}})

    async def buscar():
        b = BuscadorImagenes(transport=httpx.MockTransport(responder))
        try:
            return await b.buscar("server room", "Escena")
        finally:
            await b.aclose()

    assert asyncio.run(buscar()) is None  # ninguno tiene foto: pregunta a los dos
    assert plazos == {"api.openverse.org": TIMEOUT_OPENVERSE_S, "commons.wikimedia.org": 8.0}
    # Openverse sin caché tarda ~18 s; las fotos van en paralelo con la voz y no pueden pasarse de su plazo
    assert 18 < TIMEOUT_OPENVERSE_S and TIMEOUT_OPENVERSE_S + 8.0 < servicio_narracion.PLAZO_VOZ_S


# --------------------------------------------------------------------- guion de 2 o 3 escenas
def _solicitud(palabras: int, secciones: int) -> SolicitudAdaptacion:
    return SolicitudAdaptacion(
        documento_titulo="Doc", documento_contenido=" ".join(["texto"] * palabras),
        perfil_destinatario="Principiante", formato_salida="Paquete Educativo Completo (5 Estaciones)",
        secciones=[{"titulo": f"S{i}", "inicio": i} for i in range(secciones)],
    )


def test_el_numero_de_escenas_depende_del_documento():
    from app.agentes.generacion_paralela import escenas_video

    assert escenas_video(_solicitud(1500, 6)) == 3
    assert escenas_video(_solicitud(400, 6)) == 2     # breve
    assert escenas_video(_solicitud(1500, 1)) == 2    # una sola idea


def test_el_numero_de_pasos_de_la_guia_depende_del_documento():
    from app.agentes.generacion_paralela import _instrucciones_produccion, pasos_guia

    assert pasos_guia(_solicitud(300, 0)) == 3        # breve y sin secciones
    assert pasos_guia(_solicitud(2500, 0)) == 5       # sin secciones: lo fija el largo
    assert pasos_guia(_solicitud(9000, 0)) == 7       # tope
    assert pasos_guia(_solicitud(2500, 4)) == 4       # un paso por sección
    assert pasos_guia(_solicitud(2500, 12)) == 5      # muchas secciones: manda el tope del largo
    assert pasos_guia(_solicitud(2500, 1)) == 3       # mínimo
    assert "PASOS DEL TUTORIAL: exactamente 4." in _instrucciones_produccion(_solicitud(2500, 4))


def test_normalizador_conserva_la_palabra_clave_y_tolera_una_foto_mal_formada():
    from app.agentes.cadena_colaborativa import _imagen_valida

    assert _imagen_valida({"tipo": "diapositiva", "palabra_clave": "server rack"})["palabra_clave"] == "server rack"
    # una "foto" sin atribución no puede publicarse: queda como diapositiva con su palabra clave
    assert _imagen_valida({"tipo": "foto", "url": "https://x", "palabra_clave": "rack"}) == {
        "tipo": "diapositiva", "palabra_clave": "rack"}
    assert _imagen_valida("server rack") is None


# --------------------------------------------------------------------- API
@pytest.fixture
def api():
    yield TestClient(app)
    app.dependency_overrides.pop(require_user, None)


def _como(principal: Principal):
    app.dependency_overrides[require_user] = lambda: principal


def test_api_invitado_genera_sin_almacen(api):
    _como(Principal("00000000-0000-0000-0000-000000000000", "guest-demo-token", is_guest=True))
    with patch("app.main._voces_narracion", return_value=[VozGemini(VozSimulada(), "tts-modelo")]), \
         patch("app.main.BuscadorImagenes", return_value=_BancoCerrable()), \
         patch("app.main.almacen_del_entorno") as almacen:
        r = api.post("/api/v1/narracion/generar", json={"video_job_spec": _spec(2).model_dump()})
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["status"] == "exito" and set(datos["audios_en_linea"]) == {"1", "2"}
    almacen.assert_not_called()


def test_api_usuario_guarda_y_solo_descarga_lo_propio(api, tmp_path):
    _como(Principal(USUARIO, "token"))
    with patch("app.main._voces_narracion", return_value=[VozGemini(VozSimulada(), "tts-modelo")]), \
         patch("app.main.BuscadorImagenes", return_value=_BancoCerrable()), \
         patch("app.main.almacen_del_entorno", return_value=AlmacenLocal(tmp_path)), \
         patch("app.main._registro_narracion", return_value=None):
        r = api.post("/api/v1/narracion/generar", json={"video_job_spec": _spec().model_dump(), "voz": "Puck"})
        ruta = r.json()["video_job_spec"]["escenas"][0]["audio"]["ruta"]
        audio = api.get(f"/api/v1/narracion/archivo/{ruta}")
        assert audio.status_code == 200 and audio.headers["content-type"] == "audio/wav"
        assert audio.content.startswith(b"RIFF")

        _como(Principal(OTRO, "token"))
        assert api.get(f"/api/v1/narracion/archivo/{ruta}").status_code == 404
        assert api.get("/api/v1/narracion/archivo/users/x/../../.env").status_code == 404


def test_api_rechaza_voz_desconocida(api):
    _como(Principal(USUARIO, "token"))
    r = api.post("/api/v1/narracion/generar", json={"video_job_spec": _spec().model_dump(), "voz": "Alexa"})
    assert r.status_code == 422


class _BancoCerrable(BancoSimulado):
    async def aclose(self):
        return None


# --------------------------------------------------------------------- ElevenLabs (principal)
import httpx  # noqa: E402

from app.servicios.servicio_voz import (  # noqa: E402
    VELOCIDAD_AGIL,
    ErrorVoz,
    VozElevenLabs,
    duracion_mp3_cbr,
    tiempos_por_palabra,
)


def _alineacion(texto: str, seg_por_caracter: float = 0.06):
    caracteres = list(texto)
    return caracteres, [round((i + 1) * seg_por_caracter, 3) for i in range(len(caracteres))]


def test_tiempos_por_palabra_cortan_igual_que_el_teleprompter():
    texto = "Kafka  publica,\nalmacena y procesa."
    caracteres, fines = _alineacion(texto, 0.1)
    tiempos = tiempos_por_palabra(texto, caracteres, fines)
    assert len(tiempos) == 5  # mismas 5 palabras que contar_palabras / splitWords
    assert tiempos[0] == 0.5 and tiempos == sorted(tiempos)
    # Si la alineación no cuadra con el texto, no se inventa: None
    assert tiempos_por_palabra(texto, caracteres[:-3], fines[:-3] + [9, 9, 9]) is None
    assert tiempos_por_palabra("otra cosa distinta", caracteres, fines) is None


def test_duracion_mp3_a_32_kbps():
    assert duracion_mp3_cbr(b"\x00" * 4000) == 1.0


class ElevenSimulado:
    """Transporte que imita /with-timestamps y /user/subscription."""

    def __init__(self, restantes: int = 9000, estado_tts: int = 200, cuerpo_error=None, seg_por_caracter=0.06,
                 falla_tras: Optional[int] = None):
        self.restantes, self.estado_tts, self.cuerpo_error = restantes, estado_tts, cuerpo_error
        self.seg = seg_por_caracter
        self.falla_tras = falla_tras  # las primeras N síntesis salen bien; después, estado_tts
        self.cuerpos: List[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        assert request.headers["xi-api-key"] == "clave-prueba"
        if request.url.path == "/v1/user/subscription":
            return httpx.Response(200, json={"character_limit": 10000, "character_count": 10000 - self.restantes})
        cuerpo = json.loads(request.content)
        self.cuerpos.append(cuerpo)
        if self.estado_tts != 200 and (self.falla_tras is None or len(self.cuerpos) > self.falla_tras):
            return httpx.Response(self.estado_tts, json=self.cuerpo_error or {})
        caracteres, fines = _alineacion(cuerpo["text"], self.seg)
        mp3 = b"\xff\xfb" * 1000  # 2000 bytes = 0,5 s a 32 kbps (menor que la alineación)
        return httpx.Response(200, json={
            "audio_base64": base64.b64encode(mp3).decode(),
            "alignment": {"characters": caracteres, "character_start_times_seconds": [0.0] * len(fines),
                          "character_end_times_seconds": fines},
        })


def _eleven(transporte: ElevenSimulado) -> VozElevenLabs:
    return VozElevenLabs("clave-prueba", voz_id="voz-x", voz_nombre="Alice",
                         transport=httpx.MockTransport(transporte))


def test_elevenlabs_es_la_voz_principal_y_da_tiempos_exactos():
    sim = ElevenSimulado()
    gemini = VozSimulada()
    r = _narrar(Narrador([_eleven(sim), VozGemini(gemini, "tts-modelo")]), _spec(2))
    assert r.status == "exito" and r.proveedor == "elevenlabs" and gemini.llamadas == []
    audio = r.video_job_spec.escenas[0].audio
    assert audio.proveedor == "elevenlabs" and audio.mime_type == "audio/mpeg" and audio.voz == "Alice"
    assert len(audio.tiempos_palabras) == 40  # una por palabra del guion
    assert all(c["language_code"] == "es" and c["model_id"] == "eleven_flash_v2_5" for c in sim.cuerpos)


def test_sin_creditos_suficientes_pasa_a_gemini_sin_llamar_a_elevenlabs():
    sim = ElevenSimulado(restantes=100)
    r = _narrar(Narrador([_eleven(sim), VozGemini(VozSimulada(), "tts-modelo")]))
    assert r.status == "exito" and r.proveedor == "gemini"
    assert sim.cuerpos == []  # ni un crédito gastado
    assert any("quedan 100 créditos" in a for a in r.advertencias)


def test_cuota_agotada_en_elevenlabs_pasa_a_gemini():
    sim = ElevenSimulado(estado_tts=401, cuerpo_error={"detail": {"status": "quota_exceeded", "message": "quota"}})
    r = _narrar(Narrador([_eleven(sim), VozGemini(VozSimulada(), "tts-modelo")]))
    assert r.status == "exito" and r.proveedor == "gemini"
    assert any("ElevenLabs (Alice) no estuvo disponible" in a for a in r.advertencias)


def test_si_todos_los_proveedores_fallan_se_explica_el_ultimo_error():
    sim = ElevenSimulado(estado_tts=503)
    gemini = VozSimulada(error=GeminiError("rate_limit", "quota", reintentable=True, http_status=429))
    r = _narrar(Narrador([_eleven(sim), VozGemini(gemini, "tts-modelo")]))
    assert r.status == "error" and r.error_codigo == "rate_limit"


def test_elevenlabs_repite_con_velocidad_agil_si_no_cabe():
    sim = ElevenSimulado(seg_por_caracter=0.12)  # ~43 s por escena: 2 escenas = 86 s → no cabe nunca
    r = _narrar(Narrador([_eleven(sim)]), _spec(2))
    assert r.status == "excede_duracion"
    assert [c["voice_settings"]["speed"] for c in sim.cuerpos].count(VELOCIDAD_AGIL) == 2


def test_error_de_elevenlabs_se_clasifica():
    sim = ElevenSimulado(estado_tts=401, cuerpo_error={"detail": {"status": "invalid_api_key", "message": "bad"}})
    with pytest.raises(ErrorVoz) as exc:
        asyncio.run(_eleven(sim).sintetizar("hola"))
    assert exc.value.codigo == "no_autorizado"


@pytest.mark.parametrize("detalle", [
    {"status": "quota_exceeded", "message": "This request exceeds your API key quota of 1000."},
    {"status": "credit_limit_exceeded", "message": "limit reached"},
    {"status": "", "message": "You have 37 credits remaining, while 120 credits are required."},
])
def test_tope_de_creditos_de_la_clave_se_clasifica_como_sin_creditos(detalle):
    # El tope de la clave no se ve en /v1/user/subscription: solo llega como rechazo
    sim = ElevenSimulado(estado_tts=401, cuerpo_error={"detail": detalle})
    with pytest.raises(ErrorVoz) as exc:
        asyncio.run(_eleven(sim).sintetizar("hola"))
    assert exc.value.codigo == "sin_creditos"


def test_creditos_agotados_a_mitad_de_narracion_pasa_a_gemini_entera():
    # La escena 1 sale; la 2 ya no tiene créditos. No se mezclan voces: Gemini narra todas.
    sim = ElevenSimulado(estado_tts=401, falla_tras=1,
                         cuerpo_error={"detail": {"status": "quota_exceeded", "message": "quota"}})
    gemini = VozSimulada()
    r = _narrar(Narrador([_eleven(sim), VozGemini(gemini, "tts-modelo")]), _spec(2))
    assert r.status == "exito" and r.proveedor == "gemini" and len(gemini.llamadas) == 2
    assert all(e.audio.proveedor == "gemini" for e in r.video_job_spec.escenas)
    assert any("créditos de voz" in a for a in r.advertencias)


def test_sin_creditos_para_la_escena_mas_larga_no_se_cobra_ninguna():
    # Caso real del 14/10: el saldo de la clave alcanzaba para una escena corta, no para las demás.
    # Se pide primero la más larga: falla ella y las otras ni se piden.
    sim = ElevenSimulado(estado_tts=401, cuerpo_error={"detail": {"status": "quota_exceeded", "message": "quota"}})
    spec = _spec(3)
    spec.escenas[1].guion_locutor += " con una frase más para que sea la más larga"
    r = _narrar(Narrador([_eleven(sim), VozGemini(VozSimulada(), "tts-modelo")]), spec)
    assert r.status == "exito" and r.proveedor == "gemini"
    assert [c["text"] for c in sim.cuerpos] == [spec.escenas[1].guion_locutor]


def test_el_orden_de_las_escenas_se_conserva_aunque_la_mas_larga_vaya_primero():
    sim = ElevenSimulado(seg_por_caracter=0.03)  # 3 escenas caben en 60 s
    spec = _spec(3)
    spec.escenas[2].guion_locutor += " y una cola más larga"
    r = _narrar(Narrador([_eleven(sim)]), spec)
    assert r.status == "exito" and sim.cuerpos[0]["text"] == spec.escenas[2].guion_locutor
    medidas = [e.audio.duracion_real_s for e in r.video_job_spec.escenas]
    assert medidas[2] == max(medidas)  # la escena 3 conserva su audio, el más largo


def test_con_gemini_las_escenas_van_a_la_vez():
    # Cuota gratuita: no hay créditos que proteger, así que no se espera a la primera escena
    gemini = VozSimulada(natural=15.0, espera=0.3)
    inicio = time.perf_counter()
    r = _narrar(Narrador([VozGemini(gemini, "tts-modelo")]), _spec(3))
    assert r.status == "exito" and len(gemini.llamadas) == 3
    assert time.perf_counter() - inicio < 0.6  # en serie serían 0,9 s


def test_creditos_agotados_al_repetir_con_ritmo_agil_pasa_a_gemini():
    # Las 2 escenas salen pero no caben; la repetición ágil ya no tiene créditos
    sim = ElevenSimulado(seg_por_caracter=0.12, estado_tts=401, falla_tras=2,
                         cuerpo_error={"detail": {"status": "quota_exceeded", "message": "quota"}})
    r = _narrar(Narrador([_eleven(sim), VozGemini(VozSimulada(), "tts-modelo")]), _spec(2))
    assert r.status == "exito" and r.proveedor == "gemini"
    assert len(sim.cuerpos) == 3  # 2 escenas + 1 repetición rechazada: no se insiste


def test_clave_no_autorizada_se_explica_con_palabras():
    sim = ElevenSimulado(estado_tts=401, cuerpo_error={"detail": {"status": "invalid_api_key", "message": "bad"}})
    r = _narrar(Narrador([_eleven(sim), VozGemini(VozSimulada(), "tts-modelo")]))
    assert r.proveedor == "gemini"
    assert any("no es válida" in a for a in r.advertencias) and not any("(no_autorizado)" in a for a in r.advertencias)


def test_usuario_guarda_mp3_y_lo_descarga(api, tmp_path):
    _como(Principal(USUARIO, "token"))
    with patch("app.main._voces_narracion", return_value=[_eleven(ElevenSimulado())]), \
         patch("app.main.BuscadorImagenes", return_value=_BancoCerrable()), \
         patch("app.main.almacen_del_entorno", return_value=AlmacenLocal(tmp_path)), \
         patch("app.main._registro_narracion", return_value=None):
        r = api.post("/api/v1/narracion/generar", json={"video_job_spec": _spec(2).model_dump()})
        ruta = r.json()["video_job_spec"]["escenas"][0]["audio"]["ruta"]
        assert ruta.endswith(".mp3")
        audio = api.get(f"/api/v1/narracion/archivo/{ruta}")
        assert audio.status_code == 200 and audio.headers["content-type"] == "audio/mpeg"


# --------------------------------------------------------------------- Voz del navegador (sin voz del servidor)
def test_sin_voz_del_servidor_trae_fotos_y_no_sintetiza():
    from app.servicios.servicio_narracion import AVISO_VOZ_NAVEGADOR, diapositivas_sin_voz

    banco = BancoSimulado()
    r = asyncio.run(diapositivas_sin_voz(SolicitudNarracion(video_job_spec=_spec(2), voz_servidor=False), banco))
    assert r.status == "exito" and r.proveedor is None and r.audios_en_linea == {}
    assert all(e.audio is None for e in r.video_job_spec.escenas)
    assert [e.imagen.tipo for e in r.video_job_spec.escenas] == ["foto", "foto"]
    assert r.advertencias[0] == AVISO_VOZ_NAVEGADOR and len(banco.busquedas) == 2


def test_sin_voz_del_servidor_rechaza_un_guion_que_no_cabe():
    from app.servicios.servicio_narracion import diapositivas_sin_voz

    banco = BancoSimulado()
    spec = _spec_con_guiones("palabra " * 400)
    r = asyncio.run(diapositivas_sin_voz(SolicitudNarracion(video_job_spec=spec, voz_servidor=False), banco))
    assert r.status == "error" and r.error_codigo == "guion_largo" and banco.busquedas == []


def test_api_sin_voz_del_servidor_no_toca_voces_ni_almacen(api):
    _como(Principal(USUARIO, "token"))
    with patch("app.main._voces_narracion") as voces, \
         patch("app.main.BuscadorImagenes", return_value=_BancoCerrable()), \
         patch("app.main.almacen_del_entorno") as almacen:
        r = api.post("/api/v1/narracion/generar",
                     json={"video_job_spec": _spec(2).model_dump(), "voz_servidor": False})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "exito" and r.json()["video_job_spec"]["escenas"][0]["imagen"]["tipo"] == "foto"
    voces.assert_not_called()
    almacen.assert_not_called()


# --------------------------------------------------------------------- Varios modelos TTS de Gemini
def test_un_modelo_tts_agotado_se_salta_sin_llamar_y_responde_el_siguiente():
    from app.servicios.servicio_gemini import marcar_modelo_agotado

    agotada, siguiente = VozSimulada(), VozSimulada()
    marcar_modelo_agotado("tts-agotado")
    narrador = Narrador([VozGemini(agotada, "tts-agotado"), VozGemini(siguiente, "tts-libre")])
    r = _narrar(narrador)
    assert r.status == "exito" and r.video_job_spec.escenas[0].audio.modelo == "tts-libre"
    assert not agotada.llamadas and siguiente.llamadas
    assert any("cuota diaria agotada" in a for a in r.advertencias)


def test_las_voces_incluyen_los_modelos_tts_de_respaldo_sin_repetir(monkeypatch):
    from app.main import _voces_narracion

    monkeypatch.setenv("ELEVENLABS_API_KEY", "")  # vacía: load_dotenv no pisa una variable ya definida
    monkeypatch.setenv("GEMINI_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("GEMINI_TTS_MODEL", "tts-a")
    monkeypatch.setenv("GEMINI_TTS_FALLBACK_MODELS", "tts-b, tts-a ,tts-c")
    async def voces_en_bucle():  # el cliente Gemini es uno por bucle de eventos
        return _voces_narracion("Kore")

    voces = asyncio.run(voces_en_bucle())
    assert [v.identidad.split("|")[1] for v in voces] == ["tts-a", "tts-b", "tts-c"]
