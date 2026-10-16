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


## 14 oct 2026 · Estación 3 sin métricas ni estado de OCI inventados

**Por qué.** Al preparar la lista de despliegue se revisó `Step3OCICloud.tsx` y aparecieron varios rellenos que van contra la regla 1:
- **Paquete sin `evaluacion_calidad`:** mostraba un anclaje del **98 %** con «Zero-Hallucination Verified», claridad «Sobresaliente», 8 chunks y similitud 0,94.
- **Paquete sin `almacenamiento_oci`:** «Sincronizado», con el ETag `etag-verified-md5` y una URL genérica.
- **«Sincronizado» y «AES-256 Oracle Managed»** se mostraban siempre, aunque el backend informara `omitido` o `error`. El backend solo envía `bucket`, `objeto_id` y `status_upload`, así que la región, el ETag y la URL salían vacíos o inventados.
- **El paquete de demostración** (`mockScenarios.ts`) traía un anclaje de 1,0, un ETag y una URL de OCI ficticios, y el modelo «NovaMind Multi-Agente RAG + LangGraph», aunque nunca pasó por el auditor ni por OCI.
- **El texto del medidor** hablaba de «similitud semántica contra los chunks», cuando el modo paralelo usa un auditor que contrasta afirmaciones.

**Cambios.**
- **`Step3OCICloud.tsx`:**
  - sin datos se muestra «N/D» o «Sin auditar»; la pastilla dice «Auditada» y no «Zero-Hallucination Verified»;
  - el texto del medidor describe el método real;
  - la pastilla de OCI depende de `status_upload`: «Guardado en OCI», «Guardando…», «No se pudo guardar» o «No guardado en OCI», esta última con una nota que dice por qué;
  - el bucket, el objeto, la región y el ETag solo aparecen si OCI los devolvió.
- **`types.ts`:**
  - `status_upload` incluye `omitido`, que el backend ya enviaba;
  - `claridad_pedagogica` usa los valores del backend (`Alta`, `Media` y `Baja`);
  - los campos del modo RAG antiguo pasan a ser opcionales.
- **Paquete de demostración:** `auditoria_ejecutada: false`, sin puntuación, `status_upload: 'omitido'`, y su modelo dice «Ejemplo incluido en la app».

**Pendiente (decisión del usuario).** `frontend/src/utils/ociStorage.ts` no se importa en ningún sitio. Si `VITE_OCI_PAR_URL` estuviera definida, subiría el paquete desde el navegador con una URL pre-autenticada de escritura que queda pública, y sin ella devuelve un éxito simulado con un `mock-etag`. Conviene borrarlo; no se borró porque no se pidió.

**Verificación.** `tsc` limpio, 26 tests, `eslint` sin problemas en los archivos tocados y build correcto. No se revisó en el navegador.


## 14 oct 2026 · Visor de fuente también en la Estación 4

**Qué.** Las citas del guion de la Estación 4 (tipo `FuenteRAG`) no tenían visor: solo el texto de la cita y la página. Ahora cada cita verificada lleva un botón «Ver en el documento» que abre el mismo visor que el resto de estaciones, con el pasaje literal de su página y la cita resaltada.

**Backend.**
- `schemas.py`: nuevo `ContextoCita` y `FuenteRAG.contexto` (opcional).
- `cadena_colaborativa._normalizar_director_cut` lo rellena con `contexto_de_cita` solo si la cita es verificada. El modo paralelo usa ese mismo normalizador, así que lo cubren los dos modos. Los extractos automáticos y las citas no localizadas no llevan contexto.
- No cambia el contrato de tiempos: el fixture dorado no incluye fuentes y la narración no guarda citas.

**Front.**
- `FuenteChip` admite `etiquetaVisor` para cambiar el texto donde la página ya se muestra al lado.
- La lista de citas de la Estación 4 lo usa dentro de un contenedor alineado a la izquierda, porque la tarjeta es una columna flex y estiraba el botón.

**Verificación.**
- Hay 2 tests nuevos: la cita verificada del guion lleva el pasaje de su página y viaja en `director_cut`; la no verificada no lleva contexto. Backend: 300 tests; front: 26 tests, con `tsc`, `eslint` y el build limpios.
- **En Chrome real**, con el paquete del backend real y el modelo simulado, sin cuota:
  - el título del visor es «Documento original · pág. 1» y el resaltado es correcto;
  - el chip mide 140 px dentro de una tarjeta de 562;
  - Esc cierra el visor y el foco vuelve al chip;
  - la consola no muestra errores.

  En la primera pasada el foco no volvía, pero era el script de prueba: había cerrado la lista de citas, que viene abierta por defecto. El atajo de teclado de la Estación 4 ya ignora las teclas que se pulsan dentro de un diálogo.


## 14 oct 2026 · DATABASE.md reescrito y el disco local ya no se presenta como OCI

**Documentación.**
- `backend/docs/DATABASE.md` decía que no había base de datos relacional ni migraciones, y citaba un módulo que ya no existe (`servicios/almacenamiento_oci.py`). Se reescribió a partir del código: las 2 migraciones de Supabase, las 6 tablas con su diagrama ER, RLS y permisos, la huella de `generation_tasks`, el uso de la *publishable key* con el JWT del usuario (sin `service_role`), las rutas privadas `users/{user_id}/...` en OCI o en el disco y el caso de los invitados.
- `SECURITY.md` y `DEPLOYMENT.md` hablaban de `asyncio.Semaphore(1)`. Ahora dicen lo que hace el código: 5 generaciones a la vez, 2 cupos como máximo para invitados, 4 llamadas simultáneas a Gemini y 2 por modelo de respaldo.

**Regla 1 en la Estación 3.** Sin `OCI_KEY_FILE`, `storage/local_storage.py` guarda en el disco del servidor y responde `status_upload="completado"` con `bucket="local-mock-storage"`, así que la Estación 3 mostraba «Guardado en OCI». Ahora reconoce ese bucket y muestra «Guardado en el servidor, no en OCI», con una nota. No se tocó el contrato del backend.

**Verificación.** `tsc`, `eslint` y los 26 tests del front pasan, y el CRLF se conserva. Las cifras de concurrencia se comprobaron en `main.py` y `config.py`.

**Siguen desactualizados.** Los números de tests en `TESTING.md`, `CHANGELOG.md`, `OPERATIONS.md` y `README.md`, y el modelo del diagrama de `modulos/02_generacion_y_agentes.md`.


## 14 oct 2026 · Documentación al día con el código (CHANGELOG 2.7.0)

**Etapa.** Cierre documental de la jornada: procedencia honesta (visor de fuente en las estaciones 1 a 4, nicho acotado, verificador de citas con bloques de código, Estación 3 sin datos inventados), privacidad del correo y persistencia real. Commits: `dbe98dc`, `abd1a54`, `f9ce53b`, `0bae210`, `a24e226` y `a2a77b4`, todos subidos a `origin/feature/fullstack-nuevamente-v2`.

**Problemas encontrados en la documentación** (la escribió otro agente sin contrastarla con el código):
- `CHANGELOG.md` 2.6.0:
  - decía que hay 6 nichos, con nombres inexistentes, cuando son 11;
  - describía una «medalla de procedencia en la Estación 4» que no existe: el cambio fue el texto del `BadgeModal`;
  - presentaba la 1.ª corrida de nichos como estadística, con un «anclaje RAG» medido sin auditor.
- `modulos/05`:
  - nombraba la columna `huella_tarea`, cuando es `content_hash`, y ponía la racha en `profiles`, cuando está en `user_state`;
  - afirmaba que la caché de invitados «aísla las huellas entre sesiones», cuando es compartida a propósito;
  - decía que la `service_role` key vive en el `.env` del backend, que no la usa.
- `modulos/01`: describía la página como sacada de delimitadores `[Página N]`, cuando sale de los rangos de página de la ingesta.
- **Cifras de tests:** `TESTING.md`, `OPERATIONS.md` y el README presentaban como actuales cifras de 70 y 288 tests.

**Cambios.**
- `CHANGELOG.md`: nueva versión **2.7.0** con el trabajo del día y sus commits, y corrección de esas tres líneas de 2.6.0.
- `TESTING.md`: estado al 14/10 (300 en el backend y 26 en el front) con el comando que da la cifra al día, cobertura de la fase 23 y la prueba de nichos contada con sus límites (una corrida por nicho, el 503 de Google en Medicina y la 3.ª corrida pendiente).
- `OPERATIONS.md` y README: sin cifras fijas de tests en el texto que describe el estado actual. Los apartados históricos (fases, versiones antiguas, auditorías fechadas) se dejaron tal cual, porque registran lo que había en su momento.
- `modulos/01`, `02`, `05` y `06`: verificador real, `contexto_de_cita`, el modelo de la tarea A (`gemini-3.5-flash-lite`), las 6 tablas, la caché de invitados, el correo, `VisorFuente` y la Estación 3. **Esta carpeta está en `.gitignore`:** sus cambios quedan solo en local.

**Verificación.** Cada dato se contrastó con el código: `DIRECTIVAS_NICHO_SECTOR` (11 claves), `config.py`, `main.py` (semáforos), `registro_tareas.py`, `private_storage.py` y las migraciones. Los finales de línea son los de git (`core.autocrlf=true`).


## 14 oct 2026 · Palabras clave concretas para las fotos de la narración

**Problema.** Gemini escribía en `palabra_clave_imagen` conceptos abstractos ("cloud computing", "event streaming", "message broker"), y los bancos buscan por el sentido literal. Prueba real de hoy, sin cuota:

| Búsqueda | Wikimedia |
|---|---|
| "cloud computing" | Un rayo entre nubes |
| "event streaming", "message broker" | Nada pertinente |
| "data center", "server room", "fiber optic cables", "network switch", "laptop code" | Una foto pertinente |

**Hallazgo aparte (sin cambiar).** Openverse tarda unos 18 s en una búsqueda que no tiene en caché, y 0,5 s si la tiene. Con el plazo de 8 s de `BuscadorImagenes`, las 8 búsquedas de la prueba dieron timeout. En la práctica, casi siempre decide Wikimedia, aunque Openverse vaya primero.

**Cambios.**
- `generacion_paralela.py`: la descripción de `palabra_clave_imagen` pide un objeto o lugar **físico** que se pueda fotografiar, nunca una metáfora. Explica el motivo con el ejemplo de las nubes, da cinco ejemplos que funcionan y pide no repetir la palabra clave entre escenas. El esquema entra en la huella de la tarea B2, así que los guiones guardados en caché se regeneran la próxima vez (las tareas A y B1 no se tocan).
- `servicio_imagenes.py`: red de seguridad `_PALABRAS_AMBIGUAS` (cloud, streaming, broker, pipeline, kafka, python, java, docker, firewall…). Si la palabra clave contiene una de ellas, no se consultan los bancos y la escena queda como diapositiva sin foto, con el aviso de siempre. Se buscan palabras enteras: "cloudy" o "upstream" sí se buscan.

**Pendiente.** Comprobar con una generación real que Gemini obedece. Eso gasta cuota de la tarea B2. Se comprobará en la 3.ª corrida de nichos.

**3.ª corrida de nichos preparada (fuera del repo).**
- `prueba_nichos.py` tiene una sección 7 nueva: el guion escena a escena, con el sector de cada escena y su palabra clave.
- Una escena cuenta como «con sector» si tiene léxico del sector o una fórmula de analogía («en tu trabajo», «equivale a»…). Los léxicos de la sección 1 no se tocan, para que siga siendo comparable con las corridas anteriores.
- Validación sin cuota con los JSON de las corridas 1.ª y 2.ª:
  - Solo con el léxico, Finanzas de la 2.ª corrida contaba 1 escena con el sector. Leyendo el guion son 3 («déficit de liquidez», «línea de crédito»). Con la medida nueva salen 3.
  - Ningún nicho cumple todavía la regla de una escena.
  - En la 1.ª corrida aparecía dos veces la palabra clave «cloud server architecture», que la red nueva descarta.
- `LEEME.md` describe la 3.ª corrida.

**Verificación.** Backend: 301 tests (uno nuevo, `test_palabra_clave_ambigua_no_consulta_los_bancos`, con un transporte simulado que comprueba que no sale ninguna petición). Se conserva el CRLF de los dos archivos de `app/`.


## 14 oct 2026 · Auditoría de la 3.ª prueba de nichos

**Contexto.** Gemini ejecutó la 3.ª corrida con el commit `3b66437` (`pruebas_nichos/resultados_20261014_1402/`). Las 5 ejecuciones salieron sin errores ni respaldos, en 8 a 10 s cada una, todas con `gemini-3.5-flash-lite`.

**Lo que se confirma, leyendo los 15 guiones:**
- **Regla de una escena:** Medicina, Leyes y Finanzas llevan el sector solo en la escena 1. En la 2.ª corrida, Leyes lo tenía en 2 escenas y Finanzas en 3.
- **Medicina:** esta vez el guion sí se generó.
- **Citas verificadas:** del 95,8 % al 96,3 % en las 5 ejecuciones.
- **Exceso de léxico del sector sobre General:** +5,7 (Medicina), +4,6 (Leyes) y +6,0 (Finanzas) por mil. El ruido, medido con dos ejecuciones de General, es de 0 a 0,9.

**Lo que el informe de Gemini exageraba:**
- «Sin inventar en absoluto»: no se midió, porque el auditor de Groq está desactivado en la prueba (la auditoría sale como «fallida» en todas).
- Los cocientes «~10× sobre el ruido» y el «limpio absoluto»: con dos ejecuciones de General no tienen sentido.

**Hallazgos que el informe no recogía:**
1. **Leyes, escena 1:** «Al desplegar contratos complejos o validar grandes volúmenes de documentos normativos, la memoria puede saturarse». Atribuye al documento un uso legal que no menciona, que es justo lo que prohíbe `_LIMITE_SECTOR`. Pasó en 1 de 5 ejecuciones. No se cambia el prompt por un solo caso; queda anotado.
2. **Las palabras clave copiaban los ejemplos del prompt.** 11 de 15 eran «server room», «laptop code» o «fiber optic cables». E1, E3 y E5 repetían el mismo trío, y «fiber optic cables» ilustraba una escena sobre el swap en disco. Es el mismo patrón que la frase de ejemplo copiada en la 2.ª corrida.

