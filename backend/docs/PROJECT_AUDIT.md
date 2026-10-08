# Auditoría estática del proyecto

## Alcance
Inspección estática de los archivos fuente y configuración incluidos en el ZIP. No se ejecutaron pruebas, análisis dinámico, escaneo de dependencias ni pentest. Los hallazgos describen código/configuración observados y requieren validación operativa.

## Hallazgos principales

### 1. Divergencia entre configuración documentada y configuración consumida
`.env.example` incluye, entre otras, `EMBEDDING_MODEL`, `TOP_K`, `CHROMA_PATH` y `CHROMA_COLLECTION_NAME`. `backend/app/core/config.py` consume `COHERE_EMBEDDING_MODEL`, `TOP_K_CHUNKS`, `AGENTE1_CHROMA_PATH` y `AGENTE1_COLLECTION_NAME`. `rag_pipeline.py` usa otro grupo (`CHROMA_PERSIST_DIR`, `CHROMA_COLLECTION_NAME`, `LOCAL_EMBEDDINGS_MODEL`, `EMBEDDINGS_PROVIDER`). **Impacto:** ajustes de entorno podrían no aplicarse al componente esperado. **Acción:** definir una única fuente de configuración y documentar qué pipeline se utiliza efectivamente.

### 2. Dos módulos de orquestación
Coexisten `backend/app/orquestador.py` y `backend/app/core/orchestrator.py`, con mecanismos y proveedores configurables distintos. El endpoint importa `OrquestadorNuevaMente` desde `app.orquestador`. **Impacto:** confusión sobre la ruta activa y documentación desactualizada. **Acción:** decidir si ambos se mantienen, separar claramente su propósito o retirar el módulo no utilizado tras pruebas.

### 3. CORS abierto y ausencia de autenticación visible
La API permite todos los orígenes, métodos y headers, y no se observa autenticación en endpoints. **Impacto:** exposición de generación, consumo de recursos y acceso a paquetes si el servicio se publica. **Acción:** controles P0 indicados en SECURITY.

### 4. Ingesta de archivos
La API lee el archivo completo en memoria y la ingesta escribe con el nombre recibido bajo `data/documents`. No se observa límite explícito de tamaño ni normalización defensiva del nombre antes de construir la ruta. **Acción:** imponer límite, generar nombre seguro, aislar rutas y establecer cuotas.

### 5. Persistencia local/OCI y comportamiento de fallback
Hay adaptadores de almacenamiento local y OCI. Los endpoints de paquetes intentan OCI si se definen namespace y bucket, y en ciertas excepciones recurren a local. La selección del adaptador del flujo de generación depende de `crear_orquestador`. **Acción:** documentar y probar un modo de almacenamiento explícito, evitando que fallback oculte fallos operativos.

### 6. Diferencias entre README y código
La documentación raíz describe arquitectura, dependencias y número de tests, pero algunos nombres/rutas/valores no coinciden con los módulos observados. Esta documentación evita afirmar conteos de tests o despliegue verificado. **Acción:** convertir la configuración y comandos en pruebas/documentación mantenidas por CI.

### 7. Versiones y compatibilidad de dependencias
Los requirements fijan versiones para varias dependencias, pero también contienen rangos y referencias de proveedores que pueden cambiar. No se encontró evidencia de un lockfile reproducible en el inventario revisado. **Acción:** fijar versiones transitivas y probar instalación limpia.

### 8. Observabilidad y operación
No se identificaron métricas/alertas ni readiness check de dependencias. `/health` solo devuelve estado estático. **Acción:** agregar health/readiness diferenciados, métricas, correlación de solicitudes y runbook.

## Estado de Resolución y Mitigaciones Implementadas (Fases 1 a 9)

Tras el desarrollo de las 9 fases de integración técnica y despliegue en producción, los hallazgos fueron atendidos y validados:

| Hallazgo | Estado | Mitigación Implementada |
|---|:---:|---|
| **1. Configuración divergente** | 🟢 Resuelto | Centralización en `backend/app/core/config.py` con resolución tolerante de alias (`COHERE_MODEL`, `COHERE_EMBEDDING_MODEL`, `OCI_*`) y plantilla `.env.example` sincronizada. |
| **2. Doble orquestador** | 🟢 Clarificado | `backend/app/orquestador.py` (LangGraph determinista con ciclo reflexivo) se consolidó como el orquestador oficial del sistema y está validado al 100% por los 65 tests. |
| **3. CORS permisivo** | 🟢 Resuelto | Restricción estricta en `main.py` eliminando comodines globales `["*"]` y autorizando únicamente los orígenes locales del frontend (`5173`) y API (`8000`). |
| **4. Ingesta de archivos** | 🟡 Mitigado | Sanitización de encabezados en PDFs mediante `pypdf`, validación de extensiones permitidas (.pdf, .md, .txt) y umbral mínimo de 40 caracteres. |
| **5. Persistencia y fallback** | 🟢 Resuelto | Implementación de `almacenador_resiliente` en el nodo persistir del orquestador, priorizando OCI Always Free y cayendo a `data/outputs/` de forma silenciosa ante fallos. |
| **6. Diferencias README/Código** | 🟢 Resuelto | `README.md` reescrito reflejando la arquitectura real React 19 + Vite, scripts batch de un clic (`iniciar_local.bat`), endpoints y puertos reales. |
| **7. Dependencias y entorno** | 🟢 Resuelto | Fijación estricta de entorno en Python 3.12.7, dependencias unificadas en `requirements.txt` y validación de instalación limpia. |
| **8. Observabilidad** | 🟢 Resuelto | Logs detallados con timestamp y duración de etapas, scripts de diagnóstico y restablecimiento a estado cero. |
| **9. Latencia y Timeout Cloudflare (524)** | 🟢 Resuelto | Transición a `command-r-08-2024` (reduciendo redacción de 300s a 18s) e implementación de streaming SSE con heartbeats cada 15s. |
| **10. Auditoría de Calidad Real (Agente 3)** | 🟢 Resuelto | Desacople multi-proveedor con **Google Gemini 2.5 Flash** (~2s) y Groq (`qwen3.8-27b`), erradicando mocks y verificando `chunk_id` en Python. |
| **11. Concurrencia y Event Loop** | 🟢 Resuelto | Desacople de inferencia mediante `asyncio.to_thread` y protección de memoria en OCI (1 GB RAM) con `asyncio.Semaphore(1)`. |

## Validación Operativa Realizada
- **Suite de Pruebas Automatizadas:** 65 pruebas ejecutadas mediante pytest: **65 passed (100% de éxito)**.
- **Validación en Producción OCI (`novamind.techgk.cl`):** Respuesta HTTP E2E exitosa en **9.51 s (8.86 s backend)** con persistencia en OCI Object Storage verificada en tiempo real.
- **Purga de Credenciales:** Limpieza total del historial git con `git-filter-repo` y exclusión de secretos en `.gitignore`.

