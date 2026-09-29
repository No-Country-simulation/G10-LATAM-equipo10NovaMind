import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, BookOpenText } from 'lucide-react';
import { FlashcardViewer } from './FlashcardViewer/FlashcardViewer';
import { QuizViewer } from './QuizViewer/QuizViewer';
import { TutorialViewer } from './TutorialViewer/TutorialViewer';
import { SummaryViewer } from './SummaryViewer/SummaryViewer';
import { ScriptViewer } from './ScriptViewer/ScriptViewer';
import type {
  RespuestaAdaptacion,
  FlashcardItem,
  QuizItem,
  TutorialItem,
  SummaryItem,
  ScriptItem,
} from '../../types/api';
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
  'Guion / Video',
];

const formatoToTab = (formato?: string): string => {
  if (!formato) return 'Flashcards';
  const f = formato.toLowerCase();
  if (f.includes('flashcard')) return 'Flashcards';
  if (f.includes('quiz') || f.includes('cuestionario')) return 'Quiz interactivo';
  if (f.includes('guía') || f.includes('tutorial') || f.includes('paso a paso')) return 'Guía / Tutorial';
  if (f.includes('resumen') || f.includes('tl;dr')) return 'Resumen ejecutivo';
  if (f.includes('guion') || f.includes('video')) return 'Guion / Video';
  return 'Flashcards';
};

export const ViewerView: React.FC<ViewerViewProps> = ({
  data,
  onMetrics,
  onBack,
}) => {
  const initialTab = formatoToTab(data.metadatos?.formato_generado);
  const [currentFormat, setCurrentFormat] = useState(initialTab);

  useEffect(() => {
    if (data.metadatos?.formato_generado) {
      setCurrentFormat(formatoToTab(data.metadatos.formato_generado));
    }
  }, [data.metadatos?.formato_generado]);

  const items = data.contenido_adaptado?.items || [];
  const activeTabMatchesGenerated =
    currentFormat === formatoToTab(data.metadatos?.formato_generado);

  const perfilAplicado = data.metadatos?.perfil_aplicado || 'Personalizado';
  const tiempoEstimado = data.metadatos?.tiempo_estimado_estudio_minutos || 5;
  const conceptosClave = data.metadatos?.conceptos_clave || ['Cloud', 'Arquitectura'];
  const tituloAdaptado = data.contenido_adaptado?.titulo || 'Contenido Educativo Adaptado';
  const introduccion = data.contenido_adaptado?.introduccion_contextualizada;

  return (
    <div className={styles.contentGrid}>
      <section className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PASO 02 / STUDENT VIEWPORT</p>
          <h1 className={styles.headingTitle}>{tituloAdaptado}</h1>
          <p className={styles.subheading}>
            Contenido adaptado para {perfilAplicado}.
          </p>
        </div>
        <div className={styles.liveBadge}>LIVE PREVIEW · MODO ESTUDIANTE</div>
      </section>

      {/* Introducción contextualizada (si la provee la IA) */}
      {introduccion && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '0.92rem',
          lineHeight: '1.55',
        }}>
          <BookOpenText size={20} style={{ color: '#00e5ff', flexShrink: 0, marginTop: '2px' }} />

          <div>
            <strong style={{ display: 'block', color: '#00e5ff', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Introducción Pedagógica
            </strong>
            {introduccion}
          </div>
        </div>
      )}

      {/* Barra de metadatos pedagógicos */}
      <section className={styles.metaBar}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>PERFIL APLICADO</span>
          <strong>{perfilAplicado}</strong>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>TIEMPO ESTIMADO</span>
          <strong>
            <span className={styles.timeDot} />
            {tiempoEstimado} minutos
          </strong>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>CONCEPTOS CLAVE</span>
          <div className={styles.tagRow}>
            {conceptosClave.map((tag) => (
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

      {/* Superficie de visualización según formato */}
      <section className={styles.viewerSurface}>
        {currentFormat === 'Flashcards' && (
          <FlashcardViewer
            cards={
              activeTabMatchesGenerated && items.length > 0
                ? (items as FlashcardItem[])
                : undefined
            }
          />
        )}
        {currentFormat === 'Quiz interactivo' && (
          <QuizViewer
            items={
              activeTabMatchesGenerated && items.length > 0
                ? (items as QuizItem[])
                : undefined
            }
          />
        )}
        {currentFormat === 'Guía / Tutorial' && (
          <TutorialViewer
            items={
              activeTabMatchesGenerated && items.length > 0
                ? (items as TutorialItem[])
                : undefined
            }
            title={tituloAdaptado}
          />
        )}
        {currentFormat === 'Resumen ejecutivo' && (
          <SummaryViewer
            items={
              activeTabMatchesGenerated && items.length > 0
                ? (items as SummaryItem[])
                : undefined
            }
            title={tituloAdaptado}
            introduccion={introduccion}
          />
        )}
        {currentFormat === 'Guion / Video' && (
          <ScriptViewer
            items={
              activeTabMatchesGenerated && items.length > 0
                ? (items as ScriptItem[])
                : undefined
            }
            title={tituloAdaptado}
          />
        )}
      </section>

      {/* Botones de navegación */}
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