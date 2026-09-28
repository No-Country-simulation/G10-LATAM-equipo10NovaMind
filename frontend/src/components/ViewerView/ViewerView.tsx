import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { FlashcardViewer } from './FlashcardViewer/FlashcardViewer';
import { QuizViewer } from './QuizViewer/QuizViewer';
import type { RespuestaAdaptacion } from '../../types/api';
import styles from './ViewerView.module.css';

interface ViewerViewProps {
  data: RespuestaAdaptacion;
  onMetrics: () => void;
  onBack: () => void;
}

const FORMAT_TABS = [
  'Flashcards',
  'Quiz interactivo',
  'Guía / Tutorial',
  'Resumen ejecutivo',
];

const CARDS_DEMO = [
  {
    concept: 'CONCEPTO',
    frente: '¿Qué es una VCN en Oracle Cloud?',
    dorso:
      'Es tu red privada y personalizable dentro de OCI: el espacio donde defines subredes, rutas y reglas de tráfico.',
    body: 'Una red virtual definida por software en Oracle Cloud Infrastructure.',
    pista_didactica: 'Piensa en ella como tu propio barrio privado dentro de la nube.',
  },
  {
    concept: 'CONCEPTO CLAVE',
    frente: '¿Por qué separar una subred pública de una privada?',
    dorso:
      'La separación limita la superficie de exposición: los recursos privados no reciben tráfico directo desde Internet.',
    body: 'Segmentos lógicos que organizan los recursos de tu red.',
    pista_didactica: 'Como separar la recepción de una oficina del archivo interno confidencial.',
  },
  {
    concept: 'SEGURIDAD',
    frente: '¿Qué función cumple una Security List?',
    dorso:
      'Actúa como un cortafuegos virtual que define qué tráfico ingress (entrada) y egress (salida) está permitido.',
    body: 'Reglas virtuales para controlar el tráfico de red de forma granular.',
    pista_didactica: 'Son los guardias que revisan cada paquete de datos entrante y saliente.',
  },
];

export const ViewerView: React.FC<ViewerViewProps> = ({
  data,
  onMetrics,
  onBack,
}) => {
  const [currentFormat, setCurrentFormat] = useState('Flashcards');

  return (
    <div className={styles.contentGrid}>
      <section className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PASO 02 / STUDENT VIEWPORT</p>
          <h1 className={styles.headingTitle}>Aprende a tu manera</h1>
          <p className={styles.subheading}>
            Contenido adaptado para {data.metadatos.perfil_aplicado}.
          </p>
        </div>
        <div className={styles.liveBadge}>LIVE PREVIEW · MODO ESTUDIANTE</div>
      </section>

      {/* Meta Bar */}
      <section className={styles.metaBar}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>PERFIL APLICADO</span>
          <strong>{data.metadatos.perfil_aplicado}</strong>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>TIEMPO ESTIMADO</span>
          <strong>
            <span className={styles.timeDot} />
            {data.metadatos.tiempo_estimado_estudio_minutos} minutos
          </strong>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>CONCEPTOS CLAVE</span>
          <div className={styles.tagRow}>
            {data.metadatos.conceptos_clave.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs de formatos pedagógicos */}
      <div className={styles.formatTabs} role="tablist">
        {FORMAT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tabButton} ${
              currentFormat === tab ? styles.selected : ''
            }`}
            onClick={() => setCurrentFormat(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Superficie de visualización */}
      <section className={styles.viewerSurface}>
        {currentFormat === 'Flashcards' && <FlashcardViewer cards={CARDS_DEMO} />}
        {currentFormat === 'Quiz interactivo' && <QuizViewer />}
        {currentFormat !== 'Flashcards' && currentFormat !== 'Quiz interactivo' && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <p>Visualizador de {currentFormat} disponible en el siguiente subcomponente.</p>
          </div>
        )}
      </section>

      {/* Botones de navegación de pasos */}
      <div className={styles.bottomActions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          <ArrowLeft size={15} /> Regresar al Paso 1
        </button>
        <button type="button" className={styles.primaryButton} onClick={onMetrics}>
          Ver métricas y OCI <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};