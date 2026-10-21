import {
  Suspense,
  lazy,
  useEffect,
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
  Award,
  Download,
  BookOpen,
  Mic,
  LoaderCircle,
  Play,
  TriangleAlert as AlertTriangle,
} from 'lucide-react';
import type { DirectorScene, MuestraPregenerada, RespuestaNarracion, VideoJobSpec } from '../../../types/types';
import { ampliarEscena, solicitarNarracion, urlsDeAudio } from '../../../services/api';
import { urlsDeMuestra } from '../../../services/muestras';
import { triggerLevelUpConfetti, triggerSmallConfetti } from '../../../utils/confetti';
import {
  BASE_WPM,
  MAX_MICROCLASS_SECONDS,
  microclassTiming,
} from '../../../utils/microclassTiming';
import { cargarVocesNavegador, elegirVozNavegador, vocesEnEspanol } from '../../../utils/vozNavegador';
import { promptVisualEscena } from '../../../utils/promptVisual';
import { PizarraDidactica } from './PizarraDidactica';
import { TeleprompterEstudio } from './TeleprompterEstudio';
import { VELOCIDADES_LOCUCION, type EstadoAmpliacion, type VelocidadLocucion } from './estudioTipos';
import { duracionesDeAudio } from './video/medirAudio';
import { marcarVoz } from '../../../utils/sonidos';
import { FuenteChip } from '../../RecursoEstado/RecursoEstado';
import styles from './Station4DirectorCut.module.css';
import estudio from './EstudioDirector.module.css';

// Remotion solo se descarga al abrir el video: la carga inicial de la app no crece
const VideoMicroclase = lazy(() => import('./video/VideoMicroclase'));

const COMPLETION_XP = 50;

/**
 * El video se genera solo si se pide y siempre con la voz del servidor (decisión del usuario,
 * 15/10): ElevenLabs y, si no, Gemini. Remotion necesita conocer la duración de cada escena, y
 * la voz del navegador no la da: esa queda para el teleprompter.
 */
type EstadoNarracion =
  | { fase: 'inactiva' }
  | { fase: 'generando'; mensaje: string }
  | {
      fase: 'lista';
      respuesta: RespuestaNarracion;
      urls: Record<number, string>;
      /** Duración de cada audio medida por el navegador: manda sobre la del servidor */
      duraciones: Record<number, number>;
      motivo?: string;
    }
  | { fase: 'error'; mensaje: string }
  // Ninguna voz funcionó: el video se ve sin voz, con el guion en pantalla, al ritmo estimado
  | { fase: 'mudo'; respuesta: RespuestaNarracion | null; motivo: string };

