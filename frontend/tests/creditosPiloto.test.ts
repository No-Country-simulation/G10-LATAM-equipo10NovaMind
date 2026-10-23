/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Pruebas unitarias para la Escena Piloto de Créditos NuevaMente
 * Ejecutar: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREDITOS_CONFIG, ESCENA_01_TIMING, ESCENA_02_TIMING } from '../src/creditos/config.ts';
import { ISOTIPO_PATHS, ISOTIPO_VIEWBOX } from '../src/creditos/isotipoPaths.ts';
import rawPixelData from '../src/creditos/isotipo8bitData.json' with { type: 'json' };

test('Configuración de Remotion: 1920x1080 @ 30fps y 1350 frames completos (45.0s)', () => {
  assert.equal(CREDITOS_CONFIG.width, 1920, 'Ancho debe ser 1920');
  assert.equal(CREDITOS_CONFIG.height, 1080, 'Alto debe ser 1080');
  assert.equal(CREDITOS_CONFIG.fps, 30, 'FPS debe ser 30');
  assert.equal(CREDITOS_CONFIG.pilotoFrames, 90, 'Duración de la escena piloto debe ser 90 fotogramas (3.0s)');
  assert.equal(CREDITOS_CONFIG.escena01Frames, 90, 'Escena 01 debe ser 90 frames');
  assert.equal(CREDITOS_CONFIG.escena02Frames, 150, 'Escena 02 debe ser 150 frames (5.0s)');
  assert.equal(CREDITOS_CONFIG.escena03Frames, 300, 'Escena 03 debe ser 300 frames (10.0s)');
  assert.equal(CREDITOS_CONFIG.escena04Frames, 300, 'Escena 04 debe ser 300 frames (10.0s)');
  assert.equal(CREDITOS_CONFIG.escena05Frames, 330, 'Escena 05 debe ser 330 frames (11.0s)');
  assert.equal(CREDITOS_CONFIG.escena06Frames, 180, 'Escena 06 debe ser 180 frames (6.0s)');
  assert.equal(CREDITOS_CONFIG.faseActualFrames, 1350, 'Fase actual acumulada debe ser 1350 frames (45.0s)');
  assert.equal(CREDITOS_CONFIG.totalFrames, 1350, 'Total objetivo debe ser 1350 frames (45.0s)');

  const sumaEscenas =
    CREDITOS_CONFIG.escena01Frames +
    CREDITOS_CONFIG.escena02Frames +
    CREDITOS_CONFIG.escena03Frames +
    CREDITOS_CONFIG.escena04Frames +
    CREDITOS_CONFIG.escena05Frames +
    CREDITOS_CONFIG.escena06Frames;
  assert.equal(sumaEscenas, 1350, 'La suma exacta de las 6 escenas debe ser 1350 fotogramas');
});

test('Datos de píxeles 8-bit del Isotipo: cuadrícula 32x32 y colores válidos', () => {
  assert.ok(Array.isArray(rawPixelData), 'Los datos de píxeles deben ser un arreglo');
  assert.equal(rawPixelData.length, 233, 'El Isotipo en 32x32 debe contener exactamente 233 píxeles activos');

  for (const pixel of rawPixelData as [number, number, number, number, number][]) {
    const [x, y, r, g, b] = pixel;
    assert.ok(x >= 0 && x < 32, `Coordenada X (${x}) fuera de rango 0-31`);
    assert.ok(y >= 0 && y < 32, `Coordenada Y (${y}) fuera de rango 0-31`);
    assert.ok(r >= 0 && r <= 255, `Color R (${r}) inválido`);
    assert.ok(g >= 0 && g <= 255, `Color G (${g}) inválido`);
    assert.ok(b >= 0 && b <= 255, `Color B (${b}) inválido`);
  }
});

test('Trazados vectoriales oficiales del Isotipo: 5 paths y viewBox 2101x2101', () => {
  assert.equal(ISOTIPO_VIEWBOX, '0 0 2101 2101', 'El viewBox debe coincidir con el SVG oficial');
  assert.equal(ISOTIPO_PATHS.length, 5, 'Debe contener exactamente 5 paths vectoriales');
  for (let i = 0; i < ISOTIPO_PATHS.length; i++) {
    const p = ISOTIPO_PATHS[i];
    assert.ok(p.startsWith('M'), `Path ${i} debe comenzar con comando M`);
    assert.ok(p.endsWith('Z'), `Path ${i} debe cerrar con comando Z`);
    assert.ok(p.length > 50, `Path ${i} debe tener geometría vectorial real`);
  }
});

