import React from 'react';
import { Sparkles, FileText } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  documentTitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  documentTitle = 'Arquitectura de Redes VCN en Cloud',
}) => {
  return (
    <header className={styles.topbar}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>
          <Sparkles size={18} />
        </div>
        <span className={styles.logoText}>NuevaMente</span>
      </div>

      <div className={styles.documentPill} aria-label="Documento fuente activo">
        <FileText size={14} />
        <span>Documento: {documentTitle}</span>
      </div>

      <div className={styles.systemStatus}>
        <span className={styles.statusPill}>
          <span className={`${styles.statusDot} ${styles.green}`} />
          OCI Always Free: Activo
        </span>
        <span className={styles.statusPill}>
          <span className={`${styles.statusDot} ${styles.cyan}`} />
          FastAPI v2.0: Conectado
        </span>
      </div>
    </header>
  );
};