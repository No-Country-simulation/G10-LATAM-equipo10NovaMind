# Changelog

Todas las modificaciones notables del proyecto NuevaMente se registran en este documento.

## [2.7.0] - 2026-10-14

### Procedencia honesta: visor de fuente, nicho acotado y Estación 3 sin datos inventados
- **Visor de fuente** (`dbe98dc`, `a24e226`): el chip «Fuente · pág. N» de las estaciones 1 a 3 y el botón «Ver en el documento» de las citas del guion (Estación 4) abren el pasaje literal del documento con la cita resaltada. El pasaje lo calcula el backend (`fuentes.contexto_de_cita`), no cruza de página y viaja dentro del paquete; las citas no verificadas no tienen visor.
- **Privacidad del correo** (`dbe98dc`): la dirección del destinatario se enmascara en los logs (`al***@ejemplo.com`) y el log de error SMTP solo registra el tipo de excepción. El recibo dice «archivado en OCI» solo si la subida devolvió la ruta real. Los tests ya no suben PDF al bucket real.
- **El nicho solo en analogías** (`abd1a54`, `f9ce53b`): con un sector distinto de General, el prompt limita el sector a analogías, ejemplos y pistas, sin atribuir al documento propósitos del sector, y el guion lo menciona como mucho en una escena. Motivo: en la prueba de nichos, el guion de Leyes narraba «para cumplir con el cumplimiento normativo… optimizamos la memoria».
- **Verificador de citas y bloques de código** (`abd1a54`, `f9ce53b`): la marca de bloque de código con su etiqueta (```` ```bash ````) se descarta igual en la cita y en el documento. Recupera citas literales que unían una frase con su comando (7 de 18 rechazadas en la 1.ª corrida de nichos) sin aceptar ninguna que antes se rechazara.
- **Estación 3 sin métricas inventadas** (`0bae210`, `a2a77b4`): sin evaluación del backend ya no muestra un 98 % «Zero-Hallucination Verified»; muestra «N/D» o «Sin auditar». La pastilla de OCI sigue a `status_upload` («Guardado en OCI», «Guardado en el servidor, no en OCI», «No se pudo guardar», «No guardado en OCI»). El paquete de demostración se marca como ejemplo sin auditar. Se eliminó `utils/ociStorage.ts`, que no se usaba y habría subido paquetes con una URL pre-autenticada pública (`VITE_OCI_PAR_URL`).
- **Documentación:** `DATABASE.md` reescrito con las migraciones reales de Supabase; concurrencia real en `SECURITY.md` y `DEPLOYMENT.md`.
- **Pruebas:** `cd backend && ../.venv/Scripts/python -m pytest -q` (300 al cerrar esta versión) y `cd frontend && npm test` (26).

## [2.6.0] - 2026-10-14

### 🎙️ Protección de Cuota de Narración, UX React 19, Especialización de Nichos y Medallas Honestas (Fase 22)
- **Protección Preventiva de Cuota de Voz:** Validación estricta en frontend y backend (`exceso_guion_narracion`) que bloquea peticiones de locución con guiones mayores a 173 palabras o 1.730 caracteres (`error_codigo="guion_largo"`), evitando malgastar créditos de ElevenLabs en audios que superarían el tope audiovisual de 60 s.
- **Ajuste y Recorte Inteligente de Guion por IA (`_ajustar_guion`):** Poda semántica asistida por LLM para condensar guiones sobre-extendidos al rango óptimo de 110–125 palabras sin desvirtuar el mensaje pedagógico.
- **Plazos y Timeouts Robustos en Síntesis de Voz:** Presupuesto de síntesis `PLAZO_VOZ_S = 80s`, timeout de ElevenLabs acotado a 25s y degradación suave a síntesis de voz del navegador (`SpeechSynthesis`) sin alertas bloqueantes ni interrupción de la experiencia.
- **Texto honesto de la medalla (`BadgeModal`):** con sesión iniciada dice «Logro guardado en tu cuenta»; como invitado, que el logro es de esta sesión y se pierde al recargar.
- **Experiencia de Ingesta Renovada (Paso 1):**
  - Zona nativa de *Drag & Drop* interactiva con animaciones CSS y estados visuales (hover/dragover) para PDF, Markdown, TXT e imágenes.
  - Selector compacto de biblioteca en `<select>` para optimizar el espacio vertical.
  - Modo "Sorpréndeme" activo por defecto para descubrimiento aleatorio de escenarios en un clic.
  - Visualización del prompt de rol ("Eres un tutor experto...") en la tarjeta de resumen del paquete.
- **Nichos alineados con el backend:** el front usa los 11 sectores de `DIRECTIVAS_NICHO_SECTOR` (`Tecnología e Informática`, `Medicina y Salud`, `Ingeniería y Construcción`, `Finanzas y Contabilidad`, `Administración y Negocios`, `Marketing y Ventas`, `Leyes y Legal`, `Educación y Academia`, `Ciencias e Investigación`, `Industria y Operaciones` y `General`). El escenario Kafka pasó de "Fintech", que no existía en el backend, a "Finanzas y Contabilidad".
- **Prueba de nichos (`pruebas_nichos/`, fuera del repo), 1.ª corrida:** 5 generaciones reales (General ×2, Medicina, Leyes y Finanzas) sobre la guía de swap. Cada nicho sube el léxico de su sector muy por encima de General (Medicina +4,9, Leyes +5,2 y Finanzas +12,2 términos por mil palabras). Es una corrida por nicho: indica que el nicho funciona, no es una medida estadística. La auditoría encontró que el sector se colaba en afirmaciones sobre el documento; se corrigió en 2.7.0.
- **Utilidad "Copiar Prompt Visual" y Limpieza de Bundle:** Extracción al portapapeles del prompt para generadores de imagen externos (Midjourney / Imagen 3) y eliminación de dependencias huérfanas (`gsap`, `lenis`).
- **Aislamiento de Caché de Invitados:** Particionado en memoria de tareas de usuarios no autenticados para prevenir cruce de datos en servidores multi-usuario.
- **Suite de Pruebas Ampliada:** Cobertura de backend incrementada a **288 pruebas automatizadas al 100% de éxito + 26 pruebas de frontend** y verificación de tipos estricta (`tsc`).

## [2.5.0] - 2026-10-14

### 🛡️ Resiliencia ante 429 de Gemini, Semáforos por Modelo y Benchmarking (Fase 21)
- **Clasificación Granular de Cuotas HTTP 429:** Inspección de payloads `google.rpc.QuotaFailure` y `google.rpc.RetryInfo` en `backend/app/servicios/servicio_gemini.py` para distinguir cuotas diarias de límites por minuto, extrayendo `retry_after_s`.
- **Memoria de Modelos Agotados (Fail-Fast):** Modelos con cuota diaria agotada se marcan en memoria hasta la medianoche del Pacífico (hora de reseteo de Google AI Studio), evitando peticiones de red redundantes.
- **Reintento Condicional para Cuota por Minuto:** Espera asíncrona y reintento único cuando `retry_after_s <= 10.0` y queda presupuesto de tiempo; de lo contrario, conmuta de inmediato a fallback.
- **Semáforo del respaldo por modelo:** Nuevo parámetro `GEMINI_CONCURRENCIA_POR_MODELO=2` (1–10). Limita las llamadas simultáneas a cada modelo de respaldo en todo el proceso (no por petición). El principal no se limita: las tres tareas de una generación siguen saliendo a la vez.
- **Jitter en Conmutación de Respaldo:** Pausa aleatoria (`0.0 - 1.5s`) antes de invocar el modelo de respaldo para evitar saturación simultánea (*thundering herd*).
- **Proveniencia Honesta en Recursos:** Advertencias explícitas en el estado del recurso indicando si se generó con modelo de respaldo debido a cuota diaria o por minuto.
- **Script Comparador de Modelos (`deploy/comparar_modelos.py`):** Utilidad de benchmarking CLI para contrastar latencia, errores, consumo de tokens y verificación de citas entre `gemini-3.5-flash-lite` y `gemini-3.8-flash`.
- **Suite de Pruebas Ampliada:** Cobertura de backend incrementada a **275 pruebas automatizadas al 100% de éxito**.

## [2.4.0] - 2026-10-10

### ⚡ Concurrencia Optimizada, Renderizador Mermaid en UI y Navegación Fluida (Fase 13)
- **Escalamiento de Concurrencia en Backend:** Ampliación del semáforo global `_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(5)` (anteriormente 1, lo que retenía peticiones concurrentes en cola por más de 3 minutos).
- **Aceleración Agresiva de Failovers:** Reducción de timeout de Gemini a `7.0s` y eliminación de alias colgados para conmutar de inmediato a Groq LPU (`openai/gpt-oss-120b`), asegurando respuesta en `< 10 segundos`.
- **Sanitización XML en Generador PDF (ReportLab):** Blindaje preventivo con `html.escape()` sobre todos los textos provenientes de LLMs para evitar fallos de `paraparser` por caracteres `< > &`.
- **Visualizador Dinámico Mermaid.js en UI:** Componente `MermaidDiagram` integrado con modo oscuro cyberpunk/clean, renderizado dinámico en tiempo real (`mermaid.render()`), conmutador Gráfico/Código y botón con feedback de copiado al portapapeles.
- **Feedback Integrado sin `alert()` Bloqueante:** Reemplazo de `alert()` nativo por toast flotante animado de seguridad cognitiva (`lockedToast`) que muestra el estado de desbloqueo exacto y se auto-descarta a los 5s.
- **Navegación Secuencial Directa:** Botones de acción "Siguiente Estación →" al pie de todas las estaciones pedagógicas para una experiencia de usuario fluida y gamificada.

## [2.3.0] - 2026-10-09

### 🚀 Pipeline Colaborativo Multi-Modelo (Vectorless RAG), Dossier PDF y Despacho Silencioso (Fase 12)
- **Pipeline Colaborativo Vectorless (`CadenaColaborativaMultiModelo`):** Ingesta masiva ultra-rápida con Google Gemini 2.5 Flash, auditoría RAG fáctica con Groq LPU (`openai/gpt-oss-120b`) y humanización/nicho con Cohere Command R (`command-r-08-2024`). Latencia de procesamiento reducida a **~11.1 segundos**.
- **Doble Cascada de Resiliencia (Auto-Failover en Tiempo Real):**
  - Failover 1: Gemini timeout/503 -> Groq LPU inmediato en 3.0s.
  - Failover 2: Groq cuota/límite -> Orquestador LangGraph clásico con ChromaDB y embeddings vectoriales, advirtiendo al usuario en el stream SSE.
- **Compilador de Dossier PDF Estandarizado (ReportLab):** Generación de documento formal descargable con las 5 estaciones (Resumen, Flashcards, Tutorial, Diagrama Mermaid, Quiz), excluyendo deliberadamente el recurso audiovisual. Sanitización defensiva contra errores de sintaxis XML en texto de LLMs.
- **Despacho Silencioso por Correo Electrónico:** Procesamiento asíncrono en segundo plano (`BackgroundTasks`) con respaldo en OCI Object Storage (`reportes-pdf/dossier-*.pdf`) y modo de simulación segura si no hay servidor SMTP configurado.
- **Esquema Pydantic Ampliado:** Soporte para `diagrama_mermaid` y compatibilidad `extra="ignore"` en `ContenidoAdaptado`.
- **Suite de Pruebas Ampliada:** Cobertura extendida a **76 pruebas automatizadas aprobadas al 100% (`pytest backend/tests -v`)**.

## [2.2.0] - 2026-10-08

### 🚀 Circuito de 5 Estaciones, Guía OCI Swap, E2E Kafka y Benchmark de Estrés (Fase 10)
- **Formato Unificado de 5 Estaciones:** Incorporación de `"Paquete Educativo Completo (5 Estaciones)"` en esquemas Pydantic v2 y soporte en el Agente 2 Productor para generar el flujo integral de aprendizaje: Resumen Ninja, Flashcard Quest, Tutorial Quest, Director Cut (Storyboard/Teleprompter) y The Final Trial (Quiz con escudos).
- **Interoperabilidad Transparente de Ingesta:** Normalización en `main.py` para aceptar de forma indistinta y concurrente `texto_directo` o `documento_contenido`.
- **Validación E2E en Vivo (`apache_kafka_introduction.md`):** Certificación del pipeline contra documento técnico denso (11.052 caracteres): 12 chunks semánticos indexados en 1.28s, 7 flashcards en 21.93s, 27 afirmaciones auditadas con **Score de Anclaje de 1.0 (100% fidelidad, 0 alucinaciones)** y persistencia exitosa en OCI Object Storage.
- **Benchmark de Estrés y No-Bloqueo del Event Loop:** Ejecución de suite de concurrencia:
  - Throughput: 137.24 RPS en `/health` y 144.32 RPS en opciones.
  - Asincronismo comprobado: latencia media de 9.27 ms en `/health` durante inferencia RAG pesada de 71.76 s (0% event loop starvation).
  - Consumo de RAM: ~172 MB working set bajo estrés máximo en instancia `VM.Standard.E2.1.Micro`.
- **Auto-Failover Activo:** Conmutación automática ante saturación del evaluador primario (Gemini -> Groq `llama-3.3-70b-versatile`) resolviendo en 2.1s sin error 500.
- **Suite de Testing Ampliada:** Cobertura extendida a **70 pruebas unitarias y de integración al 100%** de éxito.

## [2.1.0] - 2026-10-06

### 🚀 Orquestación Multi-Proveedor, Resiliencia SSE y Auditoría Real (Fase 9)
- **Agente Crítico Multi-Proveedor:** Patrón Fábrica (`ProveedorCritico`) con Google Gemini 2.5 Flash (~2s, schema JSON estructurado) como evaluador primario neutral, con fallback en cascada a Groq (`qwen/qwen3.8-27b`) y Cohere (`command-r-08-2024`).
- **Verificación Determinista de Evidencias:** Validación en Python de que los `chunk_id` citados por el Crítico pertenezcan a los fragmentos reales recuperados por el Agente 1 antes de computar el score de fidelidad.
- **Canal de Streaming Server-Sent Events (SSE):** Endpoint `POST /api/v1/adaptar/stream` con emisión de eventos estructurados y heartbeats cada 15s para inmunidad total al timeout 524 de Cloudflare Free Tier (límite de 100s).
- **Desacople Asíncrono y Protección de Memoria:** Envoltorio `asyncio.to_thread` para desacoplar LangGraph del event loop y `asyncio.Semaphore(1)` para proteger la instancia OCI Always Free (1 GB RAM) contra saturación por concurrencia.
- **Auto-reparación Defensiva del Formato Quiz:** Sanitización en Pydantic (`validar_items`) para normalizar prefijos sintácticos de opciones ("A) ") sin gatillar reintentos innecesarios de LLM.
- **Optimizaciones de Latencia E2E:** Reducción del pipeline textual completo de 429.19 s a ~18 s con auditoría RAG 100% real.

## [2.0.0] - 2026-09-29

### 🚀 Integración Full Stack y Consolidación de Arquitectura
Versión unificada y verificada que culmina las 5 fases de integración técnica del sistema:

#### Añadido
- **Frontend SPA en React 19 + Vite + TypeScript:** Interfaz moderna desacoplada con componentes modulares, stepper interactivo de 3 pasos y visualizadores para los 5 formatos pedagógicos (Flashcards 3D, Quiz interactivo, Tutorial con comandos, TL;DR expandible y Guion de video).
- **Persistencia Híbrida en Oracle Cloud (Fase 3):** Integración con OCI Object Storage Always Free (bucket `nuevamente-contenidos-educativos`, región `sa-santiago-1`) mediante `UploadManager` del SDK oficial de OCI.
- **Mecanismo de Fallback Local Resiliente (`almacenador_resiliente`):** Redirección transparente de persistencia a `data/outputs/` ante ausencia de credenciales OCI o fallos temporales de red.
- **Lanzador Unificado (`iniciar_local.bat`):** Script concurrente para arrancar FastAPI (puerto 8000) y React Vite (puerto 5173) en simultáneo.
- **Herramienta de Restablecimiento (`reestablecer_local.bat` y `scripts/reestablecer_local.py`):** Limpieza de colecciones ChromaDB y salidas locales para pruebas desde Estado Cero.
- **Suite de Pruebas Automatizadas (65 tests):** 100% de éxito en tests unitarios, contratos Pydantic v2, normalización de alias, mocks de integración y endpoints REST.

#### Modificado
- **CORS en FastAPI (`backend/app/main.py`):** Reemplazo de política permisiva `["*"]` por restricción explícita a orígenes de desarrollo (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:8501`, `http://127.0.0.1:8000`).
- **Armonización de Variables de Entorno (`backend/app/core/config.py`):** Soporte unificado de variables y alias (`COHERE_MODEL`, `COHERE_EMBEDDING_MODEL`, `OCI_*`).
- **Endpoints de Paquetes (`/api/v1/paquetes` y `/api/v1/paquetes/{objeto_id}`):** Resolución híbrida que prioriza OCI y resuelve descargas locales ante caídas o en entornos sin nube.
- **Estructura del Repositorio:** Centralización de documentación de progreso en `historial_progreso/` y preservación de artefactos preliminares en `legado/`.

#### Seguridad
- Purga completa de identificadores y credenciales en el historial Git mediante `git-filter-repo`.
- Reglas de exclusión reforzadas en `.gitignore` para archivos confidenciales y bitácoras privadas.

---
Para más detalles sobre las fases anteriores de desarrollo, consultar `historial_progreso/CAMBIOS.md` y `historial_progreso/HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md`.

