/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 06: Clímax Audiovisual y Agradecimiento Institucional de NuevaMente
 * Estética: Resplandor Heroico, Convergencia de Anillos y Cierre Conmovedor
 * Duración: 180 fotogramas (6.00 segundos a 30 fps, de 39.00s a 45.00s del vídeo)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import styles from './Escena06ClimaxAgradecimiento.module.css';

export const Escena06ClimaxAgradecimiento: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 20 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Convergencia de anillos hacia el centro (fotogramas 0 a 70)
  const ringsConvergence = interpolate(frame, [0, 70], [1.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Rotación continua de los anillos HUD perimetrales
  const ringRot1 = frame * 1.5;
  const ringRot2 = -frame * 0.9;

  // Pulso heroico en el pico musical (alrededor del frame 65-85)
  const heroPulse = interpolate(frame, [65, 75, 95], [1, 1.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Resplandor final de salida preparando la pantalla de finalización (fotogramas 160 a 180)
  const finalBloom = interpolate(frame, [160, 180], [0, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      className={styles.contenedor}
      style={{
        opacity: escenaFadeIn,
        filter: finalBloom > 0 ? `brightness(${1 + finalBloom})` : 'none',
      }}
    >
      {/* Fondo espacial con flares cyan/violeta/magenta */}
      <div className={styles.fondoFlares} />
      <div className={styles.scanlines} />

      {/* Escenario Central */}
      <div className={styles.heroStage}>
        {/* Anillos concéntricos convergentes */}
        <svg
          viewBox="-300 -300 600 600"
          className={styles.ringsOverlay}
          style={{
            transform: `scale(${ringsConvergence})`,
          }}
        >
          {/* Anillo 1 (Exterior cian) */}
          <circle
            cx="0"
            cy="0"
            r="230"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.6"
            strokeDasharray="20 12 60 16"
            opacity="0.65"
            transform={`rotate(${ringRot1})`}
          />
          {/* Anillo 2 (Intermedio violeta/magenta) */}
          <circle
            cx="0"
            cy="0"
            r="190"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="2"
            strokeDasharray="40 16 10 16"
            opacity="0.55"
            transform={`rotate(${ringRot2})`}
          />
          {/* Anillo 3 (Interior tenue) */}
          <circle
            cx="0"
            cy="0"
            r="150"
            fill="none"
            stroke="#ec4899"
            strokeWidth="1"
            strokeDasharray="6 6"
            opacity="0.45"
          />
        </svg>

        {/* Isotipo Heroico con Resplandor Central */}
        <div
          className={styles.logoGlowWrapper}
          style={{
            transform: `scale(${heroPulse})`,
          }}
        >
          <div
            className={styles.auraRing}
            style={{
              width: '180px',
              height: '180px',
              boxShadow: '0 0 50px rgba(56, 189, 248, 0.5)',
            }}
          />
          <img
            src="/IsotipoMonocromo.svg"
            alt="NuevaMente"
            className={styles.heroLogo}
          />
        </div>

        {/* Título de Marca y Lema */}
        <h1 className={styles.brandHeroTitle}>NUEVAMENTE</h1>
        <div className={styles.brandSlogan}>
          ADAPTACIÓN & ACELERACIÓN PEDAGÓGICA INTELIGENTE
        </div>

        {/* Cuadro de Agradecimiento Institucional */}
        <div
          className={styles.institucionalBox}
          style={{
            opacity: interpolate(frame, [30, 55], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(frame, [30, 55], [15, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })}px)`,
          }}
        >
          <div className={styles.institucionalTag}>AGRADECIMIENTO INSTITUCIONAL</div>
          <div className={styles.institucionalName}>
            Oracle Next Education (ONE G10) · Alura Latam · No-Country
          </div>
          <p className={styles.institucionalDesc}>
            Por impulsar la formación tecnológica de impacto en Latinoamérica, inspirar la innovación
            en la nube con OCI y desafiarnos a crear soluciones educativas con procedencia honesta y
            cero alucinaciones.
          </p>
        </div>
      </div>
    </div>
  );
};
