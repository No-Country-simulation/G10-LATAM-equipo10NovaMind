/**
 * Línea de tiempo del video narrado (Remotion, Estación 04): portada, escenas con sus
 * silencios técnicos, transiciones y cierre.
 * Ejecutar: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DirectorScene, VideoJobSpec } from '../src/types/types.ts';
import {
  CIERRE_S,
  FPS,
  PORTADA_S,
  SILENCIO_FIN_S,
  SILENCIO_INICIO_S,
  TRANSICION_FRAMES,
  avanceExplicacion,
  escenaEnFrame,
  frameDeEscena,
  lineaVideo,
  palabraEnFrame,
  silenciosTecnicos,
} from '../src/components/stations/Station4DirectorCut/video/lineaVideo.ts';
import { BASE_WPM, sceneSeconds } from '../src/utils/microclassTiming.ts';

const escena = (n: number, guion: string, audio?: DirectorScene['audio']): DirectorScene => ({
  id: `e${n}`,
  escena: n,
  tiempo: '00:00 - 00:10',
  titulo: `Escena ${n}`,
  guion_locutor: guion,
  storyboard_visual: 'Diapositiva.',
  consejo_pedagogico: 'Pausa.',
  audio,
});

const spec = (escenas: DirectorScene[], velocidad = 1): VideoJobSpec => ({
  video_job_id: 'vjob-t',
  document_id: 'doc-t',
  target_duration: 50,
  max_duration: 60,
  aspect_ratio: '16:9',
  idioma: 'es',
  estado: 'completed',
  escenas,
  total_palabras: 0,
  duracion_total_estimada: 0,
  velocidad_reproduccion: velocidad,
});

const audio = (s: number, tiempos?: number[]): DirectorScene['audio'] => ({
  duracion_real_s: s,
  voz: 'Kore',
  modelo: 'tts',
  tiempos_palabras: tiempos ?? null,
});

test('los silencios técnicos son los mismos que en el backend (schemas.py)', () => {
  const schemas = readFileSync(fileURLToPath(new URL('../../backend/app/core/schemas.py', import.meta.url)), 'utf8');
  const valor = (nombre: string) => Number(new RegExp(`^${nombre} = ([\\d.]+)`, 'm').exec(schemas)?.[1]);
  assert.equal(valor('SILENCIO_INICIO_S'), SILENCIO_INICIO_S);
  assert.equal(valor('SILENCIO_FIN_S'), SILENCIO_FIN_S);
  assert.equal(silenciosTecnicos(3), 2.4);
});

test('con voz: cada escena dura la voz medida (a la velocidad del backend) más sus silencios', () => {
  const linea = lineaVideo(spec([escena(1, 'a b c', audio(22)), escena(2, 'd e', audio(11))], 1.1), {
    1: 'blob:1',
    2: 'blob:2',
  });
  const [e1, e2] = linea.escenas;
  assert.equal(e1.segundosVoz, 20); // 22 / 1,1
  assert.equal(e1.inicioVoz, Math.round(SILENCIO_INICIO_S * FPS));
  assert.equal(e1.frames, 9 + 600 + 15);
  assert.equal(e1.audioUrl, 'blob:1');
  assert.ok(linea.conVoz);
  // Las transiciones solapan: cada secuencia empieza TRANSICION_FRAMES antes de que acabe la anterior
  assert.equal(e1.desde, PORTADA_S * FPS - TRANSICION_FRAMES);
  assert.equal(e2.desde, e1.desde + e1.frames - TRANSICION_FRAMES);
  assert.equal(linea.desdeCierre, e2.desde + e2.frames - TRANSICION_FRAMES);
  assert.equal(linea.totalFrames, linea.desdeCierre + CIERRE_S * FPS);
});

test('la duración medida por el navegador manda sobre la del servidor', () => {
  // El servidor dijo 30 s (cabecera del WAV) pero el audio que suena dura 15 s
  const linea = lineaVideo(spec([escena(1, 'a b c', audio(30))]), { 1: 'blob:1' }, { 1: 15 });
  assert.equal(linea.escenas[0].segundosVoz, 15);
  assert.equal(linea.escenas[0].frames, 9 + 450 + 15);
  // Sin medida del navegador, se usa la del servidor
  assert.equal(lineaVideo(spec([escena(1, 'a b c', audio(30))]), { 1: 'blob:1' }).escenas[0].segundosVoz, 30);
});

test('la voz entra justo al acabar la transición de entrada', () => {
  assert.equal(TRANSICION_FRAMES, Math.round(SILENCIO_INICIO_S * FPS));
  assert.ok(Math.round(SILENCIO_FIN_S * FPS) > TRANSICION_FRAMES); // la salida no pisa la voz
});

test('sin voz: duración estimada al ritmo base, sin silencios ni audio', () => {
  const guion = 'una dos tres cuatro cinco seis siete ocho nueve diez';
  const linea = lineaVideo(spec([escena(1, guion, audio(30))])); // hay duración, pero no URL
  const [e] = linea.escenas;
  assert.equal(e.medida, false);
  assert.equal(e.audioUrl, undefined);
  assert.equal(e.inicioVoz, 0);
  assert.equal(e.segundosVoz, sceneSeconds(10, BASE_WPM));
  assert.equal(linea.conVoz, false);
});

test('escena en cada fotograma: portada, escenas y cierre', () => {
  const linea = lineaVideo(spec([escena(1, 'a', audio(5)), escena(2, 'b', audio(5))]), { 1: 'x', 2: 'y' });
  assert.equal(escenaEnFrame(linea, 0), -1);
  assert.equal(escenaEnFrame(linea, linea.escenas[0].desde), 0);
  assert.equal(escenaEnFrame(linea, linea.escenas[1].desde - 1), 0);
  assert.equal(escenaEnFrame(linea, linea.escenas[1].desde), 1);
  assert.equal(escenaEnFrame(linea, linea.desdeCierre), 2);
  assert.equal(escenaEnFrame(linea, frameDeEscena(linea, 1)), 1);
  assert.equal(frameDeEscena(linea, 9), frameDeEscena(linea, 1)); // fuera de rango: la última
});

test('subtítulos solo con tiempos reales por palabra, y nunca durante el silencio inicial', () => {
  const conTiempos = lineaVideo(spec([escena(1, 'uno dos tres', audio(1.5, [0.5, 1.0, 1.5]))]), { 1: 'x' });
  const e = conTiempos.escenas[0];
  assert.equal(palabraEnFrame(e.inicioVoz, e, 1), -1);
  assert.equal(palabraEnFrame(e.inicioVoz + FPS * 0.75, e, 1), 1);
  assert.equal(palabraEnFrame(e.inicioVoz + FPS * 0.5, e, 1.5), 1); // a 1,5× ya sonaron 0,75 s
  const sinTiempos = lineaVideo(spec([escena(1, 'uno dos tres', audio(1.5))]), { 1: 'x' }).escenas[0];
  assert.equal(palabraEnFrame(40, sinTiempos, 1), -1);
  const noCuadran = lineaVideo(spec([escena(1, 'uno dos tres', audio(1.5, [0.5]))]), { 1: 'x' }).escenas[0];
  assert.equal(palabraEnFrame(40, noCuadran, 1), -1);
});

test('las animaciones de la explicación avanzan de 0 a 1 dentro de la escena', () => {
  const e = lineaVideo(spec([escena(1, 'a', audio(10))]), { 1: 'x' }).escenas[0];
  assert.equal(avanceExplicacion(0, e, 0.5), 0);
  assert.equal(avanceExplicacion(e.frames, e, 0.5), 1);
  const mitad = avanceExplicacion(Math.round(e.frames * 0.3), e, 0.5);
  assert.ok(mitad > 0 && mitad < 1);
});
