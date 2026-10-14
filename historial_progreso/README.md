# 📚 Historial de Progreso y Documentación de Integración — NuevaMente

Esta carpeta centraliza todos los informes de avance, bitácoras de cambios, especificaciones de arquitectura y registros de incidencias técnicas generados a lo largo de las distintas fases de desarrollo del proyecto **NuevaMente** (Equipo 10 - G10 NovaMind).

---

## 📑 Índice de Documentos

| Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| [para_claude.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/para_claude.md) | Informe Técnico | Análisis forense de integración multirama, topografía de dos raíces de Git y estrategia de convergencia a producción. |
| [BITACORA_FULLSTACK_V2.md](BITACORA_FULLSTACK_V2.md) | Bitácora | Registro desde el 12 oct 2026 de la rama `feature/fullstack-nuevamente-v2`: generación paralela con Gemini, video narrado bajo demanda, respaldo de modelos e imágenes y PDF escaneados como fuente. |
| [CAMBIOS.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/CAMBIOS.md) | Bitácora / Changelog | Registro cronológico y detallado de las 20 fases de integración técnica del proyecto. |
| [INFORME_ORQUESTACION_MULTI_PROVEEDOR_FASE9.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INFORME_ORQUESTACION_MULTI_PROVEEDOR_FASE9.md) | Reporte Técnico | Arquitectura multi-proveedor (Gemini/Groq/Cohere), streaming SSE anti-timeout 524 de Cloudflare, semáforo de memoria en OCI y auditoría RAG real. |
| [ESQUEMA_INTEGRACION_FULLSTACK.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/ESQUEMA_INTEGRACION_FULLSTACK.md) | Arquitectura | Diagramas de flujo, contratos de API, mapeo de puertos y topología de integración Backend + Frontend + OCI. |
| [INFORME_INTEGRACION_OCI_FASE3.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INFORME_INTEGRACION_OCI_FASE3.md) | Reporte Técnico | Validación y persistencia híbrida en Oracle Cloud Infrastructure (OCI Object Storage Always Free). |
| [INFORME_INTEGRACION_FRONTEND_REACT.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INFORME_INTEGRACION_FRONTEND_REACT.md) | Reporte Técnico | Conexión e integración del cliente web React + Vite + TypeScript con el orquestador FastAPI. |
| [HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md) | Base de Conocimiento | Registro detallado de incidencias técnicas (55 problemas resueltos y auditados) y sus soluciones implementadas. |
| [Opus55.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/Opus55.md) | Planificación & Notas | Plan técnico integral de optimización de orquestación, resolución de cuellos de botella de latencia y acuerdos de arquitectura. |
| [INSTRUCCIONES_INSTALACION_PRUEBAS.txt](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/INSTRUCCIONES_INSTALACION_PRUEBAS.txt) | Guía de Uso | Pasos rápidos en texto plano para clonado, configuración de entorno y validación. |
| [PROMPT_CONTEXTO_AGENTE.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/PROMPT_CONTEXTO_AGENTE.md) | Prompts / IA | Contexto técnico utilizado para instruir a asistentes de IA durante el desarrollo. |
| [PROMPT_DESPLIEGUE_OCI_PRIVADO.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/historial_progreso/PROMPT_DESPLIEGUE_OCI_PRIVADO.md) | Despliegue Cloud | Manual paso a paso para el aprovisionamiento de instancias de cómputo en OCI. |

---

## 🎯 Cronología de Fases de Integración

