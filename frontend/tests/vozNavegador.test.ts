/**
 * Voz del navegador (último recurso de la Estación 04): elección de voz y traducción de
 * los eventos `boundary` (posición de carácter) a la palabra del teleprompter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirVozNavegador } from '../src/utils/vozNavegador.ts';
import { splitWords, wordIndexAtChar } from '../src/utils/microclassTiming.ts';

const voz = (name: string, lang: string) => ({ name, lang });

test('prefiere las regiones latinoamericanas en el orden acordado', () => {
  const voces = [voz('Helena', 'es-ES'), voz('Sabina', 'es-MX'), voz('Zira', 'en-US'), voz('Elena', 'es_AR')];
  assert.equal(elegirVozNavegador(voces)?.name, 'Elena'); // es_AR se normaliza a es-AR
  assert.equal(elegirVozNavegador(voces.filter((v) => v.name !== 'Elena'))?.name, 'Sabina');
});

test('sin región preferida usa cualquier español; sin español, ninguna', () => {
  assert.equal(elegirVozNavegador([voz('Zira', 'en-US'), voz('Helena', 'es-ES')])?.name, 'Helena');
  assert.equal(elegirVozNavegador([voz('Zira', 'en-US')]), undefined);
  assert.equal(elegirVozNavegador([]), undefined);
});

test('la posición de carácter apunta a la misma palabra que splitWords', () => {
  const texto = '  Hola,\tmundo  de\nvoces ';
  const palabras = splitWords(texto);
  for (const [i, palabra] of palabras.entries()) {
    const inicio = texto.indexOf(palabra);
    assert.equal(wordIndexAtChar(texto, inicio), i);
    assert.equal(wordIndexAtChar(texto, inicio + palabra.length - 1), i);
  }
  assert.equal(wordIndexAtChar(texto, 0), 0); // separador inicial → primera palabra
  assert.equal(wordIndexAtChar(texto, texto.length), palabras.length);
});
