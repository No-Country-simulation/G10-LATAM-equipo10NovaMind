/** Tipos y constantes compartidos por el teleprompter y la pizarra de la Estación 04. */

export const VELOCIDADES_LOCUCION = [1, 1.25, 1.5] as const;
export type VelocidadLocucion = (typeof VELOCIDADES_LOCUCION)[number];

/** Estado de una petición de ampliación con IA (guion o visual). */
export type EstadoAmpliacion =
  | { fase: 'inactiva' }
  | { fase: 'cargando' }
  | { fase: 'aviso'; mensaje: string };
