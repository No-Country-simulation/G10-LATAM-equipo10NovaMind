/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Configuración de tiempo y resolución para el vídeo de créditos de NuevaMente
 */

export const CREDITOS_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  escena01Frames: 90, // 3.0s (Escena 01: Apertura 8-Bit)
  pilotoFrames: 90, // Alias para compatibilidad con la suite de pruebas del piloto
  escena02Frames: 150, // 5.0s (Escena 02: Transformación a Núcleo Holográfico)
  escena03Frames: 300, // 10.0s (Escena 03: Red de Agentes Pedagógicos)
  escena04Frames: 300, // 10.0s (Escena 04: Arquitectura de Nube OCI & Stack)
  escena05Frames: 330, // 11.0s (Escena 05: Créditos del Equipo 10)
  escena06Frames: 180, // 6.0s (Escena 06: Clímax Audiovisual & Agradecimiento Institucional)
  faseActualFrames: 1350, // 45 segundos completos (1350 fotogramas a 30 fps)
  totalFrames: 1350, // 45 segundos objetivo total
} as const;

export const ESCENA_01_TIMING = {
  crtPowerOnFrames: 14,
  terminalStartFrame: 8,
  barraCargaStartFrame: 20,
  barraCargaEndFrame: 72,
  isotipoSweepStartFrame: 16,
  isotipoSweepEndFrame: 54,
  glitchStartFrame: 75,
  totalSceneFrames: 90,
} as const;

export const ESCENA_02_TIMING = {
  desprendimientoStartFrame: 0,
  desprendimientoPeakFrame: 35,
  anillosHudStartFrame: 15,
  convergenciaStartFrame: 35,
  convergenciaEndFrame: 75,
  hologramaRevealStartFrame: 35,
  estabilizacionStartFrame: 110,
  totalSceneFrames: 150,
} as const;

export const ESCENA_03_TIMING = {
  fadeCoreFrames: 30,
  nodeRevealInterval: 35,
  networkSyncPulseFrame: 210,
  totalSceneFrames: 300,
} as const;

export const ESCENA_04_TIMING = {
  layerRevealInterval: 45,
  dataFlowPulseFrame: 180,
  totalSceneFrames: 300,
} as const;

export const ESCENA_05_TIMING = {
  fase1EndFrame: 165,
  fase2StartFrame: 160,
  totalSceneFrames: 330,
} as const;

export const ESCENA_06_TIMING = {
  ringsCollapseStartFrame: 20,
  heroBloomPeakFrame: 70,
  institutionalFadeFrame: 110,
  finalAudioFadeFrame: 140,
  totalSceneFrames: 180,
} as const;

/**
 * Datos oficiales y verificados de los miembros del Equipo 10 (G10 - NuevaMente)
 * Extraídos directamente de las actas de reunión y compromisos del Hackathon ONE G10.
 */
export const CREDITOS_EQUIPO_DATOS = {
  proyecto: 'NuevaMente',
  equipo: 'Equipo 10 (G10 - NuevaMente)',
  evento: 'Hackathon ONE G10 · Oracle Next Education & Alura Latam',
  entidad: 'No-Country Simulation',
  liderazgo: [
    {
      rol: 'Facilitación & Project Management',
      nombre: 'Silvia',
      detalle: 'Gestión ágil, requerimientos pedagógicos y alineación de entregables',
    },
    {
      rol: 'Líder Técnico Backend & Arquitectura',
      nombre: 'Gabriel',
      detalle: 'Pipeline multiagente, verificación de citas y cliente OCI Object Storage',
    },
    {
      rol: 'Líder Técnica Frontend & UI/UX',
      nombre: 'Carina',
      detalle: 'Experiencia interactiva, 5 estaciones y diseño del sistema visual',
    },
  ],
  desarrollo: [
    {
      rol: 'Backend & Cloud Integration',
      miembros: ['Emanuel', 'Pedro', 'Tomás'],
      detalle: 'Contratos Pydantic v2, ChromaDB vectorial, API REST y orquestación',
    },
    {
      rol: 'Frontend, QA & Diseño de Producto',
      miembros: ['Harumi'],
      detalle: 'Control de calidad, accesibilidad y diseño de interfaces reactivas',
    },
    {
      rol: 'Colaboración Técnica & Documentación',
      miembros: ['Wilson', 'Alex'],
      detalle: 'Validación de contratos y documentación técnica de arquitectura',
    },
  ],
};