**Corrección.** La descripción de `palabra_clave_imagen` ahora pide el objeto del que habla *esa* escena y pone ejemplos de otros temas («green leaf» para la fotosíntesis, «supermarket shelf» para la inflación), con la indicación de no copiarlos. Hace falta otra corrida para confirmarlo.


## 14 oct 2026 · Verificador de citas: notas pegadas a un año y saltos de página

**Problema.** Quedaban dos límites conocidos del verificador (`core/fuentes.py`), que rechazaban citas literales:
- **Nota pegada a un año:** el ENISA dice «globally in 2025295.» (año 2025 + nota 295). `_fin_de_nota` no la quitaba porque va detrás de un dígito, no de una letra.
- **Salto de página:** al revisar el texto extraído apareció que el problema era más amplio que la nota 548. pypdf conserva la cabecera de cada página («ENISA Threat Landscape 2026 / TLP:CLEAR | September 2026 / 42») y las notas al pie al final de la anterior. **Cualquier** frase partida entre dos páginas fallaba, aunque no hubiera notas en medio.

**Solución.** Solo cuando la búsqueda exacta falla, así que lo que ya se verificaba no cambia:
- **Año más nota:** se admiten 1 a 3 dígitos detrás de un año de la cita (19xx o 20xx seguido de una letra en la cita), solo si en el original van pegados al año y les sigue algo que no es letra ni dígito.
- **Salto de página** (`_tramo_entre_paginas`, que necesita `paginas`): la cita se parte en dos.
  - El principio tiene que cerrar el contenido de su página: detrás solo puede haber la llamada a nota omitida, caracteres que no son letra ni dígito, y luego el fin de página o una línea de nota (`548 https…`).
  - El resto tiene que abrir la página siguiente justo después de su cabecera. La cabecera se reconoce porque sus líneas abren al menos la mitad de las páginas, o porque es el número de página.
- `tramo_de_cita` y `ubicar_cita` reciben `paginas` como parámetro opcional, y `pagina_de_cita` y `contexto_de_cita` se lo pasan. Quienes los llaman no cambian.
- El visor de una cita que cruza de página muestra el tramo real, con la nota y la cabecera en medio.

**Medición con PDF reales** (script fuera del repo). Para cada salto de página se tomaron las 6 últimas palabras del contenido y las 6 primeras de la página siguiente, más tres casos negativos:

| PDF | Cruzan y se verifican | Saltándose una palabra | Con una palabra cambiada | Unidas a otra página |
|---|---|---|---|---|
| ENISA (101 págs.) | 99/99 | 99/99 rechazadas | 99/99 rechazadas | 99/99 rechazadas |
| Snowflake (12 págs.) | 10/10 | 10/10 | 10/10 | 10/10 |
| El caballero… (47 págs.) | 43/43 | 43/43 | 43/43 | 42/42 |

Coste: menos de 1 s por documento con todas las citas de la prueba. Los dos casos reales de la bitácora (página 56 y nota 548 en la página 74) se verifican.

**Problemas al medir:**
- La primera versión daba 88/99. La cola de la página no admitía la llamada a nota que la cita omite («EU171.»).
- Con eso corregido daba 96/99. La lista de puntuación no incluía «%» ni «+» («(16.3%) .»). Ahora admite cualquier carácter que no sea letra ni dígito.

**Verificación.** Backend: 304 tests. Hay tres nuevos en `test_contexto_documental.py`: año con nota, cita entre páginas con notas y cabecera, y salto de página que no admite saltarse ni cambiar texto. Se conserva el CRLF.


## 14 oct 2026 · Plazo propio para Openverse y módulos corregidos

**Openverse.** Una búsqueda sin caché tardaba unos 18 s (medido esta mañana), y el plazo común de 8 s la cortaba casi siempre, así que decidía Wikimedia.
- `servicio_imagenes.py`: `TIMEOUT_OPENVERSE_S = 25`, como plazo propio de esa petición. Wikimedia sigue con 8 s.
- Las fotos van en paralelo con la voz y por escenas, así que el peor caso (25 + 8 s) cabe en `PLAZO_VOZ_S` (80 s). Un test lo comprueba.
- Prueba real, sin cuota: 4 búsquedas nuevas dieron foto de Openverse en 4 a 7 s. Esta vez Openverse iba más rápido que por la mañana, así que no se reprodujo el caso de 18 s.

**Módulos (`backend/docs/modulos/`, solo en local).** Gemini los editó en esta carpeta y no en su worktree. Se corrigieron sus errores:
- **02:** las cifras de los nichos («9,3×», «14,2×» y «92–96 %, 100 % en Leyes») estaban escogidas o no tenían origen. Ahora están las de la 3.ª corrida, con sus límites: una ejecución por nicho, ruido medido con dos de General y sin auditor.
- **02:** la regla de una escena se describía como algo que hace el código. Ahora consta como instrucción del prompt, con lo observado.
- **01:** `FuenteCita` no está en `schemas.py`, sino en `types.ts`. Además, ahora se describen las dos reglas nuevas del verificador.
- **04 y 05:** los comandos de test apuntaban a `test_servicio_voz.py` y `test_almacenamiento.py`, que no existen. Ahora apuntan a `test_narracion.py` y a `test_auth.py`, `test_private_storage.py` y `test_registro_tareas.py`, que pasan.

**Incidente.** A las 14:26:04 se reescribieron a la vez esta bitácora y `PENDIENTES.md` con una versión anterior. Se perdieron la entrada del verificador y los cambios de los puntos 7 y 10 de PENDIENTES. No había nada ajeno que conservar, así que se repusieron añadiendo. El código no se vio afectado.

**Verificación.** Backend: 305 tests.


## 14 oct 2026 · ElevenLabs sin créditos: preparación de la prueba

**Contexto.** La clave de ElevenLabs está cerca de su tope de 1 000 créditos: es la ocasión de probar el fallo de verdad.

**Revisión del flujo.** Lo que ya funcionaba y tenía test:
- Si la cuenta no tiene créditos suficientes, la comprobación previa pasa a Gemini sin gastar nada.
- Si la API rechaza con `quota_exceeded`, pasa a Gemini y lo avisa.

**Huecos encontrados y corregidos:**
1. **El tope por clave no se ve antes de llamar.** `/v1/user/subscription` da el saldo de la cuenta (10 000), no el de la clave (1 000), así que la comprobación previa no lo detecta y solo llega el rechazo. Ese rechazo se clasificaba como `sin_creditos` solo si decía «quota». Ahora también si habla de créditos («credit»), en el estado o en el mensaje. **No se ha visto el texto real que devuelve la API en este caso:** la prueba manual lo confirmará.
2. **El aviso `no_autorizado` mostraba el código en crudo.** Ahora tiene un texto legible.
3. **Créditos agotados a mitad de narración:** no tenía test. Se añadieron dos, uno para una escena que falla y otro para la repetición con ritmo ágil. En los dos, Gemini narra **todas** las escenas (nunca se mezclan voces) y lo avisa. La escena que ElevenLabs ya cobró se pierde: es el coste de no mezclar voces.

**Verificación.** Backend: 311 tests (6 nuevos en `test_narracion.py`).


## 14 oct 2026 · Auditoría de la 4.ª prueba de nichos

**Contexto.** Corrida de Gemini con el commit `1a4e493` (`pruebas_nichos/resultados_20261014_1441/`). Las 5 ejecuciones salieron limpias. El informe de Gemini coincide con los datos en bruto.

**Resultados:**
- **Palabras clave:** ninguna de las 15 copia los ejemplos del prompt, ni los antiguos ni los nuevos. 12 de 15 son objetos de la escena. Las otras 3 («error screen» dos veces y «server warning») no son fotografiables. **Corrección:** `_PALABRAS_AMBIGUAS` incluye ahora error, warning y alert, así que la escena se queda sin foto en vez de mostrar una pantalla con texto.
- **Regla de una escena:** se cumple en Medicina y Leyes. Finanzas sale con 2 de 3 en la tabla, pero la escena 3 dice «sin costos adicionales», que es un hecho del documento (capa gratuita), no una analogía. Es un falso positivo de la medida, así que la regla se cumple.
- **Leyes:** el guion ya no atribuye al documento un uso legal. Las pistas de las flashcards sí usan el sector («en tus contratos de procesamiento»), lo que `_LIMITE_SECTOR` permite en las pistas.
- **Citas:** del 88 % (Leyes) al 100 %. Se revisaron las 5 citas rechazadas de Leyes y General#2, y todas son rechazos correctos: 2 con «...», 1 que une un título con un texto de otra parte, 1 demasiado corta y 1 con errata del modelo («duas»). No hay fallos del verificador.

**Verificación.** Backend: 311 tests (el test de palabras ambiguas incluye «error screen» y «server warning»).


## 14 oct 2026 · Prueba real: ElevenLabs sin créditos

**Cómo se hizo.** Con la clave de ElevenLabs cerca de su tope de 1 000 créditos, el usuario autorizó reiniciar el backend del puerto 8000. Se ejecutó `node tests/e2e_narracion.manual.ts --spec <guion guardado>`, que no gasta cuota de Gemini para generar el paquete.

**Resultado: OK.** `status=exito`, `proveedor=gemini`, 3 escenas y 50,0 s de audio. La respuesta tardó 10,8 s. El aviso decía «ElevenLabs (Alice) no estuvo disponible (Se agotaron los créditos de voz del mes…)».

**Lo que confirma el log:**
- `/v1/user/subscription` respondió 200 y la comprobación previa no bloqueó. Era lo previsto: el tope es de la clave y no aparece en el saldo de la cuenta.
- La API rechazó con 401 y el rechazo se clasificó como `sin_creditos`. La regla nueva funciona con el texto real.
- **Coste oculto:** las 3 escenas se piden a la vez. Dos recibieron 401 y **una salió bien (200), así que se cobró y se descartó**, porque Gemini narra todas las escenas para no mezclar voces. Con la clave casi agotada, eso supone perder una escena en créditos. Si se quisiera evitar, habría que pedir la primera escena sola antes de lanzar el resto, a costa de unos segundos más.
- El guion guardado era anterior a los cambios de las palabras clave. «cloud server» y «error warning code» se filtraron como ambiguas y la escena 3 («storage disk») obtuvo foto de Openverse.

**Arreglo del coste oculto** (`servicio_narracion._sintetizar`). La escena más larga se pide sola y primero, y el resto después, en paralelo. Si los créditos no alcanzan, falla esa primera y no se cobra ninguna.
- Solo se perdería algo si el saldo alcanza justo para la más larga pero no para las demás.
- Se conserva el orden de las escenas.
- Tests nuevos: sin créditos para la más larga, solo sale 1 petición; y el orden se mantiene.
- **Repetición real:** 1 sola petición a ElevenLabs (401), 0 créditos perdidos. Gemini narró las 3 escenas (49,1 s).
- **Coste del arreglo:** la respuesta pasó de 10,8 a 20,0 s. La primera escena ya no iba en paralelo, tampoco con Gemini.
- **Ajuste:** solo se hace con los proveedores que cobran cada escena (`cobra_por_escena`: ElevenLabs sí, Gemini no). Con la voz de Gemini, que usa cuota gratuita, las escenas vuelven a ir a la vez. Un test lo comprueba.

**Verificación.** Backend: 314 tests.


## 14 oct 2026 · Despliegue en OCI desde cero (commit `41d8d5c`)

**Contexto.** Las VM tenían una versión muy antigua, subida con WinSCP y no como repositorio git. El usuario decidió borrarla y empezar de cero, y ejecutó él los comandos. El runbook está en `deploy/RUNBOOK_OCI_2026-10-14.md`, que no se versiona.

**Hallazgos de la preparación:**
- **La VM 1 tenía Python 3.10** y el código necesita 3.11 o superior: `asyncio.timeout_at` en la narración, y en 3.10 `asyncio.TimeoutError` es distinto de `TimeoutError`. Se instaló Python 3.12 desde deadsnakes.
- **El script que propuso Gemini no servía:** hacía `git pull` en una carpeta que no era un repositorio, compilaba el front en una VM de 1 GB y ponía una clave de Supabase de relleno.
- «El caballero de la armadura oxidada» no está en git y se subió a mano. Los otros 4 documentos del catálogo sí están.
- El `.env` del PC usaba una ruta relativa para `OCI_KEY_FILE`, que el servicio, al arrancar en `backend/`, no encontraría. Se cambió por la absoluta y se añadieron `APP_ENV=prod` y `PERMITIR_MODO_INVITADO=true`.

**Qué se hizo:**
- **VM 1:** se apagó y borró `~/nuevamente`, se instaló Python 3.12, se clonó `feature/fullstack-nuevamente-v2` en la misma ruta, se creó un venv 3.12 con `requirements.txt`, se subieron el `.env` y la clave de OCI con WinSCP y se reutilizó la unidad de systemd existente, porque sus rutas no cambian.
- **VM 2:** el build de producción se hizo en el PC (`VITE_API_URL=https://novamind.techgk.cl`, sin `localhost`), se subió `dist/` con WinSCP y se añadió `client_max_body_size 16m` en `location /api/`.

**Comprobado desde fuera:**
- La web sirve el build nuevo (`index-BA8SFzwu.js`).
- `/health` responde a través de Cloudflare.
- El catálogo trae 5 documentos y descarga «El caballero…» y el ENISA (200).
- Una subida de 2 MB llega al backend (400 por el tipo de archivo), sin el 413 de nginx.

**Pendiente:** las comprobaciones en el navegador: generar un paquete por SSE, la caché de invitados, la narración y la RAM de la VM 1 durante una generación.


## 14 oct 2026 · Primeras pruebas en producción: diagrama, difuminado, voz y resumen

**Lo que vio el usuario en https://novamind.techgk.cl:**
- **Diagrama Mermaid gigante.** El CSS forzaba `max-width: 100% !important` sobre el ancho natural que fija Mermaid. Corregido en `3de44c4`.
- **La diapositiva seguía difuminada en pausa.** La capa del botón de reproducir llevaba `backdrop-filter: blur(2px)`. Corregido en `3de44c4`.
- **«feliz» (foto sin texto):** el aviso de que no hay nada verificable es el comportamiento correcto.
- **La narración falló.** Según el log de la VM 1, ElevenLabs se quedó sin créditos (tope de 500: una sola narración) y la voz de Gemini dio un 429 por **cuota por minuto** en sus dos intentos. Se rindió con unos 60 s de plazo libres.
- **El resumen salía debajo del diagrama**, en `RecursosApoyo`, y no junto a la síntesis.

