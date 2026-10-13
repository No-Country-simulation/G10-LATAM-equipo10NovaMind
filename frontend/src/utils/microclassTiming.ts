/**
 * Modelo de tiempo único de locución para la Estación 04.
 *
 * Espejo exacto de backend/app/core/schemas.py (contar_palabras, duracion_locucion,
 * formatear_tramo). Ambos lados se validan contra contracts/fixtures/director_cut_golden.json:
 * no cambies una fórmula aquí sin regenerar el fixture y correr pytest + npm test.
 *
 * Sin imports a propósito: Node lo ejecuta directamente en frontend/tests.
 */

export const WORDS_PER_SECOND = 2.3;
export const BASE_WPM = 138; // 2.3 palabras/s * 60
export const MIN_SCENE_SECONDS = 5;
export const MAX_MICROCLASS_SECONDS = 60;
export const TARGET_WORDS_MIN = 110;
export const TARGET_WORDS_MAX = 125;

/** Palabras reales del guion. Nunca se usa `estimacion_palabras` del LLM. */
export const splitWords = (text: string | null | undefined): string[] =>
  (text ?? '').trim().split(/\s+/).filter(Boolean);

export const countWords = (text: string | null | undefined): number => splitWords(text).length;

/** Redondeo half-up a 0.1 (idéntico a math.floor(x * 10 + 0.5) / 10 en Python). */
export const roundTenth = (value: number): number => Math.floor(value * 10 + 0.5) / 10;

/** Segundos de locución de una escena al ritmo indicado, con piso de 5 s. */
export const sceneSeconds = (words: number, wpm: number = BASE_WPM): number =>
  roundTenth(Math.max(MIN_SCENE_SECONDS, words / (wpm / 60)));

const pad2 = (n: number) => String(n).padStart(2, '0');
const mmss = (seconds: number) => {
  const whole = Math.trunc(seconds);
  return `${pad2(Math.trunc(whole / 60))}:${pad2(whole % 60)}`;
};

/** Tramo 'MM:SS - MM:SS' truncando a segundos enteros. */
export const formatSpan = (start: number, end: number): string => `${mmss(start)} - ${mmss(end)}`;

export interface SceneTiming {
  words: number;
  seconds: number;
  span: string;
}

export interface MicroclassTiming {
  scenes: SceneTiming[];
  totalWords: number;
  totalSeconds: number;
}

/** Tiempos de toda la microclase al wpm dado: lo mismo que calcula VideoJobSpec en el backend. */
export const microclassTiming = (scripts: ReadonlyArray<string | null | undefined>, wpm: number): MicroclassTiming => {
  let elapsed = 0;
  const scenes = scripts.map((script) => {
    const words = countWords(script);
    const seconds = sceneSeconds(words, wpm);
    const span = formatSpan(elapsed, elapsed + seconds);
    elapsed += seconds;
    return { words, seconds, span };
  });
  return {
    scenes,
    totalWords: scenes.reduce((acc, s) => acc + s.words, 0),
    totalSeconds: roundTenth(elapsed),
  };
};
