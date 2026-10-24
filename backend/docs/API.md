# Referencia de API REST — NuevaMente Backend

**Framework:** FastAPI  
**Versión de API:** `2.0.0`  
**Host por defecto en desarrollo:** `http://127.0.0.1:8000`  
**Documentación interactiva Swagger / OpenAPI:** `http://127.0.0.1:8000/docs`  
**Especificación Redoc:** `http://127.0.0.1:8000/redoc`

---

## Catálogo Resumido de Endpoints

| Método | Ruta | Autenticación | Propósito |
|---|---|:---:|---|
| **GET** | `/health` | Pública | Healthcheck de proceso de alta velocidad (< 10 ms). |
| **GET** | `/api/v1/config/opciones` | Pública | Lista de perfiles, formatos, 11 nichos y 3 niveles de detalle. |
| **POST** | `/api/v1/documentos/extraer` | Pública / Opcional | Extrae texto, páginas y secciones de PDF, MD o TXT sin generar adaptación. |
| **POST** | `/api/v1/adaptar` | JWT / Opcional | Generación educativa síncrona completa en una sola respuesta JSON. |
| **POST** | `/api/v1/adaptar/stream` | JWT / Opcional | Generación incremental vía Server-Sent Events (SSE) con heartbeats. |
| **POST** | `/api/v1/narracion/generar` | JWT Requerido | Sintetiza audio para microclase con ElevenLabs o Gemini TTS. |
| **POST** | `/api/v1/narracion/ampliar` | JWT Requerido | Amplía pedagógicamente una escena específica del guion audiovisual. |
| **GET** | `/api/v1/narracion/archivo/{ruta:path}` | JWT Requerido | Descarga privada de archivo de audio o guion generado por el usuario. |
| **GET** | `/api/v1/paquetes` | JWT Requerido | Lista los paquetes educativos generados por el usuario (OCI / Local). |
| **GET** | `/api/v1/paquetes/{objeto_id:path}` | JWT Requerido | Descarga el paquete JSON completo de un run determinado. |
| **GET** | `/api/v1/documentos/ejemplos` | Pública | Lista la biblioteca de documentos de ejemplo predeterminados. |
| **GET** | `/api/v1/documentos/ejemplos/{nombre_archivo}` | Pública | Obtiene metadatos de un documento de ejemplo. |
| **GET** | `/api/v1/documentos/ejemplos/{nombre_archivo}/texto` | Pública | Obtiene el texto plano completo del documento de ejemplo. |

---

## 1. Endpoints de Diagnóstico y Configuración

### `GET /health`
Verifica el estado del proceso del backend. Diseñado para responder de inmediato incluso mientras se ejecutan tareas pesadas de inferencia en segundo plano.
- **Respuesta `200 OK`:**
```json
{
  "status": "ok",
  "service": "nuevamente-backend"
}
```

### `GET /api/v1/config/opciones`
Devuelve el catálogo canónico de opciones válidas para configurar una solicitud pedagógica:
- **Respuesta `200 OK`:**
```json
{
  "perfiles_destinatario": [
    "Principiante / Transición de Carrera",
    "Desarrollador Junior / Semi Senior",
    "Líder Técnico / Arquitecto",
    "Gestor / Ejecutivo (No Técnico)"
  ],
  "formatos_salida": [
    "Paquete Educativo Completo (5 Estaciones)",
    "Guía Práctica Paso a Paso (Tutorial)",
    "Flashcards",
    "Quiz Interactivo con Justificaciones",
    "Resumen Ejecutivo (TL;DR)",
    "Guion de Clase / Video"
  ],
  "nichos_sector": [
    "Tecnología e Informática",
    "Medicina y Salud",
    "Ingeniería y Construcción",
    "Finanzas y Contabilidad",
    "Administración y Negocios",
    "Marketing y Ventas",
    "Leyes y Legal",
    "Educación y Academia",
    "Ciencias e Investigación",
    "Industria y Operaciones",
    "General"
  ],
  "niveles_detalle": [
    "Didáctico",
    "Intermedio",
    "Profundo"
  ]
}
```


## 2. Ingesta y Extracción

### `POST /api/v1/documentos/extraer`
Extrae el contenido textual y estructural de un archivo sin ejecutar el proceso de generación de materiales.
- **Content-Type:** `multipart/form-data`
- **Parámetros:**
  - `archivo`: `UploadFile` (.pdf, .md, .txt, imagen).
- **Respuesta `200 OK`:**
```json
{
  "titulo": "manual_tecnico.pdf",
  "num_caracteres": 15420,
  "num_palabras": 2350,
  "secciones_detectadas": ["Introducción", "Arquitectura", "Configuración"],
  "paginas": 8,
  "es_transcripcion_ia": false
}
```


## 3. Adaptación Pedagógica

