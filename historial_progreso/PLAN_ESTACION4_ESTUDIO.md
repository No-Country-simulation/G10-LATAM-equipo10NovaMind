# Plan: Estación 4 como estudio (teleprompter, pizarra didáctica y video con voces del navegador)

Pedido del equipo (14/10). Sustituye a `PLAN_VISOR_DIRECTOR.md`, que queda dentro de este plan, en la fase 3.

**Objetivo:**
1. Al entrar en la Estación 4 se ven el **teleprompter** y la **pizarra didáctica** de `origin/feature/newmind-edtech-oci`, con su estilo CSS y con «Profundizar concepto» y «Enriquecer con IA».
2. El teleprompter lee con **las voces del navegador**, y el usuario elige el acento entre las que tenga su equipo.
3. Un **botón flotante llamativo** genera el «video» de diapositivas narradas de esta rama. La voz del navegador va primero; si falla, ElevenLabs, y después Gemini, que ya es el respaldo de ElevenLabs en el servidor.
4. Cuando el video está listo, se abre **solo** en modo cine y empieza a reproducirse.
5. Al empezar el video, **la voz del teleprompter se apaga**.

## Lo que hay hoy (comprobado en el código)

| Pieza | Otra rama (`newmind-edtech-oci`) | Esta rama |
|---|---|---|
| Voz | Solo `speechSynthesis` del navegador, escena a escena, con velocidad de 1×, 1,25× o 1,5× | Video: ElevenLabs, luego Gemini y, como último recurso, el navegador (`utils/vozNavegador.ts`, con la misma cascada latina) |
| «Profundizar concepto» y «Enriquecer con IA» | Llaman a Gemini **desde el navegador** con `VITE_GEMINI_API_KEY`, que es pública | No existen |
| Pizarra o visor | Visor de cámara con «Atmósfera», «Encuadre», «Dinamismo» y «Anclaje 100 %» inventados (una lista fija por número de escena) | `SlideNarrada`, con foto con licencia, cita verificada y modo cine |
| Fotos de las diapositivas | — | Las busca `/narracion/generar`, **que también genera la voz del servidor**: hoy no hay fotos sin gastar voz |

## Reglas que este plan respeta

- **Claves solo en el backend (regla 4).** Las dos funciones de IA pasan a un endpoint del backend. Nada de `VITE_GEMINI_API_KEY`.
- **Procedencia honesta (regla 1).**
  - El guion ampliado y la descripción enriquecida se generan **solo a partir del documento**: el título de la escena, el guion y los pasajes de sus citas (`fuentes[].contexto`). Se marcan con «Ampliado por IA · no verificado».
  - Las etiquetas de la pizarra muestran datos reales (ver la fase 3).
  - El prompt original pedía «causas, implicaciones o metáforas». Se cambia por «explica solo lo que dicen estos pasajes; si no alcanzan, no inventes».
- **Solo cuota gratuita (regla 2).**
  - Cada ampliación es una llamada a Gemini y se guarda en caché por huella: la misma escena no se vuelve a pagar.
  - El video con voz del navegador **no gasta** ElevenLabs ni Gemini TTS.
- **Plazo de Cloudflare (regla 5).** El endpoint de ampliación tiene un plazo total de 30 s y no usa SSE.
- **El video sigue durando 60 s como máximo.** Un guion ampliado (120 a 180 palabras por escena) **es solo para leer en el teleprompter**. El video narra el guion corto original, que cabe en el límite de 125 palabras.

## Fases

### Fase 1 · Backend: endpoint de ampliación (unas 3 h)
- `POST /api/v1/narracion/ampliar` con `{ document_id, escena, tipo: "guion" | "visual" }`.
- **Contexto:** el backend toma la escena y los pasajes de sus citas del paquete guardado. No se fía del texto que mande el navegador.
- **Gemini del servidor:** usa `ClienteGemini`, con su clasificación de los 429 y el modelo de respaldo.
- **Caché** por huella: documento, escena, tipo y versión del prompt.
- **Respuesta:** `{ texto, origen: "ia_ampliado", modelo }`. Si no hay pasajes que lo respalden, responde «no hay material suficiente en el documento» en vez de inventar.
- **Tests** con Gemini simulado: respuesta correcta, uso de la caché, escena sin citas, 429 y plazo agotado.

### Fase 2 · Backend: video sin voz del servidor (unas 1,5 h)
- `SolicitudNarracion` acepta `voz_servidor: false`. Se ajusta el guion si se pasa de largo y se buscan las fotos, pero **no se sintetiza audio**.
- La respuesta trae las escenas con su foto y sin `audio`. Las duraciones son estimadas y se dicen como tales.
- **Tests:** sin voz no se llama a ningún sintetizador, y las fotos y el aviso de duración estimada llegan.

