/**
 * Prompt visual de una escena del video narrado (Estación 04), para pegarlo en un generador de
 * imágenes externo elegido por el usuario. Idea del "Copiar Prompt" del storyboard de
 * origin/feature/newmind-edtech-oci (df18965). No llama a ningún modelo: se arma con lo que el
 * backend ya generó para la escena.
 *
 * Sin imports de valores a propósito: Node lo ejecuta directamente en frontend/tests.
 */
import type { DirectorScene } from '../types/types';

/** La diapositiva se dibuja en 16:9 (SlideNarrada.module.css). */
export const PROPORCION_DIAPOSITIVA = '16:9';

const limpio = (texto: string | undefined | null) => (texto ?? '').replace(/\s+/g, ' ').trim();

/** Texto listo para copiar, o '' si la escena no trae nada visual con lo que construirlo. */
export function promptVisualEscena(escena: DirectorScene): string {
  const visual = escena.visual;
  const descripcion = limpio(visual?.prompt_grafico) || limpio(escena.storyboard_visual);
  if (!descripcion) return '';

  const tema = limpio(visual?.titulo) || limpio(escena.titulo);
  const conceptos = (Array.isArray(visual?.puntos_clave) ? visual.puntos_clave : [])
    .map(limpio)
    .filter(Boolean)
    .slice(0, 4);

  return [
    tema && `Ilustración educativa sobre «${tema}».`,
    descripcion.endsWith('.') ? descripcion : `${descripcion}.`,
    conceptos.length > 0 && `Conceptos a representar visualmente: ${conceptos.join('; ')}.`,
    `Formato ${PROPORCION_DIAPOSITIVA}, composición limpia, estilo de diapositiva didáctica, sin texto escrito en la imagen.`,
  ]
    .filter(Boolean)
    .join(' ');
}
