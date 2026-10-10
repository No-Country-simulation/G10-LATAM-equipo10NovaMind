import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AudiovisualStoryboard, AudiovisualScene } from '../../types/videoStudio';
import { SceneGraphicRenderer } from './graphics/SceneGraphicRenderer';
import { ttsService } from '../../utils/ttsService';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  storyboard: AudiovisualStoryboard;
  voiceUri?: string;
  autoPlay?: boolean;
  onSceneChange?: (sceneIndex: number) => void;
  onVideoEnd?: () => void;
}

export const VideoPlayer = ({
  storyboard,
  voiceUri,
  autoPlay = false,
  onSceneChange,
  onVideoEnd,
}: VideoPlayerProps) => {
  const [currentSceneIdx, setCurrentSceneIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [sceneElapsedSec, setSceneElapsedSec] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const speechEndedRef = useRef<boolean>(false);
  const breathingTimeoutRef = useRef<number | null>(null);

  const currentScene: AudiovisualScene =
    storyboard.escenas[currentSceneIdx] || storyboard.escenas[0];
  const totalScenes = storyboard.escenas.length;

  // Cálculo de duración dinámica por escena sincronizada con la voz del locutor y velocidad
  const sceneDurations = useMemo(() => {
    return storyboard.escenas.map((sc) => {
      const text = sc.narracion?.trim();
      if (text) {
        return ttsService.estimateDurationSeconds(text, playbackSpeed, {
          wordsPerMinute: 145,
          includeBreathingPause: true,
        });
      }
      return Math.max(5, Math.round((sc.duracionEstimada || 12) / playbackSpeed));
    });
  }, [storyboard.escenas, playbackSpeed]);

  const currentSceneDuration = sceneDurations[currentSceneIdx] || 10;

  // Detener voz y timers al desmontar
  useEffect(() => {
    return () => {
      ttsService.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
    };
  }, []);

  // Transición suave a la siguiente escena o fin del video
  const transitionToNextScene = useCallback(() => {
    if (breathingTimeoutRef.current) {
      clearTimeout(breathingTimeoutRef.current);
      breathingTimeoutRef.current = null;
    }
    ttsService.stop();

    if (currentSceneIdx < totalScenes - 1) {
      const nextIdx = currentSceneIdx + 1;
      setCurrentSceneIdx(nextIdx);
      setSceneElapsedSec(0);
      if (onSceneChange) onSceneChange(nextIdx);
    } else {
      setIsPlaying(false);
      setSceneElapsedSec(currentSceneDuration);
      if (onVideoEnd) onVideoEnd();
    }
  }, [currentSceneIdx, totalScenes, currentSceneDuration, onSceneChange, onVideoEnd]);

  // Función para narrar escena actual con sincronización onEnd
  const playCurrentSceneSpeech = useCallback(
    (scene: AudiovisualScene) => {
      if (breathingTimeoutRef.current) {
        clearTimeout(breathingTimeoutRef.current);
        breathingTimeoutRef.current = null;
      }
      speechEndedRef.current = false;

      if (isMuted || !scene?.narracion) return;

      ttsService.speak(scene.narracion, {
        voiceUri,
        lang: 'es-LATAM',
        rate: playbackSpeed,
        volume: isMuted ? 0 : 1,
        onEnd: () => {
          speechEndedRef.current = true;
          // Pausa pedagógica de asimilación tras completar la locución (1.1s escalado por velocidad)
          const breathingMs = Math.max(500, Math.round(1100 / playbackSpeed));
          breathingTimeoutRef.current = window.setTimeout(() => {
            transitionToNextScene();
          }, breathingMs);
        },
        onError: (e) => {
          console.warn('Audio fallback activo:', e);
          speechEndedRef.current = true;
        },
      });
    },
    [voiceUri, playbackSpeed, isMuted, transitionToNextScene]
  );

  // Sincronización del timer de reproducción con la voz
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isPlaying) {
      ttsService.pause();
      if (breathingTimeoutRef.current) {
        clearTimeout(breathingTimeoutRef.current);
        breathingTimeoutRef.current = null;
      }
      return;
    }

    // Iniciar locución para la escena activa actual
    const sceneToSpeak = storyboard.escenas[currentSceneIdx] || storyboard.escenas[0];
    playCurrentSceneSpeech(sceneToSpeak);

    const intervalMs = 100;
    const stepSec = 0.1 * playbackSpeed;

    timerRef.current = window.setInterval(() => {
      setSceneElapsedSec((prev) => {
        const next = prev + stepSec;

        // Si el audio está silenciado o no soportado, avanzar cuando se cumpla la duración estimada
        if (isMuted || !ttsService.isSupported()) {
          if (next >= currentSceneDuration) {
            transitionToNextScene();
            return currentSceneDuration;
          }
        } else {
          // Timeout de seguridad en caso de que el navegador no emita el evento onEnd
          if (next >= currentSceneDuration + 3.0) {
            transitionToNextScene();
            return currentSceneDuration;
          }
        }

        return Math.min(currentSceneDuration, next);
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
    };
  }, [
    isPlaying,
    currentSceneIdx,
    currentSceneDuration,
    playbackSpeed,
    isMuted,
    playCurrentSceneSpeech,
    transitionToNextScene,
    storyboard.escenas,
  ]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      ttsService.pause();
      if (breathingTimeoutRef.current) {
        clearTimeout(breathingTimeoutRef.current);
        breathingTimeoutRef.current = null;
      }
    } else {
      if (sceneElapsedSec >= currentSceneDuration && currentSceneIdx >= totalScenes - 1) {
        // Reiniciar desde el principio
        setCurrentSceneIdx(0);
        setSceneElapsedSec(0);
      } else if (ttsService.isSupported() && !isMuted) {
        ttsService.resume();
      }
      setIsPlaying(true);
    }
  };

  const handlePrevScene = () => {
    if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
    ttsService.stop();
    if (currentSceneIdx > 0) {
      const prevIdx = currentSceneIdx - 1;
      setCurrentSceneIdx(prevIdx);
      setSceneElapsedSec(0);
      if (onSceneChange) onSceneChange(prevIdx);
    } else {
      setSceneElapsedSec(0);
    }
  };

  const handleNextScene = () => {
    if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
    ttsService.stop();
    if (currentSceneIdx < totalScenes - 1) {
      const nextIdx = currentSceneIdx + 1;
      setCurrentSceneIdx(nextIdx);
      setSceneElapsedSec(0);
      if (onSceneChange) onSceneChange(nextIdx);
    }
  };

  const handleRestart = () => {
    if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
    ttsService.stop();
    setCurrentSceneIdx(0);
    setSceneElapsedSec(0);
    setIsPlaying(true);
    if (onSceneChange) onSceneChange(0);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute) {
      ttsService.stop();
    } else if (isPlaying) {
      playCurrentSceneSpeech(currentScene);
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (isPlaying) {
      ttsService.stop();
      if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
      ttsService.speak(currentScene.narracion, {
        voiceUri,
        lang: 'es-LATAM',
        rate: newSpeed,
        volume: isMuted ? 0 : 1,
        onEnd: () => {
          speechEndedRef.current = true;
          const breathingMs = Math.max(500, Math.round(1100 / newSpeed));
          breathingTimeoutRef.current = window.setTimeout(() => {
            transitionToNextScene();
          }, breathingMs);
        },
      });
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn('Error al activar pantalla completa:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Cálculo de tiempos globales precisos
  const totalDurationSec = useMemo(() => {
    return sceneDurations.reduce((acc, dur) => acc + dur, 0);
  }, [sceneDurations]);

  const elapsedTotalSec = useMemo(() => {
    const prevSum = sceneDurations.slice(0, currentSceneIdx).reduce((acc, dur) => acc + dur, 0);
    return prevSum + Math.min(sceneElapsedSec, currentSceneDuration);
  }, [sceneDurations, currentSceneIdx, sceneElapsedSec, currentSceneDuration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const globalProgressPercent = Math.min(
    100,
    Math.max(0, (elapsedTotalSec / Math.max(1, totalDurationSec)) * 100)
  );

  const wordCount =
    currentScene.conteoPalabras ||
    (currentScene.narracion ? currentScene.narracion.trim().split(/\s+/).filter(Boolean).length : 0);

  return (
    <div ref={containerRef} className={styles.playerContainer}>
      {/* 1. Main Viewport Stage */}
      <div
        className={styles.playerViewport}
        onClick={handleTogglePlay}
        style={{ cursor: 'pointer' }}
        title={isPlaying ? 'Pausar video' : 'Reproducir video'}
      >
        {/* Top Watermark / Badges */}
        <div className={styles.topOverlay}>
          <div className={styles.brandPill}>
            <Sparkles size={12} color="#f0abfc" />
            <span>NuevaMente Video Studio</span>
          </div>

          <div className={styles.sceneBadgePill}>
            <span>
              Escena {currentSceneIdx + 1} de {totalScenes}
            </span>
          </div>
        </div>

        {/* Scene Title Overlay */}
        <div className={styles.sceneHeaderOverlay}>
          <h3 className={styles.sceneTitle}>{currentScene.titulo}</h3>
          <span className={styles.sceneSubtitle}>
            {`Escena 0${currentSceneIdx + 1} · ~${Math.round(currentSceneDuration)}s (${wordCount} palabras)`}
          </span>
        </div>

        {/* Active Animated Graphic Component */}
        <SceneGraphicRenderer scene={currentScene} />

        {/* Central Play Overlay Banner when Paused */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '9999px',
              padding: '0.875rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.95rem',
              boxShadow: '0 10px 30px rgba(139, 92, 246, 0.35)',
              pointerEvents: 'none',
              animation: 'pulse 2s infinite',
            }}
          >
            <Play size={20} color="#38bdf8" fill="#38bdf8" />
            <span>Reproducir Microclase con Voz</span>
          </div>
        )}

        {/* Concept Explanation HUD Card */}
        {currentScene.textoEnPantalla?.definicionConcepto && (
          <div className={styles.conceptExplanationOverlay} onClick={(e) => e.stopPropagation()}>
            <div className={styles.conceptCard}>
              <div className={styles.conceptHeaderRow}>
                <div className={styles.conceptBadge}>
                  <Lightbulb size={13} className={styles.conceptBadgeIcon} />
                  <span>
                    {currentScene.textoEnPantalla.conceptoNombre || 'CONCEPTO CLAVE'}
                  </span>
                </div>
                {currentScene.elementosGraficos?.metricaDestacada && (
                  <div className={styles.conceptMetricPill}>
                    <span className={styles.metricVal}>
                      {currentScene.elementosGraficos.metricaDestacada.valor}
                    </span>
                    <span className={styles.metricLbl}>
                      {currentScene.elementosGraficos.metricaDestacada.etiqueta}
                    </span>
                  </div>
                )}
              </div>

              <p className={styles.conceptDefinition}>
                {currentScene.textoEnPantalla.definicionConcepto}
              </p>

              {currentScene.textoEnPantalla.puntosClave &&
                currentScene.textoEnPantalla.puntosClave.length > 0 && (
                  <div className={styles.conceptTagsRow}>
                    {currentScene.textoEnPantalla.puntosClave.slice(0, 3).map((point, idx) => (
                      <span key={idx} className={styles.conceptTag}>
                        <CheckCircle2 size={11} color="#34d399" />
                        <span>{point}</span>
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Controls & Timeline Bar */}
      <div className={styles.controlsBar}>
        {/* Timeline Scrubber */}
        <div
          className={styles.timelineTrack}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const targetSec = clickRatio * totalDurationSec;

            let accumulated = 0;
            for (let i = 0; i < totalScenes; i++) {
              const scDur = sceneDurations[i];
              if (targetSec <= accumulated + scDur || i === totalScenes - 1) {
                if (breathingTimeoutRef.current) clearTimeout(breathingTimeoutRef.current);
                ttsService.stop();
                setCurrentSceneIdx(i);
                setSceneElapsedSec(Math.min(scDur, Math.max(0, targetSec - accumulated)));
                if (onSceneChange) onSceneChange(i);
                break;
              }
              accumulated += scDur;
            }
          }}
        >
          <div
            className={styles.timelineProgress}
            style={{ width: `${globalProgressPercent}%` }}
          />

          {/* Notches for each scene start */}
          {storyboard.escenas.map((_, i) => {
            const notchSec = sceneDurations.slice(0, i).reduce((a, s) => a + s, 0);
            const notchPercent = (notchSec / Math.max(1, totalDurationSec)) * 100;
            return (
              <div
                key={i}
                className={styles.sceneNotch}
                style={{ left: `${notchPercent}%` }}
              />
            );
          })}
        </div>

        {/* Playback Controls Row */}
        <div className={styles.controlsRow}>
          {/* Left Buttons: Prev, Play/Pause, Next, Replay */}
          <div className={styles.leftControls}>
            <button
              type="button"
              onClick={handlePrevScene}
              disabled={currentSceneIdx === 0}
              className={styles.controlBtn}
              title="Escena anterior"
            >
              <SkipBack size={16} />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className={styles.playPauseBtn}
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
            </button>

            <button
              type="button"
              onClick={handleNextScene}
              disabled={currentSceneIdx === totalScenes - 1}
              className={styles.controlBtn}
              title="Siguiente escena"
            >
              <SkipForward size={16} />
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className={styles.controlBtn}
              title="Reiniciar microclase"
            >
              <RotateCcw size={16} />
            </button>

            <span className={styles.timeDisplay}>
              {formatTime(elapsedTotalSec)} / {formatTime(totalDurationSec)}
            </span>
          </div>

          {/* Right Buttons: Speed, Audio Mute, Fullscreen */}
          <div className={styles.rightControls}>
            <select
              value={playbackSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className={styles.speedSelector}
              title="Velocidad de reproducción"
            >
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`${styles.controlBtn} ${isMuted ? styles.activeToggleBtn : ''}`}
              title={isMuted ? 'Activar audio' : 'Silenciar audio'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              className={styles.controlBtn}
              title="Pantalla completa"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
