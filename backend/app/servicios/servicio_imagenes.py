"""
Fotos de fondo para las diapositivas del video narrado (bancos libres, sin clave ni coste).

Orden de búsqueda: Openverse → Wikimedia Commons. Prueba real del 2026-10-13 con el
guion de Kafka: Openverse acertó 3 de 3; Wikimedia 1 de 3 (devolvió una portada de libro
y un cartel con texto), por eso aquí solo entra con filtros estrictos:
- solo JPEG apaisado de 1000 px o más (descarta logos, diagramas y portadas verticales);
- títulos con palabras de portada, cartel, logo, mapa, captura... se descartan; en Wikimedia
  se revisan también categorías y descripción, se excluyen temas sensibles o de actualidad
  (redadas, pruebas judiciales, eventos...) y fotos con restricciones de derechos de imagen;
- solo licencias que permiten adaptar la obra (la diapositiva superpone texto):
  CC BY, CC BY-SA, CC0 o dominio público. Nunca NC ni ND.

Solo se guarda la URL y la atribución; la imagen nunca pasa por el servidor.
Una búsqueda fallida devuelve None: la escena queda como diapositiva sin foto. Lo mismo
con una palabra clave ambigua ("cloud", "streaming", "kafka"...): ni se consulta.
"""

from __future__ import annotations

import html
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.core.schemas import ImagenEscena

logger = logging.getLogger("novamind.servicio_imagenes")

URL_OPENVERSE = "https://api.openverse.org/v1/images/"
URL_WIKIMEDIA = "https://commons.wikimedia.org/w/api.php"
# Wikimedia exige un User-Agent identificable
AGENTE = "NovaMind/2.0 (plataforma educativa; contacto via repositorio del proyecto)"

# Openverse tarda ~18 s en una búsqueda que no tiene en caché (medido el 2026-10-14; 0,5 s si
# la tiene). Con 8 s fallaba casi siempre y decidía Wikimedia, peor en significado. Las fotos
# van en paralelo con la voz y por escenas: el peor caso (25 + 8 s) cabe en PLAZO_VOZ_S.
TIMEOUT_OPENVERSE_S = 25.0
ANCHO_MINIMO_PX = 1000
PROPORCION_MINIMA = 1.3  # ancho / alto: solo apaisadas, el video es 16:9
MAX_RESULTADOS = 10

_PALABRAS_EXCLUIDAS = re.compile(
    r"\b(covers?|books?|logos?|posters?|banners?|signs?|signage|flyers?|screenshots?|screen ?shots?|maps?|"
    r"flags?|diagrams?|charts?|graphs?|infographics?|text|slides?|portadas?|libros?|carteles|cartel|"
    r"letreros?|mapas?|banderas?|capturas?|diagramas?|gr[aá]ficos?|plakate?|schilder?|karten?)\b",
    re.IGNORECASE,
)
# Wikimedia: el tema de la foto, no su contenido visual. Prueba real del 2026-10-13:
# "server rack" devolvía una prueba de los Epstein Files (redada del FBI) y "event
# streaming", fotos de eventos de marcas. Una diapositiva educativa no lleva nada de eso.
_TEMAS_EXCLUIDOS = re.compile(
    r"\b(epstein|raids?|crimes?|criminal|evidence|police|polic[ií]a|court|trials?|protests?|riots?|"
    r"wars?|military|weapons?|victims?|accidents?|disasters?|funerals?|nudity|nude|events?|festivals?|"
    r"birthday|conferences?|summits?|parades?|ceremon(y|ies)|elections?|campaigns?|advertis\w*)\b",
    re.IGNORECASE,
)
# Palabras clave cuyo sentido literal no es el informático: los bancos buscan por el
# literal. Prueba real del 2026-10-14: "cloud computing" daba un rayo entre nubes y
# "event streaming" / "message broker" nada pertinente. El prompt pide objetos físicos;
# si aun así llega una de estas, la escena queda sin foto antes que con una engañosa.
_PALABRAS_AMBIGUAS = re.compile(
    r"\b(clouds?|streams?|streaming|brokers?|pipelines?|bugs?|virus(es)?|worms?|python|java|kafka|"
    r"spark|docker|firewalls?|cookies?|spiders?|crawlers?|oracle|amazon|apple|"
    # 4.ª prueba de nichos: "error screen" y "server warning" para la escena del OOM Killer.
    # Darían una pantalla con texto, y la diapositiva no lleva texto en la foto.
    r"errors?|warnings?|alerts?)\b",
    re.IGNORECASE,
)
_LICENCIAS_OPENVERSE = {"by": "CC BY", "by-sa": "CC BY-SA", "cc0": "CC0", "pdm": "Dominio público"}
_LICENCIA_WIKIMEDIA_OK = re.compile(r"^(CC BY(-SA)? [\d.]+|CC0|Public domain)$", re.IGNORECASE)
_ETIQUETAS_HTML = re.compile(r"<[^>]+>")


def _texto_plano(valor: Any, maximo: int) -> str:
    texto = html.unescape(_ETIQUETAS_HTML.sub("", str(valor or "")))
    return re.sub(r"\s+", " ", texto).strip()[:maximo]


