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
from app.core.fuentes import contexto_de_cita, fragmentos_para_auditoria, pagina_de_cita, tramo_de_cita, ubicar_cita
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


def test_cita_que_une_frase_y_comando_ignora_la_valla_del_bloque_de_codigo():
    # Caso real (prueba de nichos): el modelo cita la frase y el comando sin la marca "```bash"
    doc = "Se formatea el archivo como swap para el kernel:\n```bash\nsudo mkswap /swapfile\n```\nY luego se activa."
    tramo = tramo_de_cita("Se formatea el archivo como swap para el kernel: sudo mkswap /swapfile", doc)
    assert tramo is not None and doc[tramo[0]:tramo[1]].endswith("/swapfile")
    assert ubicar_cita("sudo mkswap /swapfile Y luego se activa", doc) is not None
    # 2.ª corrida: el modelo también copia la marca en la misma línea; debe coincidir igual
    assert ubicar_cita("para el kernel: ```bash sudo mkswap /swapfile ```", doc) is not None
    # La etiqueta del lenguaje no es texto del documento, y cambiar el comando sigue sin coincidir
    assert ubicar_cita("para el kernel: bash sudo mkswap /swapfile", doc) is None
    assert ubicar_cita("Se formatea el archivo como swap para el kernel: sudo mkfs /swapfile", doc) is None
    # Las palabras que siguen a la marca tras un espacio sí cuentan
    assert ubicar_cita("usa ``` bash dentro de una frase normal", "Texto: usa ``` bash dentro de una frase normal.") is not None
    assert ubicar_cita("usa dentro de una frase normal", "Texto: usa ``` bash dentro de una frase normal.") is None


def test_cita_con_tipografia_normal_se_ubica_en_texto_extraido_de_pdf():
    # Artefactos reales de pypdf (Snowflake y ENISA): ligaduras, palabras cortadas con
    # guion a final de línea, espacios dentro de palabras, comillas curvas y tildes.
    doc = ("Intro.\nThe Snowﬂake Elastic Data Ware-\nhouse is a multi-tenant, transac-\ntional service. "
           "Another nota ble development was the adaptation of threat groups’ operations. "
           "La memoria se incrementa a 5 GB efectivos.")
    assert ubicar_cita("The Snowflake Elastic Data Warehouse is a multi-tenant, transactional service", doc) == 7
    assert ubicar_cita("Another notable development was the adaptation of threat groups' operations", doc) is not None
    assert ubicar_cita("la memoria se increménta a 5 GB efectivos", doc) is not None
    # Cambiar, quitar o reordenar palabras sigue sin pasar
    assert ubicar_cita("The Snowflake Elastic Data Warehouse is a single-tenant transactional service", doc) is None
    assert ubicar_cita("Another development was notable: the adaptation of threat groups", doc) is None


def test_las_llamadas_a_nota_al_pie_no_impiden_ubicar_la_cita():
    # Caso real del ENISA: "(EUVD)631" y "EU629"; el modelo cita sin el número de nota
    doc = ("practices in \nthe EU629 and ENISA maintains the European Vulnerability Database \n(EUVD)631 to "
           "further support the community². Usa IPv6 y 4 GB de swap.")
    assert ubicar_cita("ENISA maintains the European Vulnerability Database (EUVD) to further support "
                       "the community", doc) is not None
    assert ubicar_cita("practices in the EU and ENISA maintains", doc) is not None
    assert ubicar_cita("practices in the EU629 and ENISA maintains", doc) is not None
    # Los números separados por espacio siguen contando
    assert ubicar_cita("Usa IPv6 y 4 GB de swap", doc) is not None
    assert ubicar_cita("Usa IPv6 y 8 GB de swap", doc) is None


def test_cita_corta_o_ausente_no_se_ubica():
    assert ubicar_cita("swap", DOCUMENTO) is None  # < 20 caracteres
    assert ubicar_cita("Kubernetes reinicia los pods cada hora", DOCUMENTO) is None


def test_pagina_de_cita():
    assert pagina_de_cita("usa una tabla de rutas propia", DOCUMENTO, PAGINAS) == (True, 2)
    assert pagina_de_cita("usa una tabla de rutas propia", DOCUMENTO, []) == (True, None)
    assert pagina_de_cita("texto que no existe en el documento", DOCUMENTO, PAGINAS) == (False, None)


# --- Visor de fuente: el texto real que rodea la cita ------------------------------
def test_contexto_devuelve_el_fragmento_literal_del_documento_y_no_el_del_modelo():
    documento = "Introducción.\n\nLa memoria ﬁnita de la VM se amplía con swap. Fin del texto."
    ctx = contexto_de_cita("la memoria finita de la vm se amplia con swap", documento, [])
    assert ctx["fragmento"] == "La memoria ﬁnita de la VM se amplía con swap"  # con su ligadura y tildes
    assert ctx["antes"] == "Introducción.\n\n" and ctx["despues"] == ". Fin del texto."
    assert not ctx["recortado_inicio"] and not ctx["recortado_fin"]


def test_contexto_no_cruza_de_pagina_y_corta_en_palabras_completas():
    p1 = "Página uno habla de otra cosa. "
    p2 = "alfa beta gamma delta " * 30 + "AQUÍ ESTÁ LA CITA QUE BUSCAMOS " + "epsilon zeta eta theta " * 30
    documento = p1 + p2
    paginas = [RangoPagina(numero=1, inicio=0, fin=len(p1)), RangoPagina(numero=2, inicio=len(p1), fin=len(documento))]
    ctx = contexto_de_cita("aquí está la cita que buscamos", documento, paginas, margen=40)
    assert ctx["fragmento"] == "AQUÍ ESTÁ LA CITA QUE BUSCAMOS"
    assert ctx["recortado_inicio"] and ctx["recortado_fin"]
    palabras = set("alfa beta gamma delta epsilon zeta eta theta".split())
    assert set(ctx["antes"].split()) <= palabras and set(ctx["despues"].split()) <= palabras  # sin medias palabras
    assert "Página uno" not in ctx["antes"]
    # Cerca del inicio de su página, el contexto se detiene en el límite de la página
    ctx_borde = contexto_de_cita("alfa beta gamma delta alfa beta", documento, paginas, margen=200)
    assert ctx_borde["antes"] == "" and not ctx_borde["recortado_inicio"]


def test_contexto_de_una_cita_ausente_es_none():
    assert contexto_de_cita("Kubernetes reinicia los pods cada hora", DOCUMENTO, PAGINAS) is None


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


# --- Contexto de la auditoría ------------------------------------------------------
def test_auditoria_ve_los_fragmentos_relacionados_y_no_solo_el_principio():
    relleno = " ".join(f"Seccion {i} describe procedimientos administrativos generales del organismo." for i in range(900))
    clave = "La European Vulnerability Database publica vulnerabilidades explotadas por ransomware."
    documento = relleno + " " + clave + " " + relleno
    assert len(documento) > 100_000 and documento.index(clave) > 24_000
    contexto = fragmentos_para_auditoria(
        ["Resumen: la European Vulnerability Database registra vulnerabilidades del ransomware."], documento, 24_000)
    assert clave in contexto and len(contexto) <= 24_000


def test_auditoria_de_un_documento_que_cabe_lo_recibe_entero():
    assert fragmentos_para_auditoria(["x"], DOCUMENTO, 24_000) == DOCUMENTO
