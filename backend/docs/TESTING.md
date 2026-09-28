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

## Cobertura funcional visible en los tests
- Healthcheck y endpoint de opciones.
- Rechazo de solicitudes sin documento y validación de respuesta.
- Aprobación de calidad, reintentos con feedback y advertencias cuando se agota el presupuesto.
- Reutilización de índice y orden narrativo de fragmentos.
- Entradas inválidas, estructura incorrecta y errores transitorios de proveedor.

## Límites
Los tests con agentes falsos no validan el comportamiento real de Cohere, OCI ni los modelos externos. No se generó ni verificó un reporte de cobertura. **No se ejecutaron pruebas durante la elaboración de esta documentación.** Antes de release, ejecutar suite completa y pruebas de integración controladas con servicios reales, además de seguridad y carga.
