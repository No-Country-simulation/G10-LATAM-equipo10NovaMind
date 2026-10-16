import { Fragment } from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { ETIQUETA_VISUAL } from '../../../../utils/datosVisor';
import { TRANSICION_FRAMES, avanceExplicacion, palabraEnFrame, type EscenaVideo, type LineaVideo } from './lineaVideo';
import styles from './MicroclaseVideo.module.css';

/** subtitulos=false oculta los subtítulos y el guion fijo (lo decide quien mira) */
export type MicroclaseProps = { linea: LineaVideo; subtitulos?: boolean };

const VENTANA_SUBTITULO = 12;
const MAX_LINEAS_CODIGO = 12;
// La voz de cada escena se monta 1 s antes de sonar: sin esto, al cargar se saltaban sus primeras palabras
const PRECARGA_VOZ_FRAMES = 30;
const transicion = linearTiming({ durationInFrames: TRANSICION_FRAMES });

/** Entrada suave de un elemento, `retraso` fotogramas después de que empiece su secuencia. */
const useAparecer = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (retraso: number) => spring({ frame: frame - retraso, fps, config: { damping: 200 }, durationInFrames: 18 });
};

/**
 * El video narrado entero: portada, una secuencia por escena y cierre, unidos con
 * transiciones. Todo se calcula a partir del fotograma: saltar o pausar nunca desfasa nada.
 */
export const MicroclaseVideo = ({ linea, subtitulos = true }: MicroclaseProps) => (
  <AbsoluteFill className={styles.fondo}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={linea.portadaFrames} name="Portada">
        <Portada linea={linea} />
      </TransitionSeries.Sequence>
      {linea.escenas.map((escena, i) => (
        <Fragment key={escena.scene.escena}>
          <TransitionSeries.Transition
            presentation={i === 0 ? fade() : slide({ direction: 'from-right' })}
            timing={transicion}
          />
          <TransitionSeries.Sequence durationInFrames={escena.frames} name={`Escena ${escena.scene.escena}`}>
            <Escena escena={escena} velocidad={linea.velocidad} subtitulos={subtitulos} />
          </TransitionSeries.Sequence>
        </Fragment>
      ))}
      <TransitionSeries.Transition presentation={fade()} timing={transicion} />
      <TransitionSeries.Sequence durationInFrames={linea.cierreFrames} name="Cierre">
        <Cierre linea={linea} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {/* Las voces van fuera de TransitionSeries, en fotogramas absolutos: dentro, la transición
        vuelve a montar la escena y Remotion dejaba la etiqueta de audio compartida sin su src
        (desde la escena 2 no sonaba nada; medido con Edge el 15/10). */}
    {linea.escenas.map((escena) =>
      escena.audioUrl ? (
        <Sequence
          key={escena.scene.escena}
          from={escena.desde + escena.inicioVoz}
          durationInFrames={escena.frames - escena.inicioVoz}
          premountFor={PRECARGA_VOZ_FRAMES}
          name={`Voz ${escena.scene.escena}`}
        >
          <Audio src={escena.audioUrl} playbackRate={linea.velocidad} />
        </Sequence>
      ) : null,
    )}
    <Img src="/IsotipoMonocromo.svg" alt="" className={styles.marcaAgua} />
  </AbsoluteFill>
);

const Portada = ({ linea }: { linea: LineaVideo }) => {
  const aparecer = useAparecer();
  return (
    <AbsoluteFill className={styles.veloLiso}>
      <div className={styles.cortinilla}>
        <p className={styles.meta} style={{ opacity: aparecer(0) }}>
          NuevaMente · {linea.escenas.length} escenas
        </p>
        <h1 className={styles.tituloPortada} style={{ opacity: aparecer(4), translate: `0 ${(1 - aparecer(4)) * 24}px` }}>
          Microclase
        </h1>
        <ol className={styles.indice}>
          {linea.escenas.map((e, i) => (
            <li key={e.scene.escena} style={{ opacity: aparecer(10 + i * 5) }}>
              {e.scene.titulo}
            </li>
          ))}
        </ol>
      </div>
    </AbsoluteFill>
  );
};

