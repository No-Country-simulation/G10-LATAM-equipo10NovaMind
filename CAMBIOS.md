# Cambios finales de la orquestación de NuevaMente

Esta versión parte de la orquestación recibida y modifica únicamente puntos que
aportan robustez o cierran lineamientos explícitos del bloque IA Generativa,
RAG & Agentes.

## Correcciones funcionales

1. El Agente 2 incorpora role prompting + few-shot explícito de transformación.
2. El Agente 3 recibe el contexto real de adaptación: perfil, formato, nivel de
   detalle y nicho/sector.
3. La decisión de LangGraph exige simultáneamente fidelidad suficiente y
   claridad pedagógica distinta de `Baja`.
4. El feedback del crítico ahora también puede corregir problemas de claridad,
   no solo afirmaciones no respaldadas.
5. Agente 1 procesa embeddings en lotes de hasta 96 textos por llamada,
   respetando el límite actual del endpoint Embed de Cohere.
6. Agente 1 no elimina una indexación válida antes de completar los embeddings.
   Usa `upsert` y elimina chunks obsoletos después de aceptar el nuevo conjunto.
7. Agente 1 limita `n_results` al número de elementos disponibles antes de
   consultar ChromaDB, evitando solicitudes imposibles en documentos pequeños.

## Qué NO se modificó por modificar

- Se conservó el flujo base `ingestar -> investigar -> redactar -> criticar`.
- Se mantuvo el límite de `1 + MAX_REDACCION_RETRIES`.
- Se conservó el mecanismo de mejor intento.
- Se mantuvo el cálculo del `anclaje_fuente_score` fuera del LLM.
- Se mantuvo la persistencia OCI como interfaz inyectable, sin implementar
  infraestructura dentro del núcleo.
- Se mantuvieron los contratos y validaciones del proyecto.

## Verificación realizada

- Compilación sintáctica de los 13 archivos Python: OK.
- Pruebas del orquestador con dependencias simuladas: 38 passed.
- Pruebas de integración offline con Agentes 1/2/3 y Chroma simulado: 3 passed.
- Total: 41 passed.
- Los tests incluyen el nuevo gate de claridad, contexto del crítico,
  few-shot del productor, batching de embeddings, consulta limitada al índice
  y actualización segura del vector store.

Nota: la ejecución local debe realizarse además con las dependencias reales y
la `COHERE_API_KEY` del equipo para validar la integración externa de producción.

## Ajustes posteriores (revisión)

1. **Etiquetas exactas del brief.** `SolicitudAdaptacion` rechazaba "Guía Práctica Paso a Paso (Tutorial)" y
   "Flashcards de Memorización" (etiquetas oficiales del brief). Ahora el valor canónico del tutorial es
   "Guía Práctica Paso a Paso (Tutorial)" y se aceptan todos los alias. Prueba de regresión parametrizada.
2. **Few-shot con la estructura del formato pedido.** El ejemplo del productor era siempre de Flashcards, aunque el
   formato pedido fuera Quiz, Guía, Resumen o Guion, lo que daba instrucciones contradictorias. Ahora hay un ejemplo
   por formato (`obtener_ejemplo_few_shot`) y cada uno se valida contra el esquema estricto del proyecto.

Verificación: 59 pruebas (`python -m pytest tests -q`) en chromadb 0.5.20 + pydantic 2.9.2 y en chromadb 1.5.9 + pydantic 2.13.5.
