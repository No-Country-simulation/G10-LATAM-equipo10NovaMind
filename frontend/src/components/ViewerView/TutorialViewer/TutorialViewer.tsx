import React, { useState } from 'react';
import { BookOpen, Check, ChevronDown } from 'lucide-react';
import type { TutorialItem } from '../../../types/api';
import styles from './TutorialViewer.module.css';

interface TutorialViewerProps {
  items?: TutorialItem[];
  title?: string;
}

const DEFAULT_ITEMS: TutorialItem[] = [
  {
    titulo: 'Define el perímetro',
    instruccion: 'Crea una VCN y asigna un rango CIDR para tu entorno.',
  },
  {
    titulo: 'Divide los espacios en sectores',
    instruccion: 'Crea subredes públicas y privadas para organizar tus recursos.',
  },
  {
    titulo: 'Asigna las guardias de seguridad',
    instruccion: 'Configura Security Lists para controlar ingress y egress.',
  },
];

export const TutorialViewer: React.FC<TutorialViewerProps> = ({
  items,
  title = 'Domina redes en la nube desde cero',
}) => {
  const [checked, setChecked] = useState<number[]>([]);

  const stepList = (items && items.length > 0) ? items : DEFAULT_ITEMS;

  const toggleStep = (index: number) => {
    setChecked((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.surfaceTop}>
        <span>GUÍA PRÁCTICA · {stepList.length} PASOS</span>
        <span className={styles.sourceAnchor}>
          <BookOpen size={12} /> CONCEPTOS APLICADOS
        </span>
      </div>

      <h2 className={styles.title}>{title}</h2>

      {stepList.map((item, index) => {
        const stepNum = item.numero_paso ?? index + 1;
        const stepTitle = item.titulo || item.title || `Paso ${stepNum}`;
        const stepDesc = item.instruccion || item.desc || '';
        const isDone = checked.includes(index);

        return (
          <button
            key={`${index}-${stepTitle}`}
            type="button"
            className={`${styles.tutorialStep} ${isDone ? styles.done : ''}`}
            onClick={() => toggleStep(index)}
          >
            <span className={styles.stepCheck}>
              {isDone ? <Check size={13} /> : stepNum}
            </span>
            <span className={styles.stepContent}>
              <b>Paso {stepNum} · {stepTitle}</b>
              {stepDesc && <small>{stepDesc}</small>}
            </span>
            <ChevronDown size={15} className={styles.chevronIcon} />
          </button>
        );
      })}
    </div>
  );
};