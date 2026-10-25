# 🧠 NovaMind — Sistema Inteligente de Adaptación y Generación de Contenido Educativo

Desarrollado por el **Equipo 10** para **No-Country** (*Hackathon ONE G10 · Oracle Next Education & Alura Latam*).  
Plataforma que convierte documentación técnica compleja en un recorrido pedagógico interactivo de 5 estaciones adaptado al perfil del estudiante, con citas verificadas y video narrado.

[🌐 Demo en Vivo](https://novamind.techgk.cl/) • [▶️ Video Demo (YouTube)](https://youtu.be/TzeztU1YXLk) • [🇺🇸 English Version](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/README_EN.md)

![Badges](https://proxy-badges.vercel.app/12)  

## 🎯 Introducción y Objetivos

**NovaMind** transforma manuales técnicos, reportes de arquitectura y archivos densos (PDF, Markdown, texto o imágenes) en experiencias de aprendizaje estructuradas y personalizadas.

### Objetivos Clave
* **Cero Alucinaciones (RAG Grounding):** Validación literal de citas en el documento original indicando la página real de procedencia.
* **Aprendizaje Adaptativo Tridimensional:** Personalización dinámica según 4 perfiles (*Principiante*, *Junior*, *Arquitecto*, *Ejecutivo*), 11 sectores (*Finanzas, Salud, E-commerce, etc.*) y 2 niveles de profundidad (*Didáctico* vs *Técnico con CLI*).
* **Experiencia Gamificada:** Ruta formativa con **325 XP acumulables**, vitrina de 5 medallas de maestría y experiencia interactiva mediante el botón **«Ver Sorpresa ✨»**.
* **Producción Audiovisual Ligera:** Microclase narrada en el navegador con Remotion Player y teleprompter técnico sincronizado (sin renderizado pesado en el servidor).

![Las 5 Estaciones de Aprendizaje](https://raw.githubusercontent.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/main/docs/capturas/five.png)

### Las 5 Estaciones de Aprendizaje
* **1. Resumen:** Conceptos clave con citas verificadas en la fuente original, analogía central y mapa conceptual.
* **2. Tarjetas Didácticas:** Preguntas interactivas con pistas reflexivas (exportable a Anki).
* **3. Guía Paso a Paso:** Tutorial procedimental con metas de aprendizaje y comandos de terminal.
* **4. Contenido Audiovisual:** Video narrado interactivo con audio por escenas y visuales referenciadas.
* **5. Cuestionario Capstone:** Evaluación formativa adaptada a los conceptos enseñados previamente.

## 🏛️ Arquitectura y Tecnologías

El sistema opera bajo una arquitectura desacoplada donde el frontend gestiona la experiencia interactiva y el backend orquesta la ingesta, modelos de IA y persistencia en la nube:

![Arquitectura](https://raw.githubusercontent.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/main/docs/capturas/arquitectura.png)

### Estructura del Proyecto

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py          # Endpoints REST, SSE y conmutación de modos
│   │   ├── auth.py          # Autenticación y control de acceso con Supabase
│   │   ├── agentes/         # Generación paralela, colaborativa y agentes LangGraph
│   │   ├── core/            # Contratos Pydantic, verificación de fuentes y configuración
│   │   ├── servicios/       # Integraciones con Gemini, Groq, Cohere, ElevenLabs
│   │   └── storage/         # Clientes de OCI Object Storage y almacenamiento local
│   └── tests/               # Pruebas automatizadas de backend con pytest
├── frontend/
│   ├── src/                 # Componentes React 19, navegación de estaciones y hooks
│   ├── public/ejemplos/     # Muestras pregeneradas para modo invitado
│   └── tests/               # Pruebas automatizadas de frontend
├── docs/                    # Diagramas técnicos y capturas de la aplicación
├── scripts/                 # Scripts de diagnóstico, limpieza y pruebas de carga
└── setup.bat · iniciar_local.bat · reestablecer_local.bat
```

### Stack Principal
* **Frontend:** [React 19](https://react.dev/), [TypeScript 6.0](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Remotion Player](https://www.remotion.dev/) y CSS Modules.
* **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/) y [Pydantic v2](https://docs.pydantic.dev/).
* **Modelos de IA:** Google Gemini 2.5 Flash, Groq (openai/gpt-oss-120b), Cohere y ElevenLabs.
* **Persistencia:** Oracle Cloud Infrastructure (OCI Object Storage Always Free) y Supabase (PostgreSQL con RLS).

## 🚀 Setup y Puesta en Marcha

### Requisitos Previos
* Python 3.12 y Node.js 18 o superior.
* Archivo `.env` en la raíz (creado a partir de [.env.example](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/.env.example)).

### Variables de Entorno (.env)
* **`GEMINI_API_KEY`** (Obligatoria): Generación de contenidos, transcripción multimodal y TTS.
* **`SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY`** (Opcional): Autenticación y persistencia (opcional en modo invitado).
* **`GROQ_API_KEY` · `COHERE_API_KEY` · `ELEVENLABS_API_KEY`** (Opcional): Auditoría rápida, embeddings y voz neuronal avanzada.
* **`OCI_*`** (Opcional): Bucket de OCI (si no está, guarda localmente en `data/outputs/`).

### ⚡ En Windows (1 clic)
1. Ejecuta [setup.bat](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/setup.bat) para crear el entorno virtual `.venv` e instalar dependencias.
2. Agrega tu `GEMINI_API_KEY` en `.env`.
3. Ejecuta [iniciar_local.bat](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/iniciar_local.bat) para iniciar Backend (puerto 8000), Frontend (puerto 5173) y abrir el navegador.

### 🛠️ Puesta en Marcha Manual

```bash
# 0. Clonar el repositorio
git clone https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind.git
cd G10-LATAM-equipo10NovaMind

# 1. Backend (FastAPI)
python -m venv .venv
# Activar: .venv\Scripts\activate (Windows) o source .venv/bin/activate (Linux/macOS)
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --app-dir backend --reload --port 8000

# 2. Frontend (React + Vite) — en otra terminal
cd frontend
npm install
npm run dev
```

* Aplicación Web: [http://localhost:5173/](http://localhost:5173/)
* Documentación Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

## 🔗 Enlaces a Recursos y Documentación

* 📡 **Referencia de la API REST:** Consulta [backend/docs/API.md](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/backend/docs/API.md) para el catálogo de endpoints, schemas de solicitud/respuesta y streaming SSE.
* ⚙️ **Decisiones Técnicas y Trade-offs:** Consulta [docs/DECISIONES.md](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/docs/DECISIONES.md) para alternativas descartadas y arquitectura de memoria en 1 GB RAM.
* 📜 **Historial de Versiones y Seguridad:** Consulta [CHANGELOG.md](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/CHANGELOG.md) para el registro de cambios y auditorías TLS.
* 🗺️ **Índice General:** Consulta [INDEX.md](https://github.com/No-Country-simulation/G10-LATAM-equipo10NovaMind/blob/main/INDEX.md) para la referencia completa de especificaciones.
* 🧪 **Pruebas Automatizadas:** Ejecuta `cd backend && pytest -q` y `cd frontend && npm test`.

## 👥 Equipo y Reconocimientos

### 🎖️ Hackathon ONE G10 (Oracle Next Education & Alura Latam · No-Country)

> **Muchas banderas y una misma meta.**  
> *Unidos para demostrar lo que el talento de nuestra región es capaz de construir. NovaMind nace de esta unión, y esto apenas comienza.* 💜

### Integrantes del Equipo
* **Silvia Zamora**: Facilitación & Project Management — [LinkedIn](https://www.linkedin.com/in/silvia-zamora-valverde-3775a72ab) · [GitHub](https://github.com/silvet005-cpu)
* **Gabriel Quineo**: Liderazgo Técnico Backend & Arquitectura RAG — [GitHub](https://github.com/gadeq)
* **Carina Bosio**: Liderazgo Técnico Frontend & UI/UX — [LinkedIn](https://www.linkedin.com/in/carina-susana-bosio/) · [GitHub](https://github.com/CariBosio)
* **Tomás Encina**: Backend & Cloud Integration — [LinkedIn](https://www.linkedin.com/in/tomas-encina-bugueno/) · [GitHub](https://github.com/toencina)
* **Emanuel Lopez**: Backend & Cloud Integration — [LinkedIn](https://www.linkedin.com/in/emanuel-lopez-f/) · [GitHub](https://github.com/ema28pro)
* **Pedro Ruiz**: Backend & Cloud Integration — [LinkedIn](https://www.linkedin.com/in/pedro-ruiz-307576398/) · [GitHub](https://github.com/pedroruizguerrero240-lab)
* **Harumi Pereda Pascal**: Frontend, QA & Diseño de Producto — [LinkedIn](https://www.linkedin.com/in/harumi-pereda-pascal) · [GitHub](https://github.com/harumipereda)
* **Alejandro Cárdenas**: Colaboración Técnica & Documentación — [LinkedIn](https://www.linkedin.com/in/alejandro-alfredo-cardenas/) · [GitHub](https://github.com/Al3x4nDr0s)
* **Wilson Ignao**: Colaboración Técnica & Documentación — [LinkedIn](https://www.linkedin.com/in/wilsonignao/) · [GitHub](https://github.com/JuanWilson70)

> *"Agradecimientos especiales a **Oracle Cloud Infrastructure (OCI)**, **Alura Latam** y **No-Country** por impulsar el talento tecnológico en Latinoamérica."*
