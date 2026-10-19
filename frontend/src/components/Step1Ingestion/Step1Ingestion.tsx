import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  UploadCloud, Sparkles, Database, CheckCircle2, Zap, Cpu, ArrowRight, Eye, Lock, ScanText, PenLine, AlertTriangle, Loader2,
  Dices, SlidersHorizontal, FileText, X, ChevronRight, Play,
} from 'lucide-react';
import type {
  RecipientProfile, OutputFormat, IndustryNiche, DetailLevel, RealDocumentPreset, OrigenContenido, MuestraPregenerada,
} from '../../types/types';
import { REAL_DOCUMENTS_CATALOG } from '../../data/mockScenarios';
import { extraerDocumento, textoDocumentoEjemplo } from '../../services/api';
import { escenarioDe } from '../../services/muestras';
import { HeroAnimacion } from './HeroAnimacion';
import { MiniAnimacionRecursos } from './MiniAnimacionRecursos';
import styles from './Step1Ingestion.module.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ARCHIVOS_ACEPTADOS = '.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp';
const esImagen = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name);
const esPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

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

const PROMPT_PERFIL: Record<RecipientProfile, [string, string]> = {
  'Principiante': ['un principiante', 'Explícale desde cero con lenguaje sencillo, define cada término técnico y apóyate en situaciones cotidianas.'],
  'Desarrollador Junior': ['un desarrollador junior', 'Usa lenguaje técnico y explica cómo funciona cada componente, con sus buenas prácticas y errores frecuentes.'],
  'Líder Técnico / Arquitecto': ['un líder técnico o arquitecto', 'Céntrate en la arquitectura, las decisiones, los riesgos y los compromisos técnicos.'],
  'Gestor / Ejecutivo (No Técnico)': ['un gestor o ejecutivo no técnico', 'Háblale en lenguaje de negocio: impacto, beneficios, riesgos y decisiones, sin detalle técnico innecesario.'],
};

const PROMPT_NIVEL: Record<DetailLevel, [string, string]> = {
  'Didáctico': ['entender las ideas clave', 'Usa analogías y avanza un paso cada vez.'],
  'Técnico Profundo': ['profundizar en los detalles', 'Entra en la arquitectura y la configuración, y reproduce los comandos tal como aparecen en el documento.'],
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

const esAceptado = (f: File) => ARCHIVOS_ACEPTADOS.split(',').some((ext) => f.name.toLowerCase().endsWith(ext));

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
  muestras: Record<string, MuestraPregenerada[]>;
  onAbrirMuestra: (documento: string, escenario?: string) => void;
  sesionIniciada: boolean;
  onIniciarSesion: () => void;
  isProcessing: boolean;
  processingStage: string;
}

