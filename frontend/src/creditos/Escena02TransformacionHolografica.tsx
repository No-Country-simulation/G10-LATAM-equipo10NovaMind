/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 02: Transformación 8-Bit a Núcleo Holográfico Tridimensional (Morphing Orgánico)
 * Estética: Demoscene 2000s evolucionando a Holograma Cinemático JARVIS (Iron Man)
 * Duración: 150 fotogramas (5.00 segundos a 30 fps, de 3.00s a 8.00s del vídeo)
 */

import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import rawPixelData from './isotipo8bitData.json';
import { ISOTIPO_PATHS, ISOTIPO_VIEWBOX } from './isotipoPaths';
import styles from './Escena02TransformacionHolografica.module.css';

type Pixel = [number, number, number, number, number];
const PIXELS = rawPixelData as Pixel[];

interface PixelNodeInfo {
  idx: number;
  px: number;
  py: number;
  r: number;
  g: number;
  b: number;
  isSpark: boolean;
  sparkGroup: number;
  origX: number;
  origY: number;
  zRibbon: number;
  driftAngle: number;
  driftDist: number;
}

export const Escena02TransformacionHolografica: React.FC = () => {
  const frame = useCurrentFrame();

  // ==========================================================================
  // 1. CLASIFICACIÓN DETERMINISTA: CORE (85%) vs CHISPAS PERIFÉRICAS (15%)
  // ==========================================================================
  const nodosPixel: PixelNodeInfo[] = useMemo(() => {
    const pixelSet = new Set(PIXELS.map(([x, y]) => `${x},${y}`));

    return PIXELS.map(([px, py, r, g, b], idx) => {
      // Detección de vecinos ortogonales para identificar el contorno externo
      const neighbors =
        (pixelSet.has(`${px - 1},${py}`) ? 1 : 0) +
        (pixelSet.has(`${px + 1},${py}`) ? 1 : 0) +
        (pixelSet.has(`${px},${py - 1}`) ? 1 : 0) +
        (pixelSet.has(`${px},${py + 1}`) ? 1 : 0);

      // Solo los píxeles más externos (<= 2 vecinos) se desprenden como chispas (36 píxeles = 15.4%)
      const isSpark = neighbors <= 2;
      const sparkGroup = isSpark ? idx % 3 : 0;

      // Coordenadas en caja de 500x500 alineadas exactamente con el SVG vectorial (1754/19 px en X, 1414/15 px en Y)
      const origX = 250 + (px - 15.5) * 22.0;
      const origY = 250 + (py - 15.5) * 22.4;

      // Geometría tridimensional de cinta de Möbius para el infinito:
      // El lóbulo izquierdo se curva hacia Z negativo/profundo, el lóbulo derecho hacia Z positivo/frontal,
      // y el cruce central separa los dos tramos en el eje Z.
      const nx = (px - 15.5) / 9.5; // -1 a +1
      const ny = (py - 15.5) / 7.5; // -1 a +1
      const zRibbon = Math.sin(nx * Math.PI) * 28 * (1 - Math.abs(ny) * 0.25) + Math.cos(ny * Math.PI) * 12;

      // Dirección radial con deflexión tangencial para desprendimiento suave
      const baseAngle = Math.atan2(origY - 250, origX - 250);
      const driftAngle = baseAngle + ((idx % 5) - 2) * 0.15;
      const driftDist = 48 + (idx % 7) * 14;

      return {
        idx,
        px,
        py,
        r,
        g,
        b,
        isSpark,
        sparkGroup,
        origX,
        origY,
        zRibbon,
        driftAngle,
        driftDist,
      };
    });
  }, []);

  // ==========================================================================
  // 2. CURVAS DETERMINISTAS DE TRANSICIÓN Y EXPANSION 3D
  // ==========================================================================
  // A. Relieve 3D de los píxeles Core (Frames 12 a 55)
  const zExpansionProgress = interpolate(frame, [12, 55], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const smoothZProgress = 0.5 - 0.5 * Math.cos(zExpansionProgress * Math.PI);

  // B. Redondeo y metamorfosis de mosaicos a nodos holográficos (Frames 15 a 45)
  const nodeMorphProgress = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // C. Revelado progresivo del vector oficial (Frames 35 a 70)
  const vectorRevealProgress = interpolate(frame, [35, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const smoothVectorReveal = 0.5 - 0.5 * Math.cos(vectorRevealProgress * Math.PI);

  // D. Atenuación de los nodos de píxel al consolidarse el vector (Frames 50 a 75)
  const corePixelsOpacity = interpolate(frame, [50, 75], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // E. Aparición gradual de los anillos HUD en el fondo (Frames 15 a 45)
  const anillosOpacity = interpolate(frame, [15, 45], [0, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ==========================================================================
  // 3. DINÁMICA GIMBAL 3D Y SINCRONIZACIÓN MUSICAL (140 BPM)
  // ==========================================================================
  // Rotación continua multi-eje (Yaw, Pitch, Roll)
  const rotY = Math.sin(frame * 0.035) * 18; // Inclinación horizontal (-18° a +18°)
  const rotX = Math.cos(frame * 0.025) * 11; // Inclinación vertical (+11° a -11°)
  const rotZ = Math.sin(frame * 0.018) * 4;

  // Pulso cardíaco musical a 140 BPM (cada 12.857 fotogramas a 30 fps)
  const framesPerBeat = 12.857;
  const beatPhase = (frame % framesPerBeat) / framesPerBeat;
  const beatKick = Math.exp(-beatPhase * 4.5) * 0.045; // Golpe con caída exponencial
  const breathing = Math.sin(frame * 0.05) * 0.02;
  const pulsoHolograma = 1 + breathing + (frame >= 80 ? beatKick : 0);

  // Barrido vertical del haz láser
  const laserY = interpolate(frame % 50, [0, 50], [-180, 180]);

  // Rotaciones independientes de los 3 anillos HUD concéntricos
  const ring1Rot = frame * 1.1; // Interior (rápido)
  const ring2Rot = -frame * 0.65; // Intermedio (antihorario)
  const ring3Rot = frame * 0.4; // Exterior (perimetral lento)

  return (
    <div className={styles.contenedor}>
      {/* Fondo espacial con rejilla y scanlines */}
      <div className={styles.fondoHolografico} />
      <div className={styles.scanlinesOverlay} />

      {/* Escenario 3D Central */}
      <div className={styles.escenario3D}>
        <div
          className={styles.gimbal3D}
          style={{
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${pulsoHolograma})`,
          }}
        >
          {/* ------------------------------------------------------------------
              1. ANILLOS HUD CONCÉNTRICOS EN EL FONDO (Z = -55px)
              Aparecen gradualmente detrás del isotipo desde frame 15
             ------------------------------------------------------------------ */}
          {anillosOpacity > 0 && (
            <div
              className={styles.hudRingsContainer}
              style={{
                opacity: anillosOpacity,
                transform: 'translateZ(-55px)',
              }}
            >
              {/* Anillo 1 (Interior, radio 270px, ortogonal 3D rotateY(45deg)) */}
              <svg
                viewBox="-400 -400 800 800"
                className={styles.ringSvg}
                style={{
                  transform: `rotateY(45deg) rotateX(20deg) rotateZ(${ring1Rot}deg)`,
                }}
              >
                <circle
                  cx="0"
                  cy="0"
                  r="270"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.6"
                  strokeDasharray="14 10 36 8 70 14"
                  opacity="0.85"
                  filter="drop-shadow(0 0 6px #22d3ee)"
                />
                {[0, 90, 180, 270].map((deg) => (
                  <line
                    key={deg}
                    x1="260"
                    y1="0"
                    x2="280"
                    y2="0"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    transform={`rotate(${deg})`}
                  />
                ))}
              </svg>

              {/* Anillo 2 (Intermedio, radio 350px, inclinado rotateX(36deg)) */}
              <svg
                viewBox="-400 -400 800 800"
                className={styles.ringSvg}
                style={{
                  transform: `rotateX(36deg) rotateY(12deg) rotateZ(${ring2Rot}deg)`,
                }}
              >
                <circle
                  cx="0"
                  cy="0"
                  r="350"
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="2"
                  strokeDasharray="50 18 12 12 28 14"
                  opacity="0.75"
                  filter="drop-shadow(0 0 8px #a78bfa)"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="335"
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="1"
                  strokeDasharray="6 6"
                  opacity="0.5"
                />
              </svg>

              {/* Anillo 3 (Exterior, radio 430px, perimetral calibrado) */}
              <svg
                viewBox="-500 -500 1000 1000"
                className={styles.ringSvg}
                style={{
                  transform: `rotateZ(${ring3Rot}deg)`,
                }}
              >
                <circle
                  cx="0"
                  cy="0"
                  r="430"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="100 35 180 50"
                  opacity="0.7"
                  filter="drop-shadow(0 0 8px #38bdf8)"
                />
                {Array.from({ length: 12 }).map((_, idx) => (
                  <rect
                    key={idx}
                    x="424"
                    y="-3"
                    width="12"
                    height="6"
                    fill="#38bdf8"
                    transform={`rotate(${idx * 30})`}
                    opacity="0.8"
                  />
                ))}
              </svg>
            </div>
          )}

          {/* ------------------------------------------------------------------
              2. NÚCLEO VECTORIAL OFICIAL (5 Capas Volumétricas en Z)
              Revelado suave a partir de frame 35, alcanzando 100% en frame 70
             ------------------------------------------------------------------ */}
          {smoothVectorReveal > 0 && (
            <div className={styles.vectorContainer} style={{ opacity: smoothVectorReveal }}>
              {/* Capa Z: -36px (Profundidad Trasera Violeta con aura difuminada) */}
              <div
                className={styles.capaVolumetrica}
                style={{
                  transform: 'translateZ(-36px)',
                  opacity: 0.45,
                  filter: 'blur(2px)',
                }}
              >
                <svg viewBox={ISOTIPO_VIEWBOX} className={styles.isotipoSvg}>
                  {ISOTIPO_PATHS.map((d, i) => (
                    <path
                      key={`z-back-${i}`}
                      d={d}
                      fill="none"
                      stroke="#6b21a8"
                      strokeWidth="32"
                      opacity="0.9"
                    />
                  ))}
                </svg>
              </div>

              {/* Capa Z: -18px (Intermedia Trasera Magenta) */}
              <div
                className={styles.capaVolumetrica}
                style={{
                  transform: 'translateZ(-18px)',
                  opacity: 0.65,
                }}
              >
                <svg viewBox={ISOTIPO_VIEWBOX} className={styles.isotipoSvg}>
                  {ISOTIPO_PATHS.map((d, i) => (
                    <path
                      key={`z-mid-back-${i}`}
                      d={d}
                      fill="none"
                      stroke="#d946ef"
                      strokeWidth="22"
                      opacity="0.8"
                      filter="drop-shadow(0 0 10px #d946ef)"
                    />
                  ))}
                </svg>
              </div>

              {/* Capa Z: 0px (Núcleo Central Vectorial con Degradado y Haz Láser) */}
              <div
                className={styles.capaVolumetrica}
                style={{
                  transform: 'translateZ(0px)',
                  opacity: 1,
                }}
              >
                <svg viewBox={ISOTIPO_VIEWBOX} className={styles.isotipoSvg}>
                  <defs>
                    <linearGradient id="holoGradientCore" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#f43f5e" />
                    </linearGradient>
                    <filter id="holoGlowCore" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="10" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {ISOTIPO_PATHS.map((d, i) => (
                    <path
                      key={`z-core-${i}`}
                      d={d}
                      fill="rgba(139, 92, 246, 0.08)"
                      stroke="url(#holoGradientCore)"
                      strokeWidth="24"
                      filter="url(#holoGlowCore)"
                      opacity="0.95"
                    />
                  ))}
                </svg>

                {/* Haz de escaneo láser sobre el plano central */}
                <div
                  className={styles.hazLaser}
                  style={{
                    transform: `translateY(${laserY}px)`,
                  }}
                />
              </div>

              {/* Capa Z: +18px (Intermedia Frontal Cian) */}
              <div
                className={styles.capaVolumetrica}
                style={{
                  transform: 'translateZ(18px)',
                  opacity: 0.85,
                }}
              >
                <svg viewBox={ISOTIPO_VIEWBOX} className={styles.isotipoSvg}>
                  {ISOTIPO_PATHS.map((d, i) => (
                    <path
                      key={`z-mid-front-${i}`}
                      d={d}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="14"
                      opacity="0.85"
                      filter="drop-shadow(0 0 8px #06b6d4)"
                    />
                  ))}
                </svg>
              </div>

              {/* Capa Z: +36px (Frontal Crystalline con Ticks de Alta Definición) */}
              <div
                className={styles.capaVolumetrica}
                style={{
                  transform: 'translateZ(36px)',
                  opacity: 0.95,
                  filter: 'drop-shadow(0 0 6px #ffffff)',
                }}
              >
                <svg viewBox={ISOTIPO_VIEWBOX} className={styles.isotipoSvg}>
                  {ISOTIPO_PATHS.map((d, i) => (
                    <path
                      key={`z-front-${i}`}
                      d={d}
                      fill="none"
                      stroke="#f0fdf4"
                      strokeWidth="6"
                      strokeDasharray="28 14"
                      opacity="0.9"
                    />
                  ))}
                </svg>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
              3. NÚCLEO DE PÍXELES EN MORPHING ORGÁNICO (Frames 0 a 75)
              - Core (85%): Mantiene la silueta del infinito intacta, se eleva en 3D
                (cinta de Möbius), redondea sus bordes y se funde con el vector.
              - Chispas (15%): Solo 36 píxeles periféricos se desprenden en 3 olas
                suaves hacia el halo exterior.
             ------------------------------------------------------------------ */}
          {frame < 80 && (
            <div className={styles.pixelContainer3D}>
              {nodosPixel.map((p) => {
                if (p.isSpark) {
                  // ---- CHISPAS PERIFÉRICAS ----
                  // Desprendimiento escalonado en 3 olas
                  const sparkStart = 8 + p.sparkGroup * 10;
                  const sparkEnd = sparkStart + 32;
                  const sparkProg = interpolate(frame, [sparkStart, sparkEnd], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  });

                  // Desaceleración cúbica controlada
                  const easeOut = 1 - Math.pow(1 - sparkProg, 3);
                  const currentX = p.origX + Math.cos(p.driftAngle) * p.driftDist * easeOut;
                  const currentY = p.origY + Math.sin(p.driftAngle) * p.driftDist * easeOut - easeOut * 16;
                  const currentZ = Math.sin((p.idx * 37.7 * Math.PI) / 180) * 32 * easeOut;

                  const opacity = sparkProg === 0 ? 1 : Math.max(0, 1 - easeOut * 0.85);
                  const size = sparkProg === 0 ? 14 : Math.max(3.5, 14 * (1 - easeOut * 0.72));

                  const bg =
                    sparkProg > 0.3
                      ? '#22d3ee'
                      : `rgb(${p.r}, ${p.g}, ${p.b})`;

                  return (
                    <div
                      key={`spark-${p.idx}`}
                      className={styles.sparkNode}
                      style={{
                        left: `${currentX}px`,
                        top: `${currentY}px`,
                        width: `${size}px`,
                        height: `${size}px`,
                        marginLeft: `${-size / 2}px`,
                        marginTop: `${-size / 2}px`,
                        transform: `translate3d(0, 0, ${currentZ}px)`,
                        backgroundColor: bg,
                        boxShadow: sparkProg > 0 ? '0 0 10px #22d3ee, 0 0 18px rgba(34, 211, 238, 0.7)' : 'none',
                        opacity,
                      }}
                    />
                  );
                }

                // ---- PÍXELES CORE (SILUETA DEL INFINITO 100% RECONOCIBLE) ----
                // Mantienen su posición X,Y intacta mientras adquieren profundidad Z
                const currentZ = p.zRibbon * smoothZProgress;
                const scaleZ = 1 + currentZ / 180;

                // Transición morfológica: mosaico cuadrado -> nodo redondeado holográfico
                const borderRadius = `${2 + nodeMorphProgress * 5}px`;
                const size = 14 - nodeMorphProgress * 3;

                // Color: transición de RGB 8-bit hacia gradiente de energía holográfico
                const bg =
                  nodeMorphProgress > 0.5
                    ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.95), rgba(217, 70, 239, 0.9))'
                    : `rgb(${p.r}, ${p.g}, ${p.b})`;

                const shadow =
                  nodeMorphProgress > 0.2
                    ? '0 0 8px rgba(34, 211, 238, 0.7), 0 0 14px rgba(217, 70, 239, 0.4)'
                    : 'none';

                return (
                  <div
                    key={`core-${p.idx}`}
                    className={styles.pixelNode}
                    style={{
                      left: `${p.origX}px`,
                      top: `${p.origY}px`,
                      width: `${size}px`,
                      height: `${size}px`,
                      marginLeft: `${-size / 2}px`,
                      marginTop: `${-size / 2}px`,
                      transform: `translate3d(0, 0, ${currentZ}px) scale(${scaleZ})`,
                      background: bg,
                      borderRadius,
                      boxShadow: shadow,
                      opacity: corePixelsOpacity,
                    }}
                  />
                );
              })}
            </div>
          )}

          {/* Retícula central táctica */}
          <div className={styles.reticulaCentro}>
            <div className={styles.reticulaEjeX} />
            <div className={styles.reticulaEjeY} />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------------
          INDICADORES DE TELEMETRÍA FLOTANTES ESTILO JARVIS
         ---------------------------------------------------------------------- */}
      <div className={styles.telemetriaHud}>
        {/* Fila Superior */}
        <div className={styles.hudFilaSuperior}>
          <div className={styles.hudTarjeta}>
            <div className={styles.hudHeaderTag}>
              <span className={styles.tagDot} />
              NÚCLEO VECTORIAL // ESTADO 3D
            </div>
            <div className={styles.hudDatoFila}>
              <span>CONVERGENCIA:</span>
              <span className={styles.hudDatoValor}>
                {frame < 35
                  ? 'EXPANDIENDO RELIEVE 3D [0%]'
                  : frame < 70
                  ? `CRISTALIZANDO [${Math.round(smoothVectorReveal * 100)}%]`
                  : '100% [VECTOR LOCK]'}
              </span>
            </div>
            <div className={styles.hudDatoFila}>
              <span>TOPOLOGÍA Z:</span>
              <span className={styles.hudDatoValor}>
                {smoothZProgress < 1
                  ? `MODULANDO (±${Math.round(smoothZProgress * 36)}mm)`
                  : '5 CAPAS EN PARALLAX (±36mm)'}
              </span>
            </div>
          </div>

          <div className={styles.hudTarjeta}>
            <div className={styles.hudHeaderTag}>
              <span className={styles.tagDot} />
              GIMBAL HUD // AUDIOLOCK
            </div>
            <div className={styles.hudDatoFila}>
              <span>YAW / PITCH:</span>
              <span className={styles.hudDatoValor}>
                {rotY > 0 ? `+${rotY.toFixed(1)}°` : `${rotY.toFixed(1)}°`} /{' '}
                {rotX > 0 ? `+${rotX.toFixed(1)}°` : `${rotX.toFixed(1)}°`}
              </span>
            </div>
            <div className={styles.hudDatoFila}>
              <span>AUDIO SYNC:</span>
              <span className={styles.hudStatusOk}>140 BPM [BEAT LOCKED]</span>
            </div>
          </div>
        </div>

        {/* Fila Inferior */}
        <div className={styles.hudFilaInferior}>
          <div className={styles.hudTarjeta}>
            <div className={styles.hudHeaderTag}>
              <span className={styles.tagDot} />
              TELEMETRÍA DE SILUETA
            </div>
            <div className={styles.hudDatoFila}>
              <span>PÍXELES CORE:</span>
              <span className={styles.hudDatoValor}>197 ACTIVOS [SILUETA INFINITO OK]</span>
            </div>
            <div className={styles.hudDatoFila}>
              <span>CHISPAS PERIFÉRICAS:</span>
              <span className={styles.hudDatoValor}>36 DESPRENDIDAS EN 3 OLAS</span>
            </div>
          </div>

          <div className={styles.hudTarjeta}>
            <div className={styles.hudHeaderTag}>
              <span className={styles.tagDot} />
              ESTADO DEL SISTEMA
            </div>
            <div className={styles.hudDatoFila}>
              <span>FASE:</span>
              <span className={styles.hudDatoValor}>
                {frame < 35
                  ? 'FASE 1: CONTINUIDAD & EXPANSION 3D'
                  : frame < 75
                  ? 'FASE 2: CRISTALIZACIÓN VECTORIAL'
                  : frame < 115
                  ? 'FASE 3: PARALLAX VOLUMÉTRICO'
                  : 'FASE 4: NÚCLEO ESTABLE LISTO'}
              </span>
            </div>
            <div className={styles.hudDatoFila}>
              <span>TIME / FOTOGRAMA:</span>
              <span className={styles.hudDatoValor}>
                F{String(frame + 90).padStart(4, '0')} (REL: F{String(frame).padStart(3, '0')}/150)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
