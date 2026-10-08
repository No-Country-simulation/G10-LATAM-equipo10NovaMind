import {
  Zap,
  BookOpen,
  Terminal,
  Clapperboard,
  Award,
  Lock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { AdaptedContentPackage } from '../../types/types';
import { Station1ResumenNinja } from '../stations/Station1ResumenNinja/Station1ResumenNinja';
import { Station2FlashcardQuest } from '../stations/Station2FlashcardQuest/Station2FlashcardQuest';
import { Station3TutorialQuest } from '../stations/Station3TutorialQuest/Station3TutorialQuest';
import { Station4DirectorCut } from '../stations/Station4DirectorCut/Station4DirectorCut';
import { Station5FinalTrial } from '../stations/Station5Quiz/Station5Quiz';
import styles from './Step2KnowledgeQuest.module.css';

interface Step2Props {
  contentPackage: AdaptedContentPackage;
  completedStations: Record<number, boolean>;
  activeStationIndex: number;
  onSelectStationIndex: (index: number) => void;
  onCompleteStation: (stationIndex: number, xp: number) => void;
  cognitiveShields: number;
  onDeductShield: () => void;
  onResetCircuit: () => void;
  onOpenNinjaBadge: () => void;
  onOpenStreakBadge?: () => void;
  onOpenBuilderBadge?: () => void;
  onOpenDirectorBadge: () => void;
  onOpenMasterBadge: () => void;
  onDownloadArtifact: () => void;
  onGoToOCIInspect: () => void;
  isGenerating?: boolean;
  unlockedStations?: number[];
  generatingMessage?: string;
}

export const Step2KnowledgeQuest = ({
  contentPackage,
  completedStations,
  activeStationIndex,
  onSelectStationIndex,
  onCompleteStation,
  cognitiveShields,
  onDeductShield,
  onResetCircuit,
  onOpenNinjaBadge,
  onOpenStreakBadge,
  onOpenBuilderBadge,
  onOpenDirectorBadge,
  onOpenMasterBadge,
  onDownloadArtifact,
  onGoToOCIInspect,
  isGenerating = false,
  unlockedStations = [0, 1, 2, 3, 4],
  generatingMessage = '',
}: Step2Props) => {
  const completedStationsCount = Object.values(completedStations).filter(Boolean).length;
  const isFinalTrialUnlocked = completedStationsCount >= 2;
  const unlockedList = unlockedStations || [0, 1, 2, 3, 4];

  const stationsMeta = [
    {
      index: 0,
      title: 'Resumen Ninja',
      subtitle: 'Intuición Inicial (TL;DR)',
      icon: Zap,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 1,
      title: 'Flashcard Quest',
      subtitle: 'Active Recall 3D',
      icon: BookOpen,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 2,
      title: 'Tutorial Quest',
      subtitle: 'Laboratorio Práctico',
      icon: Terminal,
      xp: '+75 XP',
      isLocked: false,
    },
    {
      index: 3,
      title: 'Director Cut',
      subtitle: 'Guion Didáctico / Storyboard',
      icon: Clapperboard,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 4,
      title: 'The Final Trial',
      subtitle: 'Quiz Capstone RAG',
      icon: Award,
      xp: '+100 XP',
      isLocked: !isFinalTrialUnlocked,
    },
  ];

  const handleSelectStation = (index: number) => {
    if (index === 4 && !isFinalTrialUnlocked && !isGenerating) {
      alert('Debes completar al menos 2 estaciones antes de desbloquear la Prueba Final.');
      return;
    }
    onSelectStationIndex(index);
  };

  const isCurrentStationReady = !isGenerating || unlockedList.includes(activeStationIndex);

  return (
    <div className={styles.container}>
      {/* Banner de Generación Progresiva en Tiempo Real */}
      {isGenerating && (
        <div className={styles.generatingBanner}>
          <div className={styles.generatingBannerText}>
            <Sparkles size={16} className={styles.spinningIcon} color="#f0abfc" />
            <span>{generatingMessage || 'Orquestando agentes pedagógicos en tiempo real...'}</span>
          </div>
          <span className={styles.generatingBannerSub}>
            Estaciones listas: {unlockedList.length} de 5
          </span>
        </div>
      )}

      {/* RPG Stepper Strip */}
      <div className={styles.stepperBarCard}>
        <div className={styles.stepperHeader}>
          <div className={styles.titleArea}>
            <span className={styles.pulseIndicator} />
            <h2 className={styles.mainTitle}>
              Ruta Cognitiva · {contentPackage.contenido_adaptado.titulo}
            </h2>
          </div>
          <div className={styles.metaGroup}>
            <span className={styles.profilePill}>
              Perfil: {contentPackage.metadatos.perfil_aplicado}
            </span>
            <span className={styles.ratioCounter}>
              {completedStationsCount} de 5 Estaciones Dominadas
            </span>
          </div>
        </div>

        {/* 5-Node Sequence Bar */}
        <div className={styles.nodesGrid}>
          {stationsMeta.map((node) => {
            const isSelected = activeStationIndex === node.index;
            const isDone = !!completedStations[node.index];
            const isStationReady = !isGenerating || unlockedList.includes(node.index);
            const NodeIcon = node.icon;

            const selectedClass = isSelected ? styles[`nodeSelected_${node.index}`] : '';

            return (
              <button
                key={node.index}
                type="button"
                onClick={() => handleSelectStation(node.index)}
                disabled={node.isLocked && !isGenerating}
                className={`${styles.nodeBtn} ${selectedClass} ${node.isLocked && !isGenerating ? styles.nodeBtnLocked : ''}`}
              >
                <div className={styles.nodeTopRow}>
                  <div
                    className={`${styles.nodeIconBox} ${
                      isDone
                        ? styles.nodeIconBoxDone
                        : isSelected
                        ? styles.nodeIconBoxActive
                        : ''
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} />
                    ) : node.isLocked && !isGenerating ? (
                      <Lock size={14} color="#f59e0b" />
                    ) : !isStationReady ? (
                      <Sparkles size={14} className={styles.spinningIcon} color="#fbbf24" />
                    ) : (
                      <NodeIcon size={14} />
                    )}
                  </div>

                  {!isStationReady ? (
                    <span className={styles.nodeGeneratingPill}>
                      ⏳ Generando...
                    </span>
                  ) : isGenerating ? (
                    <span className={styles.nodeReadyPill}>
                      ✨ Lista
                    </span>
                  ) : (
                    <span className={styles.nodeXpPill}>
                      {node.xp}
                    </span>
                  )}
                </div>

                <div className={styles.nodeMetaBlock}>
                  <div className={styles.nodeTitleText}>
                    0{node.index + 1}. {node.title}
                  </div>
                  <div className={styles.nodeSubtitleText}>
                    {!isStationReady
                      ? 'Redactando con Agente 2...'
                      : node.isLocked && !isGenerating
                      ? '🔒 Requiere 2 completadas'
                      : node.subtitle}
                  </div>
                </div>

                {isSelected && <div className={styles.activeGlowLine} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Station Viewport */}
      <div className={styles.viewportContainer}>
        {!isCurrentStationReady ? (
          <div className={styles.generatingCard}>
            <div className={styles.generatingHeader}>
              <Sparkles size={28} className={styles.spinningIcon} color="#f0abfc" />
              <h3 className={styles.generatingTitle}>
                Generando 0{activeStationIndex + 1}. {stationsMeta[activeStationIndex]?.title}
              </h3>
            </div>
            <p className={styles.generatingDesc}>
              {generatingMessage || 'El Agente Productor está transformando el material técnico RAG para esta estación...'}
            </p>
            <div className={styles.generatingProgressTrack}>
              <div className={styles.generatingProgressShimmer} />
            </div>
            <div className={styles.generatingMetaRow}>
              <span>✦ Ingesta Vectorial ChromaDB</span>
              <span>✦ Agente Productor Cohere</span>
              <span>✦ Auditoría RAG Gemini/Groq</span>
              <span>✦ Persistencia OCI</span>
            </div>
          </div>
        ) : (
          <>
            {activeStationIndex === 0 && (
              <Station1ResumenNinja
                data={contentPackage.contenido_adaptado.resumen_ninja}
                isCompleted={!!completedStations[0]}
                onCompleteStation={(xp) => onCompleteStation(0, xp)}
                onOpenNinjaBadge={onOpenNinjaBadge}
              />
            )}

            {activeStationIndex === 1 && (
              <Station2FlashcardQuest
                cards={contentPackage.contenido_adaptado.flashcards}
                isCompleted={!!completedStations[1]}
                onCompleteStation={(xp) => onCompleteStation(1, xp)}
                onOpenStreakBadge={onOpenStreakBadge}
              />
            )}

            {activeStationIndex === 2 && (
              <Station3TutorialQuest
                steps={contentPackage.contenido_adaptado.tutorial}
                isCompleted={!!completedStations[2]}
                onCompleteStation={(xp) => onCompleteStation(2, xp)}
                onOpenBuilderBadge={onOpenBuilderBadge}
              />
            )}

            {activeStationIndex === 3 && (
              <Station4DirectorCut
                scenes={contentPackage.contenido_adaptado.director_cut}
                isCompleted={!!completedStations[3]}
                onCompleteStation={(xp) => onCompleteStation(3, xp)}
                onOpenDirectorBadge={onOpenDirectorBadge}
              />
            )}

            {activeStationIndex === 4 && (
              <Station5FinalTrial
                questions={contentPackage.contenido_adaptado.quiz}
                completedStationsCount={completedStationsCount}
                isUnlocked={isFinalTrialUnlocked || isGenerating}
                cognitiveShields={cognitiveShields}
                onSelectStation={(idx) => handleSelectStation(idx)}
                onDeductShield={onDeductShield}
                onResetCircuit={onResetCircuit}
                onCompleteStation={(xp) => onCompleteStation(4, xp)}
                onOpenMasterBadge={onOpenMasterBadge}
                onDownloadArtifact={onDownloadArtifact}
              />
            )}
          </>
        )}
      </div>

      {/* Quick Navigation Footer */}
      <div className={styles.quickNavFooter}>
        <div className={styles.footerInfo}>
          <span>Estación actual:</span>
          <strong className={styles.activeStationHighlight}>
            0{activeStationIndex + 1} / 05 · {stationsMeta[activeStationIndex]?.title}
          </strong>
        </div>

        <div>
          {activeStationIndex < 4 ? (
            <button
              type="button"
              onClick={() => handleSelectStation(activeStationIndex + 1)}
              className={styles.nextButton}
            >
              <span>Avanzar a Estación 0{activeStationIndex + 2}</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoToOCIInspect}
              className={styles.finishQuestButton}
            >
              <span>Ver Métricas & Artefactos OCI (Paso 03)</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};