import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  Clapperboard,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Award,
  Download,
  BookOpen,
  Timer,
  Mic,
  LoaderCircle,
  Play,
  TriangleAlert as AlertTriangle,
} from 'lucide-react';
import type { DirectorScene, RespuestaNarracion, VideoJobSpec } from '../../../types/types';
import { ampliarEscena, solicitarNarracion, urlsDeAudio } from '../../../services/api';
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
import {
  cargarVocesNavegador,
  elegirVozNavegador,
  regionDeVoz,
  vocesEnEspanol,
} from '../../../utils/vozNavegador';
import { promptVisualEscena } from '../../../utils/promptVisual';
import { SlideNarrada } from './SlideNarrada';
import { PizarraDidactica } from './PizarraDidactica';
import { TeleprompterEstudio } from './TeleprompterEstudio';
import { SelectorAcento } from './SelectorAcento';
import { VELOCIDADES_LOCUCION, type EstadoAmpliacion, type VelocidadLocucion } from './estudioTipos';
import { FuenteChip } from '../../RecursoEstado/RecursoEstado';
import styles from './Station4DirectorCut.module.css';
import estudio from './EstudioDirector.module.css';

const MAX_FRAME_DELTA_SECONDS = 0.25; // evita saltos al volver de una pestaña en segundo plano
const COMPLETION_XP = 50;
// Si la voz del navegador no empieza a hablar en este tiempo, se pasa a la voz del servidor
const ESPERA_INICIO_VOZ_MS = 3000;

/**
 * El video se genera solo si se pide. Orden de voces (decisión del equipo, 14/10):
 * 1. 'navegador': la voz del navegador con el acento elegido; el servidor solo pone las fotos.
 * 2. 'lista': si el navegador no tiene voz o falla, la voz del servidor (ElevenLabs y, si no, Gemini).
 */
type EstadoNarracion =
  | { fase: 'inactiva' }
  | { fase: 'generando'; mensaje: string }
  | { fase: 'lista'; respuesta: RespuestaNarracion; urls: Record<number, string>; motivo?: string }
  | { fase: 'error'; mensaje: string }
  | { fase: 'navegador'; voz: string; lang: string; respuesta: RespuestaNarracion | null; aviso?: string }
  // Ninguna voz funcionó: el video se ve sin voz, con subtítulos, al ritmo estimado
  | { fase: 'mudo'; respuesta: RespuestaNarracion | null; motivo: string };

/** Oculto por decisión del usuario (14/10): el recuadro de estado del video (voz, fallos y avisos). */
const MOSTRAR_ESTADO_VIDEO = false;

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

