"""Fotos del video preparadas durante la generación y revisión de las dudosas (sin red ni cuota)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

import httpx

from app.core.schemas import EscenaDirectorCut, ImagenEscena, VideoJobSpec
from app.servicios.preparacion_fotos import Candidata, PreparadorFotos, RevisorFotos, SalidaRevision
from app.servicios.servicio_gemini import GeminiError

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200

_OV = {"license": "by-sa", "license_version": "2.0", "creator": "towo", "title": "Server rack",
       "thumbnail": "https://api.openverse.org/v1/images/1/thumb/", "foreign_landing_url": "https://flickr.com/1"}


def _wm(titulo: str) -> Dict[str, Any]:
    return {"index": 1, "title": titulo, "imageinfo": [{
        "mime": "image/jpeg", "width": 1600, "height": 900, "thumburl": "https://upload.wikimedia.org/x.jpg",
        "descriptionurl": "https://commons.wikimedia.org/wiki/File:x.jpg",
        "extmetadata": {"LicenseShortName": {"value": "CC BY-SA 3.0"}, "Artist": {"value": "Abigor"},
                        "Categories": {"value": ""}, "ImageDescription": {"value": ""},
                        "Restrictions": {"value": ""}},
    }]}


def _spec(*palabras: Optional[str]) -> Dict[str, Any]:
    escenas = [
        EscenaDirectorCut(
            id=f"sc-{n}", escena=n, tiempo="00:00 - 00:00", titulo=f"Escena {n}",
            guion_locutor=" ".join(f"palabra{n}x{i}" for i in range(40)),
            storyboard_visual="Diapositiva.", consejo_pedagogico="Pausa.",
            imagen=ImagenEscena(palabra_clave=p) if p else None,
        )
        for n, p in enumerate(palabras, start=1)
    ]
    return VideoJobSpec(video_job_id="vjob-doc-0123456789abcdef", document_id="doc-0123456789abcdef",
                        escenas=escenas).model_dump()


def _bancos(request: httpx.Request) -> httpx.Response:
    """Openverse tiene foto de racks; Wikimedia, de bibliotecas. Las fotos se descargan como JPEG."""
    q = request.url.params.get("q") or request.url.params.get("gsrsearch") or ""
    if request.url.host == "api.openverse.org":
        return httpx.Response(200, json={"results": [_OV] if "rack" in q else []})
    if request.url.host == "commons.wikimedia.org":
        pages = {"1": _wm("File:Library bookshelves.jpg")} if "library" in q else {}
        return httpx.Response(200, json={"query": {"pages": pages}})
    return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})


class RevisorFalso:
    def __init__(self, motivos: List[Optional[str]]):
        self.motivos, self.recibidas = motivos, []

    async def revisar(self, candidatas):
        self.recibidas.append([c.foto.proveedor for c in candidatas])
        return self.motivos


def test_prepara_las_fotos_y_solo_revisa_las_dudosas():
    revisor = RevisorFalso([None])
    preparador = PreparadorFotos(revisor, transport=httpx.MockTransport(_bancos))
    r = asyncio.run(preparador(_spec("server rack", "library bookshelves", "cloud computing", None)))
    assert r.imagenes[0]["proveedor"] == "openverse" and r.imagenes[0]["palabra_clave"] == "server rack"
    assert r.imagenes[1]["proveedor"] == "wikimedia"
    assert r.imagenes[2] is None and r.imagenes[3] is None  # ambigua o sin palabra: no cambian
    assert revisor.recibidas == [["wikimedia"]] and r.avisos == []  # Openverse no se revisa


def test_foto_descartada_queda_como_diapositiva_sin_palabra_clave_y_con_aviso():
    revisor = RevisorFalso(["muestra un cartel con texto"])
    preparador = PreparadorFotos(revisor, transport=httpx.MockTransport(_bancos))
    r = asyncio.run(preparador(_spec("library bookshelves")))
    assert r.imagenes[0] == ImagenEscena(tipo="diapositiva").model_dump()  # el botón no la vuelve a buscar
    assert r.avisos == ["La foto de la escena 1 se descartó tras revisarla: muestra un cartel con texto."]


def test_sin_fotos_dudosas_no_se_llama_al_revisor():
    revisor = RevisorFalso([])
    r = asyncio.run(PreparadorFotos(revisor, transport=httpx.MockTransport(_bancos))(_spec("server rack")))
    assert revisor.recibidas == [] and r.imagenes[0]["proveedor"] == "openverse"


class ClienteFalso:
    def __init__(self, salida: Optional[Dict[str, Any]] = None, fallos: Optional[Dict[str, str]] = None):
        self.salida, self.fallos, self.llamadas = salida, fallos or {}, []

    async def generar_json(self, *, modelo, entrada, esquema_salida, **_):
        self.llamadas.append((modelo, entrada))
        if modelo in self.fallos:
            raise GeminiError(self.fallos[modelo], "falla simulada", reintentable=True)
        return SimpleNamespace(datos=esquema_salida.model_validate(self.salida))


def _candidata(n: int, url: str = "https://upload.wikimedia.org/x.jpg") -> Candidata:
    foto = ImagenEscena(tipo="foto", url=url, autor="A", licencia="CC0", proveedor="wikimedia")
    return Candidata(f"Escena {n}", f"Texto {n}", foto)


def _imagenes(request: httpx.Request) -> httpx.Response:
    if "rota" in request.url.path:
        return httpx.Response(404)
    if "html" in request.url.path:
        return httpx.Response(200, content=b"<html>", headers={"content-type": "text/html"})
    return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})


def test_revisor_una_sola_llamada_con_todas_las_fotos_y_el_respaldo():
    salida = {"veredictos": [{"foto": 1, "sirve": True, "motivo": "un rack"},
                             {"foto": 2, "sirve": False, "motivo": "es un logotipo"}]}
    cliente = ClienteFalso(salida, fallos={"principal": "cuota_diaria"})
    revisor = RevisorFotos(cliente, "principal", "respaldo", transport=httpx.MockTransport(_imagenes))
    motivos = asyncio.run(revisor.revisar([_candidata(1), _candidata(2)]))
    assert motivos == [None, "es un logotipo"]
    assert [m for m, _ in cliente.llamadas] == ["principal", "respaldo"]
    contenido = cliente.llamadas[-1][1][0]["content"]
    assert [c["type"] for c in contenido].count("image") == 2
    assert "Escena 2" in contenido[3]["text"]


def test_revisor_salta_las_fotos_que_no_se_pueden_descargar_y_numera_bien():
    salida = {"veredictos": [{"foto": 1, "sirve": False, "motivo": "no es la escena"}]}
    cliente = ClienteFalso(salida)
    revisor = RevisorFotos(cliente, "principal", transport=httpx.MockTransport(_imagenes))
    candidatas = [_candidata(1, "https://upload.wikimedia.org/rota.jpg"),
                  _candidata(2, "https://upload.wikimedia.org/html.jpg"), _candidata(3)]
    # la foto 1 que ve Gemini es la tercera candidata
    assert asyncio.run(revisor.revisar(candidatas)) == [None, None, "no es la escena"]


def test_revisor_sin_respuesta_o_sin_fotos_deja_todo_como_estaba():
    caido = ClienteFalso(fallos={"principal": "timeout"})
    revisor = RevisorFotos(caido, "principal", transport=httpx.MockTransport(_imagenes))
    assert asyncio.run(revisor.revisar([_candidata(1)])) == [None]
    nadie = ClienteFalso({"veredictos": []})
    revisor = RevisorFotos(nadie, "principal", transport=httpx.MockTransport(_imagenes))
    assert asyncio.run(revisor.revisar([_candidata(1, "https://upload.wikimedia.org/rota.jpg")])) == [None]
    assert nadie.llamadas == []  # sin fotos descargadas, no se gasta la llamada


def test_esquema_de_revision():
    assert SalidaRevision.model_validate({"veredictos": [{"foto": 1, "sirve": True, "motivo": "ok"}]})
