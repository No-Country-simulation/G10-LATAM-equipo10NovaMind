/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 03: Código QR de la plataforma y Agradecimiento a OCI y ALURA LATAM
 * Cierre audiovisual con demostración en vivo y reconocimiento institucional
 * Duración: 210 fotogramas (7.00 segundos a 30 fps, de 15.00s a 22.00s)
 */

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import styles from './Escena03AgradecimientoQR.module.css';

export const Escena03AgradecimientoQR: React.FC = () => {
  const frame = useCurrentFrame();

  // Transición de entrada general (0 a 20 fotogramas)
  const escenaFadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animación suave de entrada de la tarjeta QR (fotogramas 15 a 35)
  const qrOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const qrScale = interpolate(frame, [15, 35], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Entrada de la tarjeta de agradecimiento (fotogramas 25 a 45)
  const gratitudeOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const gratitudeY = interpolate(frame, [25, 45], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulso sutil del isotipo
  const logoPulse = interpolate(frame, [40, 75, 110], [1, 1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade-out suave al final de los 7 segundos (fotogramas 195 a 210)
  const escenaFadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const escenaOpacity = escenaFadeIn * escenaFadeOut;

  return (
    <div className={styles.contenedor} style={{ opacity: escenaOpacity }}>
      {/* Fondo espacial con flares cyan/violeta */}
      <div className={styles.fondoFlares} />
      <div className={styles.scanlines} />

      {/* Escenario Central */}
      <div className={styles.heroStage}>
        {/* Cabecera de Marca */}
        <div className={styles.brandHeader}>
          <div
            className={styles.logoGlowWrapper}
            style={{ transform: `scale(${logoPulse})` }}
          >
            <img
              src="/IsotipoMonocromo.svg"
              alt="NuevaMente Logo"
              className={styles.heroLogo}
            />
          </div>
          <h1 className={styles.brandHeroTitle}>NUEVAMENTE</h1>
          <div className={styles.brandSlogan}>
            ADAPTACIÓN &amp; ACELERACIÓN PEDAGÓGICA INTELIGENTE
          </div>
        </div>

        {/* Fila Central: QR de la app + Agradecimiento Destacado */}
        <div className={styles.centerRow}>
          {/* Tarjeta del Código QR Oficial */}
          <div
            className={styles.qrCard}
            style={{
              opacity: qrOpacity,
              transform: `scale(${qrScale})`,
            }}
          >
            <div className={styles.qrTag}>DEMO EN PRODUCCIÓN</div>
            <div className={styles.qrContainer}>
              <img
                src="/qr-novamind.svg"
                alt="Código QR de NuevaMente"
                className={styles.qrImage}
              />
            </div>
            <div className={styles.qrUrl}>novamind.techgk.cl</div>
          </div>

          {/* Tarjeta de Agradecimiento a OCI y ALURA LATAM */}
          <div
            className={styles.gratitudeCard}
            style={{
              opacity: gratitudeOpacity,
              transform: `translateY(${gratitudeY}px)`,
            }}
          >
            <div className={styles.gratitudeTag}>RECONOCIMIENTO INSTITUCIONAL</div>
            <h2 className={styles.gratitudeMainTitle}>
              ¡Muchas Gracias a OCI y ALURA LATAM!
            </h2>
            <p className={styles.gratitudeSubTitle}>
              Oracle Cloud Infrastructure · Oracle Next Education (ONE G10) · Alura Latam · No-Country
            </p>
            <p className={styles.gratitudeDesc}>
              Por inspirar este viaje de aceleración educativa, proporcionar la infraestructura
              Always Free en sa-santiago-1 y desafiar a los talentos de Latinoamérica a construir
              soluciones de inteligencia artificial pedagógica sin alucinaciones y con procedencia honesta.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
