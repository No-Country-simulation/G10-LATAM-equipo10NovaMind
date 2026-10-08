# ⚡ NovaMind — Microservicio Backend (FastAPI + LangGraph + RAG)

> **Plataforma Oficial:** NovaMind — Sistema Inteligente de Adaptación Pedagógica Multi-Agente RAG  
> **Tecnologías:** Python 3.10+, FastAPI, Uvicorn, LangGraph, Pydantic v2, ChromaDB, Cohere Embeddings & LLM, Google Gemini 2.5 Flash / Groq Fallback  
> **Puerto por Defecto:** `http://127.0.0.1:8000`  
> **Frontend Vinculado:** `http://localhost:5173` (React 19 + Vite)  
> **Persistencia Cloud:** Oracle Cloud Infrastructure (OCI Object Storage Always Free `sa-santiago-1`)  

---

## 📖 1. Visión General del Backend

El backend de **NovaMind** es un microservicio REST y Server-Sent Events (SSE) de alto rendimiento, diseñado para operar bajo restricciones de hardware rigurosas (instancias `VM.Standard.E2.1.Micro` de 1 vCPU y 1 GB de RAM física con 4 GB de Swap en OCI Always Free).

Orquesta una arquitectura multi-agente reflexiva con ciclo de retroalimentación:
1. **Agente 1: Investigador RAG (`agente1_investigador.py`):**
   - Ingesta multi-formato (`.pdf` con extracción limpia vía `pypdf`, `.md`, `.txt`).
   - Chunking semántico con solapamiento narrativo.
   - Generación de embeddings con Cohere `embed-multilingual-v3.0` (1024 dimensiones).
   - Indexación y recuperación por similitud de coseno en ChromaDB local.
2. **Agente 2: Productor Adaptativo (`agente2_productor.py`):**
   - Redacción de material educativo adaptado a 4 perfiles y 6 formatos pedagógicos (incluyendo el **Paquete Completo de 5 Estaciones**).
   - Motor LLM: Cohere `command-r-08-2024` con prompting adaptativo y few-shots específicos.
3. **Agente 3: Crítico de Calidad & Fact-Checking (`agente3_critico.py`):**
   - Auditoría RAG estricta sin alucinaciones contra los fragmentos originales recuperados.
   - Evaluación multi-proveedor desacoplada: **Google Gemini 2.5 Flash** (primario, ~2s) con auto-failover a **Groq (`llama-3.3-70b-versatile`)** o Cohere ante saturación o timeout.
   - Emisión del Score de Anclaje matemático (0.0 a 1.0) y desglose de afirmaciones auditadas.
4. **Almacenamiento Híbrido Resiliente (`servicios/almacenamiento_oci.py`):**
   - Subida automática del paquete educativo en formato JSON a OCI Object Storage (`novamind-contenidos-educativos`).
   - Fallback transparente a disco local (`backend/data/outputs/`) en caso de contingencia offline.

---

## 🛠️ 2. Estructura de Directorios del Backend

```text
backend/
├── app/
│   ├── main.py                     # API FastAPI, routers, semáforo de concurrencia y streaming SSE
│   ├── orquestador.py              # Orquestador LangGraph y grafo cíclico con reintentos
│   ├── ingestion.py                # Ingesta y normalización de documentos (PDF, MD, TXT)
│   ├── core/
│   │   ├── config.py               # Variables de entorno y configuración centralizada
│   │   └── schemas.py              # Modelos Pydantic v2 (validación estricta y 5 estaciones)
│   ├── agentes/
│   │   ├── agente1_investigador.py # RAG, embeddings y ChromaDB
│   │   ├── agente2_productor.py    # Generación pedagógica adaptativa
│   │   └── agente3_critico.py      # Auditoría RAG, fact-checking y failover multi-proveedor
│   └── servicios/
│       └── almacenamiento_oci.py   # SDK OCI Object Storage y fallback local
│
├── docs/                           # Documentación técnica exhaustiva
│   ├── API.md                      # Referencia completa de endpoints y contratos REST
│   ├── ARQUITECTURA.md             # Diagramas y decisiones de diseño
│   ├── DATABASE.md                 # ChromaDB y modelos de persistencia
│   ├── DEPLOYMENT.md               # Guía de despliegue en OCI Compute y Systemd
│   ├── SECURITY.md                 # Sanitización, Zero-Trust y manejo de credenciales
│   └── TESTS.md                    # Reporte de cobertura y suite de pruebas
│
├── tests/                          # Suite automatizada (70 pruebas deterministas)
├── requirements.txt                # Dependencias de producción
└── requirements-dev.txt            # Dependencias de testing (pytest, pytest-asyncio, httpx)
```

---

## 🚀 3. Ejecución Rápida en Desarrollo

### Paso 1: Configurar Entorno Virtual y Dependencias
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### Paso 2: Configurar Variables de Entorno
Copia el archivo de plantilla `.env.example` en la raíz del proyecto a `.env`:
```env
COHERE_API_KEY=tu_clave_cohere
GEMINI_API_KEY=tu_clave_gemini
GROQ_API_KEY=tu_clave_groq  # Opcional, para auto-failover

# OCI Object Storage (Opcional en desarrollo local)
OCI_CONFIG_FILE=~/.oci/config
OCI_PROFILE=DEFAULT
OCI_NAMESPACE=tu_namespace
OCI_BUCKET_NAME=novamind-contenidos-educativos
```

### Paso 3: Iniciar Servidor
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🧪 4. Suite de Pruebas Automatizadas

La suite completa cuenta con **70 pruebas unitarias y de integración**, ejecutadas de forma determinista y sin costo de red:

```powershell
pytest tests/ -v
```
**Resultado certificado:** `70 passed in ~3.8s (100% éxito)`.

---

## ⚡ 5. Métricas de Rendimiento y Benchmark de Estrés

* **Throughput REST:** **137.24 peticiones/segundo** (`GET /health`) y **144.32 peticiones/segundo** (`GET /api/v1/config/opciones`).
* **No-Bloqueo del Event Loop:** Latencia promedio de **9.27 ms** en comprobaciones continuas de salud durante inferencias RAG pesadas de 71 segundos.
* **Huella de Memoria:** Working set de Python mantenido en **~172 MB** bajo estrés máximo, dejando más de 800 MB libres para el sistema operativo en OCI Always Free.
* **Protección OOM:** Semáforo de concurrencia (`_SEMAFORO_CONCURRENCIA = asyncio.Semaphore(1)`) que encola solicitudes pesadas para evitar picos de memoria.

---

## 📚 6. Documentación Adicional

* Para detalles de los contratos HTTP: ver [backend/docs/API.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/backend/docs/API.md).
* Para arquitectura del orquestador: ver [backend/docs/ARQUITECTURA.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/backend/docs/ARQUITECTURA.md).
* Para despliegue en la nube: ver [backend/docs/DEPLOYMENT.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/backend/docs/DEPLOYMENT.md).
