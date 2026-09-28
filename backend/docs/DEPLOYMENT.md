# Instalación, configuración y despliegue

## Requisitos identificados
- Python 3.12.7 indicado en la documentación del repositorio.
- Dependencias backend en `backend/requirements.txt`; dependencias frontend en `frontend/requirements.txt`; `requirements.txt` raíz incluye ambos.
- Clave de Cohere para los componentes que la exijan.
- Persistencia local Chroma y carpetas de datos.
- Credenciales OCI únicamente si se habilita el cliente real.

## Instalación local (PowerShell)
```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```
Completar la configuración necesaria en `.env`. Para ejecutar el backend desde la raíz:
```powershell
$env:PYTHONPATH = "$PWD\backend"
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```
Frontend:
```powershell
$env:BACKEND_URL = "http://127.0.0.1:8000"
python -m streamlit run frontend/app/streamlit_app.py
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
| `BACKEND_PORT`, `FRONTEND_PORT` | Scripts/plantilla | `8000` y `8501`; confirmar consumo real en scripts |
| `BACKEND_URL`, `BACKEND_API_URL` | Cliente frontend | `http://localhost:8000` si no se define |

**Importante:** `.env.example` no coincide plenamente con los nombres consumidos por los módulos. Consultar `PROJECT_AUDIT.md`; esta tabla refleja nombres hallados en el código y plantillas, no una configuración unificada validada.

## Despliegue
El repositorio incluye scripts `.bat` y un cliente OCI, pero esta documentación no confirma una configuración de producción lista para usar. No se identificó un Dockerfile/Compose en el inventario de archivos analizado. Para producción, configurar servidor ASGI, proxy TLS, secretos, límites, logs, persistencia y monitorización; restringir CORS y proteger los endpoints.
