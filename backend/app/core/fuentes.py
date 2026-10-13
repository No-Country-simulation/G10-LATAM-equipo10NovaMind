"""
Localización de citas dentro del documento fuente.

Una cita es verificable si aparece literalmente en el documento, ignorando
diferencias de espacios, mayúsculas y marcas de formato Markdown en línea
(** * ` _ ~ #): los modelos citan el texto visible, sin la marca. Las marcas se
ignoran en la cita y en el documento por igual, así que una paráfrasis sigue sin
coincidir. Además de decir *si* aparece, se devuelve
*dónde* (offset en el texto original), para derivar la página real de origen en
lugar de confiar en la que declare el LLM.
"""

from __future__ import annotations

from array import array
from functools import lru_cache
from typing import List, Optional, Tuple

from app.core.schemas import RangoPagina, pagina_de_offset

MIN_LARGO_CITA = 20
_MARCAS_MARKDOWN = frozenset("*`_~#")


def _normalizar(texto: str) -> Tuple[str, array]:
    """
    Colapsa espacios, quita marcas Markdown en línea y pasa a minúsculas carácter a
    carácter, guardando para cada carácter normalizado su offset en el texto original.
    """
    salida: List[str] = []
    mapa = array("l")
    en_espacio = True  # descarta espacios iniciales
    for i, c in enumerate(texto):
        if c in _MARCAS_MARKDOWN:
            continue
        if c.isspace():
            if not en_espacio:
                salida.append(" ")
                mapa.append(i)
                en_espacio = True
            continue
        for minuscula in c.lower():  # per-char: la cita y el documento se normalizan igual
            salida.append(minuscula)
            mapa.append(i)
        en_espacio = False
    if salida and salida[-1] == " ":
        salida.pop()
        mapa.pop()
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
