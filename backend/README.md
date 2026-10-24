# 🚀 NuevaMente Backend — API REST y Motor de Orquestación

<p align="center">
  <img src="https://img.shields.io/badge/versión-2.0.0-0A84FF" alt="Versión 2.0.0">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white" alt="Python 3.12">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Docs-Swagger%20%2F%20OpenAPI-85EA2D?logo=swagger&logoColor=black" alt="Swagger OpenAPI">
  <img src="https://img.shields.io/badge/Contratos-Pydantic%20v2-E92063?logo=pydantic&logoColor=white" alt="Pydantic v2">
  <img src="https://img.shields.io/badge/Tests-300%20passed-10B981?logo=pytest&logoColor=white" alt="300 Tests">
  <img src="https://img.shields.io/badge/Base%20de%20Datos-PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/BaaS%20%26%20Auth-Supabase%20(RLS)-3FCF8E?logo=supabase&logoColor=white" alt="Supabase RLS">
  <img src="https://img.shields.io/badge/Storage-OCI%20Object%20Storage-F80000?logo=oracle&logoColor=white" alt="OCI Object Storage">
</p>

Backend del sistema **NuevaMente**, desarrollado en **Python 3.12** con **FastAPI**. Orquesta la transformación de documentos técnicos en recorridos de aprendizaje adaptados mediante modelos de lenguaje (Google Gemini, Cohere, Groq), verificación determinista de procedencia y persistencia híbrida en Oracle Cloud (OCI) y Supabase.


## ⚡ Vista Rápida

- **Framework:** FastAPI con arquitectura asíncrona desacoplada (`asyncio.to_thread`).
- **Modo Principal:** Generación paralela (*In-Context Grounding*) de alto rendimiento y entrega incremental por **Server-Sent Events (SSE)**.
- **Modos de Respaldo:** Cadena colaborativa multi-modelo y orquestador clásico RAG vectorial con LangGraph y ChromaDB.
- **Fidelidad Documental:** Búsqueda determinista de citas literales en Python (`app/core/fuentes.py`), sin delegar el número de página al modelo.
- **Persistencia Híbrida:** Supabase PostgreSQL con **Row Level Security (RLS)** y OCI Object Storage Always Free (con fallback transparente a `data/outputs/`).


## 🛠️ Puesta en Marcha Rápida

### 1. Requisitos
- Python 3.11 o 3.12 (recomendado 3.12.7).
- Al menos una clave de API configurada en `.env` (`GEMINI_API_KEY` o `COHERE_API_KEY`).

### 2. Instalación
Desde la raíz del proyecto o desde la carpeta `backend/`:
```powershell
# Crear y activar entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Configuración
Asegúrate de contar con el archivo `.env` en la raíz del proyecto (puedes basarte en `.env.example`):
```ini
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
COHERE_API_KEY=tu_api_key_de_cohere
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_publica
```

### 4. Ejecución del Servidor
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API en vivo:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Documentación Swagger interactiva:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Healthcheck:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

*(Nota: si deseas iniciar el backend y el frontend simultáneamente en un solo clic, puedes ejecutar `.\iniciar_local.bat` desde la raíz).*



## 🧪 Pruebas Automatizadas

La suite de pruebas es **100% determinista** (utiliza dobles de prueba para no consumir saldo de APIs):
```powershell
cd backend
python -m pytest -q
```
*Cobertura: 300 pruebas aprobadas (100% éxito).*


## 📂 Estructura de Módulos (`backend/app/`)

```
backend/app/
├── agentes/                # Orquestación (generación paralela, cadena colaborativa)
├── core/                   # Configuración, esquemas Pydantic v2, fuentes e ingesta
├── servicios/              # Clientes de IA (Gemini, ElevenLabs, imágenes, narración)
├── storage/                # Adaptadores de persistencia (OCI Object Storage y local)
├── integration/            # Pipelines auxiliares y despacho de correo
├── auth.py                 # Middleware de autenticación Supabase y control RLS
├── main.py                 # Aplicación FastAPI, middlewares, CORS y endpoints
└── orquestador.py          # Grafo multi-agente LangGraph determinista (modo clásico)
```


## 📚 Documentación Técnica Detallada

> 🧭 Consulta el mapa y directorio de especificaciones de todo el proyecto en el [**Índice General (INDEX.md)**](../INDEX.md#back).

### 🌐 Documentación Interactiva (Swagger / OpenAPI)
Cuando el servidor está en ejecución, FastAPI genera automáticamente la documentación interactiva en los siguientes endpoints:  
- 📖 [**Swagger UI Interactivo**](http://127.0.0.1:8000/docs): Interfaz gráfica para explorar y probar (*Try it out*) los 13 endpoints directamente desde el navegador.
- 📑 [**ReDoc**](http://127.0.0.1:8000/redoc): Especificación OpenAPI en diseño editorial estructurado.
- ⚙️ [**Esquema OpenAPI (JSON)**](http://127.0.0.1:8000/openapi.json): Contrato técnico en formato JSON estándar.

---

### 📖 Guías de Especificación por Área

Para profundizar en el diseño, implementación y operación del backend, consulta las especificaciones completas:

| Guía | Contenido Principal |
|---|---|
| 📐 [**Arquitectura Interna del Backend**](docs/ARCHITECTURE.md) | Flujos internos, modos de generación, semáforos de concurrencia y streaming SSE. |
| 🌐 [**Arquitectura Global del Sistema**](../docs/ARCHITECTURE.md) | Visión completa del producto: Frontend React 19, Remotion, FastAPI, Supabase y OCI. |
| 🔌 [**Referencia de API (Swagger / REST)**](docs/API.md) | Catálogo completo de los 13 endpoints activos, contratos Pydantic v2, Swagger y eventos SSE. |
| 🗄️ [**Base de Datos y Persistencia**](docs/DATABASE.md) | Migraciones de Supabase, modelo entidad-relación, políticas RLS, OCI y ChromaDB. |
| 🛡️ [**Seguridad y Control de Acceso**](docs/SECURITY.md) | Autenticación JWT, arquitectura Zero Trust, CORS y mitigación de ataques OOM. |
| 🚀 [**Instalación y Despliegue**](docs/DEPLOYMENT.md) | Variables de entorno, despliegue en VM OCI Compute con systemd y Nginx. |
| 🩺 [**Operaciones y Runbooks**](docs/OPERATIONS.md) | Diagnóstico frecuente, monitoreo, logs y scripts de mantenimiento (*Zero-State*). |
| 🧪 [**Estrategia de Testing**](docs/TESTING.md) | Suite de 300 tests unitarios/integración, prueba de estrés (137 RPS) y validación E2E. |
| 🤝 [**Guía de Contribución**](../CONTRIBUTING.md) | Flujo Git Flow, convenciones de ramas, commits y estándares de desarrollo. |
| 📝 [**Historial de Cambios (Changelog)**](../CHANGELOG.md) | Registro cronológico de versiones y novedades de la versión 2.0.0 a la 2.8.0. |
| 🔍 [**Auditoría del Proyecto**](../docs/PROJECT_AUDIT.md) | Análisis de hallazgos iniciales y matriz de mitigaciones técnicas del proyecto. |
