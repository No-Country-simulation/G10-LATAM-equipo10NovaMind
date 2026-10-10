import type { AudiovisualScene } from '../../../types/videoStudio';
import { ArrowRight } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const SequentialProcessGraphic = ({ scene }: Props) => {
  const steps = [
    { num: 1, title: 'Segmentación & Ingesta', desc: 'Chunks vectoriales en memoria' },
    { num: 2, title: 'RAG Grounding', desc: 'Verificación de fuentes OCI' },
    { num: 3, title: 'Adaptación Didáctica', desc: 'Narrativa multi-agente' },
    { num: 4, title: 'Despliegue Always Free', desc: 'Persistencia en OCI Object Storage' },
  ];

  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', width: '90%', maxWidth: '820px', zIndex: 2, flexWrap: 'nowrap' }}>
        {steps.map((st, idx) => (
          <div key={st.num} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(13, 17, 26, 0.85)', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: '16px', padding: '1.25rem 1rem', width: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: idx === 1 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(139, 92, 246, 0.2)', border: `1px solid ${idx === 1 ? '#06b6d4' : '#8b5cf6'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: idx === 1 ? '#22d3ee' : '#c4b5fd', fontFamily: 'var(--font-code)' }}>
                0{st.num}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>{st.title}</span>
              <span style={{ fontSize: '0.625rem', color: '#94a3b8' }}>{st.desc}</span>
            </div>

            {idx < steps.length - 1 && (
              <ArrowRight size={18} color="#64748b" style={{ flexShrink: 0 }} />
            )}
          </div>
        ))}
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
