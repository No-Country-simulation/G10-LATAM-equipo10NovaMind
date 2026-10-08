# 🧠 NovaMind — Microservicio Frontend (React 19 + Vite + TypeScript)

> **Plataforma Oficial:** NovaMind — Sistema Inteligente de Adaptación Pedagógica Multi-Agente RAG  
> **Tecnologías:** React 19, TypeScript, Vite 8, Lucide React, Canvas Confetti, OKLCH Tokens, CSS Modules  
> **Puerto por Defecto:** `http://localhost:5173`  
> **Backend Vinculado:** `http://127.0.0.1:8000` (FastAPI + LangGraph)  
> **Nube de Persistencia:** Oracle Cloud Infrastructure (OCI Always Free `sa-santiago-1`)  

---

## 📖 1. Visión General del Frontend

El frontend de **NovaMind** es una Single Page Application (SPA) modular de alta fidelidad estética (Dark Glassmorphism con paleta de tokens OKLCH y tipografías Syne + Plus Jakarta Sans). Guía al usuario en un circuito de aprendizaje gamificado estructurado en 3 pasos:

1. **Paso 1: Configuración e Ingesta (`Step1Ingestion`):**  
   - Ingesta de documentos técnicos reales (`.pdf`, `.md`, `.txt` o texto libre).
   - Botón directo de 1-click: **`⚡ Cargar Guía OCI Swap (Modo Demo)`** que precarga la guía oficial de aprovisionamiento de 4 GB Swap en instancias OCI Always Free (`VM.Standard.E2.1.Micro`).
   - Configuración pedagógica: perfil destinatario, formato, nicho de industria y nivel de detalle.
   - Pipeline de progreso en vivo con micro-etapas transparentes y salvaguarda *Zero-Crash* offline.

2. **Paso 2: Circuito Pedagógico Gamificado — 5 Estaciones (`Step2KnowledgeQuest`):**  
   - **Estación 1: Resumen Ninja (TL;DR):** Analogía central de alto impacto, matriz de métricas clave (riesgo, despliegue, costo $0.00 OCI) y conceptos verificados (+50 XP).
   - **Estación 2: Flashcard Quest (3D Flip & Mastery):** Tarjetas tridimensionales con giros interactivos, pistas didácticas y marcado de dominio (+100 XP).
   - **Estación 3: Tutorial Quest (Laboratorio CLI Interactivo):** Guía práctica técnica paso a paso con terminal sandbox simulada para ejecutar y validar los comandos de Linux/OCI (`fallocate`, `chmod 600`, `mkswap`, `swapon`, `/etc/fstab`, `swappiness=20`) (+150 XP).
   - **Estación 4: Director Cut (Storyboard & Teleprompter):** Guion audiovisual estructurado por escenas con minutaje, texto para locutor/profesor, storyboard visual y consejos pedagógicos (+100 XP).
   - **Estación 5: The Final Trial (Quiz con Escudos Cognitivos):** Cuestionario interactivo con retroalimentación RAG inmediata, citas textuales y penalización de escudos cognitivos ante respuestas incorrectas (+200 XP).

3. **Paso 3: Auditoría RAG & Persistencia OCI Cloud (`Step3OCICloud`):**  
   - Medidor visual del Score de Anclaje a la Fuente (Zero Hallucination Audit).
   - Metadatos de persistencia en Oracle Cloud Object Storage (`novamind-contenidos-educativos`, región `sa-santiago-1`, ETag verificado).
   - Exportación instantánea del paquete pedagógico en JSON estructurado.

4. **Capa Transversal de Gamificación (`PlayerHUD` & Recompensas):**  
   - Barra de estado superior con XP acumulado, racha de estudio diaria y 3 escudos cognitivos de protección.
   - Sistema de medallas y trofeos (`BadgeModal`) con efectos de confetti (`canvas-confetti`).

---

## ⚡ 2. Consideraciones Clave de la Integración con el Backend

1. **Variables de Entorno y URL de la API:**
   - Cliente HTTP (`frontend/src/services/api.ts`) apunta a `VITE_API_URL` (por defecto `http://localhost:8000`).
   - En producción (OCI Compute con Cloudflare Tunnel): `https://novamind.techgk.cl`.

