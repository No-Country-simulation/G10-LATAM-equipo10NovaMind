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

## 13 oct 2026 · Análisis Forense de Integración Multirama

**Referencia:** [deploy/auditoria/para_claude.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/deploy/auditoria/para_claude.md) y [para_claude.md](file:///c:/Users/gdq_1/Documents/Gabotech/Ia_NovaMind/G10-LATAM-equipo10NovamindA/G10-LATAM-equipo10NovaMind/para_claude.md)

1. **Topografía de dos raíces:** Se auditó la divergencia de raíces entre Linaje A (`d42b454`) y Linaje B (`bb0c866`). `origin/main` solo contiene 3 commits con el README inicial, mientras que Linaje B contiene la suite de producción.
2. **Absorción de `backend` e `integracion`:** Se confirmó que `feature/fullstack-nuevamente-v2` contiene el 100% de `backend` (+42 commits por delante) y de `integracion` (+25 commits por delante). No existen commits faltantes (`0`), permitiendo un avance por *Fast-Forward* sin colisiones ni conflictos de fusión.
3. **Estrategia de convergencia:**
   - Fast-Forward de `integracion` y `backend`.
   - Cherry-pick / Port selectivo de UI desde `origin/feature/newmind-edtech-oci` (`BadgeModal` showcase y `Step1Ingestion` drag-and-drop).
   - Promoción limpia de Linaje B como la rama `main` de producción en GitHub.

---

**Firmado por:**  
🤖 **Modelo de IA: Gemini 3.8 & Antigravity Agent**  
*Arquitectura de Soluciones Cloud OCI, DevOps & Integración Full-Stack*  
*Fecha: 13 de Octubre de 2026*


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

---

## 14 oct 2026 · Citas que no se localizaban por la tipografía del PDF

**Estado:** sin commit.

**Síntoma (sistema en vivo).** Seis de siete avisos del paquete eran de citas no encontradas: flashcards 3 de 4, cuestionario 4 de 4, glosario 2 de 4, guion 3 de 3, diapositivas 3 de 5. Con el PDF escaneado del 13 de octubre se habían localizado 21 de 21.

**Causa.** La comparación solo ignoraba espacios, mayúsculas y marcas de Markdown, pero el texto que extrae `pypdf` no coincide con el que reproduce un modelo. Se midió reproduciendo 300 frases reales de cada PDF con tipografía normal:

| PDF | No localizadas antes | Motivo principal |
|---|---|---|
| Snowflake | 199 de 300 (66 %) | Ligaduras `ﬁ`/`ﬂ`/`ﬀ` y 244 palabras cortadas con guion a final de línea |
| ENISA | 16 de 300 (~5 %) | Comillas `’`, guiones `–`/`—` y espacios que `pypdf` mete dentro de palabras ("nota ble") |
| El caballero de la armadura oxidada | 1 de 300 | Guiones de diálogo |

Esto probablemente explica también el 0 de 7 del resumen del ENISA del 13 de octubre, que se atribuyó a la fidelidad del modelo de respaldo.

**Solución** (`backend/app/core/fuentes.py`). Ahora se comparan solo letras y dígitos, en minúsculas y sin tildes (NFKD), con la misma regla para la cita y para el documento. Se ignoran espacios, puntuación, guiones, ligaduras y comillas. Las palabras y su orden deben coincidir, así que una paráfrasis sigue sin pasar (hay tests para palabras cambiadas, quitadas y reordenadas). El mínimo de una cita pasa de 20 caracteres a 16 letras o dígitos, que equivale aproximadamente al mismo largo.

**Resultado.** 0 de 300 frases no localizadas en los tres PDF. La normalización del ENISA (254 540 caracteres) tarda 103 ms y queda en caché.

**Pendiente.**
- No se sabe qué documento se usó en la prueba en vivo. Falta confirmar que esos avisos desaparecen al regenerar.
- "No se pudo generar «Resumen»: servidor" no se explica por esto: falló también el modelo de respaldo, o el entorno en vivo no lo tiene activo. Faltan los registros.

**También en este bloque.** `CLAUDE.md` en la raíz: mapa de archivos y contratos (punteros, no copias), comandos de verificación, trampas del entorno y reglas del proyecto. Claude Code lo carga en cada sesión.

**Verificación.** Backend: 259 tests.

---

## 14 oct 2026 · Notas al pie, auditoría por fragmentos y cuota compartida

**Estado:** sin commit. Probado contra el servidor local con el ENISA (101 páginas, 254 540 caracteres), en tres generaciones reales en modo paralelo.

**1. La corrección de citas, confirmada en vivo.** Con el ENISA, flashcards, cuestionario y guion pasaron de 1/4, 0/4 y 0/3 citas localizadas a 4/4, 4/4 y 3/3.

**2. Llamadas a nota al pie pegadas al texto.** Dos de las citas que seguían fallando eran correctas: el PDF dice `(EUVD)631` y `EU629`, y el modelo cita sin el número de la nota.
- `fuentes.py` ahora descarta un grupo de hasta 4 dígitos pegado detrás de una letra, un `)` o unas comillas de cierre, si no le sigue otra letra o dígito. También descarta los superíndices `¹²³`.
- La regla se aplica igual a la cita y al documento: `IPv6` sigue coincidiendo, y "4 GB" no coincide con "8 GB".
- Con el resultado real guardado, pasa de 24/26 a 26/26 citas localizadas.
- La simulación de 300 frases por PDF sigue en 0 fallos.

**3. La auditoría solo veía el principio del documento.** El auditor (Groq) recibía `texto_fuente[:24000]`: en el ENISA, unas 10 de 101 páginas. Todo lo que salía de páginas posteriores le parecía "sin respaldo" y la puntuación de anclaje cayó a 0,55.
- `fuentes.fragmentos_para_auditoria` divide el documento en bloques de ~1 200 caracteres y los puntúa por los términos que comparten con cada afirmación (con peso IDF). Reparte por turnos el mismo presupuesto de 24 000 caracteres, para que cada afirmación tenga primero su mejor bloque, y une sin separador los bloques contiguos.
- Si el documento cabe entero en el presupuesto, se envía completo, como antes.
- El aviso ahora dice exactamente qué se auditó: "contrastó los fragmentos más relacionados (22 775 de 254 540 caracteres)".
- **Resultado:** anclaje de 0,55 a 0,99.
- Problema encontrado al escribir los tests: dos bloques contiguos se unían con `[…]`, lo que partía las frases por la mitad. Corregido.

**4. Riesgo de cuota compartida, confirmado.** Desde `a245424` las tres tareas usan `gemini-3.5-flash-lite`. Una segunda generación del ENISA dos minutos después de la primera recibió 429 en las tres tareas a la vez; las tres pasaron a `3.1-flash-lite` y la tarea B1 tardó 94,5 s. Los invitados no tienen caché, así que repetir el mismo documento vuelve a gastar cuota.

**Citas que siguen sin localizarse (tercera generación: 25 de 30 localizadas)**

| Caso | ¿Correcto? |
|---|---|
| Cita recortada con `...` ("48 thousand… a 22% increase") | Sí: no es literal |
| Dos frases del documento fusionadas en una ("China-nexus… Operational Relay Boxes") | Sí: no es literal |
| Nota pegada a un número: `2025295` (año 2025 + nota 295) | No: límite conocido. Separarla arriesgaría falsos positivos |
| Cita que cruza un salto de página con la nota 548 en medio | No: límite conocido. Haría falta quitar las notas al pie de cada página al extraer el PDF |

**Verificación:** backend, 262 tests.

---

## 14 oct 2026 · Caché para invitados y auditorías reutilizables

**Estado:** sin commit.

**Contexto.** Repetir el mismo documento como invitado volvía a gastar las tres llamadas a Gemini: los invitados no tenían registro de tareas. Con las tres tareas en `gemini-3.5-flash-lite`, eso provocaba 429 simultáneos (ver la entrada anterior). Se adoptó una caché en memoria para invitados, pensada para pruebas y demos. Un plan de ChatGPT proponía además colas, distinguir los 429 diarios de los por minuto y comparar modelos; eso queda pendiente.

**Caché de invitados** (`main._REGISTRO_INVITADOS`)
- Es un `RegistroMemoria` compartido por el proceso. Se pierde al reiniciar.
- Tiene un tope de `MAX_FILAS_CACHE_INVITADOS` filas (200 por defecto, unos 20 documentos); 0 la desactiva. Descarta las más antiguas y no guarda historial de escrituras.
- Es segura porque la clave de cada tarea incluye el hash del contenido del documento: solo acierta quien sube ese mismo documento. Los invitados ya comparten identidad, y nada de un invitado llega a Supabase.

**Auditorías reutilizables** (`generacion_paralela._AUDITORIAS`)
- Al repetir el ENISA al minuto, Groq respondió HTTP 413 (tokens por minuto agotados) en sus tres modelos y la auditoría quedó como no ejecutada.
- Ahora se recuerdan las últimas 32 auditorías ejecutadas, con una clave que combina propietario, afirmaciones y texto auditado. Las fallidas no se recuerdan, así que se reintentan en la siguiente generación.

**Aislamiento de tests:** `backend/tests/conftest.py` vacía las dos cachés antes de cada test.

**Verificación en vivo** (servidor reiniciado, ENISA dos veces como invitado)

| Generación | Tiempo | Llamadas | Resultado |
|---|---|---|---|
| Primera | 23,2 s | 3 a Gemini y 1 a Groq | 30 de 30 citas localizadas, anclaje 0,92 |
| Segunda | 9,9 s (extracción del PDF) | Ninguna | Tareas y auditoría reutilizadas, mismo anclaje 0,92 |

Backend: 265 tests.

---

## 14 oct 2026 · Primera tanda del front de `newmind-edtech-oci`

Portados a mano, porque esa rama no comparte historia con la nuestra. Sin commit.

| Origen | Qué | Cómo |
|---|---|---|
| `54ed643` | Flashcards: la tarjeta ajusta su altura al contenido; la pista didáctica pasa al anverso (en el reverso ya se veía la respuesta); botones "Girar tarjeta" y "Volver al frente"; los clics en la pista no giran la tarjeta | `git apply`, limpio |
| `e895d38` | El botón de la medalla final abre la vitrina de trofeos | `git apply`, limpio |
| `a0e841e` | Texto más amable al agotar los escudos ("El error es parte del aprendizaje") | `git apply`, limpio |
| `f2f648f` | Regla del 100 % **solo en el quiz** (decisión del usuario). Las estaciones 1 a 4 siguen aprobando con el 60 % | A mano |

**Descartados**
- `95c68ec`, `b273df0`, `0018ff8` y `f23d614` (100 % en las estaciones 1 a 4): el usuario quiere el 100 % solo en el quiz.
- `c1b0334` (valores por defecto "genéricos" en la Estación 1): nuestra versión ya muestra "—" cuando falta el dato, que es lo honesto.
- `df18965` (storyboard): sustituiría el video narrado.
- `7b4616c`, `30a0665` y `cc5d028`: llaman a Gemini desde el navegador.

**Problemas**
- Los parches traían espacios al final de línea; los quité.
- `Station5Quiz.tsx` es CRLF: el reemplazo se hizo conservando ese final de línea.

**Reintento por pregunta en el quiz** (decisión del usuario, inspirado en `5508c84`)
- Con el 100 % y una sola respuesta por pregunta, un error obligaba a repetir el examen entero.
- Ahora, al fallar, se pierde un escudo y la alternativa queda marcada y bloqueada. Se puede probar otra sin que se revele la correcta, y los 3 escudos siguen limitando los errores.
- Al acertar, la fundamentación explica también por qué fallaban las descartadas, a partir de `explicaciones_opciones` del backend. Antes de acertar no se muestra, porque esa explicación puede delatar la correcta.
- Los fallos se guardan en `QuizState.failedOptions` y viajan con el progreso; los estados antiguos se completan con `EMPTY_QUIZ`. Servirán para el repaso guiado que propuso el usuario (anotado en `PROXIMOS_PASOS`).
- A diferencia del original, no usa `setTimeout` para limpiar la selección: la alternativa fallada queda marcada.

**Verificación:** `tsc` sin errores, 17 tests del frontend, `eslint` sin errores en los archivos tocados y build correcto.

---

## 14 oct 2026 · Repaso guiado del quiz

Idea del usuario: aprovechar los errores del quiz para indicar dónde profundizar. Se hizo sin modelo y sin gastar cuota.

**Qué hace**
- `utils/repasoQuiz.ts` (`puntosDeRepaso`) toma los fallos guardados en `QuizState.failedOptions`. Devuelve las preguntas falladas, primero las que más fallos tienen, con la cita y la `fuente` (página) que el backend ya localizó en el documento.
- `Station5Quiz/RepasoGuiado.tsx` lo muestra en dos momentos:
  - **Al agotar los escudos:** solo la pregunta y el fragmento del documento para releer, sin la respuesta. Después vuelven las mismas preguntas, y revelarla haría que se aprobara de memoria.
  - **Al aprobar:** además la respuesta correcta, la fundamentación y por qué fallaba cada alternativa descartada, si el backend generó `explicaciones_opciones`.
- Si la cita no se localizó, el chip lo dice ("Cita no encontrada en el documento"). Si la pregunta no trae cita, se indica.

**Por qué sin modelo:** las referencias ya existen y están verificadas en el propio paquete. Pedírselas a un modelo podría inventar fuentes. Queda como opción futura que un modelo redacte un plan de repaso que se apoye solo en estas citas.

**Verificación:** 22 tests del frontend (5 nuevos en `tests/repasoQuiz.test.ts`), `tsc` sin errores, `eslint` sin errores en los archivos tocados y build correcto. Falta probarlo en el navegador.

---

## 14 oct 2026 · Resiliencia ante 429 de Gemini: clasificación de cuotas, semáforos por modelo y comparación

**Estado:** sin commit.

**Qué**
1. **Clasificación del 429 de Gemini (`backend/app/servicios/servicio_gemini.py`):**
   - Se procesa `error.details` identificando entradas `google.rpc.QuotaFailure` (`violations[].quotaId` o `description` conteniendo `PerDay` o `PerMinute`) y `google.rpc.RetryInfo` (`retryDelay`).
   - Se clasifica el error en `GeminiError` con los atributos `tipo_cuota` (`"cuota_diaria"` | `"cuota_minuto"` | `"desconocido"`) y `retry_after_s`.
   - **Cuota diaria:** no se reintenta el modelo (`reintentable=False`) y se marca en memoria del proceso (`_MODELOS_AGOTADOS_HASTA`) como agotado hasta la medianoche del Pacífico (`America/Los_Angeles` vía `zoneinfo`). Las llamadas subsiguientes a ese modelo en el proceso fallan de inmediato sin gastar peticiones a la red y conmutan directo al respaldo.
   - **Cuota por minuto:** si `retryDelay <= 10.0 s` y resta plazo en el presupuesto, se espera y se reintenta una única vez; si el retardo es superior o no queda plazo, pasa directamente al modelo de respaldo.
   - Cuerpos de error no interpretables mantienen el comportamiento preexistente.
2. **Escalonamiento de caída al respaldo (`backend/app/agentes/generacion_paralela.py` y `backend/app/core/config.py`):**
   - Concurrencia por modelo acotada mediante `asyncio.Semaphore` por modelo (`(bucle, modelo)`), configurable vía `gemini_concurrencia_por_modelo` en `Config` (`GEMINI_CONCURRENCIA_POR_MODELO`, defecto 2).
   - Inyección de desfase aleatorio (`random.uniform(0.0, 1.5)`) antes de invocar al modelo de respaldo para evitar saturación simultánea desde tareas concurrentes (A, B1, B2).
   - Procedencia honesta en los avisos de recursos: cuando se recurre al respaldo, se preserva la plantilla de aviso indicando explícitamente si fue por `(cuota diaria)` o `(cuota por minuto)` (ej. `"generado con el modelo de respaldo X porque Y no respondió (cuota diaria)"`).
   - Se mantiene intacto el mecanismo de heartbeats SSE y los límites de tiempo de Cloudflare.
3. **Script de comparación de modelos (`deploy/comparar_modelos.py`):**
   - Script independiente que evalúa `gemini-3.5-flash-lite` y `gemini-3.8-flash` en la generación de resúmenes (Tarea A).
   - Mide latencia, errores (HTTP / cuotas), consumo de tokens y citas verificadas contra el documento original mediante `ubicar_cita` de `app.core.fuentes`. Solo creado, no ejecutado para preservar cuota.

**Por qué**
- Cuando las tareas A, B1 y B2 corrían en paralelo compartiendo el modelo principal, una saturación simultánea de cuota las hacía conmutar al mismo tiempo al modelo de respaldo, saturando también este último o provocando fallos en cascada en la generación en vivo.
- Tratar por igual una cuota diaria y una por minuto gastaba reintentos inútiles cuando la cuota diaria ya no se reiniciaría hasta las 00:00 PT.

**Problemas**
- El uso de `asyncio.Semaphore` debe ser seguro frente a múltiples bucles de eventos (ej. en suites de pruebas con `asyncio.run()`), por lo que se asocia por `(id(bucle), modelo)`.
- Se aseguró la compatibilidad con CRLF en todos los archivos modificados.

**Verificación**
- 18 tests en `backend/tests/test_servicio_gemini.py` (4 tests nuevos para cuota diaria, cuota por minuto con retryDelay <= 10s, retryDelay > 10s y cuerpo no interpretable).
- 24 tests en `backend/tests/test_generacion_paralela.py` (4 tests nuevos para procedencia con cuota diaria sin llamadas de red posteriores, cuota por minuto, aviso clásico y saturación de respaldo con jitter y semáforo).
- Suite completa del backend: 275 tests pasados (`pytest -q`).
- Validación sintáctica de `deploy/comparar_modelos.py` mediante `py_compile`.

---

## 14 oct 2026 · Lint del frontend a cero y voces latinas por nombre

**Lint:** `npx eslint .` pasa de 13 errores y 1 aviso a cero. A partir de ahora, cualquier error nuevo se ve sin tener que comparar con HEAD.
- **`any` en `Step2KnowledgeQuest.tsx`:** 6 casos. El helper `listaDe(valor, ...claves)` acepta la lista directa o envuelta (`{ pasos }`, `{ scenes }`…), como antes, pero tipado.
- **`any` en `api.ts` y `MermaidDiagram.tsx`:** el evento SSE tiene ahora su tipo `EventoSSE`; el error de Mermaid pasa a `unknown`.
- **`api.ts`:** el error que se relanza conserva el original en `cause`.
- **`MermaidDiagram.tsx`:**
  - antes, el efecto ponía estados de carga de forma síncrona;
  - ahora se guarda el resultado del último diagrama dibujado, y "cargando" se deriva de si ese resultado corresponde al diagrama actual.
- **`App.tsx`:**
  - **`latestState`:** antes se escribía durante el render; ahora se hace en un `useLayoutEffect`. Los seis lectores son un `useEffect` y manejadores de eventos, así que siguen viendo el valor fresco.
  - **Modo local:** el estado inicial (`ready` y el mensaje) se calcula al crear el estado, no en el efecto.
  - **Limpieza del efecto de sesión:** usa una copia del ref.
  - **`finally` de la generación:** ya no tiene `return`. Mismo comportamiento: si cambió la cuenta, no se toca el estado.

**Voces del navegador (`7c21e99`):** casi todo ya estaba portado (la cascada de regiones y la espera de `voiceschanged`). Faltaba un paso: si no hay voz con región latinoamericana, se prefiere una voz en español cuyo nombre lo indique (Paulina, Sabina, Tomás, "latino", "México"…), comparando sin tildes. Para quitar las tildes se usa `/\p{M}/gu`, porque los heredocs convertían el rango de escapes en caracteres invisibles. El original tenía una errata: buscaba "paulino" en lugar de "paulina".

**Verificación:** 23 tests del frontend (uno nuevo de voces), `tsc` sin errores, `eslint .` con 0 problemas y build correcto. Falta probarlo en el navegador: la Estación 4 con la voz del navegador y un diagrama Mermaid.

---

## 14 oct 2026 · Revisión del trabajo de Gemini sobre los 429

Claude revisó el bloque anterior antes del commit y corrigió dos problemas.

**1. El semáforo por modelo frenaba cada generación sin proteger la cuota.**
- **Problema:** vivía dentro de `GeneradorParalelo`, que se crea en cada petición, y se aplicaba también al modelo principal. Como A, B1 y B2 usan el mismo modelo (`3.5-flash-lite`) y el límite es 2, una de las tres tareas esperaba siempre, aunque no hubiera ningún 429. Además no limitaba nada entre peticiones simultáneas.
- **Arreglo:**
  - El semáforo es ahora del proceso (`_SEMAFOROS_RESPALDO`, uno por bucle de eventos y modelo) y solo se aplica al respaldo, que es donde coinciden todas las tareas cuando el principal se satura.
  - El principal vuelve a salir con las tres tareas a la vez.
  - El desfase aleatorio y el semáforo quedan en `_llamar_respaldo`.

**2. La cuota diaria no tenía prioridad.**
- **Problema:** si Google listaba primero una violación `PerMinute` y después una `PerDay`, el error se clasificaba como "por minuto", se reintentaba y el modelo no quedaba marcado como agotado.
- **Arreglo:** si alguna violación es diaria, gana la diaria. De paso se quitaron una condición que siempre era verdadera y un `if ... pass` muerto.

**Tests**
- El test de saturación del respaldo ahora exige que el principal llegue a 3 llamadas simultáneas y el respaldo no pase de 2.
- Nuevos:
  - `test_limite_del_respaldo_es_del_proceso_no_de_cada_generacion`: dos generaciones simultáneas suman 6 llamadas al principal, y como mucho 2 a la vez en el respaldo.
  - `test_429_con_violaciones_mixtas_gana_la_cuota_diaria`.
- `conftest.py` limpia también los modelos agotados entre tests.
- Se corrigió la descripción del semáforo en `backend/docs/ARCHITECTURE.md` y `CHANGELOG.md`.

**Verificación:** 275 tests del backend.

---

## 14 oct 2026 · Absorción de la rama `frontEnd`

Esta rama (22 commits, el último del 29/09, de CariBosio) no comparte historia con la nuestra. Es la primera UI: `IngestView`, `ViewerView` con 5 visores, `MetricsView` y un prototipo en Streamlit. Se revisó archivo por archivo.

**Ya estaba absorbido o superado**
- Las vistas: las sustituyeron `Step1Ingestion`, las 5 estaciones y `RecursoEstado`, y se borraron en `dfa6f42`.
- `docs/docs.txt`, `eslint.config.js` y `vite.config.ts` son idénticos a los nuestros.
- Los ajustes responsive eran para un `Header` que ya no existe.

**Se rescató**
- La tabla de equivalencias Python ↔ Node para el equipo de backend (`137de17`), en `frontend/README.md`. Se actualizó a cómo se arranca hoy (`npm ci`, `.env.local`, tests, `tsc`, lint) y se añadió la advertencia de que nada secreto va en `VITE_*`.

**Restos que la rama había dejado en la nuestra, eliminados**
- **Componentes sin uso:** `Button`, `SelectField` y `Stepper` no los importaba nadie.
- **Dependencias sin uso:** `gsap` y `@studio-freight/lenis` estaban en `package.json`, pero ningún archivo las usaba (`npm uninstall`).
- **README raíz:** su árbol de `frontend/` describía la estructura antigua; se reescribió con la actual.
- **Enlace roto:** `frontend/README.md` enlazaba `iniciar_local.bat` con una ruta absoluta de un disco local; ahora es relativa.

**Queda en manos del equipo:** archivar la rama remota (por ejemplo, con una etiqueta `archivo/frontEnd`) y borrarla. No se tocó nada en el remoto.

**Verificación:** `tsc` sin errores, 23 tests del frontend, `eslint .` con 0 problemas y build correcto.

---

## 14 oct 2026 · `newmind-edtech-oci`: nivel de detalle y prompt visual

**Directivas de nivel de detalle** (idea del prompt de `cc5d028`)
- El backend ya tenía directivas por perfil y por sector, pero el nivel de detalle solo se pasaba como nombre. Se añadió `DIRECTIVAS_NIVEL_DETALLE` en `schemas.py` para Didáctico, Intermedio y Profundo. La usan el modo paralelo (`_instrucciones_audiencia`) y la cadena colaborativa de respaldo.
- **Cambio respecto al original:** allí se pedían "comandos con flags reales". Aquí todo comando, parámetro o cifra tiene que salir del documento: "si el documento no da un comando o un valor, no lo inventes".
- **Fallo de caché corregido de paso:** `huella_tarea` no incluía las directivas de audiencia. Al cambiar una directiva, la caché habría seguido devolviendo resultados generados con la anterior, aunque el docstring prometía lo contrario. Ahora las incluye; ya no hace falta subir `VERSION_PROCESADO` cuando cambia un prompt de audiencia.

**Botón "Copiar prompt visual" en la Estación 4** (idea del storyboard de `df18965`)
- `utils/promptVisual.ts` arma el texto con lo que el backend ya generó para la escena: `visual.prompt_grafico` o `storyboard_visual`, el título y los puntos clave. Añade el formato 16:9 de la diapositiva y pide que la imagen no lleve texto.
- El usuario lo pega en el generador de imágenes que prefiera: NovaMind no gasta cuota ni presenta la imagen como propia.
- Si la escena no trae nada visual, el botón no aparece.

**Descartado de `df18965`:**
- **"Enriquecer con IA" y "Ampliar guion":** llaman a Gemini desde el navegador.
- **El visor de cámara:** es pura decoración y el modo cine ya cumple esa función.

**Avisos para el equipo sobre esa rama**
- `geminiService.ts` lee `VITE_GEMINI_API_KEY`, así que la clave queda incrustada en el JavaScript público. Si se desplegó con una clave real, hay que rotarla.
- Su prompt inventa metadatos de OCI (etag, URL y tamaño fijos).

**Verificación:** 278 tests del backend (3 nuevos: cada nivel tiene directiva, las instrucciones la incluyen y cambiarla invalida la huella) y 26 del frontend (3 nuevos). `tsc` sin errores, `eslint .` con 0 problemas y build correcto.

---

## 14 oct 2026 · Preparación del despliegue en la VM

Se revisó qué necesita la VM para la versión actual. No se tocó la VM.

**`.env.example`**
- Faltaban `GEMINI_CONCURRENCIA_POR_MODELO` y `MAX_FILAS_CACHE_INVITADOS`, las dos de hoy, y las de correo (`SMTP_*`; sin ellas, el correo funciona en modo simulación).
- Se añadieron como comentarios de línea completa: en la VM, los comentarios en la misma línea que un valor ya corrompieron las credenciales de OCI.

**Problemas que harían fallar el despliegue** (documentados en `deploy/README_DESPLIEGUE_OCI.md`, sección 3b, que no se versiona)
- **nginx:** no define `client_max_body_size`, así que acepta 1 MB por defecto. Toda subida de más de 1 MB devolvería 413, y el backend admite 15 MB.
- **`.env` de producción:** el documentado era el de la arquitectura anterior (Cohere y LangGraph). Le faltan `GEMINI_API_KEY`, `GROQ_API_KEY`, `SUPABASE_*`, `ELEVENLABS_*` y `APP_ENV`.
- **Modo invitado:** con `APP_ENV=prod` queda desactivado salvo que se añada `PERMITIR_MODO_INVITADO=true`.
- **Build del front:** le faltaban `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

**Lo que no hacía falta cambiar:** el SSE ya funciona detrás de nginx y Cloudflare, porque el backend envía `X-Accel-Buffering: no` y heartbeats cada 15 s.

**`deploy/audiovisual.md`:** es el encargo original de diseño, de 1 108 líneas. Se conserva y se le añadió una nota inicial con el estado real: sin MP4 ni FFmpeg, diapositivas narradas en el navegador y qué partes del encargo no aplican.

---

## 14 oct 2026 · Decisión del modelo del resumen

Se ejecutó `deploy/comparar_modelos.py` (Tarea A, 4 llamadas reales) sobre `guia_optimizacion_swap_oci.md` y `apache_kafka_introduction.md`.

| Modelo | Respondió | Latencia | Citas localizadas |
|---|---|---|---|
| `gemini-3.5-flash-lite` | 2 de 2 | 4,6 a 6,1 s | 16 de 17 (94 %) |
| `gemini-3.8-flash` | 1 de 2 (dos 503, "high demand") | 73,4 s | 9 de 12 (75 %) |

**Decisión:** el resumen sigue en `3.5-flash-lite`. Pasarlo a `3.8-flash` para repartir la cuota sería peor en disponibilidad, en latencia (73 s se acercan al corte de 100 s de Cloudflare) y en fidelidad. El riesgo de compartir cuota lo cubren el respaldo `3.1-flash-lite` escalonado, la detección de cuota diaria y las cachés.

**Límite de la prueba:** solo 2 documentos `.md` pequeños. Encaja con lo medido antes en el ENISA (30 de 30 citas con `3.5-flash-lite`).

---

## 14 oct 2026 · E2E de la narración y revisión de la prueba en el navegador

**E2E de la narración** (`node tests/e2e_narracion.manual.ts`, desde `frontend/`, backend local en modo invitado, documento `guia_optimizacion_swap_oci.md`).
- Antes de ejecutarlo se comprobaron sus tipos con `tsc --strict` (sin el `tsconfig` del proyecto, que no incluye `tests/`): 0 errores.
- **Generación:** 16 s; 3 llamadas reales a `gemini-3.5-flash-lite` (6,1 s, 7,2 s y 12,9 s), sin caché ni respaldo.
- **Narración:** `status=exito`, proveedor ElevenLabs, almacenamiento en línea. **Tardó 5,7 s**, lejos de los 100 s de Cloudflare.
- **Duración:** 3 escenas de 37, 37 y 35 palabras, con 15,2 s, 16,3 s y 14,3 s. En total, **45,9 s de un máximo de 60 s**, y la suma por escena cuadra con el total.
- **Fotos:** las 3 escenas tienen foto de Openverse con autor y licencia CC. Las palabras clave fueron genéricas ("cloud server", "storage disk", "error warning code"), lo que confirma el pendiente de pedir palabras clave más concretas en el guion.
- **Coste:** unas 109 palabras narradas con ElevenLabs y 3 llamadas a Gemini.

**Revisión de la prueba en el navegador hecha con Gemini.** La mayor parte de lo marcado como "chequeado" se comprobó leyendo el código, no usando la aplicación. Sus capturas solo cubren el paquete de demostración en modo invitado:
- **Comprobado en el navegador:** el quiz respondido sin fallos (`Aprobación: 3/3 (100 %)`), las flashcards, Mermaid y la Estación 4 cargada.
- **Sin probar en el navegador:**
  - fallar una opción, perder un escudo y que aparezca "Descartaste «…»";
  - agotar los escudos y ver el repaso guiado;
  - "Restaurar escudos";
  - la persistencia de la opción fallada tras recargar con cuenta;
  - iniciar y cerrar sesión;
  - pegar el prompt visual;
  - escuchar la voz latina;
  - la caché de invitados repetida.
- **Pendiente del paquete de demostración:** su guion tiene 69 palabras (30 s), por debajo de la meta de 110 a 125 que la propia pantalla muestra.

---

## 14 oct 2026 · Narración: tope previo del guion y plazo total

**Por qué.** `/api/v1/narracion/generar` responde de una vez, sin SSE, y tenía dos huecos:

1. **Gastaba créditos sin mirar antes el guion.** `SolicitudNarracion` solo validaba de 1 a 3 escenas, y `guion_locutor` no tiene longitud máxima. Un guion de 500 palabras enviado por un cliente (el JSON se puede exportar y editar, también como invitado) pasaba la consulta de presupuesto. Después se sintetizaba entero, se repetía en ritmo ágil y terminaba en `excede_duracion`: créditos perdidos con un resultado imposible desde el principio.
2. **No tenía plazo total.** Las repeticiones en ritmo ágil van una detrás de otra, cada una con hasta 60 s de espera en ElevenLabs, y luego venía el respaldo de Gemini (90 s). El peor caso superaba de lejos los 100 s de Cloudflare: un 524 sin explicación.

**Qué se hizo.**
- **`schemas.py` · `exceso_guion_narracion`:** un guion no se narra si supera `max_duration × 1,05 × 165 palabras/min` (173 palabras para 60 s). Es el ritmo más rápido que alcanza cualquier voz: ElevenLabs ágil ronda las 155 y Gemini las 160. Tampoco se narra si supera 10 caracteres por cada palabra admitida (1 730), porque ElevenLabs cobra por carácter. Responde `status="error"`, `error_codigo="guion_largo"` y un mensaje que dice que no se gastó cuota. No llama a la voz, ni a los bancos de fotos, ni al registro. El front ya muestra `advertencias[0]`, así que no hubo que tocarlo.
- **`servicio_narracion.py` · `PLAZO_VOZ_S = 80`:** cubre la consulta de presupuesto, la voz de todos los proveedores y el ritmo ágil. Deja unos 15 s para el registro y el guardado.
  - Si el plazo llega en la primera síntesis, se responde `error_codigo="plazo"` con un mensaje explícito y **no se prueba el respaldo**, porque solo llevaría al 524.
  - Si llega durante el ritmo ágil, se decide con la voz ya pagada: puede salir bien, a velocidad ≤ 1,05×, o en `excede_duracion`.
  - Las fotos tienen un margen de 2 s más. Si no llegan, la narración sigue con las diapositivas solas y un aviso.
- **`servicio_voz.py`:** la espera de ElevenLabs baja de 60 a 25 s, porque una escena tarda ~1 s. Así, si ElevenLabs se cuelga, a Gemini le quedan más de 50 s.

**Verificación.**
- **Tests nuevos (5):**
  - el tope a 173 palabras y el de caracteres;
  - un guion de 180 palabras sin ninguna llamada ni archivo;
  - el plazo agotado, sin respaldo;
  - el plazo durante el ritmo ágil, que acaba bien a 1,025×;
  - las fotos tardías omitidas.
- **Suite del backend:** 283 tests pasan.
- **Servidor real:** un guion de 210 palabras se rechazó en 3,9 s con `guion_largo`, sin ninguna petición a ElevenLabs ni a Openverse.

**Problemas.**
- Mientras se trabajaba, Gemini, en otra sesión, devolvió `schemas.py` a HEAD. Eso borró la función nueva y dejó roto el import del narrador. Se volvió a aplicar y se verificó.
- **Lección:** no dejar que dos agentes editen el repositorio a la vez.
- Además, la entrada "Fase 22" que Gemini añadió a `historial_progreso/CAMBIOS.md` tiene caracteres de escape mal convertidos: `\b` y `\f` desaparecen ("ackend", "rontend") y `\n` parte "npm test". Es la trampa de los heredocs descrita en `CLAUDE.md`.

**Pendiente:** si el guion generado supera 125 palabras, reintentar con `flash-lite` antes de entregarlo (punto 3 de la crítica). Y alargar el guion de la demostración, que tiene 69 palabras.

---

## 14 oct 2026 · Guion acortado antes de publicar, demo a la meta y medalla honesta

**Guion largo (`generacion_paralela.py`).**
- **Antes:** un guion que pasaba de 125 palabras solo generaba un aviso. Entre 143 y 163 palabras obliga a repetir la voz en ritmo ágil (se paga dos veces), y por encima de eso no cabe en 60 s.
- **Ahora:** si el guion de B2 supera `PALABRAS_GUION_MAX`, `_ajustar_guion` hace una llamada breve al mismo modelo que acaba de responder: 20 s de plazo, sin reintentos y con `thinking_level` mínimo.
  - **Entrada:** solo los textos del guion, no el documento. Así es barata y no tiene material para añadir contenido.
  - **Instrucción:** solo acortar, sin cambiar cifras, nombres ni comandos.
  - **Validación con `guiones_ajustados`:** mismas escenas, ninguna vacía y un total ≤ 125.
  - **Si cumple:** se publica el texto acortado con el aviso "guion acortado por IA de X a Y palabras (modelo)".
  - **Si no cumple o falla:** queda el original, con el aviso "no se pudo acortar" y el de fuera de rango. El tope previo de la narración sigue protegiendo los créditos.
- **Detalles:** la respuesta del modelo se comparte entre peticiones idénticas, así que se copia y nunca se modifica. Un guion corto sigue solo con su aviso, porque quedarse corto no cuesta créditos. `VERSION_PROCESADO` no se subió: subirla obligaría a regenerar todas las cachés.

**Guion de la demo (`frontend/src/data/mockScenarios.ts`).** Pasa de 69 a 122 palabras (42, 39 y 41): 53,1 s al ritmo del contrato, dentro de la meta de 110 a 125 que muestra la pantalla. Solo usa datos que la demo ya tenía: fallocate, chmod 600, mkswap, swapon, free -h, 1,5 GB, 12 s y coste cero. Se actualizaron los tramos y los conteos.

**Medalla (`BadgeModal.tsx`).** El aviso decía "listo para sincronización con el almacenamiento de OCI", lo que era falso dos veces: como invitado no se guarda nada, y con cuenta el progreso va a Supabase (`user_state`), no a OCI. Ahora el modal recibe `sesionIniciada`:
- **con cuenta:** "Logro guardado en tu cuenta";
- **como invitado:** "Logro de esta sesión", con la explicación de que se pierde al recargar.

**Directivas para varios agentes.**
- Nueva sección en `CLAUDE.md`.
- Nuevos `AGENTS.md` y `GEMINI.md` en las dos carpetas, excluidos en `.git/info/exclude`: no se versionan.
- Gemini trabaja en el worktree `../NovaMind-gemini` (rama `gemini/pruebas`, puertos 8001 y 5174), con `.env`, `frontend/.env.local` (apuntando al 8001) y `npm ci` ya preparados.

**Revisión de la prueba de Gemini en el navegador** (con CDP sobre Chrome real):
- **Probado:**
  - fallo con escudo y opción bloqueada;
  - "Repasa esto";
  - pantalla con 0 escudos;
  - prompt visual;
  - voz `Google español de Estados Unidos (es-US)`;
  - flashcards a 400 px;
  - caché de invitados (15,3 s y luego 3,0 s);
  - consola sin errores.
- **Sin evidencia en las capturas:** "Restaurar escudos" (la captura muestra el modal de la medalla) y "Descartaste «…»" (la captura se corta antes).
- **Pendiente:** la sesión con cuenta.

**Verificación.**
- **Backend:** 288 tests, 5 nuevos (sin ajuste, ajuste correcto y 3 casos en que se queda el original).
- **Front:** `npm test`, `tsc` y `npm run build` limpios, y `eslint` sin problemas en los archivos tocados.

---

## 14 oct 2026 · Estación 1: arrastrar y soltar archivos

**Problema reportado por el usuario.** No podía cargar archivos del PC.

**Diagnóstico** (Chrome real controlado por CDP):
- **El clic sí funcionaba:** el .md dio 7 598 caracteres de vista previa y el PDF, 74 325 vía `/documentos/extraer`. Ningún elemento tapaba la zona y la consola no tenía errores.
- **Lo que fallaba era arrastrar:** la zona tiene borde discontinuo y se llama `fileDropzone`, pero no tenía manejadores de arrastre. Al soltar un archivo, el navegador lo abría en la pestaña y se perdía la aplicación.

**Qué se hizo** (`Step1Ingestion.tsx`):
- La lógica de carga pasa a `procesarArchivo(file)`, que comparten el clic y el arrastre.
- `onDragOver` llama a `preventDefault` (sin eso el navegador abre el archivo) y marca la zona como activa: borde sólido y el texto "Suelta el archivo aquí".
- `onDrop` comprueba la extensión a mano, porque `accept` solo filtra el diálogo de archivos. Si el formato no se admite, se muestra el error y no se carga nada.
- El texto de la zona ahora dice "Arrastra o haz clic".

**Verificación.**
- **En Chrome con CDP (`Input.dispatchDragEvent` y archivos reales):** soltar el .md y el PDF los carga y la URL no cambia. Soltar un .py muestra el error de formato. La consola sigue sin errores.
- **Front:** `tsc`, `eslint` del archivo, los 26 tests y el build, todo limpio.

---

## 14 oct 2026 · Estación 1: la zona de carga guía al usuario

**Pedido del usuario.** Que la zona de carga tenga una animación o algo que indique por dónde empezar.

**Qué se hizo** (`Step1Ingestion.tsx` y `.module.css`):
- **Sin documento** (`sinDocumento`: sin archivo, sin texto y sin carga en curso):
  - la zona pasa al primer lugar del formulario y ocupa todo el ancho;
  - lleva la etiqueta "Paso 1 · Empieza aquí", un ícono más grande, el texto "Arrastra tu documento aquí o haz clic para elegirlo" y una pista con los formatos, el límite de 15 MB y la opción de la biblioteca;
  - tiene dos animaciones suaves: un halo violeta que late (`invitacion`, 2,4 s) y el ícono que flota (`flotar`, 1,8 s).
- **Con documento** (por archivo, demo o biblioteca): vuelve a la versión compacta, sin animación.
- **Con `prefers-reduced-motion: reduce`:** no hay animación. La guía visual se mantiene: etiqueta, borde y fondo violeta.

**Verificación en Chrome con CDP, a 1280 y 400 px:**
- Las capturas de los dos estados se ven bien y no hay desbordamiento horizontal.
- Con la preferencia normal corren las dos animaciones; con movimiento reducido emulado, ninguna.
- **Ojo:** Chrome sin interfaz emula movimiento reducido por defecto. En Windows también lo activa la opción "Efectos de animación" desactivada.
- **Front:** `tsc`, `eslint`, los 26 tests y el build, todo limpio.

---

## 14 oct 2026 · Estación 1: la biblioteca de documentos pasa a menú desplegable

**Pedido del usuario.** Las 5 tarjetas de la biblioteca ocupaban mucho espacio. Quería un menú desplegable.

**Qué se hizo** (`Step1Ingestion.tsx` y `.module.css`):
- **Menú nativo** (`<select>`, accesible con teclado y con el selector del sistema en el móvil). Empieza en "Elige un documento de prueba…", y cada opción muestra el título, el tipo y el tamaño.
- **Ficha:** al elegir un documento, debajo aparecen su nicho, tipo, tamaño y descripción completa.
- **Al subir un archivo propio,** el menú vuelve a "Elige…" y la ficha desaparece, porque `selectedDocId` pasa a `null`.
- **CSS:** se quitaron la rejilla, el título de tarjeta y el `hover` de tarjeta clicable, que ya no se usaban.

**Verificación en Chrome con CDP, a 1280 y 400 px:**
- Las 5 opciones están.
- Al elegir Kafka se cargan 11 052 caracteres de vista previa y aparece la ficha.
- Al subir un .md propio, el menú se limpia.
- No hay desbordamiento horizontal y la consola no tiene errores.
- **Front:** `tsc`, `eslint`, los 26 tests y el build, todo limpio.

---

## 14 oct 2026 · Estación 1: dos formas de empezar, Sorpréndeme o Personalizado

**Pedido del usuario.** Que la configuración (perfil, nicho y nivel) ofrezca dos formas de empezar: Sorpréndeme y Personalizado.

**Qué se hizo** (`Step1Ingestion.tsx` y `.module.css`):
- **Selector de modo** (`role=radiogroup`) con dos tarjetas. Empieza en Personalizado, así que el comportamiento por defecto no cambia.
- **Sorpréndeme:**
  - sortea perfil, sector y nivel y **muestra la combinación** antes de generar ("Te tocó: …", región `aria-live`), así que lo que se ve es exactamente lo que se envía;
  - "Otra combinación" vuelve a sortear y nunca repite la actual.
- **Personalizado:** los tres selectores de siempre. Las opciones pasan a las constantes `PERFILES`, `NICHOS` y `NIVELES`, que comparten los selectores y el sorteo.
- **Estado común:** los dos modos usan el mismo estado, así que el envío no cambia, y al pasar a Personalizado los selectores muestran lo sorteado.
- **Biblioteca:** al elegir un documento, su nicho y perfil del catálogo solo se aplican en Personalizado. En Sorpréndeme se respeta el sorteo que el usuario ya ve.
- **Valores:** el front envía "Técnico Profundo" y el backend lo traduce a "Profundo" por alias (`_MAPA_NIVEL`). Son compatibles.

**Verificación en Chrome con CDP, a 1280 y 400 px:**
- El cambio de modo funciona y el sorteo se ve en los chips.
- "Otra combinación" cambió la combinación 5 de 5 veces.
- El sorteo sigue intacto tras elegir Kafka de la biblioteca.
- Personalizado conserva lo sorteado.
- No hay desbordamiento horizontal y la consola no tiene errores.
- **Front:** `tsc`, `eslint`, los 26 tests y el build, todo limpio.

---

## 14 oct 2026 · Estación 1: arranque en Sorpréndeme, prompt visible y nichos coherentes

**Pedidos del usuario.**
- Empezar en Sorpréndeme, con una descripción breve debajo de lo que se generará.
- Después, que esa descripción se lea como el prompt que el programa le manda a la IA.

**Qué se hizo** (`Step1Ingestion.tsx` y `.module.css`):
- **Arranque:** el modo inicial es Sorpréndeme, y perfil, nicho y nivel arrancan ya sorteados (inicialización perezosa de `useState`).
- **Prompt visible** (`promptPaquete`): bajo los parámetros, en los dos modos, una caja "Lo que NovaMind le pedirá a la IA (resumen de las instrucciones reales)" con un prompt de rol: "Eres un tutor experto. Tu estudiante es … del sector … y quiere …", el enfoque del perfil, los ejemplos del sector, la profundidad, las 5 estaciones y la regla de citar solo el documento.
- **Fidelidad:** cada frase resume la directiva real de `schemas.py`. El texto dice que el estudiante es del sector, no que la IA sea especialista en él, porque eso es lo que de verdad se le envía a Gemini. Se etiqueta como resumen porque las directivas reales son más largas.
- **Terminología:** no es un metaprompt (un prompt que escribe otros prompts), sino un prompt de rol armado desde una plantilla. Mostrarlo es transparencia del prompt.

**¿Funcionan los nichos?** Se verificó el recorrido completo:
- el front envía `nicho_sector`;
- el backend lo valida (`_MAPA_NICHO`);
- `_instrucciones_audiencia` lo mete en el prompt de las tareas A, B1 y B2;
- y entra en `huella_tarea`.

Los 11 nichos tienen su propia directiva y llegan al prompt sin caer en "General", y los 4 perfiles del front tienen directiva. Que el contenido generado refleje de verdad el nicho no se probó con Gemini, porque gasta cuota.

**Problema encontrado y corregido.**
- **Qué pasaba:** el catálogo marcaba Kafka con "Fintech", que no es una de las 11 opciones. El backend lo traducía bien por alias, pero en Personalizado el selector mostraba otra opción distinta de la enviada, y la descripción habría dicho "Fintech".
- **Corrección:** Kafka pasa a "Finanzas y Contabilidad", y se quitaron del tipo `IndustryNiche` los valores antiguos "Fintech", "Salud" y "E-commerce", para que `tsc` avise si vuelven.

**Verificación en Chrome con CDP, a 1280 y 400 px:**
- arranca en Sorpréndeme;
- el prompt cambia con cada combinación y en Personalizado al cambiar un selector;
- con los 5 documentos de la biblioteca, el nicho enviado coincide con la opción visible;
- no hay desbordamiento horizontal y la consola no tiene errores.
- **Front:** `tsc`, `eslint`, los 26 tests y el build, todo limpio.

---

## 14 oct 2026 · Correo: dirección enmascarada, tests sin OCI real y recibo honesto

**Pedido** (pendiente técnico 2): en modo simulación, `servicio_correo.py` escribía en el log la dirección completa del destinatario.

**Qué se hizo** (`servicio_correo.py`):
- **`enmascarar_correo`:** `alumno@ejemplo.com` pasa a `al***@ejemplo.com`, y sin destinatario se escribe "(sin destinatario)". Se usa en los 4 logs.
- **Error SMTP:** el log registra solo el tipo de excepción, porque el texto de `SMTPRecipientsRefused` repite la dirección.
- **`smtp_from`** se define en la clase base. Antes solo existía en `PrivateCorreo`, y la base fallaba con `AttributeError` al enviar de verdad. Se quitó la línea duplicada y el `import os` que quedó sin uso en `private_pipeline.py`.

**Problemas encontrados de paso.**
1. **Los tests subían PDF reales a OCI.**
   - **Causa:** `ServicioCorreo()` crea un `OCIObjectStorageClient` con las credenciales del `.env`, así que `test_servicio_correo_modo_simulacion` subía en cada ejecución `documentos-originales/doc-arquitectura.pdf`. Los 2 tests nuevos añadían también `doc-t.pdf` hasta corregirlo.
   - **Corrección:** el *fixture autouse* del módulo impide crear el cliente OCI, como ya hacía `test_private_pipeline.py`. Ahora hay 0 subidas, y los avisos de la suite bajan de 7 a 2, porque los otros 5 venían del cliente real.
   - **Pendiente:** esos 2 objetos de prueba siguen en el bucket. Borrarlos o no lo decide el equipo.
2. **El recibo de la clase base mentía.**
   - **Qué pasaba:** el log decía "respaldado en `reportes-pdf/dossier-…`", pero el PDF se guarda en `documentos-originales/…`. Y el recibo devolvía esa ruta con "archivado en OCI" aunque no hubiera cliente o la subida fallara. `PrivateCorreo` (producción) ya lo sobrescribía, pero la base contradecía la regla 1.
   - **Corrección:** ahora usa la ruta que devuelve la subida real, o `None` con el mensaje "no se archivó en OCI".

**Verificación.** Hay 4 tests nuevos y 1 reforzado: la máscara, la ausencia de la dirección completa en los logs en modo simulación y con error SMTP, `smtp_from` en la base, el recibo sin OCI y el recibo con la ruta real. La suite del backend pasa con 292 tests.

---

## 14 oct 2026 · Visor de fuente: la cita, dentro de su página real

**Qué es.** Es la idea de NotebookLM con mejor relación entre valor y coste. Al pulsar el chip "Fuente · pág. N" de una cita, se abre un panel con el pasaje **literal** del documento y la cita resaltada. Muestra en un clic lo que distingue a NovaMind: que las citas existen de verdad en el documento.

**Diagnóstico previo** (con un subagente de exploración):
- El front nunca tenía el texto del documento ni los rangos de página. Solo recibía `{texto, pagina, verificada}`.
- `ubicar_cita` calculaba el offset de la cita y lo descartaba.
- El texto se guarda en `documents.source_text` de Supabase, pero el front no lo lee nunca, y para los invitados no existe.

**Diseño.** En lugar de mandar el documento entero (hasta 350 000 caracteres), cada **cita verificada** lleva su contexto real: unos 280 caracteres antes y después, sin salir de su página. Pesa unos 30 KB por paquete, viaja dentro del propio paquete (así que funciona al recargar y para invitados) y no necesita un endpoint nuevo.

**Backend** (`fuentes.py` y `generacion_paralela.py`):
- `tramo_de_cita` devuelve el inicio **y el fin** del tramo en el texto original. `ubicar_cita` lo reutiliza y no cambia su comportamiento.
- `contexto_de_cita` devuelve `{antes, fragmento, despues, recortado_inicio, recortado_fin}`. El fragmento es el texto **del documento**, con su tipografía (ligaduras, tildes y mayúsculas), no el que escribió el modelo. No cruza el límite de su página y corta en palabras completas.
- `_fuente` añade `contexto` **solo a las citas verificadas**. Una cita inventada sigue sin contexto.
- `VERSION_PROCESADO` no se subió: los paquetes en caché no traen contexto, y su chip sigue siendo texto, como antes.

**Front:**
- **`VisorFuente`:** un diálogo modal (`role=dialog`, `aria-modal`, título enlazado) montado en un portal.
  - Se cierra con Esc, con la X o haciendo clic fuera, y devuelve el foco al chip.
  - Pone puntos suspensivos donde el texto está recortado.
  - Lleva la nota "Texto literal del documento…".
- **`FuenteChip`:** es un botón si la cita tiene contexto; si no, sigue como texto.
- **Estación 1:** el chip estaba **dentro del `<button>`** de la tarjeta de concepto. Se movió a un hermano posicionado sobre la tarjeta, porque anidar botones es HTML inválido y el clic habría marcado el concepto.
- **Lo que no cubre:** la Estación 4 usa otro tipo de cita (`FuenteRAG`), que todavía no tiene visor.

**Verificación.**
- **Backend:** 4 tests nuevos.
  - el fragmento literal con ligadura y tildes;
  - que no cruza de página y corta en palabras completas;
  - que una cita ausente da `None`;
  - que en la generación las verificadas llevan contexto y la inventada no.
- **Suite del backend:** 296 tests.
- **Chrome real con CDP, sin gastar cuota:** `/adaptar/stream` se intercepta con un paquete generado por el backend real y el modelo simulado de los tests. El visor muestra "Documento original · pág. 2" con el pasaje y la cita resaltada, el clic no marca el concepto (sigue en 0/3), Esc lo cierra, el foco vuelve al chip y la consola no tiene errores.
- **Front:** `tsc`, `eslint`, los 26 tests y el build, todo limpio.

**Incidencia.** A las 11:23 y 11:28, otro agente (Gemini) modificó `backend/docs/API.md` y `backend/docs/CHANGELOG.md` en la carpeta principal, en contra de las directivas de worktree. No se tocaron ni se incluyen en este bloque.


## 14 oct 2026 · Auditoría de la prueba de nichos y dos correcciones

**Qué se auditó.** La fase 1 de la prueba de nichos que ejecutó Gemini (`pruebas_nichos/resultados_20261014_1105/`, fuera del repo): 5 corridas reales (General ×2, Medicina, Leyes y Finanzas) sobre `guia_optimizacion_swap_oci.md`, sin Groq ni ElevenLabs. Se revisaron los JSON crudos, no solo el informe.

**Conclusiones.**
- Los nichos funcionan: el léxico de cada sector sube muy por encima del de las corridas General (Finanzas 12,6 por mil, Leyes 5,2, Medicina 6,1). El supuesto «ruido médico» de General era entero la palabra *diagnóstico* (de memoria), mal clasificada en el léxico.
- El informe exageraba dos conclusiones: el Jaccard se apoya en un solo par General-vs-General (es un indicio, no una prueba estadística), y la fidelidad de los nichos (85–88 %) cae dentro de la variación de General (82–92 %): lo correcto es decir «no se ve degradación». Además, sus «muestras» entre «» eran paráfrasis y no texto literal.
- Las citas rechazadas no dependen del nicho. De las 18 únicas, **7 eran literales**: el modelo unía la frase con el comando que la sigue y la etiqueta `bash`/`text` de la valla del bloque de código rompía la coincidencia. El resto se rechazó con razón: una palabra cambiada («al 1.8 GB»), un añadido inventado («evitando ralentizar el CPU»), una palabra en ruso («каждого»), elisiones con «…» y cifras escritas en letras.
- **Hallazgo principal:** el sector se colaba en afirmaciones sobre el documento, sobre todo en el guion narrado (Leyes: «para cumplir con el cumplimiento normativo y evitar riesgos legales… optimizamos la memoria»; Medicina: «excelente para clínicas y hospitales»). Eso va contra la regla 1, aunque la directiva de cada nicho ya pedía no inventar.

**Cambios.**
- `generacion_paralela.py`: `_LIMITE_SECTOR` (solo con un nicho distinto de General). El sector queda limitado a analogías, ejemplos y pistas, presentado como aplicación para el lector, sin atribuir al documento propósitos ni beneficios del sector. Además: la introducción describe el documento tal como es; el guion «narra solo hechos del documento»; las citas conservan cifras, unidades y comandos (sin «cuatro gigabytes» por «4 GB») y no se les añade nada. La huella incluye las instrucciones, así que la caché anterior no se reutiliza.
- `fuentes.py`: `_normalizar` descarta las líneas que abren o cierran un bloque de código (```` ```bash ````, `~~~`) junto con su etiqueta. Un ```` ``` ```` a mitad de línea no cuenta como valla.
- `prueba_nichos.py` (fuera del repo): fuera *diagnost* y *medic* a secas (que también contaba «medición»).

**Verificación.**
- Al volver a verificar las citas reales de las 5 corridas con el verificador nuevo, se recuperan **7 citas y no hay ninguna regresión**. Todas las que siguen rechazadas son de verdad no literales.
- Hay 2 tests nuevos: la valla de código, con casos negativos («bash» en la cita, comando cambiado, ```` ``` ```` en línea), y el límite del sector (presente en Leyes, ausente en General). Backend: 298 tests pasan.
- **Pendiente:** el efecto del prompt sobre el modelo solo se ve repitiendo las 5 corridas (unas 15 llamadas a Gemini), a mano y fuera del repo.