### `POST /api/v1/adaptar`
Genera el paquete pedagógico síncrono.
- **Content-Type:** `multipart/form-data`
- **Cabeceras:** `Authorization: Bearer <jwt_supabase>` (opcional para invitados).
- **Campos del formulario:**
  - `archivo`: Archivo binario opcional (.pdf, .md, .txt).
  - `texto_directo` o `documento_contenido`: Texto plano si no se adjunta archivo (mínimo 40 caracteres).
  - `documento_titulo`: Título o nombre del documento.
  - `perfil_destinatario`: Cadena coincidente con `opciones` o alias admitidos.
  - `formato_salida`: Predeterminado `"Paquete Educativo Completo (5 Estaciones)"`.
  - `nicho_sector`: Uno de los 11 nichos canónicos (predeterminado `"General"`).
  - `nivel_detalle`: `"Didáctico"`, `"Intermedio"` o `"Profundo"`.
  - `modo_rag`: `"paralelo"` (predeterminado), `"vectorless"` o `"clasico"`.
  - `instrucciones_adicionales`: Texto opcional con directivas pedagógicas específicas.
- **Respuesta `200 OK`:** Modelo `RespuestaAdaptacion` que incluye:
  - `status`: `"exito"`, `"exito_con_advertencias"` o `"error"`.
  - `contenido_adaptado`: Objeto JSON con las 5 estaciones pedagógicas completas.
  - `evaluacion_calidad`: Métricas de fidelidad documental y `anclaje_fuente_score` (0.0 a 1.0).
  - `persistencia`: Metadatos de subida a OCI (`status_upload`, `objeto_id`, `bucket`).
  - `advertencias`: Lista de advertencias (fallback de modelo, cuotas, citas no localizadas).


### `POST /api/v1/adaptar/stream`
Genera el material educativo de forma asíncrona progresiva utilizando **Server-Sent Events (SSE)**.
- **Content-Type:** `multipart/form-data`
- **Respuesta HTTP:** `Content-Type: text/event-stream; charset=utf-8`
- **Flujo de Eventos SSE:**
  - `event: progreso`: Notificaciones de estado y porcentaje global.
  - `event: tarea`: Inicio, avance o conclusión de subtareas (`A`, `B1`, `B2`, `C`).
  - `event: recurso`: Parche incremental de datos listo para renderizar una estación en el frontend.
  - `event: auditoria`: Resultado de la auditoría de citas y score de fidelidad.
  - `event: resultado`: Objeto final `RespuestaAdaptacion` consolidado.
  - Comentarios `: ping\n\n`: Latidos automáticos emitidos cada 15 segundos para neutralizar el timeout 524 de Cloudflare.


## 4. Servicio de Narración y Microclase Audiovisual

### `POST /api/v1/narracion/generar`
Genera la síntesis de audio para la microclase del video educativo a partir del guion adaptado.
- **Autenticación:** JWT Requerido.
- **Content-Type:** `application/json`
- **Cuerpo:**
```json
{
  "documento_id": "uuid-del-documento",
  "run_id": "run-id-de-generacion",
  "guion": {
    "titulo": "Resumen en 60 segundos",
    "escenas": [
      { "numero": 1, "locucion": "Texto de la escena 1...", "duracion_estimada_segundos": 12 },
      { "numero": 2, "locucion": "Texto de la escena 2...", "duracion_estimada_segundos": 15 }
    ]
  },
  "proveedor_preferido": "elevenlabs"
}
```
- **Controles de cuota:** Si el guion supera 173 palabras o 1.730 caracteres, la petición se rechaza preventivamente con `HTTP 422 Unprocessable Entity` (`error_codigo="guion_largo"`).

### `GET /api/v1/narracion/archivo/{ruta:path}`
Descarga un archivo estático de audio generado (`.wav` o `.mp3`) o guion JSON. La ruta está restringida al espacio privado del usuario autenticado en OCI o disco local (`users/<user_id>/...`).


## 5. Gestión de Paquetes y Ejemplos

### `GET /api/v1/paquetes`
Lista los paquetes educativos generados pertenecientes al usuario autenticado.
- **Autenticación:** JWT Requerido.
- **Respuesta `200 OK`:** Lista de objetos con identificador, fecha, título, perfil y estado de almacenamiento en OCI.

### `GET /api/v1/paquetes/{objeto_id:path}`
Descarga la estructura JSON completa de un paquete educativo almacenado.

### `GET /api/v1/documentos/ejemplos`
Devuelve el listado de documentos de prueba incluidos en la biblioteca del sistema (Don Quijote, Apache Kafka, ENISA, Snowflake, Guía OCI Swap).

---

## 🔗 Navegación
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back)
* 📚 [**Directorio de Guías del Backend**](README.md)
* 🚀 [**Portada del Backend**](../README.md)
