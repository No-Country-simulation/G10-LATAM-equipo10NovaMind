import type { AudiovisualScene } from '../../../types/videoStudio';
import { XCircle, CheckCircle, Clock, Zap, DollarSign, Cloud } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const ComparisonGraphic = ({ scene }: Props) => {
  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      <div className={styles.comparisonContainer}>
        {/* Left Side: On-Prem Legacy */}
        <div className={styles.comparisonCardLegacy}>
          <div className={styles.comparisonTagLegacy}>Arquitectura Tradicional</div>
          <h4 className={styles.comparisonTitle}>Centro de Cómputo Físico</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#fca5a5' }}>
              <Clock size={16} color="#f87171" />
              <span>3 meses de compra e instalación</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#fca5a5' }}>
              <XCircle size={16} color="#f87171" />
              <span>Cables enredados y fallos mecánicos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#fca5a5' }}>
              <DollarSign size={16} color="#f87171" />
              <span>Alto costo de infraestructura inicial</span>
            </div>
          </div>
        </div>

        {/* Right Side: OCI Cloud Always Free */}
        <div className={styles.comparisonCardOCI}>
          <div className={styles.comparisonTagOCI}>NuevaMente · OCI Always Free</div>
          <h4 className={styles.comparisonTitle}>Red Virtual VCN en la Nube</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#67e8f9' }}>
              <Zap size={16} color="#22d3ee" />
              <span>Aprovisionamiento en 3 segundos</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#67e8f9' }}>
              <CheckCircle size={16} color="#34d399" />
              <span>Aislamiento por software y Security Lists</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#67e8f9' }}>
              <Cloud size={16} color="#c084fc" />
              <span>$0.00 en capa Always Free</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Metric Card */}
      {scene.elementosGraficos.metricaDestacada && (
        <div className={styles.metricCard}>
          <div>
            <div className={styles.metricValue}>
              {scene.elementosGraficos.metricaDestacada.valor}
            </div>
            <div className={styles.metricLabel}>
              {scene.elementosGraficos.metricaDestacada.etiqueta}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
