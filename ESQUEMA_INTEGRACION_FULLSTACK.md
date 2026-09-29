# 🧩 Esquema de Integración Full-Stack: Frontend (React 19) + Backend (FastAPI + LangGraph)

> **Proyecto:** NuevaMente — Sistema Inteligente de Adaptación Pedagógica  
> **Arquitectura:** Microservicios Desacoplados con Comunicación Asíncrona REST / Multipart  
> **Fecha:** Septiembre de 2026  
> **Rama de Referencia:** `integracion`  

---

## 🏛️ 1. Diagrama de Arquitectura de Integración (Componentes y Flujo de Datos)

```mermaid
graph TB
    %% Estilos de Nodos
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef reactComp fill:#1e293b,stroke:#00e5ff,stroke-width:1.5px,color:#f8fafc;
    classDef api fill:#4c1d95,stroke:#a855f7,stroke-width:2px,color:#faf5ff;
    classDef langgraph fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#ecfdf5;
    classDef agent fill:#047857,stroke:#34d399,stroke-width:1.5px,color:#f0fdf4;
    classDef cloud fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#fff7ed;
    classDef db fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#eff6ff;

    %% FRONTEND REACT
    subgraph FRONTEND ["🖥️ MICROSERVICIO FRONTEND (React 19 + Vite · Puerto :5173)"]
        direction TB
        APP["<b>App.tsx (Orquestador UI)</b><br/>• Control de Stepper (3 pasos)<br/>• Estado 'adaptationResult'<br/>• Manejo de fallback resiliente"]:::client

        subgraph VISTAS ["Componentes Modulares de Vista"]
            INGEST["<b>IngestView</b><br/>• Input nativo File (PDF, MD, TXT)<br/>• Drag & Drop interactivo<br/>• Editor texto directo (min 40 chars)<br/>• Selectores de perfil y formato"]:::reactComp
            VIEWER["<b>ViewerView</b><br/>• Selector de pestañas dinámico<br/>• FlashcardViewer (giro 3D)<br/>• QuizViewer (multi-pregunta interactivo)<br/>• TutorialViewer, SummaryViewer, ScriptViewer"]:::reactComp
            METRICS["<b>MetricsView</b><br/>• Medidor fidelidad RAG (% anclaje)<br/>• Métricas LangGraph (chunks, intentos, seg)<br/>• Bucket OCI Always Free y Object ID<br/>• Descarga y copia JSON validado"]:::reactComp
        end

        API_SERVICE["<b>services/api.ts (Cliente HTTP)</b><br/>• fetchOpcionesConfig()<br/>• enviarAdaptacion(payload: AdaptarPayload)"]:::reactComp

        APP --> INGEST
        APP --> VIEWER
        APP --> METRICS
        INGEST --> API_SERVICE
    end

    %% CANAL DE COMUNICACIÓN
    API_SERVICE == "HTTP POST /api/v1/adaptar<br/>(Multipart FormData + CORS)" ==> FASTAPI_ROUTER
    API_SERVICE -. "HTTP GET /api/v1/config/opciones" .-> FASTAPI_ROUTER

    %% BACKEND FASTAPI
    subgraph BACKEND ["⚡ MICROSERVICIO BACKEND (FastAPI · Puerto :8000)"]
        direction TB
        FASTAPI_ROUTER["<b>FastAPI Router (main.py)</b><br/>• CORS Middleware (5173 habilitado)<br/>• Endpoint /api/v1/config/opciones<br/>• Endpoint POST /api/v1/adaptar<br/>• Endpoint GET /api/v1/paquetes"]:::api

        INGESTION["<b>Módulo de Ingesta (ingestion.py)</b><br/>• Extractor pypdf (limpieza y saneamiento)<br/>• Decodificador UTF-8 para MD y TXT"]:::api

        PYDANTIC_SCHEMAS["<b>Contratos Pydantic v2 (core/schemas.py)</b><br/>• SolicitudAdaptacion (normalización de alias)<br/>• Esquemas por formato (Flashcard, Quiz, Paso, etc.)<br/>• EvaluacionCalidad y RespuestaAdaptacion"]:::api

        FASTAPI_ROUTER --> INGESTION
        FASTAPI_ROUTER --> PYDANTIC_SCHEMAS
    end

    FASTAPI_ROUTER == "Invocación síncrona / hilo worker" ==> LG_GRAPH

    %% MOTOR MULTI-AGENTE LANGGRAPH
    subgraph LANGGRAPH ["🧠 MOTOR DE IA Y AGENTES (LangGraph · orquestador.py)"]
        direction TB
        LG_GRAPH["<b>StateGraph (OrquestadorNuevaMente)</b><br/>Ciclo iterativo de calidad y feedback correctivo"]:::langgraph

        AG1["<b>Agente 1: Investigador RAG</b><br/>• Chunking narrativo con overlap<br/>• Embeddings en lotes (Cohere Embed)<br/>• Búsqueda k-NN en ChromaDB"]:::agent

        AG2["<b>Agente 2: Productor de Contenido</b><br/>• Role prompting contextualizado<br/>• Few-shot específico según formato pedido<br/>• Generación estructurada JSON"]:::agent

        AG3["<b>Agente 3: Crítico de Calidad</b><br/>• Auditoría de afirmaciones vs fuente<br/>• Cálculo matemático de 'anclaje_fuente_score'<br/>• Gate de calidad: score >= 0.85 y claridad != 'Baja'"]:::agent

        LG_DECISION{"<b>Decisión de Calidad</b><br/>¿Aprobado?"}:::langgraph

        LG_GRAPH --> AG1
        AG1 --> AG2
        AG2 --> AG3
        AG3 --> LG_DECISION
        LG_DECISION -- "No (Reintento con feedback)" --> AG2
        LG_DECISION -- "Sí (O mejor intento agotado)" --> STORAGE_DISPATCHER
    end

    %% SERVICIOS DE PERSISTENCIA Y MODELOS EXTERNOS
    subgraph PERSISTENCIA ["💾 CAPA DE PERSISTENCIA HÍBRIDA"]
        STORAGE_DISPATCHER{"<b>Almacenador Híbrido Resiliente</b>"}:::cloud
        OCI_STORAGE[("<b>Oracle Cloud (OCI Object Storage)</b><br/>Bucket: nuevamente-contenidos-educativos<br/>Región: sa-santiago-1 (Always Free)")]:::cloud
        LOCAL_STORAGE[("<b>Almacenamiento Local de Respaldo</b><br/>backend/data/outputs/*.json<br/>(Fallback automático ante caídas de red)")]:::db
        CHROMA_DB[("<b>ChromaDB Local Vectorstore</b><br/>backend/data/chroma/")]:::db

        STORAGE_DISPATCHER -->|Principal| OCI_STORAGE
        STORAGE_DISPATCHER -.->|Fallback automático| LOCAL_STORAGE
    end

    subgraph CLOUD_AI ["🌐 SERVICIOS IA EN LA NUBE (Cohere)"]
        COHERE_EMBED["Cohere Embed Multilingual v3.0"]:::cloud
        COHERE_CHAT["Cohere Command R+"]:::cloud
    end

    AG1 <--> COHERE_EMBED
    AG1 <--> CHROMA_DB
    AG2 <--> COHERE_CHAT
    AG3 <--> COHERE_CHAT
    FASTAPI_ROUTER -.-> STORAGE_DISPATCHER
```

