import React, { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import styles from './SplashScreen.module.css';

interface SplashScreenProps {
  onFinish?: () => void;
  autoDismissMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  autoDismissMs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoWrapperRef = useRef<HTMLDivElement>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);
  const logoGlowRef = useRef<HTMLDivElement>(null);
  const titleNuevaRef = useRef<HTMLSpanElement>(null);
  const titleMenteRef = useRef<HTMLSpanElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const footerHintRef = useRef<HTMLElement>(null);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  const handleDismiss = useCallback(() => {
    if (!containerRef.current) return;
    
    // Salida cinemática fluida con desenfoque y disolución
    gsap.to(containerRef.current, {
      opacity: 0,
      scale: 1.04,
      filter: 'blur(16px)',
      duration: 0.75,
      ease: 'power2.inOut',
      onComplete: () => {
        onFinish?.();
      },
    });
  }, [onFinish]);

  useEffect(() => {
  // Congela el scroll de la página principal mientras el Splash esté visible
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  return () => {
    // Restaura el scroll cuando el Splash se desmonta
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  };
}, []);

useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      timelineRef.current = tl;

      // ─── ESTADO INICIAL ABSOLUTO ───
      gsap.set(logoWrapperRef.current, {
        y: '13vh', // Centro óptico vertical del viewport
        scale: 2.2, // Grande e imponente
        opacity: 0,
        transformPerspective: 1000,
        rotationY: 0,
      });

      // Nueva arranca desplazada a la izquierda con tracking expandido
      gsap.set(titleNuevaRef.current, {
        opacity: 0,
        x: -70,
        y: 0,
        letterSpacing: '0.08em',
        filter: 'blur(12px)',
      });

      // Mente arranca desplazada a la derecha con tracking expandido
      gsap.set(titleMenteRef.current, {
        opacity: 0,
        x: 70,
        y: 0,
        letterSpacing: '0.08em',
        filter: 'blur(12px)',
      });

      gsap.set(detailsRef.current, {
        opacity: 0,
        y: 20,
        filter: 'blur(10px)',
      });

      gsap.set(footerHintRef.current, {
        opacity: 0,
      });

      // ─── ACTO 1: Aparición del Logo en el Centro (0.0s – 0.9s) ───
      tl.to(logoWrapperRef.current, {
        opacity: 1,
        duration: 0.9,
        ease: 'power2.out',
      })
      .to(logoGlowRef.current, {
        opacity: 0.9,
        scale: 1.25,
        duration: 0.9,
        ease: 'power2.out',
      }, '<')

      // Pausa sensorial en el centro para registrar la marca
      .to({}, { duration: 0.55 })

      // ─── ACTO 2: Vuelo Cinemático con Perspectiva 3D ───
      .to(logoWrapperRef.current, {
        y: 0, // Posición final del layout
        scale: 1, // Tamaño canónico
        rotationY: 10, // Giro dimensional en el despegue
        duration: 1.65,
        ease: 'power3.inOut',
      })
      .to(logoWrapperRef.current, {
        rotationY: 0, // Se estabiliza en plano frontal
        duration: 0.5,
        ease: 'power2.out',
      }, '-=0.4')
      .to(logoGlowRef.current, {
        opacity: 0.5,
        scale: 1,
        duration: 1.65,
        ease: 'power3.inOut',
      }, '<')

      // ─── ACTO 3: Choque Cinemático en el Centro (Encuentro Elástico) ───
      .to(titleNuevaRef.current, {
        opacity: 1,
        x: 0,
        letterSpacing: '-0.02em',
        filter: 'blur(0px)',
        duration: 0.85,
        ease: 'back.out(1.2)', // Ligero rebote al juntarse
      }, '-=0.55')
      .to(titleMenteRef.current, {
        opacity: 1,
        x: 0,
        letterSpacing: '-0.02em',
        filter: 'blur(0px)',
        duration: 0.85,
        ease: 'back.out(1.2)',
      }, '<') // Se unen al mismo tiempo en el centro

      // ─── ACTO 4: Despliegue de Arquitectura y Hackathon ONE ───
      .to(detailsRef.current, {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.85,
        ease: 'power2.out',
      }, '-=0.35')
      .to(footerHintRef.current, {
        opacity: 0.65,
        duration: 0.8,
        ease: 'power2.out',
      }, '-=0.2');

      // Animación continua y orgánica de respiración una vez asentado
      gsap.to(logoImgRef.current, {
        y: -5,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 2.8,
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Timer automático si fue solicitado
  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = setTimeout(() => {
      handleDismiss();
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, handleDismiss]);

  // Descartar con teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'Escape'].includes(e.code)) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);

  return (
    <div
      ref={containerRef}
      className={styles.viewport}
      onClick={handleDismiss}
      role="banner"
      aria-label="Pantalla de presentación cinemática NuevaMente"
      tabIndex={0}
    >
      {/* 1. Atmósfera lumínica volumétrica */}
      <div className={styles.ambientAtmosphere}>
        <div className={styles.auroraViolet} />
        <div className={styles.auroraCyan} />
        <div className={styles.auroraFuchsia} />
        <div className={styles.vignette} />
        <div className={styles.noiseOverlay} />
      </div>

      {/* 2. Escenario cinemático */}
      <main className={styles.cinemaStage}>
        {/* Isotipo: Contenedor que viaja en coordenadas y escala */}
        <div ref={logoWrapperRef} className={styles.isotypeFlightWrapper}>
          <div ref={logoGlowRef} className={styles.coreAura} />
          <div className={styles.pulseRingOuter} />
          <img
            ref={logoImgRef}
            src="/Isotipo.svg"
            alt="NuevaMente Isotipo"
            className={styles.isotypeSvg}
          />
        </div>

        {/* Tipografía que espera el aterrizaje del logo */}
        <div className={styles.typographyRig}>
          <h1 className={styles.brandTitle}>
            <span ref={titleNuevaRef} className={styles.titleNueva}>
              Nueva
            </span>
            <span ref={titleMenteRef} className={styles.titleMente}>
              Mente
            </span>
          </h1>

          <div ref={detailsRef} className={styles.detailsRig}>
            <p className={styles.subtitleLead}>
              Cognitive Acceleration &amp; Pedagogical Architecture
            </p>

            <div className={styles.laserDivider}>
              <div className={styles.laserBeam} />
            </div>

            <div className={styles.badgeHackathon}>
              <span className={styles.liveIndicator} />
              <span className={styles.badgeText}>
                Hackathon ONE G10 (Oracle Next Education & Alura) · <strong>Equipo 10</strong>

              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Indicador inferior de interacción */}
      <footer ref={footerHintRef} className={styles.footerHint}>
        <span className={styles.hintText}>Presione cualquier tecla o haga clic para iniciar</span>
      </footer>
    </div>
  );
};