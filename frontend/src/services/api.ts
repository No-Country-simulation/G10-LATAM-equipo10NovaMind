/**
 * Servicio de Comunicación con FastAPI & Resiliencia Offline — NovaMind
 * Conecta con el orquestador multi-agente LangGraph o conmuta al Modo Demo si el backend está apagado.
 */

import type {
  AdaptedContentPackage,
  RecipientProfile,
  OutputFormat,
  IndustryNiche,
  DetailLevel,
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

export interface AdaptarParams {
  docTitle: string;
  docContent: string;
  profile: RecipientProfile;
  format: OutputFormat;
  niche: IndustryNiche;
  detail: DetailLevel;
  selectedScenarioId?: string;
  pdfBase64?: string | null;
  rawFile?: File | null;
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
  const { docTitle, docContent, profile, format, niche, detail, selectedScenarioId, rawFile } = params;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  // 1. Intentar comunicación con el Backend FastAPI vía SSE Streaming
  try {
    onProgress?.('Iniciando conexión con el orquestador de NovaMind...', undefined, 0);

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
            let evento: any;
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
        `Error al procesar "${docTitle || 'documento'}" con el orquestador real: ${mensaje}`
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

  onProgress?.('⚡ [1/5] Generando Estación 1: Resumen Ninja (TL;DR)...', undefined, 0);
  await new Promise((r) => setTimeout(r, 600));

  onProgress?.('📇 [2/5] Generando Estación 2: Flashcards 3D...', undefined, 1);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🛠️ [3/5] Generando Estación 3: Tutorial Quest (Laboratorio CLI)...', undefined, 2);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🎬 [4/5] Generando Estación 4: Director Cut (Storyboard)...', undefined, 3);
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('📝 [5/5] Generando Estación 5: The Final Trial (Quiz con Escudos)...', undefined, 4);
  await new Promise((r) => setTimeout(r, 800));

  onProgress?.('🛡️ [6/6] Auditoría de Anclaje RAG & Persistencia OCI...', undefined, 4);
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
  } catch {
    // cuerpo no JSON
  }
  return `Error HTTP ${response.status}`;
}

/**
 * Convierte el guion (VideoJobSpec) en video narrado. Solo se llama al pulsar
 * "Generar narración": la voz gasta cuota de Gemini y no se produce por adelantado.
 */
export async function solicitarNarracion(
  spec: VideoJobSpec,
  voz: VozNarracion = 'Kore',
): Promise<RespuestaNarracion> {
  const response = await fetch(`${BASE_URL}/api/v1/narracion/generar`, {
    method: 'POST',
    headers: { ...(await bearerHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_job_spec: spec, voz }),
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
