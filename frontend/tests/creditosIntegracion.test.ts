/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Pruebas unitarias para la integración del Reproductor Cinematográfico de Créditos
 * Ejecutar con: npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDITOS_CONFIG } from '../src/creditos/config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');

test('Recursos audiovisuales oficiales: archivo de música Midnight High Score e Isotipo presentes', () => {
  const audioPath = path.join(frontendDir, 'public', 'Midnight_High_Score.mp3');
  assert.ok(fs.existsSync(audioPath), 'El archivo public/Midnight_High_Score.mp3 debe existir');
  const audioStats = fs.statSync(audioPath);
  assert.ok(audioStats.size > 4_000_000, 'Midnight_High_Score.mp3 debe tener tamaño real (~4.06 MB)');

  const isotypePath = path.join(frontendDir, 'public', 'IsotipoMonocromo.svg');
  assert.ok(fs.existsSync(isotypePath), 'El archivo public/IsotipoMonocromo.svg debe existir');
  const isotypeSvg = fs.readFileSync(isotypePath, 'utf-8');
  assert.ok(isotypeSvg.includes('viewBox="0 0 2101 2101"'), 'Debe tener el viewBox oficial 2101x2101');
  assert.ok(isotypeSvg.includes('<path'), 'Debe contener trazados vectoriales');
});

test('Configuración de Remotion para reproducción sincronizada', () => {
  assert.equal(CREDITOS_CONFIG.fps, 30, 'FPS debe ser 30');
  assert.equal(CREDITOS_CONFIG.faseActualFrames, 660, 'Duración total de la composición debe ser 660 frames (22s)');
  assert.equal(CREDITOS_CONFIG.totalFrames, 660, 'Duración objetivo total debe ser 660 frames (22s)');
  assert.equal(CREDITOS_CONFIG.width, 1920, 'Ancho 1080p');
  assert.equal(CREDITOS_CONFIG.height, 1080, 'Alto 1080p');
});

