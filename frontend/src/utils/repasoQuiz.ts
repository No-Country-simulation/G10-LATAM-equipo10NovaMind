/**
 * Repaso guiado del quiz (Estación 05): convierte los fallos guardados en `QuizState.failedOptions`
 * en una lista de puntos para releer. Todo sale de la propia pregunta y de su cita localizada en el
 * documento: no se llama a ningún modelo ni se inventan referencias.
 */
import type { FuenteCita, QuizQuestion } from '../types/types';

export interface Descartada {
  opcion: string;
  /** Por qué es incorrecta, si el backend la generó (modo paralelo). */
  explicacion?: string;
}

export interface PuntoRepaso {
  /** Posición de la pregunta en el quiz (0-indexed). */
  indice: number;
  pregunta: string;
  fallos: number;
  descartadas: Descartada[];
  respuesta: string;
  justificacion: string;
  cita: string;
  fuente?: FuenteCita;
}

/** Preguntas con algún fallo, primero las más falladas y, a igualdad, en el orden del quiz. */
export function puntosDeRepaso(
  preguntas: QuizQuestion[],
  fallos: Record<number, number[]> | undefined,
): PuntoRepaso[] {
  const puntos: PuntoRepaso[] = [];
  for (const [clave, opciones] of Object.entries(fallos ?? {})) {
    const indice = Number(clave);
    const q = preguntas[indice];
    if (!q || !Array.isArray(opciones)) continue;
    const validas = [...new Set(opciones)].filter(
      (i) => Number.isInteger(i) && i >= 0 && i < q.opciones.length && i !== q.respuesta_correcta,
    );
    if (validas.length === 0) continue;
    puntos.push({
      indice,
      pregunta: q.pregunta,
      fallos: validas.length,
      descartadas: validas.map((i) => ({ opcion: q.opciones[i], explicacion: q.explicaciones_opciones?.[i] || undefined })),
      respuesta: q.opciones[q.respuesta_correcta] ?? '',
      justificacion: q.justificacion_rag,
      cita: q.cita_fuente,
      fuente: q.fuente,
    });
  }
  return puntos.sort((a, b) => b.fallos - a.fallos || a.indice - b.indice);
}
