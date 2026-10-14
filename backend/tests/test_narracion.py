"""
Etapa 6 · Video narrado bajo demanda: voz medida, límite de 60 s, reutilización,
almacén privado por usuario y fotos libres filtradas. Sin red ni coste: Gemini y los
bancos de imágenes se simulan.
"""

from __future__ import annotations

import asyncio
import base64
import json
from typing import Dict, List, Optional
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth import Principal, require_user
from app.core.schemas import (
    EscenaDirectorCut,
    ImagenEscena,
    SolicitudAdaptacion,
    SolicitudNarracion,
    VideoJobSpec,
    velocidad_reproduccion,
)
from app.main import app
from app.servicios.registro_tareas import RegistroMemoria
from app.servicios.servicio_gemini import AudioGenerado, GeminiError, Uso
from app.servicios.servicio_imagenes import elegir_openverse, elegir_wikimedia
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

    def __init__(self, natural: float = 15.0, agil: float = 13.0, error: Optional[GeminiError] = None):
        self.natural, self.agil, self.error = natural, agil, error
        self.llamadas: List[str] = []

    async def sintetizar_voz(self, *, modelo, texto, voz, estilo, timeout_s):
        self.llamadas.append(estilo)
        if self.error:
            raise self.error
        segundos = self.agil if estilo == ESTILO_AGIL else self.natural
        return AudioGenerado(wav=b"RIFF" + texto[:8].encode(), duracion_s=segundos, sample_rate=24000,
                             canales=1, uso=Uso(modelo=modelo, intentos=1, latencia_s=0.1))


class BancoSimulado:
    def __init__(self, con_foto: bool = True):
        self.con_foto = con_foto
        self.busquedas: List[str] = []

    async def buscar(self, palabra_clave, alt):
        self.busquedas.append(palabra_clave)
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
    voz = VozSimulada(natural=25.0, agil=20.5)  # 61.5 s tras el ritmo ágil: la voz ya se pagó
    narrador = Narrador([VozGemini(voz, "tts-modelo")], almacen=AlmacenLocal(tmp_path), prefijo=prefijo_narraciones(USUARIO))
    r = _narrar(narrador)
    assert r.status == "exito" and r.duracion_total_real_s == 61.5
    assert r.video_job_spec.velocidad_reproduccion == 1.025
    assert any("1.025×" in aviso for aviso in r.advertencias)
    # Lo reutilizado conserva la velocidad
    r2 = _narrar(narrador)
    assert r2.reutilizado and r2.video_job_spec.velocidad_reproduccion == 1.025


def test_si_cabe_se_reproduce_a_velocidad_normal():
    r = _narrar(Narrador([VozGemini(VozSimulada(), "tts-modelo")]))
    assert r.video_job_spec.velocidad_reproduccion == 1.0
    assert not any("×" in aviso for aviso in r.advertencias)


def test_velocidad_de_reproduccion_tolera_hasta_un_5_por_ciento():
    assert velocidad_reproduccion(60.0, 60) == 1.0
    assert velocidad_reproduccion(60.1, 60) == 1.002  # siempre hacia arriba: nunca suena > 60 s
    assert velocidad_reproduccion(63.0, 60) == 1.05
    assert velocidad_reproduccion(63.1, 60) is None


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

    def __init__(self, restantes: int = 9000, estado_tts: int = 200, cuerpo_error=None, seg_por_caracter=0.06):
        self.restantes, self.estado_tts, self.cuerpo_error = restantes, estado_tts, cuerpo_error
        self.seg = seg_por_caracter
        self.cuerpos: List[dict] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        assert request.headers["xi-api-key"] == "clave-prueba"
        if request.url.path == "/v1/user/subscription":
            return httpx.Response(200, json={"character_limit": 10000, "character_count": 10000 - self.restantes})
        cuerpo = json.loads(request.content)
        self.cuerpos.append(cuerpo)
        if self.estado_tts != 200:
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
