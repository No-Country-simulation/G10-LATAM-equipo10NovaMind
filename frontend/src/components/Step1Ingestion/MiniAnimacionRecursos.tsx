import styles from './MiniAnimacionRecursos.module.css';

/**
 * Indicador visual del pipeline pedagógico:
 * Muestra el flujo de transformación desde el documento origen (PDF/MD/TXT) hacia
 * las 4 estaciones didácticas (Video narrado, Diagrama interactivo, Resumen técnico y Quiz).
 */
export const MiniAnimacionRecursos = () => (
  <div className={styles.contenedor}>
    <svg className={styles.lienzo} viewBox="0 0 280 44" aria-hidden="true" focusable="false">
      <defs>
        {/* Glow neón para los nodos y la línea de flujo */}
        <filter id="mini-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Documento Fuente */}
      <g className={styles.hoja}>
        <path d="M6 5 h18 l7 7 v24 h-25 z" fill="#111625" stroke="#3b4461" strokeWidth="1.2" />
        <path d="M24 5 v7 h7" fill="#1e263d" stroke="#3b4461" strokeWidth="1.2" />
        <g stroke="#64748b" strokeWidth="1.8" strokeLinecap="round">
          <line x1="11" y1="18" x2="26" y2="18" />
          <line x1="11" y1="23" x2="23" y2="23" />
          <line x1="11" y1="28" x2="26" y2="28" />
        </g>
      </g>

      {/* Pipeline de conexión guiado */}
      <line className={styles.flujo} x1="38" y1="22" x2="68" y2="22" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M68 18 l5 4 l-5 4" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.flecha} />

      {/* 1. Video Narrado */}
      <g className={`${styles.recurso} ${styles.r1}`} filter="url(#mini-glow)">
        <rect x="84" y="8" width="38" height="28" rx="6" className={styles.fondoRecurso} stroke="#c084fc" strokeWidth="1.2" />
        <circle cx="103" cy="22" r="7" fill="#8b5cf6" fillOpacity="0.35" />
        <path d="M101 18.5 l5 3.5 l-5 3.5 z" fill="#ffffff" />
      </g>

      {/* 2. Diagrama */}
      <g className={`${styles.recurso} ${styles.r2}`} filter="url(#mini-glow)">
        <rect x="130" y="8" width="38" height="28" rx="6" className={styles.fondoRecurso} stroke="#22d3ee" strokeWidth="1.2" />
        <g fill="#22d3ee">
          <rect x="137" y="13" width="8" height="6" rx="1.5" />
          <rect x="151" y="13" width="8" height="6" rx="1.5" />
          <rect x="144" y="24" width="8" height="6" rx="1.5" />
        </g>
        <g stroke="#67e8f9" strokeWidth="1" strokeDasharray="1.5 1.5">
          <line x1="141" y1="19" x2="146" y2="24" />
          <line x1="155" y1="19" x2="150" y2="24" />
        </g>
      </g>

      {/* 3. Resumen */}
      <g className={`${styles.recurso} ${styles.r3}`} filter="url(#mini-glow)">
        <rect x="176" y="8" width="38" height="28" rx="6" className={styles.fondoRecurso} stroke="#34d399" strokeWidth="1.2" />
        <g stroke="#34d399" strokeWidth="2" strokeLinecap="round">
          <line x1="184" y1="15" x2="204" y2="15" />
          <line x1="184" y1="21" x2="198" y2="21" />
          <line x1="184" y1="27" x2="204" y2="27" />
        </g>
      </g>

      {/* 4. Quiz */}
      <g className={`${styles.recurso} ${styles.r4}`} filter="url(#mini-glow)">
        <rect x="222" y="8" width="38" height="28" rx="6" className={styles.fondoRecurso} stroke="#fbbf24" strokeWidth="1.2" />
        <circle cx="241" cy="22" r="8" fill="#fbbf24" fillOpacity="0.15" />
        <text x="241" y="26.5" textAnchor="middle" className={styles.pregunta}>?</text>
      </g>
    </svg>
  </div>
);