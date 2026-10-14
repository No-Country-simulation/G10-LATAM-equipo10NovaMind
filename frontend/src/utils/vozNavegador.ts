/**
 * Voz del navegador (Web Speech API): último recurso de la Estación 04 cuando ElevenLabs
 * y Gemini TTS fallan. Gratis y sin servidor, pero sin grabación ni duración garantizada.
 *
 * Sin imports a propósito: Node lo ejecuta directamente en frontend/tests.
 */

/** Lo mínimo de SpeechSynthesisVoice que hace falta para elegir (permite probar sin navegador). */
export interface VozDisponible {
  name: string;
  lang: string;
}

/** Español latinoamericano primero; idea de origin/feature/newmind-edtech-oci (7c21e99). */
export const LOCALES_PREFERIDOS = ['es-AR', 'es-419', 'es-MX', 'es-CO', 'es-CL', 'es-US'] as const;

// Algunos sistemas informan 'es_MX' en lugar de 'es-MX'
const normalizar = (lang: string) => lang.replace('_', '-').toLowerCase();

/** Primera voz de la cascada de regiones; si no hay ninguna, cualquier voz en español. */
export const elegirVozNavegador = <T extends VozDisponible>(voces: readonly T[]): T | undefined => {
  for (const locale of LOCALES_PREFERIDOS) {
    const voz = voces.find((v) => normalizar(v.lang) === locale.toLowerCase());
    if (voz) return voz;
  }
  return voces.find((v) => normalizar(v.lang).startsWith('es'));
};

/**
 * Voces del navegador. Chrome las entrega vacías hasta que dispara `voiceschanged`;
 * se espera ese evento como mucho `esperaMs`.
 */
export const cargarVocesNavegador = (esperaMs = 1500): Promise<SpeechSynthesisVoice[]> => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const ahora = synth.getVoices();
  if (ahora.length > 0) return Promise.resolve(ahora);
  return new Promise((resolve) => {
    const listo = () => {
      window.clearTimeout(limite);
      synth.removeEventListener('voiceschanged', listo);
      resolve(synth.getVoices());
    };
    const limite = window.setTimeout(listo, esperaMs);
    synth.addEventListener('voiceschanged', listo);
  });
};
