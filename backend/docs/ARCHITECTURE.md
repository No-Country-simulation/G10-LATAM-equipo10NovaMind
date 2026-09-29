# Arquitectura del Sistema

## Vista General

El sistema **NuevaMente** opera bajo un modelo desacoplado cliente-servidor basado en microservicios, conectando una interfaz web moderna en **React 19 (Vite + TypeScript)** con una API REST en **FastAPI** y un motor de orquestación multi-agente en **LangGraph**:

```mermaid
flowchart LR
  U[Usuario] --> UI["Frontend React 19 SPA (Vite :5173)"]
  UI -->|HTTP multipart/form-data| API["FastAPI (app/main.py :8000)"]
  API --> ING["Ingesta PDF/MD/TXT (pypdf)"]
  ING --> ORQ["Orquestador LangGraph (orquestador.py)"]
  ORQ --> INV["Agente 1: Investigador RAG"]
  INV --> CH[("ChromaDB Vectorial")]
  INV <--> COH_EMB["Cohere Embeddings API"]
  ORQ --> PROD["Agente 2: Productor"]
  PROD <--> COH_LLM["Cohere Command R+"]
  ORQ --> CRIT["Agente 3: Crítico"]
  CRIT <--> COH_LLM
  ORQ --> STORE["Almacenador Híbrido Resiliente"]
  STORE -->|Principal| OCI[("OCI Object Storage Always Free")]
  STORE -.->|Fallback Automático| LOCAL[("Archivos Locales data/outputs/")]
  API --> UI
```

## Componentes

### 1. Capa de Presentación (Frontend React 19)
- **`frontend/src/App.tsx`**: Orquestador de estado de la aplicación y navegación por vistas (Ingesta, Cargando/Procesando, Visualización y Métricas).
- **`frontend/src/components/Stepper/`**: Indicador visual interactivo de las 3 etapas pedagógicas.
- **`frontend/src/components/IngestView/`**: Formulario drag-and-drop para subida de archivos (.pdf, .md, .txt) o ingreso de texto manual, con selectores canónicos sincronizados con el backend.
- **`frontend/src/components/ViewerView/`**: Visualizadores interactivos especializados para cada uno de los 5 formatos pedagógicos (Flashcards 3D con efecto flip, Quiz interactivo con feedback razonado, Tutorial con pasos y advertencias, TL;DR estructurado y Guion de video).
- **`frontend/src/components/MetricsView/`**: Dashboard de evaluación de calidad, fidelidad RAG (`anclaje_fuente_score`), métricas de tiempo y estado de persistencia OCI.
- **`frontend/src/services/api.ts`**: Cliente HTTP basado en Axios configurado contra `http://localhost:8000` con manejo de multipart/form-data y fallbacks.

### 2. Capa de Servicios y API REST (Backend FastAPI)
- **`backend/app/main.py`**: Configuración de `FastAPI`, `CORSMiddleware` para puertos `5173` y `8000`, endpoints canónicos (`/health`, `/api/v1/config/opciones`, `/api/v1/adaptar`, `/api/v1/paquetes`) y singleton del orquestador.
- **`backend/app/core/ingestion.py`**: Extractor multi-formato para PDFs (limpieza de cabeceras y paginación vía `pypdf`), Markdown y TXT.
- **`backend/app/core/schemas.py`**: Contratos de datos estrictos en Pydantic v2 para los 5 formatos pedagógicos, solicitudes, respuestas y evaluaciones de anclaje.
- **`backend/app/core/config.py`**: Configuración centralizada y resolución tolerante de variables de entorno (`COHERE_*`, `OCI_*`, `AGENTE1_*`).

### 3. Capa de Inteligencia Multi-Agente (LangGraph)
- **`backend/app/orquestador.py`**: Grafo de ejecución determinista con ciclo de feedback reflexivo:
  - **Nodo RAG**: Indexación y recuperación contextual.
  - **Nodo Redacción**: Producción pedagógica con inyección de few-shots por formato.
  - **Nodo Crítica**: Fact-checking contra fuentes y cálculo de `anclaje_fuente_score`.
  - **Decisión / Bucle**: Aprobación directa si `anclaje >= 0.70`, o feedback correctivo con hasta `MAX_RETRIES = 2`.
  - **Nodo Persistir**: Persistencia híbrida mediante `almacenador_resiliente`.

### 4. Capa de Persistencia y Almacenamiento
- **ChromaDB**: Base vectorial local persistente (`data/chroma/` o `./chroma_db`) con métrica de similitud coseno (`cosine`).
- **OCI Object Storage Always Free (`backend/app/storage/oci_client.py`)**: Cliente oficial SDK (`oci.object_storage.UploadManager`) que persiste documentos originales en `documentos-originales/` y paquetes estructurados en `contenidos-generados/`.
- **Almacenamiento Local (`backend/app/storage/local_storage.py`)**: Respaldo automático transparente en `data/outputs/` si OCI está fuera de línea o sin credenciales configuradas.

## Flujo de Adaptación End-to-End

```mermaid
sequenceDiagram
  actor Usuario
  participant UI as Frontend React 19 (Vite)
  participant API as Backend FastAPI
  participant ORQ as Orquestador LangGraph
  participant RAG as Agente 1 (Investigador RAG)
  participant P as Agente 2 (Productor)
  participant C as Agente 3 (Crítico)
  participant S as Almacenador Híbrido (OCI / Local)

  Usuario->>UI: Sube documento o texto y selecciona perfil/formato
  UI->>API: POST /api/v1/adaptar (multipart/form-data)
  API->>API: Extrae texto y valida contrato Pydantic v2
  API->>ORQ: ejecutar(solicitud)
  ORQ->>RAG: Ingestar texto y recuperar fragmentos relevantes
  ORQ->>P: Generar material adaptado (inyección de few-shots)
  ORQ->>C: Auditar fidelidad contra fuentes (anclaje_fuente_score)
  alt anclaje < 0.70 y quedan reintentos
    C-->>ORQ: Feedback de corrección detallado
    ORQ->>P: Regenerar con feedback crítico
    ORQ->>C: Reevaluar calidad
  end
  ORQ->>S: Persistir documento original y paquete generado
  S-->>ORQ: Metadatos de persistencia (status_upload, objeto_id)
  ORQ-->>API: RespuestaAdaptacion completa
  API-->>UI: JSON HTTP 200 (contenido, evaluación y métricas)
  UI->>Usuario: Renderiza visualizador interactivo 3D y dashboard de anclaje
```

