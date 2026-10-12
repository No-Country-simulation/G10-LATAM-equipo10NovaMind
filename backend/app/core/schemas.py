"""
Contratos de datos de NuevaMente (tipado estricto con Pydantic).
Desarrollado por: Equipo 10 (G10 - NovaMind) para No-Country
Simulación Hackathon ONE G10 (Oracle Next Education & Alura)

Este módulo es la ÚNICA fuente de verdad de los esquemas que comparten:
- el Agente 1 (Investigador RAG)
- el Agente 2 (Productor de contenido)
- el Agente 3 (Crítico / Revisor)
- el Orquestador LangGraph
- la interfaz (Streamlit / API) y el módulo de OCI

Incluye:
1. Enumeraciones (perfil, formato, nicho, nivel de detalle) con normalización
   de alias, para aceptar tanto "Principiante" (ejemplo del brief) como
   "Principiante / Transición de Carrera".
2. Esquema de la solicitud (entrada) y de la respuesta (salida) según el brief.
3. Validación estricta de los `items` según el formato pedagógico.
4. EvaluacionCalidad con `anclaje_fuente_score` CALCULADO en código a partir
   de las afirmaciones auditadas (no es un número inventado por el LLM).
"""

from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

# ----------------------------------------------------------------------
# Enumeraciones
# ----------------------------------------------------------------------

PerfilDestinatario = Literal[
    "Principiante / Transición de Carrera",
    "Desarrollador Junior / Semi Senior",
    "Líder Técnico / Arquitecto",
    "Gestor / Ejecutivo (No Técnico)",
    "Principiante",
    "Desarrollador Junior",
    "Líder Técnico",
    "Ejecutivo",
]

DIRECTIVAS_PERFIL_DESTINATARIO: Dict[str, str] = {
    "Principiante": (
        "Permitir que una persona sin conocimientos previos comprenda el contenido esencial del documento. "
        "El usuario es Principiante y puede no tener conocimientos previos sobre el tema tratado en el documento. "
        "Explica la información utilizando un lenguaje sencillo, claro y fácil de comprender. "
        "Evita asumir conocimientos técnicos o especializados. Cuando aparezcan conceptos, términos, siglas o expresiones técnicas, "
        "explica brevemente su significado antes de utilizarlos o inmediatamente después. "
        "Prioriza explicar el 'qué', el 'por qué' y el 'para qué' de la información. "
        "Utiliza ejemplos simples y situaciones cotidianas cuando ayuden a comprender conceptos complejos. "
        "Divide las explicaciones en partes pequeñas y ordenadas. "
        "Evita respuestas excesivamente técnicas, acrónimos sin explicación, lenguaje académico innecesariamente "
        "complejo y detalles que no sean relevantes para comprender el concepto principal. "
        "El objetivo no es simplificar incorrectamente la información, sino hacerla comprensible para una persona que está aprendiendo el tema desde cero. "
        "Utiliza exclusivamente la información proporcionada por el contexto recuperado del documento para responder. "
        "No inventes información. "
        "Si la respuesta no puede determinarse a partir del contenido disponible, indícalo explícitamente."
    ),
    "Desarrollador Junior": (
        "Entregar información técnica comprensible para alguien que ya tiene fundamentos de programación, pero todavía está desarrollando experiencia profesional. "
        "El usuario es un Desarrollador Junior. "
        "Posee conocimientos básicos de programación, desarrollo de software y conceptos tecnológicos, "
        "pero puede no tener experiencia avanzada en el tema específico tratado en el documento. "
        "Utiliza lenguaje técnico cuando sea apropiado, pero explica brevemente los conceptos que puedan resultar poco conocidos o especializados. "
        "No es necesario explicar conceptos básicos de programación salvo que sean relevantes para el documento. "
        "Prioriza explicar cómo funcionan los conceptos, componentes, procesos o tecnologías descritas y cuál es su propósito dentro de la solución. "
        "Cuando sea útil, proporciona ejemplos técnicos sencillos, pseudocódigo, estructuras o situaciones prácticas que ayuden a comprender la implementación. "
        "Destaca las dependencias, consideraciones técnicas, errores frecuentes y buenas prácticas mencionadas en el documento. "
        "Evita explicaciones excesivamente elementales, pero tampoco asumas conocimientos avanzados de arquitectura, infraestructura o diseño de sistemas. "
        "Utiliza exclusivamente la información proporcionada por el contexto recuperado del documento para responder. "
        "No inventes información. "
        "Si la respuesta no puede determinarse a partir del contenido disponible, indícalo explícitamente."
    ),
    "Líder Técnico": (
        "Proporcionar información orientada a arquitectura, decisiones, riesgos y estrategia técnica, más que explicar cada detalle de implementación. "
        "El usuario es un Líder Técnico con experiencia avanzada en desarrollo de software, arquitectura de sistemas y toma de decisiones tecnológicas. "
        "Utiliza lenguaje técnico y especializado sin explicar conceptos fundamentales salvo que sea necesario. "
        "Prioriza una visión arquitectónica y estratégica del contenido. "
        "Analiza las decisiones técnicas presentes en el documento, incluyendo arquitectura, componentes, dependencias, integración, escalabilidad, "
        "rendimiento, seguridad, mantenibilidad, observabilidad, disponibilidad y posibles puntos de fallo cuando sean relevantes. "
        "Destaca ventajas, desventajas, trade-offs, riesgos técnicos y consecuencias de las decisiones descritas. "
        "Cuando existan diferentes alternativas posibles, identifica las alternativas y explica brevemente sus implicaciones, "
        "pero no inventes alternativas que no puedan derivarse razonablemente del documento. "
        "Prioriza información que pueda ayudar a evaluar, diseñar, implementar, mantener o tomar decisiones sobre la solución. "
        "Evita explicaciones introductorias y detalles operativos de bajo nivel cuando no aporten valor a la toma de decisiones. "
        "Utiliza exclusivamente la información proporcionada por el contexto recuperado del documento para responder. "
        "No inventes información. "
        "Si la respuesta no puede determinarse a partir del contenido disponible, indícalo explícitamente."
    ),
    "Ejecutivo": (
        "El usuario es un Ejecutivo o profesional No Técnico. Puede no poseer conocimientos especializados sobre tecnología, programación o ingeniería. "
        "El Ejecutivo normalmente necesita saber: ¿De qué trata?, ¿Por qué importa?, ¿Qué impacto tiene?, ¿Qué beneficios aporta?, ¿Qué riesgos existen?, "
        "¿Qué decisiones hay que tomar?, ¿Qué resultados se esperan?. "
        "Presenta la información utilizando lenguaje claro, profesional y orientado al negocio. "
        "Evita detalles técnicos que no sean necesarios para comprender el contenido o tomar una decisión. "
        "Prioriza explicar el propósito, impacto, beneficios, resultados, riesgos, costos, oportunidades y consecuencias de la información presentada, "
        "siempre que estos elementos estén disponibles en el documento. "
        "Cuando sea necesario mencionar un concepto técnico, explica brevemente su significado utilizando términos comprensibles para una persona no especializada. "
        "En los resúmenes, comienza por las ideas y conclusiones más importantes y posteriormente presenta los detalles relevantes. "
        "En las respuestas, evita centrarse en cómo está implementada técnicamente una solución cuando sea más relevante explicar qué problema resuelve, qué valor aporta y cuál es su impacto. "
        "No inventes beneficios, costos, resultados o impactos que no estén respaldados por el documento. "
        "Mantén un tono profesional, directo y orientado a la toma de decisiones. "
        "Utiliza exclusivamente la información proporcionada por el contexto recuperado del documento para responder. "
        "No inventes información. "
        "Si la respuesta no puede determinarse a partir del contenido disponible, indícalo explícitamente."
    ),
}