/** «Lo que aprendiste»: el título y el primer punto clave de cada escena, tal como están en el guion. */
const Cierre = ({ linea }: { linea: LineaVideo }) => {
  const aparecer = useAparecer();
  return (
    <AbsoluteFill className={styles.veloLiso}>
      <div className={styles.cortinilla}>
        <p className={styles.meta} style={{ opacity: aparecer(0) }}>Para recordar</p>
        <h1 className={styles.tituloPortada} style={{ opacity: aparecer(4) }}>Lo que aprendiste</h1>
        <ul className={styles.resumen}>
          {linea.escenas.map((e, i) => {
            const punto = e.scene.visual?.puntos_clave?.[0];
            const v = aparecer(10 + i * 8);
            return (
              <li key={e.scene.escena} style={{ opacity: v, translate: `${(1 - v) * -28}px 0` }}>
                <strong>{e.scene.visual?.titulo || e.scene.titulo}</strong>
                {punto ? <span> · {punto}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Una escena: título, puntos (o diagrama que se dibuja paso a paso), código que se escribe,
 * cita verificada y foto con su crédito CC. El fotograma empieza en 0 en cada escena.
 */
const Escena = ({ escena, velocidad, subtitulos }: { escena: EscenaVideo; velocidad: number; subtitulos: boolean }) => {
  const frame = useCurrentFrame();
  const aparecer = useAparecer();
  const { scene } = escena;
  const visual = scene.visual;
  const puntos = (visual?.puntos_clave ?? []).slice(0, 4);
  const cita = (scene.fuentes ?? []).find((f) => f.verificada);
  const foto = scene.imagen?.tipo === 'foto' && scene.imagen.url ? scene.imagen : null;
  const etiqueta = visual ? (ETIQUETA_VISUAL[visual.tipo] ?? 'Concepto') : 'Concepto';
  const enFlujo = visual?.tipo === 'diagrama_bloques' && puntos.length > 1;
  const codigo = (visual?.codigo_o_estructura ?? '').trim().split('\n').slice(0, MAX_LINEAS_CODIGO).join('\n');
  const zoom = interpolate(frame, [0, escena.frames], [1, 1.08]);
  const activa = palabraEnFrame(frame, escena, velocidad);
  const inicio = Math.floor(Math.max(0, activa) / VENTANA_SUBTITULO) * VENTANA_SUBTITULO;
  const tramo = escena.palabras.slice(inicio, inicio + VENTANA_SUBTITULO);

  // Diagrama: cada bloque entra a su turno durante el 75 % de la escena (ritmo visual, no sincronía)
  const bloquesVisibles = enFlujo ? Math.ceil(avanceExplicacion(frame, escena, 0.75) * puntos.length) : 0;
  // Código: se escribe durante la primera mitad de la escena
  const caracteres = codigo ? Math.round(avanceExplicacion(frame, escena, 0.5) * codigo.length) : 0;

  return (
    <AbsoluteFill>
      {foto && (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <Img src={foto.url!} alt={foto.alt ?? ''} className={styles.foto} />
        </AbsoluteFill>
      )}
      <AbsoluteFill className={foto ? styles.veloFoto : styles.veloLiso} />

      <div className={styles.contenido}>
        <p className={styles.meta} style={{ opacity: aparecer(0) }}>
          Escena {String(scene.escena).padStart(2, '0')} · {etiqueta}
        </p>
        <h1 className={styles.titulo} style={{ opacity: aparecer(4), translate: `0 ${(1 - aparecer(4)) * 24}px` }}>
          {visual?.titulo || scene.titulo}
        </h1>

        <div className={codigo ? styles.dosColumnas : undefined}>
          {enFlujo ? (
            <ol className={styles.flujo}>
              {puntos.map((p, i) => {
                const v = i < bloquesVisibles ? 1 : 0;
                return (
                  <li key={i} className={i < bloquesVisibles - 1 ? styles.conFlecha : undefined} style={{ opacity: v, scale: `${0.9 + v * 0.1}` }}>
                    {p}
                  </li>
                );
              })}
            </ol>
          ) : (
            puntos.length > 0 && (
              <ul className={styles.puntos}>
                {puntos.map((p, i) => {
                  const v = aparecer(10 + Math.round((i * escena.frames) / (3 * puntos.length)));
                  return (
                    <li key={i} style={{ opacity: v, translate: `${(1 - v) * -28}px 0` }}>
                      {p}
                    </li>
                  );
                })}
              </ul>
            )
          )}
          {codigo && (
            <pre className={styles.codigo} style={{ opacity: aparecer(8) }}>
              <code>{codigo.slice(0, caracteres)}</code>
              {caracteres < codigo.length && <span className={styles.cursor}>▍</span>}
            </pre>
          )}
        </div>

        {cita && (
          <blockquote className={styles.cita} style={{ opacity: aparecer(20) }}>
            <span className={styles.citaTexto}>“{cita.texto_fuente}”</span>
            <cite>{cita.pagina ? `Documento · pág. ${cita.pagina}` : 'Documento fuente'}</cite>
          </blockquote>
        )}
      </div>

      {/* La licencia CC exige el crédito allí donde se ve la foto: dentro del propio video */}
      {foto && (
        <p className={styles.credito}>
          Foto: {foto.autor} · {foto.licencia} · vía {foto.proveedor === 'wikimedia' ? 'Wikimedia Commons' : 'Openverse'}
        </p>
      )}

      {/* Subtítulos solo con tiempos reales por palabra (ElevenLabs); sin voz, el guion entero, fijo */}
      {!subtitulos ? null : activa >= 0 && tramo.length > 0 ? (
        <p className={styles.subtitulos}>
          {tramo.map((p, i) => (
            <span key={inicio + i} className={inicio + i === activa ? styles.activa : undefined}>
              {p}{' '}
            </span>
          ))}
        </p>
      ) : (
        !escena.medida && <p className={`${styles.subtitulos} ${styles.guionFijo}`}>{scene.guion_locutor}</p>
      )}
    </AbsoluteFill>
  );
};
