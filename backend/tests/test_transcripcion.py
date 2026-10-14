"""
Imágenes y PDF escaneados: se transcriben una vez con Gemini, el usuario revisa el texto y
se genera desde él marcado como transcripción IA. Sin red: Gemini se simula.
"""

from __future__ import annotations

import asyncio
import io
from dataclasses import replace
from types import SimpleNamespace
from typing import List, Optional
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.auth import Principal, require_user
from app.core.config import Config
from app.core.ingestion import (
    IngestionError,
    PdfSinTexto,
    cargar_documento_desde_bytes,
    paginas_desde_marcadores,
    texto_con_marcadores,
    tipo_mime_imagen,
)
from app.main import AVISO_TRANSCRIPCION, _extraer_solicitud, _generar, app
from app.servicios import servicio_transcripcion
from app.servicios.servicio_gemini import GeminiError, RespuestaJson, Uso
from app.servicios.servicio_transcripcion import (
    ROTULO_DIAGRAMA,
    PaginaTranscrita,
    Transcripcion,
    TranscripcionModelo,
    transcribir,
)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
CONFIG = replace(
    Config.desde_entorno(cargar_dotenv=False),
    gemini_transcription_model="principal", gemini_transcription_fallback_model="respaldo",
)
TEXTO = "Una VM Always Free tiene 1 GB de RAM; se crea un swap de 4 GB con fallocate y permisos 600."


def _pdf_escaneado(paginas: int) -> bytes:
    """PDF sin capa de texto, como el de un escáner."""
    escritor = PdfWriter()
    for _ in range(paginas):
        escritor.add_blank_page(width=595, height=842)
    salida = io.BytesIO()
    escritor.write(salida)
    return salida.getvalue()


def _modelo(*paginas: PaginaTranscrita, contenido: str = "texto") -> TranscripcionModelo:
    return TranscripcionModelo(contenido=contenido, paginas=list(paginas))


class GeminiSimulado:
    """Responde por modelo: un TranscripcionModelo o un GeminiError. Registra cada llamada."""

    def __init__(self, **respuestas):
        self.respuestas = respuestas
        self.llamadas: List[dict] = []

    async def generar_json(self, *, modelo, entrada, max_reintentos: Optional[int] = None, timeout_s=None, **_):
        self.llamadas.append({"modelo": modelo, "max_reintentos": max_reintentos, "entrada": entrada})
        respuesta = self.respuestas[modelo]
        if isinstance(respuesta, Exception):
            raise respuesta
        return RespuestaJson(datos=respuesta, uso=Uso(modelo=modelo, intentos=1, latencia_s=0.1))


def _transcribir(cliente, datos=PNG, mime="image/png", paginas=1, config=CONFIG) -> Transcripcion:
    return asyncio.run(transcribir(cliente, config, datos, mime, paginas_esperadas=paginas))


# --------------------------------------------------------------------- ingesta
def test_las_paginas_salen_de_los_marcadores_aunque_se_corrija_el_texto():
    texto = texto_con_marcadores(["Primera página.", "Segunda página."])
    rangos = paginas_desde_marcadores(texto)
    assert [r.numero for r in rangos] == [1, 2]
    assert texto[rangos[1].inicio:rangos[1].fin].startswith("[Página 2]")
    corregido = texto.replace("Primera", "La primera y más larga")
    assert corregido[paginas_desde_marcadores(corregido)[1].inicio:].startswith("[Página 2]")
    # Marcadores desordenados: sin paginación antes que una página falsa
    assert paginas_desde_marcadores("[Página 2]\na\n[Página 1]\nb") == []
    assert paginas_desde_marcadores("sin marcadores") == []


def test_la_imagen_se_reconoce_por_sus_bytes_y_no_solo_por_la_extension():
    assert tipo_mime_imagen(PNG, "pizarra.PNG") == "image/png"
    assert tipo_mime_imagen(b"RIFF\x00\x00\x00\x00WEBPVP8 ", "foto.webp") == "image/webp"
    assert tipo_mime_imagen(b"%PDF-1.7", "doc.pdf") is None
    with pytest.raises(IngestionError, match="no es una imagen"):
        tipo_mime_imagen(b"#!/bin/sh\nrm -rf /", "script.png")


def test_pdf_sin_texto_avisa_cuantas_paginas_tiene():
    with pytest.raises(PdfSinTexto) as exc:
        cargar_documento_desde_bytes(_pdf_escaneado(3), "escaneo.pdf")
    assert exc.value.num_paginas == 3 and "transcríbelo" in str(exc.value)


def test_la_ingesta_directa_de_una_imagen_remite_a_la_transcripcion():
    with pytest.raises(IngestionError, match="/api/v1/documentos/extraer"):
        cargar_documento_desde_bytes(PNG, "pizarra.png")


