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
- **Resultado:** 🟢 **65 pasadas, 0 fallidas (100% de éxito)**.
- **Tiempo de ejecución:** ~10 a 13 segundos.

### Distribución de los 65 Tests:
1. **`backend/tests/test_api.py` (6 pruebas):**
   - Healthcheck `/health` y opciones canónicas `/api/v1/config/opciones`.
   - Ingesta multipart con archivo y texto directo en `/api/v1/adaptar`.
   - Listado de paquetes guardados `/api/v1/paquetes`.
   - Manejo adecuado de errores HTTP 404 ante objetos inexistentes en descarga.
2. **`backend/tests/test_integracion_offline.py` (3 pruebas):**
   - Ejecución del pipeline LangGraph de inicio a fin con agentes y embeddings simulados.
   - Verificación de reutilización del índice ChromaDB ante documentos ya indexados.
   - Activación y verificación del ciclo reflexivo de reintentos ante rechazo inicial de calidad.
3. **`backend/tests/test_orquestador.py` (56 pruebas):**
   - Validación del umbral de calidad pedagógica (`anclaje_fuente_score >= 0.70`).
   - Normalización exhaustiva de alias de perfiles y formatos.
   - Inyección correcta de few-shots según formato pedagógico solicitado.
   - Control de lotes de embeddings para llamadas seguras a Cohere (máx. 96 chunks por lote).
   - Manejo de caídas transitorias de API mediante backoff exponencial.

## Validación End-to-End (E2E) en Navegador y Producción OCI
1. **Prueba Local Fullstack:** Conexión de React 19 (puerto 5173) con FastAPI (puerto 8000), Cohere y OCI Object Storage Always Free:
   - **Documento:** `apache_kafka_introduction.md`
   - **Perfil:** `profesional_tecnico` | **Formato:** `flashcards_estudio`
   - **Fidelidad RAG:** Score de anclaje de **1.00 (100% de afirmaciones verificadas)**.
   - **Persistencia OCI:** Completada en el bucket `nuevamente-contenidos-educativos`.
2. **Prueba HTTP en Producción Cloud (`https://novamind.techgk.cl/api/v1/adaptar`):**
   - **Resultado:** HTTP 200 OK en **9.51 segundos totales (8.86 s backend)**.
   - **Flujo E2E:** Tráfico perimetral por Cloudflare Tunnel ➔ Nginx (VM 2) ➔ VCN Privada ➔ FastAPI Uvicorn (VM 1) ➔ LangGraph ➔ OCI Object Storage.
   - **Persistencia en Nube:** Verificada en el bucket `nuevamente-contenidos-educativos` (objeto `doc-d790da6b5068ee2e-...`).

