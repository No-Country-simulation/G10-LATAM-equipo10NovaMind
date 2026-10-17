/**
 * Muestras pregeneradas de los documentos de ejemplo: el paquete y su video se generaron una
 * vez y se sirven como archivos estáticos (frontend/public/ejemplos/), así que abrirlas no
 * gasta cuota de Gemini ni de ElevenLabs. Un documento puede tener varios escenarios: el mismo
 * texto adaptado con otro perfil, otro sector u otro modo de generación.
 *
 *   /ejemplos/indice.json                         [{ documento, escenario, etiqueta, modo, generado_el, ajustes, voz, base }]
 *   /ejemplos/<documento>/<escenario>/paquete.json   AdaptedContentPackage
 *   /ejemplos/<documento>/<escenario>/narracion.json RespuestaNarracion (rutas de audio relativas)
 *   /ejemplos/<documento>/<escenario>/escena-N.mp3
 */
import type { AdaptedContentPackage, MuestraPregenerada, RespuestaNarracion } from '../types/types';

const RAIZ = '/ejemplos/';

/** Un índice antiguo (un escenario por documento) no trae escenario, etiqueta ni modo. */
const normalizar = (m: Partial<MuestraPregenerada> & Pick<MuestraPregenerada, 'documento' | 'ajustes'>) =>
  ({
    ...m,
    escenario: m.escenario ?? 'principal',
    etiqueta: m.etiqueta ?? `${m.ajustes.perfil} · ${m.ajustes.nicho}`,
    modo: m.modo === 'clasico' ? 'clasico' : 'paralelo',
  }) as MuestraPregenerada;

/** Los escenarios disponibles por id de documento, en el orden del índice; vacío si no hay ninguno. */
export async function indiceMuestras(): Promise<Record<string, MuestraPregenerada[]>> {
  try {
    const res = await fetch(`${RAIZ}indice.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const lista = (await res.json()) as MuestraPregenerada[];
    const porDocumento: Record<string, MuestraPregenerada[]> = {};
    for (const m of lista.map(normalizar)) (porDocumento[m.documento] ??= []).push(m);
    return porDocumento;
  } catch {
    return {}; // sin índice la app funciona igual: solo no hay muestras
  }
}

/** El escenario pedido de un documento, o el primero si no se pide ninguno o no existe. */
export const escenarioDe = (
  muestras: Record<string, MuestraPregenerada[]>, documento: string, escenario?: string,
): MuestraPregenerada | undefined => {
  const lista = muestras[documento] ?? [];
  return lista.find((m) => m.escenario === escenario) ?? lista[0];
};

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