---

## 🔄 2. Diagrama de Secuencia End-to-End: Ciclo de Vida de una Adaptación

El siguiente diagrama detalla la interacción paso a paso desde que el usuario interactúa con la interfaz web hasta que se visualiza el contenido pedagógico auditado:

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant React as Frontend React 19 (:5173)
    participant ApiClient as services/api.ts
    participant FastAPI as FastAPI Router (:8000)
    participant Ingestion as ingestion.py
    participant LangGraph as Orquestador LangGraph
    participant Chroma as ChromaDB / Cohere
    participant LLM as Cohere Command R+
    participant OCI as OCI Object Storage

    %% FASE 1: INICIALIZACIÓN
    Note over Usuario, FastAPI: 1. Inicialización y Carga de Parámetros
    Usuario->>React: Abre http://localhost:5173
    React->>ApiClient: fetchOpcionesConfig()
    ApiClient->>FastAPI: GET /api/v1/config/opciones
    FastAPI-->>ApiClient: JSON con listas canónicas (perfiles, formatos, nichos, niveles)
    ApiClient-->>React: Actualiza selectores en IngestView

    %% FASE 2: INGESTA Y DISPARO
    Note over Usuario, FastAPI: 2. Carga de Documento y Solicitud
    Usuario->>React: Sube PDF/MD o ingresa texto directo
    Usuario->>React: Selecciona "Quiz Interactivo" + "Principiante"
    Usuario->>React: Clic en "Generar contenido educativo"
    React->>React: Activa indicador de carga y fases visuales
    React->>ApiClient: enviarAdaptacion(payload)
    ApiClient->>FastAPI: POST /api/v1/adaptar (Multipart FormData)

    %% FASE 3: BACKEND Y LANGGRAPH
    Note over FastAPI, OCI: 3. Ejecución del Pipeline Multi-Agente
    FastAPI->>Ingestion: Extrae y normaliza texto del documento
    Ingestion-->>FastAPI: Texto limpio verificado (>= 40 caracteres)
    FastAPI->>LangGraph: ejecutar(SolicitudAdaptacion)
    
    %% Agente 1
    LangGraph->>Chroma: Agente 1: Genera embeddings y recupera chunks clave (k-NN)
    Chroma-->>LangGraph: Chunks más relevantes ordenados
    
    %% Agente 2
    LangGraph->>LLM: Agente 2: Genera contenido con few-shot específico de Quiz
    LLM-->>LangGraph: Items generados (preguntas, opciones, justificaciones)
    
    %% Agente 3
    LangGraph->>LLM: Agente 3: Audita afirmaciones contra los chunks fuente
    LLM-->>LangGraph: Afirmaciones respaldadas vs no respaldadas
    LangGraph->>LangGraph: Calcula matemáticamente anclaje_fuente_score (ej. 0.98)
    
    %% Persistencia
    LangGraph->>OCI: Almacenador híbrido sube paquete JSON a OCI Object Storage
    OCI-->>LangGraph: Objeto persistido exitosamente (status: "completado")
    LangGraph-->>FastAPI: RespuestaAdaptacion completa

    %% FASE 4: RESPUESTA Y RENDERIZADO
    Note over React, Usuario: 4. Visualización Dinámica en Tiempo Real
    FastAPI-->>ApiClient: HTTP 200 OK (RespuestaAdaptacion JSON)
    ApiClient-->>React: Retorna objeto tipado
    React->>React: setAdaptationResult(data) + setCurrentStep(1)
    React->>React: Sincroniza pestaña activa con formato devuelto ("Quiz interactivo")
    React-->>Usuario: Renderiza QuizViewer con preguntas reales, selección y justificaciones
    
    Usuario->>React: Clic en "Ver métricas y OCI"
    React-->>Usuario: Muestra MetricsView con medidor de fidelidad RAG, métricas de orquestación y enlace a OCI
