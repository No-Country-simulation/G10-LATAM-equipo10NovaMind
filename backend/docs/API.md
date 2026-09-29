# Referencia de API

**Framework:** FastAPI. **Versión declarada:** `2.0.0`. No se observó prefijo global para `/health`; el resto de endpoints funcionales usa `/api/v1`.

## Resumen de endpoints

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/health` | Healthcheck básico |
| GET | `/api/v1/config/opciones` | Opciones canónicas para formularios |
| POST | `/api/v1/adaptar` | Generar material educativo desde archivo o texto |
| GET | `/api/v1/paquetes` | Listar paquetes guardados |
| GET | `/api/v1/paquetes/{objeto_id:path}` | Descargar paquete JSON por identificador/ruta de objeto |

## `GET /health`
Respuesta `200`:
```json
{"status":"ok","service":"nuevamente-backend"}
```
Es un healthcheck de proceso; no verifica por sí mismo conectividad con Cohere, Chroma u OCI.

## `GET /api/v1/config/opciones`
Respuesta `200` con listas `perfiles_destinatario`, `formatos_salida`, `nichos_sector` y `niveles_detalle`. Valores definidos en `main.py`:
- Perfiles: `Principiante / Transición de Carrera`, `Desarrollador Junior / Semi Senior`, `Líder Técnico / Arquitecto`, `Gestor / Ejecutivo (No Técnico)`.
- Formatos: `Guía Práctica Paso a Paso (Tutorial)`, `Flashcards`, `Quiz Interactivo con Justificaciones`, `Resumen Ejecutivo (TL;DR)`, `Guion de Clase / Video`.
- Nichos: `Fintech`, `Salud`, `E-commerce`, `General`.
- Niveles: `Didáctico`, `Intermedio`, `Profundo`.

## `POST /api/v1/adaptar`
**Content-Type:** `multipart/form-data`. No requiere autenticación en el código revisado.

Campos:
| Campo | Tipo | Requerido | Descripción |
|---|---|---:|---|
| `archivo` | archivo | No* | PDF, MD/Markdown o TXT |
| `texto_directo` | string | No* | Texto alternativo |
| `titulo` | string | No | Título del documento |
| `perfil_destinatario` | string | Sí | Perfil pedagógico |
| `formato_salida` | string | Sí | Formato deseado |
| `nicho_sector` | string | No | Predeterminado `General` |
| `nivel_detalle` | string | No | Predeterminado `Didáctico` |
| `tema_consulta` | string | No | Foco opcional de búsqueda |

*Debe proporcionarse archivo no vacío o `texto_directo` no vacío. El esquema de solicitud exige al menos 40 caracteres de contenido. Los valores se normalizan mediante alias y validaciones Pydantic.

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

## `GET /api/v1/paquetes`
Devuelve `{"origen":"oci"|"local","paquetes":[...]}`. En modo local cada elemento incluye nombre, tamaño en bytes y marca temporal derivada del archivo. La lista OCI contiene nombre, tamaño y fecha de creación. Si OCI falla, el código continúa con listado local.

## `GET /api/v1/paquetes/{objeto_id:path}`
Devuelve el JSON del paquete. En modo local busca el nombre final dentro de `data/outputs/contenidos_generados`; si no existe, responde `404` con `Paquete no encontrado.`. En OCI intenta descargar el objeto y decodificar JSON; ante excepción, prueba el respaldo local.

## CORS y Conectividad Frontend

FastAPI implementa `CORSMiddleware` configurado con orígenes y regex para desarrollo local y producción:
- **Orígenes autorizados:**
  - `http://localhost:5173` y `http://127.0.0.1:5173` (Frontend React 19 + Vite)
  - `http://localhost:8501` y `http://127.0.0.1:8501` (Dashboard auxiliar)
  - `http://localhost:8000` y `http://127.0.0.1:8000` (Swagger UI y self-calls)
- **Regex tolerante a puertos locales:** `^https?://(localhost|127\.0\.0\.1)(:\d+)?$`
- **Cabeceras y métodos:** `allow_methods=["*"]`, `allow_headers=["*"]`, `allow_credentials=True`.

### Consumo desde Frontend React (`frontend/src/services/api.ts`)
El cliente Axios de la SPA interactúa de la siguiente forma:
1. Consulta `GET /api/v1/config/opciones` en la carga inicial para poblar los selectores sin código estático duplicado.
2. Al enviar la adaptación, genera un `FormData` adjuntando el archivo (`archivo`) o el texto manual mapeado al campo `texto_directo`.
3. Recibe la respuesta con `status`, `contenido_adaptado`, `evaluacion_calidad` (con `anclaje_fuente_score`) y `almacenamiento_oci` (con `objeto_id` y `status_upload`).

## Autenticación, límites y paginación
En la fase actual de prototipo para hackathon, los endpoints no requieren autenticación Bearer/API Key externa para facilitar las pruebas locales. No se observó paginación pesada; el cliente OCI lista hasta 50 objetos por lote. Se recomienda incorporar middleware de autenticación (JWT/API Keys) y rate limiting antes de una publicación a producción abierta. Consultar `SECURITY.md` y `PROJECT_AUDIT.md`.

