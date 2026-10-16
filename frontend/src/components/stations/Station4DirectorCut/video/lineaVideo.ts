/**
 * Línea de tiempo del video narrado (Remotion): portada, escenas y cierre en fotogramas.
 * Sin React ni Remotion, para probarla con `node --test`.
 */
import type { DirectorScene, VideoJobSpec } from '../../../../types/types.ts';
import { BASE_WPM, playbackSeconds, sceneSeconds, splitWords } from '../../../../utils/microclassTiming.ts';

export const FPS = 30;

// Silencios técnicos alrededor de la voz de cada escena. Cuentan dentro de max_duration:
// espejo de SILENCIO_INICIO_S y SILENCIO_FIN_S en backend/app/core/schemas.py.
export const SILENCIO_INICIO_S = 0.3;
export const SILENCIO_FIN_S = 0.5;

/** Portada y cierre: cortinillas fuera del límite de 60 s de la microclase. */
export const PORTADA_S = 2.5;
export const CIERRE_S = 4;

/**
 * Las transiciones solapan dos secuencias. Duran lo mismo que el silencio inicial: la voz de
 * la escena entra justo al acabar, y el silencio final de la anterior (más largo) la cubre.
 */
export const TRANSICION_FRAMES = Math.round(SILENCIO_INICIO_S * FPS);

const aFrames = (segundos: number) => Math.round(segundos * FPS);

export const silenciosTecnicos = (escenas: number) =>
  Math.round(escenas * (SILENCIO_INICIO_S + SILENCIO_FIN_S) * 10) / 10;

export interface EscenaVideo {
  scene: DirectorScene;
  palabras: string[];
  /** Segundos de voz que se escuchan (con la velocidad ya aplicada), sin los silencios */
  segundosVoz: number;
  /** Fotogramas de la escena: silencio inicial + voz + silencio final */
  frames: number;
  /** Fotograma de la escena en que entra la voz (0 si no hay voz) */
  inicioVoz: number;
  /** Fotograma del video en que empieza la escena (incluida su transición de entrada) */
  desde: number;
  audioUrl?: string;
  /** La duración es la medida del audio; si no, la estimada al ritmo base */
  medida: boolean;
}

export interface LineaVideo {
  escenas: EscenaVideo[];
  portadaFrames: number;
  cierreFrames: number;
  /** Fotograma del video en que empieza el cierre */
  desdeCierre: number;
  totalFrames: number;
  velocidad: number;
  conVoz: boolean;
}

/**
 * Con voz, la duración de cada escena es la medida a la velocidad del backend más los
 * silencios; sin voz (video mudo), la estimada al ritmo base y sin silencios. La medida por el
 * navegador (`duraciones`) manda sobre la del servidor: es la que de verdad suena.
 */
export const lineaVideo = (
  spec: VideoJobSpec,
  urls: Record<number, string> = {},
  duraciones: Record<number, number> = {},
): LineaVideo => {
  const velocidad = spec.velocidad_reproduccion ?? 1;
  const portadaFrames = aFrames(PORTADA_S);
  const cierreFrames = aFrames(CIERRE_S);
  let desde = portadaFrames - TRANSICION_FRAMES;
  const escenas = spec.escenas.map((scene) => {
    const palabras = splitWords(scene.guion_locutor);
    const audioUrl = urls[scene.escena];
    const medidaS = duraciones[scene.escena] ?? scene.audio?.duracion_real_s;
    const medida = Boolean(audioUrl && medidaS);
    const segundosVoz = medida ? playbackSeconds(medidaS!, velocidad) : sceneSeconds(palabras.length, BASE_WPM);
    const inicioVoz = medida ? aFrames(SILENCIO_INICIO_S) : 0;
    const frames = Math.max(TRANSICION_FRAMES + 1, inicioVoz + aFrames(segundosVoz) + (medida ? aFrames(SILENCIO_FIN_S) : 0));
    const escena = { scene, palabras, segundosVoz, frames, inicioVoz, desde, audioUrl: medida ? audioUrl : undefined, medida };
    desde += frames - TRANSICION_FRAMES;
    return escena;
  });
  return {
    escenas,
    portadaFrames,
    cierreFrames,
    desdeCierre: desde,
    totalFrames: desde + cierreFrames,
    velocidad,
    conVoz: escenas.some((e) => e.medida),
  };
};

/**
 * Escena que se ve en el fotograma `frame` del video: -1 en la portada, escenas.length en
 * el cierre. Durante una transición cuenta ya la escena que entra.
 */
export const escenaEnFrame = (linea: LineaVideo, frame: number): number => {
  if (frame < linea.portadaFrames - TRANSICION_FRAMES) return -1;
  if (frame >= linea.desdeCierre) return linea.escenas.length;
  for (let i = linea.escenas.length - 1; i >= 0; i--) {
    if (frame >= linea.escenas[i].desde) return i;
  }
  return 0;
};

/** Fotograma en que la escena ya está entera en pantalla (para saltar a ella). */
export const frameDeEscena = (linea: LineaVideo, indice: number): number => {
  const escena = linea.escenas[Math.max(0, Math.min(indice, linea.escenas.length - 1))];
  return escena ? escena.desde + TRANSICION_FRAMES : 0;
};

/**
 * Palabra que suena en el fotograma `frame` de la escena, solo con tiempos reales por
 * palabra (ElevenLabs). Sin ellos, -1: no hay subtítulos estimados.
 */
export const palabraEnFrame = (frame: number, escena: EscenaVideo, velocidad: number): number => {
  const tiempos = escena.scene.audio?.tiempos_palabras;
  const enVoz = frame - escena.inicioVoz;
  if (!escena.medida || enVoz <= 0 || !tiempos || tiempos.length !== escena.palabras.length) return -1;
  const audioS = (enVoz / FPS) * velocidad;
  const idx = tiempos.findIndex((fin) => audioS < fin);
  return idx === -1 ? tiempos.length : idx;
};

/**
 * Avance 0..1 de una animación que acompaña la explicación (pasos del diagrama, código que se
 * escribe): ocupa del inicio de la voz al `fraccion` de la escena. Es ritmo visual, no
 * sincronía con las palabras.
 */
export const avanceExplicacion = (frame: number, escena: EscenaVideo, fraccion: number): number => {
  const inicio = Math.max(escena.inicioVoz, TRANSICION_FRAMES);
  const fin = Math.max(inicio + 1, Math.round(escena.frames * fraccion));
  return Math.min(1, Math.max(0, (frame - inicio) / (fin - inicio)));
};
