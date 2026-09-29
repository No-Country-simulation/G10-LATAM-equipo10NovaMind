# Operación, observabilidad y mantenimiento

## Logs
`main.py` configura logging con nivel INFO y formato timestamp, nivel, logger y mensaje. Los módulos backend usan loggers nombrados para backend, almacenamiento y cliente. Se registran inicio/finalización de orquestación, duración y errores de persistencia.

## Healthcheck
`GET /health` devuelve `{"status":"ok","service":"nuevamente-backend"}`. Es un chequeo básico de disponibilidad HTTP; no prueba dependencias externas.

## Diagnóstico Frecuente
- **Falta `COHERE_API_KEY`:** revisar `.env`, el directorio de ejecución y la carga de variables.
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
   Ejecutar `pytest backend/tests -v` tras cualquier actualización de código para asegurar que los 65 tests de regresión continúen en verde.
4. **Respaldos de Datos:**
   Respaldar periódicamente las salidas en `data/outputs/` y el directorio `data/chroma/` con el servicio detenido.

## Incidentes
Para entornos de demostración y desarrollo local, los incidentes comunes se resuelven mediante el script de restablecimiento y reiniciando con `iniciar_local.bat`. Para entornos de producción, se recomienda configurar monitoreo de systemd (`deploy/systemd/`) y alertas de consumo en la consola de Oracle Cloud.

