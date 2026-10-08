# Operación, observabilidad y mantenimiento

## Logs
`main.py` configura logging con nivel INFO y formato timestamp, nivel, logger y mensaje. Los módulos backend usan loggers nombrados para backend, almacenamiento y cliente. Se registran inicio/finalización de orquestación, duración y errores de persistencia.

## Healthcheck
`GET /health` devuelve `{"status":"ok","service":"nuevamente-backend"}`. Gracias al desacople asíncrono con `asyncio.to_thread()`, responde de forma inmediata (< 5 ms) incluso mientras el motor de agentes ejecuta una adaptación pedagógica pesada.

## Diagnóstico Frecuente
- **Falta `COHERE_API_KEY` o `GEMINI_API_KEY`:** revisar `.env`, el directorio de ejecución y la carga de variables. Si falta la clave de Gemini, el sistema recurre automáticamente a Groq o Cohere.
- **Timeout 524 de Cloudflare en peticiones largas (>100s):** Utilizar el endpoint de streaming `POST /api/v1/adaptar/stream` con Server-Sent Events. En el proxy Nginx de la VM 2, asegurar `proxy_buffering off;` y `proxy_read_timeout 180s;`.
- **Agotamiento de memoria en OCI Always Free (1 GB RAM):** Uvicorn debe ejecutarse con **1 worker** (`~98.5 MB RAM`) y el semáforo `asyncio.Semaphore(1)` activo. Monitorear con `free -h` y `journalctl -u nuevamente-backend.service`.
- **No conecta el frontend React con el backend:** verificar que FastAPI esté corriendo en el puerto 8000 y que `/health` responda HTTP 200. Verificar que el frontend consulte a `http://localhost:8000`.
- **Error CORS:** verificar que el origen del frontend (ej: `http://localhost:5173`) esté incluido en `CORSMiddleware` en `backend/app/main.py`.
- **No se extrae texto PDF:** el extractor usa `pypdf` con sanitización de cabeceras; PDFs escaneados sin capa de texto seleccionable requieren OCR previo.
- **Sin resultados RAG o anclaje bajo:** confirmar ruta y colección de ChromaDB (`nuevamente_documentos`), que el texto ingresado tenga más de 40 caracteres y revisar la similitud del contenido con el tema consultado.
- **Error OCI:** ejecutar `python scripts/test_oci_conexion.py` para validar conexión, namespace, bucket y credenciales. Recordar que si OCI falla, el sistema activa automáticamente el fallback local sin lanzar excepción al usuario.
- **Paquete no encontrado (404):** verificar que el `objeto_id` solicitado exista en el bucket OCI o en `data/outputs/contenidos_generados/`.

## Mantenimiento y Herramientas Operativas
1. **Restablecer a Estado Cero (Zero-State):**
   Ejecutar `.\reestablecer_local.bat` (o `python scripts/reestablecer_local.py`) para purgar de manera segura las colecciones temporales de ChromaDB y los archivos de prueba en `data/outputs/`.
2. **Diagnóstico de Conectividad Cloud OCI:**
   Ejecutar `python scripts/test_oci_conexion.py` para realizar una prueba end-to-end de autenticación, lectura de namespace y subida/descarga de un objeto de prueba.
3. **Verificación de Pruebas Automatizadas:**
   Ejecutar `pytest backend/tests -v` tras cualquier actualización de código para asegurar que los **70 tests de regresión** continúen en verde.
4. **Prueba de Estrés y Rendimiento Concurrente:**
   Ejecutar `python scripts/prueba_estres.py` para evaluar el throughput (>130 RPS), la latencia percentil p95 y certificar la ausencia de congelamiento del event loop durante inferencias pesadas.
5. **Certificación End-to-End con Documento Real:**
   Ejecutar `python scripts/test_kafka_e2e.py` para validar en vivo la orquestación completa con `data/documents/apache_kafka_introduction.md`.
6. **Respaldos de Datos:**
   Respaldar periódicamente las salidas en `data/outputs/` y el directorio `data/chroma/` con el servicio detenido.

## Incidentes
Para entornos de demostración y desarrollo local, los incidentes comunes se resuelven mediante el script de restablecimiento y reiniciando con `iniciar_local.bat`. Para entornos de producción, se recomienda configurar monitoreo de systemd (`deploy/systemd/`) y alertas de consumo en la consola de Oracle Cloud.

