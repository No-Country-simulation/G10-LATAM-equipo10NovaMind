/**
 * Escenarios de las muestras pregeneradas: varios por documento, en el orden del índice, y
 * compatibles con un índice antiguo (un escenario por documento, sin escenario ni modo).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escenarioDe, indiceMuestras } from '../src/services/muestras.ts';

const AJUSTES = { formato: 'Paquete Educativo Completo (5 Estaciones)', detalle: 'Didáctico' };

const conIndice = async (lista: unknown[]) => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify(lista))) as typeof fetch;
  try {
    return await indiceMuestras();
  } finally {
    globalThis.fetch = original;
  }
};

test('agrupa los escenarios por documento en el orden del índice', async () => {
  const muestras = await conIndice([
    { documento: 'kafka', escenario: 'junior', etiqueta: 'Junior · Finanzas', modo: 'paralelo',
      ajustes: { ...AJUSTES, perfil: 'Desarrollador Junior', nicho: 'Finanzas y Contabilidad' }, base: '/ejemplos/kafka/junior/' },
    { documento: 'enisa', escenario: 'lider', etiqueta: 'Líder · Salud', modo: 'paralelo',
      ajustes: { ...AJUSTES, perfil: 'Líder Técnico / Arquitecto', nicho: 'Medicina y Salud' }, base: '/ejemplos/enisa/lider/' },
    { documento: 'kafka', escenario: 'lider-clasico', etiqueta: 'Líder · Finanzas', modo: 'clasico',
      ajustes: { ...AJUSTES, perfil: 'Líder Técnico / Arquitecto', nicho: 'Finanzas y Contabilidad' }, base: '/ejemplos/kafka/lider-clasico/' },
  ]);
  assert.deepEqual(muestras.kafka.map((m) => m.escenario), ['junior', 'lider-clasico']);
  assert.equal(muestras.kafka[1].modo, 'clasico');
  assert.equal(escenarioDe(muestras, 'kafka', 'lider-clasico')?.base, '/ejemplos/kafka/lider-clasico/');
  // Sin escenario, o con uno que no existe, se abre el primero; un documento sin muestras no abre nada
  assert.equal(escenarioDe(muestras, 'kafka')?.escenario, 'junior');
  assert.equal(escenarioDe(muestras, 'kafka', 'no-existe')?.escenario, 'junior');
  assert.equal(escenarioDe(muestras, 'quijote'), undefined);
});

test('un índice antiguo sin escenario ni modo sigue funcionando', async () => {
  const muestras = await conIndice([
    { documento: 'guia', ajustes: { ...AJUSTES, perfil: 'Principiante', nicho: 'General' }, base: '/ejemplos/guia/' },
  ]);
  const [m] = muestras.guia;
  assert.equal(m.escenario, 'principal');
  assert.equal(m.modo, 'paralelo');
  assert.equal(m.etiqueta, 'Principiante · General');
});