### Fase 3 · Frontend: teleprompter y pizarra con el CSS de la otra rama (unas 4 h)
- **El CSS de la otra rama es la base.** `Station4DirectorCut.module.css` se trae tal cual. Solo se añaden las clases nuestras que no tienen equivalente: procedencia, trazabilidad de las citas y tira de escenas. Los nombres repetidos se resuelven a favor de la otra rama.
- **Teleprompter:**
  - la estructura de la otra rama, con el icono de radio pulsante, el ecualizador, el consejo pedagógico y la velocidad de 1×, 1,25× o 1,5×;
  - «Profundizar concepto» llama a la fase 1;
  - se mantienen nuestros bloques de **procedencia** y de **trazabilidad de las citas**, que son obligatorios.
- **Selector de acento** (nuevo):
  - lista las voces en español que tenga el navegador, agrupadas por país (es-AR, es-MX, es-CO, es-CL, es-ES, es-US…), y preselecciona con la cascada de `vozNavegador.ts`;
  - el teleprompter y el video usan la voz elegida;
  - si el equipo no tiene voces en español, lo dice.
- **Pizarra didáctica:** el visor de cámara con datos reales (tabla de `PLAN_VISOR_DIRECTOR.md`):
  - ● «ESCENA N/M» late solo mientras suena la voz;
  - el reloj muestra el tramo real;
  - «16:9 · diapositivas narradas»;
  - las etiquetas son Foco (el título), Imagen (con licencia o sin foto) y Formato (`visual.tipo`);
  - la ficha muestra la duración, las citas verificadas (n de m) y las palabras.
  - «Enriquecer con IA» llama a la fase 1, y el resultado lleva la marca de IA.
  - Los datos salen de una función pura, `datosVisor()`, con tests.

### Fase 4 · Frontend: botón flotante, video y modo cine (unas 3 h)
- **Botón flotante** con el estilo de la otra rama (degradado fucsia y violeta, pulso) en la esquina de la estación: «🎬 Generar video».
  - Muestra estados: generando, listo y error.
  - Con `prefers-reduced-motion` no pulsa.
- **Orden de voces:**
  1. **Navegador.** Primero se comprueba que hay voz en español. Se piden las fotos (fase 2) y se precargan.
  2. **Si falla el navegador**, el video se pide con voz del servidor: `/narracion/generar`, que ya prueba ElevenLabs y luego Gemini. El navegador falla si no tiene `speechSynthesis`, si no hay voces en español o si la primera escena da `onerror` o no arranca en 3 s.
- **Cuando está listo:** se abre el modo cine y empieza la reproducción. El clic en el botón cuenta como gesto del usuario, que es lo que Chrome exige para el sonido. Si aun así el navegador bloquea el inicio automático, se muestra el botón de reproducir grande, sin error.
- **Una sola voz a la vez:** un controlador único de `speechSynthesis` registra quién habla, el teleprompter o el video.
  - Al empezar el video, **se cancela la voz del teleprompter** y su botón se desactiva mientras el video suena.
  - Al cerrar el modo cine, el video se pausa.
- **Reabrir:** al cerrar el modo cine, el botón flotante cambia a «▶ Ver video» y no vuelve a generar nada.

### Fase 5 · Verificación (unas 1,5 h)
- `pytest`, `npm test`, `tsc`, `eslint` en los archivos tocados y `npm run build`.
- **A mano:**
  - Chrome y Edge en Windows (Edge trae voces neuronales de muchos países, ideal para mostrar acentos), Firefox y un móvil a 400 px.
  - Con voz del navegador y forzando su fallo, para que salte al servidor.
  - Que la voz del teleprompter se apague al empezar el video.
  - Una escena sin citas: la ampliación tiene que negarse a inventar.
- **Gasto de la prueba:** unas 6 llamadas a Gemini (ampliaciones) y 0 de ElevenLabs, salvo la prueba del respaldo.

**Total estimado: un día y medio de trabajo.**

## Riesgos y límites que hay que contar al equipo

- **Los acentos dependen del equipo de quien mira, no de NuevaMente.**
  - Chrome en Windows trae pocas voces en español (Google es-ES y es-US, y las de Windows).
  - Edge trae voces neuronales de Argentina, México, Colombia, Chile, España y más.
  - **Para la demo, conviene usar Edge.**
- **La voz del navegador no es un archivo:** no se puede descargar ni guardar, y su duración es estimada, no medida.
- **ElevenLabs ya gastó su tope de 500 créditos.** Hoy el respaldo real es Gemini, salvo que se suba el tope.
- **Lo que se pierde respecto al teleprompter actual:** la palabra resaltada sincronizada y el control de PPM. En el video del modo cine se mantienen.
