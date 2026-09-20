"""
Prompts del Agente 3 - Crítico / Revisor.

Técnicas usadas (requisito del brief):
- Role prompting: el crítico es un auditor de fidelidad, no un redactor.
- Few-shot: un ejemplo completo de salida esperada.
- Salida estructurada: JSON con un esquema exacto (validado con Pydantic).

IMPORTANTE: el crítico NO calcula el puntaje. Solo lista y marca afirmaciones;
el `anclaje_fuente_score` se calcula en código (ver EvaluacionCalidad).
"""

from __future__ import annotations

from typing import Dict

EJEMPLO_FEW_SHOT_PRODUCTOR = """\
EJEMPLO DE TRANSFORMACIÓN (solo demuestra el formato; no copies sus entidades ni agregues esos hechos):

FUENTE:
"El concepto A permite realizar B. El paso C ocurre después de B."

PERFIL:
Principiante

FORMATO:
Flashcards

SALIDA ESPERADA:
{
  "metadatos": {
    "tiempo_estimado_estudio_minutos": 5,
    "conceptos_clave": ["A", "B"],
    "prerrequisitos": []
  },
  "contenido_adaptado": {
    "titulo": "Comprender el concepto A",
    "introduccion_contextualizada": "Verás cómo se relacionan A, B y C.",
    "items": [
      {"frente": "¿Qué permite realizar el concepto A?", "dorso": "Permite realizar B.", "pista_didactica": "Piensa en A como el punto de partida para B."},
      {"frente": "¿Qué ocurre después de B?", "dorso": "Ocurre el paso C.", "pista_didactica": "Imagina una secuencia: primero B y después C."},
      {"frente": "¿Qué ideas aparecen en la fuente?", "dorso": "A y B son conceptos mencionados en la fuente.", "pista_didactica": "Úsalos como dos piezas relacionadas."},
      {"frente": "¿Qué relación describe la fuente?", "dorso": "La fuente indica que A permite realizar B y que C ocurre después de B.", "pista_didactica": "Piensa en una cadena A → B → C."},
      {"frente": "¿Qué debe respetar la adaptación?", "dorso": "Debe conservar lo que dice la fuente.", "pista_didactica": "Adapta la forma, no inventes el fondo."}
    ]
  }
}"""

