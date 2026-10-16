/**
 * La estación 3 es una guía paso a paso. El campo `cli_command` de cada paso trae un comando real
 * en los documentos técnicos (`sudo chmod 600 /swapfile`, `UNDROP DATABASE x;`), pero en los demás
 * trae una frase (un pasaje del Quijote, una instrucción en prosa). Solo lo primero va en terminal.
 */
const SIMBOLOS_DE_COMANDO = /[|;$`{}<>=*]|--|\s-[a-zA-Z]\b|(^|\s)\.{0,2}\/\S/;
const MINIMO_PALABRAS_PROSA = 6;
// Una frase empieza con una palabra capitalizada («Los», «Revisar»); un comando, en minúscula
// (`sudo`, `ls`) o con una palabra en mayúsculas (`SELECT`, `UNDROP`).
const INICIO_DE_FRASE = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]/;

export const esComando = (texto: string): boolean => {
  const limpio = texto.trim();
  if (!limpio || limpio.includes('\n\n')) return false;
  const palabras = limpio.split(/\s+/).length;
  // Una frase larga es prosa aunque lleve símbolos (negritas de Markdown, «->», «a=b»)
  if (palabras >= MINIMO_PALABRAS_PROSA && INICIO_DE_FRASE.test(limpio) && !limpio.endsWith(';')) return false;
  if (SIMBOLOS_DE_COMANDO.test(limpio)) return true;
  return palabras < MINIMO_PALABRAS_PROSA;
};

/** Algunos modelos repiten el número en el título («Paso 1: Identificar…»); la interfaz ya lo muestra. */
export const tituloSinPaso = (titulo: string): string =>
  titulo.replace(/^\s*paso\s*\d+\s*[:.·-]\s*/i, '').trim() || titulo.trim();