**Cambios (sin commit):**
- **Voz de Gemini:** `ClienteGemini._interactuar` acepta `espera_max_cuota_minuto_s` y `reintentos_cuota_minuto_max`. La voz espera hasta 45 s (`ESPERA_MAX_CUOTA_MINUTO_VOZ_S`), como máximo 2 veces, porque es el último proveedor del servidor. El plazo de 80 s de la narración la sigue acotando. La generación del paquete conserva su regla (1 vez, ≤ 10 s), porque tiene modelo de respaldo. Hay 2 tests nuevos en `test_servicio_gemini.py`.
- **Resumen ejecutivo en la Estación 1:** va entre la «Síntesis Conceptual» y los «Puntos clave», con el formato «**En una frase:** …» y puntos, y con las secciones y conclusiones plegadas. `utils/resumenEnPuntos.ts` parte el texto auditado por oraciones, sin reescribirlo: no corta «p. ej.» ni «1.5 GB». Hay 3 tests nuevos. Si el paquete no tiene `resumen_ninja`, el resumen sigue en `RecursosApoyo`.

**Verificación.** Backend: 316 tests. Frontend: 29 tests, `tsc`, `eslint` en los archivos tocados y build. El build para OCI está en `deploy/frontend-dist-oci/` (`index-fLDdjBGQ.js`). El cambio del backend necesita commit, `git pull` en la VM 1 y reiniciar el servicio.


## 14 oct 2026 · Propuesta de Gemini sobre `newmind-edtech-oci` y tarjeta del archivo en la Estación 1

**Propuesta revisada.** Gemini volvió a analizar `cc5d028`, `30a0665` y `7b4616c` y propuso 4 cosas. Revisadas contra el código; el usuario decidió:
- **Subir varios archivos y la directiva multidocumento: para después de entregar el proyecto.** No basta con portar la interfaz: hoy `fuentes.py` verifica la página contra un solo documento, así que cada cita tendría que nombrar su archivo. Además hay que contar con el límite de 16 MB de nginx, la VM de 1 GB, el corte de 100 s de Cloudflare y una huella de caché con varios archivos.
- **Ejemplos concretos por sector (PCI-DSS, CyberDay, historias clínicas…): descartados.** Empujan al modelo a atribuir al documento usos que no tiene, el mismo fallo que cerró la 4.ª corrida de nichos.
- **Estilos de la zona de carga: hechos** (abajo).
- Aviso: el informe no recordaba que de `cc5d028` ya se habían sacado las directivas de nivel de detalle (entrada «nivel de detalle y prompt visual»).

**Cambios (sin commit):**
- `Step1Ingestion.tsx`: bajo la zona de carga aparece una tarjeta del archivo elegido con su nombre, una etiqueta de tipo (PDF, MD, TXT o IMG), el tamaño en KB o MB y un botón para quitarlo. Quitarlo limpia el documento, el título y la vista previa. Si se quita durante una extracción, la respuesta se descarta por turno, como ya pasaba al cambiar de archivo. El tamaño se guarda aparte (`bytesArchivo`), porque `rawFile` queda vacío mientras se extrae y con las transcripciones. La zona de carga ya no repite «Archivo: …».
- `Step1Ingestion.module.css`: al arrastrar, la zona se ve con fondo violeta y brillo (antes solo cambiaba el borde). El color de la tarjeta y de la etiqueta depende del tipo: rosa para PDF, violeta para MD, cian para TXT y ámbar para imagen. Solo usa tokens de `tokens.css`.

**Verificación.** Frontend: 29 tests, `tsc` y `eslint` sin errores en `Step1Ingestion/`, y build correcto. Falta la revisión visual en local (5173).


## 14 oct 2026 · Ojo de la contraseña, nombre NuevaMente y plan del visor de cámara

**Segunda propuesta de Gemini** (diferencias visuales con `newmind-edtech-oci`). El usuario decidió:
- **Ojo para ver la contraseña: hecho.**
- **«Olvidé mi contraseña»: descartado**, no se hará.
- **El visor de cámara de la Estación 4 se conserva:** hay que integrarlo (antes estaba descartado). El plan está en `historial_progreso/PLAN_VISOR_DIRECTOR.md`. Todos sus datos tienen que ser reales: en la rama original, «Atmósfera», «Encuadre», «Dinamismo» y «Anclaje 100 %» salían de una lista fija por número de escena, y «24 FPS · REC» describe un video que no existe.
- **El nombre del producto es NuevaMente**, no NovaMind ni NewMind.

**Ojo (`AuthModal.tsx`).** El campo de la contraseña tiene un botón para mostrarla u ocultarla, con `aria-pressed` y una etiqueta que cambia. Los campos llevan los iconos de correo y candado. El CSS (`inputWrapper`, `inputIcon`, `inputWithToggle`, `toggleVisibilityBtn`) ya estaba en el módulo, heredado de la otra rama, pero nada lo usaba.

**Nombre.** Se cambió con un script de `perl` que conserva los finales de línea (comprobado: ningún archivo cambió entre CRLF y LF). Abarca 41 archivos:
- **Lo que ve el usuario:** el `<title>` y la descripción de `index.html`, los mensajes de progreso, la Estación 1, la ventana de inicio de sesión (`invitado@nuevamente.local`, también en `auth.py`), la cabecera y el pie del PDF, el asunto y el cuerpo del correo, y el `User-Agent` que reciben Openverse y Wikimedia.
- **Lo interno:** los nombres de los loggers (`novamind.*` pasa a `nuevamente.*`, y los tests con `caplog` se ajustaron), las cabeceras de los módulos, los README, `backend/docs/`, los `.bat` y los scripts. En la documentación, el bucket `novamind-contenidos-educativos` se corrigió por el real, `nuevamente-contenidos-educativos`.
- **Sin tocar, a propósito:**
  - **Los prompts del modelo** («Eres el redactor de síntesis de NovaMind…»): forman parte de `huella_tarea`, así que cambiarlos invalidaría la caché de todos los paquetes y la demo volvería a gastar cuota. El usuario no los ve.
  - **Los identificadores internos:** `doc-novamind` y el prefijo de la carpeta temporal.
  - **Lo externo:** el dominio `novamind.techgk.cl`, las rutas de las carpetas, el nombre del repositorio y las ramas.
  - **El documento de ejemplo** `data/documents/guia_optimizacion_swap_oci.md`: es contenido fuente, y cambiarlo invalidaría su caché.
  - **El historial** (`historial_progreso/`, `legado/`).

Commit `492b3d9` (hecho por el usuario).


## 14 oct 2026 · Diseño de la ventana de inicio de sesión de `newmind-edtech-oci` y logo de la cabecera

**Logo.** La cabecera seguía mostrando «Nova» y «Mind» en dos `<span>` separados, y el script del cambio de nombre buscaba la palabra entera, así que no lo encontró. Ahora pone «Nueva» y «Mente». Busqué otras marcas partidas en `src/` e `index.html` y no hay más.

**Ventana de inicio de sesión** (diseño de `9142429`, portado a mano). Se trajo la estructura; el CSS ya estaba en el módulo. Incluye:
- el isotipo, el título y un subtítulo por vista;
- el botón de Google con su logo, el de invitado y el separador «o con correo»;
- campos con icono y etiquetas unidas a ellos con `htmlFor`;
- el campo «Nombre» al crear la cuenta, que se envía a Supabase como `full_name`, el dato del que `authUser()` ya saca el nombre;
- debajo, el enlace para cambiar entre «Regístrate aquí» e «Inicia sesión»;
- se cierra con Escape o con un clic fuera de la ventana.

**Lo que no se trajo:**
- **El usuario genérico** (`estudiante.demo@oracle-alura.edu`): la otra rama simulaba el inicio de sesión. Aquí sigue siendo el real de Supabase.
- **El aviso «Sesión de demostración… compatible con OCI Object Storage»:** es falso con la autenticación real.
- **Los subtítulos «almacenamiento OCI» y «Always Free»:** se sustituyeron por lo que de verdad hace la cuenta, que es guardar los paquetes y el progreso.
- **«Olvidé mi contraseña»:** descartado por el usuario.

**Error corregido.** `.submitBtn:hover` usaba `--color-purple-600`, que no existe en `tokens.css`, así que al pasar el ratón el degradado dejaba de pintarse. Ahora va de violeta 500 a violeta 400. También se añadió un estado deshabilitado a los botones mientras se espera la respuesta.

**Verificación.** Frontend: 29 tests, `tsc`, `eslint` en `AuthModal/` y `Header/`, y build. Falta la revisión visual.

Commit `6c7d235` (hecho por el usuario).


## 14 oct 2026 · Estación 4 como estudio: teleprompter y pizarra de `newmind-edtech-oci`, acentos y video con voz del navegador

El plan es `historial_progreso/PLAN_ESTACION4_ESTUDIO.md`, aprobado por el usuario («de última usamos lo que tenemos hoy»). Se hicieron las fases 1 a 4; de la 5, todo menos la revisión visual.

**Backend**
- **`POST /api/v1/narracion/ampliar`** (`servicios/servicio_ampliacion.py`): «Profundizar concepto» (`tipo: guion`) y «Enriquecer con IA» (`tipo: visual`). En la otra rama, las dos llamaban a Gemini desde el navegador con `VITE_GEMINI_API_KEY`.
  - **El guion se amplía solo con los pasajes literales de las citas verificadas.** Sin pasajes no se llama al modelo y se responde `sin_material`; el modelo también puede responder `suficiente=false` en vez de inventar.
  - El prompt original pedía «causas, implicaciones o metáforas» y se sustituyó por «explica únicamente lo que dicen los pasajes».
  - **La propuesta visual es creativa**, pero no puede afirmar datos técnicos.
  - **Gemini del servidor** con modelo de respaldo: el principal tiene 18 s y el respaldo 12 s, con salto directo al respaldo si el principal tiene la cuota diaria agotada. Caché en memoria por huella (256 entradas, `VERSION_AMPLIACION`). No usa `_cupo`, para no esperar detrás de una generación larga.
  - **Desviación del plan:** los pasajes los manda el navegador (de `fuentes[].contexto`), en vez de leerlos del paquete guardado, porque los invitados no tienen paquete guardado. El único que puede alterarlos es el propio usuario, y el resultado se marca siempre como IA no verificada.
- **`voz_servidor: false` en `/narracion/generar`** (`diapositivas_sin_voz`): con la voz del navegador, el servidor solo busca las fotos. No sintetiza audio, no guarda nada y no gasta ElevenLabs ni Gemini TTS. Rechaza igual un guion que no cabe en 60 s y avisa de que la duración es estimada. `buscar_fotos` pasó a ser una función del módulo, compartida con `Narrador`.
- **Tests:** 11 en `test_ampliacion.py` y 3 en `test_narracion.py`. La caché de ampliación se vacía en `conftest.py`.

**Frontend**
- **`EstudioDirector.module.css`:** el CSS de la Estación 4 de la otra rama, **sin cambios**, más una sección de añadidos con su misma paleta:
  - selector de acento, marca de IA, botón flotante y estado del video;
  - `prefers-reduced-motion` (la otra rama no lo tenía).
  - Se aplica a la cabecera, la tira de escenas, la navegación, el teleprompter y la pizarra. `Station4DirectorCut.module.css` se queda para lo exclusivo nuestro: presupuesto de 60 s, procedencia, citas y exportar el contrato.
- **`TeleprompterEstudio.tsx`:**
  - la estructura de la otra rama, con el radio pulsante, «Profundizar concepto», la velocidad de 1×, 1,25× o 1,5×, «Locutar» con la voz del navegador, el ecualizador, el guion entre comillas y el enfoque didáctico;
  - **selector de acento** con las voces en español del equipo, agrupadas por país (`vocesEnEspanol` y `regionDeVoz`);
  - el guion ampliado lleva «Ampliado por IA · no verificado» y un enlace para ver el original;
  - debajo siguen las citas del documento.
- **`PizarraDidactica.tsx`:** el visor de cámara, el storyboard, las etiquetas, la ficha técnica y los puntos clave de la otra rama. Todos los datos salen de `utils/datosVisor.ts`:
  - ● «ESCENA N/M», que solo late mientras suena una voz;
  - el tramo real y «16:9 · diapositivas narradas»;
  - las etiquetas Foco, Imagen (foto con licencia o sin foto) y Formato;
  - en la ficha, el tramo, las palabras, el tipo de diapositiva y las citas verificadas;
  - los puntos clave salen de `visual.puntos_clave`, el objetivo y el consejo.
  - Se quitaron «Anclaje RAG Verificado» y «Anclaje 100 %», que se mostraban siempre, así como «Atmósfera», «Encuadre» y «Dinamismo», que eran inventados.
- **Botón flotante «Generar video»** (`Station4DirectorCut.tsx`):
  1. pide las diapositivas y las fotos con `voz_servidor: false` y usa la voz elegida. Si las fotos fallan, el video se ve igual, con las diapositivas solas y un aviso;
  2. si el navegador no tiene voces en español, si la voz da `onerror` (salvo `interrupted` y `canceled`) o si no empieza a hablar en 3 s, salta a la voz del servidor (ElevenLabs y, si no, Gemini), con el motivo a la vista.
  - Cuando el video está listo, se abre en **Modo Cine desde la escena 1 y se reproduce solo**. Con el video ya generado, el botón pasa a ser «Ver video».
- **Una sola voz a la vez:**
  - al empezar el video (al generarlo o al pulsar reproducir) se cancela la locución del teleprompter;
  - mientras suena el video, «Locutar» está desactivado;
  - cambiar de escena, de acento o de velocidad también corta la locución;
  - cerrar el Modo Cine pausa el video.
- **`SlideNarrada`:**
  - `soloCine`: la diapositiva ya no se muestra en la página, solo en el Modo Cine;
  - **subtítulos** con la palabra que suena, que sustituyen al resaltado del teleprompter antiguo;
  - repetir al final empieza por la escena 1;
  - Espacio solo controla el video con el Modo Cine abierto.
