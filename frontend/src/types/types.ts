export type RecipientProfile = 
  | 'Principiante'
  | 'Desarrollador Junior'
  | 'Líder Técnico / Arquitecto'
  | 'Gestor / Ejecutivo (No Técnico)';

export type OutputFormat = 
  | 'Paquete Educativo Completo (5 Estaciones)'
  | 'Flashcards'
  | 'Tutorial'
  | 'Quiz Interactivo'
  | 'Resumen Ejecutivo (TL;DR)'
  | 'Guion de Clase / Video';

export type IndustryNiche = 
  | 'General'
  | 'Fintech'
  | 'Salud'
  | 'E-commerce';

export type DetailLevel = 
  | 'Didáctico'
  | 'Técnico Profundo';

export interface FlashcardItem {
  id: string;
  frente: string;
  dorso: string;
  pista_didactica: string;
  dominado?: boolean;
}

export interface TutorialStep {
  id: string;
  paso: number;
  titulo: string;
  descripcion: string;
  cli_command: string;
  completado: boolean;
  verificacion: string;
}

export interface FuenteRAG {
  chunk_id: string;
  pagina?: number;
  texto_fuente: string;
}

export interface EspecificacionVisual {
  tipo: 'diagrama_bloques' | 'ppt_concepto' | 'palabras_clave' | 'comparativa';
  titulo: string;
  puntos_clave?: string[];
  codigo_o_estructura?: string;
  prompt_grafico?: string;
}

export interface DirectorScene {
  id: string;
  escena: number;
  tiempo: string;
  duracion_segundos?: number;
  titulo: string;
  guion_locutor: string;
  estimacion_palabras?: number;
  storyboard_visual: string;
  consejo_pedagogico: string;
  objetivo_pedagogico?: string;
  visual?: EspecificacionVisual;
  fuentes?: FuenteRAG[];
}

export interface VideoJobSpec {
  video_job_id: string;
  document_id: string;
  target_duration: number;
  max_duration: number;
  aspect_ratio: '9:16' | '16:9';
  idioma: string;
  estado:
    | 'queued'
    | 'retrieving_context'
    | 'planning'
    | 'contract_ready'
    | 'rendering'
    | 'completed'
    | 'failed';
  escenas: DirectorScene[];
  total_palabras: number;
  duracion_total_estimada: number;
  manifiesto_url_oci?: string;
  video_url_oci?: string;
}

export interface QuizQuestion {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number; // 0-indexed
  justificacion_rag: string;
  cita_fuente: string;
}

export interface ResumenNinjaData {
  titulo: string;
  analogia_central: string;
  conceptos_clave: { id: string; texto: string; verificado: boolean }[];
  metricas_rapidas: {
    riesgo: string;
    despliegue: string;
    tipo_oci: string;
    costo: string;
  };
}

export interface AdaptedContentPackage {
  status: 'exito' | 'error';
  metadatos: {
    perfil_aplicado: RecipientProfile;
    formato_generado: OutputFormat;
    tiempo_estimado_estudio_minutos: number;
    conceptos_clave: string[];
    fecha_generacion: string;
    modelo_llm: string;
  };
  contenido_adaptado: {
    titulo: string;
    introduccion_contextualizada: string;
    resumen_ninja: ResumenNinjaData;
    flashcards: FlashcardItem[];
    tutorial: TutorialStep[];
    director_cut: DirectorScene[];
    quiz: QuizQuestion[];
  };
  evaluacion_calidad: {
    anclaje_fuente_score: number; // e.g. 0.98
    claridad_pedagogica: 'Alta' | 'Media' | 'Sobresaliente';
    observaciones: string;
    mitigacion_alucinaciones: string;
    chunks_procesados: number;
    similitud_coseno_promedio: number;
  };
  almacenamiento_oci: {
    bucket: string;
    objeto_id: string;
    status_upload: 'completado' | 'pendiente' | 'error';
    region: string;
    etag: string;
    tamano_bytes: number;
    url_always_free: string;
  };
}

export interface TechnicalScenario {
  id: string;
  titulo: string;
  nicho: IndustryNiche;
  perfilRecomendado: RecipientProfile;
  contenido: string;
  data: AdaptedContentPackage;
}

export interface Achievement {
  id: string;
  titulo: string;
  descripcion: string;
  icono: string;
  desbloqueado: boolean;
  fecha?: string;
  categoria: 'ninja' | 'streak' | 'builder' | 'director' | 'master';
}