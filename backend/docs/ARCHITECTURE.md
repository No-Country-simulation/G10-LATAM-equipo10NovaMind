# Arquitectura del sistema

## Vista general

El repositorio separa una interfaz Streamlit, una API FastAPI y un motor de adaptación educativa con agentes. El flujo principal recibe texto/documento, lo valida, lo indexa/consulta, genera contenido, lo evalúa y persiste el resultado.

```mermaid
flowchart LR
  U[Usuario] --> UI[Frontend Streamlit]
  UI -->|HTTP multipart/form-data| API[FastAPI app/main.py]
  API --> ING[Ingesta PDF/MD/TXT]
  ING --> ORQ[OrquestadorNuevaMente]
  ORQ --> INV[Agente investigador]
  INV --> CH[ChromaDB / recuperación]
  ORQ --> PROD[Agente productor]
  PROD --> LLM[Proveedor de modelo]
  ORQ --> CRIT[Agente crítico]
  CRIT --> LLM
  ORQ --> STORE[Adaptador de almacenamiento]
  STORE --> LOCAL[Archivos locales]
  STORE -. integración opcional .-> OCI[OCI Object Storage]
  API --> UI
```

## Componentes
- **`backend/app/main.py`**: crea `FastAPI`, configura CORS, define endpoints y obtiene un singleton del orquestador.
- **`backend/app/orquestador.py`**: flujo LangGraph principal: ingesta/indexación, recuperación, redacción, crítica, finalización y persistencia; incorpora rutas de error, reintentos y métricas.
- **`backend/app/agentes/agente1_investigador.py`**: búsqueda y gestión de fragmentos para contexto.
- **`backend/app/agentes/agente2_productor.py`**: generación del paquete educativo a partir del contexto y parámetros.
- **`backend/app/agentes/agente3_critico.py`**: evalúa el anclaje del contenido y la claridad pedagógica.
- **`backend/app/core/ingestion.py`**: extrae texto de PDF, Markdown y TXT; guarda los bytes recibidos bajo `data/documents`.
- **`backend/app/core/rag_pipeline.py`**: segmentación de texto, embeddings y almacenamiento/consulta Chroma.
- **`backend/app/core/schemas.py`**: contratos Pydantic, normalización de opciones y validación de estructuras.
- **`backend/app/core/config.py`**: configuración del orquestador basado en Cohere.
- **`backend/app/storage/local_storage.py`**: persistencia local que simula la estructura de OCI.
- **`backend/app/storage/oci_client.py`**: cliente OCI real, condicionado a configuración y credenciales.
- **Frontend**: `streamlit_app.py` presenta la UI y `api_client.py` encapsula llamadas HTTP.

## Flujo de adaptación

```mermaid
sequenceDiagram
  actor Usuario
  participant UI as Streamlit
  participant API as FastAPI
  participant ORQ as Orquestador
  participant RAG as Investigador/RAG
  participant P as Productor
  participant C as Crítico
  participant S as Almacenamiento
  Usuario->>UI: Selecciona archivo/texto y parámetros
  UI->>API: POST /api/v1/adaptar (multipart/form-data)
  API->>API: Extrae texto y valida solicitud
  API->>ORQ: ejecutar(solicitud)
  ORQ->>RAG: Ingestar y recuperar fragmentos
  ORQ->>P: Generar material
  ORQ->>C: Evaluar fidelidad y claridad
  alt Calidad insuficiente y quedan reintentos
    C-->>ORQ: Feedback de corrección
    ORQ->>P: Regenerar con feedback
    ORQ->>C: Reevaluar
  end
  ORQ->>S: Persistir resultado
  ORQ-->>API: RespuestaAdaptacion
  API-->>UI: JSON
```

## Límites de la arquitectura
No se encontró una base de datos relacional ni un esquema de tablas. Chroma actúa como índice vectorial persistente. El cliente OCI existe, pero el modo efectivo depende de variables y del adaptador elegido al construir el orquestador. Los documentos y paquetes locales se guardan en el sistema de archivos.
