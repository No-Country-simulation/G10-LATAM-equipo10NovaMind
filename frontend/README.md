# 🖥️ NuevaMente — Microservicio Frontend (React 19 + Vite + TypeScript)

> **Plataforma:** NuevaMente — Sistema Inteligente de Adaptación Pedagógica  
> **Tecnologías:** React 19, TypeScript, Vite 8, GSAP, Lenis Smooth Scroll, Lucide React, CSS Modules  
> **Puerto por Defecto:** `http://localhost:5173`  
> **Backend Vinculado:** `http://127.0.0.1:8000` (FastAPI + LangGraph)  

---

## 📖 1. Visión General del Frontend

El frontend de **NuevaMente** es una Single Page Application (SPA) modular diseñada con una estética moderna en tema oscuro (Dark Glassmorphism). Su función principal es guiar al estudiante o profesional en un flujo interactivo de 3 pasos:

1. **Paso 1: Configuración e Ingesta (`IngestView`):** Carga de material técnico de referencia (PDF, Markdown, TXT o texto directo) y parametrización pedagógica (perfil destinatario, formato pedagógico, nicho y nivel de detalle).
2. **Paso 2: Visualizador Educativo Adaptativo (`ViewerView`):** Renderizado dinámico e interactivo del material generado según el formato pedagógico devuelto por el motor multi-agente (Flashcards 3D, Quiz interactivo con justificaciones, Guía práctica / Tutorial, Resumen ejecutivo o Guion audiovisual).
3. **Paso 3: Auditoría y Persistencia Cloud (`MetricsView`):** Visualización del porcentaje de anclaje RAG (Zero Hallucination), métricas operativas de LangGraph (chunks recuperados, intentos de redacción, duración) y metadatos de persistencia en Oracle Cloud Infrastructure (OCI Object Storage Always Free).

---

## ⚡ 2. Consideraciones Clave de la Integración con el Backend

Al trabajar o desplegar este microservicio, se deben tener en cuenta los siguientes lineamientos de integración:

1. **Variables de Entorno y URL de la API:**
   - Por defecto, el cliente HTTP (`frontend/src/services/api.ts`) busca la variable `VITE_API_URL`.
   - Si no está definida en un archivo `.env` local del frontend, toma por fallback `http://localhost:8000`.
   - Para producción o entornos remotos (ej. OCI Compute con Cloudflare Tunnel), configurar `VITE_API_URL=https://tu-dominio-api.com`.

2. **Protocolo de Envío Multipart (`POST /api/v1/adaptar`):**
   - La ingesta no utiliza JSON plano para la entrada debido a que soporta subida de archivos binarios (`.pdf`) y documentos de texto (`.md`, `.txt`).
   - Se utiliza `FormData` (`multipart/form-data`) tanto si el usuario arrastra un archivo como si escribe texto libre en el área editable.

3. **Restricción de Longitud Mínima del Documento:**
   - El backend exige que el contenido a adaptar tenga **al menos 40 caracteres** (regla de validación en `SolicitudAdaptacion` de Pydantic v2).
   - El frontend valida y precarga un texto canónico para evitar que peticiones vacías generen un error `HTTP 422`.

4. **Tiempos de Respuesta del Pipeline Multi-Agente (Latencia Real):**
   - A diferencia de un CRUD tradicional, la adaptación pedagógica involucra:
     1. Chunking y generación de embeddings en Cohere (`embed-multilingual-v3.0`).
     2. Búsqueda vectorial en ChromaDB.
     3. Redacción con LLM Cohere Command R+ (Agente 2).
     4. Auditoría de afirmaciones y fact-checking (Agente 3).
     5. Potenciales reintentos automáticos si el score de anclaje no alcanza el umbral (`0.75`).
     6. Persistencia del paquete JSON en OCI Object Storage.
   - Este ciclo toma entre **25 y 90 segundos** por intento. La interfaz muestra un indicador de fases animado (`loadingTrack` con 3 etapas) para informar el progreso al usuario.

5. **Manejo Resiliente de Fallback (Modo Demostrativo sin Caídas):**
   - Si el backend local no estuviera levantado o presentara problemas de conexión, `App.tsx` captura el fallo de red, despliega un aviso informativo discreto ("Modo Respaldo: Servidor no disponible") y carga los datos canónicos de demostración (`MOCK_RESPUESTA_ADAPTACION`). La interfaz nunca colapsa ni queda en blanco.

