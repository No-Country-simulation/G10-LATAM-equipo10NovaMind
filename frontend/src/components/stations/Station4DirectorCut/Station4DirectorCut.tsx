import { useState } from 'react';
import { Clapperboard, CheckCircle2, ChevronLeft, ChevronRight, Eye, Video, Award, Sparkles } from 'lucide-react';
import type { DirectorScene, AdaptedContentPackage } from '../../../types/types';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import { VideoStudioModal } from '../../VideoStudio/VideoStudioModal';
import styles from './Station4DirectorCut.module.css';

interface Station4Props {
  scenes: DirectorScene[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenDirectorBadge: () => void;
  packageData?: AdaptedContentPackage;
}

const DEFAULT_PACKAGE_DATA: AdaptedContentPackage = {
  status: 'exito',
  metadatos: {
    perfil_aplicado: 'Principiante',
    formato_generado: 'Guion de Clase / Video',
    tiempo_estimado_estudio_minutos: 5,
    conceptos_clave: ['VCN', 'Subredes', 'Seguridad OCI'],
    fecha_generacion: new Date().toISOString(),
    modelo_llm: 'Gemini Flash + RAG Grounding',
  },
  contenido_adaptado: {
    titulo: 'Microclase Didáctica OCI',
    introduccion_contextualizada:
      'Transformación didáctica del conocimiento técnico con NuevaMente Video Studio.',
    resumen_ninja: {
      titulo: 'Resumen Rápido',
      analogia_central: 'Arquitectura simplificada paso a paso.',
      conceptos_clave: [
        { id: 'c1', texto: 'Aislamiento de red', verificado: true },
        { id: 'c2', texto: 'Seguridad stateful', verificado: true },
      ],
      metricas_rapidas: {
        riesgo: 'Bajo',
        despliegue: 'Inmediato',
        tipo_oci: 'Core Networking',
        costo: '$0.00',
      },
    },
    flashcards: [],
    tutorial: [],
    director_cut: [],
    quiz: [],
  },
  evaluacion_calidad: {
    anclaje_fuente_score: 0.98,
    claridad_pedagogica: 'Alta',
    observaciones: 'Contenido adaptado con alta fidelidad a la fuente.',
    mitigacion_alucinaciones: 'Verificación RAG estricta',
    chunks_procesados: 4,
    similitud_coseno_promedio: 0.95,
  },
  almacenamiento_oci: {
    bucket: 'nuevamente-edtech-artifacts',
    objeto_id: 'microclase-video-studio.json',
    status_upload: 'completado',
    region: 'sa-saopaulo-1',
    etag: 'etag-verified-oci',
    tamano_bytes: 4096,
    url_always_free:
      'https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/ax9k3z/b/nuevamente-edtech-artifacts/o/microclase-video-studio.json',
  },
};

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
  const [isVideoStudioOpen, setIsVideoStudioOpen] = useState<boolean>(false);

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
      tiempo: '01:00',
      titulo: 'Presentación Didáctica',
      guion_locutor: 'Bienvenidos a esta sesión de aprendizaje contextualizado.',
      storyboard_visual: 'Primer plano del docente con infografía lateral ilustrativa.',
      consejo_pedagogico: 'Mantén contacto visual y ritmo reflexivo.'
    }
  ];

  const totalScenes = safeScenes.length;
  const minRequired = Math.max(1, Math.ceil(totalScenes * 0.6));
  const currentScene = safeScenes[currentSceneIndex] || safeScenes[0];

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
            onClick={() => setIsVideoStudioOpen(true)}
            className={styles.generateVideoBtn}
            title="Abrir NuevaMente Video Studio para generar microclase audiovisual interactiva"
          >
            <Sparkles size={16} color="#f0abfc" />
            <span>Generar microclase audiovisual</span>
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
            <span className={styles.sceneTimeBadge}>
              ⏱ {currentScene.tiempo}
            </span>
          </div>

          <p className={styles.scriptBox}>
            "{currentScene.guion_locutor}"
          </p>

          <div className={styles.pedagogyTip}>
            <strong style={{ color: '#f0abfc' }}>💡 Consejo Pedagógico:</strong> {currentScene.consejo_pedagogico}
          </div>
        </div>

        {/* Visual Storyboard */}
        <div className={styles.storyboardCard}>
          <div>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitleCyan}>
                Storyboard Visual · Indicación de Escena
              </span>
              <Video size={16} color="var(--color-cyan-400)" />
            </div>

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

      {/* Modal NuevaMente Video Studio */}
      <VideoStudioModal
        isOpen={isVideoStudioOpen}
        onClose={() => setIsVideoStudioOpen(false)}
        directorScenes={safeScenes}
        packageData={packageData || DEFAULT_PACKAGE_DATA}
      />
    </div>
  );
};