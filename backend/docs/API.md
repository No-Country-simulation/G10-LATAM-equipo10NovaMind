# Referencia de API

**Framework:** FastAPI. **Versión declarada:** `2.6.0`. No se observó prefijo global para `/health`; el resto de endpoints funcionales usa `/api/v1`.

## Resumen de endpoints

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/health` | Healthcheck de proceso de alta velocidad (< 5 ms) |
| GET | `/api/v1/config/opciones` | Opciones canónicas para perfiles, formatos, nichos y niveles |
| POST | `/api/v1/adaptar` | Generar material educativo desde archivo o texto (REST síncrono) |
| POST | `/api/v1/adaptar/stream` | Generar material educativo con streaming Server-Sent Events (SSE) y heartbeats anti-timeout |
| POST | `/api/v1/narracion/generar` | Sintetizar locución de microclase audiovisual (ElevenLabs / Gemini TTS) con control de cuota |
| GET | `/api/v1/narracion/archivo/{ruta:path}` | Descargar audio MP3 o guion privado del propio usuario autenticado |
| POST | `/api/v1/dossier/enviar-correo` | Despacho asíncrono en segundo plano del dossier PDF estandarizado |
| GET | `/api/v1/paquetes` | Listar paquetes guardados (OCI / local) |
| GET | `/api/v1/paquetes/{objeto_id:path}` | Descargar paquete JSON por identificador/ruta de objeto |

## `GET /health`
Respuesta `200`:
```json
{"status":"ok","service":"nuevamente-backend"}
```
Es un healthcheck de proceso; no verifica por sí mismo conectividad con Cohere, Chroma u OCI.

## `GET /api/v1/config/opciones`
Respuesta `200` con listas `perfiles_destinatario`, `formatos_salida`, `nichos_sector` y `niveles_detalle`. Valores canónicos definidos en `backend/app/core/schemas.py` y `main.py`:
- **Perfiles:**
  - `Principiante / Transición de Carrera`
  - `Desarrollador Junior / Semi Senior`
  - `Líder Técnico / Arquitecto`
  - `Gestor / Ejecutivo (No Técnico)`
- **Formatos:**
  - `Paquete Educativo Completo (5 Estaciones)`
  - `Guía Práctica Paso a Paso (Tutorial)`
  - `Flashcards`
  - `Quiz Interactivo con Justificaciones`
  - `Resumen Ejecutivo (TL;DR)`
  - `Guion de Clase / Video`
- **Nichos sectoriales (11 sectores canónicos en `DIRECTIVAS_NICHO_SECTOR`):**
  - `Tecnología e Informática`
  - `Medicina y Salud`
  - `Ingeniería y Construcción`
  - `Finanzas y Contabilidad`
  - `Administración y Negocios`
  - `Marketing y Ventas`
  - `Leyes y Legal`
  - `Educación y Academia`
  - `Ciencias e Investigación`
  - `Industria y Operaciones`
  - `General`
- **Niveles de detalle:**
  - `Didáctico` (analogías, metáforas cotidianas, un concepto a la vez)
  - `Intermedio` (equilibrio entre claridad y rigor)
  - `Profundo` (sintaxis exacta, flags de comandos, diseño de arquitectura)

## `POST /api/v1/adaptar`
**Content-Type:** `multipart/form-data`. No requiere autenticación en el código revisado.

Campos:
| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `archivo` | archivo | No* | PDF, MD/Markdown o TXT |
| `texto_directo` | string | No* | Texto alternativo de entrada |
| `documento_contenido` | string | No* | Alias canónico de `texto_directo` (interoperabilidad de esquemas) |
| `titulo` | string | No | Título del documento |
| `perfil_destinatario` | string | Sí | Perfil pedagógico |
| `formato_salida` | string | Sí | Formato deseado |
| `nicho_sector` | string | No | Predeterminado `General` |
| `nivel_detalle` | string | No | Predeterminado `Didáctico` |
| `tema_consulta` | string | No | Foco opcional de búsqueda |

*Debe proporcionarse archivo no vacío o `texto_directo`/`documento_contenido` no vacío. El esquema de solicitud exige al menos 40 caracteres de contenido. Los valores se normalizan mediante alias y validaciones Pydantic.

Ejemplo con texto:
```bash
curl -X POST http://localhost:8000/api/v1/adaptar \
  -F 'texto_directo=La arquitectura de software organiza componentes y responsabilidades. Un sistema distribuido coordina servicios mediante contratos.' \
  -F 'titulo=Introducción a arquitectura' \
  -F 'perfil_destinatario=Principiante' \
  -F 'formato_salida=Flashcards' \
  -F 'nicho_sector=General' \
  -F 'nivel_detalle=Didáctico'
