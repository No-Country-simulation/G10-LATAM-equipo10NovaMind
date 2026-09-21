# Arquitectura y Mapa de Integración: Alejandro (A) vs. Pedro (P)

Este documento detalla la trazabilidad técnica de cada archivo y subsistema en la integración de **NuevaMente**, identificando qué parte fue aportada por **Alejandro (A)**, qué parte por **Pedro (P)**, y cuáles corresponden a la **Sinergia de Integración (A + P)**.

---

## 🗺️ Diagrama de Autoría y Flujo de Datos

```mermaid
graph TD
    %% =========================================================================
    %% ESTILOS VISUALES POR AUTORÍA
    %% =========================================================================
    classDef alejandro fill:#1e3a8a,stroke:#60a5fa,stroke-width:2px,color:#eff6ff;
    classDef pedro fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#ecfdf5;
    classDef sinergia fill:#581c87,stroke:#c084fc,stroke-width:2px,color:#faf5ff;
    classDef leyenda fill:#0f172a,stroke:#94a3b8,stroke-width:1.5px,color:#f8fafc;

    %% =========================================================================
    %% LEYENDA DE COLORES
    %% =========================================================================
    subgraph LEYENDA ["🏷️ CÓDIGO DE COLORES"]
        L_A["🔵 Aportado por Alejandro (A)"]:::alejandro
        L_P["🟢 Aportado por Pedro (P)"]:::pedro
        L_AP["🟣 Integración / Sinergia (A + P)"]:::sinergia
    end

    %% =========================================================================
    %% 1. INFRAESTRUCTURA Y CONTENEDORES (ALEJANDRO)
    %% =========================================================================
    subgraph INFRA ["🐳 1. INFRAESTRUCTURA Y DESPLIEGUE"]
        DOCKER_COMPOSE["<b>docker-compose.yml</b><br/>• Orquestación multi-contenedor<br/>• Red bridge interna<br/>• Healthcheck condicional<br/>• Puertos 8000 y 8501/8502"]:::alejandro
        DOCKERFILE_B["<b>backend/Dockerfile</b><br/>• Python 3.12.7-slim<br/>• Uvicorn keep-alive 120s"]:::alejandro
        DOCKERFILE_F["<b>frontend/Dockerfile</b><br/>• Python 3.12.7-slim<br/>• Streamlit headless"]:::alejandro
        ENV_FILE["<b>.env.example</b><br/>• Variables unificadas"]:::sinergia
    end

    %% =========================================================================
    %% 2. CAPA DE PRESENTACIÓN / FRONTEND
    %% =========================================================================
    subgraph FRONTEND ["🖥️ 2. CAPA DE PRESENTACIÓN (Streamlit)"]
        UI_BASE["<b>frontend/app/streamlit_app.py (Estructura Base)</b><br/>• Sidebar, selectores y file uploader<br/>• Indicador de conexión /health"]:::alejandro
        HTTP_CLIENT["<b>frontend/app/api_client.py</b><br/>• Cliente HTTP desacoplado<br/>• Timeout extendido (180s)<br/>• Fallback de opciones"]:::alejandro
        UI_RENDERERS["<b>Renderizadores para los 5 Formatos</b><br/>• Tarjetas interactivas de Flashcards<br/>• Quiz interactivo con justificación<br/>• Guía paso a paso con tips<br/>• Resumen ejecutivo TL;DR<br/>• Guion de video temporizado"]:::sinergia
        
        UI_BASE --- UI_RENDERERS
        UI_BASE --> HTTP_CLIENT
    end

    %% =========================================================================
    %% 3. CAPA DE SERVICIO / API REST
    %% =========================================================================
    subgraph API_REST ["⚡ 3. CAPA DE SERVICIO (FastAPI)"]
        FASTAPI["<b>backend/app/main.py</b><br/>• Servidor REST FastAPI<br/>• GET /health<br/>• GET /api/v1/config/opciones<br/>• POST /api/v1/adaptar (multipart)"]:::sinergia
        INGESTION["<b>backend/app/core/ingestion.py</b><br/>• Extractor PDF (pypdf) con limpieza<br/>• Extractor Markdown / TXT (UTF-8)"]:::alejandro
        
        FASTAPI --> INGESTION
    end

    %% =========================================================================
    %% 4. MOTOR DE IA Y AGENTES (PEDRO)
    %% =========================================================================
    subgraph IA_ENGINE ["🧠 4. MOTOR DE IA Y AGENTES MULTI-AGENTE (LangGraph)"]
        ORQUESTADOR["<b>backend/app/orquestador.py</b><br/>• Grafo de ejecución cíclico<br/>• Ciclos de reintentos por calidad<br/>• Detección de errores transitorios"]:::pedro

        AG1["<b>agente1_investigador.py</b><br/>• Ingesta y chunking por palabras<br/>• Cohere embed-multilingual-v3.0<br/>• ChromaDB nativo persistente"]:::pedro
        AG2["<b>agente2_productor.py</b><br/>• Cohere Command R+<br/>• Prompts adaptativos por perfil<br/>• Few-shots específicos por formato"]:::pedro
        AG3["<b>agente3_critico.py</b><br/>• Auditoría de hechos contra chunks<br/>• Cálculo de anclaje_fuente_score<br/>• Feedback correctivo guiado"]:::pedro

        SCHEMAS["<b>core/schemas.py</b><br/>• Pydantic v2 estricto<br/>• Modelos de los 5 formatos<br/>• Normalización de alias"]:::pedro
        PROMPTS["<b>core/prompts.py</b><br/>• System prompts y few-shots"]:::pedro
        CONFIG_P["<b>core/config.py</b><br/>• Validación de variables de entorno"]:::pedro

        ORQUESTADOR --> AG1
        ORQUESTADOR --> AG2
        ORQUESTADOR --> AG3
        AG1 & AG2 & AG3 --- SCHEMAS
        AG2 --- PROMPTS
        ORQUESTADOR --- CONFIG_P
    end

    %% =========================================================================
    %% 5. CAPA DE ALMACENAMIENTO Y PERSISTENCIA
    %% =========================================================================
    subgraph STORAGE ["💾 5. CAPA DE ALMACENAMIENTO"]
        MOCK_STORAGE["<b>backend/app/storage/local_storage.py (ACTIVO)</b><br/>• Persistencia local en data/outputs/<br/>• Simulación de AlmacenamientoOCI"]:::sinergia
        OCI_STORAGE["<b>backend/app/storage/oci_client.py (AISLADO)</b><br/>• Cliente OCI Object Storage SDK real<br/>• Listo para activación con credenciales"]:::alejandro

        ORQUESTADOR --> MOCK_STORAGE
        ORQUESTADOR -.->|Listo para conectar| OCI_STORAGE
    end

    %% =========================================================================
    %% 6. TESTING Y VALIDACIÓN (PEDRO + API)
    %% =========================================================================
    subgraph TESTS ["🧪 6. SUITE DE PRUEBAS (63 Tests Pasados)"]
        TEST_ORQ["<b>tests/test_orquestador.py (56 tests)</b><br/>• Mocks, grafos, regresión de etiquetas"]:::pedro
        TEST_OFF["<b>tests/test_integracion_offline.py (3 tests)</b><br/>• Pipeline E2E con Cohere simulado"]:::pedro
        TEST_API["<b>tests/test_api.py (4 tests)</b><br/>• Endpoints FastAPI y validación HTTP"]:::sinergia
    end

    %% =========================================================================
    %% CONEXIONES ENTRE CAPAS
    %% =========================================================================
    HTTP_CLIENT -- "HTTP POST /api/v1/adaptar (Multipart)" --> FASTAPI
    INGESTION -- "DocumentoIngresado (Texto limpio)" --> ORQUESTADOR
```

