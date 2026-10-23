/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 05: Créditos Cinematográficos del Equipo 10 (G10 - NuevaMente)
 * Estética: Tipografía Cinematográfica, Glassmorphism y Transición Fluida
 * Duración: 330 fotogramas (11.00 segundos a 30 fps, de 28.00s a 39.00s del vídeo)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CREDITOS_EQUIPO_DATOS } from './config';
import styles from './Escena05CreditosEquipo.module.css';

export const Escena05CreditosEquipo: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 20 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transición de salida hacia la Escena 06 (305 a 330 fotogramas)
  const escenaFadeOut = interpolate(frame, [305, 330], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escenaOpacity = escenaFadeIn * escenaFadeOut;

  // Fase 1: Liderazgo y Arquitectura Principal (Frames 0 a 165)
  const fase1Opacity = interpolate(frame, [0, 20, 145, 165], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fase 2: Equipos de Ingeniería, QA y Colaboración Técnica (Frames 165 a 330)
  const fase2Opacity = interpolate(frame, [165, 185, 305, 325], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className={styles.contenedor} style={{ opacity: escenaOpacity }}>
      {/* Fondo espacial tenue con scanlines holográficas */}
      <div className={styles.fondoPolvo} />
      <div className={styles.scanlines} />

      {/* Cabecera superior institucional */}
      <header className={styles.topHeader}>
        <div className={styles.tagline}>HACKATHON ONE G10 · ORACLE & ALURA</div>
        <h2 className={styles.mainTitle}>CRÉDITOS DEL EQUIPO 10</h2>
      </header>

      {/* Escenario Central de Créditos */}
      <div className={styles.creditsStage}>
        {/* ==================================================================
            FASE 1: LIDERAZGO TÉCNICO, FACILITACIÓN Y PRODUCTO
           ================================================================== */}
        {fase1Opacity > 0 && (
          <div
            className={styles.cardsGrid}
            style={{
              opacity: fase1Opacity,
              transform: `translateY(${interpolate(frame, [0, 165], [10, -10])}px)`,
            }}
          >
            {CREDITOS_EQUIPO_DATOS.liderazgo.map((item, idx) => {
              const cardAccentColors = ['#38bdf8', '#a78bfa', '#ec4899'];
              const accent = cardAccentColors[idx % cardAccentColors.length];

              return (
                <div
                  key={idx}
                  className={styles.creditCard}
                  style={{
                    borderColor: `${accent}44`,
                    boxShadow: `0 8px 32px ${accent}15`,
                  }}
                >
                  <div
                    className={styles.creditAccentBar}
                    style={{ backgroundColor: accent }}
                  />

                  <div>
                    <div className={styles.creditRole} style={{ color: accent }}>
                      {item.rol}
                    </div>
                    <h3 className={styles.creditName}>{item.nombre}</h3>
                  </div>

                  <p className={styles.creditDetail}>{item.detalle}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================================================================
            FASE 2: INGENIERÍA BACKEND, QA, FRONTEND Y COLABORACIÓN
           ================================================================== */}
        {fase2Opacity > 0 && (
          <div
            className={styles.cardsGrid}
            style={{
              opacity: fase2Opacity,
              transform: `translateY(${interpolate(frame, [165, 330], [10, -10])}px)`,
            }}
          >
            {CREDITOS_EQUIPO_DATOS.desarrollo.map((item, idx) => {
              const cardAccentColors = ['#34d399', '#fbbf24', '#38bdf8'];
              const accent = cardAccentColors[idx % cardAccentColors.length];

              return (
                <div
                  key={idx}
                  className={styles.creditCard}
                  style={{
                    borderColor: `${accent}44`,
                    boxShadow: `0 8px 32px ${accent}15`,
                  }}
                >
                  <div
                    className={styles.creditAccentBar}
                    style={{ backgroundColor: accent }}
                  />

                  <div>
                    <div className={styles.creditRole} style={{ color: accent }}>
                      {item.rol}
                    </div>

                    <div className={styles.creditNamesList}>
                      {item.miembros.map((nombre, mIdx) => (
                        <div
                          key={mIdx}
                          style={{
                            fontFamily: "var(--font-heading, 'Syne', sans-serif)",
                            fontSize: item.miembros.length > 2 ? '1rem' : '1.1875rem',
                            fontWeight: 700,
                            color: '#ffffff',
                          }}
                        >
                          {nombre}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className={styles.creditDetail}>{item.detalle}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pie de escena de créditos */}
      <footer className={styles.footerBadge}>
        <span>PROYECTO NUEVAMENTE</span>
        <span>·</span>
        <span>NO-COUNTRY SIMULATION</span>
        <span>·</span>
        <span>EQUIPO 10 (G10 LATAM)</span>
      </footer>
    </div>
  );
};
