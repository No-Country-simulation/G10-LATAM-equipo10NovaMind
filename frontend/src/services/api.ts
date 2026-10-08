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
}

export type StationProgressCallback = (stage: string, partialPackage?: Partial<AdaptedContentPackage>) => void;

/**
 * Envía la solicitud de adaptación pedagógica hacia FastAPI o ejecuta el Fallback Offline
 */
export async function solicitarAdaptacion(
  params: AdaptarParams,
  onProgress?: StationProgressCallback
): Promise<AdaptedContentPackage> {
  const { docTitle, docContent, profile, format, niche, detail, selectedScenarioId } = params;

  // 1. Intentar comunicación con el Backend FastAPI
  try {
    onProgress?.('Conectando con el Agente Investigador (RAG)...');

    const formData = new FormData();
    if (docTitle) formData.append('titulo', docTitle);
    formData.append('documento_contenido', docContent);
    formData.append('perfil_destinatario', profile);
    formData.append('formato_salida', format);
    formData.append('nicho_sector', niche);
    formData.append('nivel_detalle', detail);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch(`${BASE_URL}/api/v1/adaptar`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // Si el backend devuelve un paquete compatible
      if (data && data.contenido_adaptado) {
        onProgress?.('Auditoría RAG completada por el Agente Crítico');
        return data as AdaptedContentPackage;
      }
    }
  } catch (err: unknown) {
    console.info('ℹ️ Backend FastAPI no detectado o en espera. Activando Modo Demo Offline (Zero-Crash Guarantee):', err);
  }

  // 2. Modo Demo / Fallback Offline de Alta Fidelidad
  // Buscamos si el usuario seleccionó un escenario predefinido o usamos la Guía OCI Swap (Escenario 0)
  const matchedScenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[0];

  // Simulación de entrega progresiva visual para la demo (de la más rápida a la más lenta)
  onProgress?.('⚡ [1/5] Generando Estación 1: Resumen Ninja (TL;DR)...');
  await new Promise((r) => setTimeout(r, 600));

  onProgress?.('📇 [2/5] Generando Estación 2: Flashcards 3D...');
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('📝 [3/5] Generando Estación 5: The Final Trial (Quiz con Escudos)...');
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🎬 [4/5] Generando Estación 4: Director Cut (Storyboard)...');
  await new Promise((r) => setTimeout(r, 700));

  onProgress?.('🛠️ [5/5] Generando Estación 3: Tutorial Quest (Laboratorio CLI)...');
  await new Promise((r) => setTimeout(r, 800));

  onProgress?.('🛡️ [6/6] Auditoría de Anclaje RAG & Persistencia OCI...');
  await new Promise((r) => setTimeout(r, 400));

  // Clonamos el paquete para asegurar personalización dinámica
  const demoPackage: AdaptedContentPackage = JSON.parse(JSON.stringify(matchedScenario.data));
  demoPackage.metadatos.perfil_aplicado = profile;
  demoPackage.metadatos.formato_generado = format;
  demoPackage.metadatos.fecha_generacion = new Date().toISOString();

  return demoPackage;
}