```

Ejemplo Python:
```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/adaptar",
    data={
        "texto_directo": "La arquitectura de software organiza componentes y responsabilidades. Un sistema distribuido coordina servicios mediante contratos.",
        "titulo": "Introducción a arquitectura",
        "perfil_destinatario": "Principiante",
        "formato_salida": "Flashcards",
        "nicho_sector": "General",
        "nivel_detalle": "Didáctico",
    },
    timeout=180,
)
response.raise_for_status()
print(response.json())
```

Respuestas y errores observados:
- `200`: objeto `RespuestaAdaptacion` con `status`, metadatos, contenido, evaluación de calidad, almacenamiento, métricas y/o datos de error según el esquema.
- `400`: falta archivo/texto, archivo vacío o error de ingesta.
- `422`: errores de validación de la solicitud o campos requeridos.
- `500`: configuración incompleta del orquestador u otros errores no controlados.

La respuesta exitosa puede indicar `exito` o `exito_con_advertencias`; las estructuras exactas están definidas en `backend/app/core/schemas.py`.

## `POST /api/v1/adaptar/stream` (Streaming SSE & Heartbeat Anti-Timeout)
**Content-Type:** `multipart/form-data`. **Accept:** `text/event-stream`.

Diseñado específicamente para evitar el **Error 524 (Timeout de 100 segundos)** de Cloudflare y alimentar interfaces reactivas con publicación incremental en tiempo real:

### Eventos emitidos en el stream (`modo_rag=paralelo`):
1. `event: inicio\ndata: {"status": "iniciando", "titulo": "..."}\n\n`: Metadatos iniciales del documento.
2. `event: tarea\ndata: {"tarea": "B1", "estado": "en_curso", "modelo": "gemini-3.5-flash-lite"}\n\n`: Estado de avance de las subtareas (`A`, `B1`, `B2`, `C` —el cuestionario, que empieza cuando terminan las otras tres— y `auditoria`).
3. `event: recurso\ndata: {"recurso": "resumen", "estado": {"estado": "completado"}, "campos": {...}}\n\n`: Publicación inmediata de cada recurso en cuanto está listo (~7-8s para flashcards/tutorial), desbloqueando las estaciones pedagógicas progresivamente sin esperar al paquete completo.
4. `event: auditoria\ndata: {"auditoria_ejecutada": true, "anclaje_fuente_score": 0.95, "verificacion": {...}}\n\n`: Veredicto de auditoría fáctica cruzada de citas y afirmaciones (Groq).
5. `event: error\ndata: {"recurso": "guion", "error_codigo": "timeout"}\n\n`: Aislamiento de fallo: un recurso fallido se notifica sin derribar el resto del paquete ni usar contenido inventado.
6. `: ping - heartbeat anti-timeout 100s\n\n`: Comentario SSE periódico (cada 15 segundos) que mantiene activa la conexión TCP a través de proxies intermedios (Cloudflare / Nginx).

### Ejemplo con curl:
```bash
curl -N -X POST http://localhost:8000/api/v1/adaptar/stream \
  -F 'texto_directo=Texto técnico de prueba para adaptación pedagógica con streaming...' \
  -F 'perfil_destinatario=Principiante' \
  -F 'formato_salida=Paquete Educativo Completo (5 Estaciones)' \
  -F 'nicho_sector=General' \
  -F 'nivel_detalle=Didáctico'
