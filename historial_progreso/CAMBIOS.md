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

## Fase 3: Integración OCI Object Storage y Persistencia Resiliente

1. **Almacenador Híbrido Resiliente:** En `crear_orquestador()`, se implementó la inyección de `almacenador_resiliente`. Prioriza la subida a OCI Object Storage (`nuevamente-contenidos-educativos` en `sa-santiago-1`) y, ante cualquier fallo de red o credenciales en tiempo de ejecución, realiza un fallback automático e inmediato a almacenamiento local en `data/outputs/`.
2. **Endpoints de Persistencia y Descarga:** En `main.py`, se robustecieron `GET /api/v1/paquetes` y `GET /api/v1/paquetes/{objeto_id}` para permitir consulta y descarga dual transparente con normalización de rutas y prefijos.
3. **Verificación:** 65 pruebas pasando al 100% (`pytest backend/tests -v`).

## Fase 4: Integración Full-Stack en la Rama `integracion` (Frontend React 19 + Vite + TypeScript)

1. **Rama Unificada `integracion`:** Creada para consolidar la arquitectura desacoplada de microservicios sin los riesgos destructivos observados en `origin/frontEnd`.
2. **Adopción Oficial de React 19 + Vite:** Se sustituyó la UI provisional de Streamlit por la aplicación SPA completa en `frontend/` (TypeScript, GSAP, Lenis, Lucide, CSS Modules).
3. **Renderizadores Interactivos por Formato:** Visualizadores especializados para Flashcards con giro 3D, Quizzes interactivos con justificación en tiempo real, Tutoriales técnicos, Resúmenes ejecutivos y Guiones.
4. **Dashboard de Métricas y Persistencia:** Componente `MetricsView` con indicadores visuales del score de anclaje RAG (LangGraph), evaluación de calidad y persistencia en OCI Cloud.
5. **Sincronización de Lanzadores:** Actualización de `iniciar_local.bat` para arranque concurrente de FastAPI (:8000) y Vite (:5173).
6. **Verificación Dual:** Build de producción de frontend completado en 1.21s (`npm run build` con 0 errores TypeScript) y suite de backend al 100% (65/65 tests en `backend/tests`).

## Fase 5: Conexión Real End-to-End Backend FastAPI y Frontend React

1. **Armonización de Backend y CORS:**
   - En `backend/app/core/config.py`: Soporte de alias en variables de entorno para compatibilidad total con `.env.example` (`CHROMA_PATH` / `AGENTE1_CHROMA_PATH`, `TOP_K` / `TOP_K_CHUNKS`, `EMBEDDING_MODEL` / `COHERE_EMBEDDING_MODEL`).
   - En `backend/app/main.py`: Configuración explícita de CORS para el dev server de Vite (`http://localhost:5173`, `http://127.0.0.1:5173`) y puertos dinámicos localhost con credenciales habilitadas.
2. **Ingesta Real de Archivos y Texto en Frontend:**
   - `IngestView.tsx` actualizado con input de archivos nativo oculto y drag & drop para `.pdf`, `.md`, `.txt`, más modo de texto directo editable (mínimo 40 caracteres).
3. **Conexión Live Asíncrona:**
   - `App.tsx` conectado asíncronamente con `enviarAdaptacion(payload)` de `frontend/src/services/api.ts` hacia `POST /api/v1/adaptar`.
   - Estado dinámico `adaptationResult`, sincronización del título del documento en `Header` y manejo resiliente de fallback en caso de desconexión.
4. **Visualizadores Dinámicos Conectados:**
   - Visualizadores de los 5 formatos (`FlashcardViewer`, `QuizViewer`, `TutorialViewer`, `SummaryViewer`, `ScriptViewer`) actualizados para consumir los ítems generados en tiempo real por el Agente 2.
   - `QuizViewer` ampliado con soporte multi-pregunta interactivo, navegación anterior/siguiente y retroalimentación pedagógica instantánea.
5. **Auditoría Dinámica:**
   - `MetricsView.tsx` sincronizado con las métricas de orquestación de LangGraph (`chunks_recuperados`, `intentos_redaccion`, `duracion_segundos`) y metadatos de persistencia en OCI Object Storage.
6. **Verificación:**
   - Backend: 65/65 tests pasando (`pytest backend/tests -v`).
   - Frontend: `npm run build` (`tsc -b && vite build`) completado con 0 errores.