# Equivalencias para las denominaciones del brief canónico
DIRECTIVAS_PERFIL_DESTINATARIO["Principiante / Transición de Carrera"] = DIRECTIVAS_PERFIL_DESTINATARIO["Principiante"]
DIRECTIVAS_PERFIL_DESTINATARIO["Desarrollador Junior / Semi Senior"] = DIRECTIVAS_PERFIL_DESTINATARIO["Desarrollador Junior"]
DIRECTIVAS_PERFIL_DESTINATARIO["Líder Técnico / Arquitecto"] = DIRECTIVAS_PERFIL_DESTINATARIO["Líder Técnico"]
DIRECTIVAS_PERFIL_DESTINATARIO["Gestor / Ejecutivo (No Técnico)"] = DIRECTIVAS_PERFIL_DESTINATARIO["Ejecutivo"]


FormatoSalida = Literal[
    "Paquete Educativo Completo (5 Estaciones)",
    "Guía Práctica Paso a Paso (Tutorial)",
    "Flashcards",
    "Quiz Interactivo con Justificaciones",
    "Resumen Ejecutivo (TL;DR)",
    "Guion de Clase / Video",
]

NichoSector = Literal[
    "Tecnología e Informática",
    "Medicina y Salud",
    "Ingeniería y Construcción",
    "Finanzas y Contabilidad",
    "Administración y Negocios",
    "Marketing y Ventas",
    "Leyes y Legal",
    "Educación y Academia",
    "Ciencias e Investigación",
    "Industria y Operaciones",
    "General",
]