- **Lo que se quitó del teleprompter antiguo:** la barra de progreso, el reloj, el selector de palabras por minuto, «Auto-avanzar» (el video siempre avanza solo) y «Copiar guion». La duración estimada usa el ritmo base, 150 palabras por minuto.

**Verificación**
- Backend: 330 tests (14 nuevos).
- Frontend: 33 tests (4 nuevos en `datosVisor.test.ts`), `tsc`, `eslint` en los archivos tocados y build.
- **Prueba en local sin cuota:** `/ampliar` sin pasajes responde `sin_material` sin llamar a Gemini; `/generar` con `voz_servidor: false` responde `exito`, sin audio y con la foto de Openverse, en 2,5 s.
- **Falta:** la revisión visual en el navegador (Chrome, Edge y móvil) y una ampliación real con Gemini, que gasta cuota y la hace el usuario.
- **Pendiente de limpieza:** `Station4DirectorCut.module.css` conserva clases que ya no se usan (teleprompter antiguo, palabras por minuto y especificación visual). No molestan; se pueden borrar más adelante.

**Ajustes tras la primera revisión del usuario (14/10)**
- **Botón «Generar video»:** ya no flota. Está en la cabecera de la pizarra, en el sitio de «Citas verificadas», que sigue en la ficha técnica. Conserva el degradado fucsia-violeta y el pulso (`.videoBtn`).
- **Acento:** el usuario no lo veía. Era un desplegable pequeño en el teleprompter y, si el navegador no tiene voces en español, un texto gris de 11 px. Ahora `SelectorAcento.tsx` aparece **junto al botón de video** y en el teleprompter, como píldora con icono:
  - mientras el navegador entrega sus voces, muestra «Buscando…»;
  - sin voces en español, avisa en ámbar de que el video usará la voz del servidor y recomienda Edge.
  - Además se escucha `voiceschanged`, porque Edge entrega sus voces en línea más tarde.
- **«Mi historial» y «Progreso guardado en Supabase» ya no se muestran** (`App.tsx`), por decisión del usuario. Desaparecen también los botones «Guardar ejemplo de demostración» y la lista de paquetes guardados. Al iniciar sesión se sigue abriendo el último paquete. **Los fallos de sincronización sí se muestran** (mensajes que empiezan por «Error» o «No se»), por la regla de procedencia honesta.
- Verificación: 33 tests del frontend, `tsc`, `eslint` en los archivos tocados y build.
- **«Lo que NuevaMente le pedirá a la IA»** (Estación 1) pasa a un desplegable (`<details>`), **plegado por defecto**, para quien quiera saber qué se le pide a la IA. Tiene una flecha que gira, un foco visible y sigue el estilo de la etiqueta. El usuario también aceptó perder la lista de paquetes guardados.

Commit `35b2d3f` (hecho por Gemini).


## 14 oct 2026 · Avisos de calidad ocultos (recuperables)

**Decisión del usuario:** no mostrar «N avisos sobre este material» ni la barra de cada recurso (Auditada, N/M citas localizadas, avisos de las comprobaciones). Tienen que seguir recuperables.

**Cómo:** `MOSTRAR_AVISOS_DE_CALIDAD = false` en `Step2KnowledgeQuest.tsx`. Se usó una constante y no código comentado: el código queda compilado y probado, y volver a mostrarlos es cambiarla a `true`. Los datos se siguen calculando y viajan en el paquete (`advertencias` y `estado_recursos`).

**Lo que sigue visible:**
- Cada chip de cita sigue diciendo si está verificada o no.
- Las citas de la Estación 4 conservan su estado.
- La Estación 1 marca una transcripción hecha por IA.
- Un recurso que falló se sigue sustituyendo por `RecursoNoDisponible`.

**Lo que se pierde a la vista:** el aviso de nivel de paquete sobre el modelo de respaldo y la auditoría parcial.

**Verificación:** `tsc`, `eslint` y build.


## 14 oct 2026 · Aprobación al 100 % y más elementos ocultos (recuperables)

Decisiones del usuario:
- **Las estaciones 2, 3 y 4 exigen el 100 %**, igual que la 1 (ya pedía marcar todos los conceptos) y el quiz. Antes era el 60 %. `minRequired` es el total de tarjetas, pasos o escenas, y los textos se ajustaron: «domina las N tarjetas», «valida los N pasos», «explora las N escenas».
- **«Auditada» y «Sin auditar» no se muestran.**
  - `MOSTRAR_CHIP_VERIFICACION = false` en `RecursoEstado.tsx`; afecta a `RecursosApoyo` y a la barra del recurso.
  - La píldora de `Step3OCICloud.tsx` quedó comentada. El medidor del grounding sigue mostrando «N/D» cuando no hubo auditoría.
- **«Necesito repasar»** (Estación 2) quedó comentado, con su función `handleNeedReview`: `tsc -b` no admite variables sin usar.
- **Una cita no encontrada no muestra nada:** `MOSTRAR_CITA_NO_ENCONTRADA = false` en `FuenteChip`. Las verificadas siguen mostrando «Fuente · pág. N» y abren el visor.

**Corrección de la entrada anterior:** decía que cada chip seguía indicando si la cita estaba verificada. Ya no es así: ahora solo se ven las verificadas. La lista de citas de la Estación 4, con su estado («No encontrada literalmente…»), sigue visible.

**Aviso para el equipo:** con esto, la interfaz ya no señala el contenido cuyas citas no se localizaron en el documento; simplemente no lleva fuente. Para volver a señalarlo basta con poner las constantes en `true`.

**Verificación:** 33 tests del frontend, `tsc -b` en el build, `eslint` en los archivos tocados y build.
- **Citas del documento en la Estación 4: plegadas por defecto** (`showRagDetails` empieza en `false`); se abren con «Mostrar».
- **Supabase:** el encargado de la base de datos revisó las 2 migraciones, RLS y las URL de vuelta, y respondió que todo está correcto. Queda anotado en PENDIENTES.


## 14 oct 2026 · El video no se generaba: ninguna voz disponible

**Lo que vio el usuario:** el aviso «Este navegador no tiene voces en español…», el botón en «Generando…» y, al final, «La cuota gratuita de voz está agotada por ahora».

**Causa, según el log del backend local:**
1. El navegador del usuario no tiene voces en español, así que se pasó a la voz del servidor.
2. ElevenLabs respondió 401 por falta de créditos (`sin_creditos`). **Ojo:** en el primer intento, una escena ya había respondido 200 antes del 401, así que se cobró una escena que no se usó.
3. Gemini TTS respondió 429 con `cuota_diaria`, y `gemini-3.8-flash-lite-tts` quedó marcado como agotado hasta la medianoche del Pacífico.
4. Sin voz posible, el resultado fue un error.

**Arreglo: último recurso sin voz.** Si fallan todas las voces (la del navegador, ElevenLabs y Gemini), el video se abre igualmente en el Modo Cine, sin voz, con las fotos y los subtítulos y avanzando al ritmo estimado (fase `mudo`).
- Las fotos se piden con `voz_servidor: false`, sin gasto.
- La cabecera del Modo Cine dice «· sin voz».
- La lógica de pedir solo las fotos pasó a `diapositivasConFotos()`, compartida por el video con voz del navegador y el video sin voz.

**Oculto a petición del usuario:** el recuadro de estado del video (`MOSTRAR_ESTADO_VIDEO = false`), con la voz usada, los fallos y los avisos.

**Pendiente para el usuario:** saber qué navegador usa; en Windows, Chrome y Edge traen voces en español. Para volver a tener voz del servidor, recargar créditos de ElevenLabs o esperar a que se reponga la cuota diaria de Gemini TTS.

**Verificación:** 33 tests del frontend, `tsc`, `eslint` y build.


## 14 oct 2026 · «Profundizar concepto» se negaba demasiado

**Lo que vio el usuario:** «El documento no da material suficiente para ampliar esta escena sin inventar», en una escena con 2 citas verificadas.

**Causa:** el log mostró que el modelo respondió con 18 tokens de salida, es decir, `suficiente=false`. Los pasajes son el contexto de cada cita (`contexto_de_cita`: unos pocos cientos de caracteres por lado), y el prompt exigía de 120 a 180 palabras usando solo esos pasajes. Con dos frases cortas, el modelo prefirió negarse antes que inventar.

**Arreglo** (`_AMPLIAR_GUION`, `VERSION_AMPLIACION = 2`, lo que invalida la caché):
- La longitud se adapta al material: de 60 a 180 palabras y de 1 a 3 párrafos. Una ampliación breve es preferible a negarse.
- Puede definir con palabras sencillas los términos que aparecen y relacionarlos con el guion.
- Solo se niega si los pasajes no tratan el tema de la escena.
- Se mantiene la prohibición de añadir causas, consecuencias, cifras o ejemplos que los pasajes no sostengan.

**Verificación:** 11 tests de `test_ampliacion.py`. Se reinició el backend local. La prueba real con Gemini gasta una llamada y la hace el usuario.


## 14 oct 2026 · Cuota de voz: ElevenLabs, modelos TTS de Gemini y la voz Jhenny

**ElevenLabs** (consultas de solo lectura, sin gasto):
- **La cuenta** es del plan gratuito y lleva **1.941 de 10.000 créditos** este mes. Lo agotado es el **tope de 500 que tiene la clave**, no la cuenta: basta con subirlo en el panel (Developers → API Keys).
- **Una narración gasta unos 375 créditos:** el guion tiene unos 750 caracteres y `eleven_flash_v2_5` cobra 0,5 créditos por carácter. Con 500 da para una narración y poco más. El ritmo ágil y las escenas cobradas antes de un fallo suman.
- **El historial por generación no se puede leer:** la clave no tiene el permiso `speech_history_read`.
- **Talia:** las tres voces de la biblioteca con ese nombre son inglesas, con acento estadounidense.
- **Jhenny – Soft, Calm, Sweet** (`2Lb1en5ujrODDIqmp7F3`): español latinoamericano, `free_users_allowed: true`, elegida por el usuario. **No está en «My Voices»** de la cuenta (`/v1/voices/{id}` responde `voice_not_found`), así que hay que añadirla desde la Voice Library antes de usarla por API.

**Gemini TTS** (script fuera del repositorio, con 1 petición gastada):
- **Modelos TTS visibles para la clave:** `gemini-2.5-flash-preview-tts`, `gemini-2.5-pro-preview-tts`, `gemini-3.1-flash-tts-preview`, `gemini-3.8-flash-tts` y `gemini-3.8-flash-lite-tts`.
- `gemini-3.8-flash-lite-tts` tiene un **límite de 10 peticiones al día en el plan gratuito** (lo dice el propio 429). Una narración usa al menos 3, así que da para unas 3 al día.
- `gemini-3.8-flash-tts` **está habilitado** y devolvió audio con «Hola.». Su límite no se puede consultar: solo aparece en el 429.

**Cambio: varios modelos TTS en cadena.**
- `GEMINI_TTS_FALLBACK_MODELS` (`config.py` y `.env.example`), separados por comas, por defecto `gemini-3.8-flash-tts`.
- `_voces_narracion` crea una `VozGemini` por modelo, sin repetir y en orden.
- `VozGemini.sin_presupuesto` salta sin llamar un modelo que ya agotó su cuota diaria en el proceso.
- El nombre de la voz incluye el modelo.
- Efecto secundario: la huella de la narración incluye las voces, así que las narraciones guardadas con la lista anterior no se reutilizan.

**Tests:** 2 nuevos en `test_narracion.py`, 332 en total.

**Voz elegida: Isabela en lugar de Jhenny.**
- **Isabela – Pleasant, Calm and Melodic** (`1BxAZWANeDIxeyHKSJF2`): es-AR, latinoamericana, profesional, `free_users_allowed: true`.
- Está verificada para `eleven_flash_v2_5` en español y **ya está en «My Voices»** (`/v1/voices/{id}` responde 200).
- Se añadió a `.env` local (`ELEVENLABS_VOICE_ID` y `ELEVENLABS_VOICE_NAME`) y como valor de ejemplo en `.env.example`. `config.py` sigue con Alice por defecto si faltan.
- Pendiente: subir el tope de créditos de la clave, reiniciar el backend local y ponerla también en el `.env` de la VM 1.

**Prueba y build (14/10, noche).** Se reinició el backend local con Isabela y el respaldo `3.8-flash-tts`. El usuario probó la Estación 4: todo bien. Frontend: tests, `tsc` y build de producción limpios. El build para OCI está en `deploy/frontend-dist-oci/` (`index-GQkvHiEr.js`, apunta a `https://novamind.techgk.cl`, sin `localhost`).

## 15 oct 2026 · Teleprompter con la voz del video

**Pedido:** que el teleprompter no hable con la voz del navegador. Se eligió reutilizar el audio del video en vez de pedir voz de Gemini por escena: el modelo principal de voz de Gemini da 10 peticiones al día y las comparte con el video.
- **Con el video generado y voz del servidor,** «Locutar» reproduce el audio de esa escena (`teleAudioRef`), a la velocidad elegida, y muestra «Voz del video: <voz>» en lugar del selector de acento.
- **Solo si el texto coincide:** el audio se usa si el guion de la escena del video es igual al que se ve. Con el guion ampliado por IA, o sin video, sigue la voz del navegador.
- Una sola voz a la vez: `callarTeleprompter` también pausa este audio (al cambiar de escena, al iniciar el video y al salir).

**Experiencia que se pierde al recargar (con cuenta):** revisado el código de guardado (`writeState`) y de restauración (`refresh` y `restorePackage`) sin encontrar la causa. Hace falta el mensaje o el error que ve el usuario.

**Verificación:** `tsc`, `eslint` en los 2 archivos y 33 tests del frontend. Nuevo build para OCI: `deploy/frontend-dist-oci/` (`index-BZkKFWR7.js`).

## 15 oct 2026 · Espejo de Supabase en Oracle Autonomous Database

**Pedido:** llevar la base de datos a OCI Database. **Decisión del usuario:** usar Oracle como espejo, igual que el bucket de OCI. Supabase sigue siendo la base principal (Auth, RLS, REST que usa el frontend) y la app nunca lee de Oracle. La copia se hace con una **sincronización periódica** y no desde el backend, porque el frontend escribe `learning_progress`, `user_state` y `learning_packages` directamente en Supabase y el backend no ve esas escrituras.

