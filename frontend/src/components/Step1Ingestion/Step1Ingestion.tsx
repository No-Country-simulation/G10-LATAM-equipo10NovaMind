import { useState, type ChangeEvent, type FormEvent } from 'react';
import { UploadCloud, Sparkles, Database, CheckCircle2, Zap, Cpu, ArrowRight } from 'lucide-react';
import type { RecipientProfile, OutputFormat, IndustryNiche, DetailLevel, RealDocumentPreset } from '../../types/types';
import { REAL_DOCUMENTS_CATALOG } from '../../data/mockScenarios';
import styles from './Step1Ingestion.module.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Step1Props {
  onStartPipeline: (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    pdfBase64?: string | null,
    rawFile?: File | null
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
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);

  const handleSelectRealDocument = async (doc: RealDocumentPreset) => {
    setSelectedDocId(doc.id);
    setIsLoadingPreset(true);
    setDocTitle(doc.titulo);
    setNiche(doc.nicho);
    setProfile(doc.perfil);
    setFormat(doc.formato_sugerido);
    setFileName(doc.nombre_archivo);

    try {
      const res = await fetch(`${BASE_URL}/api/v1/documentos/ejemplos/${encodeURIComponent(doc.nombre_archivo)}`);
      if (res.ok) {
        const blob = await res.blob();
        const mimeType = doc.tipo === 'pdf' ? 'application/pdf' : 'text/markdown';
        const file = new File([blob], doc.nombre_archivo, { type: mimeType });
        setRawFile(file);

        if (doc.tipo === 'markdown') {
          const text = await blob.text();
          setDocContent(text);
          setPdfBase64(null);
        } else {
          setPdfBase64(null);
          const mb = (blob.size / (1024 * 1024)).toFixed(2);
          setDocContent(
            `📄 [ARCHIVO PDF OFICIAL CARGADO]: "${doc.nombre_archivo}" (${mb} MB)\nEl archivo binario se transmitirá directamente al motor RAG de NovaMind (pypdf + ChromaDB + Cohere Embeddings) para extraer la semántica de sus páginas y alimentar la orquestación multi-agente en tiempo real.`
          );
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn('Cargando documento en modo referencia:', err);
      setRawFile(null);
      setDocContent(
        `📄 Documento Oficial: "${doc.titulo}" (${doc.nombre_archivo})\n\n${doc.descripcion}\n\nEste documento será analizado y contextualizado por los agentes pedagógicos de NovaMind.`
      );
    } finally {
      setIsLoadingPreset(false);
    }
  };

  const handleLoadDemoScenario = () => {
    handleSelectRealDocument(REAL_DOCUMENTS_CATALOG[0]);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedDocId(null);
    setRawFile(file);
    setFileName(file.name);
    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Clean = result.includes(',') ? result.split(',')[1] : result;
        setPdfBase64(base64Clean);
        const mb = (file.size / (1024 * 1024)).toFixed(2);
        setDocContent(
          `📄 [ARCHIVO PDF LISTO PARA INGESTA]: "${file.name}" (${mb} MB)\nEl archivo binario se transmitirá directamente al motor RAG de NovaMind (pypdf + ChromaDB + Cohere Embeddings) para extraer la semántica de sus páginas y alimentar la orquestación multi-agente.`
        );
      };
      reader.readAsDataURL(file);
    } else {
      setPdfBase64(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) setDocContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onStartPipeline(
      docTitle,
      docContent,
      profile,
      format,
      niche,
      detail,
      selectedDocId || undefined,
      pdfBase64,
      rawFile
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
                Carga de Archivo (PDF, MD o TXT)
              </label>
              <label className={styles.fileDropzone}>
                <UploadCloud size={18} color="var(--color-violet-400)" />
                <span className={styles.fileText}>
                  {fileName ? `Archivo: ${fileName}` : 'Subir archivo .pdf, .md o .txt'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.md,.markdown,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Document Content Textarea */}
          <div className={styles.fieldGroup}>
            <label className={`${styles.fieldLabel} ${styles.fieldLabelRow}`}>
              <span>Cuerpo de la Documentación Técnica</span>
              {pdfBase64 && (
                <span className={styles.pdfNotice}>
                  ✓ PDF codificado en Base64 listo para Gemini Multimodal
                </span>
              )}
            </label>
            <textarea
              rows={4}
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
              placeholder="Pega aquí el contenido técnico para indexar en la base vectorial..."
              className={styles.textArea}
              required
            />
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
                <option value="General">General (Cloud Infrastructure)</option>
                <option value="Fintech">Fintech & Banca</option>
                <option value="Salud">Salud & Biotech</option>
                <option value="E-commerce">E-commerce & Retail</option>
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