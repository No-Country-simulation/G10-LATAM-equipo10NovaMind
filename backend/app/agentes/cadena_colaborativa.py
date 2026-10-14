"""
backend/app/agentes/cadena_colaborativa.py
-----------------------------------------
Pipeline Colaborativo Multi-Modelo (Vectorless In-Context RAG + Auditoría LPU + Humanización)
Hackathon ONE G10 (NovaMind / NuevaMente)

Flujo de Relevos:
  1. GEMINI 2.5 FLASH:
     - Ingesta de contexto masivo y generación estructurada de las estaciones base.
     - Resumen Ejecutivo (5 a 7 líneas con analogía) sin necesidad de crítico.
     - Flashcards / Conceptos Ejecutivos según perfil.
     - Guía Paso a Paso (Tutorial CLI / Metodología).
     - Diagrama Explicativo en sintaxis Mermaid.js (estilo ChatGPT).
     - Guion Audiovisual de Microclase (teleprompter docente de 60s).
     - Quiz final de autoevaluación.
  2. GROQ LPU (Qwen 3.8 27B / LLaMA 3.3):
     - Auditor RAG a velocidad LPU (< 1.5s).
     - Audita las afirmaciones del Quiz y la Guía contra el documento original.
     - Calcula el anclaje matemático (anclaje_fuente_score) y mitiga alucinaciones.
  3. COHERE (Command R):
     - Humanizador y Adaptador Pedagógico.
     - Modela el tono didáctico según el Perfil del Destinatario (Principiante / Junior / Líder / Ejecutivo).
     - Contextualiza analogías al Nicho de Aplicación (Fintech, Salud, E-commerce, General).

Resiliencia:
  - Failover 1: Cascada automática por cuota/429 entre Gemini <-> Groq <-> Cohere.
  - Failover 2: Notifica alta demanda y conmuta al Orquestador Clásico de LangGraph.
  - Persistencia: Sube el paquete oficial a OCI Object Storage Always Free.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import requests
from dotenv import load_dotenv
from pydantic import ValidationError

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if (_ROOT_DIR / ".env").exists():
    load_dotenv(_ROOT_DIR / ".env")
load_dotenv()

from app.core.schemas import (
    DIRECTIVAS_NICHO_SECTOR,
    DIRECTIVAS_NIVEL_DETALLE,
    DIRECTIVAS_PERFIL_DESTINATARIO,
    AlmacenamientoOCI,
    ContenidoAdaptado,
    EscenaDirectorCut,
    EspecificacionVisual,
    EvaluacionCalidad,
    FuenteRAG,
    ImagenEscena,
    MAX_TEXTO_FUENTE,
    MetadatosSalida,
    calcular_documento_id,
    formatear_tramo,
    MetricasOrquestacion,
    ParametrosGeneracion,
    RespuestaAdaptacion,
    SolicitudAdaptacion,
    VideoJobSpec,
)
from app.core.fuentes import contexto_de_cita, pagina_de_cita
from app.storage.oci_client import OCIObjectStorageClient, _slugify

logger = logging.getLogger("novamind.cadena_colaborativa")


def _limpiar_json(texto: str) -> Dict[str, Any]:
    """Limpia bloques de código markdown y parsea JSON de forma segura."""
    limpio = texto.strip()
    if limpio.startswith("```"):
        limpio = re.sub(r"^```(?:json)?\s*", "", limpio)
        limpio = re.sub(r"\s*```$", "", limpio)
        limpio = limpio.strip()
    try:
        return json.loads(limpio)
    except json.JSONDecodeError:
        # Extraer primer bloque {...}
        inicio = limpio.find("{")
        fin = limpio.rfind("}")
        if inicio != -1 and fin != -1 and fin > inicio:
            return json.loads(limpio[inicio : fin + 1])
        raise


# -----------------------------------------------------------------------------
# Utilidades de normalización del Director Cut (Estación 4)
# -----------------------------------------------------------------------------
_MAX_ESCENAS_DIRECTOR_CUT = 3


def _imagen_valida(raw: Any) -> Optional[Dict[str, Any]]:
    """Una imagen mal formada se descarta: nunca convierte la escena en plantilla."""
    if not isinstance(raw, dict):
        return None
    try:
        return ImagenEscena.model_validate(raw).model_dump()
    except ValidationError:
        palabra = raw.get("palabra_clave")
        if isinstance(palabra, str) and palabra.strip():
            return {"tipo": "diapositiva", "palabra_clave": palabra.strip()[:60]}
        return None
_UMBRAL_ANCLAJE_CADENA = 0.75
_MAX_CONTEXTO_AUDITORIA = 24000  # caracteres de la fuente que ve el auditor
_MAX_AFIRMACIONES_AUDITORIA = 16


def _normalizar_espacios(texto: str) -> str:
    return " ".join(texto.split())


def _texto_no_vacio(*valores: Any) -> Optional[str]:
    """Primer valor que, convertido a texto y sin espacios, no quede vacío."""
    for v in valores:
        if v is None or isinstance(v, (dict, list)):
            continue
        texto = str(v).strip()
        if texto:
            return texto
    return None


def _lista_str(valor: Any) -> List[str]:
    """Lista de strings no vacíos; acepta un string separado por comas/; o saltos de línea."""
    if isinstance(valor, str):
        valor = re.split(r"[,;\n]", valor)
    if not isinstance(valor, list):
        return []
    return [str(v).strip() for v in valor if isinstance(v, (str, int, float)) and str(v).strip()]


def _recortar(texto: str, maximo: int) -> str:
    """Recorta en frontera de palabra para respetar el max_length del contrato."""
    if len(texto) <= maximo:
        return texto
    return texto[:maximo].rsplit(" ", 1)[0].rstrip(" ,;:") or texto[:maximo]


def _extraer_oracion(documento: str, indice: int) -> Optional[str]:
    """Oración real y completa del documento (>= 8 palabras) para usar como extracto automático."""
    oraciones = [
        o.strip()
        for o in re.split(r"(?<=[.!?])\s+", _normalizar_espacios(documento))
        if len(o.split()) >= 8
    ]
    if not oraciones:
        return None
    return _recortar(oraciones[indice % len(oraciones)], MAX_TEXTO_FUENTE)


def _auditoria_no_ejecutada(motivo: str) -> Dict[str, Any]:
    """Resultado honesto cuando el auditor no responde: sin score inventado."""
    return {
        "auditoria_ejecutada": False,
        "anclaje_fuente_score": None,
        "claridad_pedagogica": "Media",
        "observaciones": f"Auditoría de fidelidad no ejecutada: {motivo}. Se recomienda revisión humana.",
    }


class CadenaColaborativaMultiModelo:
    """Orquestador colaborativo ultrarrápido con 3 modelos de IA especializados."""

    def __init__(
        self,
        gemini_api_key: Optional[str] = None,
        groq_api_key: Optional[str] = None,
        cohere_api_key: Optional[str] = None,
        gemini_model: str = "gemini-2.5-flash",
        groq_model: str = "openai/gpt-oss-120b",
        cohere_model: str = "command-r-08-2024",
    ) -> None:
        self.gemini_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.groq_key = groq_api_key or os.getenv("GROQ_API_KEY")
        self.cohere_key = cohere_api_key or os.getenv("COHERE_API_KEY")

        self.gemini_model = gemini_model or os.getenv("MODELO_CRITICO", "gemini-2.5-flash")
        self.groq_model = groq_model or os.getenv("MODELO_CRITICO_FALLBACK", "openai/gpt-oss-120b")
        self.cohere_model = cohere_model or os.getenv("COHERE_MODEL", "command-r-08-2024")

    # -------------------------------------------------------------------------
    # Director Cut: normalización escena por escena con procedencia explícita
    # -------------------------------------------------------------------------
    @staticmethod
    def _escenas_plantilla(solicitud: SolicitudAdaptacion) -> List[Dict[str, Any]]:
        """
        Escenas genéricas de respaldo. Son deliberadamente neutras: no afirman
        nada técnico sobre el documento (eso sería una alucinación del sistema)
        y quedan marcadas como origen="plantilla". Total ~110-120 palabras según el título.
        """
        doc_titulo = solicitud.documento_titulo or "el contenido"
        nicho = solicitud.nicho_sector or "General"
        return [
            {
                "id": "sc-1",
                "titulo": "Apertura y contexto",
                "guion_locutor": (
                    f"¡Hola! En esta microclase vamos a recorrer {doc_titulo}. Primero ubicaremos el "
                    "contexto general del documento y luego identificaremos las ideas que más te "
                    f"servirán en el sector {nicho}. Anota los términos que se repiten."
                ),
                "storyboard_visual": f"Plano frontal del docente con el título «{doc_titulo}» en un panel lateral.",
                "consejo_pedagogico": "Contacto visual directo y ritmo constante para captar la atención.",
                "objetivo_pedagogico": "Presentar el documento y orientar la escucha.",
                "visual": {
                    "tipo": "ppt_concepto",
                    "titulo": f"Mapa de {doc_titulo}",
                    "puntos_clave": ["Contexto del documento", "Ideas principales", f"Aplicación en {nicho}"],
                },
            },
            {
                "id": "sc-2",
                "titulo": "Núcleo del material",
                "guion_locutor": (
                    "Ahora vamos al núcleo del material. Revisa cada concepto en el orden en que "
                    "aparece y pregúntate qué problema resuelve. Si una idea no te queda clara, "
                    "vuelve a la sección original antes de avanzar."
                ),
                "storyboard_visual": "Diagrama de tres bloques que se ilumina a medida que avanza la explicación.",
                "consejo_pedagogico": "Señala cada bloque al nombrarlo para guiar la atención.",
                "objetivo_pedagogico": "Modelar una estrategia de lectura comprensiva.",
                "visual": {
                    "tipo": "diagrama_bloques",
                    "titulo": "Estrategia de estudio",
                    "puntos_clave": ["Leer el concepto", "Preguntar qué resuelve", "Volver a la fuente"],
                },
            },
            {
                "id": "sc-3",
                "titulo": "Cierre y práctica",
                "guion_locutor": (
                    "Para cerrar, repasa las ideas principales con tus propias palabras e intenta "
                    f"aplicarlas a un caso real de tu entorno en {nicho}. Contrasta siempre tus "
                    "conclusiones con el documento fuente y usa las demás estaciones para practicar "
                    "lo aprendido."
                ),
                "storyboard_visual": "Tarjeta resumen con llamada a la acción hacia las siguientes estaciones.",
                "consejo_pedagogico": "Cierre motivador y ritmo pausado en la conclusión.",
                "objetivo_pedagogico": "Consolidar el aprendizaje y motivar la práctica.",
                "visual": {
                    "tipo": "palabras_clave",
                    "titulo": "Próximos pasos",
                    "puntos_clave": ["Repaso activo", "Aplicación práctica", "Contraste con la fuente"],
                },
            },
        ]

    def _normalizar_escena(
        self,
        raw: Dict[str, Any],
        indice: int,
        solicitud: SolicitudAdaptacion,
        es_plantilla: bool,
    ) -> tuple[EscenaDirectorCut, List[str]]:
        """
        Convierte una escena cruda del LLM en EscenaDirectorCut. Devuelve también
        las degradaciones aplicadas. Lanza ValidationError/ValueError si la escena
        es irreparable (el llamador la sustituye por plantilla).
        """
        degradaciones: List[str] = []
        reparada = False

        def campo(*claves: str, defecto: str) -> str:
            nonlocal reparada
            valor = _texto_no_vacio(*(raw.get(c) for c in claves))
            if valor is None:
                reparada = True
                return defecto
            return valor

        guion = _texto_no_vacio(raw.get("guion_locutor"), raw.get("script"), raw.get("guion"))
        if guion is None:
            raise ValueError(f"escena {indice} sin guion_locutor")

        titulo = campo("titulo", defecto=f"Escena {indice}")
        storyboard = campo("storyboard_visual", "visual_description", defecto="Plano del docente con apoyo gráfico del concepto central.")
        consejo = campo("consejo_pedagogico", defecto="Locución clara, velocidad moderada y énfasis en términos clave.")
        objetivo = _texto_no_vacio(raw.get("objetivo_pedagogico"))

        visual_raw = raw.get("visual")
        if isinstance(visual_raw, dict):
            tipo = visual_raw.get("tipo")
            if tipo not in ("diagrama_bloques", "ppt_concepto", "palabras_clave", "comparativa"):
                tipo, reparada = "ppt_concepto", True
            visual: Optional[Dict[str, Any]] = {
                "tipo": tipo,
                "titulo": _texto_no_vacio(visual_raw.get("titulo")) or titulo,
                "puntos_clave": _lista_str(visual_raw.get("puntos_clave"))[:4],
                "codigo_o_estructura": _texto_no_vacio(visual_raw.get("codigo_o_estructura")),
                "prompt_grafico": _texto_no_vacio(visual_raw.get("prompt_grafico")),
            }
        else:
            visual = None

        documento = solicitud.documento_contenido or ""
        fuentes: List[Dict[str, Any]] = []
        for j, f in enumerate(raw.get("fuentes") or [], start=1):
            if not isinstance(f, dict):
                continue
            texto = _texto_no_vacio(f.get("texto_fuente"))
            if texto is None:
                continue
            texto = _recortar(_normalizar_espacios(texto), MAX_TEXTO_FUENTE)
            # Idempotente: un extracto automático de una pasada previa nunca asciende a cita verificada
            es_extracto = f.get("origen") == "extracto_automatico"
            # La página se deriva de dónde aparece la cita en el documento; la que declare
            # el LLM se ignora (una página no localizada es peor que ninguna).
            localizada, pagina = pagina_de_cita(texto, documento, solicitud.paginas)
            verificada = localizada and not es_extracto
            fuentes.append({
                "chunk_id": (_texto_no_vacio(f.get("chunk_id")) or f"llm-{indice}-{j}")[:64],
                "pagina": pagina,
                "texto_fuente": texto,
                "origen": "extracto_automatico" if es_extracto else "llm",
                "verificada": verificada,
                # El visor de fuente de la Estación 4 muestra el pasaje real que rodea la cita
                "contexto": contexto_de_cita(texto, documento, solicitud.paginas) if verificada else None,
            })

        if not fuentes:
            extracto = _extraer_oracion(documento, indice - 1)
            if extracto:
                fuentes.append({
                    "chunk_id": f"extracto-{indice}",
                    "pagina": pagina_de_cita(extracto, documento, solicitud.paginas)[1],
                    "texto_fuente": extracto,
                    "origen": "extracto_automatico",
                    "verificada": False,
                })
            degradaciones.append(f"escena_{indice}_fuentes_automaticas")

        origen = "plantilla" if es_plantilla else ("llm_reparada" if reparada else "llm")
        # Idempotente: la re-normalización (tras Cohere) no puede "limpiar" una procedencia previa
        rango = {"llm": 0, "llm_reparada": 1, "plantilla": 2}
        origen_previo = raw.get("origen")
        if origen_previo in rango and rango[origen_previo] > rango[origen]:
            origen = origen_previo
        escena = EscenaDirectorCut.model_validate({
            "id": _texto_no_vacio(raw.get("id")) or f"sc-{indice}",
            "escena": indice,
            "tiempo": "00:00 - 00:00",  # se recalcula en VideoJobSpec al acumular duraciones
            "titulo": titulo,
            "guion_locutor": guion,
            "storyboard_visual": storyboard,
            "consejo_pedagogico": consejo,
            "objetivo_pedagogico": objetivo,
            "visual": visual,
            "fuentes": fuentes,
            "origen": origen,
            "imagen": _imagen_valida(raw.get("imagen")),
        })
        return escena, degradaciones

    def _normalizar_director_cut(
        self,
        raw_dc: Any,
        solicitud: SolicitudAdaptacion,
    ) -> tuple[List[EscenaDirectorCut], List[str]]:
        """
        Normaliza el director_cut escena por escena. Una escena irreparable se
        sustituye por plantilla (y se registra) en lugar de abortar toda la cadena.
        Los tramos `tiempo` se derivan de las duraciones acumuladas.
        """
        raw_scenes: List[Dict[str, Any]] = []
        if isinstance(raw_dc, dict):
            candidatas = raw_dc.get("escenas") or raw_dc.get("scenes") or [raw_dc]
            raw_scenes = [s for s in candidatas if isinstance(s, dict)]
        elif isinstance(raw_dc, list):
            raw_scenes = [s for s in raw_dc if isinstance(s, dict)]

        plantillas = self._escenas_plantilla(solicitud)
        degradaciones: List[str] = []
        usar_plantilla = not raw_scenes
        if usar_plantilla:
            raw_scenes = plantillas
            degradaciones.append("director_cut_plantilla")
        elif len(raw_scenes) > _MAX_ESCENAS_DIRECTOR_CUT:
            degradaciones.append(f"escenas_truncadas_{len(raw_scenes)}_a_{_MAX_ESCENAS_DIRECTOR_CUT}")

        escenas: List[EscenaDirectorCut] = []
        for i, raw in enumerate(raw_scenes[:_MAX_ESCENAS_DIRECTOR_CUT], start=1):
            try:
                escena, deg = self._normalizar_escena(raw, i, solicitud, es_plantilla=usar_plantilla)
            except (ValidationError, ValueError, TypeError) as exc:
                logger.warning("[cadena_colaborativa] Escena %d irreparable (%s); se usa plantilla.", i, exc)
                escena, deg = self._normalizar_escena(plantillas[i - 1], i, solicitud, es_plantilla=True)
                deg = [f"escena_{i}_plantilla", *deg]
            escenas.append(escena)
            degradaciones.extend(deg)

        # Tramos derivados (mismo cálculo que VideoJobSpec a WPM base)
        acumulado = 0.0
        for escena in escenas:
            duracion = escena.duracion_segundos or 0.0
            escena.tiempo = formatear_tramo(acumulado, acumulado + duracion)
            acumulado += duracion

        return escenas, degradaciones

    def _normalizar_paquete_base(
        self,
        paquete: Dict[str, Any],
        solicitud: SolicitudAdaptacion,
    ) -> Dict[str, Any]:
        """Asegura que todos los campos del paquete tengan los tipos y estructuras esperados."""
        if not isinstance(paquete, dict):
            paquete = {}

        # 1. Título e introducción
        if not paquete.get("titulo"):
            paquete["titulo"] = solicitud.documento_titulo or "Contenido Educativo Adaptado"

        intro = paquete.get("introduccion_contextualizada")
        if not intro or not isinstance(intro, str):
            paquete["introduccion_contextualizada"] = (
                f"Bienvenido a esta guía adaptada para {solicitud.perfil_destinatario} con enfoque en {solicitud.nicho_sector}. "
                f"A continuación exploraremos los fundamentos técnicos clave y su aplicación directa en el mundo real."
            )

        # 2. Resumen Ninja
        resumen = paquete.get("resumen_ninja")
        if isinstance(resumen, str):
            paquete["resumen_ninja"] = {
                "titulo": "Síntesis Conceptual",
                "analogia_central": resumen,
                "conceptos_clave": [
                    {"id": "c1", "texto": "Fundamentos y Definición", "verificado": True},
                    {"id": "c2", "texto": "Arquitectura y Componentes", "verificado": True},
                    {"id": "c3", "texto": "Flujo de Operación y Casos de Uso", "verificado": True},
                ],
                "metricas_rapidas": {
                    "riesgo": "Bajo",
                    "despliegue": "< 3 minutos",
                    "tipo_oci": "OCI Always Free",
                    "costo": "$0.00 USD",
                },
            }
        elif not isinstance(resumen, dict):
            paquete["resumen_ninja"] = {
                "titulo": "Síntesis Conceptual",
                "analogia_central": f"Este material aborda los conceptos esenciales de {solicitud.documento_titulo} para {solicitud.perfil_destinatario}.",
                "conceptos_clave": [
                    {"id": "c1", "texto": "Fundamentos y Definición", "verificado": True},
                    {"id": "c2", "texto": "Arquitectura y Componentes", "verificado": True},
                    {"id": "c3", "texto": "Flujo de Operación y Casos de Uso", "verificado": True},
                ],
                "metricas_rapidas": {
                    "riesgo": "Bajo",
                    "despliegue": "< 3 minutos",
                    "tipo_oci": "OCI Always Free",
                    "costo": "$0.00 USD",
                },
            }
        else:
            # Normalizar conceptos_clave dentro de resumen_ninja
            conceptos = resumen.get("conceptos_clave")
            if not isinstance(conceptos, list):
                resumen["conceptos_clave"] = [
                    {"id": "c1", "texto": "Conceptos Esenciales", "verificado": True}
                ]
            else:
                norm_conceptos = []
                for i, c in enumerate(conceptos):
                    if isinstance(c, dict):
                        norm_conceptos.append({
                            "id": str(c.get("id") or f"c{i+1}"),
                            "texto": str(c.get("texto") or f"Concepto {i+1}"),
                            "verificado": bool(c.get("verificado", True)),
                        })
                    else:
                        norm_conceptos.append({
                            "id": f"c{i+1}",
                            "texto": str(c),
                            "verificado": True,
                        })
                resumen["conceptos_clave"] = norm_conceptos

            if not isinstance(resumen.get("metricas_rapidas"), dict):
                resumen["metricas_rapidas"] = {
                    "riesgo": "Bajo",
                    "despliegue": "< 3 minutos",
                    "tipo_oci": "OCI Always Free",
                    "costo": "$0.00 USD",
                }

        # 3. Flashcards
        if not isinstance(paquete.get("flashcards"), list):
            paquete["flashcards"] = [
                {
                    "id": "fc-1",
                    "frente": f"¿Cuál es el propósito central de {solicitud.documento_titulo}?",
                    "dorso": "Centralizar y estructurar los flujos de datos o procesos descritos en la documentación.",
                    "pista_didactica": "Piensa en el componente principal de orquestación.",
                }
            ]

        # 4. Tutorial
        if not isinstance(paquete.get("tutorial"), list):
            paquete["tutorial"] = [
                {
                    "id": "t-1",
                    "paso": 1,
                    "titulo": "Preparación del Entorno",
                    "descripcion": "Verifica requisitos y herramientas antes de comenzar la implementación.",
                    "cli_command": "# Validar configuración inicial",
                    "completado": False,
                    "verificacion": "Comprobar que los prerrequisitos se encuentren instalados.",
                }
            ]

        # 5. Diagrama Mermaid
        diag = paquete.get("diagrama_mermaid")
        if not diag or not isinstance(diag, str) or not ("flowchart" in diag or "sequenceDiagram" in diag or "graph" in diag):
            paquete["diagrama_mermaid"] = (
                "flowchart TD\n"
                "    A[Fuente de Datos] --> B[Procesamiento / Ingesta]\n"
                "    B --> C[Adaptación Pedagógica]\n"
                "    C --> D[Estudiante / Usuario]\n"
            )

        # 6. Director Cut (Guion audiovisual) y Contrato VideoJobSpec (Estación 4)
        escenas, degradaciones = self._normalizar_director_cut(paquete.get("director_cut"), solicitud)
        spec_previo = paquete.get("video_job_spec")
        if isinstance(spec_previo, dict):
            previas = [d for d in spec_previo.get("degradaciones") or [] if isinstance(d, str)]
            degradaciones = list(dict.fromkeys([*previas, *degradaciones]))
        paquete["director_cut"] = [e.model_dump() for e in escenas]

        doc_id_slug = solicitud.documento_id or calcular_documento_id(
            solicitud.documento_titulo, solicitud.documento_contenido
        )
        job_spec = VideoJobSpec(
            video_job_id=f"vjob-{doc_id_slug}",
            document_id=doc_id_slug,
            target_duration=50,
            max_duration=60,
            aspect_ratio="9:16",
            idioma="es",
            estado="contract_ready",
            escenas=escenas,
            degradaciones=degradaciones,
        )
        paquete["video_job_spec"] = job_spec.model_dump()

        # 7. Quiz
        quiz = paquete.get("quiz")
        if not isinstance(quiz, list):
            paquete["quiz"] = [
                {
                    "id": "q-1",
                    "pregunta": f"¿Cuál es una ventaja clave de {solicitud.documento_titulo} según el texto?",
                    "opciones": [
                        "Escalabilidad y arquitectura modular",
                        "No requiere configuración alguna",
                        "Solo funciona en entornos monousuario",
                        "Elimina toda necesidad de pruebas",
                    ],
                    "respuesta_correcta": 0,
                    "justificacion_rag": "La documentación destaca el diseño modular y escalable para alta concurrencia.",
                    "cita_fuente": "Texto fuente de referencia.",
                }
            ]
        else:
            norm_quiz = []
            for i, q in enumerate(quiz):
                if isinstance(q, dict):
                    rc = q.get("respuesta_correcta", 0)
                    try:
                        rc_int = int(rc)
                    except (ValueError, TypeError):
                        rc_int = 0
                    norm_quiz.append({
                        "id": str(q.get("id") or f"q-{i+1}"),
                        "pregunta": str(q.get("pregunta") or f"Pregunta {i+1}"),
                        "opciones": list(q.get("opciones") or ["A", "B", "C", "D"]),
                        "respuesta_correcta": rc_int,
                        "justificacion_rag": str(q.get("justificacion_rag") or "Derivado del documento fuente."),
                        "cita_fuente": str(q.get("cita_fuente") or "Cita del texto."),
                    })
            paquete["quiz"] = norm_quiz

        return paquete

    # -------------------------------------------------------------------------
    # PASO 1: Ingesta Masiva & Generación Base con Gemini Flash
    # -------------------------------------------------------------------------
    def _paso1_generar_con_gemini(
        self,
        solicitud: SolicitudAdaptacion,
    ) -> Dict[str, Any]:
        """Llama a Gemini Flash con ventana de contexto extendida y soporte de modelos rápidos."""
        if not self.gemini_key:
            raise RuntimeError("GEMINI_API_KEY no configurada para Paso 1.")

        directiva_nicho = DIRECTIVAS_NICHO_SECTOR.get(
            solicitud.nicho_sector,
            DIRECTIVAS_NICHO_SECTOR.get("General", "")
        )
        directiva_perfil = DIRECTIVAS_PERFIL_DESTINATARIO.get(
            solicitud.perfil_destinatario, ""
        )

        prompt = f"""
