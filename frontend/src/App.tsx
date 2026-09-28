import { useState } from 'react';
import { Header } from './components/Header/Header';
import styles from './App.module.css';

export default function App() {
  const [currentStep] = useState(0);

  return (
    <div className={styles.appShell}>
      {/* Resplandores de luz ambiental */}
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />

      {/* Barra superior / Navbar */}
      <Header documentTitle="Arquitectura de Redes VCN en Cloud" />

      {/* Contenedor central del workspace */}
      <main className={styles.mainContent}>
        <div className={styles.placeholderWorkspace}>
          <h2>Workspace NuevaMente listo</h2>
          <p>Paso actual: {currentStep + 1} de 3</p>
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