# --------------------------------------------------------------------- servicio
def test_pdf_escaneado_conserva_sus_paginas():
    cliente = GeminiSimulado(principal=_modelo(
        PaginaTranscrita(numero=2, texto_visible="2 Activación\nmkswap /swapfile"),
        PaginaTranscrita(numero=1, texto_visible=TEXTO),
    ))
    r = _transcribir(cliente, _pdf_escaneado(2), "application/pdf", paginas=2)
    assert r.texto == texto_con_marcadores([TEXTO, "2 Activación\nmkswap /swapfile"])
    assert [p.numero for p in paginas_desde_marcadores(r.texto)] == [1, 2]
    assert r.modelo == "principal" and not any("página" in a for a in r.advertencias)
    entrada = cliente.llamadas[0]["entrada"][0]["content"]
    assert entrada[1]["type"] == "document" and entrada[1]["mime_type"] == "application/pdf"


def test_si_no_cuadran_las_paginas_no_se_inventan():
    cliente = GeminiSimulado(principal=_modelo(PaginaTranscrita(numero=1, texto_visible=TEXTO)))
    r = _transcribir(cliente, _pdf_escaneado(3), "application/pdf", paginas=3)
    assert "[Página" not in r.texto and "no indicarán número de página" in r.advertencias[0]


def test_la_descripcion_de_un_diagrama_va_rotulada_como_ia():
    cliente = GeminiSimulado(principal=_modelo(PaginaTranscrita(
        numero=1, texto_visible="Productor\nBroker Kafka\nConsumidor",
        descripcion_diagrama="Flecha 'publica' del Productor al Broker; flecha 'lee' del Broker al Consumidor.",
    ), contenido="texto_y_diagrama"))
    r = _transcribir(cliente)
    assert f"Consumidor\n\n{ROTULO_DIAGRAMA}\nFlecha" in r.texto
    assert r.con_diagramas and any("no son texto del original" in a for a in r.advertencias)
    assert cliente.llamadas[0]["entrada"][0]["content"][1]["type"] == "image"


def test_una_foto_sin_texto_no_es_una_fuente():
    cliente = GeminiSimulado(principal=_modelo(contenido="sin_contenido_util"))
    with pytest.raises(IngestionError, match="no es una fuente verificable"):
        _transcribir(cliente)
    casi_vacia = GeminiSimulado(principal=_modelo(PaginaTranscrita(numero=1, texto_visible="LEGO")))
    with pytest.raises(IngestionError):
        _transcribir(casi_vacia)


def test_modelo_saturado_pasa_al_respaldo_sin_reintentar():
    cliente = GeminiSimulado(
        principal=GeminiError("servidor", "503", reintentable=True, http_status=503),
        respaldo=_modelo(PaginaTranscrita(numero=1, texto_visible=TEXTO)),
    )
    r = _transcribir(cliente)
    assert r.modelo == "respaldo"
    assert [(c["modelo"], c["max_reintentos"]) for c in cliente.llamadas] == [("principal", 0), ("respaldo", None)]


def test_error_de_la_peticion_no_gasta_el_respaldo():
    cliente = GeminiSimulado(principal=GeminiError("peticion_invalida", "400", http_status=400))
    with pytest.raises(GeminiError):
        _transcribir(cliente)
    assert [c["modelo"] for c in cliente.llamadas] == ["principal"]


def test_limites_antes_de_gastar_cuota():
    cliente = GeminiSimulado()
    with pytest.raises(IngestionError, match="páginas"):
        _transcribir(cliente, _pdf_escaneado(1), "application/pdf", paginas=16)
    with pytest.raises(IngestionError, match="MB"):
        _transcribir(cliente, PNG + b"\x00" * servicio_transcripcion.MAX_BYTES_TRANSCRIPCION)
    assert cliente.llamadas == []


def test_el_plazo_total_corta_la_espera():
    class Lento:
        async def generar_json(self, **_):
            await asyncio.sleep(5)

    with patch.object(servicio_transcripcion, "PLAZO_TOTAL_S", 0.05), \
         pytest.raises(GeminiError) as exc:
        _transcribir(Lento())
    assert exc.value.codigo == "timeout"


# --------------------------------------------------------------------- API
@pytest.fixture
def api():
    app.dependency_overrides[require_user] = lambda: Principal("11111111-1111-4111-8111-111111111111", "test")
    yield TestClient(app)
    app.dependency_overrides.pop(require_user, None)


def _resultado(texto=TEXTO, advertencias=()):
    return Transcripcion(texto=texto, paginas=1, modelo="principal", con_diagramas=False,
                         advertencias=list(advertencias))


