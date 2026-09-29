# Instalación, configuración y despliegue

## Requisitos Identificados
- **Python 3.12.7** (estándar oficial del proyecto).
- **Node.js 18+ y npm** (para la interfaz web React 19 + Vite).
- Clave de API de Cohere (`COHERE_API_KEY`) para embeddings (`embed-multilingual-v3.0`) y generación LLM (`command-r-plus-08-2024`).
- Persistencia local ChromaDB y directorios de datos (`data/chroma/`, `data/outputs/`).
- Credenciales de Oracle Cloud Infrastructure (OCI) únicamente para habilitar el bucket cloud Always Free.

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
| `COHERE_API_KEY` | Cohere / configuración | Necesaria cuando el flujo Cohere se activa |
| `COHERE_MODEL` | Modelo de chat en Config | `command-a-03-2025` |
| `COHERE_EMBEDDING_MODEL` | Modelo embedding en Config | `embed-multilingual-v3.0` |
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

## Despliegue en Servidor / Nube
Para despliegues en instancias de nube (ej: Oracle Cloud Infrastructure Compute Always Free), consultar:
- `deploy/README_DESPLIEGUE_OCI.md`: Guía de arquitectura para instancias Ubuntu.
- `deploy/systemd/`: Archivos de servicio para gestión de demonios en background de FastAPI y Vite/Node.
- `iniciar_local.bat`: Para ejecución local concurrente en entornos de desarrollo Windows.