6. **Soporte de CORS en el Backend:**
   - El backend FastAPI tiene habilitado CORS explícito para `http://localhost:5173`, `http://127.0.0.1:5173` y cualquier puerto localhost dinámico con `allow_credentials=True`.

---

## 📊 3. Tabla Resumen: Estado General de Componentes y Funciones

A continuación se detalla el estado actual de cada componente, servicio y contrato en el frontend:

| Componente / Función | Rol Arquitectónico | Ubicación en el Código | Estado | Descripción y Responsabilidad |
|---|---|---|:---:|---|
| **`App.tsx`** | Componente Raíz / Orquestador UI | [`src/App.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/App.tsx) | ✅ **Activo (Live)** | Gestiona el estado global de navegación (`currentStep`), almacena `adaptationResult`, maneja el fallback ante caídas y orquesta el scroll suave con Lenis y animaciones GSAP. |
| **`Header`** | Barra Superior | [`src/components/Header/Header.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Header/Header.tsx) | ✅ **Activo** | Despliega el logotipo de NuevaMente, el estado del sistema ("Sistema Activo") y el título adaptado del documento en tiempo real. |
| **`Stepper`** | Barra de Pasos | [`src/components/Stepper/Stepper.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/Stepper/Stepper.tsx) | ✅ **Activo** | Permite visualizar el avance y navegar entre los 3 pasos: *Configuración e ingesta*, *Visualizar resultados*, *Métricas y OCI Cloud*. |
| **`IngestView`** | Vista Paso 1: Ingesta | [`src/components/IngestView/IngestView.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/IngestView/IngestView.tsx) | ✅ **Activo (Live)** | Captura de archivos reales (`.pdf`, `.md`, `.txt`) con drag & drop o textarea libre; selectores de perfil, formato, nicho y nivel; disparador con barra de progreso multietapa. |
| **`SelectField`** | Control Reutilizable | [`src/components/SelectField/SelectField.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/SelectField/SelectField.tsx) | ✅ **Activo** | Renderiza menús desplegables estilizados y accesibles para las opciones pedagógicas canónicas. |
| **`ViewerView`** | Vista Paso 2: Visor Principal | [`src/components/ViewerView/ViewerView.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/ViewerView.tsx) | ✅ **Activo (Live)** | Sincroniza la pestaña activa según el formato generado por el backend, muestra metadatos pedagógicos (perfil, tiempo, conceptos clave) y enruta al subvisor correspondiente. |
| **`FlashcardViewer`** | Subvisor: Tarjetas 3D | [`src/components/ViewerView/FlashcardViewer/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/FlashcardViewer/FlashcardViewer.tsx) | ✅ **Activo (Live)** | Tarjetas de memorización interactivas con giro 3D en CSS, preguntas en el frente, explicaciones y pistas didácticas en el reverso, y botones de auto-evaluación. |
| **`QuizViewer`** | Subvisor: Cuestionario | [`src/components/ViewerView/QuizViewer/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/QuizViewer/QuizViewer.tsx) | ✅ **Activo (Live)** | Evaluación interactiva multi-pregunta con selección de opciones (A, B, C, D), validación inmediata de respuesta correcta e incorrecta, y justificación pedagógica en vivo. |
| **`TutorialViewer`** | Subvisor: Guía Práctica | [`src/components/ViewerView/TutorialViewer/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/TutorialViewer/TutorialViewer.tsx) | ✅ **Activo (Live)** | Muestra pasos técnicos estructurados con checklist interactivo que permite al estudiante marcar pasos completados. |
| **`SummaryViewer`** | Subvisor: Resumen TL;DR | [`src/components/ViewerView/SummaryViewer/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/SummaryViewer/SummaryViewer.tsx) | ✅ **Activo (Live)** | Síntesis ejecutiva de lectura rápida con introducción contextualizada, puntos clave y explicaciones de "por qué importa". |
| **`ScriptViewer`** | Subvisor: Guion Audiovisual | [`src/components/ViewerView/ScriptViewer/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/ViewerView/ScriptViewer/ScriptViewer.tsx) | ✅ **Activo (Live)** | Desglose temporal de escenas con marcas de tiempo (timestamps), texto de locución sugerido y apoyos visuales para el instructor. |
| **`MetricsView`** | Vista Paso 3: Auditoría y Cloud | [`src/components/MetricsView/MetricsView.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/MetricsView/MetricsView.tsx) | ✅ **Activo (Live)** | Despliega el medidor circular de anclaje RAG (Zero Hallucination), observaciones del Agente Crítico, telemetría LangGraph, estado del bucket OCI y visor/descarga de JSON. |
| **`fetchOpcionesConfig`** | Función de Servicio HTTP | [`src/services/api.ts`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/services/api.ts) | ✅ **Activo** | Ejecuta `GET /api/v1/config/opciones` para obtener perfiles y formatos canónicos de Pydantic, con respaldo offline canónico si no hay red. |
| **`enviarAdaptacion`** | Función de Servicio HTTP | [`src/services/api.ts`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/services/api.ts) | ✅ **Activo** | Empaqueta `AdaptarPayload` en `FormData` y despacha `POST /api/v1/adaptar`, parseando la respuesta tipada `RespuestaAdaptacion`. |
| **Contratos TypeScript** | Tipado e Interfaces | [`src/types/api.ts`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/types/api.ts) | ✅ **Activo** | Definición estricta de interfaces (`FlashcardItem`, `QuizItem`, `TutorialItem`, `SummaryItem`, `ScriptItem`, `MetricasOrquestacion`, `RespuestaAdaptacion`). |

