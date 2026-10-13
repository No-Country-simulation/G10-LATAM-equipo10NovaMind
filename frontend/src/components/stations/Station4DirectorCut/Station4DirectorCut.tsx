import { useState, useEffect } from 'react';
import { 
  Clapperboard, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  Award, 
  Volume2, 
  VolumeX, 
  Radio, 
  Gauge,
  Camera,
  Copy,
  Check,
  Sparkles,
  Film,
  Layers,
  Palette
} from 'lucide-react';
import type { DirectorScene, AdaptedContentPackage } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import { enrichSceneVisualDescription, expandSceneScript } from '../../../utils/geminiService';
import styles from './Station4DirectorCut.module.css';

interface Station4Props {
  scenes: DirectorScene[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenDirectorBadge: () => void;
  packageData?: AdaptedContentPackage;
}

interface SceneVisualDetails {
  framing: string;
  stageName: string;
  atmosphere: string;
  focalElement: string;
  dynamicLevel: string;
  puntosClave: string[];
}

function getSceneVisualDetails(
  sceneIndex: number, 
  scene: DirectorScene, 
  packageData?: AdaptedContentPackage
): SceneVisualDetails {
  const verifiedList = packageData?.contenido_adaptado?.resumen_ninja?.conceptos_clave || [];
  const sceneConcept = verifiedList[sceneIndex]?.texto;
  const anyVerified = verifiedList.find(c => c.verificado)?.texto;

  const framingPresets = [
    { framing: 'Plano General Establecedor', stage: 'Apertura & Gancho', atmosphere: 'Inmersiva & Reveladora', dynamic: 'Expositivo Dinámico' },
    { framing: 'Plano Medio de Conflicto', stage: 'Planteamiento del Desafío', atmosphere: 'Tensión Narrativa', dynamic: 'Tensión Progresiva' },
    { framing: 'Plano Secuencia Dinámico', stage: 'Desarrollo Conceptual', atmosphere: 'Comprensión Activa', dynamic: 'Flujo Conceptual' },
    { framing: 'Plano Detalle Simbólico', stage: 'Punto de Quiebre / Clímax', atmosphere: 'Introspectiva & Profunda', dynamic: 'Pausa de Asimilación' },
    { framing: 'Plano Cenital Panorámico', stage: 'Resolución & Cierre', atmosphere: 'Inspiradora & Consolidada', dynamic: 'Clímax & Síntesis' }
  ];

  const preset = framingPresets[sceneIndex % framingPresets.length];

  const puntosClave: string[] = [
    scene.storyboard_visual 
      ? `Puesta en escena: ${scene.storyboard_visual.slice(0, 115)}${scene.storyboard_visual.length > 115 ? '...' : ''}`
      : 'Puesta en escena visual orientada a ilustrar el concepto central con impacto didáctico.',
    scene.consejo_pedagogico 
      ? `Enfoque didáctico: ${scene.consejo_pedagogico}`
      : 'Estrategia pedagógica anclada a la asimilación del estudiante.',
    sceneConcept 
      ? `Concepto verificado: ${sceneConcept}`
      : (anyVerified ? `Anclaje temático: ${anyVerified}` : 'Verificación RAG sin alucinaciones anclada a la fuente.')
  ];

  return {
    framing: preset.framing,
    stageName: preset.stage,
    atmosphere: preset.atmosphere,
    focalElement: scene.titulo || `Escena 0${sceneIndex + 1}`,
    dynamicLevel: preset.dynamic,
    puntosClave
  };
}

export const Station4DirectorCut = ({
  scenes = [],
  isCompleted,
  onCompleteStation,
  onOpenDirectorBadge,
  packageData,
}: Station4Props) => {
  const [prevScenes, setPrevScenes] = useState(scenes);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [viewedScenes, setViewedScenes] = useState<Record<number, boolean>>({ 0: true });
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [isEnriching, setIsEnriching] = useState<boolean>(false);
  const [enrichedVisuals, setEnrichedVisuals] = useState<Record<number, string>>({});
  const [expandedScripts, setExpandedScripts] = useState<Record<number, string>>({});
  const [isExpandingScript, setIsExpandingScript] = useState<boolean>(false);

  // Sincronización al cambiar el lote de escenas desde la ingesta RAG
  if (scenes !== prevScenes) {
    setPrevScenes(scenes);
    setCurrentSceneIndex(0);
    setViewedScenes({ 0: true });
    setEnrichedVisuals({});
    setExpandedScripts({});
  }

  const safeScenes = scenes.length > 0 ? scenes : [
    {
      id: 'sc-default',
      escena: 1,
      tiempo: '00:00 - 01:30',
      titulo: 'Apertura y Planteamiento del Tema',
      guion_locutor: 'Bienvenidos a esta sesión de aprendizaje contextualizado. En esta primera escena exploraremos los pilares nucleares del tema: analizaremos las causas iniciales, las dinámicas de fondo y cómo interactúan las ideas centrales para dar forma a este dilema. Presta especial atención al contraste entre la apariencia externa y la realidad estructural que iremos desvelando a lo largo del recorrido para afianzar un dominio conceptual sólido y duradero.',
      storyboard_visual: 'Composición visual introductoria presentando el contexto inicial, los conceptos nucleares y el propósito pedagógico de la lección con atmósfera inmersiva.',
      consejo_pedagogico: 'Mantén un ritmo claro, estableciendo empatía inmediata y conectando el contenido con la experiencia cotidiana del estudiante.'
    }
  ];

  const totalScenes = safeScenes.length;
  // Regla del 100%: se requiere explorar todas las escenas
  const minRequired = totalScenes;
  const currentScene = safeScenes[currentSceneIndex] || safeScenes[0];
  const visualDetails = getSceneVisualDetails(currentSceneIndex, currentScene, packageData);

  const currentVisualText = 
    enrichedVisuals[currentSceneIndex] || 
    currentScene.storyboard_visual || 
    'Composición visual didáctica y escenografía enfocada en contextualizar la idea central de la escena con dinamismo y claridad.';

  const currentScriptText = 
    expandedScripts[currentSceneIndex] || 
    currentScene.guion_locutor;

  // Manejo de síntesis de voz en off (Web Speech API)
  const toggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentScriptText);
    utterance.lang = 'es-ES';
    utterance.rate = playbackSpeed;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  // Cambio de velocidad de locución
  const handleToggleSpeed = () => {
    const nextSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : 1.0;
    setPlaybackSpeed(nextSpeed);
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  // Cancelar audio al cambiar de escena o desmontar
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentSceneIndex]);

  const handleSelectScene = (index: number) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
    setCurrentSceneIndex(index);
    const updated = { ...viewedScenes, [index]: true };
    setViewedScenes(updated);

    const viewedCount = Object.values(updated).filter(Boolean).length;
    // Solo se aprueba la estación y se abre la medalla al explorar el 100% de las escenas
    if (viewedCount === minRequired && !isCompleted) {
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

  const handleCopyPrompt = () => {
    const promptToCopy = `Cinematic Storyboard [${currentScene.titulo}]: ${currentVisualText}. Atmosphere: ${visualDetails.atmosphere}. Framing: ${visualDetails.framing}. 16:9 aspect ratio, educational cinematography, high aesthetic, no text.`;
    navigator.clipboard.writeText(promptToCopy);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2200);
  };

  const handleEnrichVisual = async () => {
    if (isEnriching) return;
    setIsEnriching(true);
    try {
      const enriched = await enrichSceneVisualDescription(
        packageData?.contenido_adaptado?.titulo || 'Lección Didáctica',
        currentScene.titulo,
        currentVisualText,
        currentScene.guion_locutor
      );
      if (enriched && enriched.trim()) {
        setEnrichedVisuals((prev) => ({
          ...prev,
          [currentSceneIndex]: enriched.trim()
        }));
        triggerSmallConfetti();
      }
    } catch (err) {
      console.error('Error enriqueciendo descripción visual:', err);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleExpandScript = async () => {
    if (isExpandingScript) return;
    setIsExpandingScript(true);
    try {
      const expanded = await expandSceneScript(
        packageData?.contenido_adaptado?.titulo || 'Lección Didáctica',
        currentScene.titulo,
        currentScriptText,
        currentVisualText,
        currentScene.consejo_pedagogico
      );
      if (expanded && expanded.trim()) {
        setExpandedScripts((prev) => ({
          ...prev,
          [currentSceneIndex]: expanded.trim()
        }));
        triggerSmallConfetti();
      }
    } catch (err) {
      console.error('Error ampliando locución docente:', err);
    } finally {
      setIsExpandingScript(false);
    }
  };

  const viewedCount = Object.values(viewedScenes).filter(Boolean).length;
  const isPassed = totalScenes > 0 && viewedCount === minRequired;

  return (
    <div className={styles.stationWrapper}>
      {/* Header Superior */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <Clapperboard size={13} color="#f0abfc" />
              Estación 04 · Storyboard & Guion Docente
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} /> Aprobada (+50 XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>
            Director Cut: Narrativa Pedagógica & Storyboard
          </h3>
          <p className={styles.stationSubtitle}>
            Estudio interactivo de locución y visualización de storyboard para la transmisión didáctica de la lección. Requisito para aprobar: explora el 100% ({minRequired} de {totalScenes} escenas).
          </p>
        </div>

        <div className={styles.headerActions}>
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
            <div className={styles.progressLabel}>Escenas Exploradas (Requerido: {minRequired})</div>
            <div className={`${styles.progressRatio} ${isPassed ? styles.progressRatioPassed : ''}`}>
              {viewedCount} / {totalScenes}
            </div>
          </div>
        </div>
      </div>

      {/* Tira de Escenas / Strip de Navegación */}
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

      {/* Estudio Principal (Doble Panel: Teleprompter + Pizarra Didáctica de Storyboard) */}
      <div className={styles.studioViewport}>
        
        {/* PANEL 1: Teleprompter · Guion Docente (Locución Sincronizada) */}
        <div className={styles.teleprompterCard}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleGroup}>
              <Radio size={15} color="#e879f9" className={isPlayingAudio ? styles.pulsingRadio : ''} />
              <span className={styles.panelTitleFuchsia}>
                Teleprompter · Guion Docente
              </span>
            </div>
            
            <div className={styles.audioControlsGroup}>
              <button
                type="button"
                onClick={handleExpandScript}
                disabled={isExpandingScript}
                className={styles.expandScriptBtn}
                title="Ampliar la locución docente con explicaciones conceptuales profundas mediante IA"
              >
                <Sparkles size={12} className={isExpandingScript ? styles.spinningIcon : ''} />
                <span>{isExpandingScript ? 'Ampliando...' : 'Profundizar Concepto'}</span>
              </button>

              <button
                type="button"
                onClick={handleToggleSpeed}
                className={styles.speedButton}
                title="Cambiar velocidad de locución"
              >
                <Gauge size={12} />
                <span>{playbackSpeed}x</span>
              </button>

              <button
                type="button"
                onClick={toggleSpeech}
                className={`${styles.audioNarrateBtn} ${isPlayingAudio ? styles.audioNarrateBtnPlaying : ''}`}
                title={isPlayingAudio ? 'Detener locución' : 'Escuchar locución en off'}
              >
                {isPlayingAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>{isPlayingAudio ? 'Detener' : 'Locutar'}</span>
              </button>
              
              <span className={styles.sceneTimeBadge}>
                ⏱ {currentScene.tiempo}
              </span>
            </div>
          </div>

          {/* Estado de onda de audio cuando está reproduciendo */}
          {isPlayingAudio && (
            <div className={styles.equalizerWave}>
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveBar} />
              <span className={styles.waveText}>Locución en vivo activa...</span>
            </div>
          )}

          {/* Caja del Guion */}
          <div className={styles.scriptBoxContainer}>
            <span className={styles.quoteMark}>“</span>
            <p className={styles.scriptBox}>
              {currentScriptText.replace(/^["“”]|["“”]$/g, '')}
            </p>
            <span className={styles.quoteMarkEnd}>”</span>
          </div>

          {/* Consejo Pedagógico de la Escena */}
          <div className={styles.pedagogyTip}>
            <div className={styles.pedagogyHeader}>
              <span className={styles.pedagogyBadge}>💡 Enfoque Didáctico Docente</span>
            </div>
            <p className={styles.pedagogyText}>
              {currentScene.consejo_pedagogico}
            </p>
          </div>
        </div>

        {/* PANEL 2: Storyboard Visual & Pizarra Didáctica */}
        <div className={styles.blackboardCard}>
          <div>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <Film size={15} color="var(--color-cyan-400)" />
                <span className={styles.panelTitleCyan}>
                  Pizarra Didáctica · Escena 0{currentSceneIndex + 1}
                </span>
              </div>
              <span className={styles.ragBadge}>
                <CheckCircle2 size={12} color="var(--color-cyan-400)" /> Anclaje RAG Verificado
              </span>
            </div>

            {/* Título del Concepto y Puesta en Escena */}
            <div className={styles.conceptHeader}>
              <span className={styles.conceptCategory}>Storyboard & Puesta en Escena Didáctica</span>
              <h4 className={styles.conceptTitle}>{currentScene.titulo}</h4>
            </div>

            {/* Viewfinder / Monitor de Director Cinematográfico */}
            <div className={styles.viewfinderContainer}>
              <div className={styles.viewfinderCornerTL} />
              <div className={styles.viewfinderCornerTR} />
              <div className={styles.viewfinderCornerBL} />
              <div className={styles.viewfinderCornerBR} />

              <div className={styles.viewfinderTopBar}>
                <div className={styles.viewfinderRecGroup}>
                  <span className={styles.viewfinderRecDot} />
                  <span className={styles.viewfinderRecText}>TOMA 0{currentSceneIndex + 1}</span>
                </div>
                <div className={styles.viewfinderTimecode}>
                  ⏱ {currentScene.tiempo}
                </div>
                <div className={styles.viewfinderFps}>
                  24 FPS · 16:9
                </div>
              </div>

              <div className={styles.viewfinderGrid} />

              <div className={styles.storyboardContentBox}>
                <div className={styles.storyboardHeaderRow}>
                  <div className={styles.storyboardHeaderPill}>
                    <Camera size={13} color="#38bdf8" />
                    <span>Descripción Visual de la Escena (Storyboard)</span>
                  </div>

                  <div className={styles.storyboardActionBtns}>
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className={`${styles.actionBtn} ${copiedPrompt ? styles.actionBtnActive : ''}`}
                      title="Copiar prompt visual detallado para generador de imágenes"
                    >
                      {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedPrompt ? '¡Copiado!' : 'Copiar Prompt'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnrichVisual}
                      disabled={isEnriching}
                      className={styles.enrichBtn}
                      title="Enriquecer descripción visual con IA (detalles de encuadre, iluminación y props)"
                    >
                      <Sparkles size={12} className={isEnriching ? styles.spinningIcon : ''} />
                      <span>{isEnriching ? 'Enriqueciendo...' : 'Enriquecer con IA'}</span>
                    </button>
                  </div>
                </div>

                <div className={styles.storyboardVisualTextContainer}>
                  <p className={styles.storyboardVisualText}>
                    {currentVisualText}
                  </p>
                </div>

                <div className={styles.storyboardPillsRow}>
                  <div className={styles.storyboardPillItem}>
                    <Eye size={12} color="#38bdf8" />
                    <span className={styles.pillLabel}>Foco:</span>
                    <span className={styles.pillValue}>{currentScene.titulo}</span>
                  </div>
                  <div className={styles.storyboardPillItem}>
                    <Palette size={12} color="#f0abfc" />
                    <span className={styles.pillLabel}>Atmósfera:</span>
                    <span className={styles.pillValue}>{visualDetails.atmosphere}</span>
                  </div>
                  <div className={styles.storyboardPillItem}>
                    <Layers size={12} color="#34d399" />
                    <span className={styles.pillLabel}>Encuadre:</span>
                    <span className={styles.pillValue}>{visualDetails.framing}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ficha Técnica de Producción Didáctica */}
            <div className={styles.techMetricsGrid}>
              <div className={styles.techMetricItem}>
                <span className={styles.techMetricLabel}>Duración</span>
                <span className={styles.techMetricValue}>{currentScene.tiempo}</span>
              </div>
              <div className={styles.techMetricItem}>
                <span className={styles.techMetricLabel}>Etapa Narrativa</span>
                <span className={styles.techMetricValue}>{visualDetails.stageName}</span>
              </div>
              <div className={styles.techMetricItem}>
                <span className={styles.techMetricLabel}>Dinamismo</span>
                <span className={styles.techMetricValue}>{visualDetails.dynamicLevel}</span>
              </div>
              <div className={styles.techMetricItem}>
                <span className={styles.techMetricLabel}>Verificación</span>
                <span className={styles.techMetricValue}>Anclaje 100%</span>
              </div>
            </div>

            {/* Puntos Clave Pedagógicos y Visuales */}
            <div className={styles.verifiedPointsContainer}>
              <span className={styles.verifiedPointsTitle}>Puntos Clave Didácticos & Visuales:</span>
              <ul className={styles.verifiedPointsList}>
                {visualDetails.puntosClave.map((punto, pIdx) => (
                  <li key={pIdx} className={styles.verifiedPointItem}>
                    <CheckCircle2 size={13} color="var(--color-cyan-400)" className={styles.pointCheckIcon} />
                    <span>{punto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Barra de Navegación de Escenas */}
          <div className={styles.playbackNav}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentSceneIndex === 0}
              className={styles.navButton}
              title="Escena anterior"
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>
            <span className={styles.navCount}>
              Escena {currentSceneIndex + 1} de {totalScenes}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentSceneIndex === totalScenes - 1}
              className={styles.navButton}
              title="Siguiente escena"
            >
              <span>Siguiente</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};