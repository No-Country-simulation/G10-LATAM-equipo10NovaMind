/**
 * Servicio de Comunicación con FastAPI & Resiliencia Offline — NuevaMente
 * Conecta con el orquestador multi-agente LangGraph o conmuta al Modo Demo si el backend está apagado.
 */

import type {
  AdaptedContentPackage,
  RecipientProfile,
  OutputFormat,
  IndustryNiche,
  DetailLevel,
  DocumentoExtraido,
  OrigenContenido,
  EscenaParaAmpliar,
  RespuestaAmpliacion,
  RespuestaNarracion,
  VideoJobSpec,
  VozNarracion,
} from '../types/types';
import { SCENARIOS } from '../data/mockScenarios';
import { bearerHeaders } from './supabase';
import {
  NOMBRE_RECURSO,
  aplicarEvento,
  esEventoGeneracion,
  motivoError,
  paqueteEnConstruccion,
} from '../utils/paqueteIncremental';
import type { EventoGeneracion } from '../utils/paqueteIncremental';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// paralelo: recursos publicados uno a uno (el backend conmuta solo a la cadena/clásico si falla)
const MODO_RAG = import.meta.env.VITE_MODO_RAG || 'paralelo';

function mensajeDeEvento(evento: EventoGeneracion): string {
  if (evento.tipo === 'auditoria') {
    return evento.auditoria_ejecutada
      ? '🛡️ Auditoría de fidelidad completada.'
      : '⚠️ La auditoría de fidelidad no se pudo ejecutar; el contenido queda sin auditar.';
  }
  const nombre = NOMBRE_RECURSO[evento.recurso] ?? evento.recurso;
  if (evento.estado.estado === 'fallido') return `⚠️ ${nombre}: no disponible (${motivoError(evento.estado.error_codigo)}).`;
  return evento.estado.reutilizado
    ? `♻️ ${nombre} recuperado de una generación anterior idéntica.`
    : `✅ ${nombre} listo · verificación pendiente.`;
}

/** Evento del flujo SSE de `/adaptar/stream`; los de generación se validan con `esEventoGeneracion`. */
interface EventoSSE {
  tipo?: string;
  mensaje?: string;
  estacion_desbloqueada?: unknown;
  datos?: unknown;
  detalle?: string;
}

export interface AdaptarParams {
  docTitle: string;
  docContent: string;
  profile: RecipientProfile;
  format: OutputFormat;
  niche: IndustryNiche;
  detail: DetailLevel;
  selectedScenarioId?: string;
  rawFile?: File | null;
  /** transcripcion_ia: docContent es la transcripción revisada de una imagen o un PDF escaneado */
  origenContenido?: OrigenContenido;
}

export type StationProgressCallback = (
  stage: string,
  /** Paquete acumulado hasta ahora (modo paralelo); los recursos aún no listos están ausentes */
  partialPackage?: AdaptedContentPackage,
  unlockedStationIndex?: number
) => void;

/**
 * Envía la solicitud de adaptación pedagógica hacia FastAPI vía SSE streaming o ejecuta el Fallback Offline
 */
