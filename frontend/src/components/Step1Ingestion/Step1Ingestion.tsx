import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  UploadCloud, Sparkles, Database, CheckCircle2, Zap, Cpu, ArrowRight, Eye, Lock, ScanText, PenLine, AlertTriangle, Loader2,
  Dices, SlidersHorizontal, FileText, X, ChevronRight,
} from 'lucide-react';
import type {
  RecipientProfile, OutputFormat, IndustryNiche, DetailLevel, RealDocumentPreset, OrigenContenido, MuestraPregenerada,
} from '../../types/types';
import { REAL_DOCUMENTS_CATALOG } from '../../data/mockScenarios';
import { extraerDocumento, textoDocumentoEjemplo } from '../../services/api';
import { HeroAnimacion } from './HeroAnimacion';
import { MiniAnimacionRecursos } from './MiniAnimacionRecursos';
import styles from './Step1Ingestion.module.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ARCHIVOS_ACEPTADOS = '.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp';
const esImagen = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name);
const esPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
// Tarjeta del archivo elegido: etiqueta de tipo y tamaño legible
const tipoArchivo = (nombre: string): 'PDF' | 'MD' | 'TXT' | 'IMG' => {
  if (/\.pdf$/i.test(nombre)) return 'PDF';
  if (/\.(md|markdown)$/i.test(nombre)) return 'MD';
  if (/\.(png|jpe?g|webp)$/i.test(nombre)) return 'IMG';
  return 'TXT';
};
const tamanoLegible = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
// Opciones de adaptación: las usan los selectores (modo Personalizado) y el sorteo (Sorpréndeme)
const PERFILES: ReadonlyArray<[RecipientProfile, string]> = [
  ['Principiante', 'Principiante / Transición'],
  ['Desarrollador Junior', 'Desarrollador Junior / Semi Senior'],
  ['Líder Técnico / Arquitecto', 'Líder Técnico / Arquitecto'],
  ['Gestor / Ejecutivo (No Técnico)', 'Gestor / Ejecutivo (No Técnico)'],
];
const NICHOS: ReadonlyArray<[IndustryNiche, string]> = [
  ['Tecnología e Informática', 'Tecnología e Informática'],
  ['Medicina y Salud', 'Medicina y Salud'],
  ['Ingeniería y Construcción', 'Ingeniería y Construcción'],
  ['Finanzas y Contabilidad', 'Finanzas y Contabilidad'],
  ['Administración y Negocios', 'Administración y Negocios'],
  ['Marketing y Ventas', 'Marketing y Ventas'],
  ['Leyes y Legal', 'Leyes y Legal'],
  ['Educación y Academia', 'Educación y Academia'],
  ['Ciencias e Investigación', 'Ciencias e Investigación'],
  ['Industria y Operaciones', 'Industria y Operaciones'],
  ['General', 'General (Multisectorial)'],
];
const NIVELES: ReadonlyArray<[DetailLevel, string]> = [
  ['Didáctico', 'Didáctico (Metáforas y Analogías)'],
  ['Técnico Profundo', 'Técnico Profundo (Sintaxis y Flags)'],
];
// Resumen, en forma de prompt de rol, de las instrucciones que de verdad recibe Gemini: el backend
// le describe al estudiante (DIRECTIVAS_PERFIL_DESTINATARIO, DIRECTIVAS_NICHO_SECTOR y
// DIRECTIVAS_NIVEL_DETALLE en schemas.py). Si cambia una directiva, hay que actualizar su frase aquí.
const PROMPT_PERFIL: Record<RecipientProfile, [string, string]> = {
  'Principiante': ['un principiante',
    'Explícale desde cero con lenguaje sencillo, define cada término técnico y apóyate en situaciones cotidianas.'],
  'Desarrollador Junior': ['un desarrollador junior',
    'Usa lenguaje técnico y explica cómo funciona cada componente, con sus buenas prácticas y errores frecuentes.'],
  'Líder Técnico / Arquitecto': ['un líder técnico o arquitecto',
    'Céntrate en la arquitectura, las decisiones, los riesgos y los compromisos técnicos.'],
  'Gestor / Ejecutivo (No Técnico)': ['un gestor o ejecutivo no técnico',
    'Háblale en lenguaje de negocio: impacto, beneficios, riesgos y decisiones, sin detalle técnico innecesario.'],
};
const PROMPT_NIVEL: Record<DetailLevel, [string, string]> = {
  'Didáctico': ['entender las ideas clave', 'Usa analogías y avanza un paso cada vez.'],
  'Técnico Profundo': ['profundizar en los detalles',
    'Entra en la arquitectura y la configuración, y reproduce los comandos tal como aparecen en el documento.'],
};
const promptPaquete = (perfil: RecipientProfile, nicho: IndustryNiche, nivel: DetailLevel) => {
  const [quien, enfoque] = PROMPT_PERFIL[perfil];
  const [meta, profundidad] = PROMPT_NIVEL[nivel];
  const sector = nicho === 'General' ? '' : ` del sector ${nicho}`;
  return `Eres un tutor experto. Tu estudiante es ${quien}${sector} y quiere ${meta}. ${enfoque} `
    + (nicho === 'General' ? '' : 'Usa ejemplos de su sector solo cuando ayuden a entender. ')
    + `${profundidad} Con este documento, genera 5 estaciones: resumen, flashcards, tutorial con diagrama, `
    + 'video narrado de hasta 60 s y quiz. Usa solo lo que dice el documento y respalda cada afirmación con una cita.';
};
const etiqueta = <T,>(opciones: ReadonlyArray<[T, string]>, valor: T) =>
  opciones.find(([v]) => v === valor)?.[1] ?? String(valor);
