# Historial de Cambios (Changelog) — NuevaMente

Todas las modificaciones notables del proyecto **NuevaMente** se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).


## [2.8.0] - 2026-10-16

### Generación y Backend
- **Cuestionario al final (Tarea C):** Se desacopló de la tarea B1 y se ejecuta secuencialmente después de A, B1 y B2, alimentándose exactamente del temario pedagógico consolidado. Esto previene que el examen pregunte por temas ausentes en las estaciones anteriores. Se aplicó la migración `202610160001_tarea_cuestionario.sql`.
- **Pasos adaptativos en la Guía Paso a Paso:** La función `pasos_guia()` ahora calibra de 3 a 7 pasos según la extensión y secciones reales del documento, garantizando relevancia práctica.

### Frontend e Interfaz
- **Estandarización de nombres pedagógicos:** Nombres claros en español: *Resumen*, *Tarjetas didácticas*, *Guía paso a paso*, *Contenido AudioVisual* y *Cuestionario*.
- **Microclase Audiovisual con Remotion Player:** Reproducción de video directo en el navegador con Remotion Player, subtítulos CC conmutables y audio secuenciado por escenas, eliminando la necesidad de renderizar MP4 en el servidor.
- **Biblioteca de Documentos con Muestras Pregeneradas:** Ingesta de 6 escenarios pregenerados (Don Quijote I y II con licencia CC BY-SA 4.0, Apache Kafka, ENISA, Snowflake y Guía de Swap de OCI), permitiendo pruebas instantáneas sin consumo de cuota de IA.


## [2.7.0] - 2026-10-14

### Procedencia Honesta y Verificación Documental
- **Visor de Fuentes Literal:** Implementación de `fuentes.contexto_de_cita` en backend, permitiendo que las citas en las estaciones 1 a 4 resalten el fragmento exacto del documento original en el número de página correspondiente.
- **Normalización de Bloques de Código:** El verificador de citas ahora normaliza bloques de código Markdown (ej. ```` ```bash ````), permitiendo validar comandos técnicos sin falsos negativos de anclaje.
- **Restricción de Nichos Sectoriales:** Las directivas de nicho se acotan a metáforas, analogías y ejemplos prácticos, evitando alterar la factualidad del documento fuente.
- **Privacidad y Seguridad en Envíos de Correo:** Enmascaramiento preventivo de correos de destinatarios en logs (`al***@ejemplo.com`) y saneamiento de trazas SMTP.

## [2.6.0] - 2026-10-14

### Protección de Cuota de Narración y UX Gamificada
- **Validación Preventiva de Guiones:** Detección de `exceso_guion_narracion` (> 173 palabras o > 1.730 caracteres) con rechazo HTTP 422 para prevenir desperdicio de créditos TTS.
- **Poda Semántica Asistida por IA (`_ajustar_guion`):** Condensación inteligente de locuciones al rango pedagógico de 110–125 palabras.
- **Degradación Suave de Voz:** Soporte para ElevenLabs, Gemini TTS y fallback transparente a síntesis de voz nativa del navegador ante caídas o cuotas agotadas.
- **Aislamiento de Caché de Invitados:** Caché volátil en memoria acotada a 200 registros (`MAX_FILAS_CACHE_INVITADOS`).


## [2.5.0] - 2026-10-14

### Resiliencia ante Cuotas 429 de Gemini y Semáforos
- **Clasificación Granular de Errores 429:** Inspección de `google.rpc.QuotaFailure` y `google.rpc.RetryInfo` distinguiendo límites por minuto de cuota diaria agotada.
- **Fail-Fast de Modelos Agotados:** Memoria de modelos agotados hasta la medianoche del Pacífico para no generar llamadas redundantes.
- **Semáforo Concurrente por Modelo:** Restricción de llamadas simultáneas al modelo de respaldo (`GEMINI_CONCURRENCIA_POR_MODELO = 2`).


## [2.0.0] - 2026-10-10

### Lanzamiento Oficial de NuevaMente
- **Integración de LangGraph:** Motor multi-agente determinista con ciclo reflexivo (*Investigador ➔ Productor ➔ Crítico*).
- **Arquitectura Híbrida de Almacenamiento:** Persistencia primaria en OCI Object Storage Always Free y fallback resiliente local a `data/outputs/`.
- **Integración de Supabase:** Autenticación JWT y base de datos relacional con Row Level Security (RLS) en todas las tablas.
- **Lanzador Unificado:** Script `iniciar_local.bat` para arranque concurrente de FastAPI y Vite en un clic.
