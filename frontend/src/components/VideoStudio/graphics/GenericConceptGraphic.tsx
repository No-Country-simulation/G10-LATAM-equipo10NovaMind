import type { AudiovisualScene } from '../../../types/videoStudio';
import { Sparkles, Cloud } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const GenericConceptGraphic = ({ scene }: Props) => {
  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      {/* Dynamic Central Hologram Concept Node */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', zIndex: 2 }}>
        <div style={{ width: '90px', height: '90px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)', border: '1px solid rgba(6, 182, 212, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 35px rgba(139, 92, 246, 0.4)', animation: 'pulseGlow 4s ease-in-out infinite alternate' }}>
          <Cloud size={44} color="#67e8f9" />
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '640px' }}>
          {scene.textoEnPantalla.puntosClave.map((pt, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(13, 17, 26, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '0.625rem 1rem',
                fontSize: '0.8125rem',
                color: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <Sparkles size={14} color="#f0abfc" />
              <span>{pt}</span>
            </div>
          ))}
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
