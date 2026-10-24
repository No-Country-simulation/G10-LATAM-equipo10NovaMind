/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Composición Principal de Remotion: Vídeo de Créditos Cinematográficos de NuevaMente
 * Edición Sincronizada de 3 Actos (22.0s / 660 fotogramas a 30 fps)
 * Acto 1 (0 a 7s): Apertura 8-Bit & Boot Terminal
 * Acto 2 (7 a 15s): Créditos de Contribuidores en Igualdad de Importancia
 * Acto 3 (15 a 22s): Código QR de la plataforma y Agradecimiento a OCI y ALURA LATAM
 */

import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, interpolate } from 'remotion';
import { Escena01Apertura8Bit } from './Escena01Apertura8Bit';
import { Escena02CreditosIgualdad } from './Escena02CreditosIgualdad';
import { Escena03AgradecimientoQR } from './Escena03AgradecimientoQR';
import { CREDITOS_CONFIG } from './config';
export { CREDITOS_CONFIG } from './config';

/**
 * Componente ejecutable del vídeo: monta las 3 secuencias sincronizadas con la música.
 * Total: 660 fotogramas (22.00 segundos a 30 fps).
 * Banda sonora: Midnight High Score sincronizada con el beat drop en el segundo 7 y fade-out al cierre.
 */
export const CreditosVideo: React.FC = () => {
  const f01 = 0;
  const f02 = CREDITOS_CONFIG.escena01Frames; // 210 (7.0s)
  const f03 = f02 + CREDITOS_CONFIG.escena02Frames; // 450 (15.0s)

  return (
    <AbsoluteFill style={{ backgroundColor: '#07090e' }}>
      {/* Banda Sonora Sincronizada con fade-out en los últimos 45 fotogramas (1.5s) */}
      <Sequence
        from={0}
        durationInFrames={CREDITOS_CONFIG.faseActualFrames}
        name="Banda Sonora - Midnight High Score"
      >
        <Audio
          src="/Midnight_High_Score.mp3"
          volume={(f) =>
            interpolate(
              f,
              [CREDITOS_CONFIG.faseActualFrames - 45, CREDITOS_CONFIG.faseActualFrames],
              [1, 0],
              {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              },
            )
          }
        />
      </Sequence>

      {/* Escena 01: Apertura 8-Bit & Boot Terminal (0 a 7s / 210f) */}
      <Sequence
        from={f01}
        durationInFrames={CREDITOS_CONFIG.escena01Frames}
        name="Escena 01 - Apertura 8-Bit"
      >
        <Escena01Apertura8Bit />
      </Sequence>

      {/* Escena 02: Créditos de Contribuidores en Igualdad (7 a 15s / 240f) */}
      <Sequence
        from={f02}
        durationInFrames={CREDITOS_CONFIG.escena02Frames}
        name="Escena 02 - Contribuidores en Igualdad"
      >
        <Escena02CreditosIgualdad />
      </Sequence>

      {/* Escena 03: Código QR & Agradecimiento OCI y ALURA LATAM (15 a 22s / 210f) */}
      <Sequence
        from={f03}
        durationInFrames={CREDITOS_CONFIG.escena03Frames}
        name="Escena 03 - QR Demo & Agradecimiento OCI y Alura"
      >
        <Escena03AgradecimientoQR />
      </Sequence>
    </AbsoluteFill>
  );
};

/**
 * Registro de composición Remotion (compatible con Remotion Root y Remotion Player).
 */
export const CreditosRoot: React.FC = () => {
  return (
    <Composition
      id="CreditosNuevaMente"
      component={CreditosVideo}
      durationInFrames={CREDITOS_CONFIG.faseActualFrames}
      fps={CREDITOS_CONFIG.fps}
      width={CREDITOS_CONFIG.width}
      height={CREDITOS_CONFIG.height}
    />
  );
};