EJEMPLOS_FEW_SHOT_PRODUCTOR: Dict[str, str] = {
    "Flashcards": EJEMPLO_FEW_SHOT_PRODUCTOR,
    'Quiz Interactivo con Justificaciones': 'EJEMPLO DE TRANSFORMACIÓN (solo demuestra el formato; no copies sus entidades ni agregues esos hechos):\n\nFUENTE:\n"El concepto A permite realizar B. El paso C ocurre después de B."\n\nPERFIL:\nPrincipiante (solo ilustrativo: adapta al perfil de tu tarea)\n\nFORMATO:\nQuiz Interactivo con Justificaciones\n\nSALIDA ESPERADA:\n{\n  "metadatos": {\n    "tiempo_estimado_estudio_minutos": 5,\n    "conceptos_clave": [\n      "A",\n      "B"\n    ],\n    "prerrequisitos": []\n  },\n  "contenido_adaptado": {\n    "titulo": "Comprender el concepto A",\n    "introduccion_contextualizada": "Verás cómo se relacionan A, B y C.",\n    "items": [\n      {\n        "pregunta": "¿Qué permite realizar el concepto A?",\n        "opciones": [\n          "Permite realizar B.",\n          "Permite realizar C.",\n          "No permite realizar nada.",\n          "Permite eliminar B."\n        ],\n        "respuesta_correcta": "Permite realizar B.",\n        "justificacion": "La fuente indica que A permite realizar B."\n      },\n      {\n        "pregunta": "¿Cuándo ocurre el paso C?",\n        "opciones": [\n          "Antes de B.",\n          "Después de B.",\n          "Antes de A.",\n          "Nunca."\n        ],\n        "respuesta_correcta": "Después de B.",\n        "justificacion": "La fuente indica que C ocurre después de B."\n      }\n    ]\n  }\n}\n\n(El ejemplo muestra pocos items por brevedad: tu respuesta debe cumplir el rango de items indicado en las instrucciones de formato.)',
    'Guía Práctica Paso a Paso (Tutorial)': 'EJEMPLO DE TRANSFORMACIÓN (solo demuestra el formato; no copies sus entidades ni agregues esos hechos):\n\nFUENTE:\n"El concepto A permite realizar B. El paso C ocurre después de B."\n\nPERFIL:\nPrincipiante (solo ilustrativo: adapta al perfil de tu tarea)\n\nFORMATO:\nGuía Práctica Paso a Paso (Tutorial)\n\nSALIDA ESPERADA:\n{\n  "metadatos": {\n    "tiempo_estimado_estudio_minutos": 5,\n    "conceptos_clave": [\n      "A",\n      "B"\n    ],\n    "prerrequisitos": []\n  },\n  "contenido_adaptado": {\n    "titulo": "Comprender el concepto A",\n    "introduccion_contextualizada": "Verás cómo se relacionan A, B y C.",\n    "items": [\n      {\n        "numero_paso": 1,\n        "titulo": "Identifica el concepto A",\n        "instruccion": "Reconoce que A permite realizar B, según la fuente."\n      },\n      {\n        "numero_paso": 2,\n        "titulo": "Ubica el paso C",\n        "instruccion": "Recuerda que C ocurre después de B."\n      }\n    ]\n  }\n}\n\n(El ejemplo muestra pocos items por brevedad: tu respuesta debe cumplir el rango de items indicado en las instrucciones de formato.)',
    'Resumen Ejecutivo (TL;DR)': 'EJEMPLO DE TRANSFORMACIÓN (solo demuestra el formato; no copies sus entidades ni agregues esos hechos):\n\nFUENTE:\n"El concepto A permite realizar B. El paso C ocurre después de B."\n\nPERFIL:\nPrincipiante (solo ilustrativo: adapta al perfil de tu tarea)\n\nFORMATO:\nResumen Ejecutivo (TL;DR)\n\nSALIDA ESPERADA:\n{\n  "metadatos": {\n    "tiempo_estimado_estudio_minutos": 5,\n    "conceptos_clave": [\n      "A",\n      "B"\n    ],\n    "prerrequisitos": []\n  },\n  "contenido_adaptado": {\n    "titulo": "Comprender el concepto A",\n    "introduccion_contextualizada": "Verás cómo se relacionan A, B y C.",\n    "items": [\n      {\n        "punto": "A permite realizar B.",\n        "por_que_importa": "Es la relación central que describe la fuente."\n      },\n      {\n        "punto": "C ocurre después de B.",\n        "por_que_importa": "Define el orden en que suceden los pasos."\n      }\n    ]\n  }\n}\n\n(El ejemplo muestra pocos items por brevedad: tu respuesta debe cumplir el rango de items indicado en las instrucciones de formato.)',
    'Guion de Clase / Video': 'EJEMPLO DE TRANSFORMACIÓN (solo demuestra el formato; no copies sus entidades ni agregues esos hechos):\n\nFUENTE:\n"El concepto A permite realizar B. El paso C ocurre después de B."\n\nPERFIL:\nPrincipiante (solo ilustrativo: adapta al perfil de tu tarea)\n\nFORMATO:\nGuion de Clase / Video\n\nSALIDA ESPERADA:\n{\n  "metadatos": {\n    "tiempo_estimado_estudio_minutos": 5,\n    "conceptos_clave": [\n      "A",\n      "B"\n    ],\n    "prerrequisitos": []\n  },\n  "contenido_adaptado": {\n    "titulo": "Comprender el concepto A",\n    "introduccion_contextualizada": "Verás cómo se relacionan A, B y C.",\n    "items": [\n      {\n        "minuto_aproximado": "0-1",\n        "narracion": "Hoy veremos cómo el concepto A permite realizar B.",\n        "apoyo_visual_sugerido": "Diagrama simple A → B."\n      },\n      {\n        "minuto_aproximado": "1-2",\n        "narracion": "Después de B ocurre el paso C.",\n        "apoyo_visual_sugerido": "Línea de tiempo con B y luego C."\n      }\n    ]\n  }\n}\n\n(El ejemplo muestra pocos items por brevedad: tu respuesta debe cumplir el rango de items indicado en las instrucciones de formato.)',
}


def obtener_ejemplo_few_shot(formato_salida: str) -> str:
    """Ejemplo few-shot con la MISMA estructura del formato pedido."""
    return EJEMPLOS_FEW_SHOT_PRODUCTOR.get(formato_salida, EJEMPLO_FEW_SHOT_PRODUCTOR)


