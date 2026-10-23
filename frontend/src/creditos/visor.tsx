/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Visor interactivo para la Escena Piloto de Créditos NuevaMente
 * Utiliza @remotion/player para reproducción determinista en el navegador
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { CreditosVideo, CREDITOS_CONFIG } from './CreditosVideo';
import styles from './visor.module.css';

export const VisorCreditos: React.FC = () => {
  const playerRef = useRef<PlayerRef>(null);

  // Lectura del fotograma inicial desde parámetros URL (?frame=127 o ?f=127)
  const initialFrame = useMemo(() => {
    if (typeof window === 'undefined') return 0;
    const params = new URLSearchParams(window.location.search);
    const val = params.get('frame') || params.get('f');
    if (val !== null) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < CREDITOS_CONFIG.faseActualFrames) {
        return parsed;
      }
    }
    return 0;
  }, []);

  const [currentFrame, setCurrentFrame] = useState(initialFrame);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (initialFrame > 0) {
      player.seekTo(initialFrame);
    }

    const onFrameUpdate = () => {
      setCurrentFrame(player.getCurrentFrame());
    };

    player.addEventListener('timeupdate', onFrameUpdate);
    return () => {
      player.removeEventListener('timeupdate', onFrameUpdate);
    };
  }, [initialFrame]);

  const saltarA = (frame: number) => {
    playerRef.current?.seekTo(frame);
    setCurrentFrame(frame);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('frame', String(frame));
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className={styles.contenedorVisor}>
      {/* Barra superior con identidad del proyecto */}
      <header className={styles.barraSuperior}>
        <div className={styles.marcaGrupo}>
          <img src="/IsotipoMonocromo.svg" alt="NuevaMente" className={styles.logoIcono} />
          <div>
            <h1 className={styles.tituloVisor}>NuevaMente · Vídeo de Créditos</h1>
            <span className={styles.subtituloVisor}>
              Escenas 01 &amp; 02: Apertura 8-Bit y Núcleo Holográfico 3D (0 a 8s)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className={styles.insigniaPiloto}>Escenas 01 &amp; 02 Activas</span>
          <a href="/" className={styles.enlaceVolver}>
            &larr; Volver a la App Principal
          </a>
        </div>
      </header>

      {/* Zona principal con reproductor Remotion */}
      <main className={styles.zonaReproductor}>
        <div className={styles.marcoVideo}>
          <Player
            ref={playerRef}
            component={CreditosVideo}
            initialFrame={initialFrame}
            durationInFrames={CREDITOS_CONFIG.faseActualFrames}
            compositionWidth={CREDITOS_CONFIG.width}
            compositionHeight={CREDITOS_CONFIG.height}
            fps={CREDITOS_CONFIG.fps}
            controls
            autoPlay={false}
            loop
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Panel de control de comprobación de fotogramas clave */}
        <section className={styles.panelControl} aria-label="Controles de verificación">
          <div className={styles.saltoGrupo}>
            <span className={styles.labelControl}>Validación Escena 02 (Morphing Orgánico):</span>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(90)}
              title="Fotograma 90 (0% de transición): Silueta del infinito intacta y continuidad 8-bit"
            >
              F90 [0% Inicio]
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(127)}
              title="Fotograma 127 (25% de transición): Desprendimiento progresivo (36 chispas), relieve 3D y HUD de fondo"
            >
              F127 [25% Relieve 3D]
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(165)}
              title="Fotograma 165 (50% de transición): Cristalización vectorial oficial y fusión de nodos"
            >
              F165 [50% Vectorial]
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(202)}
              title="Fotograma 202 (75% de transición): Núcleo 3D en 5 capas Z con inclinación y parallax"
            >
              F202 [75% Parallax Z]
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(239)}
              title="Fotograma 239 (100% de transición): Núcleo holográfico estable con pulso musical a 140 BPM"
            >
              F239 [100% Final]
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(0)}
              title="Fotograma 0: Apertura 8-Bit & Boot Terminal (Escena 01)"
            >
              E1 · 8-Bit (F0)
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(90)}
              title="Fotograma 90: Morphing a Núcleo Holográfico (Escena 02)"
            >
              E2 · Holograma (F90)
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(240)}
              title="Fotograma 240: Red de Agentes Pedagógicos (Escena 03)"
            >
              E3 · Agentes (F240)
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(540)}
              title="Fotograma 540: Arquitectura OCI & Stack Técnico (Escena 04)"
            >
              E4 · OCI Stack (F540)
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(840)}
              title="Fotograma 840: Créditos del Equipo 10 (Escena 05)"
            >
              E5 · Equipo 10 (F840)
            </button>
            <button
              type="button"
              className={styles.btnSalto}
              onClick={() => saltarA(1170)}
              title="Fotograma 1170: Clímax Audiovisual & Agradecimiento (Escena 06)"
            >
              E6 · Clímax (F1170)
            </button>
          </div>

          {/* Telemetría y especificaciones de la composición */}
          <div className={styles.datosTecnicos}>
            <div className={styles.datoItem}>
              <span>Frame:</span>
              <span className={styles.datoValor}>
                {String(currentFrame).padStart(4, '0')} / {CREDITOS_CONFIG.faseActualFrames}
              </span>
            </div>
            <div className={styles.datoItem}>
              <span>Tiempo:</span>
              <span className={styles.datoValor}>
                {((currentFrame + 1) / CREDITOS_CONFIG.fps).toFixed(2)}s / {(CREDITOS_CONFIG.faseActualFrames / CREDITOS_CONFIG.fps).toFixed(2)}s
              </span>
            </div>
            <div className={styles.datoItem}>
              <span>Formato:</span>
              <span className={styles.datoValor}>1920×1080 @ 30 FPS (45.0s)</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

// Si se carga de forma autónoma (creditos.html)
const rootElement = document.getElementById('root');
if (rootElement && window.location.pathname.includes('creditos')) {
  createRoot(rootElement).render(<VisorCreditos />);
}
