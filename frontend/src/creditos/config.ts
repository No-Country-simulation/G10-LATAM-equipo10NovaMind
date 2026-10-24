/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Configuración de tiempo y resolución para el vídeo de créditos de NuevaMente
 * Edición cinematográfica sincronizada (22.0s / 660 fotogramas a 30 fps)
 * Acto 1: Apertura 8-Bit / Boot Terminal (0 a 7s / 210f)
 * Acto 2: Créditos de Contribuidores en Igualdad de Importancia (7 a 15s / 240f)
 * Acto 3: Código QR de la plataforma y Agradecimiento a OCI y ALURA LATAM (15 a 22s / 210f)
 */

export const CREDITOS_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  escena01Frames: 210, // 7.0s (Escena 01: Apertura 8-Bit & Boot Terminal)
  pilotoFrames: 210,
  escena02Frames: 240, // 8.0s (Escena 02: Créditos Contribuidores en Igualdad)
  escena03Frames: 210, // 7.0s (Escena 03: Código QR & Agradecimiento OCI y ALURA LATAM)
  escena04Frames: 0,
  escena05Frames: 240, // Alias para compatibilidad
  escena06Frames: 210, // Alias para compatibilidad
  faseActualFrames: 660, // 22.0 segundos totales (660 fotogramas a 30 fps)
  totalFrames: 660, // 22.0 segundos objetivo total
} as const;

export const ESCENA_01_TIMING = {
  crtPowerOnFrames: 14,
  terminalStartFrame: 8,
  barraCargaStartFrame: 20,
  barraCargaEndFrame: 140,
  isotipoSweepStartFrame: 16,
  isotipoSweepEndFrame: 90,
  glitchStartFrame: 185,
  totalSceneFrames: 210,
} as const;

export const ESCENA_02_TIMING = {
  fadeInFrames: 20,
  cardStaggerFrames: 4,
  totalSceneFrames: 240,
} as const;

export const ESCENA_03_TIMING = {
  fadeInFrames: 20,
  qrRevealFrame: 30,
  audioFadeOutFrames: 45,
  totalSceneFrames: 210,
} as const;

/**
 * Contribuidores Oficiales del Equipo 10 en IGUALDAD de importancia
 * Todos los miembros tienen el mismo peso y reconocimiento en el proyecto.
 */
export const CONTRIBUIDORES_EQUIPO = [
  {
    nombre: 'Silvia',
    rol: 'Facilitación & Project Management',
    detalle: 'Gestión ágil, requerimientos pedagógicos y gobernanza del proyecto',
    color: '#38bdf8', // Cyan
  },
  {
    nombre: 'Gabriel',
    rol: 'Líder Técnico Backend & Arquitectura',
    detalle: 'Pipeline multiagente RAG, verificación de citas y cliente OCI',
    color: '#a78bfa', // Violeta
  },
  {
    nombre: 'Carina',
    rol: 'Líder Técnica Frontend & UI/UX',
    detalle: 'Experiencia inmersiva en React 19, navegación de estaciones y diseño visual',
    color: '#ec4899', // Rosa
  },
  {
    nombre: 'Emanuel',
    rol: 'Backend & Cloud Integration',
    detalle: 'Contratos Pydantic v2, ChromaDB vectorial, API REST y endpoints',
    color: '#34d399', // Esmeralda
  },
  {
    nombre: 'Pedro',
    rol: 'Backend & Cloud Integration',
    detalle: 'Servicios de ingestión, validación de datos y persistencia',
    color: '#fbbf24', // Ámbar
  },
  {
    nombre: 'Tomás',
    rol: 'Backend & Cloud Integration',
    detalle: 'Orquestación de microservicios y pruebas de robustez backend',
    color: '#60a5fa', // Azul
  },
  {
    nombre: 'Harumi',
    rol: 'Frontend, QA & Diseño de Producto',
    detalle: 'Aseguramiento de calidad, accesibilidad y diseño de interfaces reactivas',
    color: '#f472b6', // Fucsia
  },
  {
    nombre: 'Wilson',
    rol: 'Colaboración Técnica & QA',
    detalle: 'Validación de contratos, pruebas de integración y soporte de despliegue',
    color: '#2dd4bf', // Teal
  },
  {
    nombre: 'Alex',
    rol: 'Colaboración Técnica & Documentación',
    detalle: 'Documentación técnica de arquitectura, flujos y especificaciones',
    color: '#c084fc', // Púrpura
  },
] as const;

/**
 * Estructura para compatibilidad con código existente y tests unitarios
 */
export const CREDITOS_EQUIPO_DATOS = {
  proyecto: 'NuevaMente',
  equipo: 'Equipo 10 (G10 - NuevaMente)',
  evento: 'Hackathon ONE G10 · Oracle Next Education & Alura Latam',
  entidad: 'No-Country Simulation',
  contribuidores: CONTRIBUIDORES_EQUIPO,
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
