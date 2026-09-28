import React, { useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import styles from './TutorialViewer.module.css';

interface TutorialItem {
  titulo: string;
  descripcion: string;
}

interface TutorialViewerProps {
  items?: TutorialItem[];
}

const DEFAULT_ITEMS: TutorialItem[] = [
  {
    titulo: 'Define el perímetro de red (VCN)',
    descripcion: 'Crea una Virtual Cloud Network en OCI y asigna un bloque de direcciones CIDR privado (ej: 10.0.0.0/16).',
  },
  {
    titulo: 'Segmenta mediante subredes públicas y privadas',
    descripcion: 'Divide la red en subredes públicas para balanceadores e Internet Gateways, y privadas para bases de datos y servidores.',
  },
  {
    titulo: 'Establece reglas de seguridad (Security Lists)',
    descripcion: 'Configura directivas de firewall virtual tanto para tráfico entrante (ingress) como para tráfico saliente (egress).',
  },
];

export const TutorialViewer: React.FC<TutorialViewerProps> = ({
  items = DEFAULT_ITEMS,
}) => {
  const [completed, setCompleted] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setCompleted((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className={styles.tutorialWrap}>
      <div className={styles.surfaceTop}>
        <span>GUÍA PRÁCTICA · {items.length} PASOS</span>
        <span className={styles.sourceAnchor}>
          <BookOpen size={13} /> CONCEPTOS APLICADOS
        </span>
      </div>

      <h2 className={styles.title}>Domina redes en la nube paso a paso</h2>

      <div className={styles.stepsList}>
        {items.map((step, idx) => {
          const isDone = completed.includes(idx);
          return (
            <button
              key={step.titulo}
              type="button"
              className={`${styles.stepCard} ${isDone ? styles.done : ''}`}
              onClick={() => toggleStep(idx)}
            >
              <span className={styles.stepCheck}>
                {isDone ? <Check size={14} /> : idx + 1}
              </span>
              <span className={styles.stepBody}>
                <b>Paso {idx + 1} · {step.titulo}</b>
                <small>{step.descripcion}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};