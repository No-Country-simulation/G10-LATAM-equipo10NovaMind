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
  | 'Tecnología e Informática'
  | 'Medicina y Salud'
  | 'Ingeniería y Construcción'
  | 'Finanzas y Contabilidad'
  | 'Administración y Negocios'
  | 'Marketing y Ventas'
  | 'Leyes y Legal'
  | 'Educación y Academia'
  | 'Ciencias e Investigación'
  | 'Industria y Operaciones'
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
  fuente?: FuenteCita;
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
  pagina?: number | null;
  texto_fuente: string;
  /** llm: citada por el modelo · extracto_automatico: oración real elegida por el normalizador */
  origen?: 'llm' | 'extracto_automatico';
  /** true solo si el modelo la citó y aparece literalmente en el documento */
  verificada?: boolean;
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
  origen?: 'llm' | 'llm_reparada' | 'plantilla';
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
  wpm?: number;
  /** Sustituciones del sistema, p. ej. "escena_2_plantilla" */
  degradaciones?: string[];
  manifiesto_url_oci?: string;
  video_url_oci?: string;
}

/**
 * Cita localizada por el backend en el documento (modo paralelo). `pagina` y
 * `verificada` se derivan de dónde aparece el texto, nunca de lo que declare el modelo.
 */
export interface FuenteCita {
  texto: string;
  pagina: number | null;
  verificada: boolean;
}

export interface QuizQuestion {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number; // 0-indexed
  justificacion_rag: string;
  cita_fuente: string;
  /** Una explicación por alternativa, en el mismo orden (modo paralelo) */
  explicaciones_opciones?: string[];
  fuente?: FuenteCita;
}

export interface ConceptoClave {
  id: string;
  texto: string;
  verificado: boolean;
  explicacion?: string;
  fuente?: FuenteCita;
}

export interface ResumenNinjaData {
  titulo: string;
  analogia_central: string;
  conceptos_clave: ConceptoClave[];
  /** Solo si el documento las aporta; el modo paralelo no las inventa */
  metricas_rapidas?: {
    riesgo: string;
    despliegue: string;
    tipo_oci: string;
    costo: string;
  };
}

export interface ResumenEjecutivo {
  texto: string;
  por_secciones: { seccion: string; resumen: string; fuente: FuenteCita }[];
  conclusiones: string[];
}

export interface TerminoGlosario {
  termino: string;
  definicion: string;
  fuente: FuenteCita;
}

export interface Diapositiva {
  orden: number;
  titulo: string;
  puntos_clave: string[];
  concepto_visual: string;
  fuente: FuenteCita;
}

/** Recursos publicados por separado en modo paralelo (claves de estado_recursos). */
export type RecursoId =
  | 'resumen'
  | 'flashcards'
  | 'cuestionario'
  | 'glosario'
  | 'objetivos'
  | 'guion'
  | 'diapositivas'
  | 'tutorial'
  | 'diagrama';

export interface EstadoRecurso {
  recurso: RecursoId;
  tarea: string;
  estado: 'completado' | 'fallido';
  /** pendiente: pasó las comprobaciones deterministas y espera la auditoría */
  verificacion: 'pendiente' | 'auditada' | 'no_auditada';
  modelo?: string | null;
  intentos: number;
  latencia_s: number;
  citas_totales: number;
  citas_verificadas: number;
  avisos: string[];
  error_codigo?: string | null;
  /** Tomado de una generación idéntica anterior */
  reutilizado?: boolean;
}

export interface AdaptedContentPackage {
  persistencia?: { proveedor: string; package_id: string };
  status: 'exito' | 'exito_con_advertencias' | 'error';
  advertencias?: string[];
  orquestacion?: { documento_id?: string | null; duracion_segundos?: number };
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
    // null/ausente si el recurso falló o aún no llegó (modo paralelo): nunca hay relleno inventado
    resumen_ninja?: ResumenNinjaData | null;
    flashcards?: FlashcardItem[] | null;
    tutorial?: TutorialStep[] | null;
    director_cut?: DirectorScene[] | null;
    quiz?: QuizQuestion[] | null;
    diagrama_mermaid?: string | null;
    video_job_spec?: VideoJobSpec | null;
    resumen_ejecutivo?: ResumenEjecutivo | null;
    glosario?: TerminoGlosario[] | null;
    objetivos_aprendizaje?: string[] | null;
    diapositivas?: Diapositiva[] | null;
    estado_recursos?: Partial<Record<RecursoId, EstadoRecurso>> | null;
  };
  evaluacion_calidad: {
    /** null cuando la auditoría no se ejecutó */
    anclaje_fuente_score: number | null;
    auditoria_ejecutada?: boolean;
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

export interface RealDocumentPreset {
  id: string;
  nombre_archivo: string;
  titulo: string;
  nicho: IndustryNiche;
  perfil: RecipientProfile;
  formato_sugerido: OutputFormat;
  tipo: 'markdown' | 'pdf';
  tamano_formato: string;
  descripcion: string;
  tamano_bytes?: number;
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
