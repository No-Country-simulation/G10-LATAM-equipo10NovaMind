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
from bisect import bisect_left
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


# Marca de bloque de código Markdown con su etiqueta de lenguaje ("```bash"). Al citar una frase y
# el comando que la sigue, unas veces el modelo omite la marca y otras la copia en la misma línea;
# la etiqueta no es texto del documento que vea el lector. Se descarta en cualquier posición, igual
# en la cita y en el documento: si solo se quitara al inicio de línea, la cita que la copia en
# línea dejaría de coincidir. Medido el 2026-10-14 en la prueba de nichos: 7 de 18 citas
# rechazadas eran literales y solo fallaban por "bash" o "text" en medio.
_VALLA_CODIGO = re.compile(r"(?:`{3,}|~{3,})[A-Za-z0-9_+#.-]*")


def _normalizar(texto: str) -> Tuple[str, array]:
    """
    Solo letras y dígitos, en minúsculas y sin tildes (NFKD: "ﬁ" → "fi", "é" → "e"),
    guardando para cada carácter normalizado su offset en el texto original. Las llamadas
    a nota al pie (dígitos pegados tras una letra o ")", superíndices) y las marcas de
    bloque de código con su etiqueta se descartan.
    """
    salida: List[str] = []
    mapa = array("l")
    vallas = {m.start(): m.end() for m in _VALLA_CODIGO.finditer(texto)} if "``" in texto or "~~" in texto else {}
    saltar_hasta = 0
    for i, c in enumerate(texto):
        if i < saltar_hasta:
            continue
        if i in vallas:
            saltar_hasta = vallas[i]
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


# Año seguido en la cita de una letra: en el documento puede llevar pegada una llamada a nota
# ("in 2025295. The" = año 2025 + nota 295). _fin_de_nota no la ve porque va tras un dígito.
_AÑO_EN_CITA = re.compile(r"(?<!\d)(?:19|20)\d\d(?=[a-z])")
_MAX_DIGITOS_NOTA_TRAS_AÑO = 3


def _tramo_con_nota_tras_año(cita_norm: str, documento: str) -> Optional[Tuple[int, int]]:
    """
    La cita, admitiendo en el documento 1 a 3 dígitos pegados tras un año de la cita, solo si
    en el original van contiguos al año y les sigue algo que no es letra ni dígito. Así
    "in 2025. The" coincide con "in 2025295. The", pero "4 GB" no coincide con "48 GB" ni
    "en 2025 vulnerabilidades" con "en 2025 295 vulnerabilidades".
    """
    años = list(_AÑO_EN_CITA.finditer(cita_norm))
    if not años:
        return None
    patron, previo = [], 0
    for m in años:
        patron += [re.escape(cita_norm[previo:m.end()]), rf"(\d{{1,{_MAX_DIGITOS_NOTA_TRAS_AÑO}}})?"]
        previo = m.end()
    patron.append(re.escape(cita_norm[previo:]))
    texto, mapa = _indice_documento(documento)
    for m in re.finditer("".join(patron), texto):
        valida = True
        for g in range(1, len(años) + 1):
            if m.group(g) is None:
                continue
            a, b = m.span(g)
            tras = mapa[b - 1] + 1
            if any(mapa[j] != mapa[j - 1] + 1 for j in range(a, b)) or (
                    tras < len(documento) and documento[tras].isalnum()):
                valida = False
                break
        if valida:
            return mapa[m.start()], mapa[m.end() - 1] + 1
    return None


# Salto de página: el texto extraído conserva la cabecera de cada página ("ENISA Threat Landscape
# 2026 / TLP:CLEAR | September 2026 / 42") y las notas al pie al final de la anterior. Una frase
# partida entre dos páginas no aparece seguida. Medido el 2026-10-14 en el ENISA.
_LINEAS_CABECERA = 6
_NUMERO_PAGINA = re.compile(r"\d{1,4}")
# Tras el final del contenido de la página: la llamada a nota que la cita omite ("EU171."), solo
# puntuación y espacios (nada que sea letra o dígito), y después nada o una línea de nota ("548 https://…")
_COLA_DE_PAGINA = re.compile(r"(?:\d{1,4}|[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?[^\w]*?(?:\n[ \t]*\d{1,4}[ \t]+\S|\Z)")


def _linea_normalizada(linea: str) -> str:
    return " ".join(linea.split()).lower()


