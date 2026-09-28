import React, { useState } from 'react';
import { BookOpen, Check, ChevronDown } from 'lucide-react';
import styles from './TutorialViewer.module.css';

interface TutorialItem {
  title: string;
  desc: string;
}

const DEFAULT_ITEMS: TutorialItem[] = [
  {
    title: 'Define el perímetro',
    desc: 'Crea una VCN y asigna un rango CIDR para tu entorno.',
  },
  {
    title: 'Divide los espacios en sectores',
    desc: 'Crea subredes públicas y privadas para organizar tus recursos.',
  },
  {
    title: 'Asigna las guardias de seguridad',
    desc: 'Configura Security Lists para controlar ingress y egress.',
  },
];

export const TutorialViewer: React.FC = () => {
  const [checked, setChecked] = useState<number[]>([]);

  const toggleStep = (index: number) => {
    setChecked((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className={styles.tutorial}>
      <div className={styles.surfaceTop}>
        <span>GUÍA PRÁCTICA · 3 PASOS</span>
        <span className={styles.sourceAnchor}>
          <BookOpen size={12} /> CONCEPTOS APLICADOS
        </span>
      </div>

      <h2 className={styles.title}>Domina redes en la nube desde cero</h2>

      {DEFAULT_ITEMS.map((item, index) => {
        const isDone = checked.includes(index);
        return (
          <button
            key={item.title}
            type="button"
            className={`${styles.tutorialStep} ${isDone ? styles.done : ''}`}
            onClick={() => toggleStep(index)}
          >
            <span className={styles.stepCheck}>
              {isDone ? <Check size={13} /> : index + 1}
            </span>
            <span className={styles.stepContent}>
              <b>Paso {index + 1} · {item.title}</b>
              <small>{item.desc}</small>
            </span>
            <ChevronDown size={15} className={styles.chevronIcon} />
          </button>
        );
      })}
    </div>
  );
};