---

## 📋 Matriz Detallada de Componentes

| Subcutis / Componente | Archivo / Ruta | Autoría Principal | Responsabilidad / Descripción |
| :--- | :--- | :---: | :--- |
| **Orquestación Docker** | [docker-compose.yml](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/docker-compose.yml) | **Alejandro (A)** | Red bridge, dependencia con healthcheck, mapeo de volúmenes y puertos (8000, 8501/8502). |
| **Imágenes Docker** | `backend/Dockerfile` / `frontend/Dockerfile` | **Alejandro (A)** | Configuración multi-etapa con **Python 3.12.7-slim**. |
| **Extracción de Documentos** | [backend/app/core/ingestion.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/core/ingestion.py) | **Alejandro (A)** | Ingesta binaria de PDFs con `pypdf` (limpieza de encabezados repetidos) y archivos Markdown/TXT. |
| **Cliente OCI Real** | [backend/app/storage/oci_client.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/storage/oci_client.py) | **Alejandro (A)** | Conexión con Oracle Cloud Object Storage SDK (`oci`) para subir documentos y JSON generados. |
| **Cliente HTTP Frontend** | [frontend/app/api_client.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/app/api_client.py) | **Alejandro (A)** | Envío multipart por HTTP con `requests`, manejo de errores y timeout de 180s. |
| **UI Base Streamlit** | [frontend/app/streamlit_app.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/app/streamlit_app.py) | **Alejandro (A)** | Estructura de barra lateral, subida de archivos, estados de carga y tarjeta de salud `/health`. |
| **Orquestador LangGraph** | [backend/app/orquestador.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/orquestador.py) | **Pedro (P)** | Grafo de estados, reintentos guiados por feedback y contratos `Protocol`. |
| **Agente 1: Investigador RAG** | [backend/app/agentes/agente1_investigador.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/agentes/agente1_investigador.py) | **Pedro (P)** | Chunking con solapamiento, embeddings multilingües de Cohere y base vectorial ChromaDB nativa. |
| **Agente 2: Productor** | [backend/app/agentes/agente2_productor.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/agentes/agente2_productor.py) | **Pedro (P)** | Adaptación pedagógica con Cohere Command R+, few-shots específicos por formato y salida estructurada. |
| **Agente 3: Crítico** | [backend/app/agentes/agente3_critico.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/agentes/agente3_critico.py) | **Pedro (P)** | Fact-checking matemático de afirmaciones contra fuentes y cálculo de `anclaje_fuente_score`. |
| **Contratos y Esquemas Pydantic** | [backend/app/core/schemas.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/core/schemas.py) | **Pedro (P)** | Modelos Pydantic v2 de los 5 formatos pedagógicos con normalización de alias del brief. |
| **Plantillas de Prompts** | [backend/app/core/prompts.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/core/prompts.py) | **Pedro (P)** | Prompts de sistema y ejemplos de transformación few-shot por cada formato. |
| **Suite de Tests (59 tests)** | `tests/test_orquestador.py` / `test_integracion_offline.py` | **Pedro (P)** | Pruebas deterministas sin costo de API para validar el 100% de la lógica de agentes. |
| **API REST FastAPI** | [backend/app/main.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/main.py) | **Sinergia (A + P)** | Estructura web de Alejandro exponiendo el orquestador y los esquemas de Pedro. |
| **Maqueta de Almacenamiento Local** | [backend/app/storage/local_storage.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/app/storage/local_storage.py) | **Sinergia (A + P)** | Persistencia en `data/outputs/` cumpliendo el contrato `Almacenador` de Pedro. |
| **Renderizadores Visuales de Formatos** | `frontend/app/streamlit_app.py` (componentes) | **Sinergia (A + P)** | Componentes Streamlit para dibujar interactivamente los 5 esquemas ricos de Pedro. |
| **Pruebas de la API** | [backend/tests/test_api.py](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/backend/tests/test_api.py) | **Sinergia (A + P)** | 4 tests automatizados que validan los endpoints de FastAPI con TestClient. |
