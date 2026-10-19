/**
 * Mazo de Anki en CSV: cabecera que Anki entiende, campos bien escapados y la cita con su estado real.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dorsoAnki, etiquetaDocumento, mazoAnkiCsv, nombreArchivoAnki } from '../src/utils/exportAnki.ts';
import type { FlashcardItem } from '../src/types/types.ts';

const tarjeta = (extra: Partial<FlashcardItem> = {}): FlashcardItem => ({
  id: 't1',
  frente: '¿Qué es un tópico?',
  dorso: 'Una categoría de mensajes',
  pista_didactica: 'Piensa en un canal',
  ...extra,
});

test('la cabecera usa líneas # y no crea una tarjeta de títulos', () => {
  const lineas = mazoAnkiCsv([tarjeta()], 'Introducción a Kafka').trimEnd().split('\n');
  assert.deepEqual(lineas.slice(0, 5), [
    '#separator:Comma',
    '#html:true',
    '#columns:Frente,Dorso',
    '#deck:NuevaMente::Introducción a Kafka',
    '#tags:nuevamente introduccion-a-kafka',
  ]);
  assert.equal(lineas.length, 6);
  assert.ok(!lineas.some((l) => l.startsWith('Front') || l.includes('Hint')));
});

test('comillas, comas, saltos de línea y HTML quedan escapados', () => {
  const csv = mazoAnkiCsv([tarjeta({ frente: 'a < b, "x"', dorso: 'línea 1\nlínea 2 & más' })], 'Doc');
  assert.ok(csv.includes('"a &lt; b, ""x""","línea 1\nlínea 2 &amp; más'));
});

test('el dorso lleva la pista en español', () => {
  assert.equal(dorsoAnki(tarjeta()), 'Una categoría de mensajes<br><br><em>Pista: Piensa en un canal</em>');
});

test('la cita verificada lleva su página; la no verificada lo dice', () => {
  const verificada = dorsoAnki(tarjeta({ fuente: { texto: 'Un tópico es una categoría', pagina: 12, verificada: true } }));
  assert.ok(verificada.endsWith('<small>Fuente: «Un tópico es una categoría», p. 12</small>'));

  const sinPagina = dorsoAnki(tarjeta({ fuente: { texto: 'cita', pagina: null, verificada: true } }));
  assert.ok(sinPagina.endsWith('<small>Fuente: «cita»</small>'));

  const noVerificada = dorsoAnki(tarjeta({ fuente: { texto: 'cita', pagina: 3, verificada: false } }));
  assert.ok(noVerificada.endsWith('<small>Cita no verificada en el documento: «cita»</small>'));
  assert.ok(!noVerificada.includes('p. 3'));
});

test('sin pista ni fuente, el dorso es solo la respuesta', () => {
  assert.equal(dorsoAnki(tarjeta({ pista_didactica: '' })), 'Una categoría de mensajes');
});

test('mazo, etiqueta y nombre de archivo a partir de títulos difíciles', () => {
  const csv = mazoAnkiCsv([], 'Guía OCI::Swap\n2026');
  assert.ok(csv.includes('#deck:NuevaMente::Guía OCI:Swap 2026\n'));
  assert.equal(etiquetaDocumento('¡¡¡'), 'documento');
  assert.equal(nombreArchivoAnki('Don Quijote, primera parte'), 'anki-don-quijote-primera-parte.csv');
});
