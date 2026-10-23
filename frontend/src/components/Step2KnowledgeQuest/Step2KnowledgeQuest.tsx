import { useState, useEffect } from 'react';
import {
  Zap,
  BookOpen,
  Target,
  Clapperboard,
  Award,
  Lock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  X,
  Loader2,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import type { AdaptedContentPackage, MuestraPregenerada } from '../../types/types';
import type { QuizState } from '../../services/persistence';
import { Station1ResumenNinja } from '../stations/Station1ResumenNinja/Station1ResumenNinja';
import { Station2FlashcardQuest } from '../stations/Station2FlashcardQuest/Station2FlashcardQuest';
import { Station3TutorialQuest } from '../stations/Station3TutorialQuest/Station3TutorialQuest';
import { Station4DirectorCut } from '../stations/Station4DirectorCut/Station4DirectorCut';
import { Station5FinalTrial } from '../stations/Station5Quiz/Station5Quiz';
import { EstadoRecursoBar, ListaRecursos, RecursoNoDisponible } from '../RecursoEstado/RecursoEstado';
import { RecursosApoyo, ResumenEjecutivo } from '../RecursosApoyo/RecursosApoyo';
import { RECURSO_POR_ESTACION, estacionDisponible, estadoDe } from '../../utils/paqueteIncremental';
import styles from './Step2KnowledgeQuest.module.css';

/**
 * Ocultos por decisión de diseño: avisos del paquete y la barra de auditoría por recurso.
 * Se siguen calculando internamente.
 */
const MOSTRAR_AVISOS_DE_CALIDAD = false;

interface Step2Props {
  quizState: QuizState;
  onQuizChange: (update: (previous: QuizState) => QuizState) => void;
  contentPackage: AdaptedContentPackage;
  escenarios?: MuestraPregenerada[];
  onAbrirEscenario?: (muestra: MuestraPregenerada) => void;
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
  onOpenCreditos?: () => void;
  isGenerating?: boolean;
  unlockedStations?: number[];
  generatingMessage?: string;
  ajustesSeleccionados?: {
    perfil?: string;
    sector?: string;
    nivel?: string;
  };
}

function listaDe<T>(valor: T[] | null | undefined, ...claves: string[]): T[] {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === 'object') {
    for (const clave of claves) {
      const lista = (valor as Record<string, unknown>)[clave];
      if (Array.isArray(lista)) return lista as T[];
    }
  }
  return [];
}

