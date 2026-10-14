/**
 * Repaso guiado del quiz: solo preguntas falladas, ordenadas por fallos y sin datos inventados.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puntosDeRepaso } from '../src/utils/repasoQuiz.ts';
import type { QuizQuestion } from '../src/types/types.ts';

const pregunta = (id: string, extra: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id,
  pregunta: `¿Pregunta ${id}?`,
  opciones: ['A', 'B', 'C', 'D'],
  respuesta_correcta: 1,
  justificacion_rag: `Porque B (${id})`,
  cita_fuente: `cita ${id}`,
  ...extra,
});

test('sin fallos no hay nada que repasar', () => {
  assert.deepEqual(puntosDeRepaso([pregunta('1')], {}), []);
  assert.deepEqual(puntosDeRepaso([pregunta('1')], undefined), []);
});

test('ordena por número de fallos y, a igualdad, por el orden del quiz', () => {
  const preguntas = [pregunta('1'), pregunta('2'), pregunta('3')];
  const puntos = puntosDeRepaso(preguntas, { 2: [0], 0: [3], 1: [0, 2] });
  assert.deepEqual(puntos.map((p) => p.indice), [1, 0, 2]);
  assert.equal(puntos[0].fallos, 2);
  assert.equal(puntos[0].respuesta, 'B');
  assert.equal(puntos[0].cita, 'cita 2');
});

test('usa la explicación del backend solo si existe', () => {
  const con = pregunta('1', { explicaciones_opciones: ['A falla por x', 'ok', '', 'D falla por y'] });
  const [punto] = puntosDeRepaso([con], { 0: [0, 2] });
  assert.deepEqual(punto.descartadas, [
    { opcion: 'A', explicacion: 'A falla por x' },
    { opcion: 'C', explicacion: undefined },
  ]);
});

test('ignora índices fuera de rango, duplicados y la opción correcta', () => {
  const puntos = puntosDeRepaso([pregunta('1')], { 0: [0, 0, 1, 9, -1], 5: [0] });
  assert.equal(puntos.length, 1);
  assert.deepEqual(puntos[0].descartadas.map((d) => d.opcion), ['A']);
});

test('conserva la fuente localizada tal cual', () => {
  const fuente = { texto: 'cita 1', pagina: 4, verificada: true };
  const [punto] = puntosDeRepaso([pregunta('1', { fuente })], { 0: [2] });
  assert.equal(punto.fuente, fuente);
});
