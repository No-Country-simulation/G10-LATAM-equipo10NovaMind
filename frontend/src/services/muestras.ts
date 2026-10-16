/**
 * Muestras pregeneradas de los documentos de ejemplo: el paquete y su video se generaron una
 * vez y se sirven como archivos estáticos (frontend/public/ejemplos/), así que abrirlas no
 * gasta cuota de Gemini ni de ElevenLabs.
 *
 *   /ejemplos/indice.json            [{ documento, generado_el, ajustes, voz, base }]
 *   /ejemplos/<documento>/paquete.json   AdaptedContentPackage
 *   /ejemplos/<documento>/narracion.json RespuestaNarracion (rutas de audio relativas)
 *   /ejemplos/<documento>/escena-N.mp3
 */
import type { AdaptedContentPackage, MuestraPregenerada, RespuestaNarracion } from '../types/types';

const RAIZ = '/ejemplos/';

/** Las muestras disponibles por id de documento; vacío si aún no se generó ninguna. */
export async function indiceMuestras(): Promise<Record<string, MuestraPregenerada>> {
  try {
    const res = await fetch(`${RAIZ}indice.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const lista = (await res.json()) as MuestraPregenerada[];
    return Object.fromEntries(lista.map((m) => [m.documento, m]));
  } catch {
    return {}; // sin índice la app funciona igual: solo no hay muestras
  }
}

/** Paquete de la muestra, con su narración adjunta (si se pregrabó). */
export async function cargarMuestra(muestra: MuestraPregenerada): Promise<AdaptedContentPackage> {
  const res = await fetch(`${muestra.base}paquete.json`);
  if (!res.ok) throw new Error(`No se pudo abrir la muestra (HTTP ${res.status}).`);
  const paquete = (await res.json()) as AdaptedContentPackage;
  let narracion: RespuestaNarracion | null = null;
  if (muestra.voz) {
    const r = await fetch(`${muestra.base}narracion.json`);
    if (r.ok) narracion = (await r.json()) as RespuestaNarracion;
  }
  return { ...paquete, muestra: { ...muestra, narracion } };
}

/** URLs de los audios de una narración pregrabada, por número de escena. */
export const urlsDeMuestra = (muestra: MuestraPregenerada): Record<number, string> =>
  Object.fromEntries(
    (muestra.narracion?.video_job_spec.escenas ?? [])
      .filter((e) => e.audio?.ruta)
      .map((e) => [e.escena, `${muestra.base}${e.audio!.ruta}`]),
  );
