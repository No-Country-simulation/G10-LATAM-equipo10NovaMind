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

import math
import re
import unicodedata
from array import array
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

from app.core.schemas import RangoPagina, pagina_de_offset

# Letras y dígitos: ~ 3 palabras. Más corto, cualquier fragmento coincide por azar.
MIN_LARGO_CITA = 16
_SUPERINDICES = frozenset("⁰¹²³⁴⁵⁶⁷⁸⁹")
_ANTES_DE_NOTA = frozenset(")]”’\"'")
_MAX_DIGITOS_NOTA = 4


def _fin_de_nota(texto: str, i: int) -> int:
    """
    Si en `i` empieza una llamada a nota al pie pegada al texto ("(EUVD)631 to", "EU629 and"),
    devuelve dónde termina; si no, `i`. Los modelos la omiten al citar. Medido el 2026-10-14:
    2 de 31 citas del ENISA fallaban solo por esto.
    """
    if i == 0 or not texto[i].isdigit():
        return i
    anterior = texto[i - 1]
    if not (anterior.isalpha() or anterior in _ANTES_DE_NOTA):
        return i
    fin = i
    while fin < len(texto) and texto[fin].isdigit():
        fin += 1
    if fin - i > _MAX_DIGITOS_NOTA or (fin < len(texto) and texto[fin].isalnum()):
        return i
    return fin


def _normalizar(texto: str) -> Tuple[str, array]:
    """
    Solo letras y dígitos, en minúsculas y sin tildes (NFKD: "ﬁ" → "fi", "é" → "e"),
    guardando para cada carácter normalizado su offset en el texto original. Las llamadas
    a nota al pie (dígitos pegados tras una letra o ")", superíndices) se descartan.
    """
    salida: List[str] = []
    mapa = array("l")
    saltar_hasta = 0
    for i, c in enumerate(texto):
        if i < saltar_hasta:
            continue
        if c.isdigit() and (fin := _fin_de_nota(texto, i)) > i:
            saltar_hasta = fin
            continue
        if c in _SUPERINDICES:
            continue
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


def tramo_de_cita(cita: str, documento: str) -> Optional[Tuple[int, int]]:
    """(inicio, fin) del tramo de `documento` que ocupa la cita, o None si no aparece (o es demasiado corta)."""
    cita_norm, _ = _normalizar(cita)
    if len(cita_norm) < MIN_LARGO_CITA:
        return None
    texto, mapa = _indice_documento(documento)
    posicion = texto.find(cita_norm)
    if posicion < 0:
        return None
    return mapa[posicion], mapa[posicion + len(cita_norm) - 1] + 1


def ubicar_cita(cita: str, documento: str) -> Optional[int]:
    """Offset en `documento` donde empieza la cita, o None si no aparece (o es demasiado corta)."""
    tramo = tramo_de_cita(cita, documento)
    return tramo[0] if tramo else None


# Caracteres del documento que se muestran a cada lado de la cita en el visor de fuente
MARGEN_CONTEXTO = 280
_ESPACIOS = re.compile(r"\s")


def contexto_de_cita(cita: str, documento: str, paginas: List[RangoPagina],
                     margen: int = MARGEN_CONTEXTO) -> Optional[Dict[str, Any]]:
    """
    Texto literal del documento alrededor de la cita, para el visor de fuente: lo que hay antes,
    el fragmento exacto que ocupa la cita (como está en el documento, no como lo escribió el
    modelo) y lo que sigue. No cruza el límite de su página y corta en palabras completas.
    None si la cita no se localiza: el visor solo muestra lo que de verdad está en el documento.
    """
    tramo = tramo_de_cita(cita, documento)
    if tramo is None:
        return None
    inicio, fin = tramo
    limite_ini, limite_fin = 0, len(documento)
    for pagina in paginas:
        if pagina.inicio <= inicio < pagina.fin:
            limite_ini, limite_fin = pagina.inicio, pagina.fin
            break
    desde = max(limite_ini, inicio - margen)
    hasta = min(limite_fin, fin + margen)
    if desde > limite_ini and (espacio := _ESPACIOS.search(documento, desde, inicio)):
        desde = espacio.end()
    if hasta < limite_fin:
        ultimo = None
        for ultimo in _ESPACIOS.finditer(documento, fin, hasta):
            pass
        if ultimo is not None:
            hasta = ultimo.start()
    return {
        "antes": documento[desde:inicio],
        "fragmento": documento[inicio:fin],
        "despues": documento[fin:hasta],
        "recortado_inicio": desde > limite_ini,
        "recortado_fin": hasta < limite_fin,
    }


