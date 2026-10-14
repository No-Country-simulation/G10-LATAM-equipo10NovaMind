import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  UploadCloud, Sparkles, Database, CheckCircle2, Zap, Cpu, ArrowRight, Eye, Lock, ScanText, PenLine, AlertTriangle, Loader2,
} from 'lucide-react';
import type {
  RecipientProfile, OutputFormat, IndustryNiche, DetailLevel, RealDocumentPreset, OrigenContenido,
} from '../../types/types';
import { REAL_DOCUMENTS_CATALOG } from '../../data/mockScenarios';
import { extraerDocumento, textoDocumentoEjemplo } from '../../services/api';
import styles from './Step1Ingestion.module.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ARCHIVOS_ACEPTADOS = '.pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.webp';
const esImagen = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name);
const esPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

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
  isProcessing: boolean;
  processingStage: string;
}

export const Step1Ingestion = ({
  onStartPipeline,
  isProcessing,
  processingStage,
}: Step1Props) => {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [profile, setProfile] = useState<RecipientProfile>('Principiante');
  const [format, setFormat] = useState<OutputFormat>('Paquete Educativo Completo (5 Estaciones)');
  const [niche, setNiche] = useState<IndustryNiche>('General');
  const [detail, setDetail] = useState<DetailLevel>('Didáctico');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  // transcripcion_ia: el texto lo transcribió Gemini de una imagen o un PDF escaneado y es editable
  const [origen, setOrigen] = useState<OrigenContenido>('documento');
  const [extraccion, setExtraccion] = useState<Extraccion>({ estado: 'inactiva' });
  const [avisosFuente, setAvisosFuente] = useState<string[]>([]);
  const turnoSubida = useRef(0); // descarta respuestas de una subida anterior
  const esTranscripcion = origen === 'transcripcion_ia';
  const extrayendo = extraccion.estado === 'cargando' && extraccion.bloquea !== false;

  const reiniciarFuente = () => {
    turnoSubida.current += 1;
    setOrigen('documento');
    setExtraccion({ estado: 'inactiva' });
    setAvisosFuente([]);
  };

  const handleSelectRealDocument = async (doc: RealDocumentPreset) => {
    reiniciarFuente();
    const turno = turnoSubida.current;
    setSelectedDocId(doc.id);
    setIsLoadingPreset(true);
    setDocTitle(doc.titulo);
    setNiche(doc.nicho);
    setProfile(doc.perfil);
    setFormat(doc.formato_sugerido);
    setFileName(doc.nombre_archivo);
    setRawFile(null);
    setDocContent('');
    setExtraccion({ estado: 'cargando', mensaje: 'Cargando el documento…' });

    try {
      const res = await fetch(`${BASE_URL}/api/v1/documentos/ejemplos/${encodeURIComponent(doc.nombre_archivo)}`);
      if (!res.ok) throw new Error(`No se pudo descargar «${doc.titulo}» (HTTP ${res.status}).`);
      const blob = await res.blob();
      const mimeType = doc.tipo === 'pdf' ? 'application/pdf' : 'text/markdown';
      if (turno !== turnoSubida.current) return;
      setRawFile(new File([blob], doc.nombre_archivo, { type: mimeType }));
      if (doc.tipo === 'markdown') {
        setDocContent(await blob.text());
        setExtraccion({ estado: 'inactiva' });
        return;
      }
      // El PDF ya se puede enviar; su texto (el ENISA tarda ~15 s la primera vez) solo es vista previa
      setExtraccion({ estado: 'cargando', bloquea: false,
        mensaje: 'Extrayendo el texto para la vista previa… ya puedes generar.' });
      try {
        const { texto } = await textoDocumentoEjemplo(doc.nombre_archivo);
        if (turno !== turnoSubida.current) return;
        setDocContent(texto);
        setExtraccion({ estado: 'inactiva' });
      } catch (err) {
        if (turno !== turnoSubida.current) return;
        setExtraccion({ estado: 'error', bloquea: false, mensaje:
          `No se pudo previsualizar el texto (${err instanceof Error ? err.message : String(err)}); el PDF se procesará igualmente.` });
      }
    } catch (err) {
      // Sin el documento no se genera nada: nunca a partir de la descripción del catálogo
      if (turno !== turnoSubida.current) return;
      setFileName(null);
      setSelectedDocId(null);
      setExtraccion({ estado: 'error', mensaje: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsLoadingPreset(false);
    }
  };

  const handleLoadDemoScenario = () => {
    handleSelectRealDocument(REAL_DOCUMENTS_CATALOG[0]);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;

    reiniciarFuente();
    const turno = turnoSubida.current;
    setSelectedDocId(null);
    setFileName(file.name);
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

  const handleTranscripcionEditada = (texto: string) => {
    if (esTranscripcion) setDocContent(texto);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (extrayendo) return;
    if (!docContent.trim() && !rawFile) {
      alert('Por favor selecciona un documento de la biblioteca o sube un archivo antes de iniciar el pipeline.');
      return;
    }
    onStartPipeline(
      docTitle,
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
        <div className={styles.heroContent}>
          <div className={styles.tagRow}>
            <span className={styles.pipelineTag}>
              <Sparkles size={14} color="#fbbf24" />
              Pipeline RAG & Agentes Pedagógicos
            </span>
            <span className={styles.hackathonSign}>
              Oracle Next Education · Hackathon ONE G10 · NovaMind
            </span>
          </div>

          <h2 className={styles.heroTitle}>
            Ingesta de Documentación Técnica OCI & Adaptación Cognitiva
          </h2>

          <p className={styles.heroText}>
            Convierte manuales y especificaciones densas en rutas de aprendizaje gamificadas sin alucinaciones, persistidas en <strong className={styles.highlightOci}>OCI Object Storage Always Free</strong>.
          </p>
        </div>
      </div>

      {/* Acción Rápida: Cargar Documento Propio vs Modo Demo Instantáneo */}
      <div className={styles.demoBannerCard}>
        <div className={styles.demoBannerRow}>
          <div className={styles.demoBannerText}>
            <div className={styles.demoBannerTitle}>
              <Zap size={18} color="#fbbf24" />
              ¿Quieres probar la plataforma en 1 solo clic?
            </div>
            <div className={styles.demoBannerDesc}>
              Presiona el botón demo para precargar de inmediato nuestra <strong>Guía Técnica Oficial OCI (Swap 4 GB & Memoria en VM.Standard.E2.1.Micro)</strong>, o sube tu propio archivo PDF/MD/TXT en el formulario inferior.
            </div>
          </div>
          <button
            type="button"
            onClick={handleLoadDemoScenario}
            className={styles.demoButton}
            disabled={isLoadingPreset}
          >
            <Zap size={16} />
            {isLoadingPreset ? '⏳ Descargando documento...' : '⚡ Cargar Guía OCI Swap (Documento Real)'}
          </button>
        </div>
      </div>

      {/* Biblioteca de Documentos Reales Selector */}
      <div className={styles.scenariosSection}>
        <div className={styles.scenariosHeader}>
          <h3 className={styles.scenariosLabel}>
            <Database size={16} color="var(--color-violet-400)" />
            Biblioteca de Documentos Reales (data/documents/)
          </h3>
          <span className={styles.scenariosHelp}>
            {isLoadingPreset
              ? '⏳ Descargando archivo de prueba real...'
              : 'Selecciona un documento oficial de prueba para cargarlo y procesarlo con el pipeline RAG real'}
          </span>
        </div>

        <div className={styles.scenariosGrid}>
          {REAL_DOCUMENTS_CATALOG.map((doc) => {
            const isSelected = selectedDocId === doc.id;

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => handleSelectRealDocument(doc)}
                className={`${styles.scenarioCard} ${isSelected ? styles.scenarioCardSelected : ''}`}
              >
                <div className={styles.scenarioTopRow}>
                  <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                    <span className={styles.nicheBadge}>
                      {doc.nicho}
                    </span>
                    <span className={styles.formatTypeBadge}>
                      {doc.tipo === 'pdf' ? '📕 PDF' : '📄 MD'} · {doc.tamano_formato.split(' ')[0]} {doc.tamano_formato.split(' ')[1]}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={16} color="var(--color-violet-400)" />
                  )}
                </div>

                <div className={styles.scenarioTitle}>
                  {doc.titulo}
                </div>

                <div className={styles.scenarioSnippet}>
                  {doc.descripcion}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className={styles.container}>
        <div className={styles.formCard}>
          {/* File Dropzone & Document Title */}
          <div className={styles.inputGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Título del Documento Técnico
              </label>
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="ej.: Arquitectura de Redes VCN en OCI"
                className={styles.textInput}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Carga de Archivo (PDF, MD, TXT o imagen)
              </label>
              <label className={styles.fileDropzone}>
                <UploadCloud size={18} color="var(--color-violet-400)" />
                <span className={styles.fileText}>
                  {fileName ? `Archivo: ${fileName}` : 'Subir .pdf, .md, .txt o imagen (.png, .jpg, .webp)'}
                </span>
                <input
                  type="file"
                  accept={ARCHIVOS_ACEPTADOS}
                  onChange={handleFileUpload}
                  disabled={extrayendo}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Previsualización del Documento Técnico (Solo Lectura) */}
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabelRow}>
              <span className={styles.fieldLabel}>Previsualización del Documento Técnico</span>
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

          {/* 4 Parámetros Pedagógicos */}
          <div className={styles.paramsGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Perfil del Destinatario
              </label>
              <select
                value={profile}
                onChange={(e) => setProfile(e.target.value as RecipientProfile)}
                className={styles.selectInput}
              >
                <option value="Principiante">Principiante / Transición</option>
                <option value="Desarrollador Junior">Desarrollador Junior / Semi Senior</option>
                <option value="Líder Técnico / Arquitecto">Líder Técnico / Arquitecto</option>
                <option value="Gestor / Ejecutivo (No Técnico)">Gestor / Ejecutivo (No Técnico)</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Formato Pedagógico
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
                className={styles.selectInput}
              >
                <option value="Paquete Educativo Completo (5 Estaciones)">Paquete Completo (5 Estaciones)</option>
                <option value="Flashcards">Flashcards de Memorización</option>
                <option value="Tutorial">Guía Práctica Paso a Paso</option>
                <option value="Quiz Interactivo">Quiz Interactivo con Justificaciones</option>
                <option value="Resumen Ejecutivo (TL;DR)">Resumen Ejecutivo (TL;DR)</option>
                <option value="Guion de Clase / Video">Guion de Clase / Video</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Nicho / Sector
              </label>
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value as IndustryNiche)}
                className={styles.selectInput}
              >
                <option value="Tecnología e Informática">Tecnología e Informática</option>
                <option value="Medicina y Salud">Medicina y Salud</option>
                <option value="Ingeniería y Construcción">Ingeniería y Construcción</option>
                <option value="Finanzas y Contabilidad">Finanzas y Contabilidad</option>
                <option value="Administración y Negocios">Administración y Negocios</option>
                <option value="Marketing y Ventas">Marketing y Ventas</option>
                <option value="Leyes y Legal">Leyes y Legal</option>
                <option value="Educación y Academia">Educación y Academia</option>
                <option value="Ciencias e Investigación">Ciencias e Investigación</option>
                <option value="Industria y Operaciones">Industria y Operaciones</option>
                <option value="General">General (Multisectorial)</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Nivel de Detalle
              </label>
              <select
                value={detail}
                onChange={(e) => setDetail(e.target.value as DetailLevel)}
                className={styles.selectInput}
              >
                <option value="Didáctico">Didáctico (Metáforas y Analogías)</option>
                <option value="Técnico Profundo">Técnico Profundo (Sintaxis y Flags)</option>
              </select>
            </div>
          </div>

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
                Recursive Chunking · Vector Search · Faithfulness Verification · OCI Bucket Sync
              </div>
            </div>
          ) : (
            <div className={styles.submitBar}>
              <div className={styles.storageNote}>
                <Database size={16} color="var(--color-cyan-400)" />
                <span>Salida estructurada compatible con <strong>OCI Object Storage</strong></span>
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={extrayendo}
              >
                <Sparkles size={16} color="#fde047" />
                <span>Generar Adaptación Pedagógica RAG</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};