# Operaciones, Observabilidad y Mantenimiento

## 1. Sistema de Logs y Observabilidad

`backend/app/main.py` configura logging estructurado en la salida estándar con formato:
```
%(asctime)s [%(levelname)s] %(name)s: %(message)s
```
- **Loggers nombrados:** `nuevamente.backend`, `nuevamente.agentes`, `nuevamente.storage`.
- **Privacidad estricta:** Las direcciones de correo se enmascaran automáticamente (`al***@dominio.com`).
- **Métricas registradas:** Se registran inicios y finales de tareas, tiempos de latencia por subtarea (`A`, `B1`, `B2`, `C`), conmutaciones de fallback y estado de subida a OCI.


## 2. Healthcheck y Monitoreo

- **Endpoint:** `GET /health`
- **Comportamiento:** Responde `{"status":"ok","service":"nuevamente-backend"}` en menos de 10 ms (probado empíricamente a 9.27 ms durante cargas pesadas de inferencia de 71 segundos).
- **Desacople:** Gracias a `asyncio.to_thread`, las tareas síncronas de CPU o red pesadas no bloquean el Event Loop de FastAPI.


## 3. Diagnóstico de Incidencias Comunes

| Síntoma | Causa Frecuente | Solución Operativa |
|---|---|---|
| **Error 401 / Falta de clave de IA** | `GEMINI_API_KEY` o `COHERE_API_KEY` no cargada en `.env` | Revisar `.env` en la raíz del proyecto y reiniciar el servicio. |
| **Timeout 524 de Cloudflare (> 100s)** | Conexión HTTP síncrona en documento largo | Usar el endpoint de streaming `/api/v1/adaptar/stream` con SSE. En Nginx verificar `proxy_buffering off;` y `proxy_read_timeout 180s;`. |
| **Agotamiento de RAM en OCI (1 GB)** | Múltiples workers de Uvicorn o semáforos desactivados | Asegurar Uvicorn con `--workers 1` (~98 MB de huella base) y `_SEMAFORO_CONCURRENCIA = 5`. |
| **Error de CORS en navegador** | Origen no registrado en `allow_origins` | Verificar que el frontend consulte a `http://localhost:8000` o añadir el dominio a `backend/app/main.py`. |
| **PDF no extrae texto** | Documento escaneado como imagen pura | El extractor `pypdf` requiere capa de texto seleccionable. Si es imagen, el sistema activa la transcripción multimodal de Gemini con aviso explícito. |
| **Error al subir a OCI Object Storage** | Clave privada desactualizada o bucket público | Correr `python scripts/test_oci_conexion.py`. Recordar que el sistema conmuta automáticamente al fallback local en `data/outputs/` sin interrumpir al usuario. |

## 4. Herramientas y Scripts Operativos

### 1. Restablecimiento a Estado Cero (*Zero-State*)
Para purgar de forma segura las colecciones vectoriales temporales de ChromaDB y los archivos generados de prueba:
```powershell
.\reestablecer_local.bat
# o directamente:
python scripts/reestablecer_local.py
```

### 2. Diagnóstico de Conexión a Oracle Cloud (OCI)
Prueba la autenticación, lectura de namespace y operaciones de lectura/escritura en el bucket privado:
```powershell
python scripts/test_oci_conexion.py
```

### 3. Prueba de Estrés y Concurrencia
Evalúa el rendimiento bajo ráfagas concurrentes, throughput (> 130 RPS) y verifica la ausencia de bloqueo en el event loop:
```powershell
python scripts/prueba_estres.py
```

### 4. Prueba End-to-End con Documento Real
Ejecuta la orquestación completa en vivo con el documento técnico oficial de Apache Kafka (`data/documents/apache_kafka_introduction.md`):
```powershell
python scripts/test_kafka_e2e.py
```

### 5. Verificación de la Suite de Pruebas
```powershell
cd backend
python -m pytest -q
```

---

## 🔗 Navegación
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back)
* 📚 [**Directorio de Guías del Backend**](README.md)
* 🚀 [**Portada del Backend**](../README.md)
