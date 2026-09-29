import React from 'react';
import { Play } from 'lucide-react';
import styles from './ScriptViewer.module.css';

const SCENES = [
  {
    time: '00:00 — 01:00',
    title: 'Contexto',
    narration:
      'Imagina que tu equipo necesita una red privada y segura dentro de Oracle Cloud.',
    visual: 'Diagrama de una VCN con subredes.',
  },
  {
    time: '01:00 — 03:30',
    title: 'Conceptos clave',
    narration:
      'Dentro de la VCN divides el espacio en subredes públicas y privadas.',
    visual: 'Animación de tráfico ingress y egress.',
  },
  {
    time: '03:30 — 05:00',
    title: 'Cierre',
    narration:
      'Las reglas de seguridad son las guardianas de tu arquitectura.',
    visual: 'Checklist final de seguridad.',
  },
];

export const ScriptViewer: React.FC = () => {
  return (
    <div className={styles.script}>
      <div className={styles.surfaceTop}>
        <span>GUION EDUCATIVO · REDES PRIVADAS VCN</span>
        <span className={styles.sourceAnchor}>
          <Play size={12} /> DURACIÓN: 5 MIN
        </span>
      </div>

      {SCENES.map(({ time, title, narration, visual }) => (
        <div className={styles.scriptRow} key={time}>
          <div className={styles.scriptTime}>
            <span>
              <span className={styles.pulseDot} />
              {time}
            </span>
            <b>{title}</b>
          </div>

          <div className={styles.scriptCol}>
            <span>LOCUCIÓN / SCRIPT</span>
            <p>{narration}</p>
          </div>

          <div className={styles.scriptCol}>
            <span>APOYO VISUAL SUGERIDO</span>
            <p>{visual}</p>
          </div>
        </div>
      ))}
    </div>
  );
};