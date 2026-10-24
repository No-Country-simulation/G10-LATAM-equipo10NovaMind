# 📚 Índice General de Documentación — NuevaMente

Mapa completo y navegable de toda la documentación del proyecto **NuevaMente** (Hackathon ONE G10 · Oracle Next Education & Alura).


## 📑 Tabla de Contenidos

- [🌐 Documentación General del Proyecto](#general)
- [⚙️ Documentación Técnica del Backend](#back)
- [🎨 Documentación del Frontend](#frontend)
- [🗺️ Diagramas y Recursos Visuales](#recursos)


<a id="general"></a>
## 🌐 Documentación General del Proyecto

Especificaciones globales que cubren el producto completo, diseño instruccional, gobernanza y arquitectura del sistema:

| Documento | Descripción |
|---|---|
| 📖 [**README.md**](README.md) | **Portada Oficial:** Resumen ejecutivo del proyecto, badges oficiales, capturas de pantalla, credenciales de demostración y créditos del equipo. |
| 📐 [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | **Arquitectura Global del Sistema:** Diagrama general del flujo end-to-end, recorrido de las 5 estaciones pedagógicas, interfaz React 19, reproductor Remotion en el navegador sin MP4 en servidor y persistencia en la nube. |
| ⚙️ [**docs/DECISIONES.md**](docs/DECISIONES.md) | **Decisiones Técnicas y de Diseño:** Las 9 decisiones clave del proyecto (procedencia honesta de citas, límites de VM de 1 GB RAM, mitigación de timeout 524 de Cloudflare con SSE, aislamiento multi-inquilino) y la justificación pedagógica de RAG en contexto vs vectorial. |
| 🔍 [**docs/PROJECT_AUDIT.md**](docs/PROJECT_AUDIT.md) | **Auditoría Estática y Fases:** Reporte de inspección técnica, análisis de riesgos y matriz de resolución de los 11 hallazgos originales a lo largo de las fases del hackathon. |
| 🤝 [**CONTRIBUTING.md**](CONTRIBUTING.md) | **Guía de Contribución:** Flujo de trabajo con ramas (GitHub Flow), convenciones de commit, comandos de validación previa (sintaxis y tipos) y política de *Squash & Merge*. |
| 📝 [**CHANGELOG.md**](CHANGELOG.md) | **Historial de Cambios:** Registro cronológico de versiones y novedades implementadas desde la v2.0.0 hasta la v2.8.0. |


<a id="back"></a>
<a id="backend"></a>
## ⚙️ Documentación Técnica del Backend

Guías exhaustivas para el desarrollo, infraestructura, orquestación y mantenimiento del backend en Python / FastAPI:

| Documento | Descripción |
|---|---|
| 🚀 [**backend/README.md**](backend/README.md) | **Portada del Backend:** Vista rápida, badges oficiales, puesta en marcha con Uvicorn o lanzador de 1 clic y accesos a Swagger UI. |
| 📐 [**backend/docs/ARCHITECTURE.md**](backend/docs/ARCHITECTURE.md) | **Arquitectura Interna del Backend:** Diagrama de ejecución interno, flujo de agentes, Generador Paralelo con Gemini, Cadena Colaborativa, orquestador LangGraph clásico, verificador determinista de citas y tareas en segundo plano. |
| 🔌 [**backend/docs/API.md**](backend/docs/API.md) | **Referencia de API REST (Swagger):** Catálogo completo de los 13 endpoints activos en FastAPI, contratos Pydantic v2 de entrada y salida, esquema de eventos Server-Sent Events (SSE) y Swagger UI. |
| 🗄️ [**backend/docs/DATABASE.md**](backend/docs/DATABASE.md) | **Base de Datos y Persistencia:** Esquema de PostgreSQL en Supabase, las 3 migraciones oficiales, diagrama entidad-relación, políticas de **Row Level Security (RLS)**, estructura de carpetas en OCI Object Storage y ChromaDB. |
| 🛡️ [**backend/docs/SECURITY.md**](backend/docs/SECURITY.md) | **Seguridad y Control de Acceso:** Autenticación JWT con Supabase Auth, arquitectura Zero Trust con Cloudflare Tunnel, política de CORS restringida, sanitización de datos y semáforos de memoria anti-OOM. |
| 🚀 [**backend/docs/DEPLOYMENT.md**](backend/docs/DEPLOYMENT.md) | **Instalación y Despliegue:** Catálogo completo de las 38 variables de entorno (`.env`), lanzador en 1 clic (`iniciar_local.bat`), despliegue en VM OCI Compute con systemd y configuración de proxy Nginx. |
| 🩺 [**backend/docs/OPERATIONS.md**](backend/docs/OPERATIONS.md) | **Operaciones y Runbooks:** Sistema de logging con enmascaramiento de datos personales, healthcheck de alta velocidad (< 10 ms), guía de diagnóstico de incidencias y script de restablecimiento a Estado Cero (*Zero-State*). |
| 🧪 [**backend/docs/TESTING.md**](backend/docs/TESTING.md) | **Estrategia de Testing y Calidad:** Suite automatizada de 300 tests pytest (100% deterministas sin consumo de saldo), benchmarks de estrés (137 RPS sin congelamiento del event loop) y certificación E2E con Apache Kafka. |


<a id="frontend"></a>
## 🎨 Documentación del Frontend

Recursos y guías de la interfaz web desarrollada en **React 19 + Vite + TypeScript**:

| Componente | Descripción |
|---|---|
| 🎮 [**Circuito de 5 Estaciones**](docs/ARCHITECTURE.md#1-capa-de-presentación-frontend-react-19-spa) | Estación 1 (Resumen), Estación 2 (Tarjetas 3D), Estación 3 (Guía Paso a Paso), Estación 4 (Microclase con Remotion Player) y Estación 5 (Cuestionario Final). |
| 🎬 [**Créditos Cinematográficos**](frontend/creditos.html) | Experiencia audiovisual retro de 8-bit con banda sonora chiptune y agradecimientos oficiales. |
| 🧪 [**Pruebas Frontend**](backend/docs/TESTING.md) | Suite de 26 pruebas en Vitest que validan el plegado de eventos SSE, duraciones de locución y renderizado. |


<a id="recursos"></a>
## 🗺️ Diagramas y Recursos Visuales (`docs/`)

* 📊 [**docs/flujo-nuevamente.svg**](docs/flujo-nuevamente.svg): Diagrama vectorial del flujo completo de adaptación educativa y entrega de contenidos.
* 🛡️ [**docs/auditoria-seguridad-tls-oct2026.svg**](docs/auditoria-seguridad-tls-oct2026.svg): Infografía oficial de la auditoría de seguridad TLS y certificados de producción.
* 📱 [**docs/qr-novamind.svg**](docs/qr-novamind.svg): Código QR para acceso rápido a la demostración web en producción.
* 🖼️ [**docs/capturas/**](docs/capturas/): Galería de capturas de pantalla de la aplicación y almacenamiento en Oracle Cloud.
