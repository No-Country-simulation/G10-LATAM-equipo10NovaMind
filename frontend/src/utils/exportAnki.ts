/**
 * Mazo de Anki en CSV a partir de las tarjetas del paquete.
 *
 * Las líneas que empiezan con «#» son la cabecera que Anki (2.1.55 o posterior) lee al importar:
 * separador, HTML, columnas, mazo y etiquetas. Así no se crea una tarjeta con los títulos.
 * La cita va al dorso con su estado real: verificada en el documento o no.
 */
import type { FlashcardItem, FuenteCita } from '../types/types';

const escaparHtml = (texto: string): string =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const campoCsv = (texto: string): string => `"${texto.replace(/"/g, '""')}"`;

/** Una sola línea, sin «::» (Anki lo lee como submazo). */
const limpiarLinea = (texto: string): string =>
  texto.replace(/::/g, ':').replace(/\s+/g, ' ').trim();

/** Etiqueta de Anki: sin espacios ni tildes. */
export const etiquetaDocumento = (titulo: string): string =>
  titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'documento';

const lineaFuente = (fuente: FuenteCita): string => {
  const cita = `«${escaparHtml(limpiarLinea(fuente.texto))}»`;
  if (!fuente.verificada) return `Cita no verificada en el documento: ${cita}`;
  return fuente.pagina ? `Fuente: ${cita}, p. ${fuente.pagina}` : `Fuente: ${cita}`;
};

export const dorsoAnki = (tarjeta: FlashcardItem): string => {
  const partes = [escaparHtml(tarjeta.dorso)];
  if (tarjeta.pista_didactica?.trim()) partes.push(`<em>Pista: ${escaparHtml(tarjeta.pista_didactica)}</em>`);
  if (tarjeta.fuente?.texto?.trim()) partes.push(`<small>${lineaFuente(tarjeta.fuente)}</small>`);
  return partes.join('<br><br>');
};

export const mazoAnkiCsv = (tarjetas: FlashcardItem[], titulo: string): string => {
  const nombre = limpiarLinea(titulo) || 'Documento';
  const cabecera = [
    '#separator:Comma',
    '#html:true',
    '#columns:Frente,Dorso',
    `#deck:NuevaMente::${nombre}`,
    `#tags:nuevamente ${etiquetaDocumento(nombre)}`,
  ];
  const filas = tarjetas.map((t) => `${campoCsv(escaparHtml(t.frente))},${campoCsv(dorsoAnki(t))}`);
  return [...cabecera, ...filas].join('\n') + '\n';
};

export const nombreArchivoAnki = (titulo: string): string => `anki-${etiquetaDocumento(titulo)}.csv`;
