// Opciones canónicas para selects (GET /api/v1/config/opciones)
export interface ConfigOpciones {
  perfiles_destinatario: string[];
  formatos_salida: string[];
  nichos_sector: string[];
  niveles_detalle: string[];
}

// Payload del formulario (POST /api/v1/adaptar - multipart/form-data)
export interface AdaptarPayload {
  archivo?: File | null;
  texto_directo?: string;
  titulo?: string;
  perfil_destinatario: string;
  formato_salida: string;
  nicho_sector?: string;
  nivel_detalle?: string;
  tema_consulta?: string;
}

// Estructura de Flashcards
export interface FlashcardItem {
  frente: string;
  dorso: string;
  pista_didactica?: string;
  concept?: string;
  body?: string;
}

// Estructura de Quiz interactivo
export interface QuizOpcion {
  id?: string;
  texto: string;
}

export interface QuizItem {
  pregunta: string;
  opciones: (string | QuizOpcion)[];
  respuesta_correcta: string;
  justificacion?: string;
  justificacion_pedagogica?: string;
}

// Estructura de Guía Práctica / Tutorial
export interface TutorialItem {
  numero_paso?: number;
  titulo?: string;
  title?: string;
  instruccion?: string;
  desc?: string;
  codigo_o_comando?: string;
  resultado_esperado?: string;
}

// Estructura de Resumen Ejecutivo (TL;DR)
export interface SummaryItem {
  punto?: string;
  por_que_importa?: string;
  encabezado?: string;
  puntos_clave?: string[];
  aplicacion_practica?: string;
  subtitulo?: string;
  desarrollo?: string;
}

// Estructura de Guion de Clase / Video
export interface ScriptItem {
  minuto_aproximado?: number | string;
  tiempo_estimado?: string;
  time?: string;
  titulo?: string;
  title?: string;
  narracion?: string;
  que_se_dice?: string;
  apoyo_visual_sugerido?: string;
  que_se_ve?: string;
  visual?: string;
}

export type AnyContenidoItem =
  | FlashcardItem
  | QuizItem
  | TutorialItem
  | SummaryItem
  | ScriptItem
  | Record<string, any>;

// Estructura para Guías / Tutoriales / Resúmenes
export interface SeccionLectura {
  subtitulo: string;
  desarrollo: string;
}

// Contenido adaptado devuelto por la IA
export interface ContenidoAdaptado {
  titulo: string;
  introduccion_contextualizada?: string;
  items?: AnyContenidoItem[];
  secciones?: SeccionLectura[];
}

// Metadatos pedagógicos
export interface Metadatos {
  perfil_aplicado: string;
  formato_generado: string;
  nicho_aplicado?: string;
  tiempo_estimado_estudio_minutos: number;
  conceptos_clave: string[];
  prerrequisitos?: string[];
}

// Evaluación de fidelidad RAG
export interface EvaluacionCalidad {
  anclaje_fuente_score: number;
  claridad_pedagogica: string;
  observaciones: string;
  sugerencias_correccion?: string[];
}

// Registro en OCI Object Storage Always Free
export interface AlmacenamientoOCI {
  bucket?: string;
  objeto_id?: string;
  status_upload: string;
}

// Métricas de orquestación LangGraph
export interface MetricasOrquestacion {
  intentos_redaccion?: number;
  scores_por_intento?: number[];
  umbral_anclaje?: number;
  max_reintentos?: number;
  duracion_segundos?: number;
  documento_id?: string;
  chunks_recuperados?: number;
}

// Error amigable del flujo
export interface ErrorFlujo {
  codigo: string;
  etapa: string;
  mensaje_amigable: string;
  detalle_tecnico?: string;
}

// Respuesta global del backend
export interface RespuestaAdaptacion {
  status: 'exito' | 'exito_con_advertencias' | 'error';
  metadatos?: Metadatos;
  contenido_adaptado?: ContenidoAdaptado;
  evaluacion_calidad?: EvaluacionCalidad;
  almacenamiento_oci?: AlmacenamientoOCI;
  orquestacion?: MetricasOrquestacion;
  advertencias?: string[];
  error?: ErrorFlujo;
}

