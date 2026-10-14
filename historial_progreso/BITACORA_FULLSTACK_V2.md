# Bitácora · rama `feature/fullstack-nuevamente-v2`

Registro cronológico de lo que se hizo en esta rama, por qué se hizo, qué falló por el camino y cómo se comprobó. Las entradas más recientes van al final.

> Esta rama **no comparte historia** con `origin/feature/newmind-edtech-oci`: `git merge-base` no encuentra un ancestro común. Las ideas de esa rama se reimplementan aquí, no se fusionan.

---

## 12 oct 2026 · Contratos audiovisuales y tiempo unificado

**Commits:** `d6290f9`, `876a33e`, `5341451`

- **Contrato del Director Cut y `VideoJobSpec`:** se calibró y se le añadió normalización defensiva.
- **Modelo de tiempo único:** palabras, segundos y tramos `MM:SS` se calculan con la misma fórmula en Python (`schemas.py`) y en TypeScript (`microclassTiming.ts`). Los dos lados se validan contra el mismo fixture dorado (`contracts/fixtures/director_cut_golden.json`).
- **Procedencia honesta:** ninguna cifra ni cita se presenta como verificada si no lo está.
- **Test aislado de las variables de OCI locales:** fallaba en máquinas que tenían OCI configurado.

## 13 oct 2026 · Generación paralela con Gemini

**Commit:** `a65da04` (46 archivos)

- **Modo `paralelo`:** el documento se procesa con tres tareas concurrentes de Gemini (API Interactions).
  - **Tarea A:** resumen.
  - **Tarea B1:** flashcards, cuestionario, glosario y objetivos.
  - **Tarea B2:** guion, diapositivas, tutorial y diagrama.
- **Publicación incremental por SSE:** el recorrido se abre en cuanto llega el primer recurso (~8 s).
- **Verificación de citas:** cada cita se busca literalmente en el documento y se le asigna la página real.
- **Caché y registro:** cada tarea tiene una huella que sirve de caché, y queda registrada en Supabase (`generation_tasks`).
- **Sin relleno inventado en la interfaz:** se quitaron las métricas genéricas, el Mermaid estático y las preguntas de relleno.

## 13 oct 2026 · Etapa 6: video narrado bajo demanda

**Commit:** `b8d15c9`

- **Formato:** el "video" son 2 o 3 diapositivas narradas que dibuja el navegador desde el `VideoJobSpec`. Nunca se genera un MP4 ni se usa FFmpeg en la VM (1 vCPU, 1 GB).
- **Voz:** solo se genera cuando el usuario la pide. Primero ElevenLabs y, si falla, Gemini TTS. La duración se mide del audio real, con un tope de 60 s.
- **Fotos libres:** Openverse y Wikimedia, con autor y licencia.
- **Almacenamiento:** los usuarios con sesión guardan el audio en el bucket privado de OCI y la misma narración se reutiliza sin gastar créditos. Los invitados no guardan nada.

## 13 oct 2026 · Tolerancia, respaldo de modelos y voz del navegador

**Commit:** `11d2090`

- **Tolerancia de duración:** si la voz mide hasta 63 s (60 s × 1,05), se acepta. El navegador la reproduce a `ceil(total/60)` milésimas por encima de 1× para que dure 60 s. La interfaz muestra la duración que se oye y la velocidad.
- **Respaldo de modelos de Gemini:** el modelo principal de cada tarea se llama sin reintentos y con el 60 % de su timeout.
  - Si responde 429, 5xx, timeout o modelo inexistente, se pasa a `gemini-3.1-flash-lite`.
  - Un error de la petición (400) no gasta el respaldo.
- **Voz del navegador (Web Speech API):** es el último recurso cuando fallan ElevenLabs y Gemini.
  - Busca voz en este orden: es-AR, es-419, es-MX, es-CO, es-CL, es-US y, si no hay ninguna, cualquier `es*`.
  - Resalta en el teleprompter la palabra que se está diciendo.
  - La idea de la cascada regional sale del commit `7c21e99` de la otra rama.

**Problemas encontrados**
- `gemini-2.5-flash` no sirve de respaldo: en `/interactions` ignora el esquema JSON y responde en Markdown.
- Con el ENISA (unos 76 000 tokens), `3.5-flash-lite` dio 503 en las dos rondas y `3.8-flash` falló de forma intermitente. Solo `3.1-flash-lite` respondió siempre (unos 3 s).
- El resumen del ENISA hecho por el respaldo dejó **0 de 7 citas localizadas**: es un riesgo de fidelidad con documentos grandes, todavía abierto.

