import { BookMarked } from 'lucide-react';
import type { PuntoRepaso } from '../../../utils/repasoQuiz';
import { FuenteChip } from '../../RecursoEstado/RecursoEstado';
import styles from './Station5Quiz.module.css';

interface RepasoGuiadoProps {
  puntos: PuntoRepaso[];
  /**
   * Con los escudos agotados el quiz se repite con las mismas preguntas: solo se indica dónde
   * releer. Tras aprobar se muestran también la respuesta y por qué fallaban las descartadas.
   */
  revelarRespuestas: boolean;
}

/** Preguntas falladas con su cita y página reales del documento, para releer antes de seguir. */
export const RepasoGuiado = ({ puntos, revelarRespuestas }: RepasoGuiadoProps) => {
  if (puntos.length === 0) return null;
  return (
    <section className={styles.repasoBox} aria-label="Repaso guiado">
      <div className={styles.repasoHeader}>
        <BookMarked size={16} />
        <span>Repasa esto ({puntos.length})</span>
      </div>
      <p className={styles.repasoIntro}>
        {revelarRespuestas
          ? 'Las preguntas donde dudaste, con el fragmento del documento que las responde.'
          : 'Antes de volver a intentarlo, relee en el documento el fragmento de cada pregunta que fallaste.'}
      </p>
      <ol className={styles.repasoList}>
        {puntos.map((p) => (
          <li key={p.indice} className={styles.repasoItem}>
            <div className={styles.repasoPregunta}>
              <span className={styles.repasoNumero}>Desafío 0{p.indice + 1}</span>
              <span className={styles.repasoFallos}>
                {p.fallos} {p.fallos === 1 ? 'fallo' : 'fallos'}
              </span>
            </div>
            <p className={styles.repasoTexto}>{p.pregunta}</p>

            {revelarRespuestas && (
              <>
                <p className={styles.repasoTexto}>
                  <strong>Respuesta correcta:</strong> {p.respuesta}. {p.justificacion}
                </p>
                {p.descartadas.map((d) => (
                  <p key={d.opcion} className={styles.repasoDescartada}>
                    <strong>Descartaste «{d.opcion}»</strong>
                    {d.explicacion ? `: ${d.explicacion}` : ''}
                  </p>
                ))}
              </>
            )}

            {p.cita ? (
              <div className={styles.ragCitation}>
                <strong style={{ color: 'var(--color-violet-300)' }}>Relee en el documento:</strong>{' '}
                «{p.cita}» <FuenteChip fuente={p.fuente} />
              </div>
            ) : (
              <p className={styles.repasoDescartada}>Esta pregunta no trae una cita del documento.</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
};
