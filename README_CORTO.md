# 🧠 NovaMind — Sistema Inteligente de Adaptación y Generación de Contenido Educativo

Desarrollado por el **Equipo 10** para **No-Country** (*Hackathon ONE G10 · Oracle Next Education & Alura Latam*).  
Plataforma que convierte documentación técnica compleja en un recorrido pedagógico interactivo de 5 estaciones adaptado al perfil del estudiante, con citas verificadas y video narrado.

<p align="center">
  <a href="https://novamind.techgk.cl/"><strong>🌐 Demo en Vivo</strong></a> &nbsp;•&nbsp;
  <a href="https://www.youtube.com/watch?v=TU_VIDEO_AQUI"><strong>▶️ Video Demo (YouTube)</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versión-2.0.0-0A84FF">
  <img src="https://img.shields.io/badge/Licencia-MIT-green">
  <img src="https://visitor-badge.laobi.icu/badge?page_id=No-Country-simulation.G10-LATAM-equipo10NovaMind&left_text=visitas&left_color=%23555555&right_color=%230A84FF">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white">
  <img src="https://img.shields.io/badge/Docs-Swagger-85EA2D?logo=swagger&logoColor=black">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white">
  <img src="https://img.shields.io/badge/IA-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white">
  <img src="https://img.shields.io/badge/Video-Remotion%20Player-4B4BF5">
  <img src="https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white">
  <img src="https://img.shields.io/badge/Supabase-Cloud-3FCF8E?logo=supabase&logoColor=white">
  <img src="https://img.shields.io/badge/Almacenamiento-OCI%20Object%20Storage-F80000?logo=oracle&logoColor=white">
  <img src="https://img.shields.io/badge/Despliegue-OCI%20Compute-F80000?logo=oracle&logoColor=white" >
</p>

<table>
  <tr>
    <td width="33%"><img src="docs/capturas/inicio.png"></td>
    <td width="33%"><img src="docs/capturas/resumen-citas.png"></td>
    <td width="33%"><img src="docs/capturas/oci-object-storage.png"></td>
  </tr>
  <tr>
    <td align="center"><sub>Biblioteca y «Explorar Demostración», sin iniciar sesión</sub></td>
    <td align="center"><sub>Los conceptos clave de un documento y su fuente verificada</sub></td>
    <td align="center"><sub>Persistencia y custodia en OCI Object Storage</sub></td>
  </tr>
</table>

## 🎯 Introducción y Objetivos

**NovaMind** transforma manuales técnicos, reportes de arquitectura y archivos densos (PDF, Markdown, texto o imágenes) en experiencias de aprendizaje estructuradas y personalizadas.

### Objetivos Clave
* **Cero Alucinaciones (RAG Grounding):** Validación literal de citas en el documento original indicando la página real de procedencia.
* **Aprendizaje Adaptativo Tridimensional:** Personalización dinámica según 4 perfiles (*Principiante*, *Junior*, *Arquitecto*, *Ejecutivo*), 11 sectores (*Finanzas, Salud, E-commerce, etc.*) y 2 niveles de profundidad (*Didáctico* vs *Técnico con CLI*).
* **Experiencia Gamificada:** Ruta formativa con **325 XP acumulables**, vitrina de 5 medallas de maestría y experiencia interactiva mediante el botón **«Ver Sorpresa ✨»**.
* **Producción Audiovisual Ligera:** Microclase narrada en el navegador con Remotion Player y teleprompter técnico sincronizado (sin renderizado pesado en el servidor).

<img src="./docs/capturas/five.png" align="right" width="50%">

### Las 5 Estaciones de Aprendizaje
* **1. Resumen:** Conceptos clave con citas verificadas en la fuente original, analogía central y mapa conceptual.
* **2. Tarjetas Didácticas:** Preguntas interactivas con pistas reflexivas (exportable a Anki).
* **3. Guía Paso a Paso:** Tutorial procedimental con metas de aprendizaje y comandos de terminal.
* **4. Contenido Audiovisual:** Video narrado interactivo con audio por escenas y visuales referenciadas.
* **5. Cuestionario Capstone:** Evaluación formativa adaptada a los conceptos enseñados previamente.


## 🏛️ Arquitectura y Tecnologías

El sistema opera bajo una arquitectura desacoplada donde el frontend gestiona la experiencia interactiva y el backend orquesta la ingesta, modelos de IA y persistencia en la nube:

```mermaid
flowchart TD
    FE["Frontend<br/>React 19 + Vite"] -->|"SSE / REST"| BE

    subgraph BE["Backend FastAPI"]
        direction LR
        P1["1. Ingesta & Contexto"] --> P2["2. Generación en Paralelo<br/>(Estaciones de Aprendizaje)"] --> P3["3. Verificación & Auditoría"]
    end

    subgraph IA["Modelos de IA"]
        direction TB
        GEM["Google Gemini"]
        GROQ["Groq<br/>Auditoría"]
        COH["Cohere<br/>Embeddings"]
    end

    subgraph EXT["Servicios y Componentes"]
        direction TB
        VOZ["ElevenLabs<br/>(Voz / TTS)"]
        CITAS["Servicio de Citas<br/>Text Grounding<br/>openverse<br/>wikimedia"]
    end

    subgraph BD["Bases de Datos & Almacenamiento"]
        direction TB
        SUP[("Supabase")]
        OCI[("OCI Object Storage")]
        CHR[("ChromaDB")]
    end

    BE <--> IA
    BE <--> EXT
    BE <--> BD

```

