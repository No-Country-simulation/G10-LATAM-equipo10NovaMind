import { useState, useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { Header } from './components/Header/Header';
import { Stepper } from './components/Stepper/Stepper';
import { IngestView } from './components/IngestView/IngestView';
import { ViewerView } from './components/ViewerView/ViewerView';
import { fetchOpcionesConfig, MOCK_RESPUESTA_ADAPTACION } from './services/api';
import type { ConfigOpciones, RespuestaAdaptacion } from './types/api';
import styles from './App.module.css';

const STEPS = [
  'Configuración e ingesta',
  'Visualizar resultados',
  'Métricas y OCI Cloud',
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [adaptationResult] = useState<RespuestaAdaptacion>(MOCK_RESPUESTA_ADAPTACION);
  const [config, setConfig] = useState<ConfigOpciones>({
    perfiles_destinatario: [
      'Principiante / Transición de Carrera',
      'Desarrollador Junior / Semi Senior',
      'Líder Técnico / Arquitecto',
      'Gestor / Ejecutivo (No Técnico)',
    ],
    formatos_salida: [
      'Flashcards',
      'Quiz Interactivo con Justificaciones',
      'Guía Práctica Paso a Paso (Tutorial)',
      'Resumen Ejecutivo (TL;DR)',
      'Guion de Clase / Video',
    ],
    nichos_sector: ['General', 'Fintech', 'Salud', 'E-commerce'],
    niveles_detalle: ['Didáctico', 'Intermedio', 'Profundo'],
  });

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    function updateLenis(time: number) {
      lenis.raf(time * 1000);
    }

    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateLenis);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    fetchOpcionesConfig().then(setConfig);
  }, []);

  return (
    <div className={styles.appShell}>
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />

      <Header documentTitle="Arquitectura de Redes VCN en Cloud" />

      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
      />

      <main className={styles.mainContent}>
        {currentStep === 0 && (
          <IngestView
            config={config}
            onGenerate={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 1 && (
          <ViewerView
            data={adaptationResult}
            onMetrics={() => setCurrentStep(2)}
            onBack={() => setCurrentStep(0)}
          />
        )}
        {currentStep === 2 && (
          <div className={styles.placeholderWorkspace}>
            <h2>Auditoría y Métricas OCI</h2>
            <p>Paso 3 en construcción...</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <span>
          <span className={styles.footerDot} />
          NuevaMente Intelligence Platform
        </span>
        <span>Construido para Hackathon ONE · Grupo 10</span>
      </footer>
    </div>
  );
}