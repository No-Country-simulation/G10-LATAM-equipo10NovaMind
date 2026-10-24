# Auditoría Estática del Proyecto y Estado de Mitigaciones

## Alcance de la Auditoría

Inspección técnica de los archivos fuente, modelos de orquestación, contratos de datos, infraestructura y configuración de **NuevaMente**. El objetivo es contrastar el diseño documentado contra el comportamiento operativo real del código, identificando riesgos y documentando las soluciones implementadas en todas las capas del sistema.


## 1. Hallazgos Iniciales y Estado de Resolución

| Hallazgo Inicial | Estado | Mitigación Implementada |
|---|:---:|---|
| **1. Divergencia en Configuración** | 🟢 Resuelto | Centralización de variables en `backend/app/core/config.py` con resolución tolerante de alias (`COHERE_MODEL`, `COHERE_EMBEDDING_MODEL`, `OCI_*`) y sincronización con `.env.example`. |
| **2. Coexistencia de Orquestadores** | 🟢 Clarificado | `backend/app/agentes/generacion_paralela.py` se consolidó como el motor principal de producción (alta velocidad y RAG en contexto), manteniendo `orquestador.py` (LangGraph determinista con ciclo reflexivo) como respaldo formal validado por la suite de pruebas. |
| **3. CORS Permisivo** | 🟢 Resuelto | Se eliminó la directiva global `["*"]`. `backend/app/main.py` restringe los orígenes al frontend en desarrollo (`5173`), API (`8000`) y el dominio de producción mediante Cloudflare Tunnel. |
| **4. Ingesta sin Restricción de Archivos** | 🟢 Resuelto | Implementación de límite de carga (`MAX_BYTES_ARCHIVO = 15 MB`), sanitización de cabeceras en PDFs con `pypdf`, validación de extensiones permitidas (.pdf, .md, .txt) y umbral mínimo de 40 caracteres. |
| **5. Persistencia y Comportamiento de Fallback** | 🟢 Resuelto | Implementación de `almacenador_resiliente` y `private_storage.py`, priorizando OCI Object Storage Always Free y cayendo transparentemente a `data/outputs/` sin lanzar excepciones no controladas al usuario. |
| **6. Diferencias entre Documentación y Código** | 🟢 Resuelto | Documentación reescrita reflejando la arquitectura real React 19 + Vite, contratos Pydantic v2, endpoints reales y guías operativas en `docs/` y `backend/docs/`. |
| **7. Versiones y Dependencias de Entorno** | 🟢 Resuelto | Fijación estricta de entorno en Python 3.12 y Node.js 18+, dependencias unificadas en `requirements.txt` y validación de sintaxis en CI. |
| **8. Observabilidad y Diagnóstico** | 🟢 Resuelto | Logs estructurados con timestamps, enmascaramiento de correos, endpoints de healthcheck desacoplados (< 10 ms) y scripts de diagnóstico operativo. |
| **9. Timeout 524 de Cloudflare en Peticiones Largas** | 🟢 Resuelto | Implementación del canal de streaming SSE (`/api/v1/adaptar/stream`) con latidos anti-timeout cada 15 segundos y entrega progresiva de recursos al frontend. |
| **10. Auditoría de Calidad y Citas Documentales** | 🟢 Resuelto | Fact-checking con Google Gemini 2.5 Flash y verificación determinista en Python (`fuentes.py`) de la existencia real de las citas en el documento original. |
| **11. Concurrencia y No-Bloqueo del Event Loop** | 🟢 Resuelto | Desacople de inferencias pesadas mediante `asyncio.to_thread` y protección de memoria en OCI (1 GB RAM) con `asyncio.Semaphore(5)` y semáforos por modelo. Comprobado con 137 RPS y 9.27 ms de latencia en `/health` bajo estrés. |


## 2. Validación Operativa Realizada

- **Suite de Pruebas Automatizadas:** 300 pruebas ejecutadas mediante pytest en backend: **300 passed (100% de éxito)** y 26 pruebas en frontend (`vitest`).
- **Validación E2E en Vivo con Apache Kafka (`apache_kafka_introduction.md`):** Indexación de 12 fragmentos, generación de 7 flashcards y 27 afirmaciones auditadas con Score de Anclaje de 1.0 (100% fidelidad, 0 alucinaciones).
- **Benchmark de Concurrencia (`scripts/prueba_estres.py`):** 137.24 RPS en `/health`, 144.32 RPS en opciones y 0% congelamiento de Event Loop durante inferencias de 71 segundos (memoria contenida en ~172 MB).
- **Despliegue en Producción OCI (`novamind.techgk.cl`):** Respuesta E2E verificada a través de Cloudflare Tunnel y Nginx con persistencia en OCI Object Storage.
- **Saneamiento de Credenciales:** Historial de Git purgado con `git-filter-repo` y exclusión total de secretos en `.gitignore`.
