/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Escena 01: Apertura 8-Bit & Boot Terminal
 * Estética: Demoscene / Keygen de los 2000s con transición incipiente a HUD Holográfico
 * Duración: 90 fotogramas (3.00 segundos a 30 fps)
 */

import React, { useMemo } from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import rawPixelData from './isotipo8bitData.json';
import styles from './Escena01Apertura8Bit.module.css';

// Estructura de cada píxel: [x, y, r, g, b]
type Pixel = [number, number, number, number, number];
const PIXELS = rawPixelData as Pixel[];

export const Escena01Apertura8Bit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Efecto CRT Power-On (fotogramas 0 a 14)
  const crtScaleY = interpolate(frame, [0, 5, 12], [0.02, 0.08, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crtScaleX = interpolate(frame, [0, 5, 12], [0.8, 1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crtFlash = interpolate(frame, [0, 4, 14], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contenidoOpacity = interpolate(frame, [4, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 2. Líneas de Terminal progresivas (Efecto Typewriter determinista)
  const l1Total = 'NUEVAMENTE BIOS v2.0.0 (G10 LATAM)';
  const l2Prefijo = 'INITIALIZING NEURAL SUBSYSTEMS... ';
  const l3Prefijo = 'OCI OBJECT STORAGE INTERFACE... ';
  const l4Prefijo = 'LOADING CREDITS PROTOCOL... ';

  // Caracteres revelados por fotograma
  const l1Chars = Math.max(0, Math.min(l1Total.length, Math.floor((frame - 8) * 2.2)));
  const l2Chars = Math.max(0, Math.min(l2Prefijo.length, Math.floor((frame - 22) * 2.4)));
  const l2Ok = frame >= 36;
  const l3Chars = Math.max(0, Math.min(l3Prefijo.length, Math.floor((frame - 38) * 2.4)));
  const l3Ok = frame >= 50;
  const l4Chars = Math.max(0, Math.min(l4Prefijo.length, Math.floor((frame - 52) * 2.0)));
  const l4Ready = frame >= 66;

  // Cursor parpadeante (período 10 fotogramas)
  const cursorVisible = Math.floor(frame / 6) % 2 === 0;

  // 3. Barra de carga (0% a 100% entre fotogramas 20 y 72)
  const progresoPorcentaje = Math.round(
    interpolate(frame, [20, 72], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );

  // Segmentos ASCII para la barra de carga retro
  const totalSegmentos = 24;
  const segmentosLlenos = Math.round((progresoPorcentaje / 100) * totalSegmentos);
  const barraAscii = '█'.repeat(segmentosLlenos) + '░'.repeat(totalSegmentos - segmentosLlenos);

  // Contador de memoria hexadecimal determinista
  const hexVal = Math.min(
    0xffff,
    Math.floor(
      interpolate(frame, [20, 72], [0x1200, 0xffff], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  )
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');

  // 4. Barrido de píxeles del Isotipo (de arriba a abajo entre fotogramas 16 y 54)
  const sweepRow = interpolate(frame, [16, 54], [0, 32], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 5. Vibración, Glitch y Partículas (fotogramas 75 a 90)
  const glitchIntensity = interpolate(frame, [75, 89], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const jitterX = glitchIntensity > 0 ? Math.sin(frame * 19.3) * glitchIntensity * 8 : 0;
  const jitterY = glitchIntensity > 0 ? Math.cos(frame * 27.7) * glitchIntensity * 5 : 0;
  const chromaticAberration =
    glitchIntensity > 0
      ? `drop-shadow(${-4 * glitchIntensity}px 0 rgba(6, 182, 212, 0.8)) drop-shadow(${
          4 * glitchIntensity
        }px 0 rgba(217, 70, 239, 0.8))`
      : 'none';

  // Selección determinista de partículas desprendidas (índices múltiplos de 5)
  const particulasDesprendidas = useMemo(() => {
    return PIXELS.filter((_, idx) => idx % 5 === 0).map((pixel, i) => {
      // Ángulo y velocidad pseudo-aleatoria pero 100% determinista basada en el índice
      const angle = (i * 47.3 * Math.PI) / 180;
      const speed = 2.5 + (i % 7) * 1.2;
      return {
        pixel,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      };
    });
  }, []);

  return (
    <div
      className={styles.contenedor}
      style={{
        transform: `scaleX(${crtScaleX}) scaleY(${crtScaleY})`,
        opacity: contenidoOpacity,
        filter: crtFlash > 0 ? `brightness(${1 + crtFlash * 1.5})` : 'none',
      }}
    >
      {/* Rejilla y Scanlines de fósforo CRT */}
      <div className={styles.crtOverlay} />
      <div className={styles.gridFondo} />

      {/* Contenido principal en 2 columnas */}
      <div className={styles.layout}>
        {/* Columna Izquierda: Terminal y Telemetría */}
        <div className={styles.colTerminal}>
          <div className={styles.cabeceraDemoscene}>
            <div className={styles.subtituloBadge}>
              <span className={styles.badgeDot} />
              Demoscene Subsystem // 8-Bit Kernel
            </div>
            <h1 className={styles.tituloPrincipal}>
              Nueva<span className={styles.tituloHighlight}>Mente</span>
            </h1>
          </div>

          {/* Caja de la Terminal */}
          <div className={styles.terminalBox}>
            <div className={styles.terminalHeader}>
              <div className={styles.terminalDots}>
                <span className={`${styles.dot} ${styles.dotRojo}`} />
                <span className={`${styles.dot} ${styles.dotAmarillo}`} />
                <span className={`${styles.dot} ${styles.dotVerde}`} />
              </div>
              <span>TTY1 // DEV_BOOT.SH</span>
              <span>1920x1080 @ 30FPS</span>
            </div>

            <div className={styles.terminalBody}>
              {/* Línea 1 */}
              {frame >= 8 && (
                <div className={styles.terminalLinea}>
                  <span className={styles.promptSymbol}>&gt;</span>
                  <span className={styles.lineaTexto}>{l1Total.slice(0, l1Chars)}</span>
                  {frame < 22 && cursorVisible && <span className={styles.cursorBlink} />}
                </div>
              )}

              {/* Línea 2 */}
              {frame >= 22 && (
                <div className={styles.terminalLinea}>
                  <span className={styles.promptSymbol}>&gt;</span>
                  <span className={styles.lineaTexto}>{l2Prefijo.slice(0, l2Chars)}</span>
                  {l2Ok && <span className={styles.estadoOk}>[OK]</span>}
                  {frame >= 22 && frame < 38 && cursorVisible && (
                    <span className={styles.cursorBlink} />
                  )}
                </div>
              )}

              {/* Línea 3 */}
              {frame >= 38 && (
                <div className={styles.terminalLinea}>
                  <span className={styles.promptSymbol}>&gt;</span>
                  <span className={styles.lineaTexto}>{l3Prefijo.slice(0, l3Chars)}</span>
                  {l3Ok && <span className={styles.estadoOk}>[OK]</span>}
                  {frame >= 38 && frame < 52 && cursorVisible && (
                    <span className={styles.cursorBlink} />
                  )}
                </div>
              )}

              {/* Línea 4 */}
              {frame >= 52 && (
                <div className={styles.terminalLinea}>
                  <span className={styles.promptSymbol}>&gt;</span>
                  <span className={styles.lineaTexto}>{l4Prefijo.slice(0, l4Chars)}</span>
                  {l4Ready && <span className={styles.estadoWarn}>[ACTIVE]</span>}
                  {frame >= 52 && cursorVisible && <span className={styles.cursorBlink} />}
                </div>
              )}

              <div className={styles.simuladoDisclaimer}>
                * Secuencia de inicio y procesos simulados para maqueta de créditos *
              </div>
            </div>
          </div>

          {/* Barra de Carga 8-bit */}
          <div className={styles.progresoBox}>
            <div className={styles.progresoLabels}>
              <span>SYSTEM MEMORY INIT [0x{hexVal}]</span>
              <span>{barraAscii} {progresoPorcentaje}%</span>
            </div>
            <div className={styles.barraMarco}>
              <div
                className={styles.barraRelleno}
                style={{ width: `${progresoPorcentaje}%` }}
              />
            </div>
            <div className={styles.telemetriaFooter}>
              <span>CHIP: G10-LATAM // PROTOCOL-45S</span>
              <span>STATUS: {progresoPorcentaje === 100 ? 'READY FOR UPLINK' : 'LOADING...'}</span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Isotipo 8-bit Pixelado con Vibración y Partículas */}
        <div className={styles.colIsotipo}>
          <div
            className={styles.marcoIsotipo}
            style={{
              transform: `translate(${jitterX}px, ${jitterY}px)`,
              filter: chromaticAberration,
            }}
          >
            {/* Esquinas tácticas tipo HUD */}
            <div className={styles.hudCorners}>
              <span className={styles.cornerTL} />
              <span className={styles.cornerTR} />
              <span className={styles.cornerBL} />
              <span className={styles.cornerBR} />
            </div>

            {/* Cuadrícula de Píxeles 32x32 SVG */}
            <div className={styles.canvasPixelGrid}>
              <svg
                viewBox="0 0 32 32"
                className={styles.pixelSvg}
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <filter id="glowPixel" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="0.4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Renderizado de los 233 píxeles oficiales */}
                {PIXELS.map(([px, py, r, g, b], idx) => {
                  // Cada píxel aparece cuando el barrido alcanza su fila
                  if (py > sweepRow) return null;

                  // Efecto de desprendimiento en fotogramas finales (75-90)
                  const isDetached = glitchIntensity > 0 && idx % 5 === 0;
                  let posX = px;
                  let posY = py;
                  let opacity = 1;
                  let fill = `rgb(${r}, ${g}, ${b})`;

                  if (isDetached) {
                    const part = particulasDesprendidas.find((p) => p.pixel === PIXELS[idx]);
                    if (part) {
                      const dt = (frame - 75) * glitchIntensity;
                      posX += (part.vx * dt) / 5;
                      posY += (part.vy * dt) / 5;
                      opacity = Math.max(0, 1 - glitchIntensity * 0.7);
                      // Transición de color hacia cian holográfico
                      fill = '#22d3ee';
                    }
                  }

                  return (
                    <rect
                      key={`${px}-${py}-${idx}`}
                      x={posX}
                      y={posY}
                      width={0.92}
                      height={0.92}
                      fill={fill}
                      filter="url(#glowPixel)"
                      opacity={opacity}
                      rx={0.08}
                      ry={0.08}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Pie de pantalla y estado de fotograma */}
      <footer className={styles.footerStatus}>
        <span>SCENE 01 // APERTURA 8-BIT & BOOT TERMINAL</span>
        <span>FRAME: {String(frame).padStart(4, '0')} / 0090 ({((frame + 1) / fps).toFixed(2)}s)</span>
        <span>RESOLUTION: 1920x1080 @ 30 FPS</span>
      </footer>
    </div>
  );
};