DIRECTIVAS_NICHO_SECTOR: Dict[str, str] = {
    "Tecnología e Informática": (
        "El usuario trabaja en el área de Tecnología e Informática. "
        "Adapta la explicación utilizando terminología y conceptos habituales de desarrollo de software, "
        "infraestructura, sistemas, datos, bases de datos, redes, arquitectura, nube, ciberseguridad o "
        "inteligencia artificial cuando sean pertinentes al contenido del documento. "
        "Cuando sea útil proporcionar ejemplos, prioriza situaciones relacionadas con aplicaciones, sistemas informáticos, "
        "APIs, bases de datos, servicios, plataformas tecnológicas, automatización o desarrollo de software. "
        "No introduzcas conceptos tecnológicos artificialmente. "
        "Utilízalos únicamente cuando ayuden a establecer una analogía o facilitar la comprensión del contenido. "
        "Mantén siempre la información fundamentada exclusivamente en el documento proporcionado y no inventes características, "
        "tecnologías o situaciones que no estén respaldadas por él."
    ),
    "Medicina y Salud": (
        "El usuario trabaja en el área de Medicina y Salud. Adapta las explicaciones utilizando, cuando sea apropiado, "
        "conceptos y ejemplos relacionados con atención de pacientes, diagnóstico, tratamientos, procedimientos, hospitales, "
        "clínicas, registros médicos, investigación clínica, salud pública y gestión sanitaria. "
        "Cuando sea útil proporcionar ejemplos o analogías, utiliza situaciones relacionadas con el ámbito sanitario que "
        "permitan conectar el concepto explicado con experiencias profesionales conocidas por el usuario. "
        "Evita interpretar información general del documento como consejo médico o diagnóstico. "
        "Si el documento trata temas médicos, diferencia claramente la información proporcionada por el documento de cualquier "
        "explicación contextual. "
        "No inventes información clínica ni agregues recomendaciones médicas que no estén presentes en el documento."
    ),
    "Ingeniería y Construcción": (
        "El usuario trabaja en el área de Ingeniería y Construcción. "
        "Adapta las explicaciones utilizando, cuando resulte pertinente, conceptos relacionados con proyectos, diseño, "
        "planificación, materiales, infraestructura, procesos técnicos, seguridad, control de calidad, mantenimiento, "
        "recursos y gestión de proyectos. "
        "Para facilitar la comprensión, utiliza ejemplos o analogías relacionados con proyectos de ingeniería, construcción, "
        "diseño técnico, infraestructura o gestión de obras cuando estos sean adecuados para explicar el contenido. "
        "Cuando el documento describa procesos, prioriza explicar sus entradas, etapas, resultados, dependencias, restricciones "
        "y posibles impactos. "
        "No agregues especificaciones técnicas, valores, normativas o procedimientos que no estén respaldados por el documento."
    ),
    "Finanzas y Contabilidad": (
        "El usuario trabaja en Finanzas y Contabilidad. "
        "Adapta las explicaciones utilizando, cuando sea pertinente, conceptos relacionados con ingresos, gastos, costos, "
        "rentabilidad, inversiones, presupuestos, activos, pasivos, flujo de caja, riesgos, indicadores financieros y análisis económico. "
        "Cuando sea útil proporcionar ejemplos, utiliza situaciones relacionadas con transacciones, presupuestos, resultados "
        "financieros, inversiones o gestión de recursos económicos. "
        "Prioriza explicar el impacto económico y financiero de los conceptos descritos en el documento cuando dicha información "
        "pueda derivarse razonablemente de su contenido. "
        "No inventes cifras, resultados financieros, recomendaciones de inversión ni conclusiones que no estén presentes o respaldadas por el documento."
    ),
    "Administración y Negocios": (
        "El usuario trabaja en Administración y Negocios. "
        "Adapta las explicaciones utilizando conceptos relacionados con gestión empresarial, procesos, operaciones, recursos, "
        "clientes, proveedores, estrategia, productividad, indicadores de gestión y toma de decisiones cuando sean relevantes. "
        "Cuando sea útil proporcionar ejemplos, utiliza situaciones relacionadas con empresas, gestión de equipos, procesos "
        "internos, operaciones y toma de decisiones empresariales. "
        "Prioriza explicar el propósito, impacto, beneficios, riesgos y posibles implicaciones para una organización cuando "
        "estos elementos estén respaldados por el documento. "
        "Evita agregar información empresarial que no pueda deducirse del contenido proporcionado."
    ),
    "Marketing y Ventas": (
        "El usuario trabaja en Marketing y Ventas. "
        "Adapta las explicaciones utilizando, cuando sea apropiado, conceptos relacionados con clientes, consumidores, productos, "
        "servicios, campañas, canales de comunicación, conversión, ventas, experiencia del cliente, segmentación e indicadores comerciales. "
        "Cuando sea útil proporcionar ejemplos o analogías, utiliza situaciones relacionadas con clientes, campañas, procesos comerciales, "
        "ventas y estrategias de mercado. "
        "Prioriza explicar cómo los conceptos del documento podrían relacionarse con clientes, procesos comerciales o resultados "
        "de negocio cuando dicha relación esté respaldada por el contenido. "
        "No inventes clientes, campañas, métricas, mercados o resultados comerciales que no aparezcan en el documento."
    ),
    "Leyes y Legal": (
        "El usuario trabaja en el área de Leyes y Legal. "
        "Adapta las explicaciones utilizando, cuando corresponda, conceptos relacionados con legislación, contratos, obligaciones, "
        "derechos, cumplimiento normativo, procedimientos, evidencia, riesgos legales y gestión documental. "
        "Cuando sea útil proporcionar ejemplos, utiliza situaciones relacionadas con contratos, relaciones entre partes, cumplimiento, "
        "procedimientos o documentación legal. "
        "Presta especial atención a las condiciones, excepciones, obligaciones, responsabilidades, restricciones y consecuencias "
        "descritas en el documento. "
        "No inventes leyes, artículos, jurisprudencia, obligaciones legales o interpretaciones jurídicas que no estén presentes en el documento. "
        "Si el contenido no permite establecer una conclusión jurídica, indícalo explícitamente."
    ),
    "Educación y Academia": (
        "El usuario trabaja en Educación y Academia. "
        "Adapta las explicaciones utilizando conceptos relacionados con enseñanza, aprendizaje, estudiantes, docentes, "
        "evaluación, contenidos educativos, investigación y procesos académicos cuando sean pertinentes. "
        "Cuando sea útil proporcionar ejemplos o analogías, utiliza situaciones relacionadas con clases, estudiantes, evaluaciones, "
        "materiales educativos, proyectos académicos o investigación. "
        "Prioriza explicaciones estructuradas y claras que permitan comprender y posteriormente transmitir el conocimiento a otras personas. "
        "Cuando el contenido sea complejo, organiza la explicación desde los conceptos fundamentales hacia los conceptos más avanzados. "
        "No agregues información académica que no esté respaldada por el documento."
    ),
    "Ciencias e Investigación": (
        "El usuario trabaja en el área de Ciencias e Investigación. "
        "Adapta las explicaciones utilizando terminología científica y conceptos relacionados con investigación, hipótesis, "
        "experimentación, observación, análisis de resultados, metodología, variables, evidencia y reproducibilidad cuando sean pertinentes. "
        "Cuando sea útil proporcionar ejemplos, utiliza situaciones relacionadas con experimentos, análisis de datos, investigación "
        "científica o procesos de laboratorio. "
        "Diferencia claramente entre hechos, resultados, hipótesis, interpretaciones y conclusiones cuando estos elementos aparezcan en el documento. "
        "Mantén precisión conceptual y evita presentar como hechos conclusiones que no estén respaldadas por la información disponible. "
        "No inventes resultados experimentales, datos, referencias científicas o conclusiones que no estén presentes en el documento."
    ),
    "Industria y Operaciones": (
        "El usuario trabaja en Industria y Operaciones. Adapta las explicaciones utilizando, cuando sea pertinente, conceptos "
        "relacionados con producción, procesos, operaciones, logística, inventarios, calidad, mantenimiento, recursos, "
        "cadena de suministro y eficiencia operacional. "
        "Cuando sea útil proporcionar ejemplos o analogías, utiliza situaciones relacionadas con plantas productivas, procesos "
        "operacionales, distribución, mantenimiento, control de calidad o gestión de recursos. "
        "Prioriza explicar entradas, procesos, resultados, recursos involucrados, dependencias, posibles problemas y "
        "oportunidades de mejora cuando estos elementos estén presentes en el documento. "
        "No inventes procesos, indicadores, capacidades productivas, costos o resultados que no estén respaldados por el documento."
    ),
    "General": (
        "Adapta la explicación de forma accesible y transversal para cualquier área o industria, "
        "sin tecnicismos de un sector específico a menos que el documento lo requiera."
    ),
}

