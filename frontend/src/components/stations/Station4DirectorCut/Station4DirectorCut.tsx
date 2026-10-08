import { useState } from 'react';
import {
  Clapperboard,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Video,
  Award,
  Download,
  BookOpen,
  Layers,
} from 'lucide-react';
import type { DirectorScene, VideoJobSpec } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import styles from './Station4DirectorCut.module.css';

interface Station4Props {
  scenes: DirectorScene[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenDirectorBadge: () => void;
}

export const Station4DirectorCut = ({
  scenes = [],
  isCompleted,
  onCompleteStation,
  onOpenDirectorBadge,
}: Station4Props) => {
  const [prevScenes, setPrevScenes] = useState(scenes);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [viewedScenes, setViewedScenes] = useState<Record<number, boolean>>({ 0: true });

  // Sincronización limpia en render sin useEffect
  if (scenes !== prevScenes) {
    setPrevScenes(scenes);
    setCurrentSceneIndex(0);
    setViewedScenes({ 0: true });
  }

  const safeScenes = scenes.length > 0 ? scenes : [
    {
      id: 'sc-default',
      escena: 1,
      tiempo: '00:15',
      duracion_segundos: 15.0,
      titulo: 'Presentación Didáctica',
      guion_locutor: 'Bienvenidos a esta sesión de aprendizaje contextualizado.',
      storyboard_visual: 'Primer plano del docente con infografía lateral ilustrativa.',
      consejo_pedagogico: 'Mantén contacto visual y ritmo reflexivo.',
    }
  ];

  const totalScenes = safeScenes.length;
  const minRequired = Math.max(1, Math.ceil(totalScenes * 0.6));
  const currentScene = safeScenes[currentSceneIndex] || safeScenes[0];

  const wordCount = currentScene.estimacion_palabras ||
    currentScene.guion_locutor.trim().split(/\s+/).filter(Boolean).length;
  const sceneDurationSec = currentScene.duracion_segundos || Math.max(5, Math.round(wordCount / 2.3));

  const handleSelectScene = (index: number) => {
    setCurrentSceneIndex(index);
    const updated = { ...viewedScenes, [index]: true };
    setViewedScenes(updated);

    const viewedCount = Object.values(updated).filter(Boolean).length;
    if (viewedCount >= minRequired && !isCompleted) {
      triggerSmallConfetti();
      triggerLevelUpConfetti();
      onCompleteStation(50);
      onOpenDirectorBadge();
    }
  };

  const handleNext = () => {
    if (currentSceneIndex < totalScenes - 1) {
      handleSelectScene(currentSceneIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentSceneIndex > 0) {
      handleSelectScene(currentSceneIndex - 1);
    }
  };

  const handleExportContractJson = () => {
    const totalWords = safeScenes.reduce((acc, sc) => {
      const words = sc.estimacion_palabras || sc.guion_locutor.trim().split(/\s+/).filter(Boolean).length;
      return acc + words;
    }, 0);
    const totalDuration = safeScenes.reduce((acc, sc) => {
      const words = sc.estimacion_palabras || sc.guion_locutor.trim().split(/\s+/).filter(Boolean).length;
      const sec = sc.duracion_segundos || Math.max(5, Math.round(words / 2.3));
      return acc + sec;
    }, 0);

    const contract: VideoJobSpec = {
      video_job_id: `vjob-${Date.now()}`,
      document_id: 'doc-novamind',
      target_duration: 50,
      max_duration: 60,
      aspect_ratio: '9:16',
      idioma: 'es',
      estado: 'contract_ready',
      escenas: safeScenes,
      total_palabras: totalWords,
      duracion_total_estimada: Math.round(totalDuration * 10) / 10,
    };

    const blob = new Blob([JSON.stringify(contract, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `videojob_spec_${contract.video_job_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const viewedCount = Object.values(viewedScenes).filter(Boolean).length;
  const isPassed = viewedCount >= minRequired;

  return (
    <div className={styles.stationWrapper}>
      {/* Header */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <Clapperboard size={12} color="#f0abfc" />
              Estación 04 · Storyboard & Guion Docente
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Aprobada (+50 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>
            Director Cut: Narrativa Pedagógica
          </h3>
          <p className={styles.stationSubtitle}>
            Explora el guion y el storyboard para la transmisión del contenido. Mínimo para aprobar: {minRequired} de {totalScenes} escenas.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleExportContractJson}
            className={styles.exportContractBtn}
            title="Exportar manifiesto VideoJobSpec JSON (~4 KB)"
          >
            <Download size={14} />
            <span>Exportar Contrato JSON</span>
          </button>

          {isPassed && (
            <button
              type="button"
              onClick={onOpenDirectorBadge}
              className={styles.badgeShowcaseBtn}
            >
              <Award size={16} color="var(--color-amber-400)" />
              <span>Ver Medalla</span>
            </button>
          )}

          <div className={styles.progressStats}>
            <div className={styles.progressLabel}>Escenas Exploradas</div>
            <div className={`${styles.progressRatio} ${isPassed ? styles.progressRatioPassed : ''}`}>
              {viewedCount} / {totalScenes}
            </div>
          </div>
        </div>
      </div>

      {/* Tira de Escenas */}
      <div className={styles.sceneStrip}>
        {safeScenes.map((sc, idx) => {
          const isCurrent = currentSceneIndex === idx;
          const isViewed = !!viewedScenes[idx];

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectScene(idx)}
              className={`${styles.sceneButton} ${
                isCurrent
                  ? styles.sceneButtonActive
                  : isViewed
                  ? styles.sceneButtonViewed
                  : ''
              }`}
            >
              <div className={styles.sceneMeta}>
                <span className={styles.sceneTag}>
                  Escena 0{idx + 1} · {sc.tiempo}
                </span>
                <span className={styles.sceneTitleText}>
                  {sc.titulo}
                </span>
              </div>
              <div className={styles.sceneIconBox}>
                {isViewed ? (
                  <CheckCircle2 size={18} color="var(--color-emerald-400)" />
                ) : (
                  <Eye size={18} color="var(--color-text-subtle)" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Estudio Principal */}
      <div className={styles.studioViewport}>
        {/* Teleprompter Locutor */}
        <div className={styles.teleprompterCard}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitleFuchsia}>
              Teleprompter · Guion Docente
            </span>
            <div className={styles.timePillsRow}>
              <span className={`${styles.wordPill} ${styles.wordPillHighlight}`}>
                ⏱ {sceneDurationSec}s · {wordCount} palabras
              </span>
              <span className={styles.sceneTimeBadge}>
                {currentScene.tiempo}
              </span>
            </div>
          </div>

          <p className={styles.scriptBox}>
            "{currentScene.guion_locutor}"
          </p>

          {currentScene.objetivo_pedagogico && (
            <div className={styles.objectivePill}>
              <strong>🎯 Objetivo:</strong> {currentScene.objetivo_pedagogico}
            </div>
          )}

          <div className={styles.pedagogyTip}>
            <strong style={{ color: '#f0abfc' }}>💡 Consejo Pedagógico:</strong> {currentScene.consejo_pedagogico}
          </div>

          {/* Trazabilidad RAG si existen citas registradas */}
          {currentScene.fuentes && currentScene.fuentes.length > 0 && (
            <div className={styles.ragSection}>
              <div className={styles.ragHeader}>
                <BookOpen size={13} />
                <span>Citas RAG Verificadas ({currentScene.fuentes.length})</span>
              </div>
              {currentScene.fuentes.map((f, i) => (
                <div key={i} className={styles.ragCard}>
                  <span className={styles.ragBadge}>
                    Chunk #{f.chunk_id}{f.pagina ? ` · Pág. ${f.pagina}` : ''}
                  </span>
                  <p className={styles.ragText}>"{f.texto_fuente}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visual Storyboard */}
        <div className={styles.storyboardCard}>
          <div>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitleCyan}>
                Storyboard Visual · Especificación Determinista
              </span>
              <Video size={16} color="var(--color-cyan-400)" />
            </div>

            {/* Especificación visual estructurada si existe */}
            {currentScene.visual && (
              <div className={styles.visualSpecBox}>
                <div className={styles.visualSpecHeader}>
                  <Layers size={14} />
                  <span className={styles.visualSpecType}>
                    {currentScene.visual.tipo.replace('_', ' ')}
                  </span>
                  <strong>{currentScene.visual.titulo}</strong>
                </div>

                {currentScene.visual.puntos_clave && currentScene.visual.puntos_clave.length > 0 && (
                  <ul className={styles.visualPointsList}>
                    {currentScene.visual.puntos_clave.map((pt, pIdx) => (
                      <li key={pIdx}>{pt}</li>
                    ))}
                  </ul>
                )}

                {currentScene.visual.codigo_o_estructura && (
                  <pre className={styles.visualCode}>
                    <code>{currentScene.visual.codigo_o_estructura}</code>
                  </pre>
                )}
              </div>
            )}

            <div className={styles.storyboardVisualContent}>
              {currentScene.storyboard_visual}
            </div>
          </div>

          <div className={styles.playbackNav}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentSceneIndex === 0}
              className={styles.navButton}
              title="Escena anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className={styles.navCount}>
              {currentSceneIndex + 1} de {totalScenes}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentSceneIndex === totalScenes - 1}
              className={styles.navButton}
              title="Siguiente escena"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};