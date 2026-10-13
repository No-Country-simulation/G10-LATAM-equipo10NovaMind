"""
Etapa 1 · Contexto documental compartido: páginas y secciones desde la ingesta,
y página real de cada cita derivada de su posición en el documento.
"""

import asyncio
import io

import pytest
from fastapi import UploadFile
from pypdf import PdfReader
from reportlab.pdfgen import canvas

from app.agentes.cadena_colaborativa import CadenaColaborativaMultiModelo
from app.core.fuentes import pagina_de_cita, ubicar_cita
from app.core.ingestion import _limpiar_headers_repetidos, cargar_documento, detectar_secciones
from app.core.schemas import RangoPagina, SolicitudAdaptacion

PAGINAS_PDF = [
    ["1 Introduccion", "La memoria swap evita que el kernel active el OOM killer en VMs pequenas."],
    ["Programa ONE - encabezado repetido", "2.1 Arquitectura de red",
     "Cada subred privada de la VCN usa una tabla de rutas hacia el NAT Gateway."],
    ["3. Configura la red.", "El balanceador publico distribuye el trafico entre instancias sanas."],
]


@pytest.fixture
def pdf_tres_paginas(tmp_path):
    ruta = tmp_path / "guia.pdf"
    c = canvas.Canvas(str(ruta))
    for lineas in PAGINAS_PDF:
        y = 800
        for linea in lineas:
            c.drawString(72, y, linea)
            y -= 20
        c.showPage()
    c.save()
    return ruta


def _texto_legado(ruta) -> str:
    """Algoritmo de ingesta anterior: unir páginas y limpiar al final."""
    paginas = [p.extract_text() or "" for p in PdfReader(str(ruta)).pages]
    return _limpiar_headers_repetidos("\n".join(paginas))


# --- Ingesta ---------------------------------------------------------------------
def test_pdf_conserva_el_texto_legado_byte_a_byte(pdf_tres_paginas):
    doc = cargar_documento(pdf_tres_paginas)
    assert doc.texto == _texto_legado(pdf_tres_paginas)  # mismos ids por contenido


def test_pdf_rangos_de_pagina_contiguos_y_correctos(pdf_tres_paginas):
    doc = cargar_documento(pdf_tres_paginas)
    assert [p.numero for p in doc.paginas] == [1, 2, 3]
    assert doc.paginas[0].inicio == 0 and doc.paginas[-1].fin == len(doc.texto)
    for actual, siguiente in zip(doc.paginas, doc.paginas[1:]):
        assert actual.fin == siguiente.inicio
    trozos = [doc.texto[p.inicio:p.fin] for p in doc.paginas]
    assert "OOM killer" in trozos[0]
    assert "NAT Gateway" in trozos[1] and "Programa ONE" not in trozos[1]  # header limpiado
    assert "balanceador" in trozos[2]


def test_pdf_secciones_numeradas_con_pagina(pdf_tres_paginas):
    doc = cargar_documento(pdf_tres_paginas)
    titulos = {s.titulo: (s.nivel, s.pagina) for s in doc.secciones}
    assert titulos["1 Introduccion"] == (1, 1)
    assert titulos["2.1 Arquitectura de red"] == (2, 2)
    assert not any("Configura" in t for t in titulos)  # termina en punto: es una frase, no un encabezado


def test_markdown_secciones_sin_paginas(tmp_path):
    ruta = tmp_path / "doc.md"
    ruta.write_text("# Swap\n\nTexto.\n\n## Configuración ##\n\nMás texto.\n#hashtag no es título\n", encoding="utf-8")
    doc = cargar_documento(ruta)
    assert doc.paginas == []
    assert [(s.titulo, s.nivel, s.pagina) for s in doc.secciones] == [("Swap", 1, None), ("Configuración", 2, None)]


def test_texto_pegado_detecta_secciones_markdown():
    secciones = detectar_secciones("# Uno\ntexto\n## Dos\nmás", ".md")
    assert [s.titulo for s in secciones] == ["Uno", "Dos"]


