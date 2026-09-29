# 📚 Historial de Progreso y Documentación de Integración — NuevaMente

Esta carpeta centraliza todos los informes de avance, bitácoras de cambios, especificaciones de arquitectura y registros de incidencias técnicas generados a lo largo de las distintas fases de desarrollo del proyecto **NuevaMente** (Equipo 10 - G10 NovaMind).

---

## 📑 Índice de Documentos

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| [CAMBIOS.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/CAMBIOS.md) | Bitácora / Changelog | Registro cronológico y detallado de las 7 fases de integración técnica del proyecto. |
| [ESQUEMA_INTEGRACION_FULLSTACK.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/ESQUEMA_INTEGRACION_FULLSTACK.md) | Arquitectura | Diagramas de flujo, contratos de API, mapeo de puertos y topología de integración Backend + Frontend + OCI. |
| [INFORME_INTEGRACION_OCI_FASE3.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INFORME_INTEGRACION_OCI_FASE3.md) | Reporte Técnico | Validación y persistencia híbrida en Oracle Cloud Infrastructure (OCI Object Storage Always Free). |
| [INFORME_INTEGRACION_FRONTEND_REACT.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INFORME_INTEGRACION_FRONTEND_REACT.md) | Reporte Técnico | Conexión e integración del cliente web React + Vite + TypeScript con el orquestador FastAPI. |
| [HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md) | Base de Conocimiento | Registro detallado de incidencias técnicas (Problemas #1 al #29 resueltos) y sus soluciones implementadas. |
| [INSTRUCCIONES_INSTALACION_PRUEBAS.txt](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovaMind/historial_progreso/INSTRUCCIONES_INSTALACION_PRUEBAS.txt) | Guía de Uso | Pasos rápidos en texto plano para clonado, configuración de entorno y validación. |
| `PROMPT_CONTEXTO_AGENTE.md` | Prompts / IA | Contexto técnico utilizado para instruir a asistentes de IA durante el desarrollo. |
| `PROMPT_DESPLIEGUE_OCI_PRIVADO.md` | Despliegue Cloud | Manual paso a paso para el aprovisionamiento de instancias de cómputo en OCI. |

---

## 🎯 Cronología de Fases de Integración

* **Fase 1 — Armonización y Contratos:** Unificación de dependencias y esquemas de datos entre el pipeline LangGraph y los contratos pedagógicos.
* **Fase 2 — Orquestación Multi-Agente:** Implementación del bucle reflexivo RAG (Agente 1 ➔ Agente 2 ➔ Agente 3 con feedback de calidad pedagógica).
* **Fase 3 — Integración Cloud OCI:** Persistencia híbrida y resiliente en OCI Object Storage Always Free con fallback local automático.
* **Fase 4 — Integración Fullstack:** Conexión del frontend React (Vite + TypeScript) con la API REST FastAPI vía Axios y CORS adaptativo.
* **Fase 5 — Validación E2E y Pruebas:** Ejecución exitosa de 65 pruebas unitarias/integradas (100% pasando) y verificación del flujo completo de adaptación pedagógica.
* **Fase 6 — Reestructuración y Limpieza del Repositorio:** Segregación de la raíz en `historial_progreso/` y `legado/`, purga de Git con `git-filter-repo` y sincronización de documentación técnica v2.0.0.
* **Fase 7 — Topología Multirama y Blindaje de Seguridad:** Diagramas de arquitectura multirama y Gitflow en README, y blindaje de `.gitignore` para claves criptográficas y certificados.
