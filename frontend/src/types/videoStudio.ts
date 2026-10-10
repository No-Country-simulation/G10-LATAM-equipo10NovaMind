export type VisualAnimationType =
  | 'diagrama_red'
  | 'flujo_servidores'
  | 'ataque_ddos'
  | 'pasos_secuenciales'
  | 'comparacion_visual'
  | 'arquitectura_cloud'
  | 'base_datos_segura'
  | 'codigo_terminal'
  | 'radar_metricas'
  | 'concepto_general';

export type VisualStyle = 'tecnologico' | 'minimalista' | 'ilustrativo';

export type RitmoPedagogico = 'dinamico' | 'natural' | 'reflexivo';

export interface GraphicNodeItem {
  id: string;
  label: string;
  sublabel?: string;
  type?: 'server' | 'gateway' | 'database' | 'client' | 'firewall' | 'cloud' | 'terminal';
  status?: 'active' | 'warning' | 'success' | 'blocked' | 'highlight';
  value?: string;
}

export interface GraphicConnection {
  from: string;
  to: string;
  label?: string;
  animated?: boolean;
  color?: string;
}

export interface AudiovisualScene {
  id: string;
  orden: number;
  titulo: string;
  duracionEstimada: number; // en segundos, calculada estrictamente según contenido y palabras
  conteoPalabras: number;
  duracionReal?: number; // ajustada con audio en vivo si está disponible
  narracion: string; // texto para voz en off
  imagenUrl?: string; // URL de la ilustración generada (estilo caricatura / NotebookLM)
  promptIlustracion?: string;
  textoEnPantalla: {
    titular: string;
    subtitular?: string;
    conceptoNombre?: string;
    definicionConcepto?: string;
    puntosClave: string[];
    etiquetaBadge?: string;
  };
  conceptoPedagogico: string;
  descripcionComposicion: string;
  tipoAnimacion: VisualAnimationType;
  referenciasOrigen?: string;
  elementosGraficos: {
    nodos: GraphicNodeItem[];
    conexiones: GraphicConnection[];
    metricaDestacada?: {
      valor: string;
      etiqueta: string;
      tendencia?: 'up' | 'down' | 'neutral';
    };
    snippetCodigo?: {
      comando: string;
      salida?: string;
      lenguaje?: string;
    };
  };
}

export interface AudiovisualStoryboard {
  id: string;
  titulo: string;
  resumenNarrativo: string;
  perfilAudiencia: string;
  nicho: string;
  duracionTotalEstimada: number; // suma real de duraciones de contenido
  totalPalabrasNarracion: number;
  ritmoAplicado: RitmoPedagogico;
  estiloVisual: VisualStyle;
  escenas: AudiovisualScene[];
  fechaCreacion: string;
  metadatosOCI?: {
    bucket: string;
    objetoId: string;
    etag?: string;
  };
}

export interface VideoStudioConfig {
  escenasSeleccionadasIds: string[];
  ritmoPedagogico: RitmoPedagogico; // 'dinamico' (~175 wpm), 'natural' (~145 wpm), 'reflexivo' (~115 wpm)
  idioma: 'es-LATAM' | 'es-ES' | 'en-US';
  vozSeleccionadaUri: string;
  estiloVisual: VisualStyle;
  incluirSubtitulos: boolean;
  velocidadLocucion: number; // 0.8 a 1.2
  efectosSonido: boolean;
}

export interface TTSVoiceOption {
  id: string;
  name: string;
  lang: string;
  gender: 'female' | 'male' | 'neutral';
  isLocal: boolean;
  provider: 'webspeech' | 'piper' | 'custom';
}

export interface VideoExportProgress {
  estado: 'idle' | 'preparando' | 'grabando' | 'renderizando' | 'completado' | 'error';
  porcentaje: number;
  mensaje: string;
  archivoUrl?: string;
  nombreArchivo?: string;
  tamanoBytes?: number;
  error?: string;
}