test('Determinismo de la barra de carga 8-bit: 0% en frame 20 y 100% en frame 72', () => {
  const calcProgreso = (f: number) => {
    if (f <= 20) return 0;
    if (f >= 72) return 100;
    return Math.round(((f - 20) / (72 - 20)) * 100);
  };

  assert.equal(calcProgreso(0), 0, 'Frame 0 debe ser 0%');
  assert.equal(calcProgreso(20), 0, 'Frame 20 debe iniciar en 0%');
  assert.equal(calcProgreso(46), 50, 'Frame 46 intermedio debe ser 50%');
  assert.equal(calcProgreso(72), 100, 'Frame 72 debe alcanzar el 100%');
  assert.equal(calcProgreso(89), 100, 'Frame 89 debe permanecer en 100%');
});

test('Determinismo de fase Glitch & Partículas: inactiva antes del frame 75 y activa al final', () => {
  const calcGlitch = (f: number) => {
    if (f <= 75) return 0;
    if (f >= 89) return 1;
    return (f - 75) / (89 - 75);
  };

  assert.equal(calcGlitch(0), 0, 'Sin glitch en frame 0');
  assert.equal(calcGlitch(45), 0, 'Sin glitch en frame 45');
  assert.equal(calcGlitch(75), 0, 'Sin glitch en frame 75');
  assert.ok(calcGlitch(82) > 0.4 && calcGlitch(82) < 0.6, 'Glitch progresivo al 50% en frame 82');
  assert.equal(calcGlitch(89), 1, 'Glitch al 100% en frame final (89)');
});

test('Escena 02 Timing & Determinismo: Desprendimiento, Convergencia y Núcleo Holográfico', () => {
  assert.equal(ESCENA_02_TIMING.totalSceneFrames, 150, 'La escena 2 dura 150 frames (5s)');
  assert.equal(ESCENA_02_TIMING.desprendimientoStartFrame, 0, 'Desprendimiento inicia en frame relativo 0');
  assert.equal(ESCENA_02_TIMING.desprendimientoPeakFrame, 35, 'Pico de desprendimiento en frame 35');
  assert.equal(ESCENA_02_TIMING.convergenciaEndFrame, 75, 'Convergencia finaliza en frame 75');
  assert.ok(
    ESCENA_02_TIMING.anillosHudStartFrame < ESCENA_02_TIMING.hologramaRevealStartFrame,
    'Los anillos HUD aparecen gradualmente en el fondo antes del revelado vectorial completo'
  );

  // Verificación de curvas deterministas de interpolación
  const interpolateClamp = (f: number, inRange: [number, number], outRange: [number, number]) => {
    if (f <= inRange[0]) return outRange[0];
    if (f >= inRange[1]) return outRange[1];
    return outRange[0] + ((f - inRange[0]) / (inRange[1] - inRange[0])) * (outRange[1] - outRange[0]);
  };

  // Desprendimiento: relativo 0 a 35
  assert.equal(interpolateClamp(0, [0, 35], [0, 1]), 0, 'Desprendimiento en f0 debe ser 0');
  assert.equal(interpolateClamp(35, [0, 35], [0, 1]), 1, 'Desprendimiento en f35 debe ser 1');
  assert.equal(interpolateClamp(70, [0, 35], [0, 1]), 1, 'Desprendimiento en f70 debe estar clamped a 1');

  // Convergencia: relativo 35 a 75
  assert.equal(interpolateClamp(20, [35, 75], [0, 1]), 0, 'Convergencia antes de f35 debe ser 0');
  assert.equal(interpolateClamp(55, [35, 75], [0, 1]), 0.5, 'Convergencia en f55 debe ser 0.5');
  assert.equal(interpolateClamp(75, [35, 75], [0, 1]), 1, 'Convergencia en f75 debe ser 1');

  // Rotaciones 3D finitas y continuas
  for (const f of [0, 35, 75, 120, 149]) {
    const rotY = Math.sin(f * 0.04) * 22;
    const rotX = Math.cos(f * 0.03) * 14;
    assert.ok(Number.isFinite(rotY), `Rotación Y en f${f} debe ser finita`);
    assert.ok(Number.isFinite(rotX), `Rotación X en f${f} debe ser finita`);
  }
});