```

---

## `POST /api/v1/narracion/generar` (Síntesis Audiovisual y Control de Cuota)
**Content-Type:** `application/json`.
**Cabecera opcional:** `Authorization: Bearer <supabase_jwt>` (si se omite, opera en modo invitado sin persistencia OCI).

Genera la locución de la microclase audiovisual (Estación 4 · Contenido AudioVisual) mediante síntesis de voz bajo demanda con ElevenLabs o Gemini TTS, vinculando opcionalmente imágenes legales de Wikimedia/Openverse.

### Parámetros de entrada (`SolicitudNarracion`):
```json
{
  "video_job_spec": {
    "titulo": "Microclase de Arquitectura",
    "escenas": [
      {
        "numero": 1,
        "texto_locucion": "Una arquitectura distribuida desacopla responsabilidades...",
        "duracion_estimada_s": 8.0,
        "prompt_visual": "Servidores conectados en red con luces azules estilo cyberpunk",
        "palabras_clave": ["servidores", "red"]
      }
    ]
  },
  "voz": "Adam",
  "buscar_fotos": false,
  "audio_en_respuesta": false
}
```

### Reglas y Límites de Cuota:
- **Protección Preventiva (`exceso_guion_narracion`):** Si el guion total supera **173 palabras** (límite para 60 s a 165 ppm) o **1.730 caracteres**, el backend rechaza la solicitud de inmediato con código HTTP **422** y `error_codigo="guion_largo"`. No se consumen créditos externos.
- **Ajuste Inteligente (`_ajustar_guion`):** El generador incorpora poda semántica con LLM para recortar guiones largos al rango ideal de 110–125 palabras antes de la síntesis.
- **Presupuestos y Plazos:** Timeout de llamada a ElevenLabs de **25 segundos** y plazo máximo de síntesis de voz `PLAZO_VOZ_S = 80s`. Si ElevenLabs se agota o falla, conmuta a Gemini TTS (`VozGemini`) o instruye al frontend para degradar a la voz nativa del navegador (`SpeechSynthesis`).
- **Respuesta `200` (`RespuestaNarracion`):** Retorna `duracion_total_s` (≤ 60s), array de `escenas` enriquecidas con URLs de audio/fotos, y `advertencias` de proveniencia honesta si se usó voz de respaldo o del navegador.

---

## `GET /api/v1/narracion/archivo/{ruta:path}`
Descarga el audio MP3 o guion persistido en el bucket privado de OCI.
- Exige autenticación (`Authorization: Bearer <token>`).
- Valida estrictamente que la ruta pertenezca al prefijo `users/{user_id}/narraciones/...` del usuario autenticado; nunca expone URLs públicas del bucket.

---

## `POST /api/v1/dossier/enviar-correo`
Despacha en segundo plano (`BackgroundTasks`) el dossier PDF formal compilado con ReportLab que reúne las estaciones 1, 2, 3 y 5 del paquete educativo, adjuntándolo o enviando enlace seguro de descarga.

---

## Control de Concurrencia y Resiliencia 429
- **Semáforo Global de Inferencia (`_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(5)`):** Concurrencia de hasta 5 peticiones paralelas en FastAPI, evitando encolamientos mayores a 10s.
- **Semáforos por Modelo de Respaldo (`GEMINI_CONCURRENCIA_POR_MODELO=2`):** Limita a 2 las llamadas concurrentes compartidas en todo el proceso para cada modelo de respaldo de Gemini cuando el primario se satura.
- **Cliente Gemini Asíncrono (`_GEMINI_MAX_CONCURRENCIA=4`):** Centraliza la cuota de Google AI Studio compartida a nivel de proyecto.
- **Memoria de Modelos Agotados (Fail-Fast):** Errores 429 de `cuota_diaria` inhabilitan el modelo en memoria del proceso hasta la medianoche del Pacífico (07:00/08:00 UTC), conmutando en < 1 ms al respaldo.
- **Aislamiento de Caché de Invitados (`_REGISTRO_INVITADOS`):** Caché en memoria LRU de hasta 200 filas (`RegistroMemoria`) que aísla las huellas criptográficas por sesión y hash de documento para evitar filtraciones de datos entre invitados.

---

## `GET /api/v1/paquetes`
Devuelve `{"origen":"oci"|"local","paquetes":[...]}`. En modo local cada elemento incluye nombre, tamaño en bytes y marca temporal derivada del archivo. La lista OCI contiene nombre, tamaño y fecha de creación. Si OCI falla, el código continúa con listado local.

## `GET /api/v1/paquetes/{objeto_id:path}`
Devuelve el JSON del paquete. En modo local busca el nombre final dentro de `data/outputs/contenidos_generados`; si no existe, responde `404` con `Paquete no encontrado.`. En OCI intenta descargar el objeto y decodificar JSON; ante excepción, prueba el respaldo local.

---

## CORS y Conectividad Frontend
FastAPI implementa `CORSMiddleware` configurado con orígenes y regex para desarrollo local y producción:
- **Orígenes autorizados:**
  - `http://localhost:5173` y `http://127.0.0.1:5173` (Frontend React 19 + Vite)
  - `http://localhost:8501` y `http://127.0.0.1:8501` (Dashboard auxiliar)
  - `http://localhost:8000` y `http://127.0.0.1:8000` (Swagger UI y self-calls)
- **Regex tolerante a puertos locales:** `^https?://(localhost|127\.0\.0\.1)(:\d+)?$`
- **Cabeceras y métodos:** `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True`.

---

## Autenticación, Seguridad y Privacidad
1. **Modo Invitado:** Si la petición omite la cabecera `Authorization`, opera en memoria sin registrar al usuario ni almacenar sus documentos en la base de datos relacional.
2. **Modo Autenticado:** Con `Authorization: Bearer <token_supabase>`, el backend extrae `principal.user_id = auth.uid()` y aplica Row Level Security (RLS) en Supabase (`documents`, `generation_tasks`).
3. **Privacidad de LLM:** Todas las llamadas a Gemini se emiten con `store: false` para impedir el almacenamiento y entrenamiento con datos del usuario.