**Base elegida:** Autonomous Database **Always Free**, la única base gestionada de OCI sin costo (regla 2). OCI Database with PostgreSQL se paga, y montar Postgres en la VM de 1 GB no cabe.

**Qué se hizo:**
- `oracle/espejo/001_espejo_supabase.sql`: las 6 tablas de `public.*` sin claves foráneas ni CHECK, porque el espejo no debe rechazar filas. Las conversiones: `uuid` → `VARCHAR2(36)`, `jsonb` → `CLOB IS JSON`, `timestamptz` → `TIMESTAMP` en UTC y `resource` → `resource_name` (palabra reservada). Cada tabla lleva además la columna `espejado_en`. La tabla `espejo_marcas` guarda hasta dónde se copió cada tabla y el último error.
- `backend/app/espejo/` (`python -m app.espejo [--reconciliar] [--forzar-borrado] [--tabla X]`):
  - **Copia incremental** por `(updated_at, clave)` con paginación *keyset* sobre PostgREST. No usa offset, que se salta filas si cambian a mitad, ni sufre con empates de `now()` en transacciones masivas. Usa `MERGE` en Oracle, y la marca avanza en la misma transacción que las filas.
  - **Reconciliación** (diaria): borra del espejo lo eliminado en Supabase, por ejemplo una cuenta borrada. Se niega si borraría más de la mitad del espejo (y más de 10 filas), salvo con `--forzar-borrado`.
  - **Clave de servicio validada:** rechaza la publishable o anon. Con ellas RLS devuelve listas vacías sin dar error, y la reconciliación vaciaría el espejo.
  - Cada tabla es independiente: si una falla, las demás se copian y el error queda en `espejo_marcas.ultimo_error`.
  - `python-oracledb` 3.3.0 en modo *thin*: sin Oracle Client, con wallet (mTLS) o TLS. Va en `requirements.txt`.
- `.env.example`: sección 7 con `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo en el backend) y las variables `ORACLE_ESPEJO_*`.
- `deploy/systemd/` (no versionado): `nuevamente-espejo.{service,timer}` cada 15 min y `nuevamente-espejo-reconciliar.{service,timer}` a diario a las 04:30. Son procesos `oneshot` separados de la API, con `MemoryMax=150M`.

**Verificación:** 18 tests nuevos en `test_espejo_oracle.py`, 350 en total. Incluyen una guarda que compara las columnas de las migraciones de Supabase, la especificación (`tablas.py`) y el DDL de Oracle. **Sin probar contra una ADB real todavía** (el `MERGE` con CLOB y el wallet): queda para cuando exista la base.

**Pendiente (usuario):** crear la ADB Always Free y el usuario `ESPEJO`, ejecutar el DDL, descargar el wallet, poner la clave secreta de Supabase en el `.env` de VM1 y activar los timers.

## 15 oct 2026 · Prueba de Remotion Player para la Estación 04 (rama `claude/remotion-prueba`)

**Pedido:** ver cómo funciona Remotion y qué mejora en el video narrado. La descarga del video queda aparte por decisión del usuario.

**Dónde:** worktree `../NovaMind-remotion`, rama `claude/remotion-prueba`, creada desde `feature/espejo-oracle-audiovisual` (`5e38113`). La Estación 04 no se tocó: la prueba es una página aparte, `frontend/prueba-remotion.html`.

**Qué se hizo:**
- `remotion` y `@remotion/player` 4.0.530, fijados (versión del 29/09). La licencia es gratuita para personas, equipos de hasta 3 personas y organizaciones sin ánimo de lucro.
- `src/pruebaRemotion/linea.ts`: el guion (`VideoJobSpec`) pasa a fotogramas a 30 fps. Con audio, la duración es la medida, a la `velocidad_reproduccion` del backend. Sin audio, se usa la estimación de `microclassTiming`. La palabra activa usa `tiempos_palabras` (ElevenLabs) cuando existen y, si no, las mismas fronteras que la Estación 04.
- `MicroclaseVideo.tsx`: una composición con `Series` (una secuencia por escena) y el mismo contenido que `SlideNarrada`: título, puntos, cita solo si está verificada, foto con su crédito CC dentro del video y subtítulos. Las animaciones (fundido, puntos escalonados, zoom lento de la foto) se pueden desactivar para comparar.
- `PruebaRemotion.tsx`: un guion de ejemplo escrito a mano (sin citas ni fotos, para no presentar nada como del documento). Carga un `VideoJobSpec` o la respuesta de `/narracion/generar`; la de un invitado trae los audios en base64. También admite audios por escena cargados a mano.
- `vite.config.ts`: la build incluye la segunda página, para que la app principal no cargue Remotion.

**Hallazgos:**
- La voz del navegador no encaja: Remotion necesita cada duración de antemano y `speechSynthesis` no la da. Adoptarlo significa tener dos motores, o dejar la voz del navegador fuera del video.
- El paquete de la página de prueba pesa 325 kB (102 kB con gzip), React incluido.

**Verificación:** 5 tests nuevos en `tests/pruebaRemotion.test.ts`, 38 en total; `tsc` sin errores; `eslint` limpio en los archivos nuevos; `npm run build` correcto. Servidor de la prueba: `npx vite --port 5175` y abrir `/prueba-remotion.html`. **Falta la revisión visual en el navegador por parte del usuario.**

**Ajuste (mismo día, pedido del usuario):**
- **Silencios técnicos** configurables en la página: 0,3 s antes de la voz y 0,5 s después, solo en las escenas con audio. La escena se alarga y su audio entra unos fotogramas más tarde (`Sequence from`); el WAV no se toca. Si con ellos el video pasa de `max_duration`, la página lo avisa. El backend todavía no los descuenta al calcular la velocidad: habría que hacerlo si se adopta.
- **Sin subtítulos estimados:** solo se muestran con los tiempos reales por palabra de ElevenLabs. Con Gemini o sin voz no hay subtítulos.
- Verificación: 39 tests, `tsc`, `eslint` y build correctos.

## 15 oct 2026 · Estación 04 con Remotion: integración (rama `claude/remotion-prueba`)

**Decisiones del usuario:** la prueba quedó aprobada. Camino A: el video siempre usa la voz del servidor (ElevenLabs y, si no, Gemini), y la voz del navegador queda solo para el teleprompter. Primera versión con portada, cierre, transiciones, diagrama paso a paso, código animado y logo.

**Backend:**
- `schemas.py`: `SILENCIO_INICIO_S = 0.3`, `SILENCIO_FIN_S = 0.5`, `silencios_tecnicos(n)` y `duracion_disponible_voz(max, n)`. Los silencios **cuentan dentro de los 60 s**: con 3 escenas, la voz dispone de 57,6 s.
- `servicio_narracion.py`: la velocidad de reproducción, el umbral del ritmo ágil y el tope previo del guion (`exceso_guion_narracion`, con el nuevo parámetro `silencios_s`) usan esa duración disponible. Los avisos explican los silencios.
- **Decisión técnica:** la portada (2,5 s) y el cierre (4 s) quedan **fuera** del límite, como cortinillas. Si contaran, los guiones normales (110–125 palabras) quedarían al borde del máximo y forzarían regenerar la voz pagando de nuevo.
- `VERSION_NARRACION` no cambia, para no gastar cuota otra vez. Las narraciones ya guardadas conservan la velocidad antigua, y con los silencios su video puede pasar hasta 2,4 s de los 60 s.

**Frontend:**
- `Station4DirectorCut/video/lineaVideo.ts`: línea de tiempo pura (portada, escenas, cierre y transiciones de 9 fotogramas, que es lo mismo que el silencio inicial). Incluye la escena en cada fotograma, el salto a una escena, los subtítulos solo con tiempos reales (ElevenLabs) y el avance de las animaciones.
- `video/MicroclaseVideo.tsx`: la composición.
  - **Portada:** «Microclase» y el índice de escenas. No hay título del documento en la estación 4, así que no se inventa ninguno.
  - **Escenas:** foto con zoom lento y crédito CC; puntos que entran escalonados; diagrama de bloques que aparece bloque a bloque con su flecha; código (`codigo_o_estructura`) que se escribe solo; cita solo si está verificada.
  - **Cierre:** «Lo que aprendiste», con el título y el primer punto de cada escena tal como vienen en el guion.
  - **Logo:** marca de agua (`IsotipoMonocromo.svg`).
  - **Sin voz:** el guion completo de la escena, fijo y sin resaltar palabras.
  - El diagrama y el código siguen un ritmo visual, no la voz palabra a palabra.
- `video/ModoCineVideo.tsx`: Modo Cine con `<Player>`.
  - Teclas: Espacio para pausar o reanudar, flechas para cambiar de escena y Esc para cerrar.
  - El crédito de la foto, con enlaces, va debajo del Player.
  - Cada cambio de escena marca la escena como vista (`marcarVista`, con un ref), así que la medalla y la experiencia siguen funcionando.
  - Se carga con `lazy`: Remotion (unos 104 kB con gzip) solo se descarga al abrir el video.
- `Station4DirectorCut.tsx`:
  - Se quitaron el motor por fotograma, el `<audio>`, la voz del navegador en el video, el selector de acento del botón de video y la fase `navegador`.
  - La barra de presupuesto muestra el total del video, con los silencios.
  - Se borró `SlideNarrada.{tsx,module.css}`, que ya no usaba nadie. `SelectorAcento` se queda en el teleprompter.
- Se retiraron la página de prueba (`prueba-remotion.html`, `src/pruebaRemotion/`) y su entrada en `vite.config.ts`. Dependencias fijadas: `remotion`, `@remotion/player` y `@remotion/transitions` 4.0.530.

**Verificación:** backend con 351 tests (2 actualizados a la nueva disponibilidad y 1 nuevo). Frontend con 40 tests (7 nuevos en `tests/lineaVideo.test.ts`, incluido uno que compara los silencios con `schemas.py`), `tsc` sin errores, `eslint` limpio en los archivos tocados y `npm run build` correcto. **Falta la prueba visual del usuario en la app** (`http://localhost:5175`, con el backend de prueba en el 8003 solo con Gemini). **Falta también el build para OCI**: se hará cuando se apruebe y Gemini haga el commit.

## 15 oct 2026 · Estación 04 en una sola pantalla y duración real del audio (rama `claude/remotion-prueba`)

**Problema que vio el usuario:** el video duraba 1 minuto y el audio, 30 s. La línea de tiempo usa `duracion_real_s`, y el backend la sacaba de la **cabecera** del WAV de Gemini (`getnframes()`). Que el video durara exactamente el doble apunta a una cabecera que declara más datos de los que trae (habitual en un WAV escrito en flujo). **Hipótesis no confirmada**: el registro no guarda las duraciones y no se gastó cuota para comprobarlo. La corrección vale sea cual sea la causa:
- `servicio_gemini.py`: la duración sale de las muestras que trae el archivo (`readframes`), no de la cabecera. Test nuevo con una cabecera que declara el doble.
- Frontend `video/medirAudio.ts`: el navegador mide cada audio al cargarlo (`loadedmetadata`, con un plazo de 5 s) y `lineaVideo` usa esa duración antes que la del servidor. La barra de presupuesto también usa la suma medida.

**Una sola pantalla (decisiones del usuario):** la estación es el video. Se aprueba al **verlo hasta el cierre**, y saltar con la barra hasta el final también cuenta. El estudio por escena queda **plegado debajo**.
- `video/VideoMicroclase.tsx` sustituye a `ModoCineVideo` y va dentro de la página, sin portal. Arranca solo al generarse; con el foco en él, las flechas cambian de escena. Al terminar (`ended`) avisa del cierre aunque el Player no emita el último fotograma.
- `Station4DirectorCut.tsx`:
  - Cuando no hay video, se ve un recuadro 16:9 con «Generar video», o el progreso mientras se genera.
  - Debajo, `<details>` «Guion y herramientas del docente», con las pestañas, el teleprompter, la pizarra y las citas.
  - Se quitaron las escenas vistas (`viewedScenes`, `marcarVista`), el Modo Cine y los atajos globales con flechas.
  - La cabecera muestra «Microclase: Vista / Pendiente».

**Cuota de voz al día, según lo medido:**
- Gemini `3.8-flash-lite-tts`: 10 peticiones al día, una por escena; unos 3 videos de 3 escenas.
- `3.8-flash-tts`: sin medir.
- ElevenLabs: unos 375 créditos por video, sobre 10 000 al mes; unos 26 al mes. Con el tope de 500 de la clave, 1 video.
- Las pruebas del 15/10 ya gastaron 6 peticiones de `flash-lite-tts`.

**Otros de esta sesión:**
- `docs/flujo-nuevamente.svg`: animación del proceso para el README (SVG con CSS, sin scripts; respeta `prefers-reduced-motion`). No menciona Remotion porque `main` aún no lo tiene.
- Revisión del README que reescribió Gemini en su worktree: numera mal las estaciones y omite el tutorial; atribuye a Groq `llama-3.3-70b-versatile` como respaldo de la generación, aunque no existe en el código y Groq solo audita; dice «cero alucinaciones», que contradice la regla 1; pide Node 20+ cuando los tests necesitan Node ≥ 23.6. Se avisó al usuario y no se tocó su carpeta.

**Verificación:** backend con 352 tests; frontend con 41 tests, `tsc`, `eslint` en los archivos tocados y `npm run build` correctos. **Pendiente: la prueba visual del usuario** (`http://localhost:5175`, backend 8003 solo con Gemini).

## 15 oct 2026 · Pasos bloqueados sin paquete y muestras pregeneradas (rama `claude/remotion-prueba`)

**Pasos 2 y 3 bloqueados (pedido del usuario):** sin un paquete cargado, las pestañas «Visualizar Resultados RAG» y «Métricas & OCI Cloud» se ven atenuadas y no se abren. Antes mostraban el paquete de ejemplo escrito a mano como si fuera un resultado.
- `App.tsx`: estado `paqueteListo`. Se activa al abrirse el recorrido de una generación, al terminarla, al restaurar un paquete y al abrir una muestra. Se desactiva al cambiar de cuenta y vuelve al valor anterior si la generación falla.
- `Header.tsx` recibe la prop `pasosAbiertos`: botones `disabled`, con un `title` que explica cómo avanzar.

