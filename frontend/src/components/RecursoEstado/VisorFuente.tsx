/**
 * Visor de fuente: muestra el pasaje del documento original del que sale una cita, con la cita
 * resaltada. El texto viene literal del documento (backend: fuentes.contexto_de_cita), nunca
 * reescrito por el modelo, y no cruza el límite de su página.
 */
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileSearch, X } from 'lucide-react';
import type { FuenteCita } from '../../types/types';
import styles from './VisorFuente.module.css';

interface Props {
  fuente: FuenteCita;
  onCerrar: () => void;
}

export function VisorFuente({ fuente, onCerrar }: Props) {
  const idTitulo = useId();
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const contexto = fuente.contexto;

  useEffect(() => {
    cerrarRef.current?.focus();
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  if (!contexto) return null;

  return createPortal(
    <div className={styles.fondo} onClick={onCerrar}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.cabecera}>
          <FileSearch size={16} aria-hidden="true" />
          <h3 id={idTitulo} className={styles.titulo}>
            Documento original{fuente.pagina ? ` · pág. ${fuente.pagina}` : ''}
          </h3>
          <button ref={cerrarRef} type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar el visor">
            <X size={16} />
          </button>
        </header>

        <blockquote className={styles.texto}>
          {contexto.recortado_inicio && <span className={styles.elipsis}>… </span>}
          {contexto.antes}
          <mark className={styles.resaltado}>{contexto.fragmento}</mark>
          {contexto.despues}
          {contexto.recortado_fin && <span className={styles.elipsis}> …</span>}
        </blockquote>

        <p className={styles.nota}>
          Texto literal del documento. Lo resaltado es el pasaje que respalda esta afirmación, localizado
          automáticamente en el texto{fuente.pagina ? ` de la página ${fuente.pagina}` : ''}.
        </p>
      </div>
    </div>,
    document.body,
  );
}
