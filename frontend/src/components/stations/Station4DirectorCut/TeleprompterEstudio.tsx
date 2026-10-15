import type { ReactNode } from 'react';
import { Gauge, Radio, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { DirectorScene } from '../../../types/types';
import type { EstadoAmpliacion, VelocidadLocucion } from './estudioTipos';
import { SelectorAcento } from './SelectorAcento';
import styles from './EstudioDirector.module.css';

interface TeleprompterEstudioProps {
  scene: DirectorScene;
  span: string;
  /** Guion que se muestra y se locuta: el ampliado por IA si existe, si no el original */
  guion: string;
  ampliado: boolean;
  onVerOriginal: () => void;
  ampliacion: EstadoAmpliacion;
  onProfundizar: () => void;
  hablando: boolean;
  onLocutar: () => void;
  /** Mientras suena el video, el teleprompter no habla: una sola voz a la vez */
  locutarBloqueado: boolean;
  velocidad: VelocidadLocucion;
  onVelocidad: () => void;
  voces: SpeechSynthesisVoice[];
  vozElegida: string;
  onVoz: (nombre: string) => void;
  cargandoVoces: boolean;
  hayVozNavegador: boolean;
  /** Voz del video ya generado: si existe, "Locutar" reproduce su audio de la escena */
  vozVideo?: string;
  /** Procedencia y citas del documento (obligatorias en esta rama) */
  children?: ReactNode;
}

/**
 * Teleprompter de origin/feature/newmind-edtech-oci (estructura y CSS), con su voz del navegador
 * escena a escena, el selector de acento y "Profundizar concepto" llamando al backend.
 */
export const TeleprompterEstudio = ({
  scene,
  span,
  guion,
  ampliado,
  onVerOriginal,
  ampliacion,
  onProfundizar,
  hablando,
  onLocutar,
  locutarBloqueado,
  velocidad,
  onVelocidad,
  voces,
  vozElegida,
  onVoz,
  cargandoVoces,
  hayVozNavegador,
  vozVideo,
  children,
}: TeleprompterEstudioProps) => {
  const cargando = ampliacion.fase === 'cargando';
  const puedeLocutar = hayVozNavegador || Boolean(vozVideo);
  return (
    <section className={styles.teleprompterCard} aria-label="Teleprompter docente">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <Radio size={15} color="#e879f9" className={hablando ? styles.pulsingRadio : ''} aria-hidden="true" />
          <span className={styles.panelTitleFuchsia}>Teleprompter · Guion Docente</span>
        </div>

        <div className={styles.audioControlsGroup}>
          <button
            type="button"
            onClick={onProfundizar}
            disabled={cargando || ampliado}
            className={styles.expandScriptBtn}
            title="Explica la escena con más calma usando solo los pasajes citados del documento (IA)"
          >
            <Sparkles size={12} className={cargando ? styles.spinningIcon : ''} aria-hidden="true" />
            <span>{cargando ? 'Ampliando…' : 'Profundizar Concepto'}</span>
          </button>

          <button
            type="button"
            onClick={onVelocidad}
            className={styles.speedButton}
            title="Cambiar velocidad de locución"
            aria-label={`Velocidad de locución: ${velocidad}x`}
          >
            <Gauge size={12} aria-hidden="true" />
            <span>{velocidad}x</span>
          </button>

          {puedeLocutar && (
            <button
              type="button"
              onClick={onLocutar}
              disabled={locutarBloqueado}
              className={`${styles.audioNarrateBtn} ${hablando ? styles.audioNarrateBtnPlaying : ''}`}
              title={
                locutarBloqueado
                  ? 'El video está sonando: páusalo para locutar el guion'
                  : hablando
                    ? 'Detener locución'
                    : 'Escuchar locución en off'
              }
            >
              {hablando ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
              <span>{hablando ? 'Detener' : 'Locutar'}</span>
            </button>
          )}

          <span className={styles.sceneTimeBadge}>⏱ {span}</span>
        </div>
      </div>

      {vozVideo ? (
        <div className={styles.accentRow}>
          <span className={styles.accentHint}>🎙 Voz del video: {vozVideo}</span>
        </div>
      ) : (
        hayVozNavegador && (
          <div className={styles.accentRow}>
            <SelectorAcento voces={voces} vozElegida={vozElegida} onVoz={onVoz} cargando={cargandoVoces} />
          </div>
        )
      )}

      {/* Estado de onda de audio cuando está reproduciendo */}
      {hablando && (
        <div className={styles.equalizerWave} aria-hidden="true">
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveText}>Locución en vivo activa...</span>
        </div>
      )}

      {/* Caja del Guion */}
      <div className={styles.scriptBoxContainer}>
        {ampliado && (
          <div className={styles.iaRow}>
            <span className={styles.iaBadge}>Ampliado por IA · no verificado</span>
            <button type="button" className={styles.linkBtn} onClick={onVerOriginal}>
              Ver el guion original
            </button>
          </div>
        )}
        <span className={styles.quoteMark} aria-hidden="true">“</span>
        <p className={styles.scriptBox}>{guion.replace(/^["“”]|["“”]$/g, '')}</p>
        <span className={styles.quoteMarkEnd} aria-hidden="true">”</span>
        {ampliacion.fase === 'aviso' && (
          <p className={styles.iaNotice} role="status">
            {ampliacion.mensaje}
          </p>
        )}
      </div>

      {/* Consejo Pedagógico de la Escena */}
      {scene.consejo_pedagogico && (
        <div className={styles.pedagogyTip}>
          <div className={styles.pedagogyHeader}>
            <span className={styles.pedagogyBadge}>💡 Enfoque Didáctico Docente</span>
          </div>
          <p className={styles.pedagogyText}>{scene.consejo_pedagogico}</p>
        </div>
      )}

      {children}
    </section>
  );
};
