import type { CSSProperties } from 'react';
import type { DirectorScene, EspecificacionVisual } from '../../../types/types';
import styles from './SlideNarrada.module.css';

const ETIQUETA_VISUAL: Record<EspecificacionVisual['tipo'], string> = {
  diagrama_bloques: 'Diagrama de bloques',
  ppt_concepto: 'Concepto',
  palabras_clave: 'Palabras clave',
  comparativa: 'Comparativa',
};

interface SlideNarradaProps {
  scene: DirectorScene;
  /** Tramo 'MM:SS - MM:SS' de la escena dentro del video */
  span: string;
}

/**
 * Diapositiva del video narrado, dibujada siempre desde el JSON del guion: título,
 * puntos clave y la cita del documento. La foto libre es solo fondo y lleva su crédito,
 * que la licencia CC exige mostrar.
 */
export const SlideNarrada = ({ scene, span }: SlideNarradaProps) => {
  const visual = scene.visual;
  const puntos = (Array.isArray(visual?.puntos_clave) ? visual.puntos_clave : []).slice(0, 4);
  const fuentes = Array.isArray(scene.fuentes) ? scene.fuentes : [];
  // Solo una cita localizada en el documento se muestra como cita: nunca una no verificada.
  const cita = fuentes.find((f) => f.verificada);
  const foto = scene.imagen?.tipo === 'foto' && scene.imagen.url ? scene.imagen : null;
  const etiqueta = visual ? (ETIQUETA_VISUAL[visual.tipo] ?? 'Concepto') : 'Concepto';
  const enFlujo = visual?.tipo === 'diagrama_bloques' && puntos.length > 1;

  return (
    <figure className={styles.marco}>
      <div
        className={`${styles.slide} ${foto ? styles.conFoto : ''}`}
        // JSON.stringify escapa comillas y barras: una URL rara no rompe la regla CSS
        style={foto ? ({ '--foto': `url(${JSON.stringify(foto.url)})` } as CSSProperties) : undefined}
      >
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

      {foto && (
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
      )}
    </figure>
  );
};
