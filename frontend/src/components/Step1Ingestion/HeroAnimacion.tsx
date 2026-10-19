import styles from './HeroAnimacion.module.css';

/**
 * Ilustración SVG animada del Hero:
 * Simula el procesamiento del documento fuente (PDF/MD) dividiéndose en los recursos pedagógicos:
 * Video narrado, Diagrama interactivo, Resumen técnico y Quiz.
 */
export const HeroAnimacion = () => (
  <svg className={styles.lienzo} viewBox="0 0 520 300" aria-hidden="true" focusable="false">
    <defs>
      {/* Degradado Hoja Documento */}
      <linearGradient id="hero-hoja" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1e2438" />
        <stop offset="100%" stopColor="#0d111d" />
      </linearGradient>

      {/* Haz de escaneo láser */}
      <linearGradient id="hero-escaner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c084fc" stopOpacity="0" />
        <stop offset="50%" stopColor="#c084fc" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
      </linearGradient>

      {/* Recorte del documento con solapa plegada */}
      <clipPath id="hero-recorte-hoja">
        <path d="M30 70 h76 l22 22 v138 h-98 z" />
      </clipPath>

      {/* Filtro Glow para líneas de conexión */}
      <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    {/* Caminos de flujo de datos (Líneas con Glow Neón) */}
    <g className={styles.caminos} fill="none" strokeWidth="2" strokeLinecap="round">
      <path className={`${styles.camino} ${styles.c1}`} d="M134 150 C 210 150, 230 46, 318 46" stroke="#c084fc" filter="url(#neon-glow)" />
      <path className={`${styles.camino} ${styles.c2}`} d="M134 150 C 210 150, 230 114, 318 114" stroke="#22d3ee" filter="url(#neon-glow)" />
      <path className={`${styles.camino} ${styles.c3}`} d="M134 150 C 210 150, 230 186, 318 186" stroke="#34d399" filter="url(#neon-glow)" />
      <path className={`${styles.camino} ${styles.c4}`} d="M134 150 C 210 150, 230 254, 318 254" stroke="#fbbf24" filter="url(#neon-glow)" />
    </g>

    {/* Documento Fuente */}
    <g className={styles.documento}>
      <path d="M30 70 h76 l22 22 v138 h-98 z" fill="url(#hero-hoja)" stroke="#384260" strokeWidth="1.5" />
      <path d="M106 70 v22 h22" fill="#20273c" stroke="#384260" strokeWidth="1.5" />
      
      {/* Badge PDF Fuente */}
      <rect x="42" y="82" width="34" height="15" rx="3" fill="#f43f5e" />
      <text x="59" y="93.5" textAnchor="middle" className={styles.etiquetaPdf}>PDF</text>
      
      {/* Líneas de texto simuladas */}
      <g stroke="#4f5979" strokeWidth="3" strokeLinecap="round">
        <line x1="44" y1="112" x2="114" y2="112" />
        <line x1="44" y1="124" x2="104" y2="124" />
        <line x1="44" y1="136" x2="114" y2="136" />
        <line x1="44" y1="148" x2="94" y2="148" />
        <line x1="44" y1="166" x2="114" y2="166" />
        <line x1="44" y1="178" x2="102" y2="178" />
        <line x1="44" y1="190" x2="114" y2="190" />
        <line x1="44" y1="208" x2="86" y2="208" />
      </g>

      {/* Escáner de análisis IA */}
      <g clipPath="url(#hero-recorte-hoja)">
        <rect className={styles.escaner} x="30" y="40" width="98" height="32" fill="url(#hero-escaner)" />
      </g>
    </g>

    {/* Tarjeta 1: Video Narrado (Estilo Player Real) */}
    <g className={`${styles.tarjeta} ${styles.t1}`}>
      <rect x="318" y="20" width="186" height="52" rx="10" className={styles.fondoTarjeta} stroke="#c084fc" />
      
      {/* Miniatura Reproductor con Botón Play Central */}
      <rect x="328" y="29" width="48" height="34" rx="6" fill="#1e1533" stroke="#c084fc" strokeWidth="1.2" />
      <circle cx="352" cy="46" r="10" fill="#8b5cf6" fillOpacity="0.4" />
      <path d="M349 41 l8 5 l-8 5 z" fill="#ffffff" />
      
      <text x="386" y="42" className={styles.titulo}>Video narrado</text>
      <text x="386" y="52" className={styles.subtituloChip}>0:60s · Audio IA</text>
      
      {/* Barra de progreso de reproducción */}
      <rect x="386" y="58" width="98" height="3" rx="1.5" fill="#2d2244" />
      <rect className={styles.progreso} x="386" y="58" width="98" height="3" rx="1.5" fill="#c084fc" />
    </g>

    {/* Tarjeta 2: Diagrama */}
    <g className={`${styles.tarjeta} ${styles.t2}`}>
      <rect x="318" y="88" width="186" height="52" rx="10" className={styles.fondoTarjeta} stroke="#22d3ee" />
      
      {/* Nodos del diagrama */}
      <g stroke="#22d3ee" strokeWidth="1.4" fill="#082f49" fillOpacity="0.6">
        <rect x="330" y="97" width="16" height="12" rx="3" />
        <rect x="358" y="97" width="16" height="12" rx="3" />
        <rect x="344" y="119" width="16" height="12" rx="3" />
      </g>
      <g stroke="#67e8f9" strokeWidth="1.2" strokeDasharray="2 2">
        <line x1="346" y1="103" x2="358" y2="103" />
        <line x1="338" y1="109" x2="348" y2="119" />
        <line x1="366" y1="109" x2="356" y2="119" />
      </g>
      
      <text x="386" y="111" className={styles.titulo}>Diagrama</text>
      <text x="386" y="127" className={styles.detalle}>Flujo y arquitectura</text>
    </g>

    {/* Tarjeta 3: Resumen */}
    <g className={`${styles.tarjeta} ${styles.t3}`}>
      <rect x="318" y="160" width="186" height="52" rx="10" className={styles.fondoTarjeta} stroke="#34d399" />
      
      {/* Iconografía de párrafos citados */}
      <g stroke="#34d399" strokeWidth="2.5" strokeLinecap="round">
        <line x1="332" y1="174" x2="368" y2="174" />
        <line x1="332" y1="185" x2="360" y2="185" />
        <line x1="332" y1="196" x2="368" y2="196" />
      </g>
      
      <text x="386" y="183" className={styles.titulo}>Resumen</text>
      <text x="386" y="199" className={styles.detalle}>Citas comprobadas</text>
    </g>

    {/* Tarjeta 4: Quiz */}
    <g className={`${styles.tarjeta} ${styles.t4}`}>
      <rect x="318" y="228" width="186" height="52" rx="10" className={styles.fondoTarjeta} stroke="#fbbf24" />
      
      {/* Ícono Quiz Interactivo */}
      <circle cx="350" cy="254" r="14" fill="#fbbf24" fillOpacity="0.15" stroke="#fbbf24" strokeWidth="1.2" />
      <text x="350" y="259" textAnchor="middle" className={styles.pregunta}>?</text>
      
      <text x="386" y="251" className={styles.titulo}>Quiz</text>
      <g className={styles.respuestas}>
        <rect x="386" y="260" width="10" height="10" rx="2" fill="#34d399" />
        <path d="M388.5 265 l2 2 l3.5 -4" stroke="#09101d" strokeWidth="1.5" fill="none" />
        <rect x="402" y="260" width="10" height="10" rx="2" fill="none" stroke="#64748b" />
        <rect x="418" y="260" width="10" height="10" rx="2" fill="none" stroke="#64748b" />
      </g>
    </g>
  </svg>
);