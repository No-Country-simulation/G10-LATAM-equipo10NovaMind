import { Languages } from 'lucide-react';
import { regionDeVoz } from '../../../utils/vozNavegador';
import styles from './EstudioDirector.module.css';

interface SelectorAcentoProps {
  voces: SpeechSynthesisVoice[];
  vozElegida: string;
  onVoz: (nombre: string) => void;
  /** Mientras el navegador aún no entregó sus voces */
  cargando: boolean;
}

/**
 * Acento de la voz del navegador (teleprompter y video). Las voces dependen del equipo:
 * Edge trae voces de muchos países; Chrome y Firefox, pocas.
 */
export const SelectorAcento = ({ voces, vozElegida, onVoz, cargando }: SelectorAcentoProps) => {
  if (cargando) {
    return <span className={styles.accentHint}>Buscando las voces del navegador…</span>;
  }
  if (voces.length === 0) {
    return (
      <span className={styles.accentWarn} role="note">
        Este navegador no tiene voces en español: el video usará la voz del servidor. Para elegir acento, prueba con
        Edge.
      </span>
    );
  }
  return (
    <label className={styles.accentPicker}>
      <Languages size={14} aria-hidden="true" />
      <span className={styles.accentLabel}>Acento</span>
      <select className={styles.accentSelect} value={vozElegida} onChange={(e) => onVoz(e.target.value)}>
        {voces.map((v) => (
          <option key={v.name} value={v.name}>
            {regionDeVoz(v.lang)} · {v.name}
          </option>
        ))}
      </select>
    </label>
  );
};
