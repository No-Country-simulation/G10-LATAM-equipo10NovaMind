"""
Agente 2 - Productor de contenido (LLM + RAG)
NuevaMente - Hackathon ONE G10

Responsable de:
1. Tomar los chunks recuperados por el Agente Investigador
2. Adaptarlos al perfil del destinatario, nicho/sector y formato pedagógico pedidos
3. Llamar al LLM (Cohere Command) con un prompt estructurado
4. Validar y devolver la salida en el formato JSON que espera el resto del sistema

Este agente NO valida fidelidad ni calidad pedagógica: esa es tarea
del Agente Crítico/Revisor (fuera del alcance de este módulo). Por eso
la salida incluye "fuentes_utilizadas", para que el crítico pueda
comparar el contenido generado contra el material original.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Literal, Optional

import cohere
from pydantic import BaseModel, Field, ValidationError

from agente1_investigador import ChunkResultado


# ----------------------------------------------------------------------
# Contratos de entrada / salida
# ----------------------------------------------------------------------

PerfilDestinatario = Literal[
    "Principiante / Transición de Carrera",
    "Desarrollador Junior / Semi Senior",
    "Líder Técnico / Arquitecto",
    "Gestor / Ejecutivo (No Técnico)",
]

FormatoSalida = Literal[
    "Guía Práctica Paso a Paso",
    "Flashcards",
    "Quiz Interactivo con Justificaciones",
    "Resumen Ejecutivo (TL;DR)",
    "Guion de Clase / Video",
]

NichoSector = Literal[
    "Fintech",
    "Salud",
    "E-commerce",
    "General",
]


class ParametrosGeneracion(BaseModel):
    """Parámetros que recibe el Agente Productor."""

    perfil_destinatario: PerfilDestinatario
    formato_salida: FormatoSalida
    nicho_sector: NichoSector
    tema_consulta: str = Field(
        ...,
        description="Tema o pregunta usada para buscar chunks relevantes",
    )


class MetadatosSalida(BaseModel):
    perfil_aplicado: str
    formato_generado: str
    nicho_aplicado: str
    tiempo_estimado_estudio_minutos: int
    conceptos_clave: List[str]


class ContenidoAdaptado(BaseModel):
    titulo: str
    introduccion_contextualizada: str
    items: List[Dict[str, Any]]


class FuenteUtilizada(BaseModel):
    documento_id: str
    chunk_id: str
    texto_fuente: str


class PaqueteEducativo(BaseModel):
    status: Literal["exito", "error"]
    metadatos: MetadatosSalida
    contenido_adaptado: ContenidoAdaptado
    fuentes_utilizadas: List[FuenteUtilizada]
    evaluacion_calidad: Optional[Dict[str, Any]] = None


# ----------------------------------------------------------------------
# Instrucciones específicas por formato de salida
# ----------------------------------------------------------------------

_INSTRUCCIONES_FORMATO: Dict[str, str] = {
    "Flashcards": (
        'Genera "items" como una lista de tarjetas, cada una con las claves '
        '"frente" (pregunta o concepto corto), "dorso" (respuesta clara) y '
        '"pista_didactica" (una pista o analogía breve). Entre 5 y 10 tarjetas. '
        'La pista didáctica puede ser una analogía, pero no debe introducir '
        'información técnica nueva.'
    ),
    "Quiz Interactivo con Justificaciones": (
        'Genera "items" como una lista de preguntas, cada una con las claves '
        '"pregunta", "opciones" (lista de 4 strings), "respuesta_correcta" '
        '(el texto exacto de la opción correcta) y "justificacion". '
        'Entre 5 y 8 preguntas. Todas las preguntas, opciones, respuestas '
        'y justificaciones deben estar respaldadas por las fuentes. '
        'No inventes ejemplos, valores, vectores, matrices, ecuaciones '
        'ni casos concretos.'
    ),
    "Guía Práctica Paso a Paso": (
        'Genera "items" como una lista de pasos ordenados, cada uno con las claves '
        '"numero_paso", "titulo" e "instruccion". Entre 4 y 10 pasos. '
        'Los pasos deben derivarse exclusivamente de la documentación fuente. '
        'No agregues procedimientos, fórmulas o ejemplos que no aparezcan en ella.'
    ),
    "Resumen Ejecutivo (TL;DR)": (
        'Genera "items" como una lista de puntos clave, cada uno con las claves '
        '"punto" y "por_que_importa". Explica por qué cada concepto es importante '
        'dentro del tema estudiado, usando únicamente información respaldada por '
        'la fuente. No agregues aplicaciones externas, usos empresariales, '
        'ejemplos nuevos ni afirmaciones que no aparezcan o se puedan inferir '
        'razonablemente de los fragmentos fuente. Entre 4 y 6 puntos.'
    ),
    "Guion de Clase / Video": (
        'Genera "items" como una lista de segmentos del guion, cada uno con las claves '
        '"minuto_aproximado", "narracion" y "apoyo_visual_sugerido". Entre 4 y 8 segmentos. '
        'La narración debe mantenerse fiel a la fuente. El apoyo visual puede ser '
        'una sugerencia pedagógica, pero no debe introducir nuevos hechos técnicos, '
        'datos, fórmulas o ejemplos.'
    ),
}


# ----------------------------------------------------------------------
# Agente
# ----------------------------------------------------------------------

class AgenteProductorContenido:
    """Agente que transforma chunks técnicos en contenido educativo adaptado."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        modelo: str = "command-a-03-2025",
    ):
        """
        Args:
            api_key: clave de Cohere. Si no se pasa, se toma de la variable
                de entorno COHERE_API_KEY.
            modelo: modelo de Cohere a usar para la generación.
        """
        self._cliente = cohere.ClientV2(
            api_key or os.environ["COHERE_API_KEY"]
        )
        self._modelo = modelo

    def generar_contenido(
        self,
        chunks: List[ChunkResultado],
        parametros: ParametrosGeneracion,
    ) -> PaqueteEducativo:
        """
        Genera el paquete educativo adaptado a partir de los chunks recuperados.

        Args:
            chunks: fragmentos relevantes devueltos por el Agente Investigador.
            parametros: perfil, nicho y formato elegidos por el usuario.

        Returns:
            Un PaqueteEducativo validado.

        Raises:
            ValueError: si no hay chunks, o si el modelo no devuelve un JSON
                válido según el esquema esperado.
        """
        if not chunks:
            raise ValueError(
                "No hay chunks para generar contenido; "
                "revisa la búsqueda del Agente 1."
            )

        prompt = self._construir_prompt(
            chunks,
            parametros,
        )

        respuesta = self._cliente.chat(
            model=self._modelo,
            messages=[
                {
                    "role": "system",
                    "content": self._prompt_sistema(),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        texto_json = respuesta.message.content[0].text

        try:
            datos = json.loads(texto_json)
        except json.JSONDecodeError as error:
            raise ValueError(
                f"El modelo no devolvió JSON válido: {error}\n"
                f"Contenido: {texto_json}"
            ) from error

        fuentes = [
            FuenteUtilizada(
                documento_id=c.documento_id,
                chunk_id=c.chunk_id,
                texto_fuente=c.texto,
            )
            for c in chunks
        ]

        try:
            paquete = PaqueteEducativo(
                status="exito",
                metadatos=MetadatosSalida(
                    perfil_aplicado=parametros.perfil_destinatario,
                    formato_generado=parametros.formato_salida,
                    nicho_aplicado=parametros.nicho_sector,
                    tiempo_estimado_estudio_minutos=datos[
                        "metadatos"
                    ]["tiempo_estimado_estudio_minutos"],
                    conceptos_clave=datos["metadatos"][
                        "conceptos_clave"
                    ],
                ),
                contenido_adaptado=ContenidoAdaptado(
                    **datos["contenido_adaptado"]
                ),
                fuentes_utilizadas=fuentes,
            )
        except (KeyError, ValidationError) as error:
            raise ValueError(
                "La respuesta del modelo no cumple "
                f"el esquema esperado: {error}"
            ) from error

        return paquete

    # ------------------------------------------------------------------
    # Prompt del sistema
    # ------------------------------------------------------------------

    @staticmethod
    def _prompt_sistema() -> str:
        return (
            "Eres un diseñador instruccional experto, especializado en transformar "
            "documentación técnica densa en contenido educativo claro y preciso. "
            "\n\n"
            "REGLA PRINCIPAL — FIDELIDAD A LA FUENTE:\n"
            "Todo dato, cifra, fórmula, procedimiento, ejemplo numérico, conjunto, "
            "vector, matriz, ecuación, resultado o caso concreto que presentes como "
            "hecho debe provenir de las fuentes entregadas. "
            "\n\n"
            "Nunca inventes ejemplos numéricos, conjuntos, vectores, matrices, "
            "ecuaciones, resultados, procedimientos o datos nuevos que no aparezcan "
            "en las fuentes, aunque sean matemáticamente correctos. "
            "Un ejemplo inventado rompe la trazabilidad del sistema. "
            "\n\n"
            "ANALOGÍAS PEDAGÓGICAS:\n"
            "Las analogías sí están permitidas y pueden ser creadas por ti para "
            "facilitar la comprensión. Sin embargo, deben estar claramente marcadas "
            "como comparaciones ilustrativas con expresiones como "
            "'es como', 'imagina que', 'similar a' o 'como si fuera'. "
            "\n\n"
            "Una analogía nunca puede introducir hechos técnicos nuevos, "
            "aplicaciones concretas, números, vectores, matrices, ecuaciones, "
            "resultados o afirmaciones técnicas que no aparezcan en las fuentes. "
            "\n\n"
            "Si no encuentras en las fuentes un ejemplo técnico adecuado, "
            "NO inventes uno. Explica el concepto de forma general o utiliza "
            "el ejemplo más cercano disponible en la fuente. "
            "\n\n"
            "IDIOMA:\n"
            "Toda la salida textual debe estar escrita en español. "
            "No utilices palabras, frases, símbolos lingüísticos o caracteres "
            "de otros idiomas. Mantén los términos técnicos y matemáticos "
            "originales únicamente cuando sean necesarios para conservar "
            "su significado. "
            "\n\n"
            "ANTES DE RESPONDER:\n"
            "Realiza silenciosamente una verificación final y elimina cualquier "
            "ejemplo matemático, dato, fórmula, vector, matriz, ecuación, aplicación "
            "o afirmación técnica que no puedas respaldar con los fragmentos fuente. "
            "\n\n"
            "Responde ÚNICAMENTE con un objeto JSON válido, "
            "sin texto adicional, sin markdown y sin backticks."
        )

    # ------------------------------------------------------------------
    # Construcción del prompt
    # ------------------------------------------------------------------

    def _construir_prompt(
        self,
        chunks: List[ChunkResultado],
        parametros: ParametrosGeneracion,
    ) -> str:
        contexto = "\n\n".join(
            f"[Fuente: {c.documento_titulo} | fragmento {c.chunk_id}]\n"
            f"{c.texto}"
            for c in chunks
        )

        instrucciones_formato = _INSTRUCCIONES_FORMATO[
            parametros.formato_salida
        ]

        return f"""
DOCUMENTACIÓN TÉCNICA FUENTE
(ÚNICA BASE PERMITIDA PARA LAS AFIRMACIONES TÉCNICAS):
{contexto}

TAREA:
Adapta la información anterior sobre "{parametros.tema_consulta}" para:

- Perfil del destinatario: {parametros.perfil_destinatario}
- Nicho / sector de aplicación: {parametros.nicho_sector}
- Formato pedagógico de salida: {parametros.formato_salida}

REGLAS:

1. Conserva la fidelidad al contenido fuente.

2. Cualquier ejemplo técnico, numérico o con datos concretos
   (números, matrices, polinomios, conjuntos, vectores, ecuaciones,
   resultados o procedimientos) debe provenir de los fragmentos fuente.

3. No inventes ni modifiques valores matemáticos.

4. Las analogías pedagógicas están permitidas, pero deben estar
   claramente marcadas como comparaciones ilustrativas y no pueden
   introducir nuevos hechos técnicos.

5. No agregues aplicaciones del mundo real que no aparezcan
   en la documentación fuente.

6. Si la fuente no contiene suficiente información para afirmar algo,
   omite esa afirmación en lugar de completarla con conocimiento externo.

7. Adapta solamente el lenguaje, estructura, profundidad y presentación
   al perfil indicado.

8. Toda la salida debe estar escrita en español.

{instrucciones_formato}

FORMATO DE RESPUESTA
(JSON exacto, sin texto fuera del JSON):

{{
  "metadatos": {{
    "tiempo_estimado_estudio_minutos": <entero>,
    "conceptos_clave": [<hasta 5 strings>]
  }},
  "contenido_adaptado": {{
    "titulo": "<título atractivo y específico>",
    "introduccion_contextualizada": "<1-2 frases que enganchen al perfil indicado>",
    "items": [<según las instrucciones de formato de arriba>]
  }}
}}
""".strip()
