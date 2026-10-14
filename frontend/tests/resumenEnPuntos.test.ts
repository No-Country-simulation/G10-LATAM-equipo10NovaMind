/**
 * Resumen ejecutivo en «una frase + puntos»: el mismo texto, partido por oraciones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenEnPuntos } from '../src/utils/resumenEnPuntos.ts';

test('la primera oración es la frase y el resto, puntos', () => {
  const r = resumenEnPuntos(
    'Snowflake separa almacenamiento y cómputo. Varios almacenes virtuales leen los mismos datos. '
    + 'Ofrece SQL estándar y datos semiestructurados.',
  );
  assert.equal(r.frase, 'Snowflake separa almacenamiento y cómputo.');
  assert.deepEqual(r.puntos, [
    'Varios almacenes virtuales leen los mismos datos.',
    'Ofrece SQL estándar y datos semiestructurados.',
  ]);
});

test('no corta abreviaturas, decimales ni nombres con punto', () => {
  const r = resumenEnPuntos('Usa 1.5 GB de RAM, p. ej. en la VM. Amazon S3 guarda los datos.');
  assert.equal(r.frase, 'Usa 1.5 GB de RAM, p. ej. en la VM.');
  assert.deepEqual(r.puntos, ['Amazon S3 guarda los datos.']);
});

test('una sola oración o texto vacío no inventa puntos', () => {
  assert.deepEqual(resumenEnPuntos('Solo una idea.'), { frase: 'Solo una idea.', puntos: [] });
  assert.deepEqual(resumenEnPuntos('  '), { frase: '', puntos: [] });
});
