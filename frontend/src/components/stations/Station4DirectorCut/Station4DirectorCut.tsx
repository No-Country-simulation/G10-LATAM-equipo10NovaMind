import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
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
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Sparkles,
  Copy,
  Check,
  Timer,
  Mic,
  Volume2,
  LoaderCircle,
  TriangleAlert as AlertTriangle,
} from 'lucide-react';
import type { DirectorScene, RespuestaNarracion, VideoJobSpec } from '../../../types/types';
import { solicitarNarracion, urlsDeAudio } from '../../../services/api';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import {
  BASE_WPM,
  MAX_MICROCLASS_SECONDS,
  TARGET_WORDS_MAX,
  TARGET_WORDS_MIN,
  microclassTiming,
  playbackSeconds,
  sceneSeconds,
  splitWords,
  wordIndexAtChar,
} from '../../../utils/microclassTiming';
import { cargarVocesNavegador, elegirVozNavegador } from '../../../utils/vozNavegador';
import { promptVisualEscena } from '../../../utils/promptVisual';
import { SlideNarrada } from './SlideNarrada';
import { FuenteChip } from '../../RecursoEstado/RecursoEstado';
import styles from './Station4DirectorCut.module.css';

const MAX_FRAME_DELTA_SECONDS = 0.25; // evita saltos al volver de una pestaña en segundo plano
const COMPLETION_XP = 50;

const WPM_PRESETS = [
  { value: 120, label: 'Pausado' },
  { value: BASE_WPM, label: 'Natural' },
  { value: 160, label: 'Ágil' },
] as const;

/**
 * La voz se genera solo si se pide: gasta cuota. 'navegador' es el último recurso cuando
 * ElevenLabs y Gemini fallan: la Web Speech API, sin grabación ni duración garantizada.
 */
type EstadoNarracion =
  | { fase: 'inactiva' }
  | { fase: 'generando' }
  | { fase: 'lista'; respuesta: RespuestaNarracion; urls: Record<number, string> }
  | { fase: 'error'; mensaje: string }
  | { fase: 'navegador'; voz: string; lang: string };

/** Lo que la voz del navegador informa mientras lee una escena. */
interface HablaNavegador {
  terminada: boolean;
  /** Palabra que suena según los eventos `boundary`; null si el navegador no los emite. */
  palabra: number | null;
}

const hayVozNavegador = typeof window !== 'undefined' && 'speechSynthesis' in window;

const liberarUrls = (urls: Record<number, string>) => Object.values(urls).forEach((u) => URL.revokeObjectURL(u));

const FALLBACK_SCENES: DirectorScene[] = [
  {
    id: 'sc-default',
    escena: 1,
    tiempo: '00:15',
    duracion_segundos: 15.0,
    titulo: 'Presentación Didáctica',
    guion_locutor:
      'Bienvenidos a esta sesión de aprendizaje contextualizado. Revisaremos los conceptos fundamentales.',
    storyboard_visual: 'Primer plano del docente con infografía lateral ilustrativa.',
    consejo_pedagogico: 'Mantén contacto visual, respiración diafragmática y ritmo reflexivo.',
    visual: {
      tipo: 'ppt_concepto',
      titulo: 'Introducción al Tema',
      puntos_clave: ['Contexto operativo', 'Desafío principal', 'Solución recomendada'],
    },
    fuentes: [
      {
        chunk_id: 'chk-01',
        pagina: 1,
        texto_fuente: 'Documentación técnica de referencia introductoria.',
      },
    ],
  },
];

/**
 * Fronteras acumuladas (0..1) del final de cada palabra. Pondera por longitud y
 * agrega pausa tras signos de puntuación, para que el resaltado siga la voz real.
 */