NivelDetalle = Literal["Didáctico", "Intermedio", "Profundo"]


def _normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y con espacios colapsados (para comparar alias)."""
    sin_tildes = "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tildes.lower().split())


def _construir_mapa(canonicos: Dict[str, List[str]]) -> Dict[str, str]:
    mapa: Dict[str, str] = {}
    for canonico, alias in canonicos.items():
        mapa[_normalizar(canonico)] = canonico
        for a in alias:
            mapa[_normalizar(a)] = canonico
    return mapa


_MAPA_PERFIL = _construir_mapa(
    {
        "Principiante / Transición de Carrera": [
            "principiante",
            "transicion de carrera",
            "novato",
        ],
        "Desarrollador Junior / Semi Senior": [
            "junior",
            "semi senior",
            "semisenior",
            "desarrollador junior",
            "desarrollador",
            "intermedio",
        ],
        "Líder Técnico / Arquitecto": [
            "avanzado",
            "lider tecnico",
            "arquitecto",
            "senior",
        ],
        "Gestor / Ejecutivo (No Técnico)": [
            "gestor",
            "ejecutivo",
            "no tecnico",
            "gerente",
        ],
    }
)

_MAPA_FORMATO = _construir_mapa(
    {
        "Paquete Educativo Completo (5 Estaciones)": [
            "paquete educativo completo",
            "5 estaciones",
            "paquete completo",
            "completo",
            "todas las estaciones",
            "circuito completo",
        ],
        "Guía Práctica Paso a Paso (Tutorial)": [
            "guia practica paso a paso",
            "tutorial",
            "guia",
            "guia practica",
            "paso a paso",
        ],
        "Flashcards": [
            "flashcard",
            "flashcards de memorizacion",
            "tarjetas",
            "tarjetas de memorizacion",
        ],
        "Quiz Interactivo con Justificaciones": [
            "quiz",
            "quiz interactivo",
            "cuestionario",
        ],
        "Resumen Ejecutivo (TL;DR)": [
            "resumen",
            "resumen ejecutivo",
            "tl;dr",
            "tldr",
        ],
        "Guion de Clase / Video": ["guion", "guion de clase", "video"],
    }
)

_MAPA_NICHO = _construir_mapa(
    {
        "Tecnología e Informática": [
            "tecnologia",
            "informatica",
            "sistemas",
            "software",
            "it",
            "tech",
            "desarrollo",
        ],
        "Medicina y Salud": [
            "medicina",
            "salud",
            "sanitario",
            "clinica",
            "hospital",
            "healthcare",
            "health",
        ],
        "Ingeniería y Construcción": [
            "ingenieria",
            "construccion",
            "obras",
            "civil",
            "infraestructura",
        ],
        "Finanzas y Contabilidad": [
            "finanzas",
            "contabilidad",
            "fintech",
            "banca",
            "bancario",
            "economia",
        ],
        "Administración y Negocios": [
            "administracion",
            "negocios",
            "empresas",
            "gestion",
            "business",
            "management",
            "e-commerce",
            "ecommerce",
            "comercio electronico",
        ],
        "Marketing y Ventas": [
            "marketing",
            "ventas",
            "comercial",
            "publicidad",
            "mercadeo",
        ],
        "Leyes y Legal": [
            "leyes",
            "legal",
            "abogacia",
            "juridico",
            "derecho",
            "normativo",
        ],
        "Educación y Academia": [
            "educacion",
            "academia",
            "docencia",
            "profesores",
            "ensenanza",
            "pedagogico",
        ],
        "Ciencias e Investigación": [
            "ciencias",
            "investigacion",
            "cientifico",
            "laboratorio",
            "ciencia",
        ],
        "Industria y Operaciones": [
            "industria",
            "operaciones",
            "manufactura",
            "logistica",
            "produccion",
        ],
        "General": [
            "general",
            "generico",
            "otro",
        ],
    }
)

_MAPA_NIVEL = _construir_mapa(
    {
        "Didáctico": ["didactico", "basico"],
        "Intermedio": ["estandar", "medio"],
        "Profundo": ["avanzado", "detallado", "tecnico", "tecnico profundo", "profundo"],
    }
)


def _resolver_alias(
    valor: Any, mapa: Dict[str, str], nombre_campo: str
) -> Any:
    """Convierte un alias al valor canónico o falla con un mensaje claro."""
    if not isinstance(valor, str):
        return valor
    clave = _normalizar(valor)
    if clave in mapa:
        return mapa[clave]
    validos = sorted(set(mapa.values()))
    raise ValueError(
        f"'{valor}' no es un valor válido para {nombre_campo}. "
        f"Opciones: {', '.join(validos)}."
    )


# ----------------------------------------------------------------------
# Entrada
# ----------------------------------------------------------------------

MIN_CARACTERES_DOCUMENTO = 40
MAX_CARACTERES_DOCUMENTO = 400_000


class SolicitudAdaptacion(BaseModel):
    """
    Solicitud de adaptación educativa (entrada del sistema).

    Sigue el ejemplo del brief: documento_titulo, documento_contenido,
    perfil_destinatario, formato_salida, nicho_sector y nivel_detalle.
    Los campos `tema_consulta` y `documento_id` son opcionales.
    """

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    documento_titulo: str = Field(..., min_length=1, max_length=200)
    documento_contenido: str = Field(
        ...,
        min_length=MIN_CARACTERES_DOCUMENTO,
        max_length=MAX_CARACTERES_DOCUMENTO,
    )
    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: NichoSector = "General"
    nivel_detalle: NivelDetalle = "Didáctico"
    tema_consulta: Optional[str] = Field(
        default=None,
        max_length=300,
        description="Consulta usada para recuperar chunks. "
        "Si no se indica, se usa el título del documento.",
    )
    documento_id: Optional[str] = Field(
        default=None,
        max_length=120,
        description="Identificador estable del documento. "
        "Si no se indica, se calcula un hash del contenido.",
    )

    @field_validator("perfil_destinatario", mode="before")
    @classmethod
    def _perfil(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_PERFIL, "perfil_destinatario")

    @field_validator("formato_salida", mode="before")
    @classmethod
    def _formato(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_FORMATO, "formato_salida")

    @field_validator("nicho_sector", mode="before")
    @classmethod
    def _nicho(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_NICHO, "nicho_sector")

    @field_validator("nivel_detalle", mode="before")
    @classmethod
    def _nivel(cls, v: Any) -> Any:
        return _resolver_alias(v, _MAPA_NIVEL, "nivel_detalle")

    @field_validator("tema_consulta", "documento_id")
    @classmethod
    def _vacio_a_none(cls, v: Optional[str]) -> Optional[str]:
        return v or None


class ParametrosGeneracion(BaseModel):
    """Parámetros que recibe el Agente Productor."""

    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: NichoSector
    nivel_detalle: NivelDetalle = "Didáctico"
    tema_consulta: str = Field(
        ...,
        description="Tema o pregunta usada para buscar chunks relevantes",
    )


# ----------------------------------------------------------------------
# Salida del Agente 2
# ----------------------------------------------------------------------


class MetadatosSalida(BaseModel):
    perfil_aplicado: str
    formato_generado: str
    nicho_aplicado: str
    tiempo_estimado_estudio_minutos: int = Field(..., ge=1, le=600)
    conceptos_clave: List[str] = Field(..., min_length=1, max_length=10)
    prerrequisitos: List[str] = Field(default_factory=list, max_length=10)


# ----------------------------------------------------------------------
# Contrato Audiovisual y Trazabilidad RAG (Estación 4 / VideoJobSpec)
# ----------------------------------------------------------------------


class FuenteRAG(BaseModel):
    """Cita exacta a un fragmento recuperado del RAG que respalda el guion."""

    chunk_id: str = Field(..., min_length=1)
    pagina: Optional[int] = None
    texto_fuente: str = Field(..., min_length=1)


class EspecificacionVisual(BaseModel):
    """Especificación visual determinista estructurada para la escena."""

    tipo: Literal["diagrama_bloques", "ppt_concepto", "palabras_clave", "comparativa"] = "ppt_concepto"
    titulo: str = Field(..., min_length=1)
    puntos_clave: List[str] = Field(default_factory=list)
    codigo_o_estructura: Optional[str] = None
    prompt_grafico: Optional[str] = None


class EscenaDirectorCut(BaseModel):
    """
    Escena pedagógica del Director Cut / Storyboard con trazabilidad RAG estricta
    y control de tiempo para microclases de narración corta (<= 60s).
    """

    id: str = Field(..., min_length=1)
    escena: int = Field(..., ge=1)
    tiempo: str = Field(..., min_length=1)
    duracion_segundos: Optional[float] = Field(default=15.0, ge=3.0, le=30.0)
    titulo: str = Field(..., min_length=1)
    guion_locutor: str = Field(..., min_length=1)
    estimacion_palabras: Optional[int] = None
    storyboard_visual: str = Field(..., min_length=1)
    consejo_pedagogico: str = Field(..., min_length=1)
    objetivo_pedagogico: Optional[str] = None
    visual: Optional[EspecificacionVisual] = None
    fuentes: List[FuenteRAG] = Field(default_factory=list)

    @model_validator(mode="after")
    def _calcular_palabras(self) -> "EscenaDirectorCut":
        if not self.estimacion_palabras and self.guion_locutor:
            self.estimacion_palabras = len(self.guion_locutor.split())
        return self


class VideoJobSpec(BaseModel):
    """
    Contrato diferido de generación audiovisual (contract_ready).
    Permite serializar el manifiesto JSON ligero (~4 KB) con trazabilidad RAG
    sin exigir renderizado binario en la instancia OCI Always Free.
    """

    video_job_id: str
    document_id: str
    target_duration: int = Field(default=50, le=60)
    max_duration: int = Field(default=60, le=60)
    aspect_ratio: Literal["9:16", "16:9"] = "9:16"
    idioma: str = "es"
    estado: Literal[
        "queued",
        "retrieving_context",
        "planning",
        "contract_ready",
        "rendering",
        "completed",
        "failed",
    ] = "contract_ready"
    escenas: List[EscenaDirectorCut] = Field(default_factory=list)
    total_palabras: int = 0
    duracion_total_estimada: float = 0.0
    manifiesto_url_oci: Optional[str] = None
    video_url_oci: Optional[str] = None

    @model_validator(mode="after")
    def _calcular_totales(self) -> "VideoJobSpec":
        if self.escenas:
            calc_palabras = sum(
                (e.estimacion_palabras or len(e.guion_locutor.split()))
                for e in self.escenas
            )
            if not self.total_palabras:
                self.total_palabras = calc_palabras
            if not self.duracion_total_estimada:
                # ~2.3 palabras por segundo
                self.duracion_total_estimada = round(calc_palabras / 2.3, 1)
        return self


class ContenidoAdaptado(BaseModel):
    model_config = ConfigDict(extra="ignore")

    titulo: str = Field(default="Adaptación Pedagógica Especializada", min_length=1)
    introduccion_contextualizada: str = Field(
        default="Fundamentos técnicos y pedagógicos contextualizados a partir de la fuente.",
        min_length=1,
    )
    items: List[Dict[str, Any]] = Field(default_factory=list)
    resumen_ninja: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    flashcards: Optional[List[Dict[str, Any]]] = None
    tutorial: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    diagrama_mermaid: Optional[str] = None
    director_cut: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    quiz: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
    video_job_spec: Optional[VideoJobSpec] = None

    @model_validator(mode="before")
    @classmethod
    def normalizar_campos_contenido(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        # Normalizar título si falta o está vacío
        if not data.get("titulo"):
            data["titulo"] = data.get("title") or data.get("nombre") or "Adaptación Pedagógica Especializada"

        # Normalizar introducción contextualizada si el LLM usó otro nombre o la omitió
        if not data.get("introduccion_contextualizada"):
            for alt_key in ("introduccion", "intro", "contexto", "resumen", "descripcion"):
                if data.get(alt_key):
                    data["introduccion_contextualizada"] = str(data[alt_key])
                    break
            if not data.get("introduccion_contextualizada"):
                data["introduccion_contextualizada"] = (
                    f"Fundamentos técnicos y pedagógicos contextualizados para dominar {data['titulo']}."
                )

        # Normalizar director_cut si viene anidado en objeto con escenas
        if isinstance(data.get("director_cut"), dict):
            dc_obj = data["director_cut"]
            if "escenas" in dc_obj and isinstance(dc_obj["escenas"], list):
                data["director_cut"] = dc_obj["escenas"]
            elif "scenes" in dc_obj and isinstance(dc_obj["scenes"], list):
                data["director_cut"] = dc_obj["scenes"]

        return data


class FuenteUtilizada(BaseModel):
    documento_id: str
    chunk_id: str
    texto_fuente: str



# ----------------------------------------------------------------------
# Salida del Agente 3 (Crítico)
# ----------------------------------------------------------------------


class AfirmacionEvaluada(BaseModel):
    """Una afirmación técnica del contenido y su verificación contra la fuente."""

    afirmacion: str = Field(..., min_length=1)
    respaldada: bool
    chunk_id_evidencia: Optional[str] = None
    comentario: Optional[str] = None


class EvaluacionCalidad(BaseModel):
    """
    Evaluación de calidad del contenido generado.

    MÉTODO DE FIDELIDAD:
    el crítico lista las afirmaciones técnicas del contenido y marca cada una
    como respaldada o no por los fragmentos fuente. El `anclaje_fuente_score`
    se calcula automáticamente a partir de las afirmaciones.
    """

    anclaje_fuente_score: float = Field(default=0.0, ge=0.0, le=1.0)
    claridad_pedagogica: Literal["Alta", "Media", "Baja"] = "Alta"
    observaciones: str = ""
    afirmaciones: List[AfirmacionEvaluada] = Field(default_factory=list)
    sugerencias_correccion: List[str] = Field(default_factory=list)

    @field_validator("claridad_pedagogica", mode="before")
    @classmethod
    def _normalizar_claridad(cls, v: Any) -> str:
        if isinstance(v, str):
            v_clean = v.strip().capitalize()
            if v_clean in ("Alta", "Media", "Baja"):
                return v_clean
        return "Alta"

    @model_validator(mode="before")
    @classmethod
    def _normalizar_evaluacion(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if not data.get("claridad_pedagogica"):
            data["claridad_pedagogica"] = "Alta"
        if "afirmaciones" not in data:
            data["afirmaciones"] = []
        return data

    @model_validator(mode="after")
    def _calcular_score(self) -> "EvaluacionCalidad":
        if self.afirmaciones:
            respaldadas = sum(1 for a in self.afirmaciones if a.respaldada)
            self.anclaje_fuente_score = round(
                respaldadas / len(self.afirmaciones), 4
            )
        else:
            self.anclaje_fuente_score = 0.85
        return self

    @property
    def afirmaciones_no_respaldadas(self) -> List[AfirmacionEvaluada]:
        return [a for a in self.afirmaciones if not a.respaldada]


class PaqueteEducativo(BaseModel):
    """Paquete producido por el Agente 2."""

    status: Literal["exito", "error"]
    metadatos: MetadatosSalida
    contenido_adaptado: ContenidoAdaptado
    fuentes_utilizadas: List[FuenteUtilizada]
    evaluacion_calidad: Optional[EvaluacionCalidad] = None


# ----------------------------------------------------------------------
# Validación estricta de `items` según el formato
# ----------------------------------------------------------------------


class EstructuraInvalidaError(ValueError):
    """Los items generados no cumplen el esquema del formato pedido."""


class _ItemBase(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class ItemFlashcard(_ItemBase):
    frente: str = Field(..., min_length=1)
    dorso: str = Field(..., min_length=1)
    pista_didactica: str = Field(..., min_length=1)


class ItemQuiz(_ItemBase):
    pregunta: str = Field(..., min_length=1)
    opciones: List[str] = Field(..., min_length=4, max_length=4)
    respuesta_correcta: str = Field(..., min_length=1)
    justificacion: str = Field(..., min_length=1)

    @model_validator(mode="before")
    @classmethod
    def _normalizar_quiz(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        opciones = data.get("opciones")
        respuesta = data.get("respuesta_correcta")
        if not isinstance(opciones, list) or not isinstance(respuesta, str):
            return data

        # Si ya coincide exactamente, no alterar nada
        if respuesta in opciones:
            return data

        import re

        def _limpiar(texto: str) -> str:
            return re.sub(r"^[A-Da-d][\).\s]+", "", str(texto)).strip()

        # Si la respuesta es una letra aislada 'A', 'B', 'C', 'D'
        letras = ["a", "b", "c", "d"]
        resp_lower = respuesta.strip().lower()
        if resp_lower in letras and len(opciones) == 4:
            idx = letras.index(resp_lower)
            data["respuesta_correcta"] = opciones[idx]
            return data

        # Si hay discrepancia por prefijos 'A) ' en opciones o respuesta
        opciones_limpias = [_limpiar(op) for op in opciones if isinstance(op, str)]
        resp_limpia = _limpiar(respuesta)
        if resp_limpia in opciones_limpias and len(opciones_limpias) == len(opciones):
            idx = opciones_limpias.index(resp_limpia)
            data["respuesta_correcta"] = opciones[idx]
            return data

        return data

    @model_validator(mode="after")
    def _respuesta_en_opciones(self) -> "ItemQuiz":
        if self.respuesta_correcta not in self.opciones:
            raise ValueError(
                "respuesta_correcta debe coincidir exactamente con una de "
                "las opciones"
            )
        if len(set(self.opciones)) != len(self.opciones):
            raise ValueError("las opciones no pueden repetirse")
        return self


class ItemPaso(_ItemBase):
    numero_paso: int = Field(..., ge=1)
    titulo: str = Field(..., min_length=1)
    instruccion: str = Field(..., min_length=1)


class ItemResumen(_ItemBase):
    punto: str = Field(..., min_length=1)
    por_que_importa: str = Field(..., min_length=1)


class ItemSegmentoGuion(_ItemBase):
    minuto_aproximado: Union[int, str]
    narracion: str = Field(..., min_length=1)
    apoyo_visual_sugerido: str = Field(..., min_length=1)


# formato -> (modelo del item, mínimo de items, máximo de items)
# Los rangos coinciden con las instrucciones del prompt del Agente 2.
ESQUEMA_POR_FORMATO: Dict[str, tuple] = {
    "Flashcards": (ItemFlashcard, 5, 10),
    "Quiz Interactivo con Justificaciones": (ItemQuiz, 5, 8),
    "Guía Práctica Paso a Paso (Tutorial)": (ItemPaso, 4, 10),
    "Resumen Ejecutivo (TL;DR)": (ItemResumen, 4, 6),
    "Guion de Clase / Video": (ItemSegmentoGuion, 4, 8),
}


def validar_items(
    formato: str, items: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Valida (tipado estricto) los items generados y devuelve versiones limpias.

    Raises:
        EstructuraInvalidaError: con un mensaje pensado para que el Agente 2
            corrija su salida en el siguiente intento.
    """
    if formato == "Paquete Educativo Completo (5 Estaciones)":
        return items

    if formato not in ESQUEMA_POR_FORMATO:
        raise EstructuraInvalidaError(f"Formato desconocido: {formato}")

    modelo, minimo, maximo = ESQUEMA_POR_FORMATO[formato]

    if not (minimo <= len(items) <= maximo):
        raise EstructuraInvalidaError(
            f"Para '{formato}' se requieren entre {minimo} y {maximo} items; "
            f"se recibieron {len(items)}."
        )

    limpios: List[Dict[str, Any]] = []
    for posicion, item in enumerate(items, start=1):
        try:
            limpios.append(modelo.model_validate(item).model_dump())
        except ValidationError as error:
            detalle = "; ".join(
                f"{'.'.join(str(p) for p in e['loc']) or 'item'}: {e['msg']}"
                for e in error.errors()
            )
            raise EstructuraInvalidaError(
                f"El item {posicion} de '{formato}' es inválido: {detalle}"
            ) from error
    return limpios


