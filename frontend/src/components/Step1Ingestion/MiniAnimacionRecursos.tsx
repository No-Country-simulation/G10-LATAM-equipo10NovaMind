import styles from './MiniAnimacionRecursos.module.css';

/**
 * Junto al botón «Generar»: una hoja que se convierte en los recursos del paquete (video,
 * diagrama, resumen y quiz). Versión pequeña y horizontal de HeroAnimacion; solo decoración.
 */
export const MiniAnimacionRecursos = () => (
  <svg className={styles.lienzo} viewBox="0 0 280 48" aria-hidden="true" focusable="false">
    {/* Hoja */}
    <g className={styles.hoja}>
      <path d="M8 6 h20 l8 8 v28 h-28 z" fill="#161c2c" stroke="#5b6584" strokeWidth="1.3" />
      <path d="M28 6 v8 h8" fill="#262d42" stroke="#5b6584" strokeWidth="1.3" />
      <g stroke="#6b7594" strokeWidth="2" strokeLinecap="round">
        <line x1="13" y1="20" x2="31" y2="20" />
        <line x1="13" y1="26" x2="28" y2="26" />
        <line x1="13" y1="32" x2="31" y2="32" />
      </g>
    </g>

    {/* Flujo hacia los recursos */}
    <line className={styles.flujo} x1="44" y1="24" x2="74" y2="24" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
    <path d="M74 19 l6 5 l-6 5" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.flecha} />

    {/* Video */}
    <g className={`${styles.recurso} ${styles.r1}`}>
      <rect x="92" y="9" width="38" height="30" rx="7" fill="#e879f9" fillOpacity="0.16" stroke="#e879f9" strokeWidth="1.3" />
      <path d="M106 17 l10 7 l-10 7 z" fill="#f0abfc" />
    </g>

    {/* Diagrama */}
    <g className={`${styles.recurso} ${styles.r2}`}>
      <rect x="138" y="9" width="38" height="30" rx="7" fill="#22d3ee" fillOpacity="0.14" stroke="#22d3ee" strokeWidth="1.3" />
      <g fill="#67e8f9">
        <rect x="145" y="14" width="9" height="7" rx="2" />
        <rect x="160" y="14" width="9" height="7" rx="2" />
        <rect x="152.5" y="27" width="9" height="7" rx="2" />
      </g>
      <g stroke="#67e8f9" strokeWidth="1.2">
        <line x1="149.5" y1="21" x2="155" y2="27" />
        <line x1="164.5" y1="21" x2="159" y2="27" />
      </g>
    </g>

    {/* Resumen */}
    <g className={`${styles.recurso} ${styles.r3}`}>
      <rect x="184" y="9" width="38" height="30" rx="7" fill="#34d399" fillOpacity="0.14" stroke="#34d399" strokeWidth="1.3" />
      <g stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round">
        <line x1="192" y1="17" x2="214" y2="17" />
        <line x1="192" y1="24" x2="210" y2="24" />
        <line x1="192" y1="31" x2="214" y2="31" />
      </g>
    </g>

    {/* Quiz */}
    <g className={`${styles.recurso} ${styles.r4}`}>
      <rect x="230" y="9" width="38" height="30" rx="7" fill="#fbbf24" fillOpacity="0.14" stroke="#fbbf24" strokeWidth="1.3" />
      <text x="249" y="30" textAnchor="middle" className={styles.pregunta}>?</text>
    </g>
  </svg>
);
