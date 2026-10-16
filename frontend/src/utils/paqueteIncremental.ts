/**
 * Publicación incremental (modo_rag=paralelo): el backend emite un evento SSE `recurso`
 * por cada recurso listo y un evento `auditoria` al final. Este módulo los acumula en un
 * paquete parcial que la UI puede mostrar desde el primer recurso.
 *
 * Puro y sin dependencias de React: se prueba con node:test (tests/paqueteIncremental.test.ts).
 */
import type {
  AdaptedContentPackage,
  EstadoRecurso,
  OutputFormat,
  RecipientProfile,
  RecursoId,
} from '../types/types';

/** Recurso principal de cada estación (índice 0-4). */
export const RECURSO_POR_ESTACION: readonly RecursoId[] = ['resumen', 'flashcards', 'tutorial', 'guion', 'cuestionario'];

/** Recursos de apoyo que se muestran junto a cada estación. */
export const RECURSOS_DE_APOYO: Readonly<Record<number, readonly RecursoId[]>> = {
  0: ['objetivos', 'diagrama'],
  1: ['glosario'],
  3: ['diapositivas'],
};

export const NOMBRE_RECURSO: Readonly<Record<RecursoId, string>> = {
  resumen: 'Resumen',
  flashcards: 'Tarjetas didácticas',
  cuestionario: 'Cuestionario',
  glosario: 'Glosario',
  objetivos: 'Objetivos de aprendizaje',
  guion: 'Guion de locución',
  diapositivas: 'Diapositivas',
  tutorial: 'Guía paso a paso',
  diagrama: 'Diagrama',
};

/** Mensajes para los códigos de error estables del backend (nunca el detalle del proveedor). */
const MOTIVO_ERROR: Readonly<Record<string, string>> = {
  rate_limit: 'la cuota del modelo se agotó temporalmente',
  timeout: 'el modelo no respondió a tiempo',
  presupuesto_agotado: 'se agotó el tiempo máximo de generación',
  esquema_invalido: 'la respuesta del modelo no tenía el formato esperado',
  sin_elementos_validos: 'ningún elemento superó las comprobaciones contra el documento',
  modelo_no_encontrado: 'el modelo configurado no está disponible',
};

export const motivoError = (codigo?: string | null): string =>
  (codigo && MOTIVO_ERROR[codigo]) || 'error al generar el recurso';

export type EventoRecurso = {
  tipo: 'recurso';
  recurso: RecursoId;
  estado: EstadoRecurso;
  /** Parche de contenido_adaptado; ausente si el recurso falló */
  campos?: Partial<AdaptedContentPackage['contenido_adaptado']>;
};

export type EventoAuditoria = {
  tipo: 'auditoria';
  auditoria_ejecutada: boolean;
  anclaje_fuente_score: number | null;
  verificacion: Partial<Record<RecursoId, EstadoRecurso['verificacion']>>;
};

export type EventoGeneracion = EventoRecurso | EventoAuditoria;

export function esEventoGeneracion(evento: unknown): evento is EventoGeneracion {
  if (!evento || typeof evento !== 'object') return false;
  const e = evento as Record<string, unknown>;
  if (e.tipo === 'recurso') return typeof e.recurso === 'string' && !!e.estado && typeof e.estado === 'object';
  if (e.tipo === 'auditoria') return typeof e.verificacion === 'object' && e.verificacion !== null;
  return false;
}

/** Paquete vacío que se va completando. Todo lo no generado queda ausente, no inventado. */
export function paqueteEnConstruccion(
  titulo: string,
  perfil: RecipientProfile,
  formato: OutputFormat,
): AdaptedContentPackage {
  return {
    status: 'exito',
    metadatos: {
      perfil_aplicado: perfil,
      formato_generado: formato,
      tiempo_estimado_estudio_minutos: 0,
      conceptos_clave: [],
      fecha_generacion: new Date().toISOString(),
      modelo_llm: '',
    },
    contenido_adaptado: {
      titulo: titulo || 'Documento',
      introduccion_contextualizada: '',
      estado_recursos: {},
    },
    evaluacion_calidad: {
      anclaje_fuente_score: null,
      auditoria_ejecutada: false,
      claridad_pedagogica: 'Media',
      observaciones: 'Auditoría de fidelidad pendiente.',
      mitigacion_alucinaciones: '',
      chunks_procesados: 0,
      similitud_coseno_promedio: 0,
    },
    almacenamiento_oci: {
      bucket: '',
      objeto_id: '',
      status_upload: 'pendiente',
      region: '',
      etag: '',
      tamano_bytes: 0,
      url_always_free: '',
    },
  };
}

/** Aplica un evento sin mutar el paquete recibido (seguro como actualización de estado de React). */
export function aplicarEvento(paquete: AdaptedContentPackage, evento: EventoGeneracion): AdaptedContentPackage {
  const contenido = paquete.contenido_adaptado;
  if (evento.tipo === 'recurso') {
    return {
      ...paquete,
      contenido_adaptado: {
        ...contenido,
        ...(evento.estado.estado === 'completado' ? evento.campos ?? {} : {}),
        estado_recursos: { ...contenido.estado_recursos, [evento.recurso]: evento.estado },
      },
    };
  }
  const estados = { ...contenido.estado_recursos };
  for (const [recurso, verificacion] of Object.entries(evento.verificacion) as [RecursoId, EstadoRecurso['verificacion']][]) {
    const actual = estados[recurso];
    if (actual && verificacion) estados[recurso] = { ...actual, verificacion };
  }
  return {
    ...paquete,
    contenido_adaptado: { ...contenido, estado_recursos: estados },
    evaluacion_calidad: {
      ...paquete.evaluacion_calidad,
      auditoria_ejecutada: evento.auditoria_ejecutada,
      anclaje_fuente_score: evento.auditoria_ejecutada ? evento.anclaje_fuente_score : null,
    },
  };
}

export function estadoDe(paquete: AdaptedContentPackage, recurso: RecursoId): EstadoRecurso | undefined {
  return paquete.contenido_adaptado.estado_recursos?.[recurso] ?? undefined;
}

/** Estaciones cuyo recurso principal ya terminó (completado o fallido): no hay que seguir esperando. */
export function estacionesResueltas(paquete: AdaptedContentPackage): number[] {
  return RECURSO_POR_ESTACION.flatMap((recurso, i) => (estadoDe(paquete, recurso) ? [i] : []));
}

const DATOS_DE_ESTACION: readonly ((c: AdaptedContentPackage['contenido_adaptado']) => unknown)[] = [
  (c) => c.resumen_ninja,
  (c) => c.flashcards,
  (c) => c.tutorial,
  (c) => c.director_cut,
  (c) => c.quiz,
];

const tieneDatos = (valor: unknown): boolean =>
  Array.isArray(valor) ? valor.length > 0 : valor !== null && valor !== undefined;

/**
 * ¿Se puede mostrar la estación? Requiere datos reales; si el backend informó el estado
 * del recurso (modo paralelo), además debe estar completado.
 */
export function estacionDisponible(paquete: AdaptedContentPackage, estacion: number): boolean {
  const estado = estadoDe(paquete, RECURSO_POR_ESTACION[estacion]);
  if (estado && estado.estado !== 'completado') return false;
  return tieneDatos(DATOS_DE_ESTACION[estacion]?.(paquete.contenido_adaptado));
}
