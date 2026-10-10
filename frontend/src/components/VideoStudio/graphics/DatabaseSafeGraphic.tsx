import { useEffect, useState } from 'react';
import type { AudiovisualScene } from '../../../types/videoStudio';
import { Database, Shield, EyeOff, Zap, CheckCircle2 } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const DatabaseSafeGraphic = ({ scene }: Props) => {
  const [isMasked, setIsMasked] = useState(false);
  const [querySpeed, setQuerySpeed] = useState('1,250 ms');

  useEffect(() => {
    const timer = setInterval(() => {
      setIsMasked(prev => !prev);
    }, 2400);

    const speedTimer = setInterval(() => {
      setQuerySpeed(prev => prev === '1,250 ms' ? '2.4 ms (Index B-Tree)' : '1,250 ms');
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(speedTimer);
    };
  }, []);

  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', width: '90%', maxWidth: '780px', zIndex: 2, alignItems: 'center' }}>
        {/* Left Side: Autonomous DB Core & TDE Encryption */}
        <div style={{ background: 'rgba(13, 17, 26, 0.85)', border: '1px solid rgba(139, 92, 246, 0.35)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} color="#8b5cf6" />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Autonomous Database</span>
            </div>
            <span style={{ fontSize: '10px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Zap size={10} /> Auto-tuning ON
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={24} color="#c4b5fd" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>Cifrado TDE 256-bit</span>
              <span style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>Datos en reposo y tránsito cifrados siempre</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6, 182, 212, 0.08)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Tiempo de Consulta SQL:</span>
            <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.875rem', fontWeight: 700, color: querySpeed.includes('2.4') ? '#34d399' : '#fbbf24' }}>
              {querySpeed}
            </span>
          </div>
        </div>

        {/* Right Side: Oracle Data Safe & PCI-DSS Masking */}
        <div style={{ background: 'rgba(13, 17, 26, 0.85)', border: '1px solid rgba(6, 182, 212, 0.35)', borderRadius: '20px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOff size={20} color="#06b6d4" />
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>Oracle Data Safe</span>
            </div>
            <span style={{ fontSize: '10px', color: '#22d3ee', background: 'rgba(6, 182, 212, 0.15)', padding: '2px 8px', borderRadius: '999px' }}>
              PCI-DSS Compliant
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Enmascaramiento de Datos Financieros:
            </span>
            <div style={{ background: '#07090e', border: '1px solid rgba(255,255,255,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', fontFamily: 'var(--font-code)', fontSize: '0.875rem', color: isMasked ? '#34d399' : '#fb7185', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.3s ease' }}>
              <span>{isMasked ? '****-****-****-8842' : '4532-8921-0041-8842'}</span>
              <span style={{ fontSize: '10px', color: isMasked ? '#34d399' : '#fb7185' }}>
                {isMasked ? '🔒 Anonimizado (Dev)' : '⚠️ Dato Real (Prod)'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#a78bfa' }}>
            <CheckCircle2 size={14} color="#34d399" />
            <span>Auditoría continua sin cortes de servicio</span>
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
