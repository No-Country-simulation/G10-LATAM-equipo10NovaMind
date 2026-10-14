/**
 * Prompt visual de la Estación 04: se arma solo con lo que trae la escena.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptVisualEscena } from '../src/utils/promptVisual.ts';
import type { DirectorScene } from '../src/types/types.ts';

const escena = (extra: Partial<DirectorScene> = {}): DirectorScene => ({
  id: 'e1',
  escena: 1,
  tiempo: '00:00 - 00:20',
  titulo: 'Memoria swap',
  guion_locutor: 'texto',
  storyboard_visual: 'Servidor con una barra de memoria que se desborda al disco',
  consejo_pedagogico: '',
  ...extra,
});

test('usa la descripción del storyboard, el tema y la proporción de la diapositiva', () => {
  const prompt = promptVisualEscena(escena());
  assert.match(prompt, /«Memoria swap»/);
  assert.match(prompt, /se desborda al disco\./);
  assert.match(prompt, /16:9/);
  assert.match(prompt, /sin texto escrito/);
});

test('prefiere el prompt gráfico y los puntos clave de la especificación visual', () => {
  const prompt = promptVisualEscena(escena({
    visual: {
      tipo: 'diagrama_bloques',
      titulo: 'Flujo de paginación',
      puntos_clave: ['RAM llena', '  Paginación  ', '', 'Disco'],
      prompt_grafico: 'Diagrama de bloques de RAM a disco.',
    },
  }));
  assert.match(prompt, /«Flujo de paginación»/);
  assert.match(prompt, /Diagrama de bloques de RAM a disco\./);
  assert.doesNotMatch(prompt, /se desborda/);
  assert.match(prompt, /RAM llena; Paginación; Disco\./);
});

test('sin nada visual no inventa un prompt', () => {
  assert.equal(promptVisualEscena(escena({ storyboard_visual: '   ' })), '');
});
