import { useEffect, useState } from 'react';
import type { AudiovisualScene } from '../../../types/videoStudio';
import { Globe, ShieldCheck, Server, Database, Lock, ArrowRight } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const NetworkTopologyGraphic = ({ scene }: Props) => {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseIndex(p => (p + 1) % 4);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      {/* SVG Topology Wireframe */}
      <svg
        viewBox="0 0 800 450"
        style={{ width: '100%', height: '100%', maxWidth: '800px', zIndex: 2 }}
      >
        <defs>
          <linearGradient id="gradCyanViolet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* VCN Boundary */}
        <rect
          x="160"
          y="40"
          width="600"
          height="370"
          rx="24"
          fill="rgba(139, 92, 246, 0.03)"
          stroke="#8b5cf6"
          strokeWidth="1.5"
          strokeDasharray="8,6"
          className={styles.animatedPath}
        />
        <text x="180" y="70" fill="#c4b5fd" fontSize="12" fontFamily="JetBrains Mono" fontWeight="600">
          OCI Virtual Cloud Network (VCN · 10.0.0.0/16)
        </text>

        {/* Subnet Public Boundary */}
        <rect
          x="200"
          y="100"
          width="240"
          height="280"
          rx="16"
          fill="rgba(6, 182, 212, 0.05)"
          stroke="#06b6d4"
          strokeWidth="1.2"
          strokeDasharray="4,4"
        />
        <text x="220" y="130" fill="#67e8f9" fontSize="11" fontFamily="JetBrains Mono">
          Subred Pública (10.0.1.0/24)
        </text>

        {/* Subnet Private Boundary */}
        <rect
          x="490"
          y="100"
          width="240"
          height="280"
          rx="16"
          fill="rgba(217, 70, 239, 0.05)"
          stroke="#d946ef"
          strokeWidth="1.2"
          strokeDasharray="4,4"
        />
        <text x="510" y="130" fill="#f0abfc" fontSize="11" fontFamily="JetBrains Mono">
          Subred Privada (10.0.2.0/24)
        </text>

        {/* Connection Paths */}
        {/* Internet to IGW */}
        <line
          x1="80"
          y1="230"
          x2="160"
          y2="230"
          stroke="#06b6d4"
          strokeWidth="2"
          strokeDasharray="5,5"
          className={styles.animatedPath}
        />

        {/* IGW to Public Server */}
        <line
          x1="180"
          y1="230"
          x2="280"
          y2="230"
          stroke="#06b6d4"
          strokeWidth="2"
        />

        {/* Public Server to NAT GW */}
        <path
          d="M 360 230 L 460 230"
          stroke="#8b5cf6"
          strokeWidth="2"
          strokeDasharray="4,4"
        />

        {/* NAT GW to Private DB */}
        <path
          d="M 470 230 L 570 230"
          stroke="#d946ef"
          strokeWidth="2"
          strokeDasharray="5,5"
          className={styles.animatedPath}
        />

        {/* Animated Flying Packet */}
        <circle
          cx={80 + pulseIndex * 170}
          cy="230"
          r="6"
          fill="#38bdf8"
          filter="url(#glowEffect)"
        />
      </svg>

      {/* HTML Overlay Nodes for Rich Tooltips & Icons */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
        {/* Internet Node */}
        <div style={{ position: 'absolute', left: '6%', top: '46%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid #06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(6, 182, 212, 0.3)' }}>
            <Globe size={20} color="#22d3ee" />
          </div>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>Internet (0.0.0.0/0)</span>
        </div>

        {/* Internet Gateway (IGW) */}
        <div style={{ position: 'absolute', left: '21%', top: '46%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color="#a78bfa" />
          </div>
          <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>IGW :443</span>
        </div>

        {/* Public Server (Frontend) */}
        <div style={{ position: 'absolute', left: '40%', top: '46%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(16, 185, 129, 0.25)' }}>
            <Server size={22} color="#34d399" />
          </div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>Frontend / App</span>
          <span style={{ fontSize: '9px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '6px' }}>IP Pública</span>
        </div>

        {/* NAT Gateway */}
        <div style={{ position: 'absolute', left: '58%', top: '46%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={18} color="#fbbf24" />
          </div>
          <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 600 }}>NAT GW (Egress)</span>
        </div>

        {/* Private DB Node */}
        <div style={{ position: 'absolute', left: '78%', top: '46%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(217, 70, 239, 0.2)', border: '1px solid #d946ef', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(217, 70, 239, 0.35)' }}>
            <Database size={24} color="#f0abfc" />
          </div>
          <span style={{ fontSize: '11px', color: '#f8fafc', fontWeight: 700 }}>OCI Autonomous DB</span>
          <span style={{ fontSize: '9px', color: '#f0abfc', background: 'rgba(217, 70, 239, 0.2)', padding: '2px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Lock size={8} /> Prohibit Public IP
          </span>
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
