import { useState, type ChangeEvent, type FormEvent, type DragEvent } from 'react';
import {
  UploadCloud,
  Sparkles,
  Layers,
  Cpu,
  Database,
  CheckCircle2,
  ArrowRight,
  FileText,
  FileCode,
  File,
  Trash2,
  X,
} from 'lucide-react';
import type {
  RecipientProfile,
  OutputFormat,
  IndustryNiche,
  DetailLevel,
  TechnicalScenario,
} from '../../types/types';
import { SCENARIOS } from '../../data/mockScenarios';
import styles from './Step1Ingestion.module.css';

export interface IngestedFile {
  id: string;
  name: string;
  size: number;
  formattedSize: string;
  extension: string;
  isPdf: boolean;
  content?: string;
  base64?: string;
}

interface Step1Props {
  onStartPipeline: (
    title: string,
    content: string,
    profile: RecipientProfile,
    format: OutputFormat,
    niche: IndustryNiche,
    detail: DetailLevel,
    selectedScenarioId?: string,
    pdfBase64?: string | string[] | null,
  ) => void;
  isProcessing: boolean;
  processingStage: string;
}

export const Step1Ingestion = ({
  onStartPipeline,
  isProcessing,
  processingStage,
}: Step1Props) => {
  const [selectedScenario, setSelectedScenario] = useState<TechnicalScenario>(
    SCENARIOS[0],
  );
  const [docTitle, setDocTitle] = useState<string>(SCENARIOS[0].titulo);
  const [docContent, setDocContent] = useState<string>(SCENARIOS[0].contenido);
  const [profile, setProfile] = useState<RecipientProfile>('Principiante');
  const [format, setFormat] = useState<OutputFormat>(
    'Paquete Educativo Completo (5 Estaciones)',
  );
  const [niche, setNiche] = useState<IndustryNiche>('General');
  const [detail, setDetail] = useState<DetailLevel>('Didáctico');
  const [ingestedFiles, setIngestedFiles] = useState<IngestedFile[]>([]);
  const [pdfBase64, setPdfBase64] = useState<string | string[] | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const readTextFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const syncAggregatedState = (fileList: IngestedFile[]) => {
    if (fileList.length === 0) {
      setDocTitle(selectedScenario.titulo);
      setDocContent(selectedScenario.contenido);
      setPdfBase64(null);
      return;
    }

    // Auto-update title based on uploaded documents
    const cleanNames = fileList.map((f) => f.name.replace(/\.[^/.]+$/, ''));
    if (cleanNames.length === 1) {
      setDocTitle(cleanNames[0]);
    } else if (cleanNames.length <= 3) {
      setDocTitle(cleanNames.join(' + '));
    } else {
      setDocTitle(`${cleanNames[0]} (+${cleanNames.length - 1} documentos)`);
    }

    // Aggregate text contents with clear document headers
    const textParts = fileList
      .filter((f) => !f.isPdf && f.content)
      .map((f) => `--- DOCUMENTO: ${f.name} ---\n${f.content}`);

    const pdfFiles = fileList.filter((f) => f.isPdf);
    const pdfB64s = pdfFiles.map((f) => f.base64).filter(Boolean) as string[];

    let aggregated = '';
    if (textParts.length > 0) {
      aggregated += textParts.join('\n\n');
    }

    if (pdfFiles.length > 0) {
      const pdfNames = pdfFiles.map((f) => f.name).join(', ');
      if (aggregated) {
        aggregated += `\n\n[${pdfFiles.length} documento(s) PDF adjunto(s) (${pdfNames}) listos para análisis multimodal]`;
      } else {
        aggregated = `[${pdfFiles.length} documento(s) PDF cargado(s): ${pdfNames}. Gemini procesará el contenido multimodalmente de manera integral.]`;
      }
    }

    setDocContent(aggregated.trim());
    setPdfBase64(
      pdfB64s.length > 0 ? (pdfB64s.length === 1 ? pdfB64s[0] : pdfB64s) : null,
    );
  };

  const handleSelectScenario = (sc: TechnicalScenario) => {
    setSelectedScenario(sc);
    setDocTitle(sc.titulo);
    setDocContent(sc.contenido);
    setNiche(sc.nicho);
    setProfile(sc.perfilRecomendado);
    setIngestedFiles([]);
    setPdfBase64(null);
  };

  const handleFilesSelected = async (newFiles: FileList | File[]) => {
    if (!newFiles || newFiles.length === 0) return;

    const filesArray = Array.from(newFiles);
    const processedList: IngestedFile[] = [];

    for (const file of filesArray) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isPdf = ext === 'pdf';
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const formattedSize = formatFileSize(file.size);

      if (isPdf) {
        try {
          const base64 = await readFileAsBase64(file);
          processedList.push({
            id,
            name: file.name,
            size: file.size,
            formattedSize,
            extension: 'pdf',
            isPdf: true,
            base64,
          });
        } catch (err) {
          console.error(`Error procesando PDF ${file.name}:`, err);
        }
      } else {
        try {
          const content = await readTextFile(file);
          processedList.push({
            id,
            name: file.name,
            size: file.size,
            formattedSize,
            extension: ext || 'txt',
            isPdf: false,
            content,
          });
        } catch (err) {
          console.error(`Error procesando archivo de texto ${file.name}:`, err);
        }
      }
    }

    setIngestedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const filteredNew = processedList.filter(
        (f) => !existingKeys.has(`${f.name}-${f.size}`),
      );
      const nextList = [...prev, ...filteredNew];
      syncAggregatedState(nextList);
      return nextList;
    });
  };

  const handleRemoveFile = (fileId: string) => {
    setIngestedFiles((prev) => {
      const nextList = prev.filter((f) => f.id !== fileId);
      syncAggregatedState(nextList);
      return nextList;
    });
  };

  const handleClearAllFiles = () => {
    setIngestedFiles([]);
    syncAggregatedState([]);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const activeScenarioId =
      ingestedFiles.length > 0 ? undefined : selectedScenario.id;
    onStartPipeline(
      docTitle,
      docContent,
      profile,
      format,
      niche,
      detail,
      activeScenarioId,
      pdfBase64,
    );
  };

  const pdfCount = ingestedFiles.filter((f) => f.isPdf).length;
  const totalSizeBytes = ingestedFiles.reduce((acc, f) => acc + f.size, 0);

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
              Oracle Next Education · Hackathon ONE G10
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

      {/* Preset Scenarios Selector */}
      <div className={styles.scenariosSection}>
        <div className={styles.scenariosHeader}>
          <h3 className={styles.scenariosLabel}>
            <Layers size={16} color="var(--color-violet-400)" />
            Escenarios de Arquitectura OCI Predefinidos
          </h3>
          <span className={styles.scenariosHelp}>Selecciona para cargar datos de prueba reales</span>
        </div>

        <div className={styles.scenariosGrid}>
          {SCENARIOS.map((sc) => {
            const isSelected =
              selectedScenario.id === sc.id && ingestedFiles.length === 0;

            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleSelectScenario(sc)}
                className={`${styles.scenarioCard} ${isSelected ? styles.scenarioCardSelected : ''}`}
              >
                <div className={styles.scenarioTopRow}>
                  <span className={styles.nicheBadge}>{sc.nicho}</span>
                  {isSelected && (
                    <CheckCircle2 size={16} color="var(--color-violet-400)" />
                  )}
                </div>

                <div className={styles.scenarioTitle}>{sc.titulo}</div>

                <div className={styles.scenarioSnippet}>{sc.contenido}</div>
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
                Carga de Archivos (PDF, MD o TXT) — Soporta Carga Múltiple
              </label>
              <label
                className={`${styles.fileDropzone} ${isDragging ? styles.fileDropzoneActive : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <UploadCloud size={20} color="var(--color-violet-400)" />
                <div className={styles.fileText}>
                  {ingestedFiles.length > 0 ? (
                    <span>
                      <strong>+ Agregar más archivos</strong> (.pdf, .md, .txt)
                    </span>
                  ) : (
                    <span>
                      Haz clic o arrastra múltiples archivos (.pdf, .md, .txt)
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.md,.markdown,.txt,.json,.csv"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (e.target.files) {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Lista interactiva de archivos cargados */}
              {ingestedFiles.length > 0 && (
                <div className={styles.filesContainer}>
                  <div className={styles.filesHeader}>
                    <span className={styles.filesCountBadge}>
                      <Sparkles size={12} color="var(--color-violet-400)" />
                      {ingestedFiles.length}{' '}
                      {ingestedFiles.length === 1
                        ? 'archivo cargado'
                        : 'archivos cargados'}{' '}
                      ({formatFileSize(totalSizeBytes)})
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllFiles}
                      className={styles.clearAllBtn}
                      title="Quitar todos los archivos"
                    >
                      <Trash2 size={12} />
                      Limpiar todos
                    </button>
                  </div>

                  <div className={styles.fileListGrid}>
                    {ingestedFiles.map((file) => {
                      let cardClass = styles.fileCardTxt;
                      let badgeClass = styles.badgeTxt;
                      let IconComponent = File;
                      let badgeLabel = file.extension.toUpperCase();

                      if (file.isPdf) {
                        cardClass = styles.fileCardPdf;
                        badgeClass = styles.badgePdf;
                        IconComponent = FileText;
                        badgeLabel = 'PDF';
                      } else if (
                        file.extension === 'md' ||
                        file.extension === 'markdown'
                      ) {
                        cardClass = styles.fileCardMd;
                        badgeClass = styles.badgeMd;
                        IconComponent = FileCode;
                        badgeLabel = 'MD';
                      }

                      return (
                        <div
                          key={file.id}
                          className={`${styles.fileCard} ${cardClass}`}
                        >
                          <div className={styles.fileCardMain}>
                            <div className={styles.fileCardIcon}>
                              <IconComponent size={16} />
                            </div>
                            <div className={styles.fileCardInfo}>
                              <span
                                className={styles.fileCardName}
                                title={file.name}
                              >
                                {file.name}
                              </span>
                              <div className={styles.fileCardMeta}>
                                <span
                                  className={`${styles.fileTypeBadge} ${badgeClass}`}
                                >
                                  {badgeLabel}
                                </span>
                                <span>{file.formattedSize}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id)}
                            className={styles.fileCardRemove}
                            title={`Eliminar ${file.name}`}
                            aria-label={`Eliminar ${file.name}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Document Content Textarea */}
          <div className={styles.fieldGroup}>
            <label className={`${styles.fieldLabel} ${styles.fieldLabelRow}`}>
              <span>Cuerpo de la Documentación Técnica</span>
              {pdfCount > 0 && (
                <span className={styles.pdfNotice}>
                  ✓ {pdfCount} PDF{pdfCount > 1 ? 's' : ''} codificado
                  {pdfCount > 1 ? 's' : ''} en Base64 para Gemini Multimodal
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
                <option value="Desarrollador Junior">
                  Desarrollador Junior / Semi Senior
                </option>
                <option value="Líder Técnico / Arquitecto">
                  Líder Técnico / Arquitecto
                </option>
                <option value="Gestor / Ejecutivo (No Técnico)">
                  Gestor / Ejecutivo (No Técnico)
                </option>
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
                <option value="Paquete Educativo Completo (5 Estaciones)">
                  Paquete Completo (5 Estaciones)
                </option>
                <option value="Flashcards">Flashcards de Memorización</option>
                <option value="Tutorial">Guía Práctica Paso a Paso</option>
                <option value="Quiz Interactivo">
                  Quiz Interactivo con Justificaciones
                </option>
                <option value="Resumen Ejecutivo (TL;DR)">
                  Resumen Ejecutivo (TL;DR)
                </option>
                <option value="Guion de Clase / Video">
                  Guion de Clase / Video
                </option>
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
                <option value="Didáctico">
                  Didáctico (Metáforas y Analogías)
                </option>
                <option value="Técnico Profundo">
                  Técnico Profundo (Sintaxis y Flags)
                </option>
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
                <span>
                  Salida estructurada compatible con{' '}
                  <strong>OCI Object Storage</strong>
                </span>
              </div>

              <button type="submit" className={styles.submitButton}>
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