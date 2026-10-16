import styles from './HeroAnimacion.module.css';

/**
 * Fondo del banner del paso 1: un PDF que se lee y se convierte en los recursos del paquete
 * (video, diagrama, resumen y quiz). Solo decoración: SVG con animaciones CSS, sin librerías,
 * oculta a los lectores de pantalla y quieta con prefers-reduced-motion.
 */
export const HeroAnimacion = () => (
  <svg className={styles.lienzo} viewBox="0 0 520 300" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="hero-hoja" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1b2133" />
        <stop offset="100%" stopColor="#121726" />
      </linearGradient>
      <linearGradient id="hero-escaner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
        <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
      </linearGradient>
      <clipPath id="hero-recorte-hoja">
        <path d="M30 70 h76 l22 22 v138 h-98 z" />
      </clipPath>
    </defs>

    {/* Caminos del documento a cada recurso: puntos que fluyen */}
    <g className={styles.caminos} fill="none" strokeWidth="2" strokeLinecap="round">
      <path className={`${styles.camino} ${styles.c1}`} d="M134 150 C 210 150, 230 46, 318 46" stroke="#e879f9" />
      <path className={`${styles.camino} ${styles.c2}`} d="M134 150 C 210 150, 230 114, 318 114" stroke="#22d3ee" />
      <path className={`${styles.camino} ${styles.c3}`} d="M134 150 C 210 150, 230 186, 318 186" stroke="#34d399" />
      <path className={`${styles.camino} ${styles.c4}`} d="M134 150 C 210 150, 230 254, 318 254" stroke="#fbbf24" />
    </g>

    {/* El documento: hoja con esquina doblada, etiqueta PDF y renglones que se leen */}
    <g className={styles.documento}>
      <path d="M30 70 h76 l22 22 v138 h-98 z" fill="url(#hero-hoja)" stroke="#475069" strokeWidth="1.5" />
      <path d="M106 70 v22 h22" fill="#262d42" stroke="#475069" strokeWidth="1.5" />
      <rect x="40" y="82" width="34" height="15" rx="3" fill="#ef4444" />
      <text x="57" y="93.5" textAnchor="middle" className={styles.etiquetaPdf}>PDF</text>
      <g stroke="#5b6584" strokeWidth="3" strokeLinecap="round">
        <line x1="42" y1="112" x2="116" y2="112" />
        <line x1="42" y1="124" x2="108" y2="124" />
        <line x1="42" y1="136" x2="116" y2="136" />
        <line x1="42" y1="148" x2="96" y2="148" />
        <line x1="42" y1="166" x2="116" y2="166" />
        <line x1="42" y1="178" x2="104" y2="178" />
        <line x1="42" y1="190" x2="116" y2="190" />
        <line x1="42" y1="208" x2="88" y2="208" />
      </g>
      <g clipPath="url(#hero-recorte-hoja)">
        <rect className={styles.escaner} x="30" y="40" width="98" height="34" fill="url(#hero-escaner)" />
      </g>
    </g>

    {/* Recursos que salen del documento */}
    <g className={`${styles.tarjeta} ${styles.t1}`}>
      <rect x="318" y="20" width="182" height="52" rx="10" className={styles.fondoTarjeta} stroke="#e879f9" />
      <rect x="332" y="31" width="44" height="30" rx="5" fill="#e879f9" fillOpacity="0.18" stroke="#e879f9" strokeWidth="1.2" />
      <path d="M349 38 l12 8 l-12 8 z" fill="#f0abfc" />
      <text x="388" y="43" className={styles.titulo}>Video narrado</text>
      <rect x="388" y="52" width="96" height="4" rx="2" fill="#3a3150" />
      <rect className={styles.progreso} x="388" y="52" width="96" height="4" rx="2" fill="#e879f9" />
    </g>

    <g className={`${styles.tarjeta} ${styles.t2}`}>
      <rect x="318" y="88" width="182" height="52" rx="10" className={styles.fondoTarjeta} stroke="#22d3ee" />
      <g stroke="#22d3ee" strokeWidth="1.4" fill="#22d3ee" fillOpacity="0.2">
        <rect x="332" y="97" width="16" height="12" rx="3" />
        <rect x="360" y="97" width="16" height="12" rx="3" />
        <rect x="346" y="119" width="16" height="12" rx="3" />
      </g>
      <g stroke="#67e8f9" strokeWidth="1.4">
        <line x1="348" y1="103" x2="360" y2="103" />
        <line x1="340" y1="109" x2="350" y2="119" />
        <line x1="368" y1="109" x2="358" y2="119" />
      </g>
      <text x="388" y="111" className={styles.titulo}>Diagrama</text>
      <text x="388" y="127" className={styles.detalle}>flujo paso a paso</text>
    </g>

    <g className={`${styles.tarjeta} ${styles.t3}`}>
      <rect x="318" y="160" width="182" height="52" rx="10" className={styles.fondoTarjeta} stroke="#34d399" />
      <g stroke="#34d399" strokeWidth="3" strokeLinecap="round">
        <line x1="334" y1="174" x2="372" y2="174" />
        <line x1="334" y1="185" x2="366" y2="185" />
        <line x1="334" y1="196" x2="372" y2="196" />
      </g>
      <text x="388" y="183" className={styles.titulo}>Resumen</text>
      <text x="388" y="199" className={styles.detalle}>con citas verificadas</text>
    </g>

    <g className={`${styles.tarjeta} ${styles.t4}`}>
      <rect x="318" y="228" width="182" height="52" rx="10" className={styles.fondoTarjeta} stroke="#fbbf24" />
      <circle cx="350" cy="254" r="14" fill="#fbbf24" fillOpacity="0.18" stroke="#fbbf24" strokeWidth="1.4" />
      <text x="350" y="259.5" textAnchor="middle" className={styles.pregunta}>?</text>
      <text x="388" y="251" className={styles.titulo}>Quiz</text>
      <g className={styles.respuestas}>
        <rect x="388" y="260" width="10" height="10" rx="2" fill="#34d399" />
        <path d="M390.5 265 l2 2 l3.5 -4" stroke="#0b1020" strokeWidth="1.6" fill="none" />
        <rect x="404" y="260" width="10" height="10" rx="2" fill="none" stroke="#7c849c" />
        <rect x="420" y="260" width="10" height="10" rx="2" fill="none" stroke="#7c849c" />
      </g>
    </g>
  </svg>
);
