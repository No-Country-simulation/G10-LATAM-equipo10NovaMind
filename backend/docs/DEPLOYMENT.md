# Instalación, Configuración y Despliegue

## Requisitos Previos

- **Python:** 3.11 o 3.12 (recomendado Python 3.12.7).
- **Node.js:** Versión 18+ y npm (para el frontend React 19).
- **Claves de API de LLMs (al menos una):**
  - **Google Gemini (`GEMINI_API_KEY`)**: Proveedor principal para el modo paralelo y tareas pedagógicas.
  - **Cohere (`COHERE_API_KEY`)**: Requerido para embeddings y para el Agente 2 en el modo clásico.
  - **Groq (`GROQ_API_KEY`)**: Opcional / fallback analítico ultrarrápido con Llama 3.3 70B.
- **Supabase:** Proyecto con URL y Anon Key pública.
- **Oracle Cloud (OCI):** Credenciales de API y Bucket privado de Object Storage (opcional para desarrollo local; se activa fallback local automático si falta).


## 1. Puesta en Marcha Local

### Opción A: Lanzador Automático en 1 Clic (Windows)
El proyecto incluye un script concurrentemente orquestado:
```powershell
.\iniciar_local.bat
```
Este script:
1. Verifica el entorno virtual `.venv`.
2. Lanza el backend FastAPI en `http://localhost:8000` (o `http://127.0.0.1:8000`).
3. Lanza el frontend React (Vite) en `http://localhost:5173`.
4. Abre la aplicación automáticamente en el navegador.



### Opción B: Ejecución Manual por Terminales

#### Paso 1: Configurar el Entorno de Backend
```powershell
# Crear y activar entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Actualizar pip e instalar dependencias
python -m pip install --upgrade pip
pip install -r requirements.txt

# Copiar plantilla de variables de entorno
Copy-Item .env.example .env
```

#### Paso 2: Iniciar el Backend
Desde la carpeta raíz o dentro de `backend/`:
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Paso 3: Iniciar el Frontend (en otra terminal)
```powershell
cd frontend
npm install
npm run dev
```

## 2. Catálogo Completo de Variables de Entorno (`.env`)

El archivo `.env` del proyecto (basado en `.env.example`) contiene **38 variables de configuración** organizadas en 7 bloques funcionales:

### 1. Proveedores de IA y Modelos Base (Cohere, Gemini, Groq)
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`COHERE_API_KEY`** | Clave de API de Cohere para embeddings y redacción del modo clásico | Requerida para modo clásico |
| **`COHERE_MODEL`** | Modelo de redacción para el Agente 2 (Productor) | `command-r-08-2024` |
| **`EMBEDDING_MODEL`** | Modelo de vectorización semántica (1024 dims) | `embed-multilingual-v3.0` |
| **`GEMINI_API_KEY`** | Clave de Google AI Studio (solo en backend, nunca en variables `VITE_*`) | Requerida para modo paralelo |
| **`PROVEEDOR_CRITICO`** | Proveedor primario para el Agente 3 Crítico | `gemini` |
| **`MODELO_CRITICO`** | Modelo estructurado para auditoría de calidad RAG | `gemini-2.5-flash` |
| **`GROQ_API_KEY`** | Clave de Groq LPU para contingencia en milisegundos | Opcional |
| **`PROVEEDOR_CRITICO_FALLBACK`** | Proveedor de respaldo ante cuota 429 de Gemini | `groq` |
| **`MODELO_CRITICO_FALLBACK`** | Modelo de respaldo en Groq | `qwen/qwen3.8-27b` |
| **`OPENROUTER_API_KEY`** | Clave opcional para enrutamiento alternativo | Opcional |

### 2. Generación Paralela y Resiliencia Multimodal (Gemini)
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`GEMINI_SUMMARY_MODEL`** | Modelo para la Tarea A (Resumen, analogía y temario) | `gemini-3.5-flash-lite` |
| **`GEMINI_RESOURCES_MODEL`** | Modelo para Tareas B1, B2 y C (Flashcards, Guía y Quiz) | `gemini-3.5-flash-lite` |
| **`GEMINI_SUMMARY_FALLBACK_MODEL`** | Respaldo para Tarea A si el principal da 429 o 503 | `gemini-3.1-flash-lite` |
| **`GEMINI_RESOURCES_FALLBACK_MODEL`** | Respaldo para Tareas B y C ante saturación | `gemini-3.1-flash-lite` |
| **`GEMINI_TTS_MODEL`** | Modelo de síntesis de voz de Gemini | `gemini-3.8-flash-tts` |
| **`GEMINI_TTS_FALLBACK_MODELS`** | Modelos TTS alternativos separados por comas | *(vacío por defecto)* |
| **`GEMINI_TRANSCRIPTION_MODEL`** | Transcripción multimodal de imágenes y PDFs escaneados | `gemini-3.1-flash-lite` |
| **`GEMINI_TRANSCRIPTION_FALLBACK_MODEL`** | Respaldo para transcripción de texto fuente | `gemini-3.5-flash-lite` |