SYSTEM_CRITICO = """\
Eres un auditor de fidelidad documental para material educativo técnico.
Tu única tarea es verificar si el CONTENIDO GENERADO está respaldado por los
FRAGMENTOS FUENTE. No redactas ni mejoras el contenido: lo auditas.

PROCEDIMIENTO
1. Recorre TODO el contenido generado (título, introducción y cada item) y
   extrae sus afirmaciones técnicas: definiciones, datos, cifras, fórmulas,
   procedimientos, relaciones causa-efecto, ejemplos concretos y aplicaciones.
2. Para cada afirmación decide si está respaldada por los fragmentos fuente:
   - respaldada = true si el fragmento la dice explícitamente o se infiere de
     forma directa y razonable de él.
   - respaldada = false si añade información que no está en los fragmentos
     (conocimiento externo, ejemplos inventados, cifras nuevas, aplicaciones
     del mundo real no mencionadas) o si contradice la fuente.
3. Cita en `chunk_id_evidencia` el id del fragmento que la respalda. Si no
   está respaldada, déjalo en null y explica brevemente en `comentario`.

REGLAS SOBRE ANALOGÍAS
- Una analogía pedagógica claramente marcada ("es como", "imagina que",
  "similar a", "como si fuera") NO es una afirmación técnica: no la incluyas
  en la lista.
- Si la analogía introduce un hecho técnico nuevo (números, ecuaciones,
  aplicaciones concretas, propiedades no presentes en la fuente), ese hecho
  SÍ es una afirmación y debe marcarse como no respaldada.

CLARIDAD PEDAGÓGICA
Evalúa si el contenido es claro y adecuado para el perfil, formato, nivel de
detalle y nicho/sector que se indiquen en el contexto de evaluación
(lenguaje, profundidad, orden y forma de presentación). Usa exactamente una
de estas etiquetas: "Alta", "Media" o "Baja".

SUGERENCIAS DE CORRECCIÓN
Por cada afirmación no respaldada escribe una instrucción concreta y breve
para el redactor (por ejemplo: "Elimina la mención a X, no aparece en la
fuente" o "Reescribe Y usando solo lo que dice el fragmento doc_3").

REGLAS DE FORMATO
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin
  markdown y sin backticks.
- NO incluyas ningún puntaje numérico: se calcula fuera de ti.
- Máximo 30 afirmaciones; si hay más, prioriza las de mayor riesgo técnico.
- Escribe todo en español.
"""

_EJEMPLO_FEW_SHOT = """\
EJEMPLO DE SALIDA (solo ilustra el formato; NO copies su contenido):
{
  "afirmaciones": [
    {
      "afirmacion": "Una VCN es una red privada y personalizable en la nube.",
      "respaldada": true,
      "chunk_id_evidencia": "doc_0",
      "comentario": null
    },
    {
      "afirmacion": "Las VCN cobran una tarifa mensual fija por subred.",
      "respaldada": false,
      "chunk_id_evidencia": null,
      "comentario": "El fragmento no menciona costos."
    }
  ],
  "claridad_pedagogica": "Alta",
  "observaciones": "Lenguaje adecuado para el perfil. Una afirmación sobre costos no aparece en la fuente.",
  "sugerencias_correccion": [
    "Elimina la afirmación sobre tarifas por subred: no aparece en la fuente."
  ]
}"""


def construir_prompt_critico(
    contenido_generado: str,
    fragmentos: str,
    perfil_destinatario: str,
    formato_salida: str,
    nivel_detalle: str,
    nicho_sector: str,
) -> str:
    """
    Construye el mensaje de usuario para el crítico con el contexto real
    usado para la adaptación.
    """
    return f"""\
CONTEXTO DE ADAPTACIÓN
- Perfil del destinatario: {perfil_destinatario}
- Formato pedagógico: {formato_salida}
- Nivel de detalle: {nivel_detalle}
- Nicho / sector: {nicho_sector}

FRAGMENTOS FUENTE (única base válida para respaldar afirmaciones):
{fragmentos}

CONTENIDO GENERADO A AUDITAR (JSON):
{contenido_generado}

{_EJEMPLO_FEW_SHOT}

Evalúa también si el contenido está bien adaptado al contexto indicado.
Devuelve ahora tu auditoría como un único objeto JSON con las claves
"afirmaciones", "claridad_pedagogica", "observaciones" y
"sugerencias_correccion".
"""
