# 📚 Documentación Técnica del Backend — NuevaMente

Índice de especificaciones técnicas para el desarrollo, infraestructura y mantenimiento del backend de **NuevaMente** (`backend/app/`):


## 📑 Directorio de Especificaciones

| Documento | Descripción |
|---|---|
| 📐 [**ARCHITECTURE.md**](ARCHITECTURE.md) | **Arquitectura Interna del Backend:** Flujo de ejecución en FastAPI, orquestador paralelo con Gemini, cadena colaborativa, RAG clásico con LangGraph, verificador determinista de citas y tareas en segundo plano. |
| 🔌 [**API.md**](API.md) | **Referencia de API REST:** Catálogo completo de los 13 endpoints activos en FastAPI, contratos Pydantic v2 de entrada y salida, esquema de eventos Server-Sent Events (SSE) y acceso a Swagger UI. |
| 🗄️ [**DATABASE.md**](DATABASE.md) | **Base de Datos y Persistencia:** Esquema de PostgreSQL en Supabase, las 3 migraciones oficiales, diagrama entidad-relación, políticas de **Row Level Security (RLS)**, estructura de carpetas en OCI Object Storage y ChromaDB. |
| 🛡️ [**SECURITY.md**](SECURITY.md) | **Seguridad y Control de Acceso:** Autenticación JWT con Supabase Auth, arquitectura Zero Trust con Cloudflare Tunnel, política de CORS restringida, sanitización de datos y semáforos de memoria anti-OOM. |
| 🚀 [**DEPLOYMENT.md**](DEPLOYMENT.md) | **Instalación y Despliegue:** Catálogo completo de las 38 variables de entorno (`.env`), lanzador en 1 clic (`iniciar_local.bat`), despliegue en VM OCI Compute con systemd y configuración de proxy Nginx. |
| 🩺 [**OPERATIONS.md**](OPERATIONS.md) | **Operaciones y Runbooks:** Sistema de logging con enmascaramiento de datos personales, healthcheck de alta velocidad (< 10 ms), guía de diagnóstico de incidencias y script de restablecimiento a Estado Cero (*Zero-State*). |
| 🧪 [**TESTING.md**](TESTING.md) | **Estrategia de Testing y Calidad:** Suite automatizada de 300 tests pytest (100% deterministas sin consumo de saldo), benchmarks de estrés (137 RPS sin congelamiento del event loop) y certificación E2E con Apache Kafka. |


## 🔗 Enlaces Relacionados
* 🧭 [**Índice General del Proyecto (#back)**](../../INDEX.md#back): Directorio maestro de especificaciones y documentación de todo el repositorio.
* 📖 [**Backend README**](../README.md): Portada del backend con badges e instrucciones rápidas.
* 🌐 [**Documentación General (`docs/`)**](../../docs/README.md): Especificaciones globales y arquitectura del sistema.
