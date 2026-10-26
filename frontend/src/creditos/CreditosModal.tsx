/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Reproductor Cinematográfico de Créditos Superpuesto (Modal Fullscreen)
 * Utiliza Remotion Player y sincroniza la banda sonora Midnight High Score
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  FastForward,
  RotateCcw,
  X,
  Award,
  ChevronRight,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { CreditosVideo, CREDITOS_CONFIG } from './CreditosVideo';
import styles from './CreditosModal.module.css';

export interface CreditosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVolverResultados: () => void;
  onExplorarNuevaMente: () => void;
}

export const CreditosModal: React.FC<CreditosModalProps> = ({
  isOpen,
  onClose,
  onVolverResultados,
  onExplorarNuevaMente,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<string | null>(null);

  const totalFrames = CREDITOS_CONFIG.faseActualFrames;
  const fps = CREDITOS_CONFIG.fps;

  // Bloqueo de scroll en el body mientras el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Foco inicial en el contenedor modal
    containerRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Manejo de eventos del reproductor Remotion
  useEffect(() => {
    if (!isOpen) return;
    const player = playerRef.current;
    if (!player) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsEnded(true);
    const onError = (e: { detail: { error: Error } }) => {
      setHasError(e.detail?.error?.message || 'Error al inicializar la reproducción audiovisual');
    };
    const onTimeUpdate = (e: { detail: { frame: number } }) => {
      const f = e.detail?.frame ?? player.getCurrentFrame();
      setCurrentFrame(f);
      if (f >= totalFrames - 1) {
        setIsEnded(true);
      }
    };
    const onMuteChange = (e: { detail: { isMuted: boolean } }) => {
      setIsMuted(e.detail?.isMuted ?? player.isMuted());
    };

    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    player.addEventListener('error', onError);
    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('mutechange', onMuteChange);

    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('error', onError);
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('mutechange', onMuteChange);
    };
  }, [isOpen, totalFrames]);

  // Controles de reproducción
  const handleTogglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
    } else {
      player.play();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isMuted()) {
      player.unmute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
  }, []);

  const handleSaltar = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      player.pause();
      player.seekTo(totalFrames - 1);
    }
    setIsEnded(true);
  }, [totalFrames]);

  const handleReiniciar = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      player.seekTo(0);
      player.play();
    }
    setIsEnded(false);
    setCurrentFrame(0);
  }, []);

  // Navegación por teclado accesible
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' && !isEnded) {
        e.preventDefault();
        handleTogglePlay();
      } else if ((e.key === 'm' || e.key === 'M') && !isEnded) {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEnded, onClose, handleTogglePlay, handleToggleMute]);

  if (!isOpen) return null;

  const currentSeconds = Math.min(totalFrames / fps, (currentFrame + 1) / fps);
  const totalSeconds = totalFrames / fps;
  const progressPercent = Math.min(100, Math.max(0, (currentFrame / (totalFrames - 1)) * 100));

  return (
    <div
      ref={containerRef}
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Vídeo de créditos cinematográficos de NuevaMente"
      tabIndex={-1}
    >
      {/* Barra superior con identidad y salida rápida */}
      <header className={styles.topBar}>
        <div className={styles.brandGroup}>
          <img src="/IsotipoMonocromo.svg" alt="" className={styles.logoIcon} aria-hidden="true" />
          <span className={styles.brandText}>NuevaMente</span>
          <span className={styles.badgeTag}>Créditos Cinematográficos</span>
        </div>

        <div className={styles.topActions}>
          {!isEnded && (
            <button
              type="button"
              onClick={handleSaltar}
              className={styles.skipButton}
              title="Saltar intro cinematográfica"
              aria-label="Saltar intro cinematográfica"
            >
              <span>Saltar</span>
              <FastForward size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            title="Cerrar reproductor (Esc)"
            aria-label="Cerrar reproductor"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Escenario central de proyección */}
      <main className={styles.playerStage}>
        <div className={styles.aspectContainer}>
          {hasError ? (
            <div className={styles.errorCard}>
              <AlertTriangle size={32} style={{ marginBottom: '0.75rem' }} />
              <h4>Error en el reproductor</h4>
              <p style={{ fontSize: '0.8125rem', margin: '0.5rem 0 1rem' }}>{hasError}</p>
              <button
                type="button"
                onClick={handleReiniciar}
                className={styles.endSecondaryBtn}
              >
                Reintentar
              </button>
            </div>
          ) : (
            <Player
              ref={playerRef}
              component={CreditosVideo}
              durationInFrames={totalFrames}
              compositionWidth={CREDITOS_CONFIG.width}
              compositionHeight={CREDITOS_CONFIG.height}
              fps={fps}
              controls={false}
              autoPlay={true}
              loop={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          )}

          {/* Pantalla final de cierre con acciones */}
          {isEnded && (
            <div className={styles.endOverlay}>
              <div className={styles.endTrophyBox}>
                <Award size={36} />
              </div>

              <h2 className={styles.endTitle}>¡Gracias por recorrer NuevaMente!</h2>

              <p className={styles.endSubtitle}>
                Has culminado el circuito completo de 5 estaciones pedagógicas, demostrando dominio
                conceptual riguroso y anclaje RAG con cero alucinaciones.
              </p>

              <div className={styles.endButtonGroup}>
                <button
                  type="button"
                  onClick={onVolverResultados}
                  className={styles.endPrimaryBtn}
                  aria-label="Ir a resultados en OCI Cloud"
                >
                  <Award size={16} />
                  <span>Volver atrás</span>
                </button>

                <button
                  type="button"
                  onClick={onExplorarNuevaMente}
                  className={styles.endSecondaryBtn}
                  aria-label="Continuar explorando la aplicación"
                >
                  <Compass size={16} />
                  <span>Explorar NuevaMente</span>
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleReiniciar}
                  className={styles.repeatLinkBtn}
                  aria-label="Repetir secuencia audiovisual"
                >
                  <RotateCcw size={13} />
                  <span>Repetir vídeo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Barra de controles inferior minimalista */}
      {!isEnded && !hasError && (
        <footer className={styles.controlsBar} aria-label="Controles del reproductor">
          <div className={styles.controlsLeft}>
            <button
              type="button"
              onClick={handleTogglePlay}
              className={styles.controlIconButton}
              title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className={styles.controlIconButton}
              title={isMuted ? 'Activar sonido (M)' : 'Silenciar (M)'}
              aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>

          <div className={styles.progressContainer}>
            <div
              className={styles.progressBarBg}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                const targetFrame = Math.round(ratio * (totalFrames - 1));
                playerRef.current?.seekTo(targetFrame);
                setCurrentFrame(targetFrame);
              }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso del vídeo"
            >
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className={styles.timeDisplay}>
              <span>{currentSeconds.toFixed(1)}s</span> / <span>{totalSeconds.toFixed(1)}s</span>
            </div>
          </div>

          <div className={styles.controlsRight}>
            <button
              type="button"
              onClick={onVolverResultados}
              className={styles.skipButton}
              title="Ir a resultados y métricas OCI Cloud"
              aria-label="Ir a resultados"
            >
              <span>Volver atrás</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};