/** Oculto por decisión del usuario (14/10): el recuadro de estado del video (voz, fallos y avisos). */
const MOSTRAR_ESTADO_VIDEO = false;

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
  /** Muestra pregenerada: su video ya existe como archivos estáticos y no se pide al servidor */
  muestra?: MuestraPregenerada | null;
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
  muestra,
}: Station4Props) => {
  const hasRealScenes = Array.isArray(scenes) && scenes.length > 0;
  const narracionMuestra = muestra?.narracion?.status === 'exito' ? muestra.narracion : null;
  const safeScenes = hasRealScenes ? scenes : FALLBACK_SCENES;
  const totalScenes = safeScenes.length;
  const wpm = BASE_WPM;

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  // Se aprueba al ver el video hasta el cierre (decisión del usuario, 15/10)
  const [videoVisto, setVideoVisto] = useState(false);
  // Lo informa el video: mientras suena, el teleprompter no habla
  const [isPlaying, setIsPlaying] = useState(false);
  const [promptCopyState, setPromptCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  // Plegada por defecto (decisión del usuario, 14/10): se abre con "Mostrar"
  const [showRagDetails, setShowRagDetails] = useState(false);
  const [narracion, setNarracion] = useState<EstadoNarracion>(() =>
    narracionMuestra ? { fase: 'generando', mensaje: 'Cargando el video de la muestra…' } : { fase: 'inactiva' },
  );
  // Solo un video recién generado arranca solo; el de una muestra espera a que se pulse
  const [reproducirAlAbrir, setReproducirAlAbrir] = useState(false);

  // Muestra pregenerada: los audios son archivos estáticos; se mide su duración y listo (0 cuota)
  useEffect(() => {
    if (!muestra || !narracionMuestra) return;
    let vivo = true;
    const urls = urlsDeMuestra(muestra);
    void duracionesDeAudio(urls).then((duraciones) => {
      if (vivo) setNarracion({ fase: 'lista', respuesta: narracionMuestra, urls, duraciones });
    });
    return () => {
      vivo = false;
    };
  }, [muestra, narracionMuestra]);

  // Teleprompter: voz del navegador escena a escena, acento y velocidad
  const [vocesES, setVocesES] = useState<SpeechSynthesisVoice[]>([]);
  const [vozElegida, setVozElegida] = useState('');
  const [cargandoVoces, setCargandoVoces] = useState(hayVozNavegador);
  const [velocidadLocucion, setVelocidadLocucion] = useState<VelocidadLocucion>(1);
  const [hablandoTele, setHablandoTele] = useState(false);
  const teleRef = useRef<SpeechSynthesisUtterance | null>(null);
  // Con el video generado, el teleprompter reutiliza su audio de la escena (sin gastar cuota)
  const teleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Ampliaciones con IA por escena: clave `${tipo}-${índice}`
  const [ampliados, setAmpliados] = useState<Record<string, string>>({});
  const [verOriginal, setVerOriginal] = useState<Record<string, boolean>>({});
  const [estadosAmpliacion, setEstadosAmpliacion] = useState<Record<string, EstadoAmpliacion>>({});

  const urlsRef = useRef<Record<number, string>>({});
  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
      liberarUrls(urlsRef.current);
      if (teleRef.current && hayVozNavegador) window.speechSynthesis.cancel();
      teleAudioRef.current?.pause();
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

  // Mientras habla el video o el teleprompter, los efectos de sonido se callan
  useEffect(() => {
    marcarVoz('estacion4', isPlaying || hablandoTele);
  }, [isPlaying, hablandoTele]);
  useEffect(() => () => marcarVoz('estacion4', false), []);

  const completionFiredRef = useRef(false);
  const promptTimeoutRef = useRef<number | undefined>(undefined);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const currentScene = safeScenes[currentSceneIndex] ?? safeScenes[0];

  // Con video listo, la escena trae su foto (y su audio si la voz es del servidor)
  const respuestaVideo = narracion.fase === 'lista' || narracion.fase === 'mudo' ? narracion.respuesta : null;
  const narrada = respuestaVideo?.video_job_spec.escenas[currentSceneIndex];
  const viewScene = narrada ?? currentScene;
  // El teleprompter reutiliza el audio del video de la escena (sin gastar cuota)
  const audioUrl = narracion.fase === 'lista' && narrada?.audio ? narracion.urls[narrada.escena] : undefined;
  const videoListo = narracion.fase === 'lista' || narracion.fase === 'mudo';

  // Modelo de tiempo único (mismo que VideoJobSpec en el backend): palabras reales del guion,
  // nunca estimacion_palabras ni duracion_segundos declarados por el LLM.
  const microclass = useMemo(
    () => microclassTiming(safeScenes.map((sc) => sc.guion_locutor), wpm),
    [safeScenes, wpm],
  );
  const templateScenes = hasRealScenes ? safeScenes.filter((sc) => sc.origen === 'plantilla').length : 0;

  const isPassed = isCompleted || videoVisto;

  useEffect(() => () => window.clearTimeout(promptTimeoutRef.current), []);

  /** Una sola voz a la vez: antes de que suene el video, el teleprompter se calla. */
  const callarTeleprompter = () => {
    if (teleRef.current && hayVozNavegador) {
      teleRef.current = null;
      window.speechSynthesis.cancel();
    }
    if (teleAudioRef.current) {
      teleAudioRef.current.pause();
      teleAudioRef.current = null;
    }
    setHablandoTele(false);
  };

  /** El video llegó al cierre: la estación se aprueba una sola vez. */
  const aprobarVideo = () => {
    setVideoVisto(true);
    if (!hasRealScenes || isCompleted || completionFiredRef.current) return;
    completionFiredRef.current = true;
    triggerSmallConfetti();
    triggerLevelUpConfetti();
    onCompleteStation(COMPLETION_XP);
    onOpenDirectorBadge();
  };

  const goToScene = (index: number) => {
    if (index < 0 || index >= totalScenes || index === currentSceneIndex) return;
    callarTeleprompter();
    setCurrentSceneIndex(index);
  };

  /** El video avisa de lo que se ve (-1 portada, totalScenes cierre): el guion de abajo lo sigue. */
  const alCambiarEscenaVideo = (index: number) => {
    if (index >= totalScenes) aprobarVideo();
    else if (index >= 0) setCurrentSceneIndex(index);
  };

  const alReproducirVideo = (reproduciendo: boolean) => {
    if (reproduciendo) callarTeleprompter(); // una sola voz a la vez
    setIsPlaying(reproduciendo);
  };

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
   * Último recurso, cuando ninguna voz funciona: el video sin voz, con fotos y el guion en
   * pantalla, avanzando al ritmo estimado.
   */
  const videoSinVoz = async (motivo: string) => {
    setNarracion({ fase: 'generando', mensaje: 'Preparando el video sin voz…' });
    const { respuesta, aviso } = await diapositivasConFotos();
    if (!vivoRef.current) return;
    setNarracion({ fase: 'mudo', respuesta, motivo: aviso ? `${motivo} ${aviso}` : motivo });
  };

  /** Voz del servidor (ElevenLabs y, si no puede, Gemini); si tampoco, el video sin voz. */
  const generarConVozServidor = async () => {
    setIsPlaying(false);
    setNarracion({ fase: 'generando', mensaje: 'Generando la voz en el servidor (ElevenLabs y, si no, Gemini)…' });
    try {
      const respuesta = await solicitarNarracion({ ...contratoActual(), wpm: BASE_WPM });
      if (respuesta.status !== 'exito') {
        await videoSinVoz(respuesta.advertencias[0] ?? 'No hay ninguna voz disponible.');
        return;
      }
      const urls = await urlsDeAudio(respuesta);
      const duraciones = await duracionesDeAudio(urls);
      if (!vivoRef.current) {
        liberarUrls(urls);
        return;
      }
      liberarUrls(urlsRef.current);
      urlsRef.current = urls;
      setNarracion({ fase: 'lista', respuesta, urls, duraciones });
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      await videoSinVoz(`No se pudo generar la voz: ${detalle}`);
    }
  };

  /** Botón «Generar video»: el video aparece en la página y arranca solo. */
  const handleVideo = async () => {
    if (!hasRealScenes || narracion.fase === 'generando' || videoListo) return;
    callarTeleprompter();
    setReproducirAlAbrir(true);
    await generarConVozServidor();
  };

  // Botón destacado junto a las escenas: genera el video si falta y lleva al reproductor
  // y, si ya está listo, lo reproduce
  const videoRef = useRef<HTMLElement>(null);
  const [pedidoReproducir, setPedidoReproducir] = useState(0);
// Desplazamiento cinematográfico suave con curva de desaceleración (easeOutCubic)
  const animarScrollSuave = (destinoY: number, duracionMs = 850) => {
    const inicioY = window.scrollY;
    const distancia = destinoY - inicioY;
    const inicioTiempo = performance.now();

    const pasoAnimacion = (tiempoActual: number) => {
      const tiempoTranscurrido = tiempoActual - inicioTiempo;
      const progreso = Math.min(tiempoTranscurrido / duracionMs, 1);
      
      // Curva de desaceleración suave
      const ease = 1 - Math.pow(1 - progreso, 3);
      window.scrollTo(0, inicioY + distancia * ease);

      if (progreso < 1) {
        requestAnimationFrame(pasoAnimacion);
      }
    };

    requestAnimationFrame(pasoAnimacion);
  };

  const accionVideoDestacada = () => {
    if (!videoListo) {
      void handleVideo();
    } else {
      setPedidoReproducir((n) => n + 1);
    }

    if (videoRef.current) {
      // Tomamos en cuenta la barra superior fija (~100px) para que no tape el reproductor
      const offsetHeader = 100;
      const rect = videoRef.current.getBoundingClientRect();
      const espacioUtil = window.innerHeight - offsetHeader;
      
      // Centro matemático exacto en la zona visible de la pantalla
      const centroCalculado =
        window.scrollY + rect.top - offsetHeader - Math.max(0, (espacioUtil - rect.height) / 2);

      // Desplazamiento suave de 850 milisegundos
      animarScrollSuave(Math.max(0, centroCalculado), 850);
    }
  };

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
  // El audio del video solo sirve si dice exactamente el texto que se ve (no el ampliado por IA)
  const audioTele = audioUrl && narrada?.guion_locutor?.trim() === guionTele.trim() ? audioUrl : undefined;
  const vozVideo = audioTele && narrada?.audio ? narrada.audio.voz : undefined;

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
    if (hablandoTele) {
      callarTeleprompter();
      return;
    }
    if (isPlaying) return; // el video está sonando
    if (audioTele) {
      const audio = new Audio(audioTele);
      audio.playbackRate = velocidadLocucion;
      const terminarAudio = () => {
        if (teleAudioRef.current === audio) {
          teleAudioRef.current = null;
          setHablandoTele(false);
        }
      };
      audio.onended = terminarAudio;
      audio.onerror = terminarAudio;
      teleAudioRef.current = audio;
      setHablandoTele(true);
      audio.play().catch(terminarAudio);
      return;
    }
    if (!hayVozNavegador) return;
    const synth = window.speechSynthesis;
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
      {/* Halo ambiental volumétrico fucsia/violeta */}
    <div className={styles.ambientGlow} aria-hidden="true" />
      {/* Anuncios para lectores de pantalla: solo cambios significativos, nunca el reloj */}
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {`${sceneLabel(currentSceneIndex)} de ${totalScenes}: ${currentScene.titulo}. ${
          isPlaying ? 'Video en reproducción.' : ''
        }`}
      </div>

      {/* Header Superior */}
      <div className={estudio.headerContainer}>
        <div className={estudio.headerInfo}>
          <div className={estudio.badgeRow}>
            <span className={estudio.stationTag}>
              <Clapperboard size={13} color="#f0abfc" aria-hidden="true" />
              Estación 04 · Videos
            </span>
            {isCompleted && (
              <span className={estudio.completedTag}>
                <CheckCircle2 size={14} aria-hidden="true" /> Aprobada (+{COMPLETION_XP} XP)
              </span>
            )}
          </div>
          <h3 className={estudio.stationTitle}>Contenido AudioVisual</h3>
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
            <div className={estudio.progressLabel}>Microclase (verla hasta el cierre)</div>
            <div className={`${estudio.progressRatio} ${isPassed ? estudio.progressRatioPassed : ''}`}>
              {isPassed ? 'Vista' : 'Pendiente'}
            </div>
          </div>
        </div>
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

      {/* Primero el guion escena a escena; el video va debajo, a lo ancho (decisión del usuario, 15/10) */}
      {/* Tira de Escenas / Strip de Navegación, con el botón del video a la derecha */}
      <div className={styles.filaEscenas}>
      <div
        className={estudio.sceneStrip}
        role="tablist"
        aria-label="Escenas de la microclase"
        onKeyDown={handleTablistKeyDown}
      >
        {safeScenes.map((sc, idx) => {
          const isCurrent = currentSceneIndex === idx;

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
              className={`${estudio.sceneButton} ${isCurrent ? estudio.sceneButtonActive : ''}`}
            >
              <span className={estudio.sceneMeta}>
                <span className={estudio.sceneTag}>
                  {sceneLabel(idx)} · {microclass.scenes[idx]?.span ?? sc.tiempo}
                </span>
                <span className={estudio.sceneTitleText}>{sc.titulo}</span>
              </span>
            </button>
          );
        })}
      </div>
      {hasRealScenes && (
        <button
          type="button"
          onClick={accionVideoDestacada}
          disabled={narracion.fase === 'generando'}
          className={`${estudio.videoBtn} ${styles.botonVideoDestacado} ${videoListo ? styles.botonVideoListo : ''}`}
          title={videoListo ? 'Ir al video de la microclase' : 'Genera el video narrado con la voz del servidor'}
        >
          {narracion.fase === 'generando' ? (
            <LoaderCircle size={18} className={styles.spin} aria-hidden="true" />
          ) : videoListo ? (
            <Play size={18} fill="currentColor" aria-hidden="true" />
          ) : (
            <Clapperboard size={18} aria-hidden="true" />
          )}
          <span>
            {narracion.fase === 'generando'
              ? 'Generando video…'
              : videoListo
                ? 'Ver la microclase'
                : narracion.fase === 'error'
                  ? 'Reintentar video'
                  : 'Generar video narrado'}
          </span>
        </button>
      )}
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
          vozVideo={vozVideo}
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
        >
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

      {/* La estación es el video, debajo del estudio: se aprueba al verlo hasta el cierre */}
      <section ref={videoRef} className={styles.videoSeccion} aria-label="Microclase audiovisual">
        {videoListo ? (
          <Suspense
            fallback={
              <div className={styles.videoEspera}>
                <LoaderCircle size={22} className={styles.spin} aria-hidden="true" />
                <p className={styles.videoEsperaTexto}>Cargando el reproductor…</p>
              </div>
            }
          >
            <VideoMicroclase
              spec={narracion.respuesta?.video_job_spec ?? contratoActual()}
              urls={narracion.fase === 'lista' ? narracion.urls : {}}
              duraciones={narracion.fase === 'lista' ? narracion.duraciones : {}}
              onEscena={alCambiarEscenaVideo}
              onReproduciendo={alReproducirVideo}
              autoPlay={reproducirAlAbrir}
              pedidoReproducir={pedidoReproducir}
            />
          </Suspense>
        ) : (
          <div className={styles.videoEspera}>
            {narracion.fase === 'generando' ? (
              // Onda de voz animada mientras se graba la locución (sin significado de progreso real)
              <div className={styles.ondaCarga} aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 0.11}s` }} />
                ))}
              </div>
            ) : (
              <Clapperboard size={28} color="#f0abfc" aria-hidden="true" />
            )}
            <p className={styles.videoEsperaTexto} role="status" aria-live="polite">
              {narracion.fase === 'generando'
                ? narracion.mensaje
                : narracion.fase === 'error'
                  ? narracion.mensaje
                  : hasRealScenes
                    ? 'La microclase se genera cuando la pides: la voz usa la cuota gratuita del día.'
                    : 'Genera un paquete para ver su microclase.'}
            </p>
            {hasRealScenes && (
              <button
                type="button"
                onClick={() => void handleVideo()}
                disabled={narracion.fase === 'generando'}
                className={`${estudio.videoBtn} ${narracion.fase === 'error' ? estudio.videoBtnError : ''}`}
              >
                {narracion.fase === 'generando' ? (
                  <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
                ) : (
                  <Play size={16} fill="currentColor" aria-hidden="true" />
                )}
                <span>
                  {narracion.fase === 'generando'
                    ? 'Generando…'
                    : narracion.fase === 'error'
                      ? 'Reintentar video'
                      : 'Generar video'}
                </span>
              </button>
            )}
          </div>
        )}
        {MOSTRAR_ESTADO_VIDEO && hasRealScenes && <EstadoVideo estado={narracion} />}
      </section>

      {onNextStation && (
        <div className={styles.nextStationContainer}>
          <button type="button" onClick={onNextStation} className={styles.nextStationBtn}>
            <span>Siguiente Estación: Cuestionario</span>
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
        : estado.fase === 'mudo'
          ? 'Sin voz: el video avanza al ritmo estimado, con el guion de cada escena en pantalla.'
          : estado.fase === 'error'
            ? estado.mensaje
            : 'Pulsa «Generar video» para ver las diapositivas narradas con la voz del servidor.';

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
