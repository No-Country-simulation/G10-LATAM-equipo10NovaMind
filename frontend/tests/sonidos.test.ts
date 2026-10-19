/**
 * Efectos de sonido: preferencia recordada y cuándo pueden sonar (nunca encima de una voz).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { debeSonar, guardarPreferencia, hayVozEnCurso, leerPreferencia, marcarVoz } from '../src/utils/sonidos.ts';

const almacen = () => {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
};

test('activos por defecto; apagados si se silenciaron o si no hay almacenamiento', () => {
  const a = almacen();
  assert.equal(leerPreferencia(a), true);
  guardarPreferencia(a, false);
  assert.equal(leerPreferencia(a), false);
  guardarPreferencia(a, true);
  assert.equal(leerPreferencia(a), true);
  assert.equal(leerPreferencia(null), false);
  const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  assert.equal(leerPreferencia(roto), false);
  assert.doesNotThrow(() => guardarPreferencia(roto, true));
});

test('no suena con el sonido apagado, sin audio o mientras habla una voz', () => {
  assert.equal(debeSonar({ activo: true, vozEnCurso: false, hayAudio: true }), true);
  assert.equal(debeSonar({ activo: false, vozEnCurso: false, hayAudio: true }), false);
  assert.equal(debeSonar({ activo: true, vozEnCurso: true, hayAudio: true }), false);
  assert.equal(debeSonar({ activo: true, vozEnCurso: false, hayAudio: false }), false);
});

test('la voz en curso se marca y se libera por fuente', () => {
  assert.equal(hayVozEnCurso(), false);
  marcarVoz('estacion4', true);
  marcarVoz('otra', true);
  marcarVoz('estacion4', false);
  assert.equal(hayVozEnCurso(), true);
  marcarVoz('otra', false);
  assert.equal(hayVozEnCurso(), false);
});