def pagina_de_cita(cita: str, documento: str, paginas: List[RangoPagina]) -> Tuple[bool, Optional[int]]:
    """(verificada, página). La página solo se informa si la cita se localizó en el documento."""
    offset = ubicar_cita(cita, documento)
    if offset is None:
        return False, None
    return True, pagina_de_offset(paginas, offset)


# --------------------------------------------------------------------- contexto de la auditoría
_TAMANO_BLOQUE = 1200
_SEPARADOR_BLOQUES = "\n[…]\n"
_PALABRAS_VACIAS = frozenset(
    "para como pero sobre entre desde hasta cada este esta estos estas como donde cuando porque "
    "tambien puede pueden debe deben hace hacen tiene tienen muy mas menos todo todos toda todas "
    "with that this from have their which about into been more also than they there these those "
    "will would could should other such only when what where while them then were your".split()
)


def _terminos(texto: str) -> List[str]:
    """Palabras de 4+ letras, en minúsculas y sin tildes, sin números ni palabras vacías."""
    return [p for p in _palabras(texto) if len(p) >= 4 and not p.isdigit() and p not in _PALABRAS_VACIAS]


def _palabras(texto: str) -> List[str]:
    palabras: List[str] = []
    actual: List[str] = []
    for c in texto:
        for d in unicodedata.normalize("NFKD", c):
            for m in d.casefold():
                if m.isalnum():
                    actual.append(m)
                elif not unicodedata.combining(m) and actual:
                    palabras.append("".join(actual))
                    actual = []
    if actual:
        palabras.append("".join(actual))
    return palabras


def _bloques(documento: str) -> List[Tuple[int, int]]:
    """Rangos [inicio, fin) de ~_TAMANO_BLOQUE caracteres, cortados en un espacio."""
    rangos: List[Tuple[int, int]] = []
    inicio = 0
    while inicio < len(documento):
        fin = min(len(documento), inicio + _TAMANO_BLOQUE)
        if fin < len(documento):
            corte = documento.rfind(" ", inicio + _TAMANO_BLOQUE // 2, fin)
            fin = corte if corte > inicio else fin
        rangos.append((inicio, fin))
        inicio = fin
    return rangos


def fragmentos_para_auditoria(afirmaciones: List[str], documento: str, maximo: int) -> str:
    """
    Fuente que ve el auditor cuando el documento no cabe entero: los bloques que más
    términos comparten con cada afirmación (ponderados por rareza en el documento), por
    turnos para que cada afirmación tenga su mejor bloque, en el orden del documento.
    Antes se enviaban los primeros `maximo` caracteres: en el ENISA (254 540) el auditor
    solo veía ~10 de 101 páginas y daba por inventado todo lo demás (anclaje 0,55).
    """
    if len(documento) <= maximo:
        return documento
    rangos = _bloques(documento)
    terminos_bloque = [set(_terminos(documento[a:b])) for a, b in rangos]
    frecuencia: dict = {}
    for terminos in terminos_bloque:
        for t in terminos:
            frecuencia[t] = frecuencia.get(t, 0) + 1
    total = len(rangos)
    idf = {t: math.log(1 + total / f) for t, f in frecuencia.items()}

    preferencias: List[List[int]] = []
    for afirmacion in afirmaciones:
        buscados = set(_terminos(afirmacion))
        puntos = [(sum(idf.get(t, 0.0) for t in buscados & tb), i) for i, tb in enumerate(terminos_bloque)]
        preferencias.append([i for p, i in sorted(puntos, key=lambda x: (-x[0], x[1])) if p > 0])

    elegidos: List[int] = []
    usado = 0
    for turno in range(total):
        avanzo = False
        for orden in preferencias:
            if turno >= len(orden):
                continue
            avanzo = True
            i = orden[turno]
            largo = rangos[i][1] - rangos[i][0] + len(_SEPARADOR_BLOQUES)
            if i in elegidos or usado + largo > maximo:
                continue
            elegidos.append(i)
            usado += largo
        if not avanzo or usado >= maximo - _TAMANO_BLOQUE:
            break
    if not elegidos:
        return documento[:maximo]
    # Bloques contiguos se unen como texto continuo: una frase partida entre dos sigue entera
    tramos: List[List[int]] = []
    for i in sorted(elegidos):
        if tramos and tramos[-1][1] == rangos[i][0]:
            tramos[-1][1] = rangos[i][1]
        else:
            tramos.append([rangos[i][0], rangos[i][1]])
    return _SEPARADOR_BLOQUES.join(documento[a:b].strip() for a, b in tramos)