**Muestras pregeneradas (para probar sin gastar cuota).** Decisiones del usuario: voz Isabela (ElevenLabs), y al elegir un ejemplo se abre la muestra con un botón aparte para «Generar con mis ajustes».
- Archivos estáticos en `frontend/public/ejemplos/<documento>/` (`paquete.json`, `narracion.json` y `escena-N.mp3`), con un índice en `indice.json`. Los sirve la VM2 sin backend.
- `services/muestras.ts` lee el índice y la muestra. Si no hay índice, la app funciona como antes. Nuevo tipo `MuestraPregenerada` (solo frontend) en `AdaptedContentPackage.muestra`.
- `App.tsx` → `handleAbrirMuestra`: carga simulada de unos 3 s con etapas que dicen «Muestra · …» (no «Generando»). El paso 1 explica que no se llama a ningún modelo.
- Paso 1:
  - La demo abre la muestra de la guía Swap directamente.
  - Con un ejemplo que tiene muestra aparecen «Ver recorrido de muestra (sin gastar cuota)» y «Generar con mis ajustes (gasta cuota)».
- Paso 2: etiqueta «Muestra pregenerada · fecha» (procedencia, regla 1).
- Estación 4: con muestra, el video sale de los audios estáticos (sin `/narracion/generar`) y no arranca solo.
- `deploy/pregenerar_muestras.py` (no versionado, gasta cuota): hace las mismas peticiones que la app como invitado (`/adaptar/stream` y `/narracion/generar`) para los 4 documentos que existen en `data/documents`. «El caballero de la armadura oxidada» está en el catálogo pero no en `data/`. Lo que ya existe no se vuelve a pedir.
- **Pendiente:** subir el tope de créditos de la clave de ElevenLabs (unos 1500 para 4 videos; hoy 500) y ejecutar el script con un backend que tenga ElevenLabs.

**Verificación:** `tsc`, `eslint` en todos los archivos tocados y 41 tests del frontend; el script compila. **Sin probar en el navegador:** la captura con Edge sin interfaz se quedó colgada.

## 15 oct 2026 · Modo invitado solo con la biblioteca y el Quijote en lugar de «La armadura oxidada» (rama `claude/remotion-prueba`)

**Pedido del usuario:** la demo y «Generar Adaptación Pedagógica RAG» llevan a la pestaña 2. Sin sesión (o como invitado), solo se usan los documentos de la biblioteca, con sus ajustes fijos. Subir un documento y elegir los ajustes exige iniciar sesión. Se quita «El caballero de la armadura oxidada» por derechos de autor y se agregan las dos partes del Quijote como documentos aparte.

- **Quijote:** el texto completo (unos 1,1 millones de caracteres por parte; el gist que propuso el usuario es la Primera Parte entera) no cabe en `MAX_CARACTERES_DOCUMENTO` (400 000). Por eso se usan los resúmenes del argumento de Wikipedia en español: las secciones «Primera parte» y «Segunda parte» del artículo «Don Quijote de la Mancha», revisión 175822854, con licencia CC BY-SA 4.0. Quedan en `data/documents/quijote_{primera,segunda}_parte_resumen.md` (unos 15 KB cada uno), con una cabecera de atribución (fuente, revisión, autores, licencia y cambios hechos) y sin notas al pie. Ajustes: Principiante · Educación y Academia · Didáctico.
- **Catálogo:** se actualiza en `main.py` (`CATALOGO_DOCUMENTOS`), en `mockScenarios.ts` y en `deploy/pregenerar_muestras.py`. `RealDocumentPreset` gana el campo `detalle`.
- **`Step1Ingestion`:** nuevas props `sesionIniciada` y `onIniciarSesion`. El invitado (sin sesión o con el id de invitado) tiene:
  - la carga de archivos bloqueada, con un botón «Iniciar sesión», y el título en solo lectura;
  - los ajustes del documento como etiquetas fijas, sin las opciones Sorpréndeme ni Personalizado;
  - un botón «Generar» que abre la muestra pregenerada, o queda deshabilitado con su explicación si el documento aún no tiene muestra.
- **Demo:** con muestra, la abre directamente. Sin muestra, si hay sesión, carga la guía y genera con sus ajustes fijos (gasta cuota). Si no hay sesión, aparece «Demo en preparación».
- **Pendiente:**
  - Generar las muestras de los 6 documentos (unos 2250 créditos de ElevenLabs).
  - El backend sigue aceptando `guest-demo-token` en `/adaptar`. El bloqueo es solo de la interfaz y no impide gastar cuota llamando a la API directamente.
  - Los nichos de Kafka no coinciden: «Fintech» en el backend y «Finanzas y Contabilidad» en el frontend.
  - Los dos archivos nuevos de `data/documents` están en `.gitignore`: hay que añadirlos con `git add -f`.

**Verificación:** `tsc` y ESLint pasan sin errores en los archivos tocados; pasan los 41 tests del frontend y los 352 del backend; el script compila. Falta probarlo en el navegador.

## 15 oct 2026 · Muestras pregeneradas de los 6 documentos (rama `claude/remotion-prueba`)

- **Guía Swap, Kafka, ENISA y Snowflake:** paquete y video de 3 escenas con la voz Kore de Gemini TTS. El backend del puerto 8003 no tenía ElevenLabs. El primer video usó `3.8-flash-lite-tts` y los otros 3 `3.8-flash-tts`, porque el principal agotó su cuota diaria. Son audios WAV de unos 2,5 MB por muestra.
- **Quijote I y II:** primero se generó el paquete con `--sin-video`; luego, el video de 2 escenas con Isabela en ElevenLabs, en MP3 de unos 70 KB por escena y con los tiempos por palabra para los subtítulos.
- **El 402 de ElevenLabs no era falta de créditos:** la API devolvía `paid_plan_required` («Free users cannot use library voices via the API»). Isabela es una voz de la Voice Library, y en el plan gratuito solo funcionan las 21 voces prediseñadas. El usuario contrató el plan Starter (38 059 caracteres al mes) y desde entonces funciona.
- **Pendiente (el usuario decidió dejarlo por ahora):** `servicio_voz.py` muestra el 402 como «Se agotaron los créditos». Debería distinguir el código `paid_plan_required`.
- **Todos los paquetes salen con `exito_con_advertencias`**, sobre todo por citas que no coinciden literalmente con el documento. La app las muestra tal cual (regla 1).
- **Pendiente:** pasar los WAV a MP3 en la máquina local (el total es de 11 MB). Hay que añadir `frontend/public/ejemplos/` al commit.

## 15 oct 2026 · Subtítulos que se pueden ocultar y voz Athena para el Quijote

- **Subtítulos (pedido del usuario: tapaban la cita y la diapositiva):**
  - `MicroclaseVideo` recibe la prop `subtitulos`; con `false` no dibuja ni los subtítulos ni el guion fijo.
  - `VideoMicroclase` añade debajo del video un botón «CC · Subtítulos activados/ocultos» (`aria-pressed`), que también responde a la tecla C con el foco en el video.
  - La preferencia se guarda en `localStorage` (`nuevamente.video.subtitulos`), dentro de try/catch, y por defecto los subtítulos están activados.
- **Voz:** al usuario no le gustó Isabela. Los dos Quijote se regeneraron con Athena (ElevenLabs `lU5yLpewxvOqG75Vc6Jr`, «Epic, Deep, & Resonant», español latinoamericano), que es una voz de la biblioteca y funciona con el plan Starter. Se generó con `ELEVENLABS_VOICE_ID` y `ELEVENLABS_VOICE_NAME` pasados solo a ese proceso: el `.env` sigue con Isabela hasta que el usuario decida.

**Verificación:** `tsc` y ESLint pasan sin errores en `video/`; pasan los 41 tests del frontend.

## 15 oct 2026 · El video quedaba mudo desde la escena 2 (Remotion + TransitionSeries)

**Síntoma (lo informó el usuario):** la escena 1 sonaba, pero desde la escena 2 no se oía nada; los subtítulos seguían avanzando.

**Diagnóstico medido, no supuesto:** se lanzó Edge sin interfaz con depuración remota y se controló con un script de Node que habla CDP con el `WebSocket` nativo, sin dependencias nuevas. El script vive en el scratchpad de la sesión, fuera del repositorio. Elige el documento como invitado, abre la muestra, entra en la Estación 4, pulsa «Play video» y registra cada `play`, `pause`, `emptied` y `ended` de los elementos de audio. Resultado:
- El Player usa 5 etiquetas de audio compartidas (`numberOfSharedAudioTags`, 5 por defecto). En la escena 1, una de ellas recibía `escena-1.mp3` y sonaba entera.
- En la escena 2 la etiqueta se reproducía, pero se quedaba con el MP3 silencioso de relleno: nunca recibía `escena-2.mp3`, y aun así avanzaba hasta 14,70 s, la duración de esa voz.
- La causa: el `<Audio>` estaba dentro de `TransitionSeries.Sequence`. La transición vuelve a montar la escena, y la nueva instancia pierde su `src` en la etiqueta compartida.

**Corrección (`MicroclaseVideo.tsx`):**
- Las voces salen de `TransitionSeries` y pasan a `Sequence` de primer nivel en fotogramas absolutos: `from = desde + inicioVoz` y duración `frames - inicioVoz`. La escena ya no contiene audio.
- `premountFor` de 30 fotogramas: la voz se monta 1 s antes de sonar. Sin eso, la escena 2 empezaba en 0,67 s porque el audio tardaba en cargar. `premountFor` exige el layout por defecto, así que esa `Sequence` queda como una capa vacía.

**Verificación en Edge:** Quijote I (2 escenas, MP3, Athena) y Kafka (3 escenas, WAV, Gemini) suenan completas, cada una desde t=0 hasta su final (16,72 y 14,54 s; 17,00, 15,44 y 14,36 s). `tsc` y ESLint pasan sin errores, pasan los 41 tests y el build funciona.

**Voz Lia (`mI5bQZCXgtkg41Whq2sd`, «Warm, Deep, & Mystical», latinoamericana):** el usuario pidió solo la escena 1 del primer libro para compararla. Está en `deploy/voces_prueba/quijote1-escena1-Lia.mp3`, junto a la de Athena. Athena sigue siendo la voz de la muestra (el usuario pidió no borrarla).

## 15 oct 2026 · Voz de Diego para los dos Quijote

- **Voces probadas** (todas de la Voice Library de ElevenLabs, que funcionan con el plan Starter): Athena, Lia, Sofía (Argentina), Daniela, Rosa, Cristian Cornejo (Chile) y Diego. De cada una se generó solo la escena 1 del primer libro, y las pruebas quedan en `deploy/voces_prueba/`.
- **Elegida por el usuario:** Diego («Neutral & Conversacional», ElevenLabs `hLWSpwRIXvafYWP2GPET`), para el Quijote I y II. Se regeneraron las dos narraciones: 14,6 + 12,9 s y 17,5 + 14,0 s, sin avisos. Las versiones con Athena se guardaron en `deploy/voces_prueba/athena/`.
- La voz se pasó solo al backend del puerto 8004 (con `ELEVENLABS_VOICE_ID` y `ELEVENLABS_VOICE_NAME`). El `.env` sigue con Isabela como voz por defecto de la app.
- **Saludo para el equipo**, con la voz de Diego: `deploy/voces_prueba/saludo-equipo-Diego.mp3`.

## 15 oct 2026 · La demo (guía Swap) se oía en inglés

- **Síntoma (lo informó el usuario):** el video de la guía Swap se oía en inglés.
- **Causa:** el guion está en español y el estilo que se envía también lo pide («Narrador educativo en español neutro…»). Aun así, `gemini-3.8-flash-lite-tts` lo leyó en inglés. Es la única muestra hecha con ese modelo; Kafka, ENISA y Snowflake salieron con `gemini-3.8-flash-tts`.
- **Arreglo de la muestra:** se regeneró con Diego en ElevenLabs, con escenas de 14,6, 14,5 y 13,2 s en MP3. La versión con Gemini Lite se guardó en `deploy/voces_prueba/gemini-lite/guia-swap-oci/`. El paso de WAV a MP3 reduce esta muestra de unos 2,6 MB a unos 200 KB.
- **Pendiente:** `gemini-3.8-flash-lite-tts` es el modelo principal de la cadena de respaldo de Gemini TTS (`GEMINI_TTS_MODEL`). Cuando ElevenLabs falle, la generación en vivo puede volver a salir en inglés. Hay que decidir si se quita de la cadena o se deja como último respaldo.

## 15 oct 2026 · Estación 4: primero el guion y el video debajo del teleprompter

- **Pedido del usuario:** quitar «Puntos Clave Didácticos & Visuales» y poner el video debajo de «Teleprompter · Guion Docente».
- **`Station4DirectorCut.tsx`:**
  - Se quita el `<details>` «Guion y herramientas del docente»: la tira de escenas y el estudio se ven desde el principio.
  - La sección del video (con el reproductor, el botón «Generar video» y el estado) pasa a la columna izquierda del estudio, dentro de la nueva `.columnaGuion`, debajo del teleprompter.
  - Se borran del CSS `.estudioPlegable` y `.estudioResumen`, que ya no se usan.
- **`PizarraDidactica.tsx`:** se quita la lista de puntos clave y el import de `CheckCircle2`.
- **Verificación:**
  - `tsc` y ESLint pasan sin errores y pasan los 41 tests.
  - Captura en Edge sin interfaz con la muestra de la guía Swap: a la izquierda, el teleprompter y debajo el video con «CC»; a la derecha, la pizarra.
  - La captura se hace con `cdp_captura.mjs`, un script del scratchpad que no se versiona.

**Corrección del mismo día (pedido del usuario: «el video esté ubicado por debajo»):** el video no va en la columna del teleprompter, sino debajo de todo el estudio, a lo ancho y antes de «Siguiente Estación». Se quitó `.columnaGuion`. Además, `VideoMicroclase` arranca con `initialFrame = 42`: antes del primer play se ve la portada completa (título e índice) en lugar del fotograma 0 en negro. **Verificado:** `tsc` y ESLint pasan sin errores; captura en Edge con el Quijote I.

## 15 oct 2026 · El recorrido se abría a media página

