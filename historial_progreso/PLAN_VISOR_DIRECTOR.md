# Plan: visor de cámara en la Estación 4

Decisión del usuario (14/10): se conserva la estética de «estudio de director» de `origin/feature/newmind-edtech-oci` (`Station4DirectorCut.tsx`, líneas 472-720 de esa rama). Se porta a mano, porque las ramas no comparten historia, y **sobre el reproductor actual** (`SlideNarrada`), sin sustituirlo.

## Regla que manda: cada dato del visor tiene que ser verdad

En la rama original, varios elementos del visor eran inventados:
- «Atmósfera», «Encuadre», «Etapa narrativa» y «Dinamismo» salían de una lista fija por número de escena (`framingPresets`), no del documento ni del modelo.
- «Anclaje 100 %» se mostraba siempre.
- «24 FPS» describe un video que no existe: son diapositivas que dibuja el navegador.

Se conserva el aspecto y cada etiqueta lleva un dato real:

| Original | Se queda así | Origen del dato |
|---|---|---|
| Esquinas de encuadre | Igual (decorativas, `aria-hidden`) | — |
| Cuadrícula de tercios | Se ve al pasar el ratón o en pausa, y se activa o desactiva con un botón. Nunca tapa el texto de la diapositiva | — |
| ● REC + «TOMA 0N» | ● «ESCENA N/M». El punto late solo mientras suena la narración; en pausa queda gris. No pone «REC», porque no se graba nada | índice de la escena y `isPlaying` |
| ⏱ 00:00 - 00:15 | Tramo real de la escena en el video | `span` (`microclassTiming`) |
| 24 FPS · 16:9 | «16:9 · diapositivas narradas» | formato real de `SlideNarrada` |
| Foco | Foco: título de la escena | `scene.titulo` |
| Atmósfera | **Imagen:** «foto con licencia CC» o «sin foto». No hay atmósfera que mostrar | `scene.imagen` |
| Encuadre | **Formato:** concepto, diagrama, comparación… | `visual.tipo` → `ETIQUETA_VISUAL` |
| Ficha: duración, etapa, dinamismo, «Anclaje 100 %» | Duración, citas verificadas (n de m) y palabras del guion | `span`, `scene.fuentes[].verificada`, `contar_palabras` |
| Ecualizador animado | Se queda, ligado a la reproducción real: solo se mueve cuando suena el audio | `isPlaying` |

Se descarta de la rama original:
- **«Enriquecer con IA» y «Profundizar concepto»:** llaman a Gemini desde el navegador con `VITE_GEMINI_API_KEY`, que es pública. Ya se descartaron el 14/10.
- **El teleprompter de esa rama:** el nuestro ya tiene línea de lectura, palabra activa, PPM y avance automático.

## Fases

1. **`VisorDirector.tsx` (componente nuevo)** con su `.module.css`.
   - Envuelve a `SlideNarrada` y dibuja las esquinas, la barra superior (escena, tramo y formato) y la cuadrícula.
   - La barra superior va **fuera** del lienzo de la diapositiva, para no tapar el título a 400 px.
   - Aparece igual en la vista normal y en el modo cine.
   - Usa solo tokens de `tokens.css`.
   - Con `prefers-reduced-motion`, sin parpadeo ni ecualizador animado.
2. **Las etiquetas Foco, Imagen y Formato y la ficha técnica**, debajo de la diapositiva, en el sitio del bloque «Guion visual / Puesta en escena», que se conserva.
   - Los datos salen de una función pura, `datosVisor(scene, span)`, en `utils/`, con tests: escena sin foto, sin citas verificadas, sin `visual` y tramo vacío.
   - Si falta un dato, se muestra «—» y nunca un valor de relleno.
3. **El ecualizador** en el panel del teleprompter, ligado a `isPlaying`.
4. **Velocidad del audio** (opcional: 1x, 1,25x o 1,5x sobre `<audio>.playbackRate`). Solo si la sincronía de diapositivas y palabras sigue al tiempo del audio y no a un reloj propio. Hay que comprobarlo en `Station4DirectorCut.tsx` antes de prometerlo.

## Verificación

- `npm test` (con los tests nuevos de `datosVisor`), `tsc`, `eslint` en los archivos tocados y `npm run build`.
- A mano en local:
  - en la vista normal, en el modo cine y a 400 px;
  - con narración de voz, sin narración y con voz del navegador;
  - una escena sin foto y otra sin citas verificadas.
- No gasta cuota: usa los paquetes que ya están en caché.

Coste estimado: medio día, las fases 1 a 3. La fase 4, aparte.