### Stack Principal
* **Frontend:** [React 19](https://react.dev/), [TypeScript 6.0](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Remotion Player](https://www.remotion.dev/) y CSS Modules.
* **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/) y [Pydantic v2](https://docs.pydantic.dev/).
* **Modelos de IA:** Google Gemini 2.5 Flash, Groq (Llama 3.3), Cohere y ElevenLabs.
* **Persistencia:** Oracle Cloud Infrastructure (OCI Object Storage Always Free) y Supabase (PostgreSQL con RLS).


## 🚀 Setup y Puesta en Marcha

### Requisitos Previos
* Python 3.12 y Node.js 18 o superior.
* Archivo `.env` en la raíz (creado a partir de `.env.example`). Requiere únicamente `GEMINI_API_KEY`:

| Variable | ¿Obligatoria? | Propósito |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Sí** | Generación de contenidos, transcripción multimodal y TTS. |
| `SUPABASE_URL` · `SUPABASE_PUBLISHABLE_KEY` | No | Autenticación y persistencia (opcional en modo invitado). |
| `GROQ_API_KEY` · `COHERE_API_KEY` · `ELEVENLABS_API_KEY` | No | Auditoría rápida, embeddings y voz neuronal avanzada. |
| `OCI_*` | No | Bucket de OCI (si no está, guarda localmente en `data/outputs/`). |

### ⚡ En Windows (1 clic)
1. Ejecuta `setup.bat` para crear el entorno virtual `.venv` e instalar dependencias.
2. Agrega tu `GEMINI_API_KEY` en `.env`.
3. Ejecuta `iniciar_local.bat` para iniciar Backend (puerto 8000), Frontend (puerto 5173) y abrir el navegador.

### 🛠️ Puesta en Marcha Manual

```bash
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

---

<p align="center">
  <img src="docs/flujo-nuevamente.svg" alt="Flujo general de NuevaMente" width="960">
</p>

## 🔗 Enlaces a Recursos y Documentación

* 📡 **Referencia de la API REST:** Consulta [backend/docs/API.md](backend/docs/API.md) para el catálogo de endpoints, schemas de solicitud/respuesta y streaming SSE.
* ⚙️ **Decisiones Técnicas y Trade-offs:** Consulta [docs/DECISIONES.md](docs/DECISIONES.md) para alternativas descartadas y arquitectura de memoria en 1 GB RAM.
* 📜 **Historial de Versiones y Seguridad:** Consulta [CHANGELOG.md](CHANGELOG.md) para el registro de cambios y auditorías TLS.
* 🗺️ **Índice General:** Consulta [INDEX.md](INDEX.md) para la referencia completa de especificaciones.
* 🧪 **Pruebas Automatizadas:** Ejecuta `cd backend && pytest -q` y `cd frontend && npm test`.



## 👥 Equipo y Reconocimientos

### 🎖️ Hackathon ONE G10 (Oracle Next Education & Alura Latam · No-Country)

> **Muchas banderas y una misma meta.**  
> *Unidos para demostrar lo que el talento de nuestra región es capaz de construir. NovaMind nace de esta unión, y esto apenas comienza.* 💜

| Integrante | Rol / Responsabilidad Técnica | Redes / Perfiles |
| :--- | :--- | :---: |
| **Silvia Zamora** | Facilitación & Project Management | [LinkedIn](https://www.linkedin.com/in/silvia-zamora-valverde-3775a72ab) · [GitHub](https://github.com/silvet005-cpu) |
| **Gabriel Quineo** | Liderazgo Técnico Backend & Arquitectura RAG | [GitHub](https://github.com/gadeq) |
| **Carina Bosio** | Liderazgo Técnico Frontend & UI/UX | [LinkedIn](https://www.linkedin.com/in/carina-susana-bosio/) · [GitHub](https://github.com/CariBosio) |
| **Tomás Encina** | Backend & Cloud Integration | [LinkedIn](https://www.linkedin.com/in/tomas-encina-bugueno/) · [GitHub](https://github.com/toencina) |
| **Emanuel Lopez** | Backend & Cloud Integration | [LinkedIn](https://www.linkedin.com/in/emanuel-lopez-f/) · [GitHub](https://github.com/ema28pro) |
| **Pedro Ruiz** | Backend & Cloud Integration | [LinkedIn](https://www.linkedin.com/in/pedro-ruiz-307576398/) · [GitHub](https://github.com/pedroruizguerrero240-lab) |
| **Harumi Pereda Pascal** | Frontend, QA & Diseño de Producto | [LinkedIn](https://www.linkedin.com/in/harumi-pereda-pascal) · [GitHub](https://github.com/harumipereda) |
| **Alejandro Cárdenas** | Colaboración Técnica & Documentación | [LinkedIn](https://www.linkedin.com/in/alejandro-alfredo-cardenas/) · [GitHub](https://github.com/Al3x4nDr0s) |
| **Wilson Ignao** | Colaboración Técnica & Documentación | [LinkedIn](https://www.linkedin.com/in/wilsonignao/) · [GitHub](https://github.com/JuanWilson70) |

>*"Agradecimientos especiales a **Oracle Cloud Infrastructure (OCI)**, **Alura Latam** y **No-Country** por impulsar el talento tecnológico en Latinoamérica."*
