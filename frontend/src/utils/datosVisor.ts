/**
 * Datos del visor de cámara de la pizarra didáctica (Estación 04). La estética viene de
 * origin/feature/newmind-edtech-oci, donde "Atmósfera", "Encuadre", "Dinamismo" y "Anclaje 100 %"
 * salían de una lista fija por número de escena. Aquí cada etiqueta sale de la escena real; si
 * falta el dato se muestra "—", nunca un relleno.
 *
 * Sin imports de valores salvo microclassTiming: Node lo ejecuta directamente en frontend/tests.
 */
import type { DirectorScene, EspecificacionVisual } from '../types/types';
import { splitWords } from './microclassTiming.ts';

export const ETIQUETA_VISUAL: Record<EspecificacionVisual['tipo'], string> = {
  diagrama_bloques: 'Diagrama de bloques',
  ppt_concepto: 'Concepto',
  palabras_clave: 'Palabras clave',
  comparativa: 'Comparativa',
};

export const SIN_DATO = '—';

export interface DatosVisor {
  /** "ESCENA 1/3" */
  escena: string;
  /** Tramo de la escena dentro del video, "00:00 - 00:18" */
  tramo: string;
  /** Lo que de verdad es el video: diapositivas que dibuja el navegador */
  formatoVideo: string;
  foco: string;
  /** Tipo de diapositiva (concepto, diagrama…) */
  formato: string;
  /** Foto con licencia, o la diapositiva sola */
  imagen: string;
  /** "2 de 3", o "—" si la escena no tiene citas */
  citas: string;
  palabras: number;
  /** Puntos de la escena: los de la diapositiva, el objetivo y el consejo, tal como vienen */
  puntos: string[];
}

const texto = (valor: string | null | undefined) => (valor ?? '').trim();

export function datosVisor(escena: DirectorScene, indice: number, total: number, tramo: string): DatosVisor {
  const fuentes = Array.isArray(escena.fuentes) ? escena.fuentes : [];
  const verificadas = fuentes.filter((f) => f.verificada).length;
  const foto = escena.imagen?.tipo === 'foto' && escena.imagen.url ? escena.imagen : null;
  const puntosDiapositiva = (Array.isArray(escena.visual?.puntos_clave) ? escena.visual.puntos_clave : [])
    .map(texto)
    .filter(Boolean);
  const puntos = [
    ...puntosDiapositiva,
    texto(escena.objetivo_pedagogico) && `Objetivo: ${texto(escena.objetivo_pedagogico)}`,
    texto(escena.consejo_pedagogico) && `Enfoque didáctico: ${texto(escena.consejo_pedagogico)}`,
  ].filter(Boolean);

  return {
    escena: `ESCENA ${indice + 1}/${total}`,
    tramo: texto(tramo) || SIN_DATO,
    formatoVideo: '16:9 · diapositivas narradas',
    foco: texto(escena.titulo) || SIN_DATO,
    formato: escena.visual ? (ETIQUETA_VISUAL[escena.visual.tipo] ?? SIN_DATO) : SIN_DATO,
    imagen: foto ? `Foto ${texto(foto.licencia) || 'con licencia'}` : 'Sin foto: diapositiva',
    citas: fuentes.length > 0 ? `${verificadas} de ${fuentes.length}` : SIN_DATO,
    palabras: splitWords(escena.guion_locutor ?? '').length,
    puntos,
  };
}
