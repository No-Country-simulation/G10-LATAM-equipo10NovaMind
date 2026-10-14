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
