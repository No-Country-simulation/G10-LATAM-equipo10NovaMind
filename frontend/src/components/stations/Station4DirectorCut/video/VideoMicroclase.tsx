import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Player, type PlayerRef } from "@remotion/player";
import type { VideoJobSpec } from "../../../../types/types";
import { MicroclaseVideo } from "./MicroclaseVideo";
import {
  FPS,
  TRANSICION_FRAMES,
  escenaEnFrame,
  frameDeEscena,
  lineaVideo,
} from "./lineaVideo";
import styles from "./VideoMicroclase.module.css";

const CLAVE_SUBTITULOS = "nuevamente.video.subtitulos";
// En la portada, el índice termina de aparecer hacia el fotograma 40 (3-4 escenas)
const FRAME_PORTADA_ARMADA = 42;
/** Preferencia de este navegador; por defecto, con subtítulos */
const leerSubtitulos = () => {
  try {
    return localStorage.getItem(CLAVE_SUBTITULOS) !== "0";
  } catch {
    return true;
  }
};

interface VideoMicroclaseProps {
  spec: VideoJobSpec;
  /** blob: por número de escena; sin ellas, el video va mudo con el guion en pantalla */
  urls: Record<number, string>;
  /** Duración de cada audio medida por el navegador (manda sobre la del servidor) */
  duraciones: Record<number, number>;
  /** Escena en pantalla (índice): -1 en la portada, escenas.length en el cierre */
  onEscena: (indice: number) => void;
  onReproduciendo: (reproduciendo: boolean) => void;
  /** Arrancar solo al cargarse: sí si se acaba de generar; no en una muestra pregenerada */
  autoPlay: boolean;
  /** Cada vez que sube, el video se reproduce (botón «Ver la microclase»: hay gesto, va a pantalla completa) */
  pedidoReproducir?: number;
}

/**
 * La microclase completa en la página, con Remotion Player: portada, escenas y cierre en
 * una sola pantalla. Arranca sola al cargarse (justo después de generarla).
 * Con el foco en el video: Espacio pausa o reanuda y las flechas saltan de escena.
 */
const VideoMicroclase = ({
  spec,
  urls,
  duraciones,
  onEscena,
  onReproduciendo,
  autoPlay,
  pedidoReproducir = 0,
}: VideoMicroclaseProps) => {
  const linea = useMemo(
    () => lineaVideo(spec, urls, duraciones),
    [spec, urls, duraciones],
  );
  const playerRef = useRef<PlayerRef>(null);
  const [indice, setIndice] = useState(-1);
  const [subtitulos, setSubtitulos] = useState(leerSubtitulos);
  const alternarSubtitulos = () => {
    const nuevo = !subtitulos;
    setSubtitulos(nuevo);
    try {
      localStorage.setItem(CLAVE_SUBTITULOS, nuevo ? "1" : "0");
    } catch {
      // sin almacenamiento la preferencia dura lo que la página
    }
  };
  const avisarEscena = useEffectEvent((i: number) => onEscena(i));
  const avisarReproduccion = useEffectEvent((reproduciendo: boolean) =>
    onReproduciendo(reproduciendo),
  );
  const arrancar = useEffectEvent(() => {
    if (autoPlay) playerRef.current?.play();
  });

  // Solo al montarse: después lo maneja quien mira el video
  useEffect(() => {
    arrancar();
  }, []);

  // Pedido desde fuera (botón «Ver la microclase»): el clic aún cuenta como gesto del usuario
  useEffect(() => {
    const player = playerRef.current;
    if (pedidoReproducir > 0 && player && !player.isPlaying()) player.play();
  }, [pedidoReproducir]);

  // El Player avisa de cada fotograma: solo se propaga el cambio de escena
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    let ultimo = Number.NaN;
    const alFotograma = (e: { detail: { frame: number } }) => {
      const i = escenaEnFrame(linea, e.detail.frame);
      if (i === ultimo) return;
      ultimo = i;
      setIndice(i);
      avisarEscena(i);
    };
    // Al terminar, el Player no siempre emite el último fotograma: el cierre cuenta igual
    const alTerminar = () => {
      avisarEscena(linea.escenas.length);
      avisarReproduccion(false);
    };
    // Al dar play (con un clic o una tecla de quien mira) el video pasa a pantalla completa. El
    // autoplay tras «Generar» no tiene ese gesto y el navegador lo rechazaría: entonces no se pide.
    const alReproducir = () => {
      avisarReproduccion(true);
    };
    const alPausar = () => avisarReproduccion(false);
    player.addEventListener("frameupdate", alFotograma);
    player.addEventListener("play", alReproducir);
    player.addEventListener("pause", alPausar);
    player.addEventListener("ended", alTerminar);
    return () => {
      player.removeEventListener("frameupdate", alFotograma);
      player.removeEventListener("play", alReproducir);
      player.removeEventListener("pause", alPausar);
      player.removeEventListener("ended", alTerminar);
      avisarReproduccion(false);
    };
  }, [linea]);

  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      alternarSubtitulos();
      return;
    }
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const player = playerRef.current;
    if (!player) return;
    e.preventDefault();
    const actual = escenaEnFrame(linea, player.getCurrentFrame());
    const destino = e.key === "ArrowRight" ? actual + 1 : actual - 1;
    if (destino < 0) player.seekTo(0);
    else if (destino >= linea.escenas.length) player.seekTo(linea.desdeCierre);
    else player.seekTo(frameDeEscena(linea, destino));
  };

  const foto = linea.escenas[indice]?.scene.imagen;
  const credito = foto?.tipo === "foto" && foto.url ? foto : null;

  return (
    <div className={styles.contenedor}>
      <div className={styles.marco} onKeyDown={alTeclear}>
        <Player
          ref={playerRef}
          component={MicroclaseVideo}
          inputProps={{ linea, subtitulos }}
          durationInFrames={linea.totalFrames}
          initialFrame={Math.min(
            FRAME_PORTADA_ARMADA,
            linea.portadaFrames - TRANSICION_FRAMES - 1,
          )}
          fps={FPS}
          compositionWidth={1280}
          compositionHeight={720}
          controls
          allowFullscreen
          clickToPlay
          spaceKeyToPlayOrPause
          showVolumeControls
          acknowledgeRemotionLicense
          renderCustomControls={() => (
            <div className={styles.huecoControles}>
              <button
                type="button"
                className={styles.botonSubtitulos}
                aria-pressed={subtitulos}
                onClick={alternarSubtitulos}
                title="Mostrar u ocultar los subtítulos (tecla C)"
                aria-label={
                  subtitulos ? "Ocultar subtítulos" : "Mostrar subtítulos"
                }
              >
                CC
              </button>
            </div>
          )}
          style={{ width: "100%", aspectRatio: "16 / 9" }}
        />
      </div>

      <div className={styles.barra}>
        {/* La licencia CC exige el crédito: aquí con enlaces al autor y a la licencia */}
        {credito && (
          <p className={styles.credito}>
            Foto:{" "}
            {credito.fuente_url ? (
              <a
                href={credito.fuente_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {credito.autor}
              </a>
            ) : (
              credito.autor
            )}{" "}
            ·{" "}
            {credito.licencia_url ? (
              <a
                href={credito.licencia_url}
                target="_blank"
                rel="noopener noreferrer license"
              >
                {credito.licencia}
              </a>
            ) : (
              credito.licencia
            )}{" "}
            · vía{" "}
            {credito.proveedor === "wikimedia"
              ? "Wikimedia Commons"
              : "Openverse"}
          </p>
        )}
      </div>
    </div>
  );
};

export default VideoMicroclase;