* **Fase 1 — Armonización y Contratos:** Unificación de dependencias y esquemas de datos entre el pipeline LangGraph y los contratos pedagógicos.
* **Fase 2 — Orquestación Multi-Agente:** Implementación del bucle reflexivo RAG (Agente 1 ➔ Agente 2 ➔ Agente 3 con feedback de calidad pedagógica).
* **Fase 3 — Integración Cloud OCI:** Persistencia híbrida y resiliente en OCI Object Storage Always Free con fallback local automático.
* **Fase 4 — Integración Fullstack:** Conexión del frontend React (Vite + TypeScript) con la API REST FastAPI vía Axios y CORS adaptativo.
* **Fase 5 — Validación E2E y Pruebas:** Ejecución exitosa de 65 pruebas unitarias/integradas (100% pasando) y verificación del flujo completo de adaptación pedagógica.
* **Fase 6 — Reestructuración y Limpieza del Repositorio:** Segregación de la raíz en `historial_progreso/` y `legado/`, purga de Git con `git-filter-repo` y sincronización de documentación técnica v2.0.0.
* **Fase 7 — Topología Multirama y Blindaje de Seguridad:** Diagramas de arquitectura multirama y Gitflow en README, y blindaje de `.gitignore` para claves criptográficas y certificados.
* **Fase 8 — Despliegue Distribuido en OCI Always Free:** Topología de doble instancia (VM 1 Backend + VM 2 Frontend/Nginx), resolución perimetral con Cloudflare Tunnel (`novamind.techgk.cl`) y optimización de latencia de 429 s a 18 s.
* **Fase 9 — Orquestación Multi-Proveedor, Resiliencia SSE y Auditoría Real:** Fábrica de evaluadores para el Agente Crítico (Gemini 2.5 Flash ~2s con fallback a Groq / Cohere), streaming Server-Sent Events con heartbeat anti-timeout 524 de Cloudflare, protección de memoria con `asyncio.Semaphore(1)` en OCI y auto-reparación defensiva de quizzes.
* **Fase 10 — Frontend Gamificado con Tokens OKLCH y 5 Estaciones:** Integración de la UI moderna con Syne, PlayerHUD, Stepper de navegación, sistema de medallas y catálogo de documentos reales.
* **Fase 11 — RAG Dual Asíncrono y Dossier PDF:** Generación paralela de Dossier PDF con ReportLab (5 estaciones didácticas) y despacho silencioso por correo electrónico con respaldo OCI.
* **Fase 12 — Concurrencia Escalada (5 Workers) y Mermaid Interactivo:** Aceleración de timeouts en backend, ampliación de semáforo a 5 workers y renderizado nativo de diagramas de arquitectura en Estación 1 con `mermaid.js`.
* **Fase 13 — Autenticación y Persistencia con Supabase:** Esquema relacional con Row Level Security (RLS), persistencia de perfiles y tareas de generación, y autenticación OAuth PKCE con Google y Email.
* **Fase 14 — Calibración Audiovisual y Tiempo Unificado:** Normalización defensiva de contratos `VideoJobSpec` y modelo matemático de tiempo idéntico entre Python y TypeScript con fixture dorado compartido.
* **Fase 15 — Generación Concurrente Gemini y Streaming Incremental:** Desacoplamiento en tres tareas concurrentes (A, B1, B2) con emisión inmediata por SSE y verificación literal de citas contra el documento.
* **Fase 16 — Director's Cut Audiovisual (Etapa 6):** Experiencia de video interactivo en cliente sin transcodificación de MP4 en servidor, doble motor TTS (ElevenLabs + Gemini) y búsqueda legal de fotos libres en Wikimedia y Openverse.
* **Fase 17 — Tolerancia de Duración y Respaldo Inteligente:** Margen de 5% de duración con reproducción acelerada adaptativa (`playbackRate`), respaldo automático a `gemini-3.1-flash-lite` y voz de contingencia del navegador con Web Speech API en español neutro.
* **Fase 18 — Ingesta Multimodal con Transcripción IA Honesta:** Soporte nativo para extracción de imágenes (PNG/JPG) y PDFs escaneados mediante visión artificial con delimitadores de página `[Página N]` y revisión humana obligatoria.
* **Fase 19 — Robustecimiento y Auditoría E2E de Producción:** Cobertura escalada a 255 pruebas backend y 17 frontend, con 0 errores de tipado TypeScript y build de producción optimizado en Vite.
* **Fase 20 — Análisis Forense Multirama y Convergencia a Main:** Mapeo de historias inconexas de Git, verificación de absorción completa de `backend` e `integracion` (+42 y +25 commits adelante) y roadmap de fast-forward limpio hacia `main`.

---

**Firmado por:**  
🤖 **Modelo de IA: Gemini 3.8 & Antigravity Agent**  
*Arquitectura de Soluciones Cloud OCI, DevOps Senior & Integración Full-Stack*  
*Fecha: 13 de Octubre de 2026*
