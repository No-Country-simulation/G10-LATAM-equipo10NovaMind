import React, { useState } from 'react';
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
import type { ConfigOpciones } from '../../types/api';
import styles from './IngestView.module.css';

interface IngestViewProps {
  onGenerate: () => void;
  config: ConfigOpciones;
}

const PHASES = [
  'Extrayendo documento e indexando vectores',
  'Orquestando agentes LangGraph',
  'Agente Crítico auditando fuentes',
];

export const IngestView: React.FC<IngestViewProps> = ({ onGenerate, config }) => {
  const [textMode, setTextMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);

  // Parámetros de personalización
  const [perfil, setPerfil] = useState(config.perfiles_destinatario[0] || 'Principiante');
  const [formato, setFormato] = useState(config.formatos_salida[0] || 'Flashcards');
  const [nicho, setNicho] = useState(config.nichos_sector[0] || 'General');
  const [nivel, setNivel] = useState(config.niveles_detalle[0] || 'Didáctico');

  const handleGenerate = () => {
    setLoading(true);
    let currentP = 0;
    const interval = setInterval(() => {
      currentP += 1;
      setPhase(currentP);
      if (currentP === PHASES.length) {
        clearInterval(interval);
        setTimeout(onGenerate, 500);
      }
    }, 850);
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
          <div className={styles.dropzone}>
            <div className={styles.uploadIcon}>
              <FileText size={24} />
            </div>
            <div>
              <p className={styles.dropTitle}>Arquitectura_VCN_OCI.pdf</p>
              <p className={styles.dropMeta}>
                1.4 MB{' '}
                <span className={styles.fileOk}>
                  <CheckCircle2 size={13} /> Archivo listo
                </span>
              </p>
            </div>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setTextMode(true)}
            >
              Pegar texto
            </button>
          </div>
        ) : (
          <div className={styles.textAreaWrap}>
            <textarea
              className={styles.textArea}
              placeholder="Pega aquí la documentación técnica que quieres adaptar..."
              defaultValue="La Virtual Cloud Network (VCN) es una red privada y personalizable configurada en Oracle Cloud Infrastructure."
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
          <button type="button" onClick={() => setTextMode(false)}>
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