const alAzar = <T,>(opciones: ReadonlyArray<[T, string]>): T =>
  opciones[Math.floor(Math.random() * opciones.length)][0];

// `accept` solo filtra el diálogo de archivos: lo que se arrastra hay que comprobarlo a mano
const esAceptado = (f: File) => ARCHIVOS_ACEPTADOS.split(',').some((ext) => f.name.toLowerCase().endsWith(ext));

/** bloquea=false: solo falta la vista previa; el archivo ya se puede enviar */
type Extraccion = { estado: 'inactiva' } | { estado: 'cargando' | 'error'; mensaje: string; bloquea?: boolean };

interface Step1Props {
  onStartPipeline: (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    rawFile?: File | null,
    origenContenido?: OrigenContenido
  ) => void;
  /** Documentos de ejemplo con paquete y video pregenerados, por id del catálogo */
  muestras: Record<string, MuestraPregenerada>;
  onAbrirMuestra: (documento: string) => void;
  /** Sin sesión (o como invitado) solo se abren las muestras de la biblioteca, con sus ajustes fijos */
  sesionIniciada: boolean;
  onIniciarSesion: () => void;
  isProcessing: boolean;
  processingStage: string;
}

type DocumentoCargado = { archivo: File; texto: string };

/** La carga en curso es la de una muestra (sus etapas lo dicen): no hay modelos trabajando. */
const esEtapaDeMuestra = (etapa: string) => /^(Muestra|Abriendo la muestra)/.test(etapa);