test('Integración no destructiva: preserve el árbol de React en memoria', () => {
  // Verificación estática de que App.tsx monta CreditosModal sin alterar el estado de React
  const appPath = path.join(frontendDir, 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  assert.ok(appContent.includes('CreditosModal'), 'App.tsx debe importar y utilizar CreditosModal');
  assert.ok(appContent.includes('isCreditosModalOpen'), 'App.tsx debe tener el estado isCreditosModalOpen');
  assert.ok(appContent.includes('handleVolverResultados'), 'App.tsx debe tener el callback handleVolverResultados');
  assert.ok(appContent.includes('handleExplorarNuevaMente'), 'App.tsx debe tener el callback handleExplorarNuevaMente');
});

test('Estación 5 (Quiz): incorpora botón Descubrir la sorpresa en pantalla de éxito', () => {
  const quizPath = path.join(frontendDir, 'src', 'components', 'stations', 'Station5Quiz', 'Station5Quiz.tsx');
  const quizContent = fs.readFileSync(quizPath, 'utf-8');

  assert.ok(quizContent.includes('onOpenCreditos'), 'Station5Quiz debe recibir la prop onOpenCreditos');
  assert.ok(quizContent.includes('Descubrir la sorpresa'), 'Station5Quiz debe incluir el botón «Descubrir la sorpresa»');
  assert.ok(quizContent.includes('El equipo NuevaMente tiene una sorpresa para ti'), 'Station5Quiz debe incluir el mensaje festivo');
});

test('BadgeModal: ofrece acceso a la sorpresa al desbloquear la Medalla Maestra', () => {
  const badgeModalPath = path.join(frontendDir, 'src', 'components', 'BadgeModal', 'BadgeModal.tsx');
  const badgeModalContent = fs.readFileSync(badgeModalPath, 'utf-8');

  assert.ok(badgeModalContent.includes('onOpenCreditos'), 'BadgeModal debe soportar onOpenCreditos');
  assert.ok(badgeModalContent.includes('Descubrir la sorpresa'), 'BadgeModal debe incluir la opción para la medalla maestra');
});

test('Banda sonora: implementación de fade-out suave al cierre del video', () => {
  const videoPath = path.join(frontendDir, 'src', 'creditos', 'CreditosVideo.tsx');
  const videoContent = fs.readFileSync(videoPath, 'utf-8');

  assert.ok(videoContent.includes('<Audio'), 'Debe incluir componente Audio de Remotion');
  assert.ok(videoContent.includes('/Midnight_High_Score.mp3'), 'Debe apuntar a la ruta pública del audio');
  assert.ok(videoContent.includes('volume='), 'Debe configurar curva de volumen para evitar corte abrupto');
  assert.ok(videoContent.includes('interpolate'), 'Debe usar interpolate para la curva de fundido');
});

test('CreditosModal: controles accesibles, atajos de teclado y adaptación responsive', () => {
  const modalPath = path.join(frontendDir, 'src', 'creditos', 'CreditosModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  assert.ok(modalContent.includes('aria-modal="true"'), 'Debe ser un modal accesible con aria-modal');
  assert.ok(modalContent.includes("key === 'Escape'"), 'Debe soportar cierre con Escape');
  assert.ok(modalContent.includes("key === ' '"), 'Debe soportar pausa/reanudación con Espacio');
  assert.ok(modalContent.includes("key === 'm'"), 'Debe soportar silencio con M');

  const cssPath = path.join(frontendDir, 'src', 'creditos', 'CreditosModal.module.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');
  assert.ok(cssContent.includes('@media (max-width: 640px)'), 'Debe incluir estilos adaptados a pantallas móviles');
});

test('Estructura de 3 actos cinematográficos montados en secuencia (22.0s)', () => {
  const videoPath = path.join(frontendDir, 'src', 'creditos', 'CreditosVideo.tsx');
  const videoContent = fs.readFileSync(videoPath, 'utf-8');

  assert.ok(videoContent.includes('Escena01Apertura8Bit'), 'Debe montar Escena 01 (Apertura 8-Bit)');
  assert.ok(videoContent.includes('Escena02CreditosIgualdad'), 'Debe montar Escena 02 (Contribuidores en Igualdad)');
  assert.ok(videoContent.includes('Escena03AgradecimientoQR'), 'Debe montar Escena 03 (QR y Agradecimiento OCI y Alura)');

  // Comprobar que los archivos de escenas existen en disco
  const escenas = [
    'Escena01Apertura8Bit.tsx',
    'Escena02CreditosIgualdad.tsx',
    'Escena03AgradecimientoQR.tsx',
  ];
  for (const esc of escenas) {
    const escPath = path.join(frontendDir, 'src', 'creditos', esc);
    assert.ok(fs.existsSync(escPath), `El archivo ${esc} debe existir`);
  }
});

test('Créditos oficiales del Equipo 10: contiene los miembros y roles reales confirmados', async () => {
  const configModule = await import('../src/creditos/config.ts');
  const datos = configModule.CREDITOS_EQUIPO_DATOS;
  assert.ok(datos, 'Debe exportar CREDITOS_EQUIPO_DATOS');
  assert.equal(datos.proyecto, 'NuevaMente');
  assert.ok(datos.liderazgo.some((l: { nombre: string }) => l.nombre === 'Silvia'), 'Silvia debe estar en liderazgo');
  assert.ok(datos.liderazgo.some((l: { nombre: string }) => l.nombre.includes('Gabriel')), 'Gabriel debe estar en liderazgo');
  assert.ok(datos.liderazgo.some((l: { nombre: string }) => l.nombre.includes('Carina')), 'Carina debe estar en liderazgo');

  const todosDesarrollo = datos.desarrollo.flatMap((d: { miembros: string[] }) => d.miembros);
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Emanuel')), 'Emanuel debe estar en créditos');
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Pedro')), 'Pedro debe estar en créditos');
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Tomás')), 'Tomás debe estar en créditos');
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Harumi')), 'Harumi debe estar en créditos');
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Wilson')), 'Wilson debe estar en créditos');
  assert.ok(todosDesarrollo.some((n: string) => n.includes('Alex') || n.includes('Alejandro')), 'Alex o Alejandro debe estar en créditos');
});


