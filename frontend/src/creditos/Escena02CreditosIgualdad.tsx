/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 02: Créditos de Contribuidores en Igualdad de Importancia
 * Presenta a los 9 miembros del Equipo 10 con la misma jerarquía visual y temporal
 * Duración: 240 fotogramas (8.00 segundos a 30 fps, de 7.00s a 15.00s)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { CONTRIBUIDORES_EQUIPO } from './config';
import styles from './Escena02CreditosIgualdad.module.css';

export const Escena02CreditosIgualdad: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 18 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transición de salida hacia la Escena 03 (220 a 240 fotogramas)
  const escenaFadeOut = interpolate(frame, [220, 240], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escenaOpacity = escenaFadeIn * escenaFadeOut;

  return (
    <div className={styles.contenedor} style={{ opacity: escenaOpacity }}>
      {/* Fondo espacial con scanlines holográficas */}
      <div className={styles.fondoGradiente} />
      <div className={styles.scanlines} />

      {/* Cabecera institucional */}
      <header className={styles.topHeader}>
        <div className={styles.tagline}>HACKATHON ONE G10 · ORACLE NEXT EDUCATION & ALURA LATAM</div>
        <h2 className={styles.mainTitle}>EQUIPO 10 · NUEVAMENTE</h2>
        <div className={styles.subTitle}>CONTRIBUIDORES DEL PROYECTO // EQUIPO MULTIDISCIPLINARIO</div>
      </header>

      {/* Escenario Central: Grid 3x3 de los 9 miembros */}
      <div className={styles.creditsStage}>
        <div className={styles.cardsGrid}>
          {CONTRIBUIDORES_EQUIPO.map((miembro, idx) => {
            const startCardFrame = idx * 3;
            const cardOpacity = interpolate(
              frame,
              [startCardFrame, startCardFrame + 12],
              [0, 1],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              },
            );

            const cardY = interpolate(
              frame,
              [startCardFrame, startCardFrame + 12],
              [16, 0],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              },
            );

            return (
              <div
                key={miembro.nombre}
                className={styles.creditCard}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  borderColor: `${miembro.color}40`,
                  boxShadow: `0 8px 28px ${miembro.color}15`,
                }}
              >
                <div
                  className={styles.creditAccentBar}
                  style={{
                    backgroundColor: miembro.color,
                    boxShadow: `0 0 10px ${miembro.color}`,
                  }}
                />

                <div>
                  <div className={styles.creditRole} style={{ color: miembro.color }}>
                    {miembro.rol}
                  </div>
                  <h3 className={styles.creditName}>{miembro.nombre}</h3>
                </div>

                <p className={styles.creditDetail}>{miembro.detalle}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
