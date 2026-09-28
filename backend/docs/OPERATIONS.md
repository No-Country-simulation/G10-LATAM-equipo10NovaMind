# Operación, observabilidad y mantenimiento

## Logs
`main.py` configura logging con nivel INFO y formato timestamp, nivel, logger y mensaje. Los módulos backend usan loggers nombrados para backend, almacenamiento y cliente. Se registran inicio/finalización de orquestación, duración y errores de persistencia.

## Healthcheck
`GET /health` devuelve `{"status":"ok","service":"nuevamente-backend"}`. Es un chequeo básico de disponibilidad HTTP; no prueba dependencias externas.

## Diagnóstico frecuente
- **Falta `COHERE_API_KEY`:** revisar `.env`, el directorio de ejecución y la carga de `python-dotenv`.
- **No conecta el frontend:** revisar `BACKEND_URL` o `BACKEND_API_URL`, host/puerto y estado de `/health`.
- **No se extrae texto PDF:** el extractor usa `pypdf`; PDF escaneado sin capa textual requiere OCR externo, que no se observa implementado.
- **Sin resultados RAG:** confirmar ruta/colección Chroma, documento indexado, filtros y umbral de recuperación.
- **Error OCI:** revisar namespace, bucket, perfil/archivo de configuración y permisos de Object Storage; el flujo puede caer a almacenamiento local en determinados endpoints.
- **Paquete no encontrado:** verificar `data/outputs/contenidos_generados` y el identificador solicitado.

## Mantenimiento
1. Respaldar datos Chroma y salidas locales con el servicio detenido o con procedimiento consistente.
2. No borrar el índice vectorial sin evaluar impacto sobre documentos ya indexados.
3. Revisar cambios en esquemas Pydantic y sincronizar opciones frontend/backend.
4. Mantener dependencias, ejecutar pruebas y revisar avisos de seguridad.
5. Definir retención para documentos originales y paquetes.
6. Verificar logs y espacio en disco; no se identificó un sistema de métricas/alertas integrado.

## Incidentes
No se encontró un runbook de producción ni una política de recuperación ante desastres formal. Definir responsables, severidades, backups, RPO/RTO y procedimiento de rollback antes de operar en producción.