def test_extraer_solicitud_lleva_el_contexto(pdf_tres_paginas):
    from app import main

    archivo = UploadFile(file=io.BytesIO(pdf_tres_paginas.read_bytes()), filename="guia.pdf")
    solicitud = asyncio.run(main._extraer_solicitud(
        archivo, None, None, "Principiante", "Flashcards", "General", "Didáctico", None,
    ))
    assert [p.numero for p in solicitud.paginas] == [1, 2, 3]
    assert any(s.titulo == "2.1 Arquitectura de red" for s in solicitud.secciones)


# --- Solicitud: rangos incoherentes se descartan ----------------------------------
def test_solicitud_descarta_rangos_fuera_del_texto():
    base = dict(
        documento_titulo="Doc",
        documento_contenido="x" * 100,
        perfil_destinatario="Principiante",
        formato_salida="Flashcards",
    )
    valida = SolicitudAdaptacion(**base, paginas=[{"numero": 1, "inicio": 0, "fin": 60}, {"numero": 2, "inicio": 60, "fin": 100}])
    assert len(valida.paginas) == 2
    invalida = SolicitudAdaptacion(**base, paginas=[{"numero": 1, "inicio": 0, "fin": 500}])
    assert invalida.paginas == []
    desordenada = SolicitudAdaptacion(**base, paginas=[{"numero": 1, "inicio": 50, "fin": 100}, {"numero": 2, "inicio": 0, "fin": 50}])
    assert desordenada.paginas == []


# --- Localización de citas ---------------------------------------------------------
DOCUMENTO = "Primera página sobre swap.\nSegunda página: Cada subred PRIVADA usa   una tabla de rutas propia."
PAGINAS = [RangoPagina(numero=1, inicio=0, fin=27), RangoPagina(numero=2, inicio=27, fin=len(DOCUMENTO))]


def test_ubicar_cita_ignora_espacios_y_mayusculas_y_devuelve_offset_original():
    offset = ubicar_cita("cada subred privada usa una tabla", DOCUMENTO)
    assert offset == DOCUMENTO.index("Cada subred")


def test_cita_sin_marcas_markdown_se_ubica_y_la_parafrasis_no():
    # Caso real (guía de swap): el modelo cita el texto visible, sin ** ni `
    doc = "Intro.\nAl crear un archivo (**Swap**) de **4 GB**, la memoria se incrementa de 1 GB a **5 GB efectivos**; ver `mm`."
    assert ubicar_cita("Al crear un archivo (Swap) de 4 GB, la memoria se incrementa de 1 GB a 5 GB efectivos", doc) == 7
    assert ubicar_cita("la memoria se incrementa de 1 GB al menos a 5 GB efectivos", doc) is None
    assert ubicar_cita("5 GB efectivos; ver mm.", doc) is not None


def test_cita_corta_o_ausente_no_se_ubica():
    assert ubicar_cita("swap", DOCUMENTO) is None  # < 20 caracteres
    assert ubicar_cita("Kubernetes reinicia los pods cada hora", DOCUMENTO) is None


def test_pagina_de_cita():
    assert pagina_de_cita("usa una tabla de rutas propia", DOCUMENTO, PAGINAS) == (True, 2)
    assert pagina_de_cita("usa una tabla de rutas propia", DOCUMENTO, []) == (True, None)
    assert pagina_de_cita("texto que no existe en el documento", DOCUMENTO, PAGINAS) == (False, None)


# --- Cadena: la página sale del documento, nunca del LLM ---------------------------
def test_cadena_asigna_pagina_real_e_ignora_la_del_llm():
    solicitud = SolicitudAdaptacion(
        documento_titulo="Redes",
        documento_contenido=DOCUMENTO,
        perfil_destinatario="Principiante",
        formato_salida="Flashcards",
        paginas=PAGINAS,
    )
    escena = {
        "guion_locutor": "palabra " * 40,
        "fuentes": [
            {"chunk_id": "c1", "pagina": 9, "texto_fuente": "Cada subred privada usa una tabla de rutas propia"},
            {"chunk_id": "c2", "pagina": 3, "texto_fuente": "Kubernetes reinicia los pods automáticamente"},
        ],
    }
    paquete = CadenaColaborativaMultiModelo()._normalizar_paquete_base({"director_cut": [escena]}, solicitud)
    fuentes = paquete["director_cut"][0]["fuentes"]
    assert [(f["verificada"], f["pagina"]) for f in fuentes] == [(True, 2), (False, None)]