export const Step1Ingestion = ({
  onStartPipeline,
  muestras,
  onAbrirMuestra,
  sesionIniciada,
  onIniciarSesion,
  isProcessing,
  processingStage,
}: Step1Props) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  // Se empieza en Personalizado (decisión del usuario, 16/10) con valores de partida fijos;
  // Sorpréndeme sortea al elegirlo
  const [profile, setProfile] = useState<RecipientProfile>('Principiante');
  const [format, setFormat] = useState<OutputFormat>('Paquete Educativo Completo (5 Estaciones)');
  const [niche, setNiche] = useState<IndustryNiche>('General');
  const [detail, setDetail] = useState<DetailLevel>('Didáctico');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  // rawFile queda vacío mientras se extrae o si el texto es una transcripción: el tamaño se guarda aparte
  const [bytesArchivo, setBytesArchivo] = useState<number | null>(null);
  // transcripcion_ia: el texto lo transcribió Gemini de una imagen o un PDF escaneado y es editable
  const [origen, setOrigen] = useState<OrigenContenido>('documento');
  const [extraccion, setExtraccion] = useState<Extraccion>({ estado: 'inactiva' });
  const [avisosFuente, setAvisosFuente] = useState<string[]>([]);
  const turnoSubida = useRef(0); // descarta respuestas de una subida anterior
  const [arrastrando, setArrastrando] = useState<boolean>(false);
  // Sin documento todavía, la zona de carga se destaca como el punto de partida
  const sinDocumento = !fileName && !docContent && !isLoadingPreset;
  const documentoElegido = REAL_DOCUMENTS_CATALOG.find((d) => d.id === selectedDocId);
  const [modo, setModo] = useState<'personalizado' | 'sorpresa'>('personalizado');

  // Sorteo visible: lo que se muestra es exactamente lo que se envía. Nunca repite la combinación actual.
  const sortear = () => {
    let p = profile, n = niche, d = detail;
    for (let i = 0; i < 10 && p === profile && n === niche && d === detail; i++) {
      p = alAzar(PERFILES);
      n = alAzar(NICHOS);
      d = alAzar(NIVELES);
    }
    setProfile(p);
    setNiche(n);
    setDetail(d);
  };

  const elegirModo = (nuevo: 'personalizado' | 'sorpresa') => {
    if (nuevo === 'sorpresa' && modo !== 'sorpresa') sortear();
    setModo(nuevo);
  };
  const esTranscripcion = origen === 'transcripcion_ia';
  const extrayendo = extraccion.estado === 'cargando' && extraccion.bloquea !== false;

  const reiniciarFuente = () => {
    turnoSubida.current += 1;
    setOrigen('documento');
    setExtraccion({ estado: 'inactiva' });
    setAvisosFuente([]);
  };

  /** Carga un documento de la biblioteca; devuelve el archivo y su texto, o null si falló o se reemplazó */
  const handleSelectRealDocument = async (doc: RealDocumentPreset): Promise<DocumentoCargado | null> => {
    reiniciarFuente();
    const turno = turnoSubida.current;
    setSelectedDocId(doc.id);
    setIsLoadingPreset(true);
    setDocTitle(doc.titulo);
    // El invitado usa los ajustes fijos del documento; en Sorpréndeme se respeta el sorteo que se ve
    if (modo === 'personalizado' || !sesionIniciada) {
      setNiche(doc.nicho);
      setProfile(doc.perfil);
      setDetail(doc.detalle);
    }
    setFormat(doc.formato_sugerido);
    setFileName(doc.nombre_archivo);
    setRawFile(null);
    setBytesArchivo(null);
    setDocContent('');
    setExtraccion({ estado: 'cargando', mensaje: 'Cargando el documento…' });

    try {
      const res = await fetch(`${BASE_URL}/api/v1/documentos/ejemplos/${encodeURIComponent(doc.nombre_archivo)}`);
      if (!res.ok) throw new Error(`No se pudo descargar «${doc.titulo}» (HTTP ${res.status}).`);
      const blob = await res.blob();
      const mimeType = doc.tipo === 'pdf' ? 'application/pdf' : 'text/markdown';
      if (turno !== turnoSubida.current) return null;
      const archivo = new File([blob], doc.nombre_archivo, { type: mimeType });
      setRawFile(archivo);
      setBytesArchivo(blob.size);
      if (doc.tipo === 'markdown') {
        const texto = await blob.text();
        setDocContent(texto);
        setExtraccion({ estado: 'inactiva' });
        return { archivo, texto };
      }
      // El PDF ya se puede enviar; su texto (el ENISA tarda ~15 s la primera vez) solo es vista previa
      setExtraccion({ estado: 'cargando', bloquea: false,
        mensaje: 'Extrayendo el texto para la vista previa… ya puedes generar.' });
      try {
        const { texto } = await textoDocumentoEjemplo(doc.nombre_archivo);
        if (turno !== turnoSubida.current) return null;
        setDocContent(texto);
        setExtraccion({ estado: 'inactiva' });
        return { archivo, texto };
      } catch (err) {
        if (turno !== turnoSubida.current) return null;
        setExtraccion({ estado: 'error', bloquea: false, mensaje:
          `No se pudo previsualizar el texto (${err instanceof Error ? err.message : String(err)}); el PDF se procesará igualmente.` });
        return { archivo, texto: '' };
      }
    } catch (err) {
      // Sin el documento no se genera nada: nunca a partir de la descripción del catálogo
      if (turno !== turnoSubida.current) return null;
      setFileName(null);
      setSelectedDocId(null);
      setExtraccion({ estado: 'error', mensaje: err instanceof Error ? err.message : String(err) });
      return null;
    } finally {
      setIsLoadingPreset(false);
    }
  };

  // La demo siempre termina en el recorrido (paso 2): con muestra, sin gastar cuota; sin muestra,
  // y solo con sesión, se genera con los ajustes fijos del documento.
  const demo = REAL_DOCUMENTS_CATALOG[0];
  const demoConMuestra = Boolean(muestras[demo.id]);
  const demoDisponible = demoConMuestra || sesionIniciada;
  const handleLoadDemoScenario = async () => {
    if (demoConMuestra) {
      onAbrirMuestra(demo.id);
      return;
    }
    if (!sesionIniciada) return;
    const cargado = await handleSelectRealDocument(demo);
    if (cargado) {
      onStartPipeline(demo.titulo, cargado.texto, demo.perfil, demo.formato_sugerido, demo.nicho, demo.detalle,
        demo.id, cargado.archivo, 'documento');
    }
  };
  const muestraElegida = selectedDocId ? muestras[selectedDocId] : undefined;

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (file) void procesarArchivo(file);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); // sin esto, el navegador abre el archivo en la pestaña en vez de soltarlo aquí
    if (!extrayendo) setArrastrando(true);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || extrayendo) return;
    if (!esAceptado(file)) {
      setExtraccion({ estado: 'error', mensaje: `«${file.name}» no es un formato admitido: usa ${ARCHIVOS_ACEPTADOS}.` });
      return;
    }
    void procesarArchivo(file);
  };

  const procesarArchivo = async (file: File) => {
    reiniciarFuente();
    const turno = turnoSubida.current;
    setSelectedDocId(null);
    setFileName(file.name);
    setBytesArchivo(file.size);
    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));

    if (!esImagen(file) && !esPdf(file)) {
      setRawFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text && turno === turnoSubida.current) setDocContent(text);
      };
      reader.readAsText(file);
      return;
    }

    // PDF e imágenes: se previsualiza el texto real que se va a procesar. Una imagen o un PDF
    // escaneado vuelven transcritos por IA y se generan desde esa transcripción revisada.
    setRawFile(null);
    setDocContent('');
    setExtraccion({
      estado: 'cargando',
      mensaje: esImagen(file) ? 'Transcribiendo la imagen con IA…' : 'Extrayendo el texto del PDF…',
    });
    try {
      const doc = await extraerDocumento(file);
      if (turno !== turnoSubida.current) return;
      setDocContent(doc.texto);
      setAvisosFuente(doc.advertencias);
      setExtraccion({ estado: 'inactiva' });
      if (doc.origen === 'transcripcion_ia') {
        setOrigen('transcripcion_ia');
      } else {
        setRawFile(file); // PDF con texto: se envía el archivo, con sus páginas y secciones exactas
      }
    } catch (err) {
      if (turno !== turnoSubida.current) return;
      setFileName(null);
      setExtraccion({ estado: 'error', mensaje: err instanceof Error ? err.message : String(err) });
    }
  };

  // Quita el documento elegido; si aún se estaba extrayendo, su respuesta se descarta por turno
  const quitarArchivo = () => {
    reiniciarFuente();
    setSelectedDocId(null);
    setFileName(null);
    setRawFile(null);
    setBytesArchivo(null);
    setDocContent('');
    setDocTitle('');
  };

  const handleTranscripcionEditada = (texto: string) => {
    if (esTranscripcion) setDocContent(texto);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (extrayendo) return;
    if (!sesionIniciada) {  // el invitado no genera: abre la muestra del documento elegido
      if (selectedDocId && muestras[selectedDocId]) onAbrirMuestra(selectedDocId);
      return;
    }
    if (!docContent.trim() && !rawFile) {
      alert('Por favor selecciona un documento de la biblioteca o sube un archivo antes de iniciar el pipeline.');
      return;
    }
    onStartPipeline(
      docTitle.trim() || 'Documento sin título',  // ya no hay campo para escribirlo
      docContent,
      profile,
      format,
      niche,
      detail,
      selectedDocId || undefined,
      esTranscripcion ? null : rawFile,
      origen
    );
  };

  return (
    <div className={styles.container}>
      {/* Top Hero / Context Banner */}
      <div className={styles.heroBanner}>
        <HeroAnimacion />
        <div className={styles.heroContent}>
          <div className={styles.tagRow}>
            <span className={styles.pipelineTag}>
              <Sparkles size={14} color="#fbbf24" />
              Pipeline RAG & Agentes Pedagógicos
            </span>
            <span className={styles.hackathonSign}>
              Oracle Next Education · Hackathon ONE G10 · NuevaMente
            </span>
          </div>

          <h2 className={styles.heroTitle}>
            Convierte documentos en rutas de aprendizaje
          </h2>

          {/* Sin «sin alucinaciones»: las citas se verifican contra el documento, pero no se
              promete lo que no se puede garantizar (regla 1, procedencia honesta) */}
          <p className={styles.heroText}>
            Resumen, tarjetas, diagrama, video y quiz a partir de tu documento, con citas comprobadas.
          </p>
        </div>
      </div>

      {/* Acción Rápida: Cargar Documento Propio vs Modo Demo Instantáneo */}
      <div className={styles.demoBannerCard}>
        <div className={styles.demoBannerRow}>
          <div className={styles.demoBannerText}>
            <div className={styles.demoBannerTitle}>
              <Zap size={22} color="#fbbf24" />
              ¿Quieres probar la plataforma en 1 solo clic?
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLoadDemoScenario()}
            className={styles.demoButton}
            disabled={isLoadingPreset || isProcessing || !demoDisponible}
            title={demoConMuestra
              ? 'Abre el recorrido ya generado de la Guía OCI Swap: no gasta cuota'
              : demoDisponible ? undefined : 'La muestra de la demo aún no está generada'}
          >
            <Zap size={16} />
            {isLoadingPreset
              ? '⏳ Descargando documento...'
              : demoConMuestra
                ? 'Prueba rápida 😊'
                : sesionIniciada
                  ? '⚡ Generar demo: Guía OCI Swap (gasta cuota)'
                  : 'Demo en preparación'}
          </button>
        </div>
      </div>

      {/* Biblioteca: para quien llega sin sesión es el punto de partida, y se dice en claro */}
      <div className={styles.scenariosSection}>
        <h2 className={styles.tituloRuta}>Aquí empieza tu ruta de aprendizaje</h2>
        <div className={styles.scenariosHeader}>
          <h3 className={`${styles.scenariosLabel} ${styles.scenariosLabelPaso}`}>
            <Database size={16} color="var(--color-violet-400)" />
            Elige un documento de ejemplo…
          </h3>
          <span className={styles.scenariosHelp}>
            {isLoadingPreset
              ? '⏳ Cargando el documento…'
              : sesionIniciada
                ? 'Documentos reales listos para probar, o sube el tuyo en el formulario de abajo'
                : 'Documentos reales con su paquete y su video ya generados'}
          </span>
        </div>

        {/* Qué va a pasar, en tres pasos: para quien entra por primera vez */}
        {!sesionIniciada && !selectedDocId && (
          <ol className={styles.guiaPasos}>
            <li><span className={styles.guiaNumero}>1</span> Elige un documento en la lista</li>
            <li><span className={styles.guiaNumero}>2</span> Pulsa «Iniciar Aprendizaje»</li>
            <li><span className={styles.guiaNumero}>3</span> Recorre 5 estaciones: resumen, tarjetas, tutorial, video narrado y quiz</li>
          </ol>
        )}

        <div className={`${styles.selectorBiblioteca} ${!sesionIniciada && !selectedDocId ? styles.selectorInvitacion : ''}`}>
          {!sesionIniciada && !selectedDocId && <span className={styles.pasoBadge}>Empieza aquí</span>}
        <select
          value={selectedDocId ?? ''}
          onChange={(e) => {
            const doc = REAL_DOCUMENTS_CATALOG.find((d) => d.id === e.target.value);
            if (doc) handleSelectRealDocument(doc);
          }}
          disabled={isLoadingPreset}
          className={styles.selectInput}
          aria-label="Documento de la biblioteca"
        >
          <option value="" disabled>
            👉 Haz clic aquí y elige un documento: Don Quijote, Apache Kafka, Guía OCI…
          </option>
          {REAL_DOCUMENTS_CATALOG.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.titulo} · {doc.tipo === 'pdf' ? 'PDF' : 'MD'} {doc.tamano_formato.split(' ').slice(0, 2).join(' ')}
            </option>
          ))}
        </select>
        </div>

        {documentoElegido && (
          <div className={`${styles.scenarioCard} ${styles.scenarioCardSelected}`}>
            <div className={styles.scenarioTopRow}>
              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                <span className={styles.nicheBadge}>{documentoElegido.nicho}</span>
                <span className={styles.formatTypeBadge}>
                  {documentoElegido.tipo === 'pdf' ? '📕 PDF' : '📄 MD'} · {documentoElegido.tamano_formato.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
              <CheckCircle2 size={16} color="var(--color-violet-400)" />
            </div>
            <div className={styles.scenarioSnippet}>{documentoElegido.descripcion}</div>
          </div>
        )}
      </div>

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className={styles.container}>
        {/* Alternativa al documento de ejemplo: mismo formato que «Elige un documento de ejemplo…» */}
        <h3 className={`${styles.scenariosLabel} ${styles.scenariosLabelPaso} ${styles.tituloCarga}`}>
          <UploadCloud size={16} color="var(--color-violet-400)" />
          o carga tu propio documento
        </h3>
        <div className={styles.formCard}>
          {/* File Dropzone & Document Title */}
          <div className={styles.inputGrid}>
            <div className={`${styles.fieldGroup} ${styles.fieldGroupAncho}`}>
              <label className={styles.fieldLabel}>
                Carga de Archivo (PDF, MD, TXT o imagen)
              </label>
              {!sesionIniciada ? (
                <div className={styles.cargaBloqueada}>
                  <Lock size={16} aria-hidden="true" />
                  <span>Para subir tu propio documento y elegir perfil, sector y nivel, inicia sesión. Sin sesión, usa los documentos de la biblioteca.</span>
                  <button type="button" onClick={onIniciarSesion} className={styles.botonSecundario}>
                    Iniciar sesión
                  </button>
                </div>
              ) : (
              <label
                className={[
                  styles.fileDropzone,
                  sinDocumento ? styles.fileDropzoneInvitacion : '',
                  arrastrando ? styles.fileDropzoneActiva : '',
                ].join(' ')}
                onDragOver={handleDragOver}
                onDragLeave={() => setArrastrando(false)}
                onDrop={handleDrop}
              >
                {sinDocumento && <span className={styles.pasoBadge}>Paso 1 · Empieza aquí</span>}
                <UploadCloud
                  size={sinDocumento ? 34 : 18}
                  color="var(--color-violet-400)"
                  className={sinDocumento && !arrastrando ? styles.iconoFlotante : undefined}
                />
                <span className={styles.fileText}>
                  {arrastrando
                    ? 'Suelta el archivo aquí'
                    : sinDocumento
                      ? 'Arrastra tu documento aquí o haz clic para elegirlo'
                      : 'Arrastra o haz clic para cambiar de documento'}
                </span>
                {sinDocumento && (
                  <span className={styles.fileHint}>
                    PDF, MD, TXT o imagen (.png, .jpg, .webp) · hasta 15 MB · o elige uno de la biblioteca de arriba
                  </span>
                )}
                <input
                  type="file"
                  accept={ARCHIVOS_ACEPTADOS}
                  onChange={handleFileUpload}
                  disabled={extrayendo}
                  style={{ display: 'none' }}
                />
              </label>
              )}
              {fileName && (() => {
                const tipo = tipoArchivo(fileName);
                return (
                  <div className={`${styles.fileCard} ${styles[`fileCard${tipo}`]}`}>
                    <FileText size={16} className={styles.fileCardIcon} aria-hidden />
                    <span className={styles.fileCardName} title={fileName}>{fileName}</span>
                    <span className={`${styles.fileTypeBadge} ${styles[`fileTypeBadge${tipo}`]}`}>{tipo}</span>
                    {bytesArchivo !== null && (
                      <span className={styles.fileCardMeta}>{tamanoLegible(bytesArchivo)}</span>
                    )}
                    <button
                      type="button"
                      className={styles.fileCardRemove}
                      onClick={quitarArchivo}
                      aria-label={`Quitar ${fileName}`}
                      title="Quitar el documento"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Sin campo de título (decisión del usuario, 16/10): se toma del catálogo o del nombre del archivo */}
          {/* Previsualización del documento (solo lectura) */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>Previsualización del Documento</span>
              <div className={styles.previewBadgesRow}>
                {esTranscripcion ? (
                  <span className={styles.transcriptionBadge}>
                    <ScanText size={12} />
                    <span>Transcripción IA · revísala y corrígela</span>
                  </span>
                ) : (
                  <span className={styles.readOnlyBadge}>
                    <Eye size={12} />
                    <span>Solo Lectura · Previsualización</span>
                  </span>
                )}
                {docContent && (
                  <span className={styles.charCountBadge}>
                    {docContent.length.toLocaleString()} caracteres
                  </span>
                )}
              </div>
            </div>

            {extraccion.estado !== 'inactiva' && (
              <div
                className={extraccion.estado === 'error' ? styles.sourceError : styles.sourceLoading}
                role={extraccion.estado === 'error' ? 'alert' : 'status'}
              >
                {extraccion.estado === 'error'
                  ? <AlertTriangle size={14} />
                  : <Loader2 size={14} className={styles.spinningIcon} />}
                <span>{extraccion.mensaje}</span>
              </div>
            )}

            <div className={styles.previewBoxWrapper}>
              <textarea
                rows={esTranscripcion ? 10 : 5}
                value={docContent}
                readOnly={!esTranscripcion}
                onChange={(e) => handleTranscripcionEditada(e.target.value)}
                placeholder="Selecciona un documento oficial de la biblioteca superior o sube un archivo (PDF, MD, TXT o imagen) para previsualizar su contenido aquí..."
                className={styles.previewTextArea}
              />
              <div className={styles.previewFooterNotice}>
                {esTranscripcion ? <PenLine size={12} /> : <Lock size={12} />}
                <span>
                  {esTranscripcion
                    ? 'Texto transcrito por IA desde tu archivo: corrige lo que esté mal leído. Las citas del material se verificarán contra este texto, no contra la imagen.'
                    : 'Documento protegido contra edición: el contenido fuente se procesará íntegro sin modificaciones manuales.'}
                </span>
              </div>
            </div>

            {avisosFuente.length > 0 && (
              <ul className={styles.sourceNotices}>
                {avisosFuente.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Parámetros pedagógicos: el invitado ve los fijos del documento; con sesión, dos formas de empezar */}
          {!sesionIniciada ? (
            <div className={styles.sorteo} aria-live="polite">
              {documentoElegido ? (
                <>
                  <span className={styles.sorteoTitulo}>Ajustes de este documento:</span>
                  <span className={styles.sorteoChip}><strong>Perfil:</strong> {etiqueta(PERFILES, documentoElegido.perfil)}</span>
                  <span className={styles.sorteoChip}><strong>Sector:</strong> {etiqueta(NICHOS, documentoElegido.nicho)}</span>
                  <span className={styles.sorteoChip}><strong>Nivel:</strong> {etiqueta(NIVELES, documentoElegido.detalle)}</span>
                </>
              ) : (
                <span className={styles.sorteoTitulo}>Elige un documento de la biblioteca: cada uno trae su perfil, sector y nivel</span>
              )}
            </div>
          ) : (<>
          <h3 className={styles.tituloPerfil}>Antes de empezar 👀 selecciona tu perfil</h3>
          <div className={styles.modoSelector} role="radiogroup" aria-label="Cómo quieres adaptar el documento">
            <button
              type="button"
              role="radio"
              aria-checked={modo === 'personalizado'}
              onClick={() => elegirModo('personalizado')}
              className={`${styles.modoOpcion} ${modo === 'personalizado' ? styles.modoOpcionActiva : ''}`}
            >
              <SlidersHorizontal size={18} color="var(--color-violet-400)" />
              <span className={styles.modoTitulo}>Personalizado</span>
              <span className={styles.modoDesc}>Tú eliges cada parámetro</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={modo === 'sorpresa'}
              onClick={() => elegirModo('sorpresa')}
              className={`${styles.modoOpcion} ${styles.modoSorpresa} ${modo === 'sorpresa' ? styles.modoOpcionActiva : ''}`}
              title="Sorteamos perfil, sector y nivel por ti"
            >
              <Sparkles size={18} color="#fde047" className={styles.destello} />
              <span className={styles.modoTitulo}>Sorpréndeme</span>
              <span className={styles.modoDesc}>Perfil al azar</span>
            </button>
          </div>

          {modo === 'sorpresa' ? (
            <div className={styles.sorteo} aria-live="polite">
              <span className={styles.sorteoTitulo}>Te tocó:</span>
              <span className={styles.sorteoChip}><strong>Perfil:</strong> {etiqueta(PERFILES, profile)}</span>
              <span className={styles.sorteoChip}><strong>Sector:</strong> {etiqueta(NICHOS, niche)}</span>
              <span className={styles.sorteoChip}><strong>Nivel:</strong> {etiqueta(NIVELES, detail)}</span>
              <button type="button" onClick={sortear} className={styles.sorteoBoton}>
                <Dices size={14} />
                Otra combinación
              </button>
            </div>
          ) : (
            <div className={styles.paramsGrid}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Perfil del Destinatario</label>
                <select
                  value={profile}
                  onChange={(e) => setProfile(e.target.value as RecipientProfile)}
                  className={styles.selectInput}
                >
                  {PERFILES.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nicho / Sector</label>
                <select
                  value={niche}
                  onChange={(e) => setNiche(e.target.value as IndustryNiche)}
                  className={styles.selectInput}
                >
                  {NICHOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Nivel de Detalle</label>
                <select
                  value={detail}
                  onChange={(e) => setDetail(e.target.value as DetailLevel)}
                  className={styles.selectInput}
                >
                  {NIVELES.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                </select>
              </div>
            </div>
          )}
          </>)}

          {/* Plegado por defecto: está para quien quiera saber qué se le pide a la IA */}
          <details className={styles.promptPaquete}>
            <summary className={styles.promptEtiqueta}>
              <ChevronRight size={12} className={styles.promptChevron} aria-hidden="true" />
              <Sparkles size={12} aria-hidden="true" />
              Lo que NuevaMente le pedirá a la IA <em>(resumen de las instrucciones reales)</em>
            </summary>
            <p className={styles.promptTexto}>{promptPaquete(profile, niche, detail)}</p>
          </details>

          {/* Estado de Animación del Pipeline o Botón de Acción */}
      {isProcessing ? (
            <div className={styles.processingCard}>
              <div className={styles.processingHeader}>
                <Cpu size={24} className={styles.spinningIcon} />
                <span className={styles.processingStageText}>
                  {processingStage || 'Orquestando Agentes RAG & OCI...'}
                </span>
              </div>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} />
              </div>
              <div className={styles.processingMeta}>
                {esEtapaDeMuestra(processingStage)
                  ? 'Muestra pregenerada: no se llama a ningún modelo ni se gasta cuota'
                  : 'Recursive Chunking · Vector Search · Faithfulness Verification · OCI Bucket Sync'}
              </div>
            </div>
          ) : (
            <div className={styles.submitBar}>
              {/* En vez del texto de OCI (decisión del usuario, 16/10): la hoja que se convierte en recursos */}
              <MiniAnimacionRecursos />

              {!sesionIniciada ? (
                <div className={styles.accionesMuestra}>
                  <span className={styles.notaInvitado}>
                    {muestraElegida
                      ? `Sin sesión se abre la muestra generada el ${muestraElegida.generado_el} con estos ajustes: no gasta cuota.`
                      : selectedDocId
                        ? 'Este documento aún no tiene su muestra generada. Inicia sesión para generarlo.'
                        : 'Elige un documento de la biblioteca o prueba la demo.'}
                  </span>
                  <button type="submit" className={styles.submitButton} disabled={!muestraElegida || isLoadingPreset}>
                    <Sparkles size={16} color="#fde047" />
                    <span>Iniciar Aprendizaje</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : muestraElegida && selectedDocId ? (
                <div className={styles.accionesMuestra}>
                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={() => onAbrirMuestra(selectedDocId)}
                    title={`Paquete y video generados el ${muestraElegida.generado_el} (${muestraElegida.ajustes.perfil}, ${muestraElegida.ajustes.detalle})`}
                  >
                    <Zap size={16} color="#fde047" />
                    <span>Ver recorrido de muestra (sin gastar cuota)</span>
                    <ArrowRight size={16} />
                  </button>
                  <button type="submit" className={styles.botonSecundario} disabled={extrayendo}>
                    <Sparkles size={14} aria-hidden="true" />
                    <span>Generar con mis ajustes (gasta cuota)</span>
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={extrayendo}
                >
                  <Sparkles size={16} color="#fde047" />
                  <span>Iniciar Aprendizaje</span>
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};