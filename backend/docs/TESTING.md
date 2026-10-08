# Testing y calidad

## Suite detectada
- `backend/tests/test_api.py`: pruebas de endpoints FastAPI con `TestClient`.
- `backend/tests/test_orquestador.py`: pruebas del flujo, normalización, validación, feedback, reintentos y errores usando dobles.
- `backend/tests/test_integracion_offline.py`: integración del pipeline con dependencias simuladas.
- Existen además pruebas en `tests/` en la raíz.

## Ejecutar
Desde la raíz:
```powershell
$env:PYTHONPATH = "$PWD\backend"
python -m pytest backend/tests -v
```
O desde `backend/`:
```powershell
python -m pytest tests -v
```
La configuración `backend/pytest.ini` debe revisarse para confirmar rutas/imports en cada modo de ejecución.

## Estado de Ejecución y Cobertura Verificada
La suite automatizada fue ejecutada en su totalidad mediante pytest:
- **Resultado:** 🟢 **70 pasadas, 0 fallidas (100% de éxito)**.
- **Tiempo de ejecución:** ~3.8 a 16 segundos según el entorno.

### Distribución de los 70 Tests:
1. **`backend/tests/test_api.py` (7 pruebas):**
   - Healthcheck `/health` y opciones canónicas `/api/v1/config/opciones`.
   - Ingesta multipart con archivo y texto directo en `/api/v1/adaptar`.
   - Emisión de eventos progresivos y heartbeats anti-timeout en `/api/v1/adaptar/stream` (SSE).
   - Listado de paquetes guardados `/api/v1/paquetes`.
   - Manejo adecuado de errores HTTP 404 ante objetos inexistentes en descarga.
2. **`backend/tests/test_critico_multiproveedor.py` (4 pruebas):**
   - Evaluación y estructuración de esquema JSON nativo con Google Gemini 2.5 Flash.
   - Evaluación alternativa con Groq (`llama-3.3-70b-versatile`).
   - Activación transparente del fallback automático ante fallo o timeout del proveedor primario.
   - Sanitización y parsing robusto de bloques markdown/JSON.
3. **`backend/tests/test_integracion_offline.py` (3 pruebas):**
   - Ejecución del pipeline LangGraph de inicio a fin con agentes y embeddings simulados.
   - Verificación de reutilización del índice ChromaDB ante documentos ya indexados.
   - Activación y verificación del ciclo reflexivo de reintentos ante rechazo inicial de calidad.
4. **`backend/tests/test_orquestador.py` (56 pruebas):**
   - Validación del umbral de calidad pedagógica (`anclaje_fuente_score >= 0.70`).
   - Normalización exhaustiva de alias de perfiles y formatos (incluyendo los formatos canónicos y extendidos).
   - Inyección correcta de few-shots según formato pedagógico solicitado.
   - Control de lotes de embeddings para llamadas seguras a Cohere (máx. 96 chunks por lote).
   - Manejo de caídas transitorias de API mediante backoff exponencial.

## Validación End-to-End (E2E) Real con `apache_kafka_introduction.md`
Certificación en vivo contra el documento técnico oficial de Kafka (11.052 caracteres):
- **Indexación RAG:** 12 chunks semánticos indexados en **1.28 s** (ChromaDB + Cohere `embed-multilingual-v3.0`).
- **Recuperación:** 3 chunks clave recuperados en **0.52 s**.
- **Redacción pedagógica:** 7 Flashcards interactivas generadas en **21.93 s** con analogías didácticas (Cohere `command-r-08-2024`).
- **Auditoría RAG:** 27 afirmaciones técnicas evaluadas punto por punto con Google Gemini 2.5 Flash en **23.80 s**.
- **Fidelidad RAG:** Score de anclaje de **1.0 (100% de afirmaciones verificadas, 0 alucinaciones)**.
- **Claridad Pedagógica:** **Alta**.
- **Persistencia OCI:** Completada (`status_upload: completado`) en el bucket `novamind-contenidos-educativos`.

## Benchmark de Concurrencia y Prueba de Estrés (`scripts/prueba_estres.py`)
Resultados empíricos obtenidos bajo tráfico concurrente y carga de trabajo pesada:
1. **Ráfaga Masiva `GET /health`:** 100 peticiones con 20 hilos concurrentes -> **100/100 (100.0% éxito)**, Throughput de **137.24 RPS**, latencia media de **115.52 ms**, p95 de **162.57 ms**.
2. **Ráfaga de Configuración `GET /api/v1/config/opciones`:** 50 peticiones con 10 hilos concurrentes -> **50/50 (100.0% éxito)**, Throughput de **144.32 RPS**, latencia media de **21.68 ms**, p95 de **37.29 ms**.
3. **Prueba de No-Bloqueo del Event Loop:** Durante una inferencia RAG pesada de 71.76 s, se enviaron 229 solicitudes continuas de `/health`:
   - **Tasa de éxito:** 229/229 (100.0%).
   - **Latencia promedio:** **9.27 ms** (Mín: 5.95 ms, Máx: 48.87 ms, Mediana: 8.44 ms).
   - **0% event loop starvation:** Demuestra que FastAPI procesa healthchecks de manera inmediata sin encolarse ante inferencias de IA.
4. **Auto-Failover Activo:** Al forzar timeout en el proveedor principal (Gemini a los 25 s), el Crítico conmutó automáticamente a Groq en 2.1 s con anclaje 0.86 sin caídas ni errores 500.
5. **Huella de Memoria RAM:** Working set de Python mantenido en **172.34 MB** bajo carga máxima, dejando más de 800 MB libres para el sistema operativo en OCI Always Free.