### 3. Síntesis de Voz y Narración Audiovisual (ElevenLabs)
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`ELEVENLABS_API_KEY`** | Clave de ElevenLabs para microclases narradas (Estación 4) | Opcional (cae a Gemini TTS o Web Speech) |
| **`ELEVENLABS_TTS_MODEL`** | Modelo de síntesis de voz ultrarrápido | `eleven_flash_v2_5` |
| **`ELEVENLABS_VOICE_ID`** | Identificador de la voz oficial en ElevenLabs | `Xb7hH8MSUJpSbSDYk0k2` (Alice) o `hLWSpwRIXvafYWP2GPET` (Diego) |
| **`ELEVENLABS_VOICE_NAME`** | Nombre visible de la voz en la interfaz | `Alice` |

### 4. Seguridad, Semáforos y Concurrencia
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`GEMINI_MAX_CONCURRENCIA`** | Máximo de llamadas simultáneas a Gemini por proceso | `4` |
| **`GEMINI_CONCURRENCIA_POR_MODELO`** | Límite concurrente para modelos de respaldo | `2` |
| **`MAX_FILAS_CACHE_INVITADOS`** | Límite de filas en memoria RAM para usuarios invitados | `200` (~20 documentos) |
| **`PERMITIR_MODO_INVITADO`** | Permite acceso con token público fuera de producción | `true` |
| **`PERMITIR_GENERACION_INVITADO`** | Habilitar generación en caliente para invitados (403 en VM) | `false` (solo para pregenerar muestras) |
| **`MAX_INVITADOS_CONCURRENTES`** | Cupos máximos para invitados en el semáforo global | `2` |
| **`MAX_BYTES_ARCHIVO`** | Límite máximo de subida de archivos (FastAPI) | `15728640` (15 MB) |
| **`TIEMPO_MAX_ADAPTACION_S`** | Presupuesto máximo de tiempo de ejecución | `300` |

### 5. Calidad Pedagógica y Base Vectorial (LangGraph & ChromaDB)
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`MIN_ANCLAJE_FUENTE_SCORE`** | Umbral mínimo de fidelidad factual para aprobación | `0.75` |
| **`MAX_REDACCION_RETRIES`** | Reintentos reflexivos del Agente 2 ante rechazo del Crítico | `2` |
| **`TOP_K` / `TOP_K_CHUNKS`** | Número de fragmentos semánticos recuperados en RAG | `5` |
| **`MIN_SCORE_RETRIEVAL`** | Similitud de coseno mínima para considerar un chunk relevante | `0.60` |
| **`APP_ENV`** | Entorno de ejecución (`dev` o `prod`) | `dev` |
| **`CHROMA_PATH`** | Ruta física de persistencia de la base vectorial local | `data/chroma` |
| **`CHROMA_COLLECTION_NAME`** | Nombre de la colección vectorial | `nuevamente_documentos` |

### 6. Persistencia OCI Object Storage & Notificaciones SMTP
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`OCI_USER`** | OCID del usuario de Oracle Cloud Infrastructure | `ocid1.user.oc1...` |
| **`OCI_TENANCY`** | OCID del tenancy de OCI | `ocid1.tenancy.oc1...` |
| **`OCI_FINGERPRINT`** | Huella digital de la clave API de OCI | `xx:xx:xx:xx:...` |
| **`OCI_REGION`** | Región del centro de datos de OCI | `sa-santiago-1` |
| **`OCI_NAMESPACE`** | Namespace del tenancy en Object Storage | *(asignado por OCI)* |
| **`OCI_BUCKET_NAME`** | Nombre del bucket privado de contenidos | `nuevamente-contenidos-educativos` |
| **`OCI_KEY_FILE`** | Ruta a la clave privada `.pem` del SDK de OCI | `deploy/oci_api_key.pem` |
| **`SMTP_HOST`** | Servidor de correo para despacho del dossier PDF | `smtp.gmail.com` *(opcional)* |
| **`SMTP_PORT`** | Puerto de conexión SMTP | `587` |
| **`SMTP_USER`** | Correo remitente para notificaciones | `tu_correo@ejemplo.com` |
| **`SMTP_PASSWORD`** | Contraseña de aplicación para SMTP | *(secreta)* |