2. **Protocolo Multipart (`POST /api/v1/adaptar`):**
   - Soporta documentos binarios (`.pdf`) y texto estructurado mediante `FormData`.
   - Soporte opcional de streaming Server-Sent Events (`POST /api/v1/adaptar/stream`).

3. **Tiempos de Respuesta del Pipeline Multi-Agente (Latencia Real Optimizada):**
   - Agente 1 (Investigador RAG con embeddings en Cohere y ChromaDB).
   - Agente 2 (Productor de Contenidos con Cohere `command-r-08-2024`, ~14-18s).
   - Agente 3 (Crítico con Gemini 2.5 Flash / Groq, ~1-2s).
   - Ciclo total promedio: **~18 segundos** por ejecución.

4. **Modo Demo / Resiliencia Offline (Zero-Crash Guarantee):**
   - Si el backend local no está encendido o la red no responde, el frontend activa de forma instantánea y fluida el banco de datos de alta fidelidad en `frontend/src/data/mockScenarios.ts`. Cero pantallas en blanco.

---

## 📊 3. Tabla Resumen: Componentes y Estaciones Pedagógicas

| Componente / Estación | Rol Arquitectónico | Ubicación en el Código | Estado | Descripción y Funcionalidad |
|---|---|---|:---:|---|
| **`App.tsx`** | Componente Raíz / Estado Global | [`src/App.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/App.tsx) | ✅ **Activo** | Gestiona el stepper principal (Pasos 1, 2, 3), sistema de XP, escudos cognitivos, medallas y orquesta la API. |
| **`PlayerHUD`** | Barra de Gamificación | [`src/components/PlayerHUD/PlayerHUD.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/PlayerHUD/PlayerHUD.tsx) | ✅ **Activo** | Muestra XP en tiempo real, días de racha, 3 escudos cognitivos y progreso de medallas. |
| **`Header`** | Barra de Identidad | [`src/components/Header/Header.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Header/Header.tsx) | ✅ **Activo** | Isotipo Möbius oficial, branding NovaMind, estado de conexión y acceso a perfil de usuario. |
| **`Step1Ingestion`** | Paso 1: Configuración & Ingesta | [`src/components/Step1Ingestion/Step1Ingestion.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step1Ingestion/Step1Ingestion.tsx) | ✅ **Activo** | Carga de archivos, botón de 1-click `⚡ Cargar Guía OCI Swap`, selección de perfiles y barra de progreso. |
| **`Step2KnowledgeQuest`** | Paso 2: Circuito 5 Estaciones | [`src/components/Step2KnowledgeQuest/Step2KnowledgeQuest.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step2KnowledgeQuest/Step2KnowledgeQuest.tsx) | ✅ **Activo** | Navegación entre las 5 estaciones pedagógicas, desbloqueo secuencial y cálculo de avance. |
| **`Station1ResumenNinja`** | Estación 1: Síntesis TL;DR | [`src/components/stations/Station1ResumenNinja/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station1ResumenNinja/Station1ResumenNinja.tsx) | ✅ **Activo** | Analogía central didáctica, métricas rápidas de impacto y conceptos clave verificados (+50 XP). |
| **`Station2FlashcardQuest`** | Estación 2: Tarjetas 3D | [`src/components/stations/Station2FlashcardQuest/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station2FlashcardQuest/Station2FlashcardQuest.tsx) | ✅ **Activo** | Flashcards tridimensionales interactivas, pistas didácticas y seguimiento de tarjetas dominadas (+100 XP). |
| **`Station3TutorialQuest`** | Estación 3: Laboratorio CLI | [`src/components/stations/Station3TutorialQuest/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station3TutorialQuest/Station3TutorialQuest.tsx) | ✅ **Activo** | Sandbox interactivo de terminal Linux con validación de comandos reales de OCI Swap (+150 XP). |
| **`Station4DirectorCut`** | Estación 4: Guion & Teleprompter | [`src/components/stations/Station4DirectorCut/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station4DirectorCut/Station4DirectorCut.tsx) | ✅ **Activo** | Storyboard visual de clase con minutaje, texto para locución y recomendaciones pedagógicas (+100 XP). |
| **`Station5Quiz`** | Estación 5: The Final Trial | [`src/components/stations/Station5Quiz/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station5Quiz/Station5Quiz.tsx) | ✅ **Activo** | Cuestionario desafiante con 3 escudos de protección, justificación RAG y citas a la fuente (+200 XP). |
| **`Step3OCICloud`** | Paso 3: Auditoría & Cloud | [`src/components/Step3OCICloud/Step3OCICloud.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step3OCICloud/Step3OCICloud.tsx) | ✅ **Activo** | Métricas de auditoría RAG, anclaje a la fuente, bucket OCI Always Free y exportación JSON. |
| **`BadgeModal`** | Modal de Recompensas | [`src/components/BadgeModal/BadgeModal.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/BadgeModal/BadgeModal.tsx) | ✅ **Activo** | Celebración visual interactiva al desbloquear medallas con confeti y botón para continuar. |

