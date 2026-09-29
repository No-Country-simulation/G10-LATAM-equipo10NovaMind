import type {
  ConfigOpciones,
  AdaptarPayload,
  RespuestaAdaptacion,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Mock canónico basado en la especificación oficial de NuevaMente
export const MOCK_RESPUESTA_ADAPTACION: RespuestaAdaptacion = {
  status: 'exito',
  metadatos: {
    perfil_aplicado: 'Principiante',
    formato_generado: 'Flashcards',
    tiempo_estimado_estudio_minutos: 5,
    conceptos_clave: ['VCN', 'Subredes', 'Internet Gateway', 'Security Lists'],
  },
  contenido_adaptado: {
    titulo: 'Dominando Redes en la Nube (VCN) desde Cero',
    introduccion_contextualizada:
      'Imagina la VCN como tu propio barrio privado y seguro dentro de la nube de Oracle, donde tú decides quién entra y quién sale.',
    items: [
      {
        frente: '¿Qué es una VCN en Oracle Cloud?',
        dorso:
          'Es tu red virtual privada y personalizada dentro de la nube de Oracle, funcionando como la infraestructura de red de tu empresa.',
        pista_didactica:
          'Piensa en ella como el terreno cercado donde residen tus servidores.',
      },
      {
        frente: '¿Para qué sirven las Security Lists (Listas de Seguridad)?',
        dorso:
          'Son como guardias virtuales con listas de reglas que definen exactamente qué tipo de tráfico de datos puede entrar o salir de tu red.',
        pista_didactica: 'Reglas de entrada (ingress) y reglas de salida (egress).',
      },
    ],
  },
  evaluacion_calidad: {
    anclaje_fuente_score: 0.98,
    claridad_pedagogica: 'Alta',
    observaciones:
      'Lenguaje ajustado con analogías para público principiante, sin tecnicismos excesivos.',
  },
  almacenamiento_oci: {
    bucket: 'nuevamente-contenidos-educativos',
    objeto_id: 'contenido-vcn-principiante-flashcards-001.json',
    status_upload: 'completado',
  },
};

/**
 * Obtiene las opciones canónicas para los formularios
 */
export async function fetchOpcionesConfig(): Promise<ConfigOpciones> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/config/opciones`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // Respaldo canónico según backend/app/main.py
    return {
      perfiles_destinatario: [
        'Principiante / Transición de Carrera',
        'Desarrollador Junior / Semi Senior',
        'Líder Técnico / Arquitecto',
        'Gestor / Ejecutivo (No Técnico)',
      ],
      formatos_salida: [
        'Flashcards',
        'Quiz Interactivo con Justificaciones',
        'Guía Práctica Paso a Paso (Tutorial)',
        'Resumen Ejecutivo (TL;DR)',
        'Guion de Clase / Video',
      ],
      nichos_sector: ['General', 'Fintech', 'Salud', 'E-commerce'],
      niveles_detalle: ['Didáctico', 'Intermedio', 'Profundo'],
    };
  }
}

/**
 * Envía la solicitud de adaptación pedagógica a FastAPI (multipart/form-data)
 */
export async function enviarAdaptacion(
  payload: AdaptarPayload,
  useMock = false
): Promise<RespuestaAdaptacion> {
  if (useMock) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return MOCK_RESPUESTA_ADAPTACION;
  }

  const formData = new FormData();

  if (payload.archivo) {
    formData.append('archivo', payload.archivo);
  } else if (payload.texto_directo) {
    formData.append('texto_directo', payload.texto_directo);
  }

  if (payload.titulo) formData.append('titulo', payload.titulo);
  formData.append('perfil_destinatario', payload.perfil_destinatario);
  formData.append('formato_salida', payload.formato_salida);
  if (payload.nicho_sector) formData.append('nicho_sector', payload.nicho_sector);
  if (payload.nivel_detalle) formData.append('nivel_detalle', payload.nivel_detalle);
  if (payload.tema_consulta) formData.append('tema_consulta', payload.tema_consulta);

  const res = await fetch(`${BASE_URL}/api/v1/adaptar`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Error en la solicitud: ${res.status}`);
  }

  return await res.json();
}