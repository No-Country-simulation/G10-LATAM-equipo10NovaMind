import { useState, useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { AlertCircle, X } from 'lucide-react';
import { Header } from './components/Header/Header';
import { Stepper } from './components/Stepper/Stepper';
import { IngestView } from './components/IngestView/IngestView';
import { ViewerView } from './components/ViewerView/ViewerView';
import { MetricsView } from './components/MetricsView/MetricsView';
import { fetchOpcionesConfig, enviarAdaptacion, MOCK_RESPUESTA_ADAPTACION } from './services/api';
import type { ConfigOpciones, RespuestaAdaptacion, AdaptarPayload } from './types/api';
import styles from './App.module.css';

const STEPS = [
  'Configuración e ingesta',
  'Visualizar resultados',
  'Métricas y OCI Cloud',
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [adaptationResult, setAdaptationResult] = useState<RespuestaAdaptacion>(MOCK_RESPUESTA_ADAPTACION);
  const [isLiveResult, setIsLiveResult] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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

  const handleGenerate = async (payload: AdaptarPayload) => {
    setApiError(null);
    try {
      const data = await enviarAdaptacion(payload);
      setAdaptationResult(data);
      setIsLiveResult(true);
      setCurrentStep(1);
    } catch (err: any) {
      console.warn('Backend FastAPI no disponible o retornó error:', err);
      setApiError(err.message || 'No se pudo conectar con el backend de NuevaMente (http://localhost:8000). Visualizando datos de respaldo.');
      setAdaptationResult(MOCK_RESPUESTA_ADAPTACION);
      setIsLiveResult(false);
      setCurrentStep(1);
    }
  };

  const documentTitle =
    adaptationResult.contenido_adaptado?.titulo ||
    'Arquitectura de Redes VCN en Cloud';

  return (
    <div className={styles.appShell}>
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />

      <Header documentTitle={documentTitle} />

      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
      />

      {apiError && (
        <div style={{
          maxWidth: '1200px',
          margin: '0.75rem auto',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#fca5a5',
          fontSize: '0.88rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertCircle size={16} />
            <span>
              <strong>Modo Respaldo:</strong> {apiError}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setApiError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              cursor: 'pointer',
              display: 'flex',
              padding: '0.2rem',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <main className={styles.mainContent}>
        {currentStep === 0 && (
          <IngestView
            config={config}
            onGenerate={handleGenerate}
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
          <MetricsView
            data={adaptationResult}
            onBack={() => setCurrentStep(1)}
          />
        )}
      </main>

      <footer className={styles.footer}>
        <span>
          <span className={styles.footerDot} />
          NuevaMente Intelligence Platform {isLiveResult && '· Live Connected'}
        </span>
        <span>Construido para Hackathon ONE · Grupo 10</span>
      </footer>
    </div>
  );
}