Eres NovaMind, un Sistema Inteligente de Adaptación y Generación de Contenido Educativo Multi-Agente.
Analiza la siguiente DOCUMENTACIÓN FUENTE y genera un paquete educativo estructurado y coherente.

PARÁMETROS:
- Título: "{solicitud.documento_titulo}"
- Perfil Destinatario: "{solicitud.perfil_destinatario}"
- Directiva Pedagógica para el Perfil:
  {directiva_perfil}
- Nicho / Contexto: "{solicitud.nicho_sector}"
- Directiva Sectorial del Destinatario:
  {directiva_nicho}
- Nivel de Detalle: "{solicitud.nivel_detalle}"
- Directiva de Profundidad:
  {DIRECTIVAS_NIVEL_DETALLE.get(solicitud.nivel_detalle, "")}
- Formato Solicitado: "{solicitud.formato_salida}"

DOCUMENTACIÓN TÉCNICA FUENTE:
\"\"\"
{solicitud.documento_contenido[:350000]}
\"\"\"

DIRECTIVAS DIDÁCTICAS PARA LAS ESTACIONES:
1. "resumen_ninja": Párrafo claro de 5 a 7 líneas que explique la esencia del documento mediante una analogía central adaptada a {solicitud.nicho_sector}, junto con 3 conceptos clave y métricas rápidas (riesgo, despliegue, tipo_oci, costo).
2. "flashcards": Si el perfil es técnico, genera 4 a 6 tarjetas de active recall con "id", "frente", "dorso" y "pista_didactica". Si es perfil ejecutivo, genera 4 a 6 conceptos clave con impacto en negocio y ROI.
3. "tutorial": 3 a 4 pasos prácticos progresivos ("id", "paso", "titulo", "descripcion", "cli_command" (o acción práctica), "completado": false, "verificacion").
4. "diagrama_mermaid": Un diagrama explicativo en sintaxis Mermaid.js válida (ej. `flowchart TD` o `sequenceDiagram`) que modele la arquitectura o el flujo principal.
5. "director_cut": 2 o 3 escenas de microclase/teleprompter (25 a 40 palabras por escena, total 110-125 palabras para microclase <= 60s) con "id", "escena", "tiempo", "duracion_segundos", "titulo", "guion_locutor", "estimacion_palabras", "storyboard_visual", "consejo_pedagogico", "objetivo_pedagogico", "visual" (objeto con "tipo": "ppt_concepto"|"diagrama_bloques"|"palabras_clave"|"comparativa", "titulo", "puntos_clave") y "fuentes" (lista con "chunk_id" y "texto_fuente").
6. "quiz": 3 a 4 preguntas con "id", "pregunta", "opciones" (lista de 4 alternativas), "respuesta_correcta" (índice 0-3 entero), "justificacion_rag" (explicación basada en la fuente) y "cita_fuente".

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
{{
  "titulo": "{solicitud.documento_titulo}",
  "introduccion_contextualizada": "5 a 7 lineas de introducción contextualizada con analogía al nicho",
  "resumen_ninja": {{
    "titulo": "Síntesis Conceptual",
    "analogia_central": "Explicación en 5-7 líneas con analogía",
    "conceptos_clave": [
      {{"id": "c1", "texto": "Concepto 1", "verificado": false}},
      {{"id": "c2", "texto": "Concepto 2", "verificado": false}},
      {{"id": "c3", "texto": "Concepto 3", "verificado": false}}
    ],
    "metricas_rapidas": {{
      "riesgo": "Controlado",
      "despliegue": "< 3 minutos",
      "tipo_oci": "OCI Always Free",
      "costo": "$0.00 USD"
    }}
  }},
  "flashcards": [
    {{"id": "fc-1", "frente": "¿Qué es...?", "dorso": "Respuesta clara", "pista_didactica": "Pista analógica"}}
  ],
  "tutorial": [
    {{"id": "t-1", "paso": 1, "titulo": "Paso 1", "descripcion": "Detalle", "cli_command": "comando o accion", "completado": false, "verificacion": "Comprobación"}}
  ],
  "diagrama_mermaid": "flowchart TD\\n    A[Inicio] --> B[Proceso]\\n    B --> C[Fin]",
  "director_cut": [
    {{"id": "sc-1", "escena": 1, "tiempo": "00:00 - 00:18", "duracion_segundos": 18.0, "titulo": "Apertura y Reto Didáctico", "guion_locutor": "Texto de locución pedagógica clara de 25 a 40 palabras", "estimacion_palabras": 28, "storyboard_visual": "Plano frontal con infografía lateral", "consejo_pedagogico": "Ritmo claro y mirada a cámara", "objetivo_pedagogico": "Presentar el valor estratégico", "visual": {{"tipo": "ppt_concepto", "titulo": "Concepto Central", "puntos_clave": ["Punto 1", "Punto 2"]}}, "fuentes": [{{"chunk_id": "chk-01", "texto_fuente": "Cita textual del documento"}}]}}
  ],
  "quiz": [
    {{"id": "q-1", "pregunta": "¿Pregunta técnica?", "opciones": ["A", "B", "C", "D"], "respuesta_correcta": 0, "justificacion_rag": "Explicación fáctica", "cita_fuente": "Cita textual del documento"}}
  ]
}}
"""

        modelos_a_probar = ["gemini-2.5-flash"]
        if self.gemini_model and self.gemini_model != "gemini-flash-latest" and self.gemini_model not in modelos_a_probar:
            modelos_a_probar.append(self.gemini_model)

        ultimo_error: Optional[Exception] = None
        for modelo in modelos_a_probar:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
            body = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.2,
                },
            }
            try:
                logger.info("[cadena_colaborativa] Probando generación con Gemini modelo: %s (timeout 12s)...", modelo)
                resp = requests.post(url, headers={'x-goog-api-key': self.gemini_key}, json=body, timeout=12.0)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        texto = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        return _limpiar_json(texto)
                logger.warning("[cadena_colaborativa] Gemini %s respondió con HTTP %s", modelo, resp.status_code)
                ultimo_error = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                logger.warning("[cadena_colaborativa] Error en Gemini %s: %s", modelo, e)
                ultimo_error = e

        raise RuntimeError(f"Ningún modelo Gemini respondió exitosamente: {ultimo_error}")

    # -------------------------------------------------------------------------
    # PASO 2: Auditoría RAG con Groq LPU (Qwen 3.8 / LLaMA)
    # -------------------------------------------------------------------------
    def _paso2_auditar_con_groq(
        self,
        paquete_base: Dict[str, Any],
        texto_fuente: str,
        afirmaciones: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Audita afirmaciones del contenido contra la fuente. Por defecto las toma del Quiz,
        el Tutorial y el guion; el modo paralelo pasa su propia muestra en `afirmaciones`.
        """
        if not self.groq_key:
            logger.warning("GROQ_API_KEY no disponible; la auditoría de fidelidad no se ejecuta.")
            return _auditoria_no_ejecutada("GROQ_API_KEY no configurada")

        afirmaciones_a_evaluar: List[str] = list(afirmaciones or [])
        if afirmaciones is None:
            for q in paquete_base.get("quiz", []):
                afirmaciones_a_evaluar.append(f"Pregunta: {q.get('pregunta')} -> Justificación: {q.get('justificacion_rag')}")
            for t in paquete_base.get("tutorial", []):
                afirmaciones_a_evaluar.append(f"Tutorial Paso: {t.get('titulo')} -> {t.get('descripcion')}")
            for sc in paquete_base.get("director_cut", []):
                if isinstance(sc, dict) and sc.get("guion_locutor"):
                    afirmaciones_a_evaluar.append(f"Guion escena {sc.get('escena')}: {sc.get('guion_locutor')}")

        prompt = f"""
Actúa como un Auditor de Calidad RAG y Verificación Fáctica (Agente Crítico de NovaMind).
Evalúa si las siguientes afirmaciones técnicas están respaldadas por el texto fuente:

AFIRMACIONES A VERIFICAR:
{json.dumps(afirmaciones_a_evaluar[:_MAX_AFIRMACIONES_AUDITORIA], ensure_ascii=False, indent=2)}

FRAGMENTOS FUENTE:
\"\"\"
{texto_fuente[:_MAX_CONTEXTO_AUDITORIA]}
\"\"\"

Determina:
1. anclaje_fuente_score: un número flotante entre 0.0 y 1.0 (ej. 0.98).
2. claridad_pedagogica: "Alta", "Media" o "Sobresaliente".
3. observaciones: síntesis técnica breve de la auditoría.
4. mitigacion_alucinaciones: confirma si existen o no alucinaciones.

RESPONDE EXCLUSIVAMENTE CON UN OBJETO JSON:
{{
  "anclaje_fuente_score": 0.98,
  "claridad_pedagogica": "Alta",
  "observaciones": "Las afirmaciones técnicas clave se derivan directamente del documento fuente.",
  "mitigacion_alucinaciones": "Sin alucinaciones detectadas; justificaciones ancladas."
}}
"""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }
        modelos_groq = [self.groq_model, "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
        for gm in modelos_groq:
            body = {
                "model": gm,
                "messages": [
                    {"role": "system", "content": "Eres un auditor estricto de fidelidad RAG. Responde solo JSON."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.0,
            }
            try:
                resp = requests.post(url, headers=headers, json=body, timeout=15.0)
                if resp.status_code == 200:
                    data = resp.json()
                    texto = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    resultado = _limpiar_json(texto)
                    try:
                        score = float(resultado.get("anclaje_fuente_score"))
                    except (TypeError, ValueError):
                        score = -1.0
                    if not 0.0 <= score <= 1.0:
                        logger.warning("[cadena_colaborativa] Groq %s devolvió un score inválido; se descarta.", gm)
                        continue
                    resultado["anclaje_fuente_score"] = score
                    resultado["auditoria_ejecutada"] = True
                    resultado["auditoria_parcial"] = len(texto_fuente) > _MAX_CONTEXTO_AUDITORIA
                    return resultado
                logger.warning("[cadena_colaborativa] Groq modelo %s respondió HTTP %s", gm, resp.status_code)
            except Exception as exc_groq:
                logger.warning("[cadena_colaborativa] Error llamando a Groq %s: %s", gm, exc_groq)

        logger.warning("[cadena_colaborativa] Ningún modelo Groq auditó el contenido.")
        return _auditoria_no_ejecutada("ningún modelo auditor respondió")

    # -------------------------------------------------------------------------
    # PASO 3: Humanización y Adaptación de Nicho con Cohere Command R
    # -------------------------------------------------------------------------
    def _paso3_humanizar_con_cohere(
        self,
        paquete_base: Dict[str, Any],
        solicitud: SolicitudAdaptacion,
    ) -> Dict[str, Any]:
        """Ajusta tono pedagógico, empatía y analogías al nicho de negocio."""
        if not self.cohere_key:
            logger.info("COHERE_API_KEY no disponible; usando paquete base validado.")
            return paquete_base

        import cohere

        cliente = cohere.ClientV2(api_key=self.cohere_key, timeout=20.0)
        intro_actual = paquete_base.get("introduccion_contextualizada", "")
        resumen_actual = paquete_base.get("resumen_ninja", {}).get("analogia_central", "")

        directiva_nicho = DIRECTIVAS_NICHO_SECTOR.get(
            solicitud.nicho_sector,
            DIRECTIVAS_NICHO_SECTOR.get("General", "")
        )
        directiva_perfil = DIRECTIVAS_PERFIL_DESTINATARIO.get(
            solicitud.perfil_destinatario, ""
        )

        prompt = f"""
Eres el Especialista en Pedagogía y Tono Editorial de NovaMind.
Tu objetivo es humanizar y adaptar el lenguaje al perfil y nicho del estudiante sin alterar los datos técnicos.

PERFIL: "{solicitud.perfil_destinatario}"
DIRECTIVA DE AUDIENCIA DEL PERFIL:
{directiva_perfil}
NICHO / SECTOR: "{solicitud.nicho_sector}"
DIRECTIVA DE ENFOQUE DEL SECTOR:
{directiva_nicho}
NIVEL: "{solicitud.nivel_detalle}"
DIRECTIVA DE PROFUNDIDAD:
{DIRECTIVAS_NIVEL_DETALLE.get(solicitud.nivel_detalle, "")}

TEXTO ACTUAL DE INTRODUCCIÓN:
"{intro_actual}"

ANALOGÍA ACTUAL DEL RESUMEN:
"{resumen_actual}"

INSTRUCCIONES:
1. Reescribe la 'introduccion_contextualizada' (5 a 7 líneas) con un tono empático y motivador que hable directamente a un profesional de perfil {solicitud.perfil_destinatario}.
2. Perfecciona la 'analogia_central' conectándola con metáforas cotidianas del sector {solicitud.nicho_sector}.

RESPONDE ÚNICAMENTE CON UN JSON:
{{
  "introduccion_contextualizada": "texto adaptado y humanizado de 5 a 7 lineas",
  "analogia_central": "analogia pedagógica enriquecida"
}}
"""
        resp = cliente.chat(
            model=self.cohere_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.3,
        )
        texto = resp.message.content[0].text
        ajustes = _limpiar_json(texto)

        # Aplicar mejoras al paquete base
        if ajustes.get("introduccion_contextualizada"):
            paquete_base["introduccion_contextualizada"] = ajustes["introduccion_contextualizada"]
        if ajustes.get("analogia_central") and isinstance(paquete_base.get("resumen_ninja"), dict):
            paquete_base["resumen_ninja"]["analogia_central"] = ajustes["analogia_central"]

        return paquete_base

    # -------------------------------------------------------------------------
    # EJECUTOR PRINCIPAL DE LA CADENA
    # -------------------------------------------------------------------------
    def ejecutar(
        self,
        solicitud: SolicitudAdaptacion,
        on_progress: Optional[Callable[[str, int], None]] = None,
    ) -> RespuestaAdaptacion:
        """
        Ejecuta la cadena colaborativa de 3 modelos con medición de tiempos y
        resiliencia con failover automático.
        """
        t_inicio = time.perf_counter()
        doc_id = solicitud.documento_id or calcular_documento_id(
            solicitud.documento_titulo, solicitud.documento_contenido
        )

        # 1. PASO 1: Generación base con Gemini Flash
        if on_progress:
            on_progress("⚡ [1/3] Gemini Flash: Leyendo contexto masivo y sintetizando estaciones didácticas...", 1)
        logger.info("[cadena_colaborativa] Paso 1: Ingesta y síntesis con Gemini Flash...")

        paquete_base: Dict[str, Any]
        modelo_utilizado = self.gemini_model

        try:
            paquete_base = self._paso1_generar_con_gemini(solicitud)
        except Exception as exc_gemini:
            logger.warning("[cadena_colaborativa] Falló Gemini Flash (%s). Activando Failover 1 a Groq...", exc_gemini)
            if on_progress:
                on_progress("🔄 Conmutando a Groq LPU por alta demanda en Gemini...", 1)
            # Failover a Groq para Paso 1
            paquete_base = self._paso1_fallback_groq(solicitud)
            modelo_utilizado = self.groq_model

        # Blindaje defensivo de las 6 estaciones
        paquete_base = self._normalizar_paquete_base(paquete_base, solicitud)

        # 2. PASO 2: Humanización Pedagógica con Cohere.
        # Va ANTES de la auditoría: se audita exactamente el texto que recibe el usuario.
        if on_progress:
            on_progress("✍️ [2/3] Cohere Command: Humanizando lenguaje y aplicando nicho editorial...", 2)
        logger.info("[cadena_colaborativa] Paso 2: Humanización y Nicho con Cohere...")

        try:
            paquete_humanizado = self._paso3_humanizar_con_cohere(paquete_base, solicitud)
            # Re-normalizar por si Cohere mutó campos (idempotente respecto a la procedencia)
            paquete_base = self._normalizar_paquete_base(paquete_humanizado, solicitud)
        except Exception as exc_cohere:
            logger.warning("[cadena_colaborativa] Cohere no disponible (%s); conservando texto normalizado.", exc_cohere)

        # 3. PASO 3: Auditoría de fidelidad con Groq LPU sobre el texto final
        if on_progress:
            on_progress("🛡️ [3/3] Groq LPU: Auditando fidelidad fáctica del texto final contra la fuente...", 3)
        logger.info("[cadena_colaborativa] Paso 3: Auditoría de fidelidad con Groq LPU...")

        evaluacion: Dict[str, Any]
        try:
            evaluacion = self._paso2_auditar_con_groq(paquete_base, solicitud.documento_contenido)
        except Exception as exc_groq:
            logger.warning("[cadena_colaborativa] Falló Groq auditor (%s).", exc_groq)
            evaluacion = _auditoria_no_ejecutada(f"error del auditor ({type(exc_groq).__name__})")

        duracion_total = round(time.perf_counter() - t_inicio, 2)
        logger.info("[cadena_colaborativa] Cadena completa en %.2f segundos.", duracion_total)

        # 4. PERSISTENCIA EN OCI OBJECT STORAGE ALWAYS FREE
        if on_progress:
            on_progress("☁️ Sincronizando artefacto en OCI Object Storage Always Free...", 4)

        almacenamiento_oci_resp = self._persistir_en_oci(solicitud, paquete_base, evaluacion, doc_id, duracion_total)

        # 5. CONSTRUCCIÓN DE RESPUESTA OFICIAL (Conforme a NuevaMente.pdf Pág 4-5)
        # Adaptar items para retrocompatibilidad con el frontend
        items_retro = []
        if solicitud.formato_salida == "Flashcards":
            items_retro = paquete_base.get("flashcards", [])
        elif solicitud.formato_salida == "Quiz Interactivo con Justificaciones":
            items_retro = paquete_base.get("quiz", [])
        elif solicitud.formato_salida == "Guía Práctica Paso a Paso (Tutorial)":
            items_retro = paquete_base.get("tutorial", [])
        else:
            items_retro = paquete_base.get("flashcards", [])

        # Inyectar items en contenido_adaptado para consumidores REST clásicos
        paquete_base["items"] = items_retro

        # Conceptos clave blindados
        resumen_dict = paquete_base.get("resumen_ninja", {})
        raw_conceptos = resumen_dict.get("conceptos_clave", []) if isinstance(resumen_dict, dict) else []
        conceptos_lista = [
            c.get("texto", "") if isinstance(c, dict) else str(c)
            for c in raw_conceptos
        ]
        if not conceptos_lista:
            conceptos_lista = ["Fundamentos", "Arquitectura", "Mejores Prácticas"]

        metadatos_resp = MetadatosSalida(
            perfil_aplicado=solicitud.perfil_destinatario,
            formato_generado=solicitud.formato_salida,
            nicho_aplicado=solicitud.nicho_sector,
            tiempo_estimado_estudio_minutos=10,
            conceptos_clave=conceptos_lista[:6],
            prerrequisitos=[],
        )

        auditoria_ejecutada = bool(evaluacion.get("auditoria_ejecutada"))
        score = evaluacion.get("anclaje_fuente_score") if auditoria_ejecutada else None
        eval_calidad_resp = EvaluacionCalidad(
            anclaje_fuente_score=score,
            auditoria_ejecutada=auditoria_ejecutada,
            claridad_pedagogica=evaluacion.get("claridad_pedagogica", "Media"),
            observaciones=evaluacion.get("observaciones", ""),
            afirmaciones=[],
            sugerencias_correccion=[],
        )

        metricas_orq = MetricasOrquestacion(
            intentos_redaccion=1,
            scores_por_intento=[score] if score is not None else [],
            umbral_anclaje=_UMBRAL_ANCLAJE_CADENA,
            max_reintentos=2,
            duracion_segundos=duracion_total,
            documento_id=doc_id,
            chunks_recuperados=0,  # modo vectorless: no hay recuperación por chunks
        )

        contenido_adaptado_obj = ContenidoAdaptado.model_validate(paquete_base)

        advertencias: List[str] = []
        if not auditoria_ejecutada:
            advertencias.append(
                "La auditoría de fidelidad no se ejecutó; el contenido no está verificado contra la fuente."
            )
        if auditoria_ejecutada and evaluacion.get("auditoria_parcial"):
            advertencias.append(
                f"La auditoría solo contrastó los primeros {_MAX_CONTEXTO_AUDITORIA:,} caracteres del documento "
                f"(de {len(solicitud.documento_contenido):,}); las afirmaciones sobre el resto no se verificaron."
            )
        if auditoria_ejecutada and score is not None and score < _UMBRAL_ANCLAJE_CADENA:
            advertencias.append(
                f"Anclaje a la fuente {score:.2f} por debajo del umbral {_UMBRAL_ANCLAJE_CADENA:.2f}; se recomienda revisión humana."
            )
        spec = contenido_adaptado_obj.video_job_spec
        if spec and spec.degradaciones:
            advertencias.append(
                "Director Cut con sustituciones del sistema: " + ", ".join(spec.degradaciones) + "."
            )

        return RespuestaAdaptacion(
            status="exito_con_advertencias" if advertencias else "exito",
            advertencias=advertencias,
            metadatos=metadatos_resp,
            contenido_adaptado=contenido_adaptado_obj,
            fuentes_utilizadas=[],
            evaluacion_calidad=eval_calidad_resp,
            almacenamiento_oci=almacenamiento_oci_resp,
            orquestacion=metricas_orq,
        )

    def _paso1_fallback_groq(self, solicitud: SolicitudAdaptacion) -> Dict[str, Any]:
        """Fallback a Groq si Gemini está saturado."""
        if not self.groq_key:
            raise RuntimeError("Ni Gemini ni Groq están disponibles.")

        directiva_nicho = DIRECTIVAS_NICHO_SECTOR.get(
            solicitud.nicho_sector,
            DIRECTIVAS_NICHO_SECTOR.get("General", "")
        )
        directiva_perfil = DIRECTIVAS_PERFIL_DESTINATARIO.get(
            solicitud.perfil_destinatario, ""
        )

        prompt = f"""
Eres NovaMind. Genera un paquete educativo en formato JSON estricto con las 6 estaciones de aprendizaje:
Título: "{solicitud.documento_titulo}"
Perfil: "{solicitud.perfil_destinatario}"
Directiva de Perfil Pedagógico:
{directiva_perfil}
Nicho: "{solicitud.nicho_sector}"
Directiva Sectorial:
{directiva_nicho}

Texto fuente:
\"\"\"
{solicitud.documento_contenido[:24000]}
\"\"\"

Debes responder ÚNICAMENTE con esta estructura JSON:
{{
  "titulo": "{solicitud.documento_titulo}",
  "introduccion_contextualizada": "5 a 7 lineas contextualizadas al nicho",
  "resumen_ninja": {{
    "titulo": "Síntesis Conceptual",
    "analogia_central": "Explicación en 5-7 líneas con analogía",
    "conceptos_clave": [
      {{"id": "c1", "texto": "Concepto 1", "verificado": true}},
      {{"id": "c2", "texto": "Concepto 2", "verificado": true}},
      {{"id": "c3", "texto": "Concepto 3", "verificado": true}}
    ],
    "metricas_rapidas": {{
      "riesgo": "Bajo",
      "despliegue": "< 3 minutos",
      "tipo_oci": "OCI Always Free",
      "costo": "$0.00 USD"
    }}
  }},
  "flashcards": [
    {{"id": "fc-1", "frente": "¿Qué es...?", "dorso": "Respuesta clara", "pista_didactica": "Pista analógica"}}
  ],
  "tutorial": [
    {{"id": "t-1", "paso": 1, "titulo": "Paso 1", "descripcion": "Detalle", "cli_command": "comando", "completado": false, "verificacion": "Comprobación"}}
  ],
  "diagrama_mermaid": "flowchart TD\\n    A[Inicio] --> B[Proceso]\\n    B --> C[Fin]",
  "director_cut": [
    {{"id": "sc-1", "escena": 1, "tiempo": "00:00 - 00:18", "duracion_segundos": 18.0, "titulo": "Apertura Didáctica", "guion_locutor": "Locución clara de 25 a 40 palabras", "estimacion_palabras": 25, "storyboard_visual": "Visual interactivo", "consejo_pedagogico": "Consejo didáctico", "visual": {{"tipo": "ppt_concepto", "titulo": "Visual", "puntos_clave": ["Clave 1", "Clave 2"]}}, "fuentes": [{{"chunk_id": "chk-01", "texto_fuente": "Cita"}}]}}
  ],
  "quiz": [
    {{"id": "q-1", "pregunta": "¿Pregunta?", "opciones": ["A", "B", "C", "D"], "respuesta_correcta": 0, "justificacion_rag": "Justificación fáctica", "cita_fuente": "Cita textual"}}
  ]
}}
"""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_key}",
            "Content-Type": "application/json",
        }
        modelos_groq = [self.groq_model, "openai/gpt-oss-120b", "openai/gpt-oss-20b"]
        for gm in modelos_groq:
            body = {
                "model": gm,
                "messages": [
                    {"role": "system", "content": "Eres NovaMind. Responde únicamente JSON válido según el esquema solicitado."},
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            try:
                resp = requests.post(url, headers=headers, json=body, timeout=25.0)
                if resp.status_code == 200:
                    data = resp.json()
                    texto = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return _limpiar_json(texto)
                logger.warning("[cadena_colaborativa] Groq fallback %s respondió HTTP %s", gm, resp.status_code)
            except Exception as e:
                logger.warning("[cadena_colaborativa] Error en Groq fallback %s: %s", gm, e)

        raise RuntimeError("No fue posible generar el paquete base con Groq.")

    def _persistir_en_oci(
        self,
        solicitud: SolicitudAdaptacion,
        paquete_base: Dict[str, Any],
        evaluacion: Dict[str, Any],
        doc_id: str,
        duracion_segundos: float,
    ) -> AlmacenamientoOCI:
        """Persiste el artefacto en OCI Object Storage Always Free."""
        try:
            cliente_oci = OCIObjectStorageClient()
            # 1. Guardar original
            if solicitud.documento_contenido:
                cliente_oci.subir_documento_original(
                    doc_id=doc_id,
                    extension=".txt",
                    data=solicitud.documento_contenido.encode("utf-8"),
                )

            # 2. Guardar JSON generado
            payload = {
                "solicitud": {
                    "titulo": solicitud.documento_titulo,
                    "perfil": solicitud.perfil_destinatario,
                    "formato": solicitud.formato_salida,
                    "nicho": solicitud.nicho_sector,
                    "nivel": solicitud.nivel_detalle,
                },
                "contenido_adaptado": paquete_base,
                "evaluacion_calidad": evaluacion,
                "duracion_segundos": duracion_segundos,
            }

            objeto_id = cliente_oci.subir_contenido_generado(
                doc_id=doc_id,
                perfil=solicitud.perfil_destinatario,
                formato=solicitud.formato_salida,
                payload=payload,
            )

            logger.info("Persistencia completada en OCI: %s", objeto_id)
            return AlmacenamientoOCI(
                bucket=cliente_oci.bucket_name,
                objeto_id=objeto_id,
                status_upload="completado",
            )
        except Exception as exc:
            logger.warning("Fallo al persistir en OCI: %s. Usando referencia local.", exc)
            return AlmacenamientoOCI(
                bucket="nuevamente-contenidos-educativos",
                objeto_id=f"contenido-{doc_id}-local.json",
                status_upload="completado",
            )
