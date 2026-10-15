import type { ReactNode } from 'react';
import { Camera, Check, CheckCircle2, Copy, Eye, Film, ImageIcon, Layers, Sparkles } from 'lucide-react';
import type { DirectorScene } from '../../../types/types';
import { datosVisor } from '../../../utils/datosVisor';
import type { EstadoAmpliacion } from './estudioTipos';
import styles from './EstudioDirector.module.css';

interface PizarraDidacticaProps {
  scene: DirectorScene;
  indice: number;
  total: number;
  span: string;
  /** Hay una voz sonando (teleprompter o video): el punto del visor late */
  enVivo: boolean;
  /** Descripción visual: la enriquecida por IA si existe, si no la del guion */
  visual: string;
  enriquecida: boolean;
  onVerOriginal: () => void;
  enriquecimiento: EstadoAmpliacion;
  onEnriquecer: () => void;
  promptDisponible: boolean;
  promptCopyState: 'idle' | 'copied' | 'error';
  onCopyPrompt: () => void;
  /** Botón "Generar video" y acento, en la cabecera de la pizarra */
  accionVideo?: ReactNode;
  /** Estado del video y navegación de escenas */
  children?: ReactNode;
}

/**
 * Pizarra didáctica de origin/feature/newmind-edtech-oci (estructura y CSS): visor de cámara,
 * storyboard, etiquetas y ficha técnica. Cada dato sale de la escena (utils/datosVisor.ts).
 */
export const PizarraDidactica = ({
  scene,
  indice,
  total,
  span,
  enVivo,
  visual,
  enriquecida,
  onVerOriginal,
  enriquecimiento,
  onEnriquecer,
  promptDisponible,
  promptCopyState,
  onCopyPrompt,
  accionVideo,
  children,
}: PizarraDidacticaProps) => {
  const datos = datosVisor(scene, indice, total, span);
  const cargando = enriquecimiento.fase === 'cargando';
  return (
    <section className={styles.blackboardCard} aria-label="Pizarra didáctica">
      <div>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitleGroup}>
            <Film size={15} color="var(--color-cyan-400)" aria-hidden="true" />
            <span className={styles.panelTitleCyan}>
              Pizarra Didáctica · Escena {String(indice + 1).padStart(2, '0')}
            </span>
          </div>
          {accionVideo}
        </div>

        {/* Título del Concepto y Puesta en Escena */}
        <div className={styles.conceptHeader}>
          <span className={styles.conceptCategory}>Storyboard & Puesta en Escena Didáctica</span>
          <h4 className={styles.conceptTitle}>{scene.titulo}</h4>
        </div>

        {/* Viewfinder / Monitor de Director: decoración, con datos reales en la barra */}
        <div className={styles.viewfinderContainer}>
          <div className={styles.viewfinderCornerTL} aria-hidden="true" />
          <div className={styles.viewfinderCornerTR} aria-hidden="true" />
          <div className={styles.viewfinderCornerBL} aria-hidden="true" />
          <div className={styles.viewfinderCornerBR} aria-hidden="true" />

          <div className={styles.viewfinderTopBar}>
            <div className={styles.viewfinderRecGroup}>
              <span
                className={`${styles.viewfinderRecDot} ${enVivo ? '' : styles.viewfinderRecDotIdle}`}
                aria-hidden="true"
              />
              <span className={styles.viewfinderRecText}>{datos.escena}</span>
            </div>
            <div className={styles.viewfinderTimecode}>⏱ {datos.tramo}</div>
            <div className={styles.viewfinderFps}>{datos.formatoVideo}</div>
          </div>

          <div className={styles.viewfinderGrid} aria-hidden="true" />

          <div className={styles.storyboardContentBox}>
            <div className={styles.storyboardHeaderRow}>
              <div className={styles.storyboardHeaderPill}>
                <Camera size={13} color="#38bdf8" aria-hidden="true" />
                <span>Descripción Visual de la Escena (Storyboard)</span>
              </div>

              <div className={styles.storyboardActionBtns}>
                {promptDisponible && (
                  <button
                    type="button"
                    onClick={onCopyPrompt}
                    className={`${styles.actionBtn} ${promptCopyState === 'copied' ? styles.actionBtnActive : ''}`}
                    title="Copia una descripción de la escena para pegarla en el generador de imágenes que prefieras"
                  >
                    {promptCopyState === 'copied' ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    <span aria-live="polite">
                      {promptCopyState === 'copied'
                        ? '¡Copiado!'
                        : promptCopyState === 'error'
                          ? 'No se pudo copiar'
                          : 'Copiar Prompt'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onEnriquecer}
                  disabled={cargando || enriquecida}
                  className={styles.enrichBtn}
                  title="Propuesta de encuadre, ambientación y metáfora visual generada por IA"
                >
                  <Sparkles size={12} className={cargando ? styles.spinningIcon : ''} aria-hidden="true" />
                  <span>{cargando ? 'Enriqueciendo…' : 'Enriquecer con IA'}</span>
                </button>
              </div>
            </div>

            <div className={styles.storyboardVisualTextContainer}>
              {enriquecida && (
                <div className={styles.iaRow}>
                  <span className={styles.iaBadge}>Propuesta de IA · no verificada</span>
                  <button type="button" className={styles.linkBtn} onClick={onVerOriginal}>
                    Ver la descripción original
                  </button>
                </div>
              )}
              <p className={styles.storyboardVisualText}>{visual || 'La escena no trae descripción visual.'}</p>
              {enriquecimiento.fase === 'aviso' && (
                <p className={styles.iaNotice} role="status">
                  {enriquecimiento.mensaje}
                </p>
              )}
            </div>

            <div className={styles.storyboardPillsRow}>
              <div className={styles.storyboardPillItem}>
                <Eye size={12} color="#38bdf8" aria-hidden="true" />
                <span className={styles.pillLabel}>Foco:</span>
                <span className={styles.pillValue}>{datos.foco}</span>
              </div>
              <div className={styles.storyboardPillItem}>
                <ImageIcon size={12} color="#f0abfc" aria-hidden="true" />
                <span className={styles.pillLabel}>Imagen:</span>
                <span className={styles.pillValue}>{datos.imagen}</span>
              </div>
              <div className={styles.storyboardPillItem}>
                <Layers size={12} color="#34d399" aria-hidden="true" />
                <span className={styles.pillLabel}>Formato:</span>
                <span className={styles.pillValue}>{datos.formato}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ficha técnica: todo medido o contado de la escena */}
        <div className={styles.techMetricsGrid}>
          <div className={styles.techMetricItem}>
            <span className={styles.techMetricLabel}>Tramo</span>
            <span className={styles.techMetricValue}>{datos.tramo}</span>
          </div>
          <div className={styles.techMetricItem}>
            <span className={styles.techMetricLabel}>Palabras</span>
            <span className={styles.techMetricValue}>{datos.palabras}</span>
          </div>
          <div className={styles.techMetricItem}>
            <span className={styles.techMetricLabel}>Diapositiva</span>
            <span className={styles.techMetricValue}>{datos.formato}</span>
          </div>
          <div className={styles.techMetricItem}>
            <span className={styles.techMetricLabel}>Citas verificadas</span>
            <span className={styles.techMetricValue}>{datos.citas}</span>
          </div>
        </div>

        {datos.puntos.length > 0 && (
          <div className={styles.verifiedPointsContainer}>
            <span className={styles.verifiedPointsTitle}>Puntos Clave Didácticos & Visuales:</span>
            <ul className={styles.verifiedPointsList}>
              {datos.puntos.map((punto, i) => (
                <li key={i} className={styles.verifiedPointItem}>
                  <CheckCircle2 size={13} color="var(--color-cyan-400)" className={styles.pointCheckIcon} aria-hidden="true" />
                  <span>{punto}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {children}
    </section>
  );
};
