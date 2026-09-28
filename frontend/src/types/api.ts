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
}

// Estructura de Quiz interactivo
export interface QuizOpcion {
  id: string;
  texto: string;
}

export interface QuizItem {
  pregunta: string;
  opciones: QuizOpcion[];
  respuesta_correcta: string;
  justificacion: string;
}

// Estructura para Guías / Tutoriales / Resúmenes
export interface SeccionLectura {
  subtitulo: string;
  desarrollo: string;
}

// Contenido adaptado devuelto por la IA
export interface ContenidoAdaptado {
  titulo: string;
  introduccion_contextualizada?: string;
  items?: (FlashcardItem | QuizItem)[];
  secciones?: SeccionLectura[];
}

// Metadatos pedagógicos
export interface Metadatos {
  perfil_aplicado: string;
  formato_generado: string;
  tiempo_estimado_estudio_minutos: number;
  conceptos_clave: string[];
}

// Evaluación de fidelidad RAG
export interface EvaluacionCalidad {
  anclaje_fuente_score: number;
  claridad_pedagogica: string;
  observaciones: string;
}

// Registro en OCI Object Storage Always Free
export interface AlmacenamientoOCI {
  bucket: string;
  objeto_id: string;
  status_upload: string;
}

// Respuesta global del backend
export interface RespuestaAdaptacion {
  status: 'exito' | 'exito_con_advertencias' | 'error';
  metadatos: Metadatos;
  contenido_adaptado: ContenidoAdaptado;
  evaluacion_calidad: EvaluacionCalidad;
  almacenamiento_oci: AlmacenamientoOCI;
}
