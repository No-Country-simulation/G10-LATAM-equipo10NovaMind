/**
 * Visor de cámara de la pizarra didáctica (Estación 04): cada etiqueta sale de la escena real,
 * y la lista de acentos sale de las voces que de verdad tiene el navegador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datosVisor, SIN_DATO } from '../src/utils/datosVisor.ts';
import { regionDeVoz, vocesEnEspanol } from '../src/utils/vozNavegador.ts';
import type { DirectorScene } from '../src/types/types.ts';

const escena = (extra: Partial<DirectorScene> = {}): DirectorScene => ({
  id: 'sc-1',
  escena: 1,
  tiempo: '00:00 - 00:18',
  titulo: 'Qué es el swap',
  guion_locutor: 'El swap usa el disco como memoria de reserva.',
  storyboard_visual: 'Un disco junto a la RAM.',
  consejo_pedagogico: 'Relaciónalo con la RAM.',
  ...extra,
});

test('con foto, citas y diapositiva: datos reales', () => {
  const d = datosVisor(
    escena({
      visual: { tipo: 'diagrama_bloques', titulo: 'Swap', puntos_clave: ['RAM llena', 'Disco como reserva'] },
      imagen: { tipo: 'foto', url: 'https://x/y.jpg', licencia: 'CC BY 2.0' },
      fuentes: [
        { chunk_id: 'a', texto_fuente: 'uno', verificada: true },
        { chunk_id: 'b', texto_fuente: 'dos', verificada: false },
      ],
      objetivo_pedagogico: 'Entender el swap',
    }),
    0, 3, '00:00 - 00:18',
  );
  assert.equal(d.escena, 'ESCENA 1/3');
  assert.equal(d.tramo, '00:00 - 00:18');
  assert.equal(d.formato, 'Diagrama de bloques');
  assert.equal(d.imagen, 'Foto CC BY 2.0');
  assert.equal(d.citas, '1 de 2');
  assert.equal(d.palabras, 9);
  assert.deepEqual(d.puntos, ['RAM llena', 'Disco como reserva', 'Objetivo: Entender el swap', 'Enfoque didáctico: Relaciónalo con la RAM.']);
});

test('sin foto, sin citas, sin visual y sin tramo: nunca un relleno', () => {
  const d = datosVisor(escena({ consejo_pedagogico: '' }), 1, 2, '  ');
  assert.equal(d.tramo, SIN_DATO);
  assert.equal(d.formato, SIN_DATO);
  assert.equal(d.citas, SIN_DATO);
  assert.equal(d.imagen, 'Sin foto: diapositiva');
  assert.deepEqual(d.puntos, []);
});

test('una "foto" sin URL no cuenta como foto', () => {
  assert.equal(datosVisor(escena({ imagen: { tipo: 'foto', url: null } }), 0, 1, 'x').imagen, 'Sin foto: diapositiva');
});

test('acentos: solo voces en español, sin repetir, ordenadas por país', () => {
  const voces = [
    { name: 'Microsoft Tomás', lang: 'es-AR' },
    { name: 'Google español', lang: 'es-ES' },
    { name: 'Zira', lang: 'en-US' },
    { name: 'Dalia', lang: 'es_MX' },
    { name: 'Google español', lang: 'es-ES' },
  ];
  const lista = vocesEnEspanol(voces);
  assert.deepEqual(lista.map((v) => v.name), ['Microsoft Tomás', 'Google español', 'Dalia']);
  assert.deepEqual(lista.map((v) => regionDeVoz(v.lang)), ['Argentina', 'España', 'México']);
  assert.equal(regionDeVoz('es'), 'Español');
});
