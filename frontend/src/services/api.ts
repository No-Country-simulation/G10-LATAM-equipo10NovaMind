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
} from '../types/types';
import { SCENARIOS } from '../data/mockScenarios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  partialPackage?: Partial<AdaptedContentPackage>,
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

  const isCustomDocument = Boolean(
    rawFile || (!selectedScenarioId && docContent && docTitle !== 'Guía de OCI Swap y Optimización en Free Tier')
  );

  // 1. Intentar comunicación con el Backend FastAPI vía SSE Streaming
  try {
    onProgress?.('Iniciando conexión con el orquestador de NovaMind...', undefined, 0);

    const formData = new FormData();
    if (docTitle) formData.append('titulo', docTitle);
    formData.append('perfil_destinatario', profile);
    formData.append('formato_salida', format);
    formData.append('nicho_sector', niche);
    formData.append('nivel_detalle', detail);

    if (rawFile) {
      formData.append('archivo', rawFile, rawFile.name);
    } else {
      formData.append('documento_contenido', docContent);
      formData.append('texto_directo', docContent);
    }

    const controller = new AbortController();
    // 300s timeout para procesar documentos pesados (ej. reportes extensos)
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    const response = await fetch(`${BASE_URL}/api/v1/adaptar/stream`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let resultadoPaquete: AdaptedContentPackage | null = null;

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
            try {
              const evento = JSON.parse(jsonStr);
              if (evento.tipo === 'inicio') {
                onProgress?.(evento.mensaje || 'Solicitud recibida. Iniciando orquestación...', undefined, 0);
              } else if (evento.tipo === 'progreso') {
                const stationIdx = typeof evento.estacion_desbloqueada === 'number' ? evento.estacion_desbloqueada : 0;
                onProgress?.(evento.mensaje || 'Procesando estación...', undefined, stationIdx);
              } else if (evento.tipo === 'resultado' && evento.datos) {
                resultadoPaquete = evento.datos as AdaptedContentPackage;
              } else if (evento.tipo === 'error') {
                throw new Error(evento.detalle || 'Error durante la orquestación en el backend');
              }
            } catch (pErr) {
              if (pErr instanceof Error && pErr.message.includes('Error durante la orquestación')) {
                throw pErr;
              }
            }
          }
        }
      }

      if (resultadoPaquete && resultadoPaquete.contenido_adaptado) {
        onProgress?.('¡Adaptación pedagógica completa!', undefined, 4);
        return resultadoPaquete;
      }
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
    if (isCustomDocument) {
      // Para un documento real subido por el usuario, NUNCA engañar con un mock de OCI Swap.
      const mensaje = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No fue posible procesar tu documento "${docTitle || 'subido'}" con el orquestador real: ${mensaje}. Por favor verifica que el backend esté activo y que el documento sea legible.`
      );
    }
  }

  // 2. Modo Demo / Fallback Offline de Alta Fidelidad para escenarios predefinidos
  const matchedScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  // Simulación de entrega progresiva visual para la demo (de la más rápida a la más lenta)
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

  // Clonamos el paquete para asegurar personalización dinámica
  const demoPackage: AdaptedContentPackage = JSON.parse(JSON.stringify(matchedScenario.data));
  demoPackage.metadatos.perfil_aplicado = profile;
  demoPackage.metadatos.formato_generado = format;
  demoPackage.metadatos.fecha_generacion = new Date().toISOString();

  return demoPackage;
}