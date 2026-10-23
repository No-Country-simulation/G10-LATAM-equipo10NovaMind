/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Composición Principal de Remotion: Vídeo de Créditos Cinematográficos de NuevaMente
 * Fase actual: Escena Piloto (0 a 3 segundos / 90 fotogramas a 30 fps)
 */

import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, interpolate } from 'remotion';
import { Escena01Apertura8Bit } from './Escena01Apertura8Bit';
import { Escena02TransformacionHolografica } from './Escena02TransformacionHolografica';
import { Escena03RedAgentes } from './Escena03RedAgentes';
import { Escena04ArquitecturaNube } from './Escena04ArquitecturaNube';
import { Escena05CreditosEquipo } from './Escena05CreditosEquipo';
import { Escena06ClimaxAgradecimiento } from './Escena06ClimaxAgradecimiento';
import { CREDITOS_CONFIG } from './config';
export { CREDITOS_CONFIG } from './config';

/**
 * Componente ejecutable del vídeo: monta las 6 secuencias narrativas completas.
 * Total: 1350 fotogramas (45.00 segundos a 30 fps).
 * Banda sonora: Midnight High Score sincronizada con fade-out al cierre.
 */
export const CreditosVideo: React.FC = () => {
  const f01 = 0;
  const f02 = CREDITOS_CONFIG.escena01Frames; // 90
  const f03 = f02 + CREDITOS_CONFIG.escena02Frames; // 240
  const f04 = f03 + CREDITOS_CONFIG.escena03Frames; // 540
  const f05 = f04 + CREDITOS_CONFIG.escena04Frames; // 840
  const f06 = f05 + CREDITOS_CONFIG.escena05Frames; // 1170

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

      {/* Escena 01: Apertura 8-Bit & Boot Terminal (0 a 3s / 90f) */}
      <Sequence
        from={f01}
        durationInFrames={CREDITOS_CONFIG.escena01Frames}
        name="Escena 01 - Apertura 8-Bit"
      >
        <Escena01Apertura8Bit />
      </Sequence>

      {/* Escena 02: Transformación a Núcleo Holográfico 3D (3 a 8s / 150f) */}
      <Sequence
        from={f02}
        durationInFrames={CREDITOS_CONFIG.escena02Frames}
        name="Escena 02 - Núcleo Holográfico"
      >
        <Escena02TransformacionHolografica />
      </Sequence>

      {/* Escena 03: Red de Agentes Pedagógicos (8 a 18s / 300f) */}
      <Sequence
        from={f03}
        durationInFrames={CREDITOS_CONFIG.escena03Frames}
        name="Escena 03 - Red de Agentes Pedagógicos"
      >
        <Escena03RedAgentes />
      </Sequence>

      {/* Escena 04: Arquitectura de Nube OCI & Stack Técnico (18 a 28s / 300f) */}
      <Sequence
        from={f04}
        durationInFrames={CREDITOS_CONFIG.escena04Frames}
        name="Escena 04 - Arquitectura OCI & Stack"
      >
        <Escena04ArquitecturaNube />
      </Sequence>

      {/* Escena 05: Créditos Cinematográficos del Equipo 10 (28 a 39s / 330f) */}
      <Sequence
        from={f05}
        durationInFrames={CREDITOS_CONFIG.escena05Frames}
        name="Escena 05 - Créditos del Equipo 10"
      >
        <Escena05CreditosEquipo />
      </Sequence>

      {/* Escena 06: Clímax Audiovisual & Agradecimiento Institucional (39 a 45s / 180f) */}
      <Sequence
        from={f06}
        durationInFrames={CREDITOS_CONFIG.escena06Frames}
        name="Escena 06 - Clímax & Agradecimiento"
      >
        <Escena06ClimaxAgradecimiento />
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
