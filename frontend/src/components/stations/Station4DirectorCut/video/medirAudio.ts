/** Si un audio no informa su duración en este tiempo, se usa la del servidor. */
const ESPERA_METADATOS_MS = 5000;

/** Duración real (s) de un audio según el propio navegador; null si no la informa. */
const duracionDe = (url: string) =>
  new Promise<number | null>((resolve) => {
    const audio = new Audio();
    const terminar = (valor: number | null) => {
      window.clearTimeout(espera);
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute('src');
      resolve(valor);
    };
    const espera = window.setTimeout(() => terminar(null), ESPERA_METADATOS_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      terminar(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => terminar(null);
    audio.src = url;
  });

/**
 * Duración de cada audio del video, medida al cargarlo: es lo que de verdad va a sonar.
 * La del servidor viene de la cabecera del archivo y puede no coincidir.
 */
export const duracionesDeAudio = async (urls: Record<number, string>): Promise<Record<number, number>> => {
  const pares = await Promise.all(
    Object.entries(urls).map(async ([escena, url]) => [Number(escena), await duracionDe(url)] as const),
  );
  return Object.fromEntries(pares.filter((p): p is readonly [number, number] => p[1] !== null));
};