const buildWordBoundaries = (words: string[]) => {
  const weights = words.map((w) => w.length + 1 + (/[.,;:!?…]$/.test(w) ? 4 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return weights.map((w) => (acc += w) / total);
};

const wordIndexAt = (boundaries: number[], progress: number) => {
  if (progress <= 0) return -1;
  const idx = boundaries.findIndex((b) => progress < b);
  return idx === -1 ? boundaries.length : idx;
};

const formatSeconds = (s: number) => `${s.toFixed(1)}s`;

interface TeleprompterRefs {
  fill: RefObject<HTMLDivElement | null>;
  bar: RefObject<HTMLDivElement | null>;
  clock: RefObject<HTMLSpanElement | null>;
  script: RefObject<HTMLDivElement | null>;
}

/**
 * Escritura directa al DOM (fuera del ciclo de render de React) para el
 * cuadro a cuadro: barra, reloj y scroll. Solo propiedades baratas de componer.
 */
const paintTeleprompter = (refs: TeleprompterRefs, progress: number, durationSec: number) => {
  if (refs.fill.current) refs.fill.current.style.transform = `scaleX(${progress})`;
  if (refs.bar.current) refs.bar.current.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  if (refs.clock.current) {
    refs.clock.current.textContent = `${formatSeconds(progress * durationSec)} / ${formatSeconds(durationSec)}`;
  }
  const box = refs.script.current;
  if (box) {
    const maxScroll = box.scrollHeight - box.clientHeight;
    box.scrollTop = maxScroll > 0 ? progress * maxScroll : 0;
  }
};

interface Station4Props {
  scenes: DirectorScene[];
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenDirectorBadge: () => void;
  onNextStation?: () => void;
  documentId?: string;
  /** Sustituciones del sistema reportadas por el backend (video_job_spec.degradaciones) */
  degradaciones?: string[];
  /** Guion del video tal como lo entregó el backend (lleva la palabra clave de cada imagen) */
  videoJobSpec?: VideoJobSpec | null;
}

/**
 * Remonta el estudio cuando cambia el contenido de las escenas (no su identidad):
 * resetea todo el estado del reproductor de forma atómica y sin efectos.
 */
export const Station4DirectorCut = (props: Station4Props) => {
  const scenesKey = (props.scenes ?? []).map((s) => `${s.id}\u0000${s.guion_locutor}`).join('\u0001');
  return <DirectorStudio key={scenesKey} {...props} />;
};

const DirectorStudio = ({
  scenes,
  isCompleted,
  onCompleteStation,
  onOpenDirectorBadge,
  onNextStation,
  documentId,
  degradaciones = [],
  videoJobSpec,
}: Station4Props) => {
  const hasRealScenes = Array.isArray(scenes) && scenes.length > 0;
  const safeScenes = hasRealScenes ? scenes : FALLBACK_SCENES;
  const totalScenes = safeScenes.length;
  const minRequired = Math.max(1, Math.ceil(totalScenes * 0.6));

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [viewedScenes, setViewedScenes] = useState<Record<number, boolean>>({ 0: true });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [wpm, setWpm] = useState<number>(BASE_WPM);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [promptCopyState, setPromptCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [showRagDetails, setShowRagDetails] = useState(true);
  const [narracion, setNarracion] = useState<EstadoNarracion>({ fase: 'inactiva' });
  const [isTheater, setIsTheater] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hablaRef = useRef<HablaNavegador | null>(null);
  const urlsRef = useRef<Record<number, string>>({});
  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
      liberarUrls(urlsRef.current);
    };
  }, []);

  // Progreso 0..1 de la escena: vive en un ref para no re-renderizar en cada frame
  const progressRef = useRef(0);
  const completionFiredRef = useRef(false);
  const copyTimeoutRef = useRef<number | undefined>(undefined);
  const promptTimeoutRef = useRef<number | undefined>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const clockRef = useRef<HTMLSpanElement | null>(null);
  const scriptRef = useRef<HTMLDivElement | null>(null);
  const domRefs: TeleprompterRefs = { fill: fillRef, bar: barRef, clock: clockRef, script: scriptRef };

  const currentScene = safeScenes[currentSceneIndex] ?? safeScenes[0];
  const scriptWords = useMemo(() => splitWords(currentScene.guion_locutor), [currentScene.guion_locutor]);
  const wordBoundaries = useMemo(() => buildWordBoundaries(scriptWords), [scriptWords]);
  // Modelo de tiempo único (mismo que VideoJobSpec en el backend): palabras reales del guion,
  // nunca estimacion_palabras ni duracion_segundos declarados por el LLM.
  const wordCount = scriptWords.length;

  // Con narración lista, la escena trae su foto y su audio; la duración es la MEDIDA del WAV.
  const narrada = narracion.fase === 'lista' ? narracion.respuesta.video_job_spec.escenas[currentSceneIndex] : undefined;
  const viewScene = narrada ?? currentScene;
  const audioUrl = narracion.fase === 'lista' && narrada?.audio ? narracion.urls[narrada.escena] : undefined;
  const audioMode = Boolean(audioUrl);
  const browserMode = narracion.fase === 'navegador';
  const tiemposPalabras =
    audioMode && narrada?.audio?.tiempos_palabras?.length === scriptWords.length
      ? narrada.audio.tiempos_palabras
      : null;
  // Si la voz medida pasa un poco de 60 s, el backend pide reproducirla algo más rápido
  const velocidad = narracion.fase === 'lista' ? (narracion.respuesta.video_job_spec.velocidad_reproduccion ?? 1) : 1;
  // Lo que dura el audio en sí (reloj del <audio>) y lo que se escucha a esa velocidad
  const audioDurationSec = audioMode && narrada?.audio ? narrada.audio.duracion_real_s : null;
  const sceneDurationSec =
    audioDurationSec !== null ? playbackSeconds(audioDurationSec, velocidad) : sceneSeconds(wordCount, wpm);

  const microclass = useMemo(
    () => microclassTiming(safeScenes.map((sc) => sc.guion_locutor), wpm),
    [safeScenes, wpm],
  );
  const measuredTotalSec =
    narracion.fase === 'lista' ? (narracion.respuesta.duracion_total_real_s ?? null) : null;
  const realTotalSec = measuredTotalSec === null ? null : playbackSeconds(measuredTotalSec, velocidad);
  const isOverTime = (realTotalSec ?? microclass.totalSeconds) > MAX_MICROCLASS_SECONDS;
  const isWordBudgetOk =
    microclass.totalWords >= TARGET_WORDS_MIN && microclass.totalWords <= TARGET_WORDS_MAX;
  const templateScenes = hasRealScenes ? safeScenes.filter((sc) => sc.origen === 'plantilla').length : 0;

  const viewedCount = Object.values(viewedScenes).filter(Boolean).length;
  const isPassed = viewedCount >= minRequired;

  // Repinta barra/reloj/scroll cuando cambia la escena o el ritmo (el progreso relativo se conserva)
  useLayoutEffect(() => {
    paintTeleprompter(domRefs, progressRef.current, sceneDurationSec);
    // domRefs se reconstruye cada render pero contiene refs estables
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSceneIndex, sceneDurationSec]);

  useEffect(() => () => {
    window.clearTimeout(copyTimeoutRef.current);
    window.clearTimeout(promptTimeoutRef.current);
  }, []);

  const resetPlayback = () => {
    progressRef.current = 0;
    // Lo que informó la voz del navegador es de la escena anterior: un "terminada" viejo
    // haría saltar la siguiente antes de que el efecto la empiece a leer
    hablaRef.current = null;
    if (audioRef.current) audioRef.current.currentTime = 0;
    setActiveWord(-1);
    setIsFinished(false);
  };

  const goToScene = (index: number, { keepPlaying = false } = {}) => {
    if (index < 0 || index >= totalScenes || index === currentSceneIndex) return;

    resetPlayback();
    if (!keepPlaying) setIsPlaying(false);
    setCurrentSceneIndex(index);

    const nextViewed = viewedScenes[index] ? viewedScenes : { ...viewedScenes, [index]: true };
    setViewedScenes(nextViewed);

    const nextViewedCount = Object.values(nextViewed).filter(Boolean).length;
    if (
      hasRealScenes &&
      !isCompleted &&
      !completionFiredRef.current &&
      nextViewedCount >= minRequired
    ) {
      completionFiredRef.current = true;
      triggerSmallConfetti();
      triggerLevelUpConfetti();
      onCompleteStation(COMPLETION_XP);
      onOpenDirectorBadge();
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (isFinished) {
      resetPlayback();
      paintTeleprompter(domRefs, 0, sceneDurationSec);
    }
    setIsPlaying(true);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    resetPlayback();
    paintTeleprompter(domRefs, 0, sceneDurationSec);
  };

  // Motor del teleprompter: un paso por frame. Con narración, el reloj es el audio;
  // con la voz del navegador, sus eventos; sin voz, el delta real de tiempo al ritmo elegido.
  const onFrame = useEffectEvent((dtSeconds: number) => {
    if (progressRef.current >= 1) return; // ya resuelto; espera el commit del cambio de escena

    const habla = browserMode ? hablaRef.current : null;
    const audio = audioMode ? audioRef.current : null;
    let next: number;
    let word: number;
    if (habla) {
      // La voz del navegador no informa su duración: la escena acaba cuando ella acaba.
      // Hasta entonces el progreso sigue a la palabra que suena (eventos `boundary`), o al
      // ritmo elegido si el navegador no los emite, sin llegar nunca a 1.
      if (habla.terminada) {
        next = 1;
        word = scriptWords.length;
      } else if (habla.palabra !== null) {
        word = habla.palabra;
        next = Math.min(0.99, word > 0 ? wordBoundaries[word - 1] : 0);
      } else {
        next = Math.min(0.99, progressRef.current + dtSeconds / sceneDurationSec);
        word = wordIndexAt(wordBoundaries, next);
      }
    } else if (audio) {
      const audioSec =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : (audioDurationSec ?? sceneDurationSec);
      next = audio.ended ? 1 : Math.min(1, audio.currentTime / audioSec);
      // Con tiempos reales (ElevenLabs) la palabra activa es la que suena; si no, se estima
      if (tiemposPalabras) {
        const idx = tiemposPalabras.findIndex((fin) => audio.currentTime < fin);
        word = idx === -1 ? tiemposPalabras.length : idx;
      } else {
        word = wordIndexAt(wordBoundaries, next);
      }
    } else {
      next = Math.min(1, progressRef.current + dtSeconds / sceneDurationSec);
      word = wordIndexAt(wordBoundaries, next);
    }
    progressRef.current = next;
    paintTeleprompter(domRefs, next, sceneDurationSec);
    setActiveWord(word); // React descarta el set si el índice no cambió

    if (next >= 1) {
      if (autoAdvance && currentSceneIndex < totalScenes - 1) {
        goToScene(currentSceneIndex + 1, { keepPlaying: true });
      } else {
        setIsPlaying(false);
        setIsFinished(true);
      }
    }
  });

  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(MAX_FRAME_DELTA_SECONDS, (now - last) / 1000);
      last = now;
      onFrame(dt);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Cambiar `src` restablece playbackRate a defaultPlaybackRate: se fijan ambos
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = velocidad;
    audio.playbackRate = velocidad;
  }, [audioUrl, velocidad]);

  // Voz del navegador: cada escena es un enunciado nuevo. Pausar lo cancela (pause/resume
  // falla en Chrome) y reanudar relee la escena desde el principio.
  const guionActual = currentScene.guion_locutor ?? '';
  const vozNavegador = narracion.fase === 'navegador' ? narracion : null;
  useEffect(() => {
    if (!vozNavegador || !isPlaying) return;
    const synth = window.speechSynthesis;
    const habla: HablaNavegador = { terminada: false, palabra: null };
    hablaRef.current = habla;
    progressRef.current = 0;
    const enunciado = new SpeechSynthesisUtterance(guionActual);
    const voz = synth.getVoices().find((v) => v.name === vozNavegador.voz);
    if (voz) enunciado.voice = voz;
    enunciado.lang = voz?.lang ?? vozNavegador.lang;
    enunciado.onboundary = (e) => {
      if (e.name !== 'sentence') habla.palabra = wordIndexAtChar(guionActual, e.charIndex);
    };
    enunciado.onend = () => {
      habla.terminada = true;
    };
    enunciado.onerror = () => {
      habla.terminada = true;
    };
    synth.cancel();
    synth.speak(enunciado);
    return () => {
      enunciado.onboundary = enunciado.onend = enunciado.onerror = null;
      synth.cancel();
    };
  }, [vozNavegador, isPlaying, guionActual]);

  // El audio sigue al estado de reproducción; al cambiar de escena cambia su `src` y,
  // si se estaba reproduciendo (auto-avance), arranca la voz de la nueva escena.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false)); // p. ej. el navegador bloquea el autoplay
    } else {
      audio.pause();
    }
  }, [isPlaying, audioUrl]);

  const contratoActual = (): VideoJobSpec => ({
    video_job_id: videoJobSpec?.video_job_id || `vjob-${documentId || 'doc-novamind'}`,
    // El id del guion (doc-<huella>) es el que permite al backend asociar la narración al documento
    document_id: videoJobSpec?.document_id || documentId || 'doc-novamind',
    target_duration: 50,
    max_duration: MAX_MICROCLASS_SECONDS,
    aspect_ratio: '9:16',
    idioma: 'es',
    estado: 'contract_ready',
    // Duraciones, tramos y totales al MISMO wpm que se serializa (el backend recalcula igual)
    escenas: safeScenes.map((sc, i) => ({
      ...sc,
      // La palabra clave de la foto viaja en el guion del backend aunque `scenes` venga de director_cut
      imagen: sc.imagen ?? videoJobSpec?.escenas?.[i]?.imagen ?? null,
      estimacion_palabras: microclass.scenes[i].words,
      duracion_segundos: microclass.scenes[i].seconds,
      tiempo: microclass.scenes[i].span,
    })),
    total_palabras: microclass.totalWords,
    duracion_total_estimada: microclass.totalSeconds,
    wpm: Math.round(wpm),
    degradaciones,
  });

  const handleUsarVozNavegador = async () => {
    setIsPlaying(false);
    const voz = elegirVozNavegador(await cargarVocesNavegador());
    if (!vivoRef.current) return;
    if (!voz) {
      setNarracion({ fase: 'error', mensaje: 'Este navegador no tiene ninguna voz en español instalada.' });
      return;
    }
    resetPlayback();
    setNarracion({ fase: 'navegador', voz: voz.name, lang: voz.lang });
  };

  const handleGenerarNarracion = async () => {
    setIsPlaying(false);
    setNarracion({ fase: 'generando' });
    try {
      const respuesta = await solicitarNarracion({ ...contratoActual(), wpm: BASE_WPM });
      if (respuesta.status !== 'exito') {
        setNarracion({
          fase: 'error',
          mensaje: respuesta.advertencias[0] ?? 'No se pudo generar la narración. Prueba de nuevo.',
        });
        return;
      }
      const urls = await urlsDeAudio(respuesta);
      if (!vivoRef.current) {
        liberarUrls(urls);
        return;
      }
      liberarUrls(urlsRef.current);
      urlsRef.current = urls;
      progressRef.current = 0;
      setActiveWord(-1);
      setIsFinished(false);
      setNarracion({ fase: 'lista', respuesta, urls });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setNarracion({ fase: 'error', mensaje: `No se pudo generar la narración: ${detalle}` });
    }
  };

  // Atajos globales: Espacio (Play/Pausa), Flechas (escena). Respeta foco en controles nativos.
  const onGlobalKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (
      target?.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="tablist"]',
      )
    ) {
      return;
    }

    if (e.code === 'Space') {
      if (target?.closest('button, a, summary')) return; // activación nativa del control
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      goToScene(currentSceneIndex + 1);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      goToScene(currentSceneIndex - 1);
    }
  });

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onGlobalKeyDown(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // Patrón WAI-ARIA Tabs: flechas/Home/End mueven foco y selección
  const handleTablistKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const targets: Record<string, number> = {
      ArrowRight: Math.min(totalScenes - 1, currentSceneIndex + 1),
      ArrowDown: Math.min(totalScenes - 1, currentSceneIndex + 1),
      ArrowLeft: Math.max(0, currentSceneIndex - 1),
      ArrowUp: Math.max(0, currentSceneIndex - 1),
      Home: 0,
      End: totalScenes - 1,
    };
    const nextIndex = targets[e.key];
    if (nextIndex === undefined) return;
    e.preventDefault();
    goToScene(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleExportContractJson = () => {
    // Con narración, el guion exportado ya incluye fotos, rutas de audio y duraciones medidas
    const contract: VideoJobSpec =
      narracion.fase === 'lista' ? narracion.respuesta.video_job_spec : contratoActual();

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

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(currentScene.guion_locutor);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    window.clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  // Prompt para un generador de imágenes externo: lo genera el usuario con su herramienta,
  // NovaMind no gasta cuota ni presenta la imagen como propia.
  const promptVisual = promptVisualEscena(currentScene);
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptVisual);
      setPromptCopyState('copied');
    } catch {
      setPromptCopyState('error');
    }
    window.clearTimeout(promptTimeoutRef.current);
    promptTimeoutRef.current = window.setTimeout(() => setPromptCopyState('idle'), 2000);
  };

  const sceneLabel = (idx: number) => `Escena ${String(idx + 1).padStart(2, '0')}`;
  const fuentes = Array.isArray(currentScene.fuentes) ? currentScene.fuentes : [];
  const verifiedCount = fuentes.filter((f) => f.verificada).length;
  const currentSpan = microclass.scenes[currentSceneIndex]?.span ?? currentScene.tiempo;
  const playLabel = isPlaying ? 'Pausar' : isFinished ? 'Repetir' : 'Comenzar';

  return (
    <div className={styles.stationWrapper}>
      {/* Anuncios para lectores de pantalla: solo cambios significativos, nunca el reloj */}
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {`${sceneLabel(currentSceneIndex)} de ${totalScenes}: ${currentScene.titulo}. ${
          isPlaying ? 'Teleprompter en reproducción.' : isFinished ? 'Lectura finalizada.' : 'Teleprompter en pausa.'
        }`}
      </div>

      {/* Header */}
      <div className={styles.headerContainer}>
        <div className={styles.headerInfo}>
          <div className={styles.badgeRow}>
            <span className={styles.stationTag}>
              <Clapperboard size={12} aria-hidden="true" />
              Estación 04 · Storyboard & Guion Docente
            </span>
            {isCompleted && (
              <span className={styles.completedTag}>
                <CheckCircle2 size={14} aria-hidden="true" /> Aprobada (+{COMPLETION_XP} XP)
              </span>
            )}
          </div>
          <h3 className={styles.stationTitle}>Director Cut: Teleprompter & Video Studio</h3>
          <p className={styles.stationSubtitle}>
            Consola interactiva de locución y storyboard para microclases de 60 segundos. Explora{' '}
            {minRequired} de {totalScenes} escenas para aprobar.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleExportContractJson}
            className={styles.exportContractBtn}
            title="Descargar el manifiesto VideoJobSpec en JSON"
          >
            <Download size={14} aria-hidden="true" />
            <span>Exportar Contrato JSON</span>
          </button>

          {isPassed && (
            <button type="button" onClick={onOpenDirectorBadge} className={styles.badgeShowcaseBtn}>
              <Award size={16} aria-hidden="true" />
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

      {/* Presupuesto global de la microclase */}
      <div
        className={`${styles.budgetBar} ${isOverTime || !isWordBudgetOk ? styles.budgetBarWarn : ''}`}
      >
        <Timer size={14} aria-hidden="true" />
        <span>
          Microclase: <strong>{microclass.totalWords} palabras</strong> (meta {TARGET_WORDS_MIN}–{TARGET_WORDS_MAX})
        </span>
        <span aria-hidden="true">·</span>
        {realTotalSec !== null ? (
          <span>
            Voz real: <strong>{formatSeconds(realTotalSec)}</strong> / {MAX_MICROCLASS_SECONDS}s (medido del audio
            {velocidad > 1 ? `, a ${velocidad}×` : ''})
          </span>
        ) : (
          <span>
            <strong>{formatSeconds(microclass.totalSeconds)}</strong> / {MAX_MICROCLASS_SECONDS}s a {Math.round(wpm)} WPM
          </span>
        )}
        {isOverTime && <span className={styles.budgetWarnText}>Excede el máximo de 60 s a este ritmo</span>}
      </div>

      {/* Procedencia: el docente debe saber qué generó el sistema y qué no está verificado */}
      {(templateScenes > 0 || degradaciones.length > 0) && (
        <div className={styles.provenanceNotice} role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>
            {templateScenes > 0
              ? `${templateScenes} de ${totalScenes} escenas usan texto genérico del sistema porque el modelo no entregó un guion válido. `
              : ''}
            Revisa el guion contra el documento antes de grabar.
            {degradaciones.length > 0 && (
              <span className={styles.provenanceCodes}> ({degradaciones.join(', ')})</span>
            )}
          </span>
        </div>
      )}

      {/* Tira de Escenas / Selector de Storyboard */}
      <div
        className={styles.sceneStrip}
        role="tablist"
        aria-label="Escenas de la microclase"
        onKeyDown={handleTablistKeyDown}
      >
        {safeScenes.map((sc, idx) => {
          const isCurrent = currentSceneIndex === idx;
          const isViewed = !!viewedScenes[idx];

          return (
            <button
              key={sc.id || idx}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`s4-tab-${idx}`}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-controls="s4-studio-panel"
              tabIndex={isCurrent ? 0 : -1}
              onClick={() => goToScene(idx)}
              className={`${styles.sceneButton} ${
                isCurrent ? styles.sceneButtonActive : isViewed ? styles.sceneButtonViewed : ''
              }`}
            >
              <span className={styles.sceneMeta}>
                <span className={styles.sceneTag}>
                  {sceneLabel(idx)} · {microclass.scenes[idx]?.span ?? sc.tiempo}
                </span>
                <span className={styles.sceneTitleText}>{sc.titulo}</span>
              </span>
              <span className={styles.sceneIconBox}>
                {isViewed ? (
                  <CheckCircle2 size={18} className={styles.iconViewed} aria-hidden="true" />
                ) : (
                  <Eye size={18} className={styles.iconPending} aria-hidden="true" />
                )}
                <span className={styles.srOnly}>{isViewed ? '(vista)' : '(pendiente)'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Estudio Principal (Teleprompter + Storyboard) */}
      <div
        id="s4-studio-panel"
        role="tabpanel"
        aria-labelledby={`s4-tab-${currentSceneIndex}`}
        className={styles.studioViewport}
      >
        {/* PANEL IZQUIERDO: TELEPROMPTER EN VIVO */}
        <section className={styles.teleprompterCard} aria-label="Teleprompter docente">
          <div className={styles.panelHeader}>
            <div className={styles.teleprompterTitleRow}>
              <span className={styles.panelTitleFuchsia}>Teleprompter Docente</span>
              <span className={styles.liveIndicator}>
                <span
                  className={`${styles.liveDot} ${isPlaying ? styles.liveDotActive : ''}`}
                  aria-hidden="true"
                />
                {isPlaying ? 'EN TRANSMISIÓN' : 'EN ESPERA'}
              </span>
            </div>

            <div className={styles.timePillsRow}>
              <span className={`${styles.wordPill} ${styles.wordPillHighlight}`}>
                {formatSeconds(sceneDurationSec)} · {wordCount} palabras
              </span>
              {currentScene.origen === 'plantilla' && (
                <span className={`${styles.originChip} ${styles.originChipTemplate}`}>Plantilla del sistema</span>
              )}
              {currentScene.origen === 'llm_reparada' && (
                <span className={styles.originChip} title="El sistema completó campos que el modelo omitió">
                  Reparada
                </span>
              )}
              <span className={styles.sceneTimeBadge}>{currentSpan}</span>
            </div>
          </div>

          {/* Barra de progreso: transform escrito por el motor, sin re-render */}
          <div
            ref={barRef}
            className={styles.teleprompterProgressBar}
            role="progressbar"
            aria-label="Progreso de lectura de la escena"
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div ref={fillRef} className={styles.teleprompterProgressFill} />
          </div>

          {/* Controles de Reproducción y WPM */}
          <div className={styles.playerControlsRow}>
            <div className={styles.playbackButtons}>
              <button
                type="button"
                onClick={togglePlay}
                className={`${styles.playBtn} ${isPlaying ? styles.playBtnActive : ''}`}
                aria-keyshortcuts="Space"
                title={`${playLabel} teleprompter (Espacio)`}
              >
                {isPlaying ? (
                  <Pause size={16} aria-hidden="true" />
                ) : (
                  <Play size={16} fill="currentColor" aria-hidden="true" />
                )}
                <span>{playLabel}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className={styles.resetBtn}
                aria-label="Reiniciar lectura de la escena"
                title="Reiniciar lectura de la escena"
              >
                <RotateCcw size={14} aria-hidden="true" />
              </button>

              {/* Contenido escrito por el motor; React no gestiona sus hijos */}
              <span ref={clockRef} className={styles.countdownBadge} aria-hidden="true" />
            </div>

            {audioMode ? (
              <span
                className={styles.voiceChip}
                title={
                  tiemposPalabras
                    ? 'El ritmo lo marca la voz y el resaltado sigue el tiempo real de cada palabra.'
                    : 'El ritmo lo marca la voz. El resaltado reparte la duración real del audio entre las palabras: es aproximado.'
                }
              >
                <Mic size={13} aria-hidden="true" />
                Voz {narrada?.audio?.voz} · resaltado {tiemposPalabras ? 'exacto' : 'aproximado'}
              </span>
            ) : (
              <div className={styles.wpmControls} role="group" aria-labelledby="s4-wpm-label">
                <span id="s4-wpm-label" className={styles.wpmLabel}>
                  <Gauge size={13} aria-hidden="true" />
                  Ritmo
                </span>
                {WPM_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={wpm === preset.value}
                    aria-label={`${preset.label}: ${preset.value} palabras por minuto`}
                    title={preset.label}
                    onClick={() => setWpm(preset.value)}
                    className={`${styles.wpmPill} ${wpm === preset.value ? styles.wpmPillActive : ''}`}
                  >
                    {preset.value}
                  </button>
                ))}
                <span className={styles.wpmUnit} aria-hidden="true">
                  WPM
                </span>
              </div>
            )}
          </div>

          {/* Caja del Guion: línea de lectura central, palabra activa resaltada */}
          <div
            ref={scriptRef}
            className={`${styles.scriptBox} ${isPlaying ? styles.scriptBoxPlaying : ''}`}
            role="region"
            aria-label="Guion del locutor"
            tabIndex={0}
          >
            <p className={styles.scriptParagraph} aria-hidden="true">
              {scriptWords.map((word, i) => (
                <span
                  key={i}
                  className={
                    i === activeWord ? styles.wordActive : i < activeWord ? styles.wordRead : undefined
                  }
                >
                  {word}{' '}
                </span>
              ))}
            </p>
            <p className={styles.srOnly}>{currentScene.guion_locutor}</p>
          </div>

          {/* Utilidades: Copiar guion y Auto-avanzar */}
          <div className={styles.scriptUtilityRow}>
            <label className={styles.autoAdvanceLabel}>
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className={styles.checkboxInput}
              />
              <span>Auto-avanzar a siguiente escena</span>
            </label>

            <button type="button" onClick={handleCopyScript} className={styles.copyScriptBtn}>
              {copyState === 'copied' ? (
                <Check size={13} className={styles.iconViewed} aria-hidden="true" />
              ) : (
                <Copy size={13} aria-hidden="true" />
              )}
              <span aria-live="polite">
                {copyState === 'copied'
                  ? '¡Copiado!'
                  : copyState === 'error'
                    ? 'No se pudo copiar'
                    : 'Copiar Guion'}
              </span>
            </button>
          </div>

          {currentScene.objetivo_pedagogico && (
            <div className={styles.objectivePill}>
              <strong>🎯 Objetivo Didáctico:</strong> {currentScene.objetivo_pedagogico}
            </div>
          )}

          <div className={styles.pedagogyTip}>
            <strong className={styles.pedagogyTipLabel}>💡 Consejo Docente:</strong>{' '}
            {currentScene.consejo_pedagogico}
          </div>

          {/* Trazabilidad RAG */}
          {fuentes.length > 0 && (
            <div className={styles.ragSection}>
              <button
                type="button"
                onClick={() => setShowRagDetails((v) => !v)}
                className={styles.ragHeaderBtn}
                aria-expanded={showRagDetails}
                aria-controls="s4-rag-list"
              >
                <span className={styles.ragHeader}>
                  <BookOpen size={13} aria-hidden="true" />
                  <span>
                    Citas del documento ({verifiedCount}/{fuentes.length} verificadas)
                  </span>
                </span>
                <span className={styles.ragToggleText} aria-hidden="true">
                  {showRagDetails ? 'Ocultar' : 'Mostrar'}
                </span>
              </button>

              <ul id="s4-rag-list" className={styles.ragList} hidden={!showRagDetails}>
                {fuentes.map((f, i) => {
                  const status = f.verificada
                    ? { label: 'Verificada en el documento', className: styles.ragStatusVerified }
                    : f.origen === 'extracto_automatico'
                      ? { label: 'Extracto automático · no vinculado al guion', className: styles.ragStatusAuto }
                      : { label: 'No encontrada literalmente en el documento', className: styles.ragStatusUnverified };
                  return (
                    <li key={`${f.chunk_id}-${i}`} className={styles.ragCard}>
                      <span className={styles.ragMetaRow}>
                        <span className={styles.ragBadge}>
                          {f.chunk_id}
                          {f.pagina ? ` · Pág. ${f.pagina}` : ''}
                        </span>
                        <span className={`${styles.ragStatus} ${status.className}`}>{status.label}</span>
                      </span>
                      <blockquote className={styles.ragText}>"{f.texto_fuente}"</blockquote>
                      {f.verificada && f.contexto && (
                        <span className={styles.ragVisor}>
                          <FuenteChip
                            etiquetaVisor="Ver en el documento"
                            fuente={{ texto: f.texto_fuente, pagina: f.pagina ?? null, verificada: true, contexto: f.contexto }}
                          />
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* PANEL DERECHO: STORYBOARD & ESPECIFICACIÓN DETERMINISTA */}
        <section className={styles.storyboardCard} aria-label="Storyboard visual">
          <div className={styles.storyboardBody}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitleCyan}>Video narrado · Diapositiva de la escena</span>
              <Video size={16} className={styles.iconCyan} aria-hidden="true" />
            </div>

            <SlideNarrada
              scene={viewScene}
              span={currentSpan}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              isTheater={isTheater}
              onToggleTheater={() => setIsTheater((prev) => !prev)}
            />
            {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

            {hasRealScenes && (
              <NarrationControls
                estado={narracion}
                totalScenes={totalScenes}
                onGenerar={handleGenerarNarracion}
                onVozNavegador={hayVozNavegador ? handleUsarVozNavegador : undefined}
              />
            )}

            <div className={styles.storyboardVisualContent}>
              <div className={styles.storyboardVisualHeader}>
                <div className={styles.storyboardVisualLabel}>Guion Visual / Puesta en Escena:</div>
                {promptVisual && (
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className={styles.copyScriptBtn}
                    title="Copia una descripción de la escena para pegarla en el generador de imágenes que prefieras"
                  >
                    {promptCopyState === 'copied' ? (
                      <Check size={13} className={styles.iconViewed} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                    <span aria-live="polite">
                      {promptCopyState === 'copied'
                        ? '¡Copiado!'
                        : promptCopyState === 'error'
                          ? 'No se pudo copiar'
                          : 'Copiar prompt visual'}
                    </span>
                  </button>
                )}
              </div>
              {currentScene.storyboard_visual}
            </div>
          </div>

          {/* Navegación y Control de Escenas */}
          <div className={styles.playbackNav}>
            <button
              type="button"
              onClick={() => goToScene(currentSceneIndex - 1)}
              disabled={currentSceneIndex === 0}
              className={styles.navButton}
              aria-keyshortcuts="ArrowLeft"
              title="Escena anterior (Flecha Izquierda)"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Anterior</span>
            </button>

            <span className={styles.navCount}>
              Escena {currentSceneIndex + 1} de {totalScenes}
            </span>

            <button
              type="button"
              onClick={() => goToScene(currentSceneIndex + 1)}
              disabled={currentSceneIndex === totalScenes - 1}
              className={styles.navButton}
              aria-keyshortcuts="ArrowRight"
              title="Siguiente escena (Flecha Derecha)"
            >
              <span>Siguiente</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      {onNextStation && (
        <div className={styles.nextStationContainer}>
          <button type="button" onClick={onNextStation} className={styles.nextStationBtn}>
            <span>Siguiente Estación: The Final Trial (Quiz Capstone)</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};


interface NarrationControlsProps {
  estado: EstadoNarracion;
  totalScenes: number;
  onGenerar: () => void;
  /** Último recurso si fallan ElevenLabs y Gemini; undefined si el navegador no tiene voz */
  onVozNavegador?: () => void;
}

/** Botón bajo demanda + estado honesto de la narración (qué se midió, qué falló y por qué). */
const NarrationControls = ({ estado, totalScenes, onGenerar, onVozNavegador }: NarrationControlsProps) => {
  const lista = estado.fase === 'lista' ? estado.respuesta : null;
  const resumen =
    estado.fase === 'generando'
      ? `Generando la voz de ${totalScenes} escenas…`
      : lista
        ? `Voz ${lista.video_job_spec.escenas[0]?.audio?.voz ?? ''} (${
            lista.proveedor === 'elevenlabs' ? 'ElevenLabs' : 'Gemini, respaldo'
          }) · ${formatSeconds(lista.duracion_total_real_s ?? 0)} medidos${
            (lista.video_job_spec.velocidad_reproduccion ?? 1) > 1
              ? ` · se reproduce a ${lista.video_job_spec.velocidad_reproduccion}×`
              : ''
          }${
            lista.reutilizado ? ' · recuperada sin gastar cuota' : ''
          }`
        : estado.fase === 'navegador'
          ? `Voz del navegador (${estado.voz}, ${estado.lang}) · sin grabación; la duración puede variar`
          : 'Sin voz: el teleprompter avanza al ritmo elegido. La voz se genera solo si la pides.';

  return (
    <div className={styles.narrationPanel}>
      <div className={styles.narrationRow}>
        <p className={styles.narrationStatus} role="status" aria-live="polite">
          <Mic size={14} aria-hidden="true" />
          <span>{resumen}</span>
        </p>
        {!lista && (
          <button
            type="button"
            onClick={onGenerar}
            disabled={estado.fase === 'generando'}
            className={styles.narrationBtn}
          >
            {estado.fase === 'generando' ? (
              <LoaderCircle size={14} className={styles.spin} aria-hidden="true" />
            ) : (
              <Sparkles size={14} aria-hidden="true" />
            )}
            <span>
              {estado.fase === 'generando'
                ? 'Generando…'
                : estado.fase === 'error' || estado.fase === 'navegador'
                  ? 'Reintentar narración'
                  : 'Generar narración'}
            </span>
          </button>
        )}
      </div>

      {estado.fase === 'error' && (
        <p className={styles.narrationError} role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{estado.mensaje}</span>
          {onVozNavegador && (
            <button type="button" onClick={onVozNavegador} className={styles.narrationBtn}>
              <Volume2 size={14} aria-hidden="true" />
              <span>Usar voz del navegador</span>
            </button>
          )}
        </p>
      )}

      {lista && lista.advertencias.length > 0 && (
        <ul className={styles.narrationNotes}>
          {lista.advertencias.map((aviso, i) => (
            <li key={i}>{aviso}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
