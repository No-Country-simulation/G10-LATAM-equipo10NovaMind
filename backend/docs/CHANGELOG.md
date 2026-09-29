# Changelog

Todas las modificaciones notables del proyecto NuevaMente se registran en este documento.

## [2.0.0] - 2026-09-29

### 🚀 Integración Full Stack y Consolidación de Arquitectura
Versión unificada y verificada que culmina las 5 fases de integración técnica del sistema:

#### Añadido
- **Frontend SPA en React 19 + Vite + TypeScript:** Interfaz moderna desacoplada con componentes modulares, stepper interactivo de 3 pasos y visualizadores para los 5 formatos pedagógicos (Flashcards 3D, Quiz interactivo, Tutorial con comandos, TL;DR expandible y Guion de video).
- **Persistencia Híbrida en Oracle Cloud (Fase 3):** Integración con OCI Object Storage Always Free (bucket `nuevamente-contenidos-educativos`, región `sa-santiago-1`) mediante `UploadManager` del SDK oficial de OCI.
- **Mecanismo de Fallback Local Resiliente (`almacenador_resiliente`):** Redirección transparente de persistencia a `data/outputs/` ante ausencia de credenciales OCI o fallos temporales de red.
- **Lanzador Unificado (`iniciar_local.bat`):** Script concurrente para arrancar FastAPI (puerto 8000) y React Vite (puerto 5173) en simultáneo.
- **Herramienta de Restablecimiento (`reestablecer_local.bat` y `scripts/reestablecer_local.py`):** Limpieza de colecciones ChromaDB y salidas locales para pruebas desde Estado Cero.
- **Suite de Pruebas Automatizadas (65 tests):** 100% de éxito en tests unitarios, contratos Pydantic v2, normalización de alias, mocks de integración y endpoints REST.

#### Modificado
- **CORS en FastAPI (`backend/app/main.py`):** Reemplazo de política permisiva `["*"]` por restricción explícita a orígenes de desarrollo (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:8501`, `http://127.0.0.1:8000`).
- **Armonización de Variables de Entorno (`backend/app/core/config.py`):** Soporte unificado de variables y alias (`COHERE_MODEL`, `COHERE_EMBEDDING_MODEL`, `OCI_*`).
- **Endpoints de Paquetes (`/api/v1/paquetes` y `/api/v1/paquetes/{objeto_id}`):** Resolución híbrida que prioriza OCI y resuelve descargas locales ante caídas o en entornos sin nube.
- **Estructura del Repositorio:** Centralización de documentación de progreso en `historial_progreso/` y preservación de artefactos preliminares en `legado/`.

#### Seguridad
- Purga completa de identificadores y credenciales en el historial Git mediante `git-filter-repo`.
- Reglas de exclusión reforzadas en `.gitignore` para archivos confidenciales y bitácoras privadas.

---
Para más detalles sobre las fases anteriores de desarrollo, consultar `historial_progreso/CAMBIOS.md` y `historial_progreso/HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md`.