---

## 🛠️ 4. Estructura de Directorios

```text
frontend/
├── package.json               # Dependencias (React 19, Vite 8, Lucide, Canvas Confetti)
├── tsconfig.json              # Configuración base TypeScript
├── vite.config.ts             # Configuración de empaquetado Vite
├── index.html                 # Punto de entrada HTML con meta NovaMind
├── public/                    # Isotipo oficial SVG y recursos estáticos
│   ├── Isotipo.svg            # Isotipo Möbius NovaMind
│   └── IsotipoMonocromo.svg   # Versión monocromo
│
└── src/                       # Código fuente de la aplicación
    ├── main.tsx               # Montaje en React 19
    ├── App.tsx                # Orquestador del flujo, estado de gamificación y vistas
    ├── App.module.css         # Estilos globales y capas glassmorphism
    │
    ├── components/            # Componentes del sistema
    │   ├── Header/            # Barra superior con Isotipo Möbius y status
    │   ├── PlayerHUD/         # HUD de gamificación (XP, Racha, Escudos, Medallas)
    │   ├── AuthModal/         # Modal de autenticación y perfil de usuario
    │   ├── BadgeModal/        # Modal de celebración de medallas con confeti
    │   ├── Step1Ingestion/    # Paso 1: Ingesta de documentos & botón 1-click OCI Demo
    │   ├── Step2KnowledgeQuest/ # Paso 2: Orquestador del circuito de 5 estaciones
    │   │   └── stations/      # Las 5 estaciones de aprendizaje
    │   │       ├── Station1ResumenNinja/
    │   │       ├── Station2FlashcardQuest/
    │   │       ├── Station3TutorialQuest/
    │   │       ├── Station4DirectorCut/
    │   │       └── Station5Quiz/
    │   └── Step3OCICloud/     # Paso 3: Métricas de anclaje RAG y bucket OCI
    │
    ├── data/                  # Datos canónicos de prueba
    │   └── mockScenarios.ts   # Escenario 0 (OCI Swap 4 GB) y escenarios técnicos
    │
    ├── services/              # Comunicación con backend FastAPI y fallback
    │   └── api.ts
    │
    ├── types/                 # Tipado e interfaces completas del paquete pedagógico
    │   └── types.ts
    │
    ├── utils/                 # Utilidades (confetti, etc.)
    │   └── confetti.ts
    │
    └── styles/                # Tokens de diseño OKLCH y CSS global
        ├── tokens.css
        └── global.css
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

> 💡 **Nota de Ejecución Unificada:** Para arrancar todo el sistema (Backend FastAPI + Frontend Vite) en un solo paso en Windows, ejecuta [`iniciar_local.bat`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/iniciar_local.bat) desde la raíz del repositorio.

---

## 📚 6. Documentación Relacionada del Proyecto

Para más detalles sobre la arquitectura integral y la evolución del sistema, consultar:
* [guia_optimizacion_swap_oci.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/data/documents/guia_optimizacion_swap_oci.md): Documentación oficial del benchmark y guía técnica de memoria Swap OCI.
* [CAMBIOS.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/CAMBIOS.md): Bitácora cronológica de versiones y cambios del proyecto.
* [README.md Maestro](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/README.md): Manual general y arquitectura unificada de NovaMind.