### 7. Supabase y Puertos de Red
| Variable | Propósito | Valor por Defecto / Ejemplo |
|---|---|---|
| **`BACKEND_PORT`** | Puerto local de FastAPI | `8000` |
| **`FRONTEND_PORT`** | Puerto local de Vite (React 19) | `5173` |
| **`VITE_API_URL`** | URL consumida por el frontend para contactar la API | `http://localhost:8000` |
| **`SUPABASE_URL`** | URL de la instancia de Supabase | `https://<id>.supabase.co` |
| **`SUPABASE_PUBLISHABLE_KEY`** | Clave pública anon de Supabase para Auth y RLS | `sb_publishable_...` |


## 3. Despliegue en Producción (Oracle Cloud Compute)

### Arquitectura de Máquinas Virtuales
- **VM 1 (Backend FastAPI):**
  - Instancia Compute Always Free (1 OCPU, 1 GB RAM, Ubuntu/Oracle Linux).
  - Servicio administrado mediante `systemd`:
    ```ini
    # /etc/systemd/system/nuevamente-backend.service
    [Unit]
    Description=NuevaMente Backend FastAPI
    After=network.target

    [Service]
    User=ubuntu
    WorkingDirectory=/home/ubuntu/G10-LATAM-equipo10NovaMind/backend
    EnvironmentFile=/home/ubuntu/G10-LATAM-equipo10NovaMind/.env
    ExecStart=/home/ubuntu/G10-LATAM-equipo10NovaMind/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```
- **VM 2 (Proxy Inverso Nginx y Frontend):**
  - Configuración completa de referencia (`/etc/nginx/sites-available/novamind.conf`). Ajusta `root` a la ruta del build de Vite (`frontend/dist`) y `proxy_pass` a la IP privada de la VM 1:
    ```nginx
    server {
        listen 80;
        server_name novamind.techgk.cl;

        # Subidas de hasta 15 MB (+ margen para multipart)
        client_max_body_size 20m;

        # Build de React/Vite (npm run build -> frontend/dist)
        root /var/www/novamind;
        index index.html;

        # SPA: cualquier ruta del frontend resuelve a index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Documentación interactiva: Swagger UI, ReDoc y esquema OpenAPI.
        # Sin estos bloques, /docs cae en el SPA y devuelve index.html (Swagger parece "apagado").
        location ~ ^/(docs|redoc|openapi\.json)$ {
            proxy_pass http://10.0.0.2:8000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API REST + Server-Sent Events (SSE) con streaming sin búfer
        location /api/ {
            proxy_pass http://10.0.0.2:8000;   # sin barra final: conserva el prefijo /api/
            proxy_http_version 1.1;
            proxy_set_header Connection '';
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 180s;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```
  - Aplicar el cambio y recargar el proxy:
    ```bash
    sudo nginx -t && sudo systemctl reload nginx
    ```
  - Verificación rápida en producción:
    ```bash
    curl -I https://novamind.techgk.cl/docs          # 200 · text/html
    curl -s https://novamind.techgk.cl/openapi.json | head
    ```
  - **Alternativa sin tocar Nginx:** el backend también expone la documentación bajo el prefijo ya publicado: `/api/docs`, `/api/redoc` y `/api/openapi.json`. Así, con solo redesplegar el backend, `https://novamind.techgk.cl/api/docs` queda operativo aunque el proxy únicamente reenvíe `location /api/`.
  - Si se prefiere no publicar la documentación, se puede proteger con autenticación básica o limitar el acceso por IP en esos tres `location`.
- **Cloudflare Tunnel:** Enlaza el dominio público `novamind.techgk.cl` con el proxy de Nginx sin abrir puertos en el firewall público.
  > El túnel debe apuntar al Nginx (VM 2), no directamente al backend: Nginx sirve el frontend y enruta tanto el SPA como `/api/` y `/docs`.

---

## 🔗 Navegación
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back)
* 📚 [**Directorio de Guías del Backend**](README.md)
* 🚀 [**Portada del Backend**](../README.md)