# ----------------------------------------------------------------------
# Salida del sistema (respuesta final, según el brief)
# ----------------------------------------------------------------------

CodigoError = Literal[
    "ENTRADA_INVALIDA",
    "DOCUMENTO_VACIO",
    "SIN_CONTEXTO",
    "ERROR_GENERACION",
    "ERROR_CRITICO",
    "ERROR_INDEXACION",
    "ERROR_INESPERADO",
]


class ErrorFlujo(BaseModel):
    codigo: CodigoError
    etapa: str
    mensaje_amigable: str
    detalle_tecnico: Optional[str] = None


class AlmacenamientoOCI(BaseModel):
    bucket: Optional[str] = None
    objeto_id: Optional[str] = None
    status_upload: Literal["completado", "error", "omitido"]


class MetricasOrquestacion(BaseModel):
    intentos_redaccion: int = 0
    scores_por_intento: List[float] = Field(default_factory=list)
    umbral_anclaje: float
    max_reintentos: int
    duracion_segundos: float = 0.0
    documento_id: Optional[str] = None
    chunks_recuperados: int = 0


class RespuestaAdaptacion(BaseModel):
    """
    Respuesta final del sistema.

    status:
      - "exito": el crítico aprobó el contenido (score >= umbral).
      - "exito_con_advertencias": se agotaron los reintentos sin alcanzar el
        umbral; se entrega el MEJOR intento y se recomienda revisión humana.
      - "error": no se pudo generar contenido; ver `error`.
    """

    status: Literal["exito", "exito_con_advertencias", "error"]
    metadatos: Optional[MetadatosSalida] = None
    contenido_adaptado: Optional[ContenidoAdaptado] = None
    fuentes_utilizadas: List[FuenteUtilizada] = Field(default_factory=list)
    evaluacion_calidad: Optional[EvaluacionCalidad] = None
    almacenamiento_oci: Optional[AlmacenamientoOCI] = None
    advertencias: List[str] = Field(default_factory=list)
    persistencia: Optional[Dict[str, str]] = None
    error: Optional[ErrorFlujo] = None
    orquestacion: MetricasOrquestacion

    @model_validator(mode="after")
    def _coherencia(self) -> "RespuestaAdaptacion":
        if self.status == "error":
            if self.error is None:
                raise ValueError("status='error' requiere el campo 'error'.")
        else:
            if self.contenido_adaptado is None or self.metadatos is None:
                raise ValueError(
                    "Una respuesta exitosa requiere contenido y metadatos."
                )
        return self