---

## 🛠️ 4. Estructura de Directorios

```text
frontend/
├── package.json               # Dependencias (React 19, Vite 8, GSAP, Lenis, Lucide)
├── tsconfig.json              # Configuración base TypeScript
├── vite.config.ts             # Configuración del servidor de desarrollo y empaquetador
├── index.html                 # Punto de entrada HTML
├── public/                    # Recursos estáticos públicos
│
└── src/                       # Código fuente de la aplicación
    ├── main.tsx               # Montaje del Virtual DOM en React 19
    ├── App.tsx                # Orquestador principal de estado y vistas
    ├── App.module.css         # Estilos y efectos de luz ambiental
    │
    ├── components/            # Componentes de la interfaz de usuario
    │   ├── Header/            # Barra superior de la plataforma
    │   ├── Stepper/           # Control del progreso en 3 pasos
    │   ├── SelectField/       # Selector pedagógico estilizado
    │   ├── IngestView/        # Paso 1: Ingesta de documentos y parámetros
    │   ├── ViewerView/        # Paso 2: Visores pedagógicos
    │   │   ├── FlashcardViewer/ # Tarjetas didácticas 3D
    │   │   ├── QuizViewer/      # Cuestionario interactivo multi-pregunta
    │   │   ├── TutorialViewer/  # Guía técnica paso a paso
    │   │   ├── SummaryViewer/   # Resumen ejecutivo TL;DR
    │   │   └── ScriptViewer/    # Guion audiovisual temporizado
    │   └── MetricsView/       # Paso 3: Métricas RAG, LangGraph y OCI Cloud
    │
    ├── services/              # Capa de comunicación HTTP
    │   └── api.ts             # Cliente fetch hacia FastAPI y mock de respaldo
    │
    ├── styles/                # Design tokens y reset CSS
    │   ├── tokens.css         # Variables CSS de color, tipografía y sombras
    │   └── global.css         # Estilos globales de página
    │
    └── types/                 # Modelos de datos TypeScript
        └── api.ts             # Contratos sincronizados con Pydantic v2
```

---

## 🚀 5. Scripts de Ejecución y Validación

Desde la carpeta `frontend/`:

```powershell
# 1. Instalar dependencias
npm.cmd install

# 2. Iniciar servidor de desarrollo en http://localhost:5173
npm.cmd run dev

# 3. Compilación de producción (TypeScript estricto + Vite bundle)
npm.cmd run build

# 4. Previsualizar el bundle de producción
npm.cmd run preview
```

> 💡 **Nota:** Para arrancar todo el sistema (Backend FastAPI + Frontend Vite) en un solo paso en Windows, puedes ejecutar [`iniciar_local.bat`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/iniciar_local.bat) desde la raíz del repositorio.
