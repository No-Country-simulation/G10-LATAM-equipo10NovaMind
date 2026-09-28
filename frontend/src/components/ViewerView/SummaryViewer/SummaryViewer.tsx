import React from 'react';
import { Zap } from 'lucide-react';
import styles from './SummaryViewer.module.css';

interface SummaryViewerProps {
  title?: string;
  points?: string[];
}

const DEFAULT_POINTS = [
  'Una VCN es tu red privada virtual en Oracle Cloud Infrastructure, análoga a un centro de datos on-premise.',
  'Las subredes dividen la carga para aislar tráfico expuesto a Internet del almacenamiento crítico.',
  'Las Security Lists proveen inspección de paquetes con reglas de ingress y egress obligatorias.',
];

export const SummaryViewer: React.FC<SummaryViewerProps> = ({
  title = 'Arquitectura VCN en OCI',
  points = DEFAULT_POINTS,
}) => {
  return (
    <div className={styles.summaryWrap}>
      <div className={styles.surfaceTop}>
        <span>RESUMEN EJECUTIVO (TL;DR)</span>
        <span className={styles.sourceAnchor}>
          <Zap size={13} /> LECTURA: 1 MIN
        </span>
      </div>

      <div className={styles.summaryHeader}>
        <span>Formato: Síntesis breve para toma de decisiones</span>
        <h2>{title}</h2>
      </div>

      <div className={styles.highlightBox}>
        <h3>Lo que debes saber en 60 segundos</h3>
        <ul>
          {points.map((pt, i) => (
            <li key={i}>{pt}</li>
          ))}
        </ul>
      </div>

      <div className={styles.impactGrid}>
        <div className={styles.impactCard}>
          <span>NIVEL DE RIESGO</span>
          <b className={styles.greenText}>Bajo (Aislado)</b>
        </div>
        <div className={styles.impactCard}>
          <span>TIEMPO ESTIMADO</span>
          <b>&lt; 5 minutos</b>
        </div>
        <div className={styles.impactCard}>
          <span>COMPATIBILIDAD</span>
          <b>Multi-Region OCI</b>
        </div>
      </div>
    </div>
  );
};