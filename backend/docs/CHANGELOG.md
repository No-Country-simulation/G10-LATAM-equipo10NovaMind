# Changelog

Todas las modificaciones notables del proyecto NuevaMente se registran en este documento.

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

