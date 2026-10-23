/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 04: Arquitectura de Nube OCI e Infraestructura Técnica de NuevaMente
 * Estética: Blueprint HUD Cinemático, Capas de Infraestructura y Flujo de Datos
 * Duración: 300 fotogramas (10.00 segundos a 30 fps, de 18.00s a 28.00s del vídeo)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import styles from './Escena04ArquitecturaNube.module.css';

interface ArchLayer {
  id: string;
  badge: string;
  protocolo: string;
  titulo: string;
  color: string;
  techs: string[];
  revealFrame: number;
}

const CAPAS_ARQUITECTURA: ArchLayer[] = [
  {
    id: 'layer-cliente',
    badge: 'Capa 01 · Cliente & Edge',
    protocolo: 'SSE STREAMING // ZERO-GPU',
    titulo: 'Frontend React 19 + Remotion Player',
    color: '#38bdf8', // Cian
    techs: [
      'React 19',
      'TypeScript 6',
      'Vite',
      'Remotion Player (Renderizado en cliente)',
      '5 Estaciones Gamificadas',
    ],
    revealFrame: 15,
  },
  {
    id: 'layer-orquestacion',
    badge: 'Capa 02 · Orquestación & Verificación',
    protocolo: 'ASYNC FASTAPI // CITATION VALIDATION',
    titulo: 'Motor Multiagente & Verificador de Citas',
    color: '#a78bfa', // Violeta
    techs: [
      'FastAPI (Python 3.12)',
      'LangGraph Multiagente',
      'Pydantic v2',
      'Búsqueda literal de fuentes (Python)',
      'Heartbeats SSE (15s)',
    ],
    revealFrame: 55,
  },
  {
    id: 'layer-modelos',
    badge: 'Capa 03 · Modelos & Inferencia RAG',
    protocolo: '3 MODOS EN CASCADA // ZERO-COST',
    titulo: 'RAG Inteligente: Paralelo, Cadena & Clásico',
    color: '#ec4899', // Magenta
    techs: [
      'Google Gemini (Paralelo / Contexto completo)',
      'Cohere Embeddings API',
      'ChromaDB Vectorial HNSW',
      'Groq (Auditoría de fidelidad)',
    ],
    revealFrame: 95,
  },
  {
    id: 'layer-infraestructura',
    badge: 'Capa 04 · Infraestructura & Nube OCI',
    protocolo: 'ORACLE CLOUD ALWAYS FREE // 0.00$ TOTAL',
    titulo: 'OCI Compute VM & Almacenamiento Seguro',
    color: '#34d399', // Esmeralda
    techs: [
      'OCI Compute VM Always Free (1 vCPU, 1 GB RAM)',
      'OCI Object Storage (Bucket privado por UUID)',
      'Supabase PostgreSQL (RLS)',
      'Semáforo de concurrencia en memoria',
    ],
    revealFrame: 135,
  },
];

export const Escena04ArquitecturaNube: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 20 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transición de salida hacia la Escena 05 (275 a 300 fotogramas)
  const escenaFadeOut = interpolate(frame, [275, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escenaOpacity = escenaFadeIn * escenaFadeOut;

  // Pulso de flujo de datos arquitectónico (a partir del frame 180)
  const dataFlowPulse = interpolate(frame, [180, 200, 230], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className={styles.contenedor} style={{ opacity: escenaOpacity }}>
      {/* Fondo isométrico cibernético y halo central */}
      <div className={styles.fondoGridIsometric} />
      <div className={styles.glowRadial} />

      {/* Cabecera HUD con telemetría técnica */}
      <header className={styles.headerHud}>
        <div className={styles.headerTitle}>
          <span>ARQUITECTURA DE NUBE & STACK TECNOLÓGICO</span>
          <span className={styles.subtituloTag}>OCI Always Free // Stack Verificado</span>
        </div>
        <div className={styles.telemetriaRight}>
          <span>COSTO NUBE: $0.00 (ALWAYS FREE)</span>
          <span>MEMORIA VM: 1 GB (OPTIMIZADA)</span>
          <span>GPU EN SERVIDOR: 0 (CLIENTE REMOTION)</span>
        </div>
      </header>

      {/* Escenario Principal: Capas Arquitectónicas + Widgets Laterales */}
      <div className={styles.stage}>
        {/* Columna Izquierda: 4 Capas del Stack Técnico */}
        <div className={styles.colLayers}>
          {CAPAS_ARQUITECTURA.map((capa) => {
            const layerEnter = interpolate(
              frame,
              [capa.revealFrame, capa.revealFrame + 25],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );

            if (layerEnter <= 0) return null;

            const smoothProgress = 0.5 - 0.5 * Math.cos(layerEnter * Math.PI);
            const translateX = (1 - smoothProgress) * -30;

            return (
              <div
                key={capa.id}
                className={styles.layerCard}
                style={{
                  transform: `translateX(${translateX}px)`,
                  opacity: smoothProgress,
                  borderColor: `${capa.color}44`,
                  boxShadow:
                    dataFlowPulse > 0.3
                      ? `0 0 25px ${capa.color}44`
                      : '0 4px 24px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div
                  className={styles.layerGlowBar}
                  style={{ backgroundColor: capa.color }}
                />

                <div className={styles.layerHeader}>
                  <span
                    className={styles.layerBadge}
                    style={{
                      backgroundColor: `${capa.color}22`,
                      color: capa.color,
                      border: `1px solid ${capa.color}55`,
                    }}
                  >
                    {capa.badge}
                  </span>
                  <span className={styles.layerProtocol}>{capa.protocolo}</span>
                </div>

                <h4 className={styles.layerTitle}>{capa.titulo}</h4>

                <div className={styles.layerTechRow}>
                  {capa.techs.map((tech, idx) => (
                    <span key={idx} className={styles.techPill}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Columna Derecha: 3 Widgets Técnicos de Telemetría Real */}
        <div className={styles.colWidgets}>
          <div
            className={styles.widgetCard}
            style={{
              borderColor: 'rgba(56, 189, 248, 0.4)',
              opacity: interpolate(frame, [30, 55], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div className={styles.widgetLabel}>Infraestructura Cloud</div>
            <div className={styles.widgetValue}>Oracle Cloud Infrastructure</div>
            <div className={styles.widgetDetail}>
              Despliegue en VM Compute Always Free (1 vCPU, 1 GB RAM) con persistencia privada
              en OCI Object Storage.
            </div>
          </div>

          <div
            className={styles.widgetCard}
            style={{
              borderColor: 'rgba(167, 139, 250, 0.4)',
              opacity: interpolate(frame, [65, 90], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div className={styles.widgetLabel}>Fidelidad RAG</div>
            <div className={styles.widgetValue}>Cero Alucinaciones</div>
            <div className={styles.widgetDetail}>
              Cada concepto, tarjeta y pregunta cuenta con verificación literal contra el documento
              fuente y cálculo de página real en Python.
            </div>
          </div>

          <div
            className={styles.widgetCard}
            style={{
              borderColor: 'rgba(52, 211, 153, 0.4)',
              opacity: interpolate(frame, [100, 125], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div className={styles.widgetLabel}>Motor Audiovisual</div>
            <div className={styles.widgetValue}>Remotion Client-Side</div>
            <div className={styles.widgetDetail}>
              El navegador renderiza las microclases y créditos cinematográficos dinámicamente,
              eliminando el renderizado de video pesado en el servidor.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