- **Síntoma (lo informó el usuario):** al abrir el paso 2 desde «Generar», la página aparecía a la altura del diagrama y no al principio. El scroll de la pestaña 1 se conservaba, porque el botón está al final del formulario.
- **Corrección (`App.tsx`):** un `useLayoutEffect` con dependencias `[currentStep, activeStationIndex]` ejecuta `window.scrollTo({ top: 0, behavior: 'instant' })`. Lo mismo pasaba con «Avanzar a Estación», que también está al final.
- **Verificado en Edge (script CDP):** en el paso 1, tras bajar al botón, el scroll estaba en 867 px; al abrirse el paso 2 queda en 0 y arriba se ve «Ruta Cognitiva · Guía Técnica OCI…». Tras bajar a «Avanzar a Estación» estaba en 1971 px, y la estación 2 abre en 0. `tsc` y ESLint pasan sin errores y pasan los 41 tests.

## 15 oct 2026 · Botón destacado del video junto a las escenas

- **Pedido del usuario:** usar el hueco a la derecha de la tira de escenas para un botón llamativo que genere el video. Responde a la duda de cómo sabe el usuario que puede generarlo.
- **`Station4DirectorCut.tsx`:**
  - La tira de escenas y el botón comparten la fila `.filaEscenas`.
  - El botón cambia según el estado:
    - sin video: «Generar video narrado», en violeta y latiendo;
    - generando: «Generando video…», deshabilitado;
    - si falló: «Reintentar video»;
    - con video listo: «Ver la microclase», en cian y sin latir.
  - Al pulsarlo genera el video si falta (`handleVideo`) y baja con scroll suave hasta el reproductor (`videoRef`).
- **`EstudioDirector.module.css`:** desde 1024 px, la tira usa `repeat(auto-fit, minmax(11rem, 1fr))` en lugar de 4 columnas fijas, así que no queda una columna vacía con 2 o 3 escenas. En móvil, el botón pasa debajo, a lo ancho.
- **Verificación:**
  - `tsc` y ESLint pasan sin errores y pasan los 41 tests.
  - Capturas en Edge de los dos estados. El estado sin video se mostró interceptando `indice.json` con CDP (`Fetch.fulfillRequest`, `voz: null`), sin tocar archivos ni gastar cuota.

## 16 oct 2026 · Pantalla completa al dar play y CC junto al tiempo

- **Pedido del usuario:** que al dar play el video pase solo a pantalla completa, y que el botón de subtítulos esté junto al tiempo.
- **`VideoMicroclase.tsx`:**
  - **Pantalla completa:** en el evento `play`, si no está ya en pantalla completa, se llama a `player.requestFullscreen()`.
    - Solo se hace si hay un gesto del usuario (`navigator.userActivation.isActive`). El autoplay que sigue a «Generar» no lo tiene y el navegador lo rechazaría, así que en ese caso no se pide.
    - Va dentro de try/catch: sin permiso, el video sigue en la página.
  - **CC:** pasa a la barra del Player con `renderCustomControls`, y así también se ve en pantalla completa. Remotion lo coloca tras un separador `flex: 1`; el hueco `.huecoControles` usa `flex: 1000 1 0%` para quedarse con casi todo el espacio libre, y el botón, alineado a la izquierda, queda pegado al tiempo.
  - El botón tiene el aspecto de los controles del Player: «CC» blanco con borde, relleno cuando los subtítulos están activados. La tecla C sigue funcionando.
  - El botón de fuera del video se quitó; el crédito de la foto sigue debajo.
- **Verificación en Edge** (clic real con `Input.dispatchMouseEvent`, porque un `click()` desde JavaScript no cuenta como gesto del usuario):
  - el tiempo termina en x=296 y el CC empieza en x=309;
  - tras el clic en play, `document.fullscreenElement` existe y contiene el CC;
  - la captura en pantalla completa muestra «0:02 / 0:49 [CC]».
- `tsc` y ESLint pasan sin errores y pasan los 41 tests.

**16 oct 2026 · Texto del botón de la demo:** a pedido del usuario, «⚡ Ver demo: Guía OCI Swap (sin gastar cuota)» pasa a «Prueba rápida 😊». Lo que dejó de decir el texto (que abre la guía Swap ya generada y que no gasta cuota) va en el atributo `title` del botón. `tsc` y ESLint pasan sin errores.

## 16 oct 2026 · Paso 1 más claro para quien llega por primera vez

- **Pedido del usuario:** destacar que desde la biblioteca se cargan los documentos, porque alguien nuevo no entiende para qué sirve cada parte.
- **`Step1Ingestion.tsx`:**
  - El título técnico «Biblioteca de Documentos Reales (data/documents/)» cambia según haya sesión o no:
    - sin sesión: «Paso 1 · Elige un documento para empezar», en tamaño mayor y sin mayúsculas;
    - con sesión: «O elige un documento de ejemplo».
  - El texto de ayuda dice para qué sirve cada documento.
  - Sin sesión y sin documento elegido aparece una guía de 3 pasos: elige un documento → pulsa «Generar Adaptación Pedagógica RAG» → recorre las 5 estaciones.
  - El selector recibe la misma invitación animada que la zona de carga (borde violeta, pulso y la etiqueta «Empieza aquí»), con su variante para `prefers-reduced-motion`. Su texto inicial: «👉 Haz clic aquí y elige un documento: Don Quijote, Apache Kafka, Guía OCI…».
  - El banner dice «Presiona «Prueba rápida»» en vez de «el botón demo».
- **Verificación:** `tsc` y ESLint pasan sin errores; pasan los 41 tests. Captura en Edge como invitado.

**16 oct 2026 · La lista de la biblioteca no se leía:** al desplegarla, las opciones salían con el texto blanco sobre el fondo claro que pinta el sistema. Se agravó con el fondo violeta translúcido del selector resaltado.
- **Corrección:** `.selectInput` declara `color-scheme: dark`, y sus `option` tienen fondo `#0b0f19` y texto blanco (las deshabilitadas, en gris). El selector resaltado usa ahora un fondo opaco, `#17132b`.
- **Verificación en Edge** (estilos computados; la lista desplegable no sale en una captura sin interfaz): el selector tiene `colorScheme: dark` y fondo `rgb(23, 19, 43)`; las opciones, fondo `rgb(11, 15, 25)` y texto `rgb(255, 255, 255)`. ESLint pasa sin errores y el build funciona.

## 16 oct 2026 · Banner del paso 1: nuevo título y animación PDF → recursos

- **Pedido del usuario:** el título dice «Convierte manuales en rutas de aprendizaje» y, detrás, un PDF se convierte en los recursos.
- **Texto:** el título técnico («Ingesta de Documentación Técnica OCI & Adaptación Cognitiva») pasa a «Convierte manuales en rutas de aprendizaje». El párrafo deja de repetir el título y dice qué se recibe: resumen, tarjetas, tutorial con diagrama, video narrado y quiz, «con cada cita comprobada en el documento». Se quita «sin alucinaciones», que prometía algo que no se puede garantizar (regla 1).
- **Animación nueva (`HeroAnimacion.tsx` y `HeroAnimacion.module.css`):** un SVG con animaciones CSS, sin librerías y oculto a los lectores de pantalla (`aria-hidden`). Ciclo de 8 s:
  - una franja recorre el PDF como si lo leyera;
  - por cuatro caminos con puntos en movimiento salen, cada 0,8 s, las tarjetas Video narrado (con una barra de progreso), Diagrama, Resumen («con citas verificadas») y Quiz (con casillas);
  - las tarjetas se quedan y se desvanecen antes de reiniciar el ciclo.
- **Disposición:** en escritorio, la animación ocupa la mitad derecha, fundida por la izquierda, y el texto se queda en el 52 % izquierdo. Por debajo de 900 px queda como fondo tenue (opacidad 0,18). Con `prefers-reduced-motion` se ve quieta, con los cuatro recursos.
- **Verificación en Edge:**
  - Edge sin interfaz informa `prefers-reduced-motion: reduce`, así que primero se vio la versión quieta.
  - Con `Emulation.setEmulatedMedia` en `no-preference`, la opacidad medida de las tarjetas sigue el ciclo previsto: 0 0 0 0, luego 1 0 0 0, luego 1 1 1 0, luego 1 1 1 1, y se desvanecen en orden.
  - Hay capturas en escritorio y móvil.
  - `tsc` y ESLint pasan sin errores; pasan los 41 tests y el build funciona.

**16 oct 2026 · Banner más corto:** a pedido del usuario se quita «y guardados en OCI Object Storage Always Free» y se acorta el texto: «Resumen, tarjetas, diagrama, video y quiz a partir de tu documento, con citas comprobadas.». Se borra la clase `.highlightOci`, que quedó sin uso. `tsc` y ESLint pasan sin errores.

**16 oct 2026 · La animación del banner se veía quieta y cortada:** el equipo del usuario informa `prefers-reduced-motion: reduce` (Windows con los efectos de animación desactivados), y con esa preferencia la animación quedaba congelada.
- **Con «reducir movimiento»:** ahora los recursos aparecen y se desvanecen por turnos (`@keyframes fundido`, solo opacidad), y los caminos se encienden a la vez que su tarjeta. Siguen quietos el escáner, el flujo de puntos, las escalas y los desplazamientos.
- **Tamaño:** el SVG tiene `height: 90%` del banner y `max-width: 48%`. Antes se calculaba por el ancho, y con banners bajos se cortaba la tarjeta de arriba.
- **Verificado en Edge con `reduce` emulado:** la opacidad medida cada segundo sigue el ciclo (0 0 0 0, luego 1 1 0 0, luego 1 1 1 1, y se desvanecen en orden). A 1200 px el SVG ocupa de 130 a 426 px dentro del banner (113–443 px), así que entra completo. El build funciona.

**16 oct 2026 · Título del banner:** a pedido del usuario pasa a «Convierte documentos en rutas de aprendizaje» (antes decía «manuales»).

**16 oct 2026 · Banner de la prueba rápida:** a pedido del usuario queda solo el título «¿Quieres probar la plataforma en 1 solo clic?», más grande (de 1,1 a 1,4 rem, con un icono de 22 px), junto al botón «Prueba rápida 😊». Se borran el párrafo explicativo y la clase `.demoBannerDesc`. Qué abre el botón y que no gasta cuota sigue en su `title`. `tsc` y ESLint pasan sin errores.

**16 oct 2026 · Título de la sección de inicio:** a pedido del usuario, encima del paso 1 de la biblioteca aparece «Aquí empieza tu ruta de aprendizaje» (`h2.tituloRuta`, 1,4 rem, la misma tipografía que el título de la prueba rápida). `tsc` y ESLint pasan sin errores.

**16 oct 2026 · Ejemplo o documento propio:** a pedido del usuario, el título del selector pasa a «Elige un documento de ejemplo…», con el mismo estilo con o sin sesión. Antes de «Carga de archivo» se añade el separador «o carga tu propio documento» (`.separadorCarga`: texto centrado con una línea a cada lado). `tsc` y ESLint pasan sin errores; hay captura en Edge.

**16 oct 2026 · «o carga tu propio documento», fuera del cuadro:** a pedido del usuario deja de ser un separador dentro del formulario. Ahora es un título entre la lista desplegable y el cuadro, con el mismo formato que «Elige un documento de ejemplo…» (`scenariosLabel` + `scenariosLabelPaso` y un icono de nube de subida). `.tituloCarga` compensa el espacio de 2 rem del formulario para que el título quede a 0,75 rem de su cuadro. Se borró `.separadorCarga`. `tsc` y ESLint pasan sin errores; hay captura en Edge.

**16 oct 2026 · Sin campo de título en el paso 1:** a pedido del usuario se borra «Título del documento técnico». El título se sigue enviando: sale del catálogo (ejemplo elegido) o del nombre del archivo (subido), con «Documento sin título» si quedara vacío. La etiqueta de la vista previa pasa a «Previsualización del Documento». Se borran los estilos `.textInput`, que quedaron sin uso. `tsc` y ESLint pasan sin errores; pasan los 41 tests.

## 16 oct 2026 · Ajustes del paso 1: título, Personalizado por defecto y Sorpréndeme animado

- **Pedido del usuario:**
  - el título «Antes de empezar 👀 selecciona tu perfil»;
  - Personalizado abierto por defecto;
  - una pequeña animación en Sorpréndeme.
- **`Step1Ingestion.tsx`:**
  - El estado `modo` empieza en `'personalizado'`. Perfil, sector y nivel arrancan en Principiante · General · Didáctico, en vez de sorteados. `sortear()` se sigue ejecutando al elegir Sorpréndeme.
  - El título `h3.tituloPerfil` aparece encima de las dos opciones solo con sesión iniciada, porque el invitado no elige. Se queda con el separador superior que antes tenía `.modoSelector`.
- **Animación de Sorpréndeme (CSS):**
  - el icono de destellos titila (`titilar`: escala y giro leves);
  - un brillo amarillo cruza la tarjeta cada 3,2 s (`.modoSorpresa::after`, `brillo`);
  - con `prefers-reduced-motion`, sin giros ni brillo: el icono solo late en opacidad (`latir`).
- **Verificación:** `tsc` y ESLint pasan sin errores; pasan los 41 tests y el build funciona. **Sin captura:** el bloque solo se ve con una sesión real (no con el modo invitado).

**16 oct 2026 · Orden de las opciones:** a pedido del usuario, Personalizado (la opción por defecto) pasa a la izquierda y Sorpréndeme a la derecha. Sorpréndeme muestra solo su título y la descripción «Sorteamos perfil, sector y nivel por ti» queda en el `title` del botón. `tsc` y ESLint pasan sin errores.

**16 oct 2026 · Descripción de Sorpréndeme:** a pedido del usuario, bajo el título dice «Perfil al azar». `tsc` y ESLint pasan sin errores.

## 16 oct 2026 · Junto a «Generar»: una hoja que se convierte en recursos

- **Pedido del usuario:** quitar el texto «Salida estructurada compatible con OCI Object Storage» y poner en su lugar una animación de una hoja que se convierte en los recursos pedagógicos.
- **Componente nuevo (`MiniAnimacionRecursos.tsx` y `MiniAnimacionRecursos.module.css`):** SVG de 280×48, con animaciones CSS y oculto a los lectores de pantalla (`aria-hidden`).
  - Una hoja que late y una flecha punteada que avanza.
  - Los cuatro recursos (video, diagrama, resumen y quiz, con los colores del banner) aparecen cada 0,5 s con un pequeño rebote y se desvanecen juntos; ciclo de 6 s.
  - Con `prefers-reduced-motion`: la hoja y el flujo quedan quietos, y los recursos aparecen y se van solo con un fundido.
  - Se borró `.storageNote`.
