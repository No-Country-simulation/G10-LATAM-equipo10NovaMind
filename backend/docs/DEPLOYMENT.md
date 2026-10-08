# Instalación, configuración y despliegue

## Requisitos Identificados
- **Python 3.12.7** (estándar oficial del proyecto).
- **Node.js 18+ y npm** (para la interfaz web React 19 + Vite).
- **Claves de API de LLMs:**
  - **Cohere (`COHERE_API_KEY`)**: Requerida para embeddings (`embed-multilingual-v3.0`) y redacción del Agente 2 (`command-r-08-2024`).
  - **Google Gemini (`GEMINI_API_KEY`)**: Requerida para el Agente 3 Crítico Multi-Proveedor (`gemini-2.5-flash`).
  - **Groq (`GROQ_API_KEY`)**: Opcional / fallback para contingencia analítica ultrarrápida (`llama-3.3-70b-versatile`).

## Opción 1: Lanzamiento Rápido Automático (1 Clic)
El proyecto incluye un script lanzador concurrente:
```powershell
.\iniciar_local.bat
```
Este script:
1. Valida el entorno virtual `.venv`.
2. Inicia el backend FastAPI en [http://127.0.0.1:8000](http://127.0.0.1:8000).
3. Inicia el frontend React (Vite) en [http://localhost:5173](http://localhost:5173).
4. Abre la aplicación en el navegador predeterminado.

## Opción 2: Instalación y Ejecución Manual por Terminales

### Preparación del Entorno
```powershell
# Crear y activar entorno virtual
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Configurar variables de entorno
Copy-Item .env.example .env
```

### Terminal 1 — Backend FastAPI:
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 — Frontend React (Vite):
```powershell
cd frontend
npm install
npm run dev
```


## Variables de entorno observadas

| Variable | Uso / módulo | Valor predeterminado o nota |
|---|---|---|
| `COHERE_API_KEY` | Cohere / configuración | Necesaria para embeddings y Agente 2 |
| `COHERE_MODEL` | Modelo de redacción (Agente 2) | `command-r-08-2024` (~18s latencia) |
| `COHERE_EMBEDDING_MODEL` | Modelo embedding en Config | `embed-multilingual-v3.0` (1024 dims) |
| `PROVEEDOR_CRITICO` | Proveedor del Agente 3 | `gemini` (predeterminado), `groq` o `cohere` |
| `MODELO_CRITICO` | Modelo del Agente 3 Crítico | `gemini-2.5-flash` (~2s latencia) |
| `PROVEEDOR_CRITICO_FALLBACK` | Fallback de contingencia Agente 3 | `groq` o `cohere` |
| `GEMINI_API_KEY` | API Key Google AI Studio | Clave para evaluación neutral del Crítico |
| `GROQ_API_KEY` | API Key Groq | Clave opcional para evaluación LPU (<1.5s) |
| `PRESUPUESTO_TIEMPO_SEGUNDOS` | Deadline interno anti-timeout | `75.0` segundos (límite previo a 100s Cloudflare) |
| `AGENTE1_CHROMA_PATH` | Config RAG de configuración | `./chroma_db` |
| `AGENTE1_COLLECTION_NAME` | Config RAG | `nuevamente_documentos` |
| `TOP_K_CHUNKS` | Recuperación | `6`, rango 1–30 |
| `MIN_SCORE_RETRIEVAL` | Umbral de recuperación | `0.60`, rango 0–1 |
| `MIN_ANCLAJE_FUENTE_SCORE` | Umbral crítico | `0.75`, rango 0–1 |
| `MAX_REDACCION_RETRIES` | Reintentos de redacción | `2`, rango 0–5 |
| `API_REINTENTOS` | Reintentos de API | `3`, rango 1–6 |
| `API_ESPERA_BASE_SEGUNDOS` | Backoff | `1.0`, rango 0–30 |
| `CHROMA_PERSIST_DIR` | Pipeline RAG alternativo | `data/chroma` |
| `CHROMA_COLLECTION_NAME` | Pipeline RAG alternativo | `nuevamente_docs` |
| `LOCAL_EMBEDDINGS_MODEL` | Embeddings locales | `intfloat/multilingual-e5-base` |
| `EMBEDDINGS_PROVIDER` | Proveedor de embeddings | `local` |
| `GEMINI_API_KEY` | Proveedor alternativo de embeddings | Requerida si se elige esa rama |
| `LLM_PROVIDER` | `core/orchestrator.py` | `gemini` |
| `GEMINI_MODEL` | Proveedor Gemini | `gemini-2.5-flash` |
| `OLLAMA_BASE_URL` | Proveedor Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Proveedor Ollama | `llama3.1` |
| `CLAUDE_MODEL` | Proveedor Claude | `claude-sonnet-4-6` |
| `OCI_NAMESPACE`, `OCI_BUCKET_NAME` | Almacenamiento OCI | Ambas activan ruta de OCI en endpoints |
| `OCI_CONFIG_FILE` | Archivo de config OCI | `~/.oci/config` |
| `OCI_CONFIG_PROFILE` | Perfil OCI | `DEFAULT` |
| `OCI_USER`, `OCI_TENANCY`, `OCI_FINGERPRINT`, `OCI_KEY_FILE`, `OCI_KEY_CONTENT`, `OCI_REGION` | Autenticación OCI | Usar credenciales válidas y no versionarlas |
| `BACKEND_PORT`, `FRONTEND_PORT` | Scripts y lanzador | `8000` (FastAPI) y `5173` (Vite) |
| `BACKEND_URL`, `BACKEND_API_URL` | Cliente frontend React | `http://localhost:8000` por defecto |

**Nota de Armonización:** La configuración fue armonizada y centralizada en `backend/app/core/config.py`, soportando nombres canónicos y alias habituales de entorno (`COHERE_MODEL`, `COHERE_EMBEDDING_MODEL`, `OCI_*`). Para más información sobre el despliegue en nube privada, consultar los documentos en `deploy/` y `historial_progreso/`.

## Despliegue en Servidor / Nube (Topología OCI Always Free)
Para despliegues en producción sobre Oracle Cloud Infrastructure (`VM.Standard.E2.1.Micro`, 1 vCPU, 1 GB RAM):
- **VM 1 (`n8n-vm` - Backend API):** Uvicorn con **1 worker** (`~98.5 MB RAM`), `asyncio.Semaphore(1)` para control estricto de memoria y puerto privado 8000 dentro de la VCN.
- **VM 2 (`climasmart-bems-vm` - Frontend & Edge):** Nginx (`:8080`, ~6 MB RAM) sirviendo la SPA compilada, proxy inverso de `/api/` con `proxy_buffering off;` para SSE, y expuesto a Internet vía **Cloudflare Tunnel (`novamind.techgk.cl`)**.
- Documentación detallada en: `historial_progreso/INFORME_ORQUESTACION_MULTI_PROVEEDOR_FASE9.md` y `deploy/README_DESPLIEGUE_OCI.md`.