@lru_cache(maxsize=2)
def _inicios_de_contenido(documento: str, rangos: Tuple[Tuple[int, int], ...]) -> Tuple[int, ...]:
    """
    Para cada página, el offset donde empieza su contenido: se saltan las líneas en blanco, el
    número de página y las líneas que abren al menos la mitad de las páginas (cabecera repetida).
    """
    primeras: List[List[Tuple[str, int, int]]] = []
    for inicio, fin in rangos:
        lineas, pos = [], inicio
        for linea in documento[inicio:fin].splitlines(keepends=True):
            if len(lineas) >= _LINEAS_CABECERA:
                break
            lineas.append((_linea_normalizada(linea), pos, pos + len(linea)))
            pos += len(linea)
        primeras.append(lineas)
    frecuencia: Dict[str, int] = {}
    for lineas in primeras:
        for texto in {t for t, _, _ in lineas if t}:
            frecuencia[texto] = frecuencia.get(texto, 0) + 1
    umbral = max(3, len(rangos) // 2)
    repetidas = {t for t, n in frecuencia.items() if n >= umbral}
    inicios = []
    for (inicio, _), lineas in zip(rangos, primeras):
        contenido = inicio
        for texto, _, fin_linea in lineas:
            if texto and texto not in repetidas and not _NUMERO_PAGINA.fullmatch(texto):
                break
            contenido = fin_linea
        inicios.append(contenido)
    return tuple(inicios)


def _tramo_entre_paginas(cita_norm: str, documento: str,
                         paginas: List[RangoPagina]) -> Optional[Tuple[int, int]]:
    """
    La cita partida en dos: el principio cierra el contenido de una página (después solo hay
    puntuación o notas al pie) y el resto abre la siguiente, justo tras su cabecera. Lo que hay
    en medio (notas, cabecera, número de página) no es texto que el lector lea en la frase.
    """
    if len(paginas) < 2:
        return None
    rangos = tuple((p.inicio, p.fin) for p in paginas)
    texto, mapa = _indice_documento(documento)
    inicios = _inicios_de_contenido(documento, rangos)
    for n in range(1, len(rangos)):
        siguiente = bisect_left(mapa, inicios[n])
        if siguiente >= len(texto):
            continue
        anterior_ini, anterior_fin = bisect_left(mapa, rangos[n - 1][0]), bisect_left(mapa, rangos[n - 1][1])
        for corte in range(1, len(cita_norm)):
            if cita_norm[corte] != texto[siguiente] or not texto.startswith(cita_norm[corte:], siguiente):
                continue
            principio = cita_norm[:corte]
            pos = texto.find(principio, anterior_ini, anterior_fin)
            while pos >= 0:
                fin_principio = mapa[pos + corte - 1] + 1
                if _COLA_DE_PAGINA.match(documento, fin_principio, rangos[n - 1][1]):
                    return mapa[pos], mapa[siguiente + len(cita_norm) - corte - 1] + 1
                pos = texto.find(principio, pos + 1, anterior_fin)
    return None


def tramo_de_cita(cita: str, documento: str,
                  paginas: Optional[List[RangoPagina]] = None) -> Optional[Tuple[int, int]]:
    """
    (inicio, fin) del tramo de `documento` que ocupa la cita, o None si no aparece (o es demasiado corta).
    Si no aparece seguida, se admiten dos interrupciones que el lector no ve: una nota pegada a un
    año y, con `paginas`, un salto de página con sus notas al pie y la cabecera de la siguiente.
    """
    cita_norm, _ = _normalizar(cita)
    if len(cita_norm) < MIN_LARGO_CITA:
        return None
    texto, mapa = _indice_documento(documento)
    posicion = texto.find(cita_norm)
    if posicion >= 0:
        return mapa[posicion], mapa[posicion + len(cita_norm) - 1] + 1
    return _tramo_con_nota_tras_año(cita_norm, documento) or (
        _tramo_entre_paginas(cita_norm, documento, paginas) if paginas else None)


def ubicar_cita(cita: str, documento: str, paginas: Optional[List[RangoPagina]] = None) -> Optional[int]:
    """Offset en `documento` donde empieza la cita, o None si no aparece (o es demasiado corta)."""
    tramo = tramo_de_cita(cita, documento, paginas)
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
    tramo = tramo_de_cita(cita, documento, paginas)
    if tramo is None:
        return None
    inicio, fin = tramo
    limite_ini, limite_fin = 0, len(documento)
    for pagina in paginas:
        if pagina.inicio <= inicio < pagina.fin:
            limite_ini = pagina.inicio
        if pagina.inicio < fin <= pagina.fin:
            limite_fin = pagina.fin  # una cita que cruza de página llega hasta el final de la siguiente
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
    offset = ubicar_cita(cita, documento, paginas)
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
