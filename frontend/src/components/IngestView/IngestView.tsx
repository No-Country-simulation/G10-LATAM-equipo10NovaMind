import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  Cloud,
  LockKeyhole,
  WandSparkles,
  ArrowRight,
  Zap,
  Check,
  Sliders,
} from 'lucide-react';
import { SelectField } from '../SelectField/SelectField'
import type { ConfigOpciones, AdaptarPayload } from '../../types/api';
import styles from './IngestView.module.css';

interface IngestViewProps {
  onGenerate: (payload: AdaptarPayload) => Promise<void> | void;
  config: ConfigOpciones;
}

const PHASES = [
  'Extrayendo documento e indexando vectores en ChromaDB',
  'Orquestando agentes LangGraph y generando contenido',
  'Agente Crítico auditando fidelidad de fuentes',
];

export const IngestView: React.FC<IngestViewProps> = ({ onGenerate, config }) => {
  const [textMode, setTextMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);

  // Archivo y texto real
  const [file, setFile] = useState<File | null>(null);
  const [textoDirecto, setTextoDirecto] = useState<string>(
    'La Virtual Cloud Network (VCN) es una red privada y personalizable configurada en Oracle Cloud Infrastructure que permite desplegar instancias y subredes seguras.'
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Parámetros de personalización
  const [perfil, setPerfil] = useState(config.perfiles_destinatario[0] || 'Principiante');
  const [formato, setFormato] = useState(config.formatos_salida[0] || 'Flashcards');
  const [nicho, setNicho] = useState(config.nichos_sector[0] || 'General');
  const [nivel, setNivel] = useState(config.niveles_detalle[0] || 'Didáctico');

  const handleFileSelected = (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setPhase(0);
    const interval = setInterval(() => {
      setPhase((prev) => (prev < PHASES.length - 1 ? prev + 1 : prev));
    }, 1500);

    try {
      const payload: AdaptarPayload = {
        archivo: textMode ? undefined : (file || undefined),
        texto_directo: textMode ? textoDirecto : (!file ? textoDirecto : undefined),
        titulo: file ? file.name.replace(/\.[^/.]+$/, '') : undefined,
        perfil_destinatario: perfil,
        formato_salida: formato,
        nicho_sector: nicho,
        nivel_detalle: nivel,
      };
      await onGenerate(payload);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className={styles.contentGrid}>
      <section className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PASO 01 / WORKSPACE</p>
          <h1 className={styles.headingTitle}>Configura tu aprendizaje</h1>
          <p className={styles.subheading}>
            Transforma documentación técnica compleja en contenido que tu equipo realmente entiende.
          </p>
        </div>
        <div className={styles.headingStat}>
          <Zap size={15} /> RAG listo para ingerir
        </div>
      </section>

      {/* Input de archivo real oculto */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.md,.markdown,.txt"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileSelected(e.target.files[0]);
          }
        }}
      />

      {/* Card: Ingesta de Documento */}
      <section className={styles.glassCard}>
        <div className={styles.cardHeading}>
          <div className={`${styles.iconBox} ${styles.purple}`}>
            <UploadCloud size={18} />
          </div>
          <div>
            <h2>Ingesta de conocimiento</h2>
            <p>Sube una fuente o pega el contenido directamente.</p>
          </div>
          <span className={styles.cardBadge}>PDF · MD · TXT</span>
        </div>

        {!textMode ? (
          <div
            className={styles.dropzone}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ cursor: 'pointer' }}
          >
            <div className={styles.uploadIcon}>
              <FileText size={24} />
            </div>
            <div>
              <p className={styles.dropTitle}>
                {file ? file.name : 'Haz clic o arrastra un archivo aquí'}
              </p>
              <p className={styles.dropMeta}>
                {file ? (
                  <>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB{' '}
                    <span className={styles.fileOk}>
                      <CheckCircle2 size={13} /> Archivo listo
                    </span>
                  </>
                ) : (
                  'Formatos soportados: PDF, Markdown (.md) y Texto (.txt)'
                )}
              </p>
            </div>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={(e) => {
                e.stopPropagation();
                setTextMode(true);
              }}
            >
              Pegar texto
            </button>
          </div>
        ) : (
          <div className={styles.textAreaWrap}>
            <textarea
              className={styles.textArea}
              placeholder="Pega aquí la documentación técnica que quieres adaptar (mínimo 40 caracteres)..."
              value={textoDirecto}
              onChange={(e) => setTextoDirecto(e.target.value)}
            />
            <button
              type="button"
              className={styles.textModeClose}
              onClick={() => setTextMode(false)}
            >
              <XCircle size={14} /> Volver a archivo
            </button>
          </div>
        )}

        <div className={styles.dropHint}>
          <Cloud size={14} /> Arrastra tu documento aquí o{' '}
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            explora tus archivos
          </button>
          <span>Máximo 25 MB</span>
        </div>
      </section>

      {/* Card: Parámetros de Personalización */}
      <section className={styles.glassCard}>
        <div className={styles.cardHeading}>
          <div className={`${styles.iconBox} ${styles.cyan}`}>
            <Sliders size={18} />
          </div>
          <div>
            <h2>Parámetros de personalización</h2>
            <p>El contenido se ajustará a tu audiencia y contexto.</p>
          </div>
          <span className={styles.requiredLabel}>4 campos requeridos</span>
        </div>

        <div className={styles.fieldsGrid}>
          <SelectField
            label="Perfil del destinatario"
            value={perfil}
            options={config.perfiles_destinatario}
            onChange={setPerfil}
          />
          <SelectField
            label="Formato pedagógico"
            value={formato}
            options={config.formatos_salida}
            onChange={setFormato}
          />
          <SelectField
            label="Nicho / contexto de aplicación"
            value={nicho}
            options={config.nichos_sector}
            onChange={setNicho}
          />
          <SelectField
            label="Nivel de detalle"
            value={nivel}
            options={config.niveles_detalle}
            onChange={setNivel}
          />
        </div>

        <div className={styles.formFooter}>
          <div className={styles.privacyNote}>
            <LockKeyhole size={14} /> Tus documentos se procesan de forma segura
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                {PHASES[Math.min(phase, PHASES.length - 1)]}
              </>
            ) : (
              <>
                <WandSparkles size={16} /> Generar contenido educativo
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

        {loading && (
          <div className={styles.loadingTrack}>
            <div className={styles.trackLine}>
              <span
                style={{
                  width: `${((phase + 1) / PHASES.length) * 100}%`,
                }}
              />
            </div>
            <div className={styles.loadingSteps}>
              {PHASES.map((item, index) => (
                <span
                  key={item}
                  className={`${styles.stepItem} ${phase >= index ? styles.on : ''}`}
                >
                  <span className={styles.stepCircle}>
                    {phase > index ? <Check size={10} /> : index + 1}
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};