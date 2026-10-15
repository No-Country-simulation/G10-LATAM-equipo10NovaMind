import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, Maximize2, Minimize2, Clapperboard, X } from 'lucide-react';
import type { DirectorScene } from '../../../types/types';
import { ETIQUETA_VISUAL } from '../../../utils/datosVisor';
import styles from './SlideNarrada.module.css';

interface SlideNarradaProps {
  scene: DirectorScene;
  /** Tramo 'MM:SS - MM:SS' de la escena dentro del video */
  span: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  isTheater?: boolean;
  onToggleTheater?: () => void;
  /** Sin vista previa en la página: la diapositiva solo se ve en el Modo Cine */
  soloCine?: boolean;
  /** Palabras del guion y la que suena: subtítulos del Modo Cine */
  subtitulo?: { palabras: string[]; activa: number } | null;
}

const VENTANA_SUBTITULO = 12;

/** Las palabras alrededor de la que suena, en bloques fijos para que el texto no salte. */
const tramoSubtitulo = (palabras: string[], activa: number) => {
  const inicio = Math.floor(Math.max(0, activa) / VENTANA_SUBTITULO) * VENTANA_SUBTITULO;
  return { inicio, palabras: palabras.slice(inicio, inicio + VENTANA_SUBTITULO) };
};

/**
 * Diapositiva del video narrado, dibujada siempre desde el JSON del guion: título,
 * puntos clave y la cita del documento. La foto libre es solo fondo y lleva su crédito,
 * que la licencia CC exige mostrar.
 * Incorpora botón Play flotante y Modo Cine/Teatro inmersivo.
 */
export const SlideNarrada = ({
  scene,
  span,
  isPlaying = false,
  onTogglePlay,
  isTheater = false,
  onToggleTheater,
  soloCine = false,
  subtitulo = null,
}: SlideNarradaProps) => {
  const visual = scene.visual;
  const puntos = (Array.isArray(visual?.puntos_clave) ? visual.puntos_clave : []).slice(0, 4);
  const fuentes = Array.isArray(scene.fuentes) ? scene.fuentes : [];
  // Solo una cita localizada en el documento se muestra como cita: nunca una no verificada.
  const cita = fuentes.find((f) => f.verificada);
  const foto = scene.imagen?.tipo === 'foto' && scene.imagen.url ? scene.imagen : null;
  const etiqueta = visual ? (ETIQUETA_VISUAL[visual.tipo] ?? 'Concepto') : 'Concepto';
  const enFlujo = visual?.tipo === 'diagrama_bloques' && puntos.length > 1;

  // Cerrar Modo Cine con tecla Escape
  useEffect(() => {
    if (!isTheater) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onToggleTheater) {
        onToggleTheater();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTheater, onToggleTheater]);

  const renderSlideCanvas = (enTeatro: boolean = false) => (
    <div
      className={`${styles.slide} ${foto ? styles.conFoto : ''}`}
      // JSON.stringify escapa comillas y barras: una URL rara no rompe la regla CSS
      style={foto ? ({ '--foto': `url(${JSON.stringify(foto.url)})` } as CSSProperties) : undefined}
    >
      {/* Botón flotante para expandir / alternar Modo Cine */}
      {onToggleTheater && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTheater();
          }}
          className={styles.theaterToggleBtn}
          title={enTeatro ? 'Salir del Modo Cine (Esc)' : 'Expandir a Modo Cine'}
          aria-label={enTeatro ? 'Salir del Modo Cine' : 'Expandir a Modo Cine'}
        >
          {enTeatro ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{enTeatro ? 'Reducir' : 'Modo Cine'}</span>
        </button>
      )}

      {/* Botón Flotante Central de Play / Pausa */}
      {onTogglePlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isPlaying && !isTheater && onToggleTheater) {
              onToggleTheater();
            }
            onTogglePlay();
          }}
          className={`${styles.playOverlay} ${isPlaying ? styles.playing : ''}`}
          aria-label={isPlaying ? 'Pausar locución' : 'Reproducir video narrado'}
        >
          <div className={styles.playButtonCircle}>
            {isPlaying ? (
              <Pause size={28} />
            ) : (
              <Play size={28} className={styles.playIconTriangle} />
            )}
          </div>
          {!isPlaying && <span className={styles.playButtonLabel}>Reproducir Video</span>}
        </button>
      )}

      <div className={styles.contenido}>
        <p className={styles.meta}>
          Escena {String(scene.escena).padStart(2, '0')} · {span} · {etiqueta}
        </p>
        <h4 className={styles.titulo}>{visual?.titulo || scene.titulo}</h4>

        {enFlujo ? (
          <ol className={styles.flujo}>
            {puntos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        ) : (
          puntos.length > 0 && (
            <ul className={styles.puntos}>
              {puntos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          )
        )}

        {cita && (
          <blockquote className={styles.cita}>
            <span className={styles.citaTexto}>“{cita.texto_fuente}”</span>
            {cita.pagina ? <cite>Documento · pág. {cita.pagina}</cite> : <cite>Documento fuente</cite>}
          </blockquote>
        )}
      </div>
    </div>
  );

  // La licencia CC exige el crédito allí donde se ve la foto: también en el Modo Cine
  const credito = foto && (
    <figcaption className={styles.credito}>
      Foto:{' '}
      {foto.fuente_url ? (
        <a href={foto.fuente_url} target="_blank" rel="noopener noreferrer">
          {foto.autor}
        </a>
      ) : (
        foto.autor
      )}{' '}
      ·{' '}
      {foto.licencia_url ? (
        <a href={foto.licencia_url} target="_blank" rel="noopener noreferrer license">
          {foto.licencia}
        </a>
      ) : (
        foto.licencia
      )}{' '}
      · vía {foto.proveedor === 'wikimedia' ? 'Wikimedia Commons' : 'Openverse'}
    </figcaption>
  );

  const lineaSubtitulo = subtitulo && subtitulo.palabras.length > 0 && subtitulo.activa >= 0
    ? tramoSubtitulo(subtitulo.palabras, subtitulo.activa)
    : null;

  return (
    <>
      {!soloCine && (
        <figure className={styles.marco}>
          {renderSlideCanvas(false)}
          {credito}
        </figure>
      )}

      {/* Portal de Modo Cine / Teatro Flotante */}
      {isTheater &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className={styles.theaterBackdrop} onClick={onToggleTheater}>
            <div className={styles.theaterContainer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.theaterHeaderBar}>
                <div className={styles.theaterBadge}>
                  <Clapperboard size={18} />
                  <span>Modo Cine · Microclase Audiovisual</span>
                </div>
                {onToggleTheater && (
                  <button
                    type="button"
                    onClick={onToggleTheater}
                    className={styles.theaterCloseBtn}
                    aria-label="Cerrar Modo Cine"
                  >
                    <X size={15} />
                    <span>Cerrar (Esc)</span>
                  </button>
                )}
              </div>

              <figure className={styles.theaterSlideBox}>
                {renderSlideCanvas(true)}
                {credito}
              </figure>

              {/* Subtítulos: la palabra que suena, resaltada (decorativo: el guion completo está en la página) */}
              {lineaSubtitulo && (
                <p className={styles.subtitulos} aria-hidden="true">
                  {lineaSubtitulo.palabras.map((p, i) => (
                    <span
                      key={lineaSubtitulo.inicio + i}
                      className={lineaSubtitulo.inicio + i === subtitulo?.activa ? styles.subtituloActiva : undefined}
                    >
                      {p}{' '}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

