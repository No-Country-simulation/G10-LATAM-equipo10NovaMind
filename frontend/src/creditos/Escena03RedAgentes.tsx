/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 03: Red de Agentes Pedagógicos de NuevaMente
 * Estética: Constelación de Agentes Conectados con HUD Cinemático y Flujo de Datos
 * Duración: 300 fotogramas (10.00 segundos a 30 fps, de 8.00s a 18.00s del vídeo)
 */

import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import styles from './Escena03RedAgentes.module.css';

interface AgentNode {
  id: string;
  num: string;
  titulo: string;
  subtitulo: string;
  metrica: string;
  color: string;
  x: number; // Coordenada X relativa al centro (en px)
  y: number; // Coordenada Y relativa al centro (en px)
  revealFrame: number;
}

const AGENTES: AgentNode[] = [
  {
    id: 'agente-ingesta',
    num: '01',
    titulo: 'Ingesta RAG Multiformato',
    subtitulo: 'PDF · Markdown · TXT · Imágenes escaneadas',
    metrica: 'Chunking adaptativo y streaming SSE',
    color: '#38bdf8', // Cian
    x: -360,
    y: -190,
    revealFrame: 15,
  },
  {
    id: 'agente-resumen',
    num: '02',
    titulo: 'Resumen Ninja & Estructura',
    subtitulo: 'Analogía conceptual y jerarquía de secciones',
    metrica: 'Diagrama Mermaid & fuentes verificadas',
    color: '#a78bfa', // Violeta
    x: 360,
    y: -190,
    revealFrame: 45,
  },
  {
    id: 'agente-flashcards',
    num: '03',
    titulo: 'Flashcards Nemotécnicas',
    subtitulo: 'Repetición espaciada y pistas guiadas',
    metrica: 'Exportación a formato Anki CSV',
    color: '#fbbf24', // Ámbar
    x: 440,
    y: 80,
    revealFrame: 75,
  },
  {
    id: 'agente-tutorial',
    num: '04',
    titulo: 'Guía Tutorial Interactiva',
    subtitulo: 'Paso a paso con meta didáctica explícita',
    metrica: 'Comandos shell/SQL verificados',
    color: '#34d399', // Esmeralda
    x: -440,
    y: 80,
    revealFrame: 105,
  },
  {
    id: 'agente-evaluador',
    num: '05',
    titulo: "Director's Cut & Cuestionario",
    subtitulo: 'Microclase audiovisual y examen riguroso',
    metrica: 'Cero alucinaciones con cita y página',
    color: '#f43f5e', // Rosa / Carmín
    x: 0,
    y: 250,
    revealFrame: 135,
  },
];

