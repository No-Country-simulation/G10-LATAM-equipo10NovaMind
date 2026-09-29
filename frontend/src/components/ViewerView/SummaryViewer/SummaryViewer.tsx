import React from 'react';
import { Zap } from 'lucide-react';
import type { SummaryItem } from '../../../types/api';
import styles from './SummaryViewer.module.css';

interface SummaryViewerProps {
  items?: SummaryItem[];
  title?: string;
  introduccion?: string;
}

const DEFAULT_SUMMARY: SummaryItem[] = [
  {
    punto: 'Una VCN es tu red privada y personalizable dentro de Oracle Cloud.',
    por_que_importa: 'Aísla completamente los entornos de computación de accesos no autorizados.',
  },
  {
    punto: 'Las subredes organizan tus recursos en espacios públicos y privados.',
    por_que_importa: 'Permite que la base de datos nunca esté expuesta a la Internet pública.',
  },
  {
    punto: 'Security Lists controlan de forma granular el tráfico permitido.',
    por_que_importa: 'Asegura cumplimiento normativo y filtrado de puertos estricto.',
  },
];

export const SummaryViewer: React.FC<SummaryViewerProps> = ({
  items,
  title = 'Arquitectura VCN en OCI',
  introduccion,
}) => {
  const summaryList = (items && items.length > 0) ? items : DEFAULT_SUMMARY;

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
        <h2>{title}</h2>
      </div>

      {introduccion && (
        <div style={{ marginBottom: '1.25rem', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          <p>{introduccion}</p>
        </div>
      )}

      <div className={styles.sixty}>
        <h3>Lo que debes saber en 60 segundos</h3>
        <ul>
          {summaryList.map((item, index) => (
            <li key={index}>
              <strong>{item.punto || item.encabezado || item.subtitulo}</strong>
              {(item.por_que_importa || item.aplicacion_practica || item.desarrollo) && (
                <span style={{ display: 'block', opacity: 0.8, fontSize: '0.88rem', marginTop: '0.2rem' }}>
                  {item.por_que_importa || item.aplicacion_practica || item.desarrollo}
                </span>
              )}
            </li>
          ))}
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