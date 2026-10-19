/**
 * Efectos de sonido de la interfaz, sintetizados con Web Audio: no hay archivos ni licencias.
 *
 * Reglas:
 * - Nunca suenan encima de una voz (video narrado o teleprompter de la Estación 04).
 * - El usuario los apaga con el botón 🔊/🔇 de la barra superior; la preferencia se recuerda.
 *   Si el navegador no deja leer la preferencia, quedan apagados.
 * - El AudioContext se crea en el primer sonido, que siempre sigue a un clic: los navegadores
 *   no dejan sonar audio antes de que el usuario interactúe con la página.
 */

export type Efecto = 'giro' | 'acierto' | 'error' | 'logro' | 'fanfarria';

const CLAVE = 'nuevamente.sonido';
const VOLUMEN = 0.35;

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/** Preferencia guardada: activos salvo que se hayan apagado; apagados si no hay almacenamiento. */
export function leerPreferencia(almacen: Almacen | null | undefined): boolean {
  if (!almacen) return false;
  try {
    return almacen.getItem(CLAVE) !== 'off';
  } catch {
    return false;
  }
}

export function guardarPreferencia(almacen: Almacen | null | undefined, activo: boolean): void {
  try {
    almacen?.setItem(CLAVE, activo ? 'on' : 'off');
  } catch {
    // sin almacenamiento la preferencia dura solo esta visita
  }
}

const almacenNavegador = (): Almacen | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

let activo = leerPreferencia(almacenNavegador());
const oyentes = new Set<() => void>();

export const sonidoActivo = (): boolean => activo;

export function cambiarSonido(valor: boolean): void {
  activo = valor;
  guardarPreferencia(almacenNavegador(), valor);
  oyentes.forEach((o) => o());
}

/** Para useSyncExternalStore: el botón de la barra se entera de los cambios. */
export function suscribirSonido(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

// --- Voces en curso: mientras alguna habla, los efectos se callan ---------------------------
const vocesEnCurso = new Set<string>();

export function marcarVoz(fuente: string, hablando: boolean): void {
  if (hablando) vocesEnCurso.add(fuente);
  else vocesEnCurso.delete(fuente);
}

export const hayVozEnCurso = (): boolean =>
  vocesEnCurso.size > 0 || (typeof window !== 'undefined' && !!window.speechSynthesis?.speaking);

/** Decisión pura, separada para poder probarla sin navegador. */
export const debeSonar = (estado: { activo: boolean; vozEnCurso: boolean; hayAudio: boolean }): boolean =>
  estado.activo && !estado.vozEnCurso && estado.hayAudio;

// --- Síntesis --------------------------------------------------------------------------------
let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (contexto) return contexto;
  const Ctor = typeof window !== 'undefined'
    ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;
  if (!Ctor) return null;
  try {
    contexto = new Ctor();
  } catch {
    return null;
  }
  return contexto;
}

/** Una nota con ataque corto y caída suave. */
function nota(ctx: AudioContext, salida: AudioNode, frecuencia: number, inicio: number, duracion: number,
  forma: OscillatorType = 'triangle', hasta?: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = forma;
  osc.frequency.setValueAtTime(frecuencia, inicio);
  if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, inicio + duracion);
  env.gain.setValueAtTime(0.0001, inicio);
  env.gain.exponentialRampToValueAtTime(1, inicio + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(env).connect(salida);
  osc.start(inicio);
  osc.stop(inicio + duracion + 0.02);
}

/** Soplido de ruido filtrado: el giro de una tarjeta. */
function soplido(ctx: AudioContext, salida: AudioNode, inicio: number, duracion: number) {
  const muestras = Math.floor(ctx.sampleRate * duracion);
  const buffer = ctx.createBuffer(1, muestras, ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = Math.random() * 2 - 1;
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.Q.value = 1.2;
  filtro.frequency.setValueAtTime(500, inicio);
  filtro.frequency.exponentialRampToValueAtTime(2600, inicio + duracion);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, inicio);
  env.gain.exponentialRampToValueAtTime(1, inicio + duracion * 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  fuente.connect(filtro).connect(env).connect(salida);
  fuente.start(inicio);
  fuente.stop(inicio + duracion);
}

const DO5 = 523.25, MI5 = 659.25, SOL5 = 783.99, DO6 = 1046.5, SI5 = 987.77;

export function sonar(efecto: Efecto): void {
  if (!debeSonar({ activo, vozEnCurso: hayVozEnCurso(), hayAudio: true })) return;
  const ctx = obtenerContexto();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const salida = ctx.createGain();
  salida.gain.value = VOLUMEN;
  salida.connect(ctx.destination);
  const t = ctx.currentTime + 0.01;
  switch (efecto) {
    case 'giro':
      soplido(ctx, salida, t, 0.18);
      break;
    case 'acierto':
      nota(ctx, salida, MI5, t, 0.14);
      nota(ctx, salida, SI5, t + 0.09, 0.22);
      break;
    case 'error':
      nota(ctx, salida, 247, t, 0.28, 'sine', 165);
      break;
    case 'logro':
      [DO5, MI5, SOL5].forEach((f, i) => nota(ctx, salida, f, t + i * 0.08, 0.2));
      break;
    case 'fanfarria':
      [DO5, MI5, SOL5].forEach((f, i) => nota(ctx, salida, f, t + i * 0.1, 0.18));
      nota(ctx, salida, DO6, t + 0.3, 0.45);
      nota(ctx, salida, SOL5, t + 0.3, 0.45, 'sine');
      break;
  }
}