export const Escena03RedAgentes: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 20 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transición de salida hacia la Escena 04 (275 a 300 fotogramas)
  const escenaFadeOut = interpolate(frame, [275, 300], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escenaOpacity = escenaFadeIn * escenaFadeOut;

  // Pulso de sincronización de red global a los 210 fotogramas
  const syncPulse = interpolate(frame, [205, 215, 235], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulso continuo del núcleo central (140 BPM)
  const coreScale = 1 + Math.sin(frame * 0.15) * 0.035 + syncPulse * 0.12;

  // Renderizado dinámico de rutas de conexión desde el núcleo a cada agente
  const lineasConexion = useMemo(() => {
    return AGENTES.map((agente) => {
      // Coordenadas relativas al SVG central (600, 360)
      const cx = 600;
      const cy = 360;
      const tx = cx + agente.x;
      const ty = cy + agente.y;

      // Curva Bezier con punto de control desplazado
      const mx = (cx + tx) / 2;
      const my = (cy + ty) / 2;
      const pathD = `M ${cx} ${cy} Q ${mx} ${my} ${tx} ${ty}`;

      return {
        id: agente.id,
        pathD,
        color: agente.color,
        tx,
        ty,
        revealFrame: agente.revealFrame,
      };
    });
  }, []);

  return (
    <div className={styles.contenedor} style={{ opacity: escenaOpacity }}>
      {/* Fondo espacial con rejilla cibernética y halo ambiental */}
      <div className={styles.fondoGrid} />
      <div
        className={styles.glowAmbient}
        style={{
          transform: `scale(${1 + syncPulse * 0.25})`,
          opacity: 0.8 + syncPulse * 0.4,
        }}
      />

      {/* Cabecera HUD con telemetría de orquestación multiagente */}
      <header className={styles.headerHud}>
        <div className={styles.headerTitle}>
          <span>RED DE AGENTES PEDAGÓGICOS</span>
          <span className={styles.subtituloTag}>Orquestación RAG // 5 Nodos</span>
        </div>
        <div className={styles.telemetriaRight}>
          <span>SINCRONIZACIÓN: {frame >= 210 ? '100% ACTIVA' : 'CALIBRANDO...'}</span>
          <span>CITAS TEXTUALES: VERIFICADAS</span>
          <span>ALUCINACIONES: 0.00%</span>
        </div>
      </header>

      {/* Escenario de Constelación */}
      <div className={styles.networkStage}>
        {/* Capa de trazados láser vectoriales y flujo de paquetes de datos */}
        <svg
          viewBox="0 0 1200 720"
          className={styles.svgLinesOverlay}
          preserveAspectRatio="none"
        >
          {/* Anillo de interconexión orbital perimetral */}
          <ellipse
            cx="600"
            cy="360"
            rx="460"
            ry="250"
            fill="none"
            stroke="rgba(56, 189, 248, 0.15)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
          />

          {lineasConexion.map((linea) => {
            const progress = interpolate(frame, [linea.revealFrame, linea.revealFrame + 25], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            if (progress <= 0) return null;

            // Animación de paquetes de datos que fluyen continuamente a lo largo de la línea
            const dashOffset = -frame * 3.5;

            return (
              <g key={linea.id}>
                {/* Línea base conectora */}
                <path
                  d={linea.pathD}
                  fill="none"
                  stroke={linea.color}
                  strokeWidth="1.5"
                  strokeOpacity={0.35 + syncPulse * 0.5}
                  strokeDasharray="400"
                  strokeDashoffset={400 * (1 - progress)}
                />
                {/* Paquete de pulsos activos */}
                <path
                  d={linea.pathD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeDasharray="16 70"
                  strokeDashoffset={dashOffset}
                  strokeOpacity={progress * 0.85}
                />
              </g>
            );
          })}
        </svg>

        {/* Núcleo Central: Representación holográfica de NuevaMente */}
        <div
          className={styles.coreContainer}
          style={{
            transform: `scale(${coreScale})`,
          }}
        >
          <img
            src="/IsotipoMonocromo.svg"
            alt=""
            className={styles.coreIcon}
            aria-hidden="true"
          />
          <span className={styles.coreLabel}>NuevaMente</span>
          <span className={styles.coreSub}>NÚCLEO ORQUESTADOR</span>
        </div>

        {/* Cinco Nodos de Agentes Pedagógicos */}
        {AGENTES.map((agente) => {
          // Aparición con desvanecimiento y desplazamiento suave desde el centro
          const nodeEnter = interpolate(
            frame,
            [agente.revealFrame, agente.revealFrame + 24],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          if (nodeEnter <= 0) return null;

          const smoothProgress = 0.5 - 0.5 * Math.cos(nodeEnter * Math.PI);
          const currentX = agente.x * (0.8 + 0.2 * smoothProgress);
          const currentY = agente.y * (0.8 + 0.2 * smoothProgress);
          const cardScale = 0.85 + 0.15 * smoothProgress + (syncPulse > 0 ? syncPulse * 0.05 : 0);

          return (
            <div
              key={agente.id}
              className={styles.agentCard}
              style={{
                transform: `translate(${currentX}px, ${currentY}px) scale(${cardScale})`,
                opacity: smoothProgress,
                borderColor: syncPulse > 0.3 ? agente.color : `${agente.color}44`,
                boxShadow:
                  syncPulse > 0.3
                    ? `0 0 30px ${agente.color}66`
                    : '0 8px 32px rgba(0, 0, 0, 0.45)',
              }}
            >
              <div className={styles.agentHeader}>
                <span
                  className={styles.agentNumber}
                  style={{
                    backgroundColor: `${agente.color}22`,
                    color: agente.color,
                    border: `1px solid ${agente.color}55`,
                  }}
                >
                  ESTACIÓN {agente.num}
                </span>
                <span className={styles.agentBadge}>AGENTE ACTIVO</span>
              </div>

              <h4 className={styles.agentTitle}>{agente.titulo}</h4>
              <p className={styles.agentDesc}>{agente.subtitulo}</p>

              <div className={styles.agentFooter}>
                <div>
                  <span
                    className={styles.statusDot}
                    style={{ backgroundColor: agente.color }}
                  />
                  <span>{agente.metrica}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
