"""
Localización de citas dentro del documento fuente.

Una cita es verificable si sus letras y dígitos aparecen en el documento en el mismo
orden y sin nada en medio. Se ignoran espacios, puntuación, guiones, marcas Markdown,
mayúsculas, tildes y variantes tipográficas (ligaduras, comillas curvas, guiones largos),
siempre igual en la cita y en el documento: las palabras y su orden deben coincidir, así
que una paráfrasis sigue sin coincidir.

Por qué tan poco estricto con la forma: el texto que extrae pypdf no es el que ve el
lector. Medido el 2026-10-14, reproduciendo frases reales con tipografía normal (como
citan los modelos), la comparación anterior (solo espacios, mayúsculas y Markdown) no
localizaba el 66 % de las frases del paper de Snowflake (ligaduras "ﬁ"/"ﬂ" y 244 palabras
cortadas con guion a final de línea) ni el ~5 % de las del ENISA (comillas "’" y espacios
que pypdf mete dentro de palabras: "nota ble").

Además de decir *si* aparece, se devuelve *dónde* (offset en el texto original), para
derivar la página real de origen en lugar de confiar en la que declare el LLM.
"""

from __future__ import annotations

import unicodedata
from array import array
from functools import lru_cache
from typing import List, Optional, Tuple

from app.core.schemas import RangoPagina, pagina_de_offset

# Letras y dígitos: ~ 3 palabras. Más corto, cualquier fragmento coincide por azar.
MIN_LARGO_CITA = 16


def _normalizar(texto: str) -> Tuple[str, array]:
    """
    Solo letras y dígitos, en minúsculas y sin tildes (NFKD: "ﬁ" → "fi", "é" → "e"),
    guardando para cada carácter normalizado su offset en el texto original.
    """
    salida: List[str] = []
    mapa = array("l")
    for i, c in enumerate(texto):
        if c.isascii():
            if c.isalnum():
                salida.append(c.lower())
                mapa.append(i)
            continue
        for d in unicodedata.normalize("NFKD", c):
            for m in d.casefold():
                if m.isalnum():  # descarta marcas combinantes (tildes), puntuación y espacios
                    salida.append(m)
                    mapa.append(i)
    return "".join(salida), mapa


@lru_cache(maxsize=2)  # cada documento ocupa ~8 bytes por carácter en el mapa
def _indice_documento(documento: str) -> Tuple[str, array]:
    return _normalizar(documento)


def ubicar_cita(cita: str, documento: str) -> Optional[int]:
    """Offset en `documento` donde empieza la cita, o None si no aparece (o es demasiado corta)."""
    cita_norm, _ = _normalizar(cita)
    if len(cita_norm) < MIN_LARGO_CITA:
        return None
    texto, mapa = _indice_documento(documento)
    posicion = texto.find(cita_norm)
    return mapa[posicion] if posicion >= 0 else None


def pagina_de_cita(cita: str, documento: str, paginas: List[RangoPagina]) -> Tuple[bool, Optional[int]]:
    """(verificada, página). La página solo se informa si la cita se localizó en el documento."""
    offset = ubicar_cita(cita, documento)
    if offset is None:
        return False, None
    return True, pagina_de_offset(paginas, offset)