export const Step2KnowledgeQuest = ({
  quizState,
  onQuizChange,
  contentPackage,
  escenarios = [],
  onAbrirEscenario,
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
  onOpenCreditos,
  isGenerating = false,
  unlockedStations = [0, 1, 2, 3, 4],
  generatingMessage = '',
  ajustesSeleccionados,
}: Step2Props) => {
  const [lockedWarning, setLockedWarning] = useState<string | null>(null);

  useEffect(() => {
    if (lockedWarning) {
      const timer = setTimeout(() => {
        setLockedWarning(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lockedWarning]);

  const completedStationsCount = Object.values(completedStations).filter(Boolean).length;
  const isFinalTrialUnlocked = completedStationsCount >= 2;
  const unlockedList = unlockedStations || [0, 1, 2, 3, 4];

  const stationsMeta = [
    {
      index: 0,
      title: 'Resumen',
      subtitle: 'Síntesis y conceptos clave',
      icon: Zap,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 1,
      title: 'Tarjetas didácticas',
      subtitle: 'Memorización activa',
      icon: BookOpen,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 2,
      title: 'Guía paso a paso',
      subtitle: 'Tutorial interactivo',
      icon: Target,
      xp: '+75 XP',
      isLocked: false,
    },
    {
      index: 3,
      title: 'Contenido Audiovisual',
      subtitle: 'Video narrado 60s',
      icon: Clapperboard,
      xp: '+50 XP',
      isLocked: false,
    },
    {
      index: 4,
      title: 'Cuestionario',
      subtitle: 'Evaluación final',
      icon: Award,
      xp: '+100 XP',
      isLocked: !isFinalTrialUnlocked,
    },
  ];

  const handleSelectStation = (index: number) => {
    if (index === 4 && !isFinalTrialUnlocked && !isGenerating) {
      setLockedWarning(
        `Protocolo de Evaluación: Completa al menos 2 estaciones previas (${completedStationsCount}/2 completadas) para desbloquear el Cuestionario.`
      );
      return;
    }
    setLockedWarning(null);
    onSelectStationIndex(index);
  };

  const isCurrentStationReady = !isGenerating || unlockedList.includes(activeStationIndex);
  const contenido = contentPackage.contenido_adaptado;
  const recursoActivo = RECURSO_POR_ESTACION[activeStationIndex];
  const estadoActivo = estadoDe(contentPackage, recursoActivo);
  const isCurrentStationAvailable = estacionDisponible(contentPackage, activeStationIndex);
  const avisosPaquete = contentPackage.advertencias ?? [];
  const muestra = contentPackage.muestra;

  // Extracción flexible y segura de los metadatos para contemplar documento propio, muestra o "Sorpréndeme"
  const metaExt = (contentPackage.metadatos || {}) as Record<string, unknown>;
  const orqExt = (contentPackage.orquestacion || {}) as Record<string, unknown>;

  const perfilActivo =
    ajustesSeleccionados?.perfil ||
    metaExt.perfil_aplicado ||
    metaExt.perfil_destinatario ||
    muestra?.ajustes?.perfil ||
    'Principiante / Transición de Carrera';

  const sectorActivo =
    ajustesSeleccionados?.sector ||
    metaExt.nicho_sector ||
    metaExt.nicho ||
    metaExt.sector ||
    orqExt.nicho_sector ||
    muestra?.ajustes?.nicho ||
    'General (Infraestructura & Cloud)';

  const nivelActivo =
    ajustesSeleccionados?.nivel ||
    metaExt.nivel_detalle ||
    metaExt.detalle ||
    orqExt.nivel_detalle ||
    muestra?.ajustes?.detalle ||
    'Didáctico (Metáforas y Analogías)';

  return (
    <div className={styles.container}>
      {/* Toast Flotante de Protocolo de Desbloqueo */}
      {lockedWarning && (
        <div className={styles.lockedToast}>
          <div className={styles.lockedToastContent}>
            <div className={styles.lockedToastIcon}>
              <Lock size={16} />
            </div>
            <span>{lockedWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setLockedWarning(null)}
            className={styles.lockedToastClose}
            title="Cerrar notificación"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Banner de Generación Progresiva en Tiempo Real */}
      {isGenerating && (
        <div className={styles.generatingBanner}>
          <div className={styles.generatingBannerText}>
            <Sparkles size={16} className={styles.spinningIcon} color="#c084fc" />
            <span>{generatingMessage || 'Orquestando agentes pedagógicos en tiempo real...'}</span>
          </div>
          <span className={styles.generatingBannerSub}>
            Estaciones listas: {unlockedList.length} de 5
          </span>
        </div>
      )}

      {/* ── BARRA SUPERIOR DE CONTEXTO Y ESCENARIOS PEDAGÓGICOS ── */}
      {!isGenerating && (
        <>
          {/* CASO 1: Muestra precargada con múltiples escenarios para alternar */}
          {muestra && escenarios.length > 1 && onAbrirEscenario ? (
            <div className={styles.muestraBanner}>
              <div className={styles.escenariosHeader}>
                <div className={styles.escenariosTitleGroup}>
                  <Layers size={14} className={styles.escenariosIcon} />
                  <span className={styles.escenariosTitulo}>
                    Escenarios Pedagógicos Precargados
                  </span>
                  <span className={styles.escenariosSub}>
                    (Compara cómo adapta la IA el mismo documento según rol y sector)
                  </span>
                </div>

                <div className={styles.escenariosChipsGroup} role="tablist" aria-label="Variantes del documento">
                  {escenarios.map((e) => {
                    const esActivo = e.escenario === muestra.escenario;
                    const perfil = e.ajustes.perfil;
                    const sector = e.ajustes.nicho;

                    return (
                      <button
                        key={e.escenario}
                        type="button"
                        role="tab"
                        aria-selected={esActivo}
                        className={`${styles.escenarioCard} ${esActivo ? styles.escenarioCardActivo : ''}`}
                        disabled={esActivo}
                        onClick={() => onAbrirEscenario(e)}
                        title={`Cargar adaptación para ${perfil} en ${sector}`}
                      >
                        <div className={styles.escenarioContent}>
                          <span className={styles.escenarioPerfil}>{perfil}</span>
                          <span className={styles.escenarioDot}>·</span>
                          <span className={styles.escenarioSector}>{sector}</span>
                        </div>

                        {e.modo === 'clasico' && (
                          <span className={styles.badgeClasico}>RAG Clásico</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* CASOS 2, 3 y 4: Muestra de escenario único, Documento propio o Modo Sorpréndeme */
            <div className={styles.customBadgeBanner}>
              <div className={styles.customBadgeLeft}>
                <Sparkles size={14} className={styles.customSparkleIcon} />
                <span className={styles.customBadgeLabel}>
                  {muestra
                    ? 'Muestra Didáctica Preconfigurada:'
                    : 'Adaptación Pedagógica Generada:'}
                </span>
              </div>

              <div className={styles.customBadgeList}>
                <span className={styles.customTag}>
                  <strong className={styles.customTagKey}>Perfil:</strong> {String(perfilActivo)}
                </span>

                <span className={styles.customTag}>
                  <strong className={styles.customTagKey}>Sector:</strong> {String(sectorActivo)}
                </span>

                <span className={styles.customTag}>
                  <strong className={styles.customTagKey}>Nivel:</strong> {String(nivelActivo)}
                </span>

                {muestra?.modo === 'clasico' ? (
                  <span className={styles.badgeClasico}>Modo Clásico (RAG)</span>
                ) : contentPackage.metadatos?.modelo_llm ? (
                  <span className={styles.customTag}>
                    <strong className={styles.customTagKey}>Motor:</strong>{' '}
                    {contentPackage.metadatos.modelo_llm}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}

      {/* Avisos de calidad opcionales */}
      {MOSTRAR_AVISOS_DE_CALIDAD && !isGenerating && avisosPaquete.length > 0 && (
        <details className={styles.packageNotices} open={avisosPaquete.length <= 2}>
          <summary>
            {avisosPaquete.length} aviso{avisosPaquete.length > 1 ? 's' : ''} sobre este material
          </summary>
          <ul>
            {avisosPaquete.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </details>
      )}

      {/* Barra de Secuencia Stepper RPG */}
      <div className={styles.stepperBarCard}>
        <div className={styles.stepperHeader}>
          <div className={styles.titleArea}>
            <span className={styles.pulseIndicator} />
            <div className={styles.titleGroup}>
              <span className={styles.kicker}>Ruta de Aprendizaje Activa</span>
              <h2 className={styles.mainTitle}>
                {contentPackage.contenido_adaptado.titulo}
              </h2>
            </div>
          </div>
          <div className={styles.metaGroup}>
            <span className={styles.ratioCounter}>
              <strong>{completedStationsCount}</strong> de 5 Estaciones Dominadas
            </span>
          </div>
        </div>

        {/* Grilla de las 5 Estaciones */}
       <div className={styles.nodesGrid}>
          {stationsMeta.map((node) => {
            const isSelected = activeStationIndex === node.index;
            const isDone = !!completedStations[node.index];
            const isStationReady = !isGenerating || unlockedList.includes(node.index);
            const isStationFailed = estadoDe(contentPackage, RECURSO_POR_ESTACION[node.index])?.estado === 'fallido';
            const NodeIcon = node.icon;

            const selectedClass = isSelected ? styles[`nodeSelected_${node.index}`] : '';
            const accentClass = styles[`nodeAccent_${node.index}`] || '';

            return (
              <button
                key={node.index}
                type="button"
                onClick={() => handleSelectStation(node.index)}
                disabled={node.isLocked && !isGenerating}
                className={`${styles.nodeBtn} ${accentClass} ${selectedClass} ${
                  node.isLocked && !isGenerating ? styles.nodeBtnLocked : ''
                }`}
              >
                {/* ✨ CAPA AWWWARDS: Marca de agua vectorial y halo que emergen de la esquina sup-derecha */}
                <div className={styles.nodeCornerGlow} aria-hidden="true" />
                <div className={styles.nodeWatermark} aria-hidden="true">
                  <NodeIcon size={108} strokeWidth={1.2} />
                </div>

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
                      <CheckCircle2 size={15} />
                    ) : node.isLocked && !isGenerating ? (
                      <Lock size={13} color="#f59e0b" />
                    ) : !isStationReady ? (
                      <Loader2 size={13} className={styles.spinningIcon} color="#c084fc" />
                    ) : (
                      <NodeIcon size={14} />
                    )}
                  </div>

                  {!isStationReady ? (
                    <span className={styles.nodeGeneratingPill}>
                      <Loader2 size={10} className={styles.spinningIcon} />
                      <span>Generando</span>
                    </span>
                  ) : isStationFailed ? (
                    <span className={styles.nodeFailedPill}>
                      <AlertTriangle size={10} />
                      <span>No disponible</span>
                    </span>
                  ) : isGenerating ? (
                    <span className={styles.nodeReadyPill}>
                      <Sparkles size={10} />
                      <span>Lista</span>
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
                      ? 'Procesando con agente...'
                      : node.isLocked && !isGenerating
                      ? 'Requiere 2 previas'
                      : node.subtitle}
                  </div>
                </div>

                {isSelected && <div className={styles.activeGlowLine} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenedor Principal de la Estación */}
      <div className={styles.viewportContainer}>
        {!isCurrentStationReady ? (
          <div className={styles.generatingCard}>
            <div className={styles.generatingHeader}>
              <Sparkles size={26} className={styles.spinningIcon} color="#c084fc" />
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
              {contenido.estado_recursos ? (
                <ListaRecursos estados={contenido.estado_recursos} />
              ) : (
                <span>Generando y verificando recursos contra el documento fuente...</span>
              )}
            </div>
          </div>
        ) : !isCurrentStationAvailable ? (
          <RecursoNoDisponible recurso={recursoActivo} estado={estadoActivo} />
        ) : (
          <>
            {MOSTRAR_AVISOS_DE_CALIDAD && <EstadoRecursoBar estado={estadoActivo} />}

            {activeStationIndex === 0 && contenido.resumen_ninja && (
              <Station1ResumenNinja
                data={contenido.resumen_ninja}
                isCompleted={!!completedStations[0]}
                onCompleteStation={(xp) => onCompleteStation(0, xp)}
                onOpenNinjaBadge={onOpenNinjaBadge}
                diagramaMermaid={contenido.diagrama_mermaid ?? undefined}
                onNextStation={() => handleSelectStation(1)}
                resumen={<ResumenEjecutivo paquete={contentPackage} />}
              />
            )}

            {activeStationIndex === 1 && (
              <Station2FlashcardQuest
                cards={contenido.flashcards ?? []}
                isCompleted={!!completedStations[1]}
                onCompleteStation={(xp) => onCompleteStation(1, xp)}
                onOpenStreakBadge={onOpenStreakBadge}
                onNextStation={() => handleSelectStation(2)}
              />
            )}

            {activeStationIndex === 2 && (
              <Station3TutorialQuest
                steps={listaDe(contentPackage.contenido_adaptado.tutorial, 'pasos', 'steps')}
                tituloDocumento={contenido.titulo}
                objetivos={contenido.objetivos_aprendizaje}
                isCompleted={!!completedStations[2]}
                onCompleteStation={(xp) => onCompleteStation(2, xp)}
                onOpenBuilderBadge={onOpenBuilderBadge}
                onNextStation={() => handleSelectStation(3)}
              />
            )}

            {activeStationIndex === 3 && (
              <Station4DirectorCut
                documentId={
                  contentPackage.orquestacion?.documento_id ||
                  contenido.video_job_spec?.document_id ||
                  'doc-novamind'
                }
                degradaciones={contentPackage.contenido_adaptado.video_job_spec?.degradaciones}
                videoJobSpec={contentPackage.contenido_adaptado.video_job_spec}
                muestra={contentPackage.muestra}
                scenes={listaDe(contentPackage.contenido_adaptado.director_cut, 'escenas', 'scenes')}
                isCompleted={!!completedStations[3]}
                onCompleteStation={(xp) => onCompleteStation(3, xp)}
                onOpenDirectorBadge={onOpenDirectorBadge}
                onNextStation={() => handleSelectStation(4)}
              />
            )}

            {activeStationIndex === 4 && (
              <Station5FinalTrial
                quizState={quizState}
                onQuizChange={onQuizChange}
                questions={listaDe(contentPackage.contenido_adaptado.quiz, 'preguntas', 'questions')}
                completedStationsCount={completedStationsCount}
                isUnlocked={isFinalTrialUnlocked || isGenerating}
                cognitiveShields={cognitiveShields}
                onSelectStation={(idx) => handleSelectStation(idx)}
                onDeductShield={onDeductShield}
                onResetCircuit={onResetCircuit}
                onCompleteStation={(xp) => onCompleteStation(4, xp)}
                onOpenMasterBadge={onOpenMasterBadge}
                onDownloadArtifact={onDownloadArtifact}
                onOpenCreditos={onOpenCreditos}
              />
            )}
          </>
        )}

        {isCurrentStationReady && <RecursosApoyo paquete={contentPackage} estacion={activeStationIndex} />}
      </div>

      {/* Footer de Navegación Rápida */}
      <div className={styles.quickNavFooter}>
        <div className={styles.footerInfo}>
          <span className={styles.footerInfoLabel}>Estación activa:</span>
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
              <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step2KnowledgeQuest;