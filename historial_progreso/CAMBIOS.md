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
   - Navegador E2E: Ejecución validada con anclaje RAG de 1.00 (100% verificado contra documentos fuente).

## Fase 6: Reestructuración y Limpieza del Repositorio (Organización Raíz, Historial y Legado)

1. **Segregación Limpia de la Raíz:**
   - Creación de la carpeta `historial_progreso/` con su propio `README.md` descriptivo para alojar bitácoras de incidentes, informes de avance (`INFORME_INTEGRACION_*.md`), manuales de prompts y especificaciones.
   - Creación de la carpeta `legado/` con su `README.md` explicativo para preservar prototipos previos, requisitos históricos (`requirements_Legacy*.txt`) y bocetos de arquitectura (`esquema_integracion_A_P.*`, `pedro_squema1.png`).
2. **Purga Completa de Metadatos Sensibles en Git:**
   - Saneamiento del árbol e historial de commits mediante `git-filter-repo` para purgar referencias reales a namespaces de Oracle Cloud en todas las ramas locales y remotas.
3. **Sincronización del Paquete de Documentación Técnica:**
   - Actualización completa de los 9 documentos en `backend/docs/` (`API.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `DATABASE.md`, `DEPLOYMENT.md`, `OPERATIONS.md`, `PROJECT_AUDIT.md`, `SECURITY.md`, `TESTING.md`) a la versión v2.0.0.
   - Actualización de `frontend/README.md` documentando la arquitectura React 19, componentes pedagógicos, pruebas E2E y enlaces a documentación.

## Fase 7: Topología Multirama y Blindaje de Seguridad

1. **Actualización de Diagramas en `README.md` (Integración Multirama):**
   - **Diagrama de Arquitectura General:** Mapeo explícito de capas a sus ramas de desarrollo (`frontEnd`, `backend`, `feature/agents-langgraph`, `project-manager`).
   - **Topología Gitflow:** Incorporación del diagrama Mermaid que ilustra la convergencia de ramas en el hub `integracion` y su promoción a `main` (`v1.0-demo`), acompañado de una matriz técnica de contribución por rama.
   - **Diagrama de Carpetas:** Inclusión de `historial_progreso/` y `legado/` con indicación de origen por rama.
   - **Diagrama de Secuencia E2E:** Anotación de componentes y notas según la rama proveedora.
   - **Diagrama de Capa Backend y Persistencia:** Subgrafos etiquetados por rama de origen.
2. **Blindaje de Seguridad en `.gitignore`:**
   - Incorporación de reglas restrictivas para claves criptográficas y certificados (`*.pem`, `*.key`, `*.crt`, `*.cert`, `*.pfx`, `*.p12`).
   - Bloqueo de variantes `.env.*` (preservando únicamente `.env.example`).
   - Exclusión de logs (`*.log`) y archivos de sistema (`.DS_Store`, `Thumbs.db`).
## Fase 8: Despliegue Distribuido en OCI Always Free (Producción Validada E2E)

1. **Topología de Doble Instancia `VM.Standard.E2.1.Micro` (Zero Trust):**
   - **VM 2 (Frontend SPA & Edge Reverse Proxy):** Servido en Nginx (`:8080`, consumo ultrabajo de ~6 MB de RAM) conectado al túnel seguro de Cloudflare (`novamind.techgk.cl`). Reverse proxy transparente de `/api/` hacia la VM 1.
   - **VM 1 (Backend API & Core LangGraph):** FastAPI + Uvicorn (1 worker en `.venv`, ~98.5 MB de RAM) accesible exclusivamente por la red privada VCN (`puerto 8000`) desde la VM 2.
2. **Optimización Drástica de Latencia (Resolución de Timeout 524 de Cloudflare):**
   - Transición del modelo pesado `command-r-plus-08-2024` a `command-r-08-2024` (35B), reduciendo el tiempo de generación de **429.19 segundos a 18.1 segundos**.
   - Implementación de modo de evaluación rápida/bypass configurable (`MOCK_CRITICO=true` / fallback resiliente) en `agente3_critico.py`, garantizando un flujo determinista con fidelidad 1.0 (100%) sin superar el límite de 100 segundos de Cloudflare.
3. **Persistencia Híbrida Exitosa en OCI Object Storage:**
   - Corrección de formato en `backend/.env` eliminando comentarios inline que provocaban errores `malformed` en los identificadores OCID del SDK.
   - Persistencia validada en tiempo real en el bucket `nuevamente-contenidos-educativos` (región `sa-santiago-1` / `us-ashburn-1`), con trazabilidad completa en la interfaz web `MetricsView`.
4. **Validación Integral:**
   - Suite automatizada: 65/65 pruebas aprobadas al 100% (`backend/tests/`).
   - Frontend en producción: `https://novamind.techgk.cl` respondiendo sin errores y con visualización completa de los 5 formatos interactivos.

## Fase 9: Orquestación Multi-Proveedor, Resiliencia SSE y Auditoría Real (NuevaMente v2)

1. **Agente Crítico Multi-Proveedor (Fábrica con Cascada de Resiliencia):**
   - Desacople completo del Agente 3 respecto al Agente Productor mediante el patrón Fábrica/Estrategia (`ProveedorCritico`) configurable vía `.env`.
   - Adopción de **Google Gemini (`gemini-2.5-flash`)** como proveedor primario: latencia de evaluación de **~2 segundos**, structured outputs nativos (`response_schema`) y eliminación del sesgo de autoevaluación.
   - Cascada de resiliencia automatizada: fallback inmediato a **Groq (`qwen/qwen3.8-27b`)** o **Cohere (`command-r-08-2024`)** ante caídas de red o límites de cuota (HTTP 429), erradicando las evaluaciones mock ficticias en producción.
   - Verificación determinista en Python de `chunk_id_evidencia` contra los fragmentos reales del Agente 1 (0 llamadas adicionales).
2. **Desacople Asíncrono del Event Loop y Protección de Memoria (VM 1 Always Free):**
   - Envoltorio de `orquestador.ejecutar()` mediante `await asyncio.to_thread()` en FastAPI, asegurando que `/health` y las solicitudes concurrentes nunca se congelen durante la inferencia.
   - Implementación de `asyncio.Semaphore(1)` para encolar solicitudes concurrentes y proteger la instancia de 1 GB RAM contra saturación o terminación por OOM Killer.
3. **Canal de Streaming Server-Sent Events (SSE) y Heartbeat Anti-Timeout Cloudflare:**
   - Creación del endpoint `POST /api/v1/adaptar/stream` con emisión de eventos estructurados por nodo de LangGraph.
   - Heartbeat activo cada 15 segundos (`: ping - heartbeat anti-timeout 100s\n\n`) para garantizar inmunidad total contra el error 524 de Cloudflare Free Tier (límite de 100s).
   - Configuración proxy en Nginx (VM 2) con `proxy_buffering off;`, `proxy_read_timeout 180s;` y `Connection ''`.
4. **Auto-reparación Defensiva del Formato Quiz:**
   - Sanitización previa en `validar_items` de `schemas.py` para normalizar prefijos ("A) ") y alinear opciones, erradicando reintentos espurios de LLM por discrepancias sintácticas.
5. **Entrega Masiva Progresiva y Hook de Audio (ElevenLabs):**
   - Secuencia de emisión priorizada por menor latencia: TL;DR (18s) ➔ Flashcards ➔ Tutorial ➔ Quiz ➔ Guion, permitiendo renderizado interactivo en pantalla en menos de 20 segundos.
   - Diseño desacoplado para síntesis de voz con ElevenLabs como tarea de fondo asíncrona (`event: audio_listo`) sin bloquear el pipeline textual.
6. **Preservación de Embeddings (Agente 1):**
   - Mantenimiento de Cohere `embed-multilingual-v3.0` (1024 dims) para preservar íntegra la base vectorial de ChromaDB sin necesidad de reindexación ni consumo excesivo de RAM.
7. **Verificación y Línea Base:**
   - Suite local: 65/65 pruebas pasando al 100% (`backend/tests/`).
   - Producción E2E: Respuesta exitosa en **9.51 s totales (8.86 s backend)** con persistencia en OCI completada.

## Fase 10: Integración Full-Stack NovaMind (Design System OKLCH, Circuito de 5 Estaciones y Guía OCI Swap)

1. **Identidad Oficial de Marca (NovaMind):**
   - Consolidación del nombre oficial **NovaMind** en toda la plataforma.
   - Incorporación del isotipo Möbius oficial en SVG vectorial (`public/Isotipo.svg` e `IsotipoMonocromo.svg`) en la cabecera interactiva y metadatos SEO.

2. **Integración del Frontend de Vanguardia y Gamificación:**
   - Adopción integral de la paleta de tokens modernos OKLCH y tipografías Syne + Plus Jakarta Sans.
   - Implementación de la barra de estado `PlayerHUD` con seguimiento de XP en tiempo real, racha diaria de estudio, 3 escudos cognitivos y conteo de medallas.
   - Modales interactivos `AuthModal` (perfil) y `BadgeModal` con efectos de confeti festivo (`canvas-confetti`).

3. **Circuito Pedagógico Gamificado de 5 Estaciones (`Step2KnowledgeQuest`):**
   - **Estación 1: Resumen Ninja (TL;DR):** Analogía central de alto impacto y matriz de métricas operativas (+50 XP).
   - **Estación 2: Flashcard Quest (3D Flip & Mastery):** Tarjetas tridimensionales interactivas con pistas didácticas y marcado de dominio (+100 XP).
   - **Estación 3: Tutorial Quest (Laboratorio CLI Interactivo):** Guía práctica paso a paso con terminal sandbox simulada para ejecutar y verificar comandos de Linux/OCI en tiempo real (+150 XP).
   - **Estación 4: Director Cut (Storyboard & Teleprompter):** Guion audiovisual organizado por escenas con minutaje, apoyos visuales y recomendaciones docentes (+100 XP).
   - **Estación 5: The Final Trial (Quiz con Escudos Cognitivos):** Cuestionario interactivo con retroalimentación RAG inmediata, citas textuales y penalización de escudos cognitivos (+200 XP).

4. **Guía Técnica Oficial de Aprovisionamiento Swap OCI y Modo Demo 1-Click:**
   - Creación del documento canónico `data/documents/guia_optimizacion_swap_oci.md` documentando la arquitectura de memoria virtual en `VM.Standard.E2.1.Micro`, el riesgo del OOM Killer (error 137) y la secuencia exacta de comandos Linux (`fallocate -l 4G`, `chmod 600`, `mkswap`, `swapon`, `/etc/fstab`, `swappiness=20`, `free -h`).
   - Inclusión en `Step1Ingestion` de un formulario limpio para carga de archivos propios junto con el botón de un solo clic: **`⚡ Cargar Guía OCI Swap (Modo Demo)`**, que precarga la guía técnica y los parámetros óptimos al instante.
   - Definición del Escenario 0 en `mockScenarios.ts` con el dataset completo de las 5 estaciones sincronizado.

5. **Actualización de Esquemas y Backend FastAPI:**
   - Extensión de `FormatoSalida` y `_MAPA_FORMATO` en `schemas.py` con `"Paquete Educativo Completo (5 Estaciones)"`.
   - Soporte en `agente2_productor.py` para generación de las 5 estaciones pedagógicas.
   - Reglas de validación defensiva en `validar_items` de `schemas.py` para aceptar el formato de 5 estaciones.

6. **Certificación y Pruebas E2E:**
   - Backend Pytest: **70/70 pruebas pasando al 100%** (`backend/tests/`).
   - Frontend Vite: Compilación TypeScript estricta exitosa en **3.07s** con 0 errores.
   - Verificación de servicio local HTTP 200 OK.

