import { useState, type ChangeEvent, type FormEvent } from 'react';
import { UploadCloud, Sparkles, Layers, Cpu, Database, CheckCircle2, ArrowRight, Zap } from 'lucide-react';
import type { RecipientProfile, OutputFormat, IndustryNiche, DetailLevel, TechnicalScenario } from '../../types/types';
import { SCENARIOS } from '../../data/mockScenarios';
import styles from './Step1Ingestion.module.css';

interface Step1Props {
  onStartPipeline: (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    pdfBase64?: string | null
  ) => void;
  isProcessing: boolean;
  processingStage: string;
}

export const Step1Ingestion = ({
  onStartPipeline,
  isProcessing,
  processingStage,
}: Step1Props) => {
  const [selectedScenario, setSelectedScenario] = useState<TechnicalScenario | null>(null);
  const [docTitle, setDocTitle] = useState<string>('');
  const [docContent, setDocContent] = useState<string>('');
  const [profile, setProfile] = useState<RecipientProfile>('Principiante');
  const [format, setFormat] = useState<OutputFormat>('Paquete Educativo Completo (5 Estaciones)');
  const [niche, setNiche] = useState<IndustryNiche>('General');
  const [detail, setDetail] = useState<DetailLevel>('Didáctico');
  const [fileName, setFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  const handleLoadDemoScenario = () => {
    const demoSc = SCENARIOS[0]; // Guía Técnica OCI Swap 4 GB
    setSelectedScenario(demoSc);
    setDocTitle(demoSc.titulo);
    setDocContent(demoSc.contenido);
    setNiche(demoSc.nicho);
    setProfile(demoSc.perfilRecomendado);
    setFormat('Paquete Educativo Completo (5 Estaciones)');
    setFileName(null);
    setPdfBase64(null);
  };

  const handleSelectScenario = (sc: TechnicalScenario) => {
    setSelectedScenario(sc);
    setDocTitle(sc.titulo);
    setDocContent(sc.contenido);
    setNiche(sc.nicho);
    setProfile(sc.perfilRecomendado);
    setFileName(null);
    setPdfBase64(null);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setDocTitle(file.name.replace(/\.[^/.]+$/, ''));

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Clean = result.includes(',') ? result.split(',')[1] : result;
        setPdfBase64(base64Clean);
        setDocContent(
          `📄 [DOCUMENTO PDF CARGADO: "${file.name}"]\n\nEl archivo binario fue procesado y sincronizado con éxito.\nGemini utilizará procesamiento multimodal nativo para extraer la semántica, estructura de capítulos y diagramas del PDF sin pérdidas tipográficas.`
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
    onStartPipeline(docTitle, docContent, profile, format, niche, detail, selectedScenario?.id, pdfBase64);
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
          >
            <Zap size={16} />
            ⚡ Cargar Guía OCI Swap (Modo Demo)
          </button>
        </div>
      </div>

      {/* Preset Scenarios Selector */}
      <div className={styles.scenariosSection}>
        <div className={styles.scenariosHeader}>
          <h3 className={styles.scenariosLabel}>
            <Layers size={16} color="var(--color-violet-400)" />
            Escenarios de Arquitectura OCI Predefinidos
          </h3>
          <span className={styles.scenariosHelp}>O selecciona uno de los escenarios para cargar datos de prueba reales</span>
        </div>

        <div className={styles.scenariosGrid}>
          {SCENARIOS.map((sc) => {
            const isSelected = selectedScenario?.id === sc.id && !pdfBase64;

            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(sc)}
                className={`${styles.scenarioCard} ${isSelected ? styles.scenarioCardSelected : ''}`}
              >
                <div className={styles.scenarioTopRow}>
                  <span className={styles.nicheBadge}>
                    {sc.nicho}
                  </span>
                  {isSelected && (
                    <CheckCircle2 size={16} color="var(--color-violet-400)" />
                  )}
                </div>

                <div className={styles.scenarioTitle}>
                  {sc.titulo}
                </div>

                <div className={styles.scenarioSnippet}>
                  {sc.contenido}
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