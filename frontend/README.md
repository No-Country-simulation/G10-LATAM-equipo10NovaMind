# 🧠 NuevaMente — Microservicio Frontend (React 19 + Vite + TypeScript)

> **Plataforma Oficial:** NuevaMente — Sistema Inteligente de Adaptación Pedagógica Multi-Agente RAG  
> **Tecnologías:** React 19, TypeScript, Vite 8, Lucide React, Canvas Confetti, OKLCH Tokens, CSS Modules  
> **Puerto por Defecto:** `http://localhost:5173`  
> **Backend Vinculado:** `http://127.0.0.1:8000` (FastAPI + LangGraph)  
> **Nube de Persistencia:** Oracle Cloud Infrastructure (OCI Always Free `sa-santiago-1`)  

---

## 📖 1. Visión General del Frontend

El frontend de **NuevaMente** es una Single Page Application (SPA) modular de alta fidelidad estética (Dark Glassmorphism con paleta de tokens OKLCH y tipografías Syne + Plus Jakarta Sans). Guía al usuario en un circuito de aprendizaje gamificado estructurado en 3 pasos:

1. **Paso 1: Configuración e Ingesta (`Step1Ingestion`):**  
   - **Sin sesión:** se elige un documento de la biblioteca (Don Quijote I y II, Apache Kafka, ENISA, Snowflake, Guía OCI), con perfil, sector y nivel fijos, y se abre su muestra pregenerada (`public/ejemplos/`), sin gastar cuota. El botón **«Prueba rápida 😊»** hace lo mismo en un clic.
   - **Con sesión:** además se puede subir un documento propio (`.pdf`, `.md`, `.txt` o imagen) y elegir perfil, sector y nivel («Antes de empezar 👀 selecciona tu perfil»: Personalizado por defecto o «Sorpréndeme», perfil al azar). Con un documento de la biblioteca se puede ver la muestra o generar con los propios ajustes.
   - Pipeline de progreso en vivo con micro-etapas transparentes y salvaguarda *Zero-Crash* offline.

2. **Paso 2: Circuito Pedagógico Gamificado — 5 Estaciones (`Step2KnowledgeQuest`):**  
   - **Estación 1 · Resumen:** analogía central, conceptos verificados con su fuente, resumen por secciones (desplegable) y diagrama Mermaid.
   - **Estación 2 · Tarjetas didácticas:** tarjetas 3D con pista; cada una se marca como «Concepto dominado».
   - **Estación 3 · Guía paso a paso:** «¿Cuál es la meta de leer "‹título›"?» con los objetivos de aprendizaje; cada paso con qué hacer, el comando (solo si es real) o la clave del paso, y cómo saber que se logró.
   - **Estación 4 · Contenido AudioVisual:** teleprompter, pizarra y la microclase narrada como video con Remotion Player (subtítulos opcionales, pantalla completa al reproducir).
   - **Estación 5 · Cuestionario:** examen final sobre lo que enseñaron las estaciones anteriores, con citas a la fuente, escudos y repaso de errores.