## 14 oct 2026 · Auditoría de la 2.ª prueba de nichos: regresión del verificador y guion

**Contexto.** Gemini volvió a ejecutar las 5 corridas con el prompt nuevo (`pruebas_nichos/resultados_20261014_1202/`). El commit `abd1a54` lo hizo Gemini desde la carpeta principal: el contenido es el cambio de Claude, pero va contra las directivas de worktrees.

**Lo que se confirma.**
- La introducción ya describe el documento tal como es y presenta el sector como aplicación («Para tu labor en el ámbito legal, esto equivale a…»). Los guiones de Leyes y Finanzas narran hechos reales del documento (1 GB, 50 GB, 4 GB de swap, OOM Killer) sin atribuirle propósitos legales ni financieros.
- La señal de sector sigue por encima del ruido en los tres nichos (Medicina 5,1, Leyes 5,2 y Finanzas +4,0 por mil). La caída de Finanzas (de 12,2 a 4,0) es el efecto buscado: el sector ya no satura el texto.

**Lo que el informe de Gemini atribuía mal.**
- El «salto en fidelidad» mezcla un cambio de medida con un cambio del modelo. Con el **mismo** verificador, las citas únicas pasan de 91,3 % (1.ª corrida) a 94,4 % (2.ª): una mejora modesta, de una sola corrida.
- E3 (Medicina) no sirve para juzgar el guion: Google devolvió timeout y 503 en la tarea B2 con los dos modelos, y el guion, las diapositivas, el tutorial y el diagrama salieron como fallidos. El sistema lo mostró sin relleno, pero tardó 119,9 s; en la aplicación eso va por SSE con heartbeats.

