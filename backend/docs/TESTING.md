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
- **Resultado al 14/10/2026:** 🟢 **300 pasadas en backend** (`cd backend && ../.venv/Scripts/python -m pytest -q`) **y 26 en frontend** (`cd frontend && npm test`), con `npx tsc --noEmit -p .` limpio. El número cambia con cada bloque: la cifra válida es la que da el comando.
- **Tiempo de ejecución:** ~25 a 35 segundos el backend; menos de 1 s el frontend.

### Distribución original (fase 9, 70 tests):
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


### Actualización de Cobertura (Fase 22 · Cuotas de Voz, Poda de Guion y Nichos):
La suite ha crecido hasta 288 pruebas backend y 26 pruebas frontend:
- **Control de Longitud y Ajuste de Guion:** Verificación de `exceso_guion_narracion` bloqueando guiones >173 palabras o >1730 caracteres con HTTP 422 (`guion_largo`), y validación de poda semántica asistida (`_ajustar_guion`) acotando la locución al rango pedagógico de 110–125 palabras.
- **Resiliencia Gemini 429 y Semáforos:** `test_servicio_gemini.py` (18 pruebas) y `test_generacion_paralela.py` (24 pruebas) para clasificación de cuota diaria/minuto, fail-fast hasta medianoche PST, y semáforo de concurrencia `GEMINI_CONCURRENCIA_POR_MODELO=2`.
- **Frontend React 19 (`npm test`):** 26 pruebas unitarias aprobadas que cubren plegado de eventos SSE (`paqueteIncremental.test.ts`), cálculo de tiempos de locución (`duracionLocucion.test.ts`) y extracción de prompts visuales (`promptVisual.test.ts`).

### Actualización de cobertura (fase 23 · procedencia honesta):
- **Visor de fuente:** `contexto_de_cita` devuelve el fragmento literal (con ligaduras), no cruza de página y corta en palabras completas; una cita ausente devuelve `None`. Las citas verificadas del resumen y del guion llevan su contexto y las no verificadas no (`test_contexto_documental.py`, `test_generacion_paralela.py`).
- **Bloques de código:** una cita que une una frase con su comando coincide tanto si omite la marca ```` ```bash ```` como si la copia en la línea; la etiqueta sola («bash») o un comando cambiado siguen sin coincidir.
- **Nicho:** el límite del sector va en las instrucciones solo con un nicho distinto de General, y el guion lo admite como mucho en una escena.
- **Correo:** dirección enmascarada en los logs, error SMTP sin la dirección y recibo con la ruta OCI real. Ningún test sube a OCI: el cliente se sustituye en un fixture `autouse`.

### Prueba de nichos (`pruebas_nichos/`, fuera del repositorio, gasta cuota de Gemini):
Script `prueba_nichos.py` (con `--seco` no hace llamadas) que genera el mismo documento (guía de swap, perfil Principiante, nivel Didáctico) con General ×2, Medicina, Leyes y Finanzas, sin Groq ni ElevenLabs. Mide el léxico de cada sector por mil palabras (sin contar las citas), el parecido entre textos (Jaccard) y las citas verificadas.
- **1.ª corrida (11:05):** cada nicho sube el léxico de su sector muy por encima de General (Medicina +4,9, Leyes +5,2 y Finanzas +12,2 por mil). La revisión manual encontró que el sector se colaba en afirmaciones sobre el documento, sobre todo en el guion narrado. Se corrigió el prompt.
- **2.ª corrida (12:02, prompt corregido):** la introducción y el guion describen el documento tal como es y el sector queda en las analogías; la señal sigue clara (Medicina +5,1, Leyes +5,2 y Finanzas +4,0). Con el mismo verificador, las citas únicas verificadas pasan de 91,3 % a 94,4 %. En Medicina, Google devolvió timeout y 503 en la tarea B2 y esos recursos salieron como fallidos, sin relleno.
- **Límites:** es una corrida por nicho, así que sirve como indicio y no como medida estadística. Falta una 3.ª corrida para confirmar que el sector aparece en una sola escena del guion.

## Validación End-to-End (E2E) Real con `apache_kafka_introduction.md`
Certificación en vivo contra el documento técnico oficial de Kafka (11.052 caracteres):
- **Indexación RAG:** 12 chunks semánticos indexados en **1.28 s** (ChromaDB + Cohere `embed-multilingual-v3.0`).
- **Recuperación:** 3 chunks clave recuperados en **0.52 s**.
- **Redacción pedagógica:** 7 Flashcards interactivas generadas en **21.93 s** con analogías didácticas (Cohere `command-r-08-2024`).
- **Auditoría RAG:** 27 afirmaciones técnicas evaluadas punto por punto con Google Gemini 2.5 Flash en **23.80 s**.
- **Fidelidad RAG:** Score de anclaje de **1.0 (100% de afirmaciones verificadas, 0 alucinaciones)**.
- **Claridad Pedagógica:** **Alta**.
- **Persistencia OCI:** Completada (`status_upload: completado`) en el bucket `nuevamente-contenidos-educativos`.

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