3. **Paso 3: Auditoría RAG & Persistencia OCI Cloud (`Step3OCICloud`):**  
   - Medidor visual del Score de Anclaje a la Fuente (Zero Hallucination Audit).
   - Metadatos de persistencia en Oracle Cloud Object Storage (`nuevamente-contenidos-educativos`, región `sa-santiago-1`, ETag verificado).
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
| **`Header`** | Barra de Identidad | [`src/components/Header/Header.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Header/Header.tsx) | ✅ **Activo** | Isotipo Möbius oficial, branding NuevaMente, estado de conexión y acceso a perfil de usuario. |
| **`Step1Ingestion`** | Paso 1: Configuración & Ingesta | [`src/components/Step1Ingestion/Step1Ingestion.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step1Ingestion/Step1Ingestion.tsx) | ✅ **Activo** | Biblioteca con ajustes fijos, «Prueba rápida 😊» (muestra pregenerada) y, con sesión, carga de archivos y elección de perfil. |
| **`Step2KnowledgeQuest`** | Paso 2: Circuito 5 Estaciones | [`src/components/Step2KnowledgeQuest/Step2KnowledgeQuest.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step2KnowledgeQuest/Step2KnowledgeQuest.tsx) | ✅ **Activo** | Navegación entre las 5 estaciones pedagógicas, desbloqueo secuencial y cálculo de avance. |
| **`Station1ResumenNinja`** | Estación 1: Resumen | [`src/components/stations/Station1ResumenNinja/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station1ResumenNinja/Station1ResumenNinja.tsx) | ✅ **Activo** | Analogía central didáctica, métricas rápidas de impacto y conceptos clave verificados (+50 XP). |
| **`Station2FlashcardQuest`** | Estación 2: Tarjetas didácticas | [`src/components/stations/Station2FlashcardQuest/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station2FlashcardQuest/Station2FlashcardQuest.tsx) | ✅ **Activo** | Flashcards tridimensionales interactivas, pistas didácticas y seguimiento de tarjetas dominadas (+100 XP). |
| **`Station3TutorialQuest`** | Estación 3: Guía paso a paso | [`src/components/stations/Station3TutorialQuest/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station3TutorialQuest/Station3TutorialQuest.tsx) | ✅ **Activo** | Meta del documento, objetivos de aprendizaje y pasos; terminal solo para comandos reales. |
| **`Station4DirectorCut`** | Estación 4: Contenido AudioVisual | [`src/components/stations/Station4DirectorCut/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station4DirectorCut/Station4DirectorCut.tsx) | ✅ **Activo** | Teleprompter, pizarra por escena y microclase narrada con Remotion Player. |
| **`Station5Quiz`** | Estación 5: Cuestionario | [`src/components/stations/Station5Quiz/`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/frontend/src/components/stations/Station5Quiz/Station5Quiz.tsx) | ✅ **Activo** | Examen final sobre lo que enseñaron las estaciones 1 a 4, con escudos y citas a la fuente. |
| **`Step3OCICloud`** | Paso 3: Auditoría & Cloud | [`src/components/Step3OCICloud/Step3OCICloud.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/Step3OCICloud/Step3OCICloud.tsx) | ✅ **Activo** | Métricas de auditoría RAG, anclaje a la fuente, bucket OCI Always Free y exportación JSON. |
| **`BadgeModal`** | Modal de Recompensas | [`src/components/BadgeModal/BadgeModal.tsx`](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/frontend/src/components/BadgeModal/BadgeModal.tsx) | ✅ **Activo** | Celebración visual interactiva al desbloquear medallas con confeti y botón para continuar. |

---

## 🛠️ 4. Estructura de Directorios

```text
frontend/
├── package.json               # Dependencias (React 19, Vite 8, Lucide, Canvas Confetti)
├── tsconfig.json              # Configuración base TypeScript
├── vite.config.ts             # Configuración de empaquetado Vite
├── index.html                 # Punto de entrada HTML con meta NuevaMente
├── public/                    # Isotipo oficial SVG y recursos estáticos
│   ├── Isotipo.svg            # Isotipo Möbius NuevaMente
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
    │   ├── Step1Ingestion/    # Paso 1: biblioteca, «Prueba rápida» y carga de documentos (con sesión)
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

> 💡 **Nota de Ejecución Unificada:** Para arrancar todo el sistema (Backend FastAPI + Frontend Vite) en un solo paso en Windows, ejecuta [`iniciar_local.bat`](../iniciar_local.bat) desde la raíz del repositorio.

### Equivalencias rápidas: Python ↔ Node (para el equipo de backend)

Idea original de la rama `frontEnd` (guía de arranque para el equipo de backend), actualizada al proyecto actual.

| Concepto | Backend (Python) | Frontend (Node.js) |
| :--- | :--- | :--- |
| Entorno de ejecución | Python 3.12.7, en `.venv/` de la raíz | Node.js 22+ (LTS) |
| Gestor de paquetes | `pip` | `npm` |
| Lista de dependencias | `requirements.txt` | `package.json` (versiones exactas en `package-lock.json`) |
| Instalar dependencias | `pip install -r requirements.txt` | `npm ci` (respeta el lock; `npm install` lo puede modificar) |
| Servidor local | `python -m uvicorn app.main:app --app-dir backend --port 8000` | `npm run dev` |
| Tests | `python -m pytest -q` (en `backend/`) | `npm test` |
| Comprobación de tipos | — | `npx tsc --noEmit -p .` |
| Lint | — | `npx eslint .` |
| Variables de entorno | `.env` en la raíz (claves secretas) | `.env.local` en `frontend/`, copiado de `.env.example` |

> ⚠️ Todo lo que empieza por `VITE_` se incrusta en el JavaScript que descarga el navegador: ahí solo van valores públicos (URL del backend, URL y clave *publishable* de Supabase). Las claves de Gemini, ElevenLabs u OCI viven únicamente en el `.env` del backend.

---

## 📚 6. Documentación Relacionada del Proyecto

Para más detalles sobre la arquitectura integral y la evolución del sistema, consultar:
* [guia_optimizacion_swap_oci.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/data/documents/guia_optimizacion_swap_oci.md): Documentación oficial del benchmark y guía técnica de memoria Swap OCI.
* [CAMBIOS.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/CAMBIOS.md): Bitácora cronológica de versiones y cambios del proyecto.
* [README.md Maestro](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/README.md): Manual general y arquitectura unificada de NuevaMente.