- **Verificación en Edge:** la opacidad medida cada 0,7 s sigue el ciclo en los dos modos (0 0 0 0, luego 1 0 0 0, luego 1 1 1 0, luego 1 1 1 1). Hay captura con la barra del botón. `tsc` y ESLint pasan sin errores y el build funciona.

**16 oct 2026 · Botón principal del paso 1:** a pedido del usuario, «Generar Adaptación Pedagógica RAG» pasa a «Iniciar Aprendizaje», tanto en el botón del invitado como en el de quien tiene sesión, y en el paso 2 de la guía («Pulsa «Iniciar Aprendizaje»»). Los scripts CDP del scratchpad que buscaban el texto anterior quedan desactualizados; no se versionan.

**16 oct 2026 · Sin «Continuar como invitado (Modo Demo)»:** a pedido del usuario se borra ese botón de la ventana de inicio de sesión, con sus estilos `.guestButton`. Para usar la app sin cuenta basta con cerrar la ventana: el modo sin sesión (biblioteca, muestras y prueba rápida) sigue igual. En `App.tsx` queda la comprobación del id de invitado (`00000000-…`): ya nadie la activa, pero no estorba. `tsc` y ESLint pasan sin errores.

**16 oct 2026 · Etiqueta de la muestra sin fecha:** a pedido del usuario, la etiqueta del paso 2 dice solo «Muestra pregenerada», sin «· 15/10/2026». La etiqueta se mantiene porque avisa de la procedencia (regla 1). La fecha y la voz siguen en su `title`, al pasar el ratón.

**16 oct 2026 · Pestaña 2:** a pedido del usuario, «Visualizar Resultados RAG» pasa a «Visualizar Resultados» (`Header.tsx`).

**16 oct 2026 · Sin la etiqueta «Muestra pregenerada» en el paso 2:** el usuario pidió quitarla del todo. Se borró de `Step2KnowledgeQuest.tsx`. La procedencia se sigue avisando en dos sitios: durante la carga, las etapas dicen «Muestra · …» y la tarjeta de proceso dice «Muestra pregenerada: no se llama a ningún modelo ni se gasta cuota»; y el título del botón «Prueba rápida» dice que abre el recorrido ya generado. El paquete en sí es una salida real del pipeline, no un relleno. `tsc` y ESLint pasan sin errores.

### Desplegable «Por secciones y conclusiones» visible

El `<summary>` del resumen (RecursosApoyo) pasaba por texto plano. Ahora es un botón tipo píldora violeta con chevron que gira al abrirse, hover y foco visibles; texto «Ver por secciones y conclusiones». `tsc` y ESLint pasan.

### Nombres de las estaciones en español llano

Tarjetas del paso 2: Resumen · Tarjetas didácticas · Comandos · Contenido Audiovisual · Cuestionario (antes Resumen Ninja, Flashcard Quest, Tutorial Quest, Director Cut, The Final Trial). También se renombraron los botones «Siguiente Estación» y el aviso de bloqueo del cuestionario; los subtítulos de las tarjetas no se tocaron. Problema: `sed -i` en Git Bash pasó a LF cuatro archivos CRLF; se restauró con perl y el diff quedó en las líneas cambiadas. `tsc`, ESLint y los tests del frontend pasan.

### Subtítulos de las estaciones

Se borraron los subtítulos de las cuatro primeras tarjetas (se mantiene «Quiz Capstone RAG» en Cuestionario) y la estación 3 pasa a «Comandos (Laboratorio)». Los estados «Redactando…» y «Requiere 2 completadas» siguen usando esa línea. `tsc` y ESLint pasan.

### Etiqueta de la estación 2

«Estación 02 · Active Recall & Memorización» pasa a «Estación 02 · Memorización».

### Título de la estación 2

«Flashcard Quest Interactivo» pasa a «Tarjetas didácticas interactivas» y se borra el párrafo de debajo («Pon a prueba tu memoria activa…»). El contador de progreso sigue mostrando cuántas tarjetas faltan. `tsc` y ESLint pasan.

### Estación 2 sin «Active Recall Simulator»

Se borra la leyenda del pie de la tarjeta; queda un hueco vacío para que «Girar tarjeta» siga a la derecha. `tsc` y ESLint pasan.

### Estación 2 sin «Fidelidad Pedagógica»

Se borra también la leyenda del reverso de la tarjeta, con el mismo hueco vacío para el botón. `tsc` pasa.

### Botón «Concepto dominado»

En la estación 2, «Dominar Concepto» pasa a «Concepto dominado».

### Estación 3 reestructurada como «Guía paso a paso»

El usuario: la estación 3 no es de comandos, es una guía de cómo aprender, y debe responder «¿cuál es la meta de leer esto?». Cambios: tarjeta y botón siguiente «Guía paso a paso» (icono Target); cabecera «¿Cuál es la meta de leer esto?» con el bloque «Al terminar esta guía podrás» (los títulos de los pasos, tachados al lograrlos); cada paso muestra «Qué vas a hacer», luego el comando en terminal **solo si es un comando real** o, si es prosa (Quijote, Kafka, ENISA), un bloque «Clave del paso»; «¿Cómo sé que lo logré?» y botón «Lo logré». Nuevo `utils/pasoGuia.ts` (`esComando`, `tituloSinPaso`, que quita el «Paso N:» repetido) con `tests/pasoGuia.test.ts`. No se añadió un campo «meta» al esquema: habría que cambiar backend y prompt y regenerar las muestras (cuota). Verificación: `tsc`, ESLint, 45/45 tests; capturas headless de la Guía OCI (terminal) y del Quijote I (clave en texto).

### Estaciones 3 y 4: meta del documento, pasos según el documento, cabecera de videos y reproducción con un clic

- **Estación 3:** título «¿Cuál es la meta de leer «‹título›»?»; el bloque «Al terminar esta guía podrás» usa `objetivos_aprendizaje` del paquete (tarea B1, ya presentes en las 6 muestras) y, si faltan, los títulos de los pasos.
- **Pasos según el documento (backend):** `pasos_guia()` en `generacion_paralela.py` decide 3 a 7 pasos (tope por palabras: <500→3, <1500→4, <3000→5, <6000→6, más→7; con secciones, uno por sección dentro del tope) y se pide en las instrucciones de producción («PASOS DEL TUTORIAL: exactamente N»). El esquema admite hasta 7 y la instrucción del tutorial ahora habla de guía de aprendizaje (comando solo si el documento es técnico). Test nuevo en `test_narracion.py`. Las muestras pregeneradas siguen con 3 pasos hasta regenerarlas.
- **Estación 4:** etiqueta «Estación 04 · Videos», título «Contenido AudioVisual», sin subtítulo; se borran la barra de palabras/tiempo de la microclase y la ficha de la escena (tramo, palabras, diapositiva, citas), con su CSS y variables sin uso.
- **«Ver la microclase»** ahora reproduce el video (prop `pedidoReproducir` en `VideoMicroclase`); como hay gesto, pasa a pantalla completa. Verificado en Edge headless con clic real por CDP: fullscreen activo y audio de la escena 1 sonando.

Verificación: backend 353 tests; frontend `tsc`, ESLint de los archivos tocados, 45/45 tests y build.

### Título de la estación 5

«Examen Interactivo con Justificación RAG» pasa a «Examen final».

### Tarjeta del cuestionario sin subtítulo

Se borra «Quiz Capstone RAG» bajo «Cuestionario»; la línea sigue mostrando «Requiere 2 completadas» mientras está bloqueada.

### Cabecera de la estación 5

Etiqueta «Estación 05 · Examen final» (también en la pantalla de bloqueo, antes «The Final Trial · Examen Capstone») y título «Cuestionario».

También se borra el texto bajo el título («Cada respuesta se contrasta con el material de origen…»). `tsc` pasa.

### El cuestionario pregunta por lo que enseñaron las otras estaciones (tarea C)

Pregunta del usuario: ¿las preguntas son de temas tocados en las otras estaciones? No del todo: el cuestionario salía de B1, en paralelo con A y B2, sin ver lo que enseñaban. En la muestra de Kafka, la pregunta de publicar/almacenar/procesar y la de agregaciones de Streams no se trataban en ninguna estación.

Cambio (`generacion_paralela.py`): el cuestionario sale de B1 (`SalidaEvaluacion` sin `cuestionario`) y pasa a la **tarea C** (`SalidaCuestionario`, `_TAREA_C`, `tarea_cuestionario`), que corre después de A, B1 y B2 con el tiempo restante del presupuesto. Recibe el **temario enseñado** (`temario_ensenado`: conceptos del resumen, tarjetas, pasos de la guía y escenas del video, recortado a 6000 caracteres) y solo pregunta por esas ideas; la respuesta y la cita siguen saliendo del documento. El temario va en las instrucciones, así entra en la huella: si cambian las estaciones, el cuestionario se regenera; si se reutilizan, también se reutiliza. Si no salió ninguna estación, C no se llama (`sin_temario`) y main pasa al respaldo como antes. Coste: una llamada más a Gemini por paquete.

**Base de datos:** nueva migración `supabase/migrations/202610160001_tarea_cuestionario.sql` que amplía la restricción `generation_tasks.task` a `A, B1, B2, C, tts`. Hay que aplicarla en Supabase; sin ella, las filas de C no se registran (aviso «No se pudo registrar el estado…») pero la generación funciona. Tests: 2 nuevos (temario en las instrucciones de C; sin estaciones no se llama a C) y el de la migración lee la última restricción; backend 355 pasan. Las muestras pregeneradas siguen con el cuestionario anterior hasta regenerarlas.

### Documentación al día (16/10)

Pedido del usuario: actualizar todos los .md, incluidas las directivas de Gemini, y el README general.

- **README.md:** nueva sección «Estado actual — 16 de octubre de 2026» (recorrido, estaciones, generación A/B1/B2 → C, voz, migraciones y enlaces); cifras de pruebas a 355 backend y 45 frontend. Las secciones históricas se conservan.
- **backend/docs:** ARCHITECTURE (paso 1, estaciones, diagrama con C, tarea C, `pasos_guia`, migración), API (tarea C, Estación 4), DATABASE (migración 3) y CHANGELOG (versión 2.8.0).
- **frontend/README.md:** paso 1 con y sin sesión, estaciones y tabla de componentes con los nombres nuevos.
- **historial_progreso:** PENDIENTES (bloque «Al retomar · 16/10», ramas) y README (fase 22).
- **Directivas locales (no versionadas):** CLAUDE.md (carpeta principal y este worktree: tarea C, video Remotion, worktree `NovaMind-remotion`, rama real de Gemini) y GEMINI.md y AGENTS.md (carpeta principal y `NovaMind-gemini`: rama `feature/espejo-oracle-audiovisual`, carpetas y puertos de Claude, cómo hacer el commit del trabajo de Claude). No se tocaron los .md versionados del worktree de Gemini, que tiene cambios propios sin commit en otra rama.

Mensaje de commit propuesto para todo el trabajo del worktree: `feat(estaciones,generacion): recorrido en español llano, guia paso a paso con meta, video con Remotion, cuestionario con el temario de las estaciones (tarea C) y documentacion al dia`.

README: añadida la tabla de los tres modos de generación (`paralelo`, `vectorless`, `clasico`) y el relevo paralelo → cadena → clásico, a partir de la revisión de Gemini (decía que el README principal no nombraba el modo paralelo). Comprobado en el código: el frontend envía `paralelo` por defecto (`VITE_MODO_RAG`) y el formulario de la API tiene `vectorless` como valor por defecto.

### Revisión de bugs del worktree (16/10)

Revisados los cambios sin commit (backend: tarea C, pasos, silencios del video, catálogo; frontend: paso 1, estaciones, video Remotion, muestras). Corregido: (1) `esComando` tomaba por comando frases con `**`, `->` o `=`, regla nueva de frase capitalizada y test; (2) nombres viejos en `ETAPAS_MUESTRA`, `NOMBRES_RECURSO` y `NOMBRE_RECURSO`; (3) la demo sin conexión decía «Generando…». Revisado sin hallazgos: espejo de silencios Python/TS, tipos de `tarea` (string), plazo del SSE (300 s) frente al presupuesto paralelo (240 s, C incluida), reproducción por `pedidoReproducir`, huella y reutilización de C. Para decidir: `acknowledgeRemotionLicense` (la licencia gratuita de Remotion cubre a particulares y empresas de hasta 3 personas), 7,9 MB de muestras (los WAV) y `docs/flujo-nuevamente.svg`, sin seguimiento y de origen desconocido. Verificación: backend 355, frontend 46, `tsc` y build.

### Muestras en MP3 y diagrama del README (16/10)

Decisiones del usuario: la licencia gratuita de Remotion sirve; pasar las muestras a MP3; el SVG `docs/flujo-nuevamente.svg` era para el README de GitHub.

- **MP3:** las 9 voces WAV de Kafka, ENISA y Snowflake (Gemini TTS, Kore) se codificaron a MP3 de 48 kbps con `lameenc` en local (el ffmpeg de chocolatey está roto: su acceso directo apunta a un ejecutable que no existe). `narracion.json` apunta a los `.mp3` con `audio/mpeg`. `frontend/public/ejemplos` pasa de 7,9 MB a 1,8 MB. Los WAV originales se movieron a `deploy/voces_prueba/wav-gemini/`. Comprobado en Edge headless: el video de Kafka reproduce `escena-1.mp3` en pantalla completa.
- **SVG:** actualizado (tarea C en la generación, estaciones Resumen, Tarjetas, Guía, AudioVisual y Cuestionario, video con Remotion) y validado como XML; se ve completo en Edge. Insertado en `README.md` bajo la cabecera.

HISTORIAL_PROBLEMAS_Y_SOLUCIONES.md: añadidos los problemas 56 a 70 de los días 15 y 16/10 (diagnóstico, causa y solución), con los pendientes del 57 y el 58 marcados; tabla de totales actualizada y nota de ampliación.
