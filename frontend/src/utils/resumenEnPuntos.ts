/**
 * Resumen ejecutivo como «una frase + puntos clave»: la primera oración es la síntesis y las
 * demás, puntos. No reescribe nada: es el mismo texto auditado, solo partido por oraciones.
 * Solo se corta tras . ! ? seguido de espacio y mayúscula, así que "p. ej. el" o "1.5 GB" no se parten.
 */
const FIN_DE_ORACION = /(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"«(])/u;

export interface ResumenEnPuntos {
  frase: string;
  puntos: string[];
}

export const resumenEnPuntos = (texto: string): ResumenEnPuntos => {
  const oraciones = texto.trim().split(FIN_DE_ORACION).map((o) => o.trim()).filter(Boolean);
  return { frase: oraciones[0] ?? '', puntos: oraciones.slice(1) };
};
