/**
 * Contrato de tiempos de la Estación 04 (lado frontend).
 * Mismo fixture dorado que backend/tests/test_contrato_tiempos.py.
 * Ejecutar: npm test  (Node >= 23.6 ejecuta TypeScript sin compilar).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { countWords, microclassTiming, playbackSeconds, roundTenth, sceneSeconds } from '../src/utils/microclassTiming.ts';

interface GoldenCase {
  nombre: string;
  wpm: number;
  guiones: string[];
  esperado: {
    palabras: number[];
    duraciones: number[];
    tiempos: string[];
    total_palabras: number;
    duracion_total: number;
  };
}

const fixtureUrl = new URL('../../contracts/fixtures/director_cut_golden.json', import.meta.url);
const { casos } = JSON.parse(readFileSync(fileURLToPath(fixtureUrl), 'utf-8')) as { casos: GoldenCase[] };

for (const caso of casos) {
  test(`fixture dorado: ${caso.nombre}`, () => {
    const timing = microclassTiming(caso.guiones, caso.wpm);
    assert.deepEqual(timing.scenes.map((s) => s.words), caso.esperado.palabras);
    assert.deepEqual(timing.scenes.map((s) => s.seconds), caso.esperado.duraciones);
    assert.deepEqual(timing.scenes.map((s) => s.span), caso.esperado.tiempos);
    assert.equal(timing.totalWords, caso.esperado.total_palabras);
    assert.equal(timing.totalSeconds, caso.esperado.duracion_total);
  });
}

test('redondeo half-up (no bancario): 14.25 -> 14.3', () => {
  assert.equal(roundTenth(14.25), 14.3);
  assert.equal(sceneSeconds(38, 160), 14.3);
});

test('el piso de 5 s se aplica después de escalar por wpm', () => {
  assert.equal(sceneSeconds(3, 138), 5);
  assert.equal(sceneSeconds(12, 160), 5);
});

test('conteo de palabras ignora espacios raros', () => {
  assert.equal(countWords('  Uno dos\ttres\ncuatro  '), 4);
  assert.equal(countWords(undefined), 0);
});

test('a la velocidad que pide el backend, una voz de hasta 63 s suena en 60 s o menos', () => {
  assert.equal(playbackSeconds(45), 45);
  assert.equal(playbackSeconds(61.5, 1.025), 60);
  assert.equal(playbackSeconds(60.1, 1.002), 60);
  assert.equal(playbackSeconds(63, 1.05), 60);
});