## 13 oct 2026 · Imágenes y PDF escaneados como fuente

**Commit:** `9980081`

**Contexto.** Otro análisis afirmaba que `origin/feature/newmind-edtech-oci` aceptaba JPG y PNG. Al revisar su código resultó falso:
- su selector de archivos no admite imágenes;
- envía cada archivo a Gemini con `mimeType: 'application/pdf'` fijo, desde el navegador y con la clave en `VITE_GEMINI_API_KEY`;
- su prompt hace que el modelo **invente** metadatos de OCI (`status_upload: "completado"`, `etag`, URL).

**Decisión: transcribir primero y generar después.** No se manda la imagen a cada tarea. Las citas verificadas, la auditoría y el RAG necesitan texto, y una imagen no se puede citar.
1. `POST /api/v1/documentos/extraer` devuelve el texto que se usará como fuente:
   - **PDF con texto, MD y TXT:** se extraen tal cual, sin llamar a Gemini.
   - **Imágenes (PNG, JPG, WEBP) y PDF escaneados:** se transcriben con Gemini en una sola llamada.
2. La Estación 1 muestra la transcripción en un cuadro editable, rotulado "Transcripción IA · revísala y corrígela".
3. El paquete se genera desde ese texto con `origen_contenido=transcripcion_ia` y lleva el aviso "las citas se verificaron contra esa transcripción, no contra el original".

**Reglas**
- **Páginas:** en un PDF escaneado, cada página empieza con una línea `[Página N]`. El backend saca las páginas de esas líneas y no de posiciones que envíe el cliente, así que sobreviven a las correcciones. Si el modelo no separa bien las páginas, no se inventan.
- **Fotos sin texto ni diagrama:** se rechazan. Una lección sobre "lo que se ve" sería contenido inventado.
- **Diagramas:** su descripción va rotulada `[Descripción del diagrama generada por IA]`, con un aviso para revisarla.
- **Imágenes renombradas:** se comprueba la firma de los bytes, no solo la extensión.
- **Límites:** 10 MB y 15 páginas. Plazo total de 85 s, por debajo de los 100 s de Cloudflare, porque este endpoint no usa SSE.
- **Modelos:** `gemini-3.1-flash-lite`, con `gemini-3.5-flash-lite` de respaldo. Se configuran con `GEMINI_TRANSCRIPTION_MODEL` y `GEMINI_TRANSCRIPTION_FALLBACK_MODEL`.

**Visibilidad**
- Las `advertencias` del paquete aparecen sobre la Ruta Cognitiva. Antes no se mostraban en ningún sitio.
- El recurso generado por el respaldo lo indica: "generado con el modelo de respaldo X porque Y no respondió".

**Problemas encontrados y solución**

| Problema | Solución |
|---|---|
| `gemini-3.8-flash` responde 400 con `thinking_level: "minimal"` | Usar `"low"`, que admiten los dos modelos |
| `3.8-flash` y `3.7-flash` respondieron 429 de cuota durante las pruebas; `3.5-flash-lite` tardó hasta 80 s entre varios 503 | Respaldo `3.5-flash-lite` y un plazo total con `asyncio.wait_for`, para que los reintentos no pasen del límite de Cloudflare |
| El manejador global de `IngestionError` responde `{"mensaje": ...}` y el frontend solo leía `detail`, así que habría mostrado "Error HTTP 400" | `detalleDeError` lee también `mensaje` |
| Los scripts de reemplazo en heredoc convirtieron `\x89`, `\n` y `\t` en caracteres reales, y el repositorio tiene CRLF (`autocrlf`) | Restaurar el archivo con git y editar con la herramienta de edición |

**Verificación**
- Backend: 255 tests. Frontend: 17 tests, `tsc` y build.
- Prueba real contra el servidor:

| Archivo | Resultado |
|---|---|
| PDF escaneado de 2 páginas | Transcrito en 3,8 s |
| Diagrama | Transcrito en 1,8 s |
| Foto | Rechazada con 400 |
| Markdown | Extraído en 0,01 s |
| Generación completa desde el PDF escaneado | 14,9 s, 21 de 21 citas localizadas, todas con página |