/** Pasajes literales del documento de una escena: solo de citas verificadas. */
const pasajesDe = (escena: DirectorScene) =>
  (escena.fuentes ?? [])
    .filter((f) => f.verificada)
    .map((f) =>
      (f.contexto ? [f.contexto.antes, f.contexto.fragmento, f.contexto.despues].join(' ') : f.texto_fuente)
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);

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
  // Aprobar exige el 100 % (decisión del usuario, 14/10; antes el 60 %)
  const minRequired = Math.max(1, totalScenes);
  const wpm = BASE_WPM;

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [viewedScenes, setViewedScenes] = useState<Record<number, boolean>>({ 0: true });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [activeWord, setActiveWord] = useState(-1);
  const [promptCopyState, setPromptCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  // Plegada por defecto (decisión del usuario, 14/10): se abre con "Mostrar"
  const [showRagDetails, setShowRagDetails] = useState(false);
  const [narracion, setNarracion] = useState<EstadoNarracion>({ fase: 'inactiva' });
  const [isTheater, setIsTheater] = useState(false);

  // Teleprompter: voz del navegador escena a escena, acento y velocidad
  const [vocesES, setVocesES] = useState<SpeechSynthesisVoice[]>([]);
  const [vozElegida, setVozElegida] = useState('');
  const [cargandoVoces, setCargandoVoces] = useState(hayVozNavegador);
  const [velocidadLocucion, setVelocidadLocucion] = useState<VelocidadLocucion>(1);
  const [hablandoTele, setHablandoTele] = useState(false);
  const teleRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Ampliaciones con IA por escena: clave `${tipo}-${índice}`
  const [ampliados, setAmpliados] = useState<Record<string, string>>({});
  const [verOriginal, setVerOriginal] = useState<Record<string, boolean>>({});
  const [estadosAmpliacion, setEstadosAmpliacion] = useState<Record<string, EstadoAmpliacion>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hablaRef = useRef<HablaNavegador | null>(null);
  const urlsRef = useRef<Record<number, string>>({});
  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
      liberarUrls(urlsRef.current);
      if (teleRef.current && hayVozNavegador) window.speechSynthesis.cancel();
    };
  }, []);

  // Voces en español del navegador (Chrome las entrega con retraso)
  useEffect(() => {
    if (!hayVozNavegador) return;
    void cargarVocesNavegador().then((voces) => {
      if (!vivoRef.current) return;
      const es = vocesEnEspanol(voces);
      setVocesES(es);
      setVozElegida((prev) => prev || elegirVozNavegador(es)?.name || '');
      setCargandoVoces(false);
    });
    // Algunos navegadores entregan más voces después (p. ej. las voces en línea de Edge)
    const alCambiar = () => {
      const es = vocesEnEspanol(window.speechSynthesis.getVoices());
      if (es.length === 0) return;
      setVocesES(es);
      setVozElegida((prev) => (es.some((v) => v.name === prev) ? prev : elegirVozNavegador(es)?.name || ''));
      setCargandoVoces(false);
    };
    window.speechSynthesis.addEventListener('voiceschanged', alCambiar);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', alCambiar);
  }, []);

  // Progreso 0..1 de la escena: vive en un ref para no re-renderizar en cada frame
  const progressRef = useRef(0);
  const completionFiredRef = useRef(false);
  const promptTimeoutRef = useRef<number | undefined>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentScene = safeScenes[currentSceneIndex] ?? safeScenes[0];
  const scriptWords = useMemo(() => splitWords(currentScene.guion_locutor), [currentScene.guion_locutor]);
  const wordBoundaries = useMemo(() => buildWordBoundaries(scriptWords), [scriptWords]);
  // Modelo de tiempo único (mismo que VideoJobSpec en el backend): palabras reales del guion,
  // nunca estimacion_palabras ni duracion_segundos declarados por el LLM.
  const wordCount = scriptWords.length;

  // Con video listo, la escena trae su foto (y su audio si la voz es del servidor)
  const respuestaVideo =
    narracion.fase === 'lista' || narracion.fase === 'navegador' || narracion.fase === 'mudo'
      ? narracion.respuesta
      : null;
  const narrada = respuestaVideo?.video_job_spec.escenas[currentSceneIndex];
  const viewScene = narrada ?? currentScene;
  const audioUrl = narracion.fase === 'lista' && narrada?.audio ? narracion.urls[narrada.escena] : undefined;
  const audioMode = Boolean(audioUrl);
  const browserMode = narracion.fase === 'navegador';
  const videoListo = narracion.fase === 'lista' || narracion.fase === 'navegador' || narracion.fase === 'mudo';
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

  useEffect(() => () => window.clearTimeout(promptTimeoutRef.current), []);

  /** Una sola voz a la vez: antes de que suene el video, el teleprompter se calla. */
  const callarTeleprompter = () => {
    if (teleRef.current && hayVozNavegador) {
      teleRef.current = null;
      window.speechSynthesis.cancel();
    }
    setHablandoTele(false);
  };

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

    callarTeleprompter();
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
    callarTeleprompter();
    if (isFinished) {
      resetPlayback();
      // Al terminar el video, reproducir de nuevo empieza por la primera escena
      if (currentSceneIndex !== 0) setCurrentSceneIndex(0);
    }
    setIsPlaying(true);
  };

  // Motor del video: un paso por frame. Con voz del servidor, el reloj es el audio;
  // con la voz del navegador, sus eventos; sin voz, el delta real de tiempo al ritmo base.
  const onFrame = useEffectEvent((dtSeconds: number) => {
    if (progressRef.current >= 1) return; // ya resuelto; espera el commit del cambio de escena

    const habla = browserMode ? hablaRef.current : null;
    const audio = audioMode ? audioRef.current : null;
    let next: number;
    let word: number;
    if (habla) {
      // La voz del navegador no informa su duración: la escena acaba cuando ella acaba.
      // Hasta entonces el progreso sigue a la palabra que suena (eventos `boundary`), o al
      // ritmo base si el navegador no los emite, sin llegar nunca a 1.
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
    setActiveWord(word); // React descarta el set si el índice no cambió

    if (next >= 1) {
      if (currentSceneIndex < totalScenes - 1) {
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

  // Si la voz del navegador falla en pleno video, se pasa a la voz del servidor
  const onFalloVozNavegador = useEffectEvent((detalle: string) => {
    setIsPlaying(false);
    void generarConVozServidor(`La voz del navegador falló (${detalle}): se usa la voz del servidor.`);
  });

  // Voz del navegador en el video: cada escena es un enunciado nuevo. Pausar lo cancela
  // (pause/resume falla en Chrome) y reanudar relee la escena desde el principio.
  const guionActual = currentScene.guion_locutor ?? '';
  const vozNavegador = narracion.fase === 'navegador' ? narracion : null;
  useEffect(() => {
    if (!vozNavegador || !isPlaying) return;
    const synth = window.speechSynthesis;
    const habla: HablaNavegador = { terminada: false, palabra: null };
    hablaRef.current = habla;
    progressRef.current = 0;
    let empezo = false;
    const enunciado = new SpeechSynthesisUtterance(guionActual);
    const voz = synth.getVoices().find((v) => v.name === vozNavegador.voz);
    if (voz) enunciado.voice = voz;
    enunciado.lang = voz?.lang ?? vozNavegador.lang;
    enunciado.onstart = () => {
      empezo = true;
    };
    enunciado.onboundary = (e) => {
      empezo = true;
      if (e.name !== 'sentence') habla.palabra = wordIndexAtChar(guionActual, e.charIndex);
    };
    enunciado.onend = () => {
      habla.terminada = true;
    };
    enunciado.onerror = (e) => {
      // 'interrupted' y 'canceled' son nuestros (pausa o cambio de escena), no un fallo
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      habla.terminada = true;
      onFalloVozNavegador(e.error);
    };
    synth.cancel();
    synth.speak(enunciado);
    const vigilante = window.setTimeout(() => {
      if (!empezo && !habla.terminada) onFalloVozNavegador('no empezó a hablar');
    }, ESPERA_INICIO_VOZ_MS);
    return () => {
      window.clearTimeout(vigilante);
      enunciado.onstart = enunciado.onboundary = enunciado.onend = enunciado.onerror = null;
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

  /** Video listo: Modo Cine desde la primera escena y reproducción automática. */
  const abrirVideo = () => {
    callarTeleprompter();
    resetPlayback();
    if (currentSceneIndex !== 0) setCurrentSceneIndex(0);
    setIsTheater(true);
    setIsPlaying(true);
  };

  /** Diapositivas con sus fotos, sin voz del servidor (no gasta ElevenLabs ni Gemini TTS). */
  const diapositivasConFotos = async (): Promise<{ respuesta: RespuestaNarracion | null; aviso?: string }> => {
    try {
      const r = await solicitarNarracion({ ...contratoActual(), wpm: BASE_WPM }, 'Kore', { vozServidor: false });
      return r.status === 'exito' ? { respuesta: r } : { respuesta: null, aviso: r.advertencias[0] };
    } catch (err) {
      // Sin fotos el video se ve igual: las diapositivas se dibujan desde el guion
      return {
        respuesta: null,
        aviso: `No se pudieron traer las fotos (${err instanceof Error ? err.message : String(err)}): se muestran las diapositivas solas.`,
      };
    }
  };

  /**
   * Último recurso, cuando ninguna voz funciona: el video sin voz, con fotos y subtítulos,
   * avanzando al ritmo estimado.
   */
  const videoSinVoz = async (motivo: string) => {
    setNarracion({ fase: 'generando', mensaje: 'Preparando el video sin voz…' });
    const { respuesta, aviso } = await diapositivasConFotos();
    if (!vivoRef.current) return;
    setNarracion({ fase: 'mudo', respuesta, motivo: aviso ? `${motivo} ${aviso}` : motivo });
    abrirVideo();
  };

  /** Respaldo: voz del servidor (ElevenLabs y, si no puede, Gemini); si tampoco, el video sin voz. */
  const generarConVozServidor = async (motivo?: string) => {
    setIsPlaying(false);
    setIsTheater(false);
    setNarracion({ fase: 'generando', mensaje: 'Generando la voz en el servidor (ElevenLabs y, si no, Gemini)…' });
    try {
      const respuesta = await solicitarNarracion({ ...contratoActual(), wpm: BASE_WPM });
      if (respuesta.status !== 'exito') {
        await videoSinVoz(respuesta.advertencias[0] ?? 'No hay ninguna voz disponible.');
        return;
      }
      const urls = await urlsDeAudio(respuesta);
      if (!vivoRef.current) {
        liberarUrls(urls);
        return;
      }
      liberarUrls(urlsRef.current);
      urlsRef.current = urls;
      setNarracion({ fase: 'lista', respuesta, urls, motivo });
      abrirVideo();
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      await videoSinVoz(`No se pudo generar la voz: ${detalle}`);
    }
  };

  /** Botón flotante: primero la voz del navegador con el acento elegido; si no hay, la del servidor. */
  const handleVideo = async () => {
    if (!hasRealScenes || narracion.fase === 'generando') return;
    if (narracion.fase === 'lista' || narracion.fase === 'mudo') {
      abrirVideo();
      return;
    }
    callarTeleprompter();
    setIsPlaying(false);
    const voces = hayVozNavegador ? vocesEnEspanol(await cargarVocesNavegador()) : [];
    if (!vivoRef.current) return;
    const voz = voces.find((v) => v.name === vozElegida) ?? elegirVozNavegador(voces);
    if (!voz) {
      await generarConVozServidor('Este navegador no tiene voces en español: se usa la voz del servidor.');
      return;
    }
    if (narracion.fase === 'navegador') {
      // Ya hay diapositivas: solo se actualiza el acento por si el usuario lo cambió
      setNarracion({ ...narracion, voz: voz.name, lang: voz.lang });
      abrirVideo();
      return;
    }
    setNarracion({ fase: 'generando', mensaje: 'Preparando las diapositivas y sus fotos…' });
    const { respuesta, aviso } = await diapositivasConFotos();
    if (!vivoRef.current) return;
    setNarracion({ fase: 'navegador', voz: voz.name, lang: voz.lang, respuesta, aviso });
    abrirVideo();
  };

  const toggleTheater = () => {
    if (isTheater) {
      setIsPlaying(false); // cerrar el cine pausa el video
      setIsTheater(false);
    } else {
      setIsTheater(true);
    }
  };

  // Atajos globales: Espacio (Play/Pausa del video en Modo Cine), Flechas (escena).
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
      if (!isTheater || target?.closest('button, a, summary')) return; // activación nativa del control
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      goToScene(currentSceneIndex + 1, { keepPlaying: isTheater && isPlaying });
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      goToScene(currentSceneIndex - 1, { keepPlaying: isTheater && isPlaying });
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
    const contract: VideoJobSpec = respuestaVideo ? respuestaVideo.video_job_spec : contratoActual();

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

  // Prompt para un generador de imágenes externo: lo genera el usuario con su herramienta,
  // NuevaMente no gasta cuota ni presenta la imagen como propia.
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

  // ------------------------------------------------------------------ ampliaciones con IA
  const claveGuion = `guion-${currentSceneIndex}`;
  const claveVisual = `visual-${currentSceneIndex}`;
  const guionAmpliado = ampliados[claveGuion] && !verOriginal[claveGuion] ? ampliados[claveGuion] : null;
  const visualEnriquecida = ampliados[claveVisual] && !verOriginal[claveVisual] ? ampliados[claveVisual] : null;
  const guionTele = guionAmpliado ?? currentScene.guion_locutor;

  const handleAmpliar = async (tipo: 'guion' | 'visual') => {
    const clave = `${tipo}-${currentSceneIndex}`;
    if (ampliados[clave]) {
      // Ya se pidió: se vuelve a mostrar sin gastar otra llamada
      setVerOriginal((prev) => ({ ...prev, [clave]: false }));
      return;
    }
    if (!hasRealScenes) {
      setEstadosAmpliacion((prev) => ({
        ...prev,
        [clave]: { fase: 'aviso', mensaje: 'No hay un paquete generado: la escena de ejemplo no se amplía.' },
      }));
      return;
    }
    const escena = currentScene;
    setEstadosAmpliacion((prev) => ({ ...prev, [clave]: { fase: 'cargando' } }));
    try {
      const r = await ampliarEscena(tipo, {
        titulo: escena.titulo,
        guion_locutor: escena.guion_locutor,
        storyboard_visual: escena.storyboard_visual ?? '',
        consejo_pedagogico: escena.consejo_pedagogico ?? '',
        pasajes: pasajesDe(escena),
      });
      if (!vivoRef.current) return;
      if (r.status === 'exito' && r.texto) {
        setAmpliados((prev) => ({ ...prev, [clave]: r.texto as string }));
        setVerOriginal((prev) => ({ ...prev, [clave]: false }));
        setEstadosAmpliacion((prev) => ({ ...prev, [clave]: { fase: 'inactiva' } }));
        if (tipo === 'guion' && teleRef.current) callarTeleprompter(); // el texto que sonaba ya no es el que se ve
        triggerSmallConfetti();
      } else {
        setEstadosAmpliacion((prev) => ({
          ...prev,
          [clave]: { fase: 'aviso', mensaje: r.mensaje ?? 'No se pudo ampliar la escena.' },
        }));
      }
    } catch (err) {
      if (!vivoRef.current) return;
      setEstadosAmpliacion((prev) => ({
        ...prev,
        [clave]: { fase: 'aviso', mensaje: `No se pudo ampliar: ${err instanceof Error ? err.message : String(err)}` },
      }));
    }
  };

  // ------------------------------------------------------------------ teleprompter con voz
  const locutar = () => {
    if (!hayVozNavegador) return;
    const synth = window.speechSynthesis;
    if (hablandoTele) {
      callarTeleprompter();
      return;
    }
    if (isPlaying) return; // el video está sonando
    synth.cancel();
    const enunciado = new SpeechSynthesisUtterance(guionTele);
    const voz = vocesES.find((v) => v.name === vozElegida);
    if (voz) {
      enunciado.voice = voz;
      enunciado.lang = voz.lang;
    } else {
      enunciado.lang = 'es-419';
    }
    enunciado.rate = velocidadLocucion;
    const terminar = () => {
      if (teleRef.current === enunciado) {
        teleRef.current = null;
        setHablandoTele(false);
      }
    };
    enunciado.onend = terminar;
    enunciado.onerror = terminar;
    teleRef.current = enunciado;
    synth.speak(enunciado);
    setHablandoTele(true);
  };

  const cambiarVelocidad = () => {
    const i = VELOCIDADES_LOCUCION.indexOf(velocidadLocucion);
    setVelocidadLocucion(VELOCIDADES_LOCUCION[(i + 1) % VELOCIDADES_LOCUCION.length]);
    callarTeleprompter(); // la nueva velocidad se aplica al volver a locutar
  };

  const cambiarVoz = (nombre: string) => {
    setVozElegida(nombre);
    callarTeleprompter();
  };

  const sceneLabel = (idx: number) => `Escena ${String(idx + 1).padStart(2, '0')}`;
  const fuentes = Array.isArray(currentScene.fuentes) ? currentScene.fuentes : [];
  const verifiedCount = fuentes.filter((f) => f.verificada).length;
  const currentSpan = microclass.scenes[currentSceneIndex]?.span ?? currentScene.tiempo;

  return (
    <div className={estudio.stationWrapper}>
      {/* Anuncios para lectores de pantalla: solo cambios significativos, nunca el reloj */}
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {`${sceneLabel(currentSceneIndex)} de ${totalScenes}: ${currentScene.titulo}. ${
          isPlaying ? 'Video en reproducción.' : isFinished ? 'Video finalizado.' : ''
        }`}
      </div>

      {/* Header Superior */}
      <div className={estudio.headerContainer}>
        <div className={estudio.headerInfo}>
          <div className={estudio.badgeRow}>
            <span className={estudio.stationTag}>
              <Clapperboard size={13} color="#f0abfc" aria-hidden="true" />
              Estación 04 · Storyboard & Guion Docente
            </span>
            {isCompleted && (
              <span className={estudio.completedTag}>
                <CheckCircle2 size={14} aria-hidden="true" /> Aprobada (+{COMPLETION_XP} XP)
              </span>
            )}
          </div>
          <h3 className={estudio.stationTitle}>Director Cut: Narrativa Pedagógica & Storyboard</h3>
          <p className={estudio.stationSubtitle}>
            Estudio interactivo de locución y storyboard para microclases de 60 segundos. Explora las {totalScenes}{' '}
            escenas para aprobar.
          </p>
        </div>

        <div className={estudio.headerActions}>
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
            <button type="button" onClick={onOpenDirectorBadge} className={estudio.badgeShowcaseBtn}>
              <Award size={16} color="var(--color-amber-400)" aria-hidden="true" />
              <span>Ver Medalla</span>
            </button>
          )}

          <div className={estudio.progressStats}>
            <div className={estudio.progressLabel}>Escenas Exploradas (Requerido: {minRequired})</div>
            <div className={`${estudio.progressRatio} ${isPassed ? estudio.progressRatioPassed : ''}`}>
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
            <strong>{formatSeconds(microclass.totalSeconds)}</strong> / {MAX_MICROCLASS_SECONDS}s estimados a{' '}
            {Math.round(wpm)} palabras por minuto
          </span>
        )}
        {isOverTime && <span className={styles.budgetWarnText}>Excede el máximo de 60 s</span>}
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

      {/* Tira de Escenas / Strip de Navegación */}
      <div
        className={estudio.sceneStrip}
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
              className={`${estudio.sceneButton} ${
                isCurrent ? estudio.sceneButtonActive : isViewed ? estudio.sceneButtonViewed : ''
              }`}
            >
              <span className={estudio.sceneMeta}>
                <span className={estudio.sceneTag}>
                  {sceneLabel(idx)} · {microclass.scenes[idx]?.span ?? sc.tiempo}
                </span>
                <span className={estudio.sceneTitleText}>{sc.titulo}</span>
              </span>
              <span className={estudio.sceneIconBox}>
                {isViewed ? (
                  <CheckCircle2 size={18} color="var(--color-emerald-400)" aria-hidden="true" />
                ) : (
                  <Eye size={18} color="var(--color-text-subtle)" aria-hidden="true" />
                )}
                <span className={styles.srOnly}>{isViewed ? '(vista)' : '(pendiente)'}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Estudio Principal (Doble Panel: Teleprompter + Pizarra Didáctica) */}
      <div
        id="s4-studio-panel"
        role="tabpanel"
        aria-labelledby={`s4-tab-${currentSceneIndex}`}
        className={estudio.studioViewport}
      >
        <TeleprompterEstudio
          scene={currentScene}
          span={currentSpan}
          guion={guionTele}
          ampliado={guionAmpliado !== null}
          onVerOriginal={() => {
            callarTeleprompter();
            setVerOriginal((prev) => ({ ...prev, [claveGuion]: true }));
          }}
          ampliacion={estadosAmpliacion[claveGuion] ?? { fase: 'inactiva' }}
          onProfundizar={() => void handleAmpliar('guion')}
          hablando={hablandoTele}
          onLocutar={locutar}
          locutarBloqueado={isPlaying && !hablandoTele}
          velocidad={velocidadLocucion}
          onVelocidad={cambiarVelocidad}
          voces={vocesES}
          vozElegida={vozElegida}
          onVoz={cambiarVoz}
          cargandoVoces={cargandoVoces}
          hayVozNavegador={hayVozNavegador}
        >
          {/* Trazabilidad RAG: las citas del documento y si están verificadas */}
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
        </TeleprompterEstudio>

        <PizarraDidactica
          scene={viewScene}
          indice={currentSceneIndex}
          total={totalScenes}
          span={currentSpan}
          enVivo={hablandoTele || isPlaying}
          visual={visualEnriquecida ?? currentScene.storyboard_visual}
          enriquecida={visualEnriquecida !== null}
          onVerOriginal={() => setVerOriginal((prev) => ({ ...prev, [claveVisual]: true }))}
          enriquecimiento={estadosAmpliacion[claveVisual] ?? { fase: 'inactiva' }}
          onEnriquecer={() => void handleAmpliar('visual')}
          promptDisponible={Boolean(promptVisual)}
          promptCopyState={promptCopyState}
          onCopyPrompt={() => void handleCopyPrompt()}
          accionVideo={
            hasRealScenes && (
              <div className={estudio.videoActions}>
                {hayVozNavegador && (
                  <SelectorAcento voces={vocesES} vozElegida={vozElegida} onVoz={cambiarVoz} cargando={cargandoVoces} />
                )}
                <button
                  type="button"
                  onClick={() => void handleVideo()}
                  disabled={narracion.fase === 'generando'}
                  className={`${estudio.videoBtn} ${narracion.fase === 'error' ? estudio.videoBtnError : ''}`}
                  aria-label={
                    videoListo
                      ? 'Ver el video en Modo Cine'
                      : narracion.fase === 'error'
                        ? 'Reintentar el video'
                        : 'Generar el video narrado'
                  }
                >
                  {narracion.fase === 'generando' ? (
                    <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
                  ) : videoListo ? (
                    <Play size={16} fill="currentColor" aria-hidden="true" />
                  ) : (
                    <Clapperboard size={16} aria-hidden="true" />
                  )}
                  <span>
                    {narracion.fase === 'generando'
                      ? 'Generando…'
                      : videoListo
                        ? 'Ver video'
                        : narracion.fase === 'error'
                          ? 'Reintentar video'
                          : 'Generar video'}
                  </span>
                </button>
              </div>
            )
          }
        >
          {MOSTRAR_ESTADO_VIDEO && hasRealScenes && <EstadoVideo estado={narracion} />}

          {/* Barra de Navegación de Escenas */}
          <div className={estudio.playbackNav}>
            <button
              type="button"
              onClick={() => goToScene(currentSceneIndex - 1)}
              disabled={currentSceneIndex === 0}
              className={estudio.navButton}
              aria-keyshortcuts="ArrowLeft"
              title="Escena anterior (Flecha Izquierda)"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Anterior</span>
            </button>
            <span className={estudio.navCount}>
              Escena {currentSceneIndex + 1} de {totalScenes}
            </span>
            <button
              type="button"
              onClick={() => goToScene(currentSceneIndex + 1)}
              disabled={currentSceneIndex === totalScenes - 1}
              className={estudio.navButton}
              aria-keyshortcuts="ArrowRight"
              title="Siguiente escena (Flecha Derecha)"
            >
              <span>Siguiente</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </PizarraDidactica>
      </div>

      {/* El video solo se ve en el Modo Cine */}
      <SlideNarrada
        scene={viewScene}
        span={currentSpan}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        isTheater={isTheater}
        onToggleTheater={toggleTheater}
        soloCine
        subtitulo={{ palabras: scriptWords, activa: activeWord }}
        sinVoz={narracion.fase === 'mudo'}
      />
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

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

/** Estado honesto del video: qué voz suena, qué se midió y qué falló. */
const EstadoVideo = ({ estado }: { estado: EstadoNarracion }) => {
  const lista = estado.fase === 'lista' ? estado.respuesta : null;
  const avisos =
    estado.fase === 'lista'
      ? [estado.motivo, ...estado.respuesta.advertencias]
      : estado.fase === 'navegador'
        ? [estado.aviso, ...(estado.respuesta?.advertencias ?? [])]
        : estado.fase === 'mudo'
          ? [estado.motivo, ...(estado.respuesta?.advertencias ?? [])]
          : [];
  const resumen =
    estado.fase === 'generando'
      ? estado.mensaje
      : lista
        ? `Voz ${lista.video_job_spec.escenas[0]?.audio?.voz ?? ''} (${
            lista.proveedor === 'elevenlabs' ? 'ElevenLabs' : 'Gemini'
          }) · ${formatSeconds(lista.duracion_total_real_s ?? 0)} medidos${
            (lista.video_job_spec.velocidad_reproduccion ?? 1) > 1
              ? ` · se reproduce a ${lista.video_job_spec.velocidad_reproduccion}×`
              : ''
          }${lista.reutilizado ? ' · recuperada sin gastar cuota' : ''}`
        : estado.fase === 'navegador'
          ? `Voz del navegador: ${regionDeVoz(estado.lang)} · ${estado.voz}`
          : estado.fase === 'mudo'
            ? 'Sin voz: el video avanza con subtítulos al ritmo estimado.'
          : estado.fase === 'error'
            ? estado.mensaje
            : 'Pulsa «Generar video» para ver las diapositivas narradas con la voz y el acento elegidos.';

  return (
    <div className={`${estudio.videoStatus} ${estado.fase === 'error' ? estudio.videoStatusError : ''}`}>
      <span role={estado.fase === 'error' ? 'alert' : 'status'} aria-live="polite">
        <Mic size={13} aria-hidden="true" /> {resumen}
      </span>
      {avisos.filter(Boolean).length > 0 && (
        <ul className={estudio.videoStatusNotes}>
          {avisos.filter(Boolean).map((aviso, i) => (
            <li key={i}>{aviso}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
