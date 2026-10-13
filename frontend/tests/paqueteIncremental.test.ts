/**
 * Publicación incremental (modo paralelo): eventos SSE → paquete parcial.
 * Ejecutar: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarEvento,
  esEventoGeneracion,
  estacionDisponible,
  estacionesResueltas,
  motivoError,
  paqueteEnConstruccion,
} from '../src/utils/paqueteIncremental.ts';
import type { EventoGeneracion } from '../src/utils/paqueteIncremental.ts';
import type { EstadoRecurso, RecursoId } from '../src/types/types.ts';

const estado = (recurso: RecursoId, extra: Partial<EstadoRecurso> = {}): EstadoRecurso => ({
  recurso, tarea: 'B1', estado: 'completado', verificacion: 'pendiente', modelo: 'm',
  intentos: 1, latencia_s: 1, citas_totales: 2, citas_verificadas: 2, avisos: [], ...extra,
});

const flashcards: EventoGeneracion = {
  tipo: 'recurso', recurso: 'flashcards', estado: estado('flashcards'),
  campos: { flashcards: [{ id: 'fc-1', frente: '¿Qué?', dorso: 'Esto', pista_didactica: 'p' }] },
};

test('el primer recurso deja disponible solo su estación', () => {
  const base = paqueteEnConstruccion('Doc', 'Principiante', 'Flashcards');
  const p = aplicarEvento(base, flashcards);
  assert.deepEqual(estacionesResueltas(p), [1]);
  assert.equal(estacionDisponible(p, 1), true);
  assert.equal(estacionDisponible(p, 0), false);
  assert.equal(base.contenido_adaptado.flashcards, undefined, 'no muta el paquete anterior');
});

test('un recurso fallido resuelve la estación pero no la habilita ni aporta campos', () => {
  let p = paqueteEnConstruccion('Doc', 'Principiante', 'Flashcards');
  p = aplicarEvento(p, {
    tipo: 'recurso', recurso: 'resumen', estado: estado('resumen', { estado: 'fallido', error_codigo: 'rate_limit' }),
    campos: { resumen_ninja: { titulo: 'x', analogia_central: 'y', conceptos_clave: [] } },
  });
  assert.deepEqual(estacionesResueltas(p), [0]);
  assert.equal(estacionDisponible(p, 0), false);
  assert.equal(p.contenido_adaptado.resumen_ninja, undefined);
  assert.equal(motivoError('rate_limit'), 'la cuota del modelo se agotó temporalmente');
  assert.equal(motivoError('desconocido'), 'error al generar el recurso');
});

test('la auditoría actualiza la verificación y el score sin tocar el contenido', () => {
  let p = aplicarEvento(paqueteEnConstruccion('Doc', 'Principiante', 'Flashcards'), flashcards);
  p = aplicarEvento(p, { tipo: 'auditoria', auditoria_ejecutada: true, anclaje_fuente_score: 0.9,
    verificacion: { flashcards: 'auditada', resumen: 'auditada' } });
  assert.equal(p.contenido_adaptado.estado_recursos?.flashcards?.verificacion, 'auditada');
  assert.equal(p.contenido_adaptado.estado_recursos?.resumen, undefined, 'no crea estados de recursos ausentes');
  assert.equal(p.evaluacion_calidad.anclaje_fuente_score, 0.9);
  p = aplicarEvento(p, { tipo: 'auditoria', auditoria_ejecutada: false, anclaje_fuente_score: 0.5, verificacion: {} });
  assert.equal(p.evaluacion_calidad.anclaje_fuente_score, null, 'sin auditoría no hay score');
});

test('paquetes de los modos clásicos (sin estado_recursos) siguen disponibles si traen datos', () => {
  const p = paqueteEnConstruccion('Doc', 'Principiante', 'Flashcards');
  const clasico = { ...p, contenido_adaptado: { titulo: 'Doc', introduccion_contextualizada: '', quiz: [] } };
  assert.equal(estacionDisponible(clasico, 4), false, 'quiz vacío');
  assert.equal(estacionDisponible({ ...clasico, contenido_adaptado: { ...clasico.contenido_adaptado,
    quiz: [{ id: 'q', pregunta: 'p', opciones: ['a', 'b', 'c', 'd'], respuesta_correcta: 0, justificacion_rag: '', cita_fuente: '' }] } }, 4), true);
});

test('solo se aceptan eventos de generación bien formados', () => {
  assert.equal(esEventoGeneracion(flashcards), true);
  assert.equal(esEventoGeneracion({ tipo: 'recurso', recurso: 'x' }), false);
  assert.equal(esEventoGeneracion({ tipo: 'progreso', mensaje: 'm' }), false);
  assert.equal(esEventoGeneracion(null), false);
});
