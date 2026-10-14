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

/**
 * Unión explícita de \s (JS) y str.isspace() (Python): por sí solos difieren en
 * U+001C-U+001F, U+0085 y U+FEFF. Espejo literal de _SEPARADORES_PALABRA en schemas.py.
 */
const WORD_SEPARATORS =
  // eslint-disable-next-line no-control-regex -- U+001C-U+001F son separadores en Python y deben serlo aquí
  /[\t\n\v\f\r \x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;

/** Palabras reales del guion. Nunca se usa `estimacion_palabras` del LLM. */
export const splitWords = (text: string | null | undefined): string[] =>
  (text ?? '').split(WORD_SEPARATORS).filter(Boolean);

export const countWords = (text: string | null | undefined): number => splitWords(text).length;

/**
 * Índice (en el orden de splitWords) de la palabra que contiene `charIndex`, o de la
 * siguiente si cae en un separador. Traduce los eventos `boundary` de la voz del navegador.
 */
export const wordIndexAtChar = (text: string, charIndex: number): number => {
  const separators = new RegExp(WORD_SEPARATORS.source, 'g');
  let index = 0;
  let wordStart = 0;
  for (let m = separators.exec(text); m !== null; m = separators.exec(text)) {
    if (m.index > wordStart) {
      if (charIndex < m.index) return index;
      index += 1;
    }
    wordStart = m.index + m[0].length;
  }
  return index;
};

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

/**
 * Segundos que se escuchan de un audio que dura `seconds` reproducido a `rate`
 * (VideoJobSpec.velocidad_reproduccion: 1 salvo que la voz medida pase un poco de 60 s).
 */
export const playbackSeconds = (seconds: number, rate: number = 1): number => roundTenth(seconds / rate);

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