def test_extraer_texto_no_llama_a_gemini(api):
    with patch("app.main.transcribir", new=AsyncMock()) as transcribir_:
        r = api.post("/api/v1/documentos/extraer", files={"archivo": ("guia.md", f"# Swap\n\n{TEXTO}".encode())})
    assert r.status_code == 200, r.text
    assert r.json()["origen"] == "documento" and TEXTO in r.json()["texto"]
    transcribir_.assert_not_called()


def test_extraer_imagen_devuelve_la_transcripcion(api):
    with patch("app.main.transcribir", new=AsyncMock(return_value=_resultado(advertencias=["Hay poco texto"]))) as t:
        r = api.post("/api/v1/documentos/extraer", files={"archivo": ("pizarra.png", PNG)})
    assert r.status_code == 200, r.text
    assert r.json() == {"titulo": "pizarra", "texto": TEXTO, "origen": "transcripcion_ia", "paginas": 1,
                        "modelo": "principal", "advertencias": ["Hay poco texto"]}
    assert t.call_args.args[3] == "image/png"


def test_extraer_pdf_escaneado_lo_transcribe_con_sus_paginas(api):
    with patch("app.main.transcribir", new=AsyncMock(return_value=_resultado())) as t:
        r = api.post("/api/v1/documentos/extraer", files={"archivo": ("acta.pdf", _pdf_escaneado(2))})
    assert r.status_code == 200 and r.json()["origen"] == "transcripcion_ia"
    assert t.call_args.args[3] == "application/pdf" and t.call_args.kwargs["paginas_esperadas"] == 2


def test_extraer_rechaza_imagen_falsa_y_avisa_si_gemini_no_responde(api):
    r = api.post("/api/v1/documentos/extraer", files={"archivo": ("foto.jpg", b"no soy un jpeg")})
    assert r.status_code == 400
    with patch("app.main.transcribir", new=AsyncMock(side_effect=GeminiError("rate_limit", "429", reintentable=True))):
        r = api.post("/api/v1/documentos/extraer", files={"archivo": ("foto.png", PNG)})
    assert r.status_code == 503 and "rate_limit" in r.json()["detail"]


def test_adaptar_desde_una_transcripcion_marca_el_origen_y_avisa():
    texto = texto_con_marcadores([TEXTO, "2 Activación\nPrimero mkswap y luego swapon."])
    solicitud = asyncio.run(_extraer_solicitud(
        archivo=None, texto_directo=texto, titulo="Acta", perfil_destinatario="Principiante",
        formato_salida="Flashcards", nicho_sector="General", nivel_detalle="Didáctico",
        tema_consulta=None, origen_contenido="transcripcion_ia",
    ))
    assert solicitud.origen_contenido == "transcripcion_ia"
    assert [p.numero for p in solicitud.paginas] == [1, 2]

    respuesta = SimpleNamespace(advertencias=["otro aviso"])
    with patch("app.main._generar_segun_modo", new=AsyncMock(return_value=respuesta)):
        asyncio.run(_generar(None, solicitud, "paralelo"))
    assert respuesta.advertencias == [AVISO_TRANSCRIPCION, "otro aviso"]


def test_texto_pegado_sigue_siendo_documento():
    solicitud = asyncio.run(_extraer_solicitud(
        archivo=None, texto_directo=f"[Página 1]\n{TEXTO}", titulo="Pegado", perfil_destinatario="Principiante",
        formato_salida="Flashcards", nicho_sector="General", nivel_detalle="Didáctico", tema_consulta=None,
    ))
    # Sin origen_contenido no se interpretan marcadores: el texto pegado no tiene páginas
    assert solicitud.origen_contenido == "documento" and solicitud.paginas == []


# --------------------------------------------------------------------- biblioteca de ejemplos
def test_texto_de_un_ejemplo_se_extrae_en_el_servidor_y_se_cachea():
    from app.main import _texto_documento_ejemplo

    _texto_documento_ejemplo.cache_clear()
    cliente = TestClient(app)
    for _ in range(2):
        r = cliente.get("/api/v1/documentos/ejemplos/Snowflake_SIGMOD.pdf/texto")
        assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["origen"] == "documento" and datos["paginas"] == 12 and "Snowflake" in datos["texto"]
    assert _texto_documento_ejemplo.cache_info().hits == 1


def test_solo_se_extraen_documentos_del_catalogo():
    cliente = TestClient(app)
    for nombre in ("IMG_2317.webp", "..%2F..%2F.env", "no-existe.pdf"):
        assert cliente.get(f"/api/v1/documentos/ejemplos/{nombre}/texto").status_code == 404
