import { useEffect, useState } from 'react';
import type { AudiovisualScene } from '../../../types/videoStudio';
import { ShieldAlert, Cpu, Server, Activity, ArrowRight } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const ServerTrafficGraphic = ({ scene }: Props) => {
  const [trafficRate, setTrafficRate] = useState(12450);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrafficRate(Math.floor(10000 + Math.random() * 5000));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', width: '90%', maxWidth: '820px', zIndex: 2 }}>
        {/* DDoS Traffic Ingress */}
        <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.35)', borderRadius: '18px', padding: '1.25rem', width: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="#fb7185" />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#fb7185' }}>Tráfico Masivo</span>
          <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.875rem', color: '#f8fafc', fontWeight: 700 }}>
            {trafficRate.toLocaleString()} req/s
          </span>
          <span style={{ fontSize: '10px', color: '#fda4af' }}>Ataque DDoS L7 Simulado</span>
        </div>

        <ArrowRight size={24} color="#64748b" />

        {/* OCI Web Application Firewall (WAF) */}
        <div style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid #8b5cf6', borderRadius: '20px', padding: '1.5rem', width: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem', textAlign: 'center', boxShadow: '0 0 25px rgba(139, 92, 246, 0.25)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(139, 92, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={26} color="#c4b5fd" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 700, color: '#fff' }}>OCI WAF & Shield</span>
          <span style={{ fontSize: '10px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '999px' }}>
            99.9% Paquetes Filtrados
          </span>
        </div>

        <ArrowRight size={24} color="#10b981" />

        {/* Clean Balanced Servers */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '200px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.35)', borderRadius: '14px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={18} color="#22d3ee" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>App Node 01</span>
              <span style={{ fontSize: '10px', color: '#34d399' }}>CPU: 24% · Healthy</span>
            </div>
          </div>

          <div style={{ background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.35)', borderRadius: '14px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={18} color="#22d3ee" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>App Node 02</span>
              <span style={{ fontSize: '10px', color: '#34d399' }}>CPU: 18% · Healthy</span>
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