```

---

## 📊 3. Matriz de Contratos de Datos (Mapeo TypeScript ↔ Pydantic v2)

| Concepto | Tipo Frontend (`frontend/src/types/api.ts`) | Esquema Backend (`backend/app/core/schemas.py`) | Función en el Sistema |
|---|---|---|---|
| **Opciones Canónicas** | `ConfigOpciones` | `obtener_opciones_configuracion()` | Rellena los selectores de `IngestView` evitando valores inválidos. |
| **Payload de Ingesta** | `AdaptarPayload` (FormData) | `SolicitudAdaptacion` | Transfiere el archivo o texto directo con los 4 parámetros pedagógicos. |
| **Flashcard Item** | `FlashcardItem` (`frente`, `dorso`, `pista_didactica`) | `ItemFlashcard` | Alimenta el visor 3D interactivo con anclaje a fuentes. |
| **Quiz Item** | `QuizItem` (`pregunta`, `opciones[]`, `respuesta_correcta`, `justificacion`) | `ItemQuiz` | Alimenta el cuestionario interactivo multi-pregunta con retroalimentación inmediata. |
| **Tutorial Item** | `TutorialItem` (`numero_paso`, `titulo`, `instruccion`) | `ItemPaso` | Alimenta la guía práctica con checklist interactivo paso a paso. |
| **Resumen Item** | `SummaryItem` (`punto`, `por_que_importa`) | `ItemResumen` | Alimenta la síntesis ejecutiva rápida de lectura en 60 segundos. |
| **Guion Item** | `ScriptItem` (`minuto_aproximado`, `narracion`, `apoyo_visual_sugerido`) | `ItemSegmentoGuion` | Alimenta el guion técnico audiovisual con marcas de tiempo. |
| **Métricas de Auditoría** | `EvaluacionCalidad` (`anclaje_fuente_score`, `claridad_pedagogica`, `observaciones`) | `EvaluacionCalidad` | Muestra el porcentaje de anclaje RAG (Zero Hallucination) calculado en código. |
| **Persistencia Cloud** | `AlmacenamientoOCI` (`bucket`, `objeto_id`, `status_upload`) | `AlmacenamientoOCI` | Muestra el estado del bucket OCI Always Free y el identificador de descarga. |
| **Métricas LangGraph** | `MetricasOrquestacion` (`chunks_recuperados`, `intentos_redaccion`, `duracion_segundos`) | `MetricasOrquestacion` | Expone la telemetría operativa del ciclo iterativo de los agentes. |

---

## 🛡️ 4. Estrategia de Resiliencia y Fallback Dual

El sistema está diseñado para nunca interrumpir el aprendizaje del estudiante ante fallos de conectividad o infraestructura:

```text
                               ┌──────────────────────────────────────────────┐
                               │  Llamada HTTP a POST /api/v1/adaptar         │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                    ¿Backend FastAPI responde?
                                     /                       \
                                  SÍ                          NO
                                 /                              \
        ┌──────────────────────────────────┐        ┌──────────────────────────────────┐
        │ Procesa respuesta dinámica real  │        │ Conmuta a modo demostrativo     │
        │ y renderiza los items del LLM    │        │ canónico con banner no bloqueante│
        └────────────────┬─────────────────┘        └──────────────────────────────────┘
                         │
         ¿OCI Object Storage disponible?
          /                             \
        SÍ                               NO
       /                                   \
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ Sube a bucket OCI Santiago   │    │ Guarda automáticamente en    │
│ (nuevamente-contenidos-...)  │    │ data/outputs/ local          │
└──────────────────────────────┘    └──────────────────────────────┘
```

1. **Fallback de Backend a Frontend:** Si el backend estuviera apagado durante una revisión de UI, `App.tsx` captura la excepción, despliega un aviso informativo discreto y carga los datos canónicos de respaldo (`MOCK_RESPUESTA_ADAPTACION`).
2. **Fallback de Persistencia en Backend:** Si OCI Object Storage presenta indisponibilidad de credenciales o red, el orquestador conmuta en 0 milisegundos a `local_storage.py` en `backend/data/outputs/` sin lanzar errores al usuario.

---

## 🚀 5. Mapeo de Puertos y Puntos de Acceso

| Servicio | Tecnología | URL Local | Descripción |
|---|---|---|---|
| **Frontend Web** | React 19 + Vite 8 | `http://localhost:5173` | Interfaz SPA completa con GSAP, Lenis y diseño pedagógico. |
| **Backend API** | FastAPI + Uvicorn | `http://127.0.0.1:8000` | Servidor REST con orquestación LangGraph y ChromaDB. |
| **Swagger UI** | OpenAPI 3.1 | `http://127.0.0.1:8000/docs` | Documentación interactiva de todos los endpoints de la API. |
| **Base Vectorial** | ChromaDB Local | `backend/data/chroma/` | Persistencia vectorial de fragmentos indexados. |
| **Object Storage** | OCI Cloud | Bucket `nuevamente-contenidos-educativos` | Persistencia en la nube Always Free en la región `sa-santiago-1`. |