export async function solicitarAdaptacion(
  params: AdaptarParams,
  onProgress?: StationProgressCallback
): Promise<AdaptedContentPackage> {
  const { docTitle, docContent, profile, format, niche, detail, selectedScenarioId, rawFile, origenContenido } = params;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  // 1. Intentar comunicación con el Backend FastAPI vía SSE Streaming
  try {
    onProgress?.('Iniciando conexión con el orquestador de NuevaMente...', undefined, 0);

    const formData = new FormData();
    if (docTitle) formData.append('titulo', docTitle);
    formData.append('perfil_destinatario', profile);
    formData.append('formato_salida', format);
    formData.append('nicho_sector', niche);
    formData.append('nivel_detalle', detail);
    formData.append('modo_rag', MODO_RAG);

    if (rawFile) {
      formData.append('archivo', rawFile, rawFile.name);
    } else {
      formData.append('documento_contenido', docContent);
      formData.append('texto_directo', docContent);
      if (origenContenido === 'transcripcion_ia') formData.append('origen_contenido', origenContenido);
    }

    const response = await fetch(`${BASE_URL}/api/v1/adaptar/stream`, {
      method: 'POST',
      headers: await bearerHeaders(),
      body: formData,
      signal: controller.signal,
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let resultadoPaquete: AdaptedContentPackage | null = null;
      let parcial = paqueteEnConstruccion(docTitle, profile, format);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // Ignorar heartbeats y líneas vacías

          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            let evento: EventoSSE;
            try {
              evento = JSON.parse(jsonStr);
            } catch {
              continue;
            }

            if (evento.tipo === 'inicio') {
              onProgress?.(evento.mensaje || 'Solicitud recibida. Iniciando orquestación...', undefined, 0);
            } else if (evento.tipo === 'progreso') {
              const stationIdx = typeof evento.estacion_desbloqueada === 'number' ? evento.estacion_desbloqueada : 0;
              onProgress?.(evento.mensaje || 'Procesando estación...', undefined, stationIdx);
            } else if (esEventoGeneracion(evento)) {
              // Modo paralelo: cada recurso se publica en cuanto supera las comprobaciones
              parcial = aplicarEvento(parcial, evento);
              onProgress?.(mensajeDeEvento(evento), parcial);
            } else if (evento.tipo === 'resultado' && evento.datos) {
              resultadoPaquete = evento.datos as AdaptedContentPackage;
            } else if (evento.tipo === 'error') {
              throw new Error(evento.detalle || 'Error durante la orquestación en el backend');
            }
          }
        }
      }

      if (resultadoPaquete && resultadoPaquete.contenido_adaptado) {
        onProgress?.('¡Adaptación pedagógica completa!', undefined, 4);
        return resultadoPaquete;
      }

      throw new Error('El flujo de streaming finalizó sin entregar el paquete adaptado.');
    } else if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `Error HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) errorMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
      } catch {
        // use default
      }
      throw new Error(`El backend rechazó la solicitud: ${errorMsg}`);
    }
  } catch (err: unknown) {
    console.error('Error al conectar con backend FastAPI:', err);
    const mensaje = err instanceof Error ? err.message : String(err);
    // Para cualquier documento real (Kafka, ENISA, Swap, etc.), nunca sustituir silenciosamente con el mock
    if (selectedScenarioId !== 'demo-offline-swap') {
      throw new Error(
        `Error al procesar "${docTitle || 'documento'}" con el orquestador real: ${mensaje}`,
        { cause: err },
      );
    }
    console.warn('Backend no disponible para demo offline explícita.');
  } finally {
    clearTimeout(timeoutId);
  }

  // 2. Modo Demo Offline únicamente si se solicitó explícitamente demo-offline-swap
  if (selectedScenarioId !== 'demo-offline-swap') {
    throw new Error('No se pudo completar la adaptación con el backend.');
  }

  const matchedScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  onProgress?.('⚡ [1/5] Demo sin conexión (ejemplo fijo) · Estación 1: Resumen...', undefined, 0);
  await new Promise((r) => setTimeout(r, 600));

  onProgress?.('📇 [2/5] Demo sin conexión · Estación 2: Tarjetas didácticas...', undefined, 1);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🛠️ [3/5] Demo sin conexión · Estación 3: Guía paso a paso...', undefined, 2);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🎬 [4/5] Demo sin conexión · Estación 4: Contenido AudioVisual...', undefined, 3);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('📝 [5/5] Demo sin conexión · Estación 5: Cuestionario...', undefined, 4);
  await new Promise((r) => setTimeout(r, 800));

  onProgress?.('🛡️ Demo sin conexión: sin auditoría ni guardado en OCI...', undefined, 4);
  await new Promise((r) => setTimeout(r, 400));

  const demoPackage: AdaptedContentPackage = JSON.parse(JSON.stringify(matchedScenario.data));
  demoPackage.metadatos.perfil_aplicado = profile;
  demoPackage.metadatos.formato_generado = format;
  demoPackage.metadatos.fecha_generacion = new Date().toISOString();

  return demoPackage;
}

async function detalleDeError(response: Response): Promise<string> {
  try {
    const cuerpo = await response.json();
    if (typeof cuerpo?.detail === 'string') return cuerpo.detail;
    // IngestionError lo responde el manejador global como {status, mensaje}
    if (typeof cuerpo?.mensaje === 'string') return cuerpo.mensaje;
  } catch {
    // cuerpo no JSON
  }
  return `Error HTTP ${response.status}`;
}

/**
 * Texto que se usará como fuente, para previsualizarlo antes de generar. Las imágenes y los
 * PDF escaneados vuelven transcritos por IA (origen 'transcripcion_ia'): una llamada a Gemini.
 */
export async function extraerDocumento(archivo: File): Promise<DocumentoExtraido> {
  const formData = new FormData();
  formData.append('archivo', archivo, archivo.name);
  const response = await fetch(`${BASE_URL}/api/v1/documentos/extraer`, {
    method: 'POST',
    headers: await bearerHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await detalleDeError(response));
  return response.json();
}

/** Texto de un documento de la biblioteca de ejemplos (el backend ya lo tiene: no se sube nada). */
export async function textoDocumentoEjemplo(nombreArchivo: string): Promise<DocumentoExtraido> {
  const response = await fetch(`${BASE_URL}/api/v1/documentos/ejemplos/${encodeURIComponent(nombreArchivo)}/texto`);
  if (!response.ok) throw new Error(await detalleDeError(response));
  return response.json();
}

/**
 * Convierte el guion (VideoJobSpec) en video narrado. Solo se llama al pulsar
 * "Generar narración": la voz gasta cuota de Gemini y no se produce por adelantado.
 */
/**
 * vozServidor=false: la voz la pone el navegador; el backend solo devuelve las diapositivas
 * con sus fotos (no gasta ElevenLabs ni Gemini TTS).
 */
export async function solicitarNarracion(
  spec: VideoJobSpec,
  voz: VozNarracion = 'Kore',
  { vozServidor = true }: { vozServidor?: boolean } = {},
): Promise<RespuestaNarracion> {
  const response = await fetch(`${BASE_URL}/api/v1/narracion/generar`, {
    method: 'POST',
    headers: { ...(await bearerHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_job_spec: spec, voz, voz_servidor: vozServidor }),
  });
  if (!response.ok) throw new Error(await detalleDeError(response));
  return response.json();
}

/** Ampliación de una escena con Gemini desde el servidor; el texto es de IA y no está verificado. */
export async function ampliarEscena(
  tipo: 'guion' | 'visual',
  escena: EscenaParaAmpliar,
): Promise<RespuestaAmpliacion> {
  const response = await fetch(`${BASE_URL}/api/v1/narracion/ampliar`, {
    method: 'POST',
    headers: { ...(await bearerHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, escena }),
  });
  if (!response.ok) throw new Error(await detalleDeError(response));
  return response.json();
}

const blobDeBase64 = (base64: string, mime: string) => {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * URLs reproducibles (blob:) por número de escena. Invitados: el audio viene en la
 * respuesta. Usuarios: se descarga con su sesión, porque el bucket es privado.
 * Quien las recibe debe liberarlas con URL.revokeObjectURL.
 */
export async function urlsDeAudio(respuesta: RespuestaNarracion): Promise<Record<number, string>> {
  const headers = await bearerHeaders();
  const pares = await Promise.all(
    respuesta.video_job_spec.escenas.map(async (escena) => {
      const mime = escena.audio?.mime_type || 'audio/wav';
      const enLinea = respuesta.audios_en_linea[String(escena.escena)];
      if (enLinea) return [escena.escena, blobDeBase64(enLinea, mime)] as const;
      const ruta = escena.audio?.ruta;
      if (!ruta) throw new Error(`La escena ${escena.escena} no tiene audio.`);
      const rutaUrl = ruta.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`${BASE_URL}/api/v1/narracion/archivo/${rutaUrl}`, { headers });
      if (!response.ok) throw new Error(await detalleDeError(response));
      return [escena.escena, await response.blob()] as const;
    }),
  );
  return Object.fromEntries(pares.map(([n, blob]) => [n, URL.createObjectURL(blob)]));
}