---

## 13 oct 2026 · Biblioteca de ejemplos, código muerto y filtro de Wikimedia

**Commit:** `9980081`

**Vista previa real de los PDF de ejemplo**
- Al elegir un PDF de la biblioteca, la Estación 1 mostraba un texto de relleno ("ARCHIVO PDF OFICIAL CARGADO…").
- Ahora muestra el texto real, que da el endpoint nuevo `GET /api/v1/documentos/ejemplos/{archivo}/texto`.
  - El servidor ya tiene el archivo, así que no se sube nada.
  - El texto se guarda en caché por archivo y fecha de modificación: el ENISA tardó 16,5 s la primera vez y 0,007 s la segunda.
  - El endpoint solo atiende documentos del catálogo: una imagen local o una ruta con `..` devuelven 404.
- El PDF queda listo para generar en cuanto se descarga; la vista previa llega después y no bloquea el botón.

**Fallo de procedencia corregido**
- Si fallaba la descarga de un ejemplo, la vista previa se llenaba con la *descripción del catálogo* y no se enviaba ningún archivo.
- Con el backend activo, se habría generado un paquete a partir de esas dos líneas como si fueran el documento.
- Ahora se muestra el error y no se genera nada. Ningún documento del catálogo usa el modo demo sin conexión (`demo-offline-swap`), así que ese texto de reserva no tenía otro uso.

**Código muerto eliminado**
- `frontend/src/components/IngestView/`: no se importaba en ningún sitio.
- `pdfBase64`: viajaba desde la Estación 1 hasta el servicio de la API sin usarse.
- La clase CSS `.pdfNotice`.

**Filtro de Wikimedia**
Prueba real con seis palabras clave. Los fallos que pasaban el filtro por título:

| Búsqueda | Foto elegida antes | Por qué falló |
|---|---|---|
| "server rack" | Prueba de los Epstein Files (redada del FBI de 2019) | El título no lo dice; la categoría y la descripción, sí |
| "data center" | Mapa de infraestructura de EE. UU. | La categoría era "Maps showing 2025" y el filtro no reconocía los plurales |
| "event streaming" | Eventos de marcas y un cumpleaños en Shibuya | La foto trata de otro tema |

El filtro de Wikimedia ahora:
- revisa también las categorías y la descripción, y reconoce los plurales;
- excluye temas sensibles o de actualidad (redadas, pruebas judiciales, policía, guerras, eventos, festivales, publicidad…);
- descarta las fotos con restricciones de derechos de imagen de personas.

Con el filtro nuevo, "server rack" y "data center" dan fotos pertinentes, y "event streaming" y "message broker" se quedan sin foto: la diapositiva sale sin fondo antes que con uno engañoso.

**Límite conocido:** para "cloud computing", Wikimedia propone un rayo entre nubes. Es un problema de significado de la palabra clave que no resuelve un filtro; por eso Openverse sigue yendo primero.

**Verificación**
- Backend: 258 tests. Frontend: 17 tests, `tsc` y build.
- Los errores de lint de `App.tsx`, `api.ts` y `Step2KnowledgeQuest.tsx` son los mismos que ya había en `HEAD`.

---

## 14 oct 2026 · Interfaz antigua eliminada

**Commit:** el siguiente a `9980081`

- Se borraron `MetricsView` y `ViewerView` con sus cinco visores (flashcards, cuestionario, guion, resumen y tutorial), 14 archivos en total, y `src/types/api.ts`, que solo usaban ellos.
- Era una interfaz anterior a la Ruta Cognitiva: nada la importaba. Se comprobó que el árbol estaba aislado (sus imports solo apuntaban a sí mismo, a `react`, a `lucide-react` y a `types/api`) antes de borrarlo.
- El lint completo bajó de 15 a 13 errores. Los 13 restantes son antiguos y están en `App.tsx` (4), `Step2KnowledgeQuest.tsx` (6, `any`), `MermaidDiagram.tsx` (2) y `api.ts` (2).
- **Commit anterior (`9980081`):** solo entró lo propio de esta rama. `historial_progreso/CAMBIOS.md`, `HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md`, `para_claude.md` y la sección "Análisis Forense de Integración Multirama" de esta bitácora los escribió otro agente y quedaron fuera, a la espera de revisión.

**Verificación:** `tsc` sin errores, 17 tests de frontend y build de producción.