def _titulo_aceptable(titulo: str) -> bool:
    return not _PALABRAS_EXCLUIDAS.search(titulo.replace("_", " ").replace("-", " "))


def _metadatos_wikimedia_aceptables(titulo: str, meta: Dict[str, Any]) -> bool:
    """
    Título, categorías y descripción: un mapa o un cartel suelen delatarse en las categorías
    ("Maps showing 2025") aunque el título no lo diga. Las fotos con restricciones de
    derechos de imagen (personas identificables) tampoco se usan.
    """
    if _texto_plano((meta.get("Restrictions") or {}).get("value"), 200):
        return False
    texto = " ".join([
        titulo,
        _texto_plano((meta.get("Categories") or {}).get("value"), 2000).replace("|", " "),
        _texto_plano((meta.get("ImageDescription") or {}).get("value"), 1000),
    ]).replace("_", " ").replace("-", " ")
    return not (_PALABRAS_EXCLUIDAS.search(texto) or _TEMAS_EXCLUIDOS.search(texto))


def elegir_openverse(resultados: List[Dict[str, Any]], alt: str) -> Optional[ImagenEscena]:
    for r in resultados:
        licencia = _LICENCIAS_OPENVERSE.get(str(r.get("license") or "").lower())
        autor = _texto_plano(r.get("creator"), 200)
        url = r.get("thumbnail") or r.get("url")
        if not (licencia and autor and url and _titulo_aceptable(str(r.get("title") or ""))):
            continue
        version = str(r.get("license_version") or "").strip()
        if licencia.startswith("CC BY") and version:
            licencia = f"{licencia} {version}"
        return ImagenEscena(
            tipo="foto", url=url, alt=alt[:300], autor=autor, licencia=licencia,
            licencia_url=r.get("license_url"), fuente_url=r.get("foreign_landing_url"),
            proveedor="openverse",
        )
    return None


def elegir_wikimedia(paginas: List[Dict[str, Any]], alt: str) -> Optional[ImagenEscena]:
    for pagina in sorted(paginas, key=lambda p: p.get("index", 99)):
        info = (pagina.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata") or {}
        licencia = _texto_plano((meta.get("LicenseShortName") or {}).get("value"), 60)
        autor = _texto_plano((meta.get("Artist") or {}).get("value"), 200)
        ancho, alto = int(info.get("width") or 0), int(info.get("height") or 0)
        if not (
            info.get("mime") == "image/jpeg"
            and ancho >= ANCHO_MINIMO_PX and alto > 0 and ancho / alto >= PROPORCION_MINIMA
            and _LICENCIA_WIKIMEDIA_OK.match(licencia)
            and autor and info.get("thumburl")
            and _metadatos_wikimedia_aceptables(str(pagina.get("title") or ""), meta)
        ):
            continue
        return ImagenEscena(
            tipo="foto", url=info["thumburl"], alt=alt[:300], autor=autor,
            licencia="Dominio público" if licencia.lower() == "public domain" else licencia,
            licencia_url=(meta.get("LicenseUrl") or {}).get("value"),
            fuente_url=info.get("descriptionurl"), proveedor="wikimedia",
        )
    return None


class BuscadorImagenes:
    def __init__(self, *, timeout_s: float = 8.0, timeout_openverse_s: float = TIMEOUT_OPENVERSE_S,
                 transport: Optional[httpx.AsyncBaseTransport] = None):
        self._timeout_openverse = timeout_openverse_s
        self._http = httpx.AsyncClient(
            timeout=timeout_s, headers={"User-Agent": AGENTE}, transport=transport,
            follow_redirects=True, trust_env=False,
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def buscar(self, palabra_clave: str, alt: str) -> Optional[ImagenEscena]:
        consulta = palabra_clave.strip()[:60]
        if not consulta:
            return None
        if _PALABRAS_AMBIGUAS.search(consulta):
            logger.info("[imagenes] '%s' es ambigua para un banco de fotos: la escena queda sin foto.", consulta)
            return None
        for buscar in (self._openverse, self._wikimedia):
            try:
                imagen = await buscar(consulta, alt)
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                logger.warning("[imagenes] %s falló para '%s' (%s).", buscar.__name__, consulta, type(exc).__name__)
                continue
            if imagen:
                return imagen
        return None

    async def _openverse(self, consulta: str, alt: str) -> Optional[ImagenEscena]:
        r = await self._http.get(URL_OPENVERSE, params={
            "q": consulta, "page_size": MAX_RESULTADOS, "license_type": "commercial,modification",
            "aspect_ratio": "wide", "mature": "false",
        }, timeout=self._timeout_openverse)
        r.raise_for_status()
        return elegir_openverse(r.json().get("results") or [], alt)

    async def _wikimedia(self, consulta: str, alt: str) -> Optional[ImagenEscena]:
        r = await self._http.get(URL_WIKIMEDIA, params={
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": f"filetype:bitmap {consulta}", "gsrnamespace": 6, "gsrlimit": MAX_RESULTADOS,
            "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280,
        })
        r.raise_for_status()
        paginas = list(((r.json().get("query") or {}).get("pages") or {}).values())
        return elegir_wikimedia(paginas, alt)