**Regresión encontrada y corregida (causada por el cambio anterior).** En la 2.ª corrida el modelo copió citas *con* la marca en la línea («usuario `root`: ```bash sudo chmod 600…»). `_VALLA_CODIGO` solo quitaba la marca al inicio de línea, es decir, del documento y no de la cita, así que esas citas dejaron de coincidir (el verificador viejo las aceptaba). Ahora la marca con su etiqueta se descarta en cualquier posición, igual en la cita y en el documento.

**Guion: el ejemplo del prompt se copiaba literal.** «En tu trabajo, esto se parece a…» aparecía 10 veces en el paquete de Finanzas, y el sector estaba en las 3 escenas del guion. Se quitó la frase de ejemplo de `_LIMITE_SECTOR` (ahora pide fórmulas variadas) y el guion admite el sector como mucho en UNA escena, después del hecho que ilustra.

**Verificación.**
- Comparación entre el verificador viejo y el nuevo sobre las citas únicas de las dos corridas: **0 regresiones**. 1.ª corrida: 77/92 → 84/92; 2.ª: 81/89 → 84/89.
- Las 5 rechazadas restantes no son literales: «El objetivo:» por «**Objetivo:**», «de usuario» añadido, «al 1.8 GB» y `free -h`, demasiado corta.
- Test de la valla ampliado (marca copiada en línea, casos negativos) y test del guion ajustado. Backend: 298 tests pasan.
- **Pendiente:** el efecto de la regla «una escena» solo se ve con una 3.ª corrida, idealmente cuando Google no devuelva 503.