type DocumentoCargado = { archivo: File; texto: string };

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
  const [escenarioId, setEscenarioId] = useState<string | undefined>(undefined);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [profile, setProfile] = useState<RecipientProfile>('Principiante');
  const [format, setFormat] = useState<OutputFormat>('Paquete Educativo Completo (5 Estaciones)');
  const [niche, setNiche] = useState<IndustryNiche>('General');
  const [detail, setDetail] = useState<DetailLevel>('Didáctico');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [bytesArchivo, setBytesArchivo] = useState<number | null>(null);
  const [origen, setOrigen] = useState<OrigenContenido>('documento');
  const [extraccion, setExtraccion] = useState<Extraccion>({ estado: 'inactiva' });
  const [avisosFuente, setAvisosFuente] = useState<string[]>([]);
  const turnoSubida = useRef(0);
  const [arrastrando, setArrastrando] = useState<boolean>(false);
  const tarjetaProgresoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isProcessing) tarjetaProgresoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isProcessing]);

  const sinDocumento = !fileName && !docContent && !isLoadingPreset;
  const documentoElegido = REAL_DOCUMENTS_CATALOG.find((d) => d.id === selectedDocId);
  const [modo, setModo] = useState<'personalizado' | 'sorpresa'>('personalizado');

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

  const handleSelectRealDocument = async (doc: RealDocumentPreset): Promise<DocumentoCargado | null> => {
    reiniciarFuente();
    const turno = turnoSubida.current;
    setSelectedDocId(doc.id);
    setEscenarioId(undefined);
    setIsLoadingPreset(true);
    setDocTitle(doc.titulo);

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

      setExtraccion({ estado: 'cargando', bloquea: false, mensaje: 'Extrayendo el texto para la vista previa… ya puedes generar.' });
      try {
        const { texto } = await textoDocumentoEjemplo(doc.nombre_archivo);
        if (turno !== turnoSubida.current) return null;
        setDocContent(texto);
        setExtraccion({ estado: 'inactiva' });
        return { archivo, texto };
      } catch (err) {
        if (turno !== turnoSubida.current) return null;
        setExtraccion({
          estado: 'error',
          bloquea: false,
          mensaje: `No se pudo previsualizar el texto (${err instanceof Error ? err.message : String(err)}); el PDF se procesará igualmente.`,
        });
        return { archivo, texto: '' };
      }
    } catch (err) {
      if (turno !== turnoSubida.current) return null;
      setFileName(null);
      setSelectedDocId(null);
      setExtraccion({ estado: 'error', mensaje: err instanceof Error ? err.message : String(err) });
      return null;
    } finally {
      setIsLoadingPreset(false);
    }
  };

  const demo = REAL_DOCUMENTS_CATALOG[0];
  const demoConMuestra = Boolean(muestras[demo.id]?.length);
  const demoDisponible = demoConMuestra || sesionIniciada;

  const handleLoadDemoScenario = async () => {
    if (demoConMuestra) {
      onAbrirMuestra(demo.id);
      return;
    }
    if (!sesionIniciada) return;
    const cargado = await handleSelectRealDocument(demo);
    if (cargado) {
      onStartPipeline(
        demo.titulo,
        cargado.texto,
        demo.perfil,
        demo.formato_sugerido,
        demo.nicho,
        demo.detalle,
        demo.id,
        cargado.archivo,
        'documento'
      );
    }
  };

  const escenariosDoc = selectedDocId ? muestras[selectedDocId] ?? [] : [];
  const muestraElegida = selectedDocId ? escenarioDe(muestras, selectedDocId, escenarioId) : undefined;

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void procesarArchivo(file);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
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

    setRawFile(null);
    setDocContent('');
    setExtraccion({
      estado: 'cargando',
      mensaje: esImagen(file) ? 'Transcribiendo imagen con IA…' : 'Extrayendo texto del PDF…',
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
        setRawFile(file);
      }
    } catch (err) {
      if (turno !== turnoSubida.current) return;
      setFileName(null);
      setExtraccion({ estado: 'error', mensaje: err instanceof Error ? err.message : String(err) });
    }
  };

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
    if (!sesionIniciada) {
      if (selectedDocId && muestraElegida) onAbrirMuestra(selectedDocId, muestraElegida.escenario);
      return;
    }
    if (!docContent.trim() && !rawFile) {
      alert('Por favor selecciona un documento de la biblioteca o sube un archivo antes de iniciar el pipeline.');
      return;
    }
    onStartPipeline(
      docTitle.trim() || 'Documento sin título',
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
      {/* Hero Banner */}
      <div className={styles.heroBanner}>
        <HeroAnimacion />
        <div className={styles.heroContent}>
          <div className={styles.tagRow}>
            <span className={styles.pipelineTag}>
              <Sparkles size={13} color="var(--color-violet-400)" />
              Agentes Pedagógicos
            </span>
            <span className={styles.hackathonSign}>
              Oracle Next Education · Hackathon ONE G10
            </span>
          </div>

       <h2 className={styles.heroTitle}>
  Convierte documentos <span className={styles.heroTitleGradient}>en rutas de aprendizaje</span>
</h2>

          <p className={styles.heroText}>
            Resumen, tarjetas, diagrama, video narrado y quiz a partir de tu documentación técnica, con citas comprobadas.
          </p>
        </div>
      </div>

      {/* Franja de Prueba Rápida */}
      <div className={styles.demoBannerCard}>
        <div className={styles.demoBannerRow}>
          <div className={styles.demoBannerText}>
            <div className={styles.demoBannerTitle}>
              <Zap size={18} color="var(--color-violet-400)" />
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
              : demoDisponible ? undefined : 'La muestra de la prueba rápida aún no está generada'}
          >
            {isLoadingPreset ? (
              <>
                <Loader2 size={15} className={styles.spinningIcon} />
                <span>Cargando documento...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Prueba rápida</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sección Selección de Biblioteca */}
      <div className={styles.scenariosSection}>
        <h2 className={styles.tituloRuta}>Ruta de aprendizaje</h2>
        
        <div className={styles.scenariosHeader}>
          <div className={styles.scenariosLabel}>
            <Database size={15} color="var(--color-violet-400)" />
            <span>Documentos de ejemplo</span>
          </div>
          <span className={styles.scenariosHelp}>
            {isLoadingPreset ? (
              <span className={styles.inlineLoading}>
                <Loader2 size={12} className={styles.spinningIcon} /> Cargando...
              </span>
            ) : sesionIniciada ? (
              'Materiales preconfigurados o sube tu archivo abajo'
            ) : (
              'Recorridos y video pregenerados listos para explorar'
            )}
          </span>
        </div>

        {/* Guía de pasos compacta */}
        {!sesionIniciada && !selectedDocId && (
          <div className={styles.guiaContainer}>
            <ol className={styles.guiaPasos}>
              <li><span className={styles.guiaNumero}>1</span> Elige un documento de la lista</li>
              <li><span className={styles.guiaNumero}>2</span> Pulsa «Iniciar Aprendizaje»</li>
              <li><span className={styles.guiaNumero}>3</span> Explora las 5 estaciones pedagógicas</li>
            </ol>
          </div>
        )}

        <div className={styles.selectorBiblioteca}>
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
              Selecciona un documento: Don Quijote, Apache Kafka, Guía OCI...
            </option>
            {REAL_DOCUMENTS_CATALOG.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.titulo} · {doc.tipo.toUpperCase()} ({doc.tamano_formato.split(' ').slice(0, 2).join(' ')})
                {(muestras[doc.id]?.length ?? 0) > 1 ? ` · ${muestras[doc.id].length} variantes` : ''}
              </option>
            ))}
          </select>
        </div>

        {documentoElegido && (
          <div className={`${styles.scenarioCard} ${styles.scenarioCardSelected}`}>
            <div className={styles.scenarioTopRow}>
              <div className={styles.badgeRow}>
                <span className={styles.nicheBadge}>{documentoElegido.nicho}</span>
                <span className={styles.formatTypeBadge}>
                  {documentoElegido.tipo.toUpperCase()} · {documentoElegido.tamano_formato.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
              <CheckCircle2 size={16} color="var(--color-violet-400)" />
            </div>
            <div className={styles.scenarioSnippet}>{documentoElegido.descripcion}</div>
          </div>
        )}
      </div>

      {/* Formulario de Ingestión */}
      <form onSubmit={handleSubmit} className={styles.formContainer}>
        <div className={styles.seccionSubidaHeader}>
          <div className={styles.scenariosLabel}>
            <UploadCloud size={15} color="var(--color-violet-400)" />
            <span>O sube tu propio documento</span>
          </div>
        </div>

        <div className={styles.formCard}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Documento de entrada (PDF, MD, TXT o Imagen)</label>
            {!sesionIniciada ? (
              <div className={styles.cargaBloqueada}>
                <Lock size={16} className={styles.lockIcon} aria-hidden="true" />
                <span className={styles.bloqueoTexto}>
                  Inicia sesión para subir archivos propios y personalizar sector, audiencia y nivel.
                </span>
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
                <div className={styles.dropzoneIconWrapper}>
                  <UploadCloud size={24} color="var(--color-violet-400)" />
                </div>
                <div className={styles.dropzoneTextWrapper}>
                  <span className={styles.fileText}>
                    {arrastrando
                      ? 'Suelta el archivo aquí'
                      : sinDocumento
                        ? 'Arrastra un archivo aquí o haz clic para seleccionarlo'
                        : 'Arrastra o haz clic para sustituir el documento'}
                  </span>
                  <span className={styles.fileHint}>
                    PDF, Markdown, TXT o imagen (PNG, JPG, WEBP) · Máx. 15 MB
                  </span>
                </div>
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
                    title="Quitar archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Previsualización del Documento */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>Previsualización del Documento</span>
              <div className={styles.previewBadgesRow}>
                {esTranscripcion ? (
                  <span className={styles.transcriptionBadge}>
                    <ScanText size={12} />
                    <span>Transcripción IA (editable)</span>
                  </span>
                ) : (
                  <span className={styles.readOnlyBadge}>
                    <Eye size={12} />
                    <span>Solo Lectura</span>
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
                {extraccion.estado === 'error' ? (
                  <AlertTriangle size={14} />
                ) : (
                  <Loader2 size={14} className={styles.spinningIcon} />
                )}
                <span>{extraccion.mensaje}</span>
              </div>
            )}

            <div className={styles.previewBoxWrapper}>
              <textarea
                rows={esTranscripcion ? 9 : 5}
                value={docContent}
                readOnly={!esTranscripcion}
                onChange={(e) => handleTranscripcionEditada(e.target.value)}
                placeholder="El contenido del documento seleccionado o subido se visualizará aquí..."
                className={styles.previewTextArea}
              />
              <div className={styles.previewFooterNotice}>
                {esTranscripcion ? <PenLine size={13} /> : <Lock size={13} />}
                <span>
                  {esTranscripcion
                    ? 'Texto extraído por visión IA: puedes corregirlo. La fundamentación pedagógica citará este texto exacto.'
                    : 'Documento protegido contra edición: el material fuente se procesará íntegro para garantizar citas exactas.'}
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

          {/* Sección de Personalización Pedagógica */}
          {!sesionIniciada ? (
            <div className={styles.sorteo} aria-live="polite">
              {documentoElegido ? (
                <>
                  {escenariosDoc.length > 1 && (
                    <div className={styles.escenarios} role="radiogroup" aria-label="Escenarios de este documento">
                      <span className={styles.sorteoTitulo}>Escenarios disponibles:</span>
                      {escenariosDoc.map((e) => (
                        <button
                          key={e.escenario}
                          type="button"
                          role="radio"
                          aria-checked={e.escenario === muestraElegida?.escenario}
                          onClick={() => setEscenarioId(e.escenario)}
                          className={`${styles.escenario} ${e.escenario === muestraElegida?.escenario ? styles.escenarioActivo : ''}`}
                        >
                          {e.etiqueta}{e.modo === 'clasico' ? ' · RAG Tradicional' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className={styles.sorteoTitulo}>Parámetros configurados:</span>
                  <span className={styles.sorteoChip}><strong>Perfil:</strong> {etiqueta(PERFILES, muestraElegida?.ajustes.perfil ?? documentoElegido.perfil)}</span>
                  <span className={styles.sorteoChip}><strong>Sector:</strong> {etiqueta(NICHOS, muestraElegida?.ajustes.nicho ?? documentoElegido.nicho)}</span>
                  <span className={styles.sorteoChip}><strong>Nivel:</strong> {etiqueta(NIVELES, muestraElegida?.ajustes.detalle ?? documentoElegido.detalle)}</span>
                  {muestraElegida?.modo === 'clasico' && (
                    <span className={styles.sorteoChip}><strong>Modo:</strong> RAG Vectorial (Cohere + LangGraph)</span>
                  )}
                </>
              ) : (
                <span className={styles.sorteoTitulo}>Elige un documento para revisar sus parámetros predeterminados</span>
              )}
            </div>
          ) : (
            <div className={styles.parametrizacionBloque}>
              <div className={styles.parametrizacionHeader}>
                <span className={styles.fieldLabel}>Adaptación pedagógica</span>
                
                {/* Segmented Control */}
                <div className={styles.segmentedControl} role="radiogroup" aria-label="Modo de parametrización">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modo === 'personalizado'}
                    onClick={() => elegirModo('personalizado')}
                    className={`${styles.segmentedTab} ${modo === 'personalizado' ? styles.segmentedTabActiva : ''}`}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Personalizado</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modo === 'sorpresa'}
                    onClick={() => elegirModo('sorpresa')}
                    className={`${styles.segmentedTab} ${modo === 'sorpresa' ? styles.segmentedTabActiva : ''}`}
                  >
                    <Sparkles size={14} />
                    <span>Sorpréndeme</span>
                  </button>
                </div>
              </div>

              {modo === 'sorpresa' ? (
                <div className={styles.sorteo} aria-live="polite">
                  <span className={styles.sorteoTitulo}>Configuración aleatoria:</span>
                  <span className={styles.sorteoChip}><strong>Perfil:</strong> {etiqueta(PERFILES, profile)}</span>
                  <span className={styles.sorteoChip}><strong>Sector:</strong> {etiqueta(NICHOS, niche)}</span>
                  <span className={styles.sorteoChip}><strong>Nivel:</strong> {etiqueta(NIVELES, detail)}</span>
                  <button type="button" onClick={sortear} className={styles.sorteoBoton}>
                    <Dices size={14} />
                    <span>Reintentar</span>
                  </button>
                </div>
              ) : (
                <div className={styles.paramsGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldSubLabel}>Perfil del Destinatario</label>
                    <select
                      value={profile}
                      onChange={(e) => setProfile(e.target.value as RecipientProfile)}
                      className={styles.selectInput}
                    >
                      {PERFILES.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldSubLabel}>Nicho / Sector</label>
                    <select
                      value={niche}
                      onChange={(e) => setNiche(e.target.value as IndustryNiche)}
                      className={styles.selectInput}
                    >
                      {NICHOS.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
                    </select>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldSubLabel}>Nivel de Detalle</label>
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
            </div>
          )}

          {/* Directivas Prompt del Sistema */}
          <details className={styles.promptPaquete}>
            <summary className={styles.promptEtiqueta}>
              <ChevronRight size={13} className={styles.promptChevron} aria-hidden="true" />
              <Sparkles size={13} aria-hidden="true" />
              <span>Instrucciones pedagógicas para los modelos</span>
            </summary>
            <p className={styles.promptTexto}>{promptPaquete(profile, niche, detail)}</p>
          </details>

          {/* Barra de Procesamiento / Botones Finales */}
          {isProcessing ? (
            <div className={styles.processingCard} ref={tarjetaProgresoRef} role="status" aria-live="polite">
              <div className={styles.processingHeader}>
                <Cpu size={22} className={styles.spinningIcon} />
                <span className={styles.processingStageText}>
                  {processingStage || 'Orquestando agentes pedagógicos...'}
                </span>
              </div>
              <div className={styles.progressBarBg}>
                <div className={styles.progressBarFill} />
              </div>
              <div className={styles.processingMeta}>
                {esEtapaDeMuestra(processingStage)
                  ? 'Abriendo muestra pregenerada (sin consumo de cuota)'
                  : 'Procesamiento paralelo con Gemini · Fundamentación en documento · OCI Object Storage'}
              </div>
            </div>
          ) : (
            <div className={styles.submitBar}>
              <MiniAnimacionRecursos />

              {!sesionIniciada ? (
                <div className={styles.accionesMuestra}>
                  <span className={styles.notaInvitado}>
                    {muestraElegida
                      ? `Modo invitado: apertura de la muestra del ${muestraElegida.generado_el}. Inicia sesión para generar documentos nuevos.`
                      : selectedDocId
                        ? 'Este documento aún no tiene una muestra precargada. Inicia sesión para crearlo.'
                        : 'Elige un documento de ejemplo para previsualizar.'}
                  </span>
                  <button type="submit" className={styles.submitButton} disabled={!muestraElegida || isLoadingPreset}>
                    <Play size={16} fill="currentColor" />
                    <span>Iniciar Aprendizaje</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              ) : muestraElegida && selectedDocId ? (
                <div className={styles.accionesMuestra}>
                  <button
                    type="button"
                    className={styles.submitButton}
                    onClick={() => onAbrirMuestra(selectedDocId, muestraElegida.escenario)}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Ver muestra precargada</span>
                  </button>
                  <button type="submit" className={styles.botonSecundario} disabled={extrayendo}>
                    <Sparkles size={14} aria-hidden="true" />
                    <span>Generar con mis parámetros</span>
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={extrayendo}
                >
                  <Sparkles size={16} />
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