import { useState } from 'react';
import { Header } from './components/Header/Header';
import { Stepper } from './components/Stepper/Stepper';
import styles from './App.module.css';

const STEPS = [
  'Configuración e ingesta',
  'Visualizar resultados',
  'Métricas y OCI Cloud',
];

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className={styles.appShell}>
      {/* Resplandores de luz ambiental */}
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />

      {/* Barra superior / Navbar */}
      <Header documentTitle="Arquitectura de Redes VCN en Cloud" />

      {/* Stepper de navegación entre fases */}
      <Stepper
        steps={STEPS}
        currentStep={currentStep}
        onSelectStep={setCurrentStep}
      />

      {/* Contenedor central */}
      <main className={styles.mainContent}>
        <div className={styles.placeholderWorkspace}>
          <h2>{STEPS[currentStep]}</h2>
          <p>Paso {currentStep + 1} de {STEPS.length}</p>
        </div>
      </main>

      {/* Footer corporativo */}
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