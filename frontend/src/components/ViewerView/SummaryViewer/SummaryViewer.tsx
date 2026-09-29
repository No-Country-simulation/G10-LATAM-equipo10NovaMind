import React from 'react';
import { Zap } from 'lucide-react';
import styles from './SummaryViewer.module.css';

export const SummaryViewer: React.FC = () => {
  return (
    <div className={styles.summary}>
      <div className={styles.surfaceTop}>
        <span>RESUMEN EJECUTIVO</span>
        <span className={styles.sourceAnchor}>
          <Zap size={12} /> LECTURA: 1 MIN
        </span>
      </div>

      <div className={styles.summaryTitle}>
        <span>Formato: Síntesis breve</span>
        <h2>Arquitectura VCN en OCI</h2>
      </div>

      <div className={styles.sixty}>
        <h3>Lo que debes saber en 60 segundos</h3>
        <ul>
          <li>Una VCN es tu red privada y personalizable dentro de Oracle Cloud.</li>
          <li>Las subredes organizan tus recursos en espacios públicos y privados.</li>
          <li>Security Lists controlan de forma granular el tráfico permitido.</li>
        </ul>
      </div>

      <div className={styles.impactGrid}>
        <div className={styles.impactCard}>
          <span>NIVEL DE RIESGO</span>
          <b className={styles.greenText}>Bajo (Aislado)</b>
        </div>
        <div className={styles.impactCard}>
          <span>TIEMPO DE DESPLIEGUE</span>
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