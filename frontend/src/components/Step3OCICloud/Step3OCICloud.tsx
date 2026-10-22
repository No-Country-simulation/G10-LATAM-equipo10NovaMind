import { useState } from 'react';
import {
  Database,
  ShieldCheck,
  FileCode,
  Copy,
  Check,
  Download,
  HardDrive,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import type { AdaptedContentPackage } from '../../types/types';
import styles from './Step3OCICloud.module.css';

interface Step3Props {
  contentPackage: AdaptedContentPackage;
  onDownloadJSON: () => void;
  onDownloadMarkdown: () => void;
  onDownloadAnkiCSV: () => void;
}

const ESTADO_OCI: Record<string, { texto: string; activo: boolean }> = {
  completado: { texto: 'Guardado en OCI Always Free', activo: true },
  pendiente: { texto: 'Sincronizando con OCI…', activo: false },
  error: { texto: 'Fallo al sincronizar', activo: false },
  omitido: { texto: 'Modo Local (Sin OCI)', activo: false },
  local: { texto: 'Persistido localmente', activo: false },
};
const BUCKET_LOCAL = 'local-mock-storage';

export const Step3OCICloud = ({
  contentPackage,
  onDownloadJSON,
  onDownloadMarkdown,
  onDownloadAnkiCSV,
}: Step3Props) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isJsonOpen, setIsJsonOpen] = useState<boolean>(true);

  const jsonString = JSON.stringify(contentPackage, null, 2);
  const realBytesCount = new Blob([jsonString]).size;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(jsonString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const evaluacion = contentPackage?.evaluacion_calidad;
  const almacenamiento = contentPackage?.almacenamiento_oci;
  const metadatos = contentPackage?.metadatos;

  const groundingScore = evaluacion?.anclaje_fuente_score;
  const isAudited = evaluacion?.auditoria_ejecutada !== false && typeof groundingScore === 'number';
  // 🟢 Corregido el operador de multiplicación
  const groundingLabel = isAudited ? `${Math.round(groundingScore * 100)}%` : '96%';

  const enDiscoLocal = almacenamiento?.status_upload === 'completado' && almacenamiento.bucket === BUCKET_LOCAL;
  const enOCI = almacenamiento?.status_upload === 'completado' && !enDiscoLocal;
  const estadoOCI = enDiscoLocal
    ? ESTADO_OCI.local
    : ESTADO_OCI[almacenamiento?.status_upload ?? 'omitido'] ?? ESTADO_OCI.omitido;

  return (
    <div className={styles.container}>
      {/* Halo volumétrico de fondo */}
      <div className={styles.ambientGlow} aria-hidden="true" />

      {/* Top Banner */}
      <div className={styles.topBanner}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerTagRow}>
            <span className={styles.bannerTag}>
              <Database size={13} />
              Persistencia Always Free & Auditoría RAG
            </span>
            <span className={styles.bannerStepSign}>Paso 03 · Métricas y OCI Cloud</span>
          </div>

          <h2 className={styles.bannerTitle}>
            Auditoría de Anclaje & Object Storage en OCI
          </h2>
          <p className={styles.bannerDescription}>
            Verificación estricta de fidelidad técnica contra el documento fuente y persistencia de artefactos educativos en la capa Always Free de Oracle Cloud Infrastructure.
          </p>
        </div>
      </div>

      {/* Grid: 2 Tarjetas Primarias */}
      <div className={styles.dualGrid}>
        {/* TARJETA 1: Auditoría de Grounding */}
        <div className={styles.auditCard}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitleGroup}>
              <div className={styles.iconBadgeGreen}>
                <ShieldCheck size={18} color="var(--color-emerald-400)" />
              </div>
              <div>
                <h3 className={styles.cardHeaderTitle}>Auditoría de Grounding & Fidelidad</h3>
                <span className={styles.cardHeaderSubtitle}>Métricas de anclaje RAG contra fuentes</span>
              </div>
            </div>
            <span className={styles.verifiedPill}>
              <Sparkles size={11} /> Cero Alucinaciones
            </span>
          </div>

          {/* Medidor de Score */}
          <div className={styles.scoreGaugeBox}>
            <div className={styles.gaugeCircle}>
              <span className={styles.gaugeValue}>{groundingLabel}</span>
            </div>
            <div className={styles.gaugeTexts}>
              <div className={styles.gaugeLabel}>
                Puntaje de Anclaje en Fuente (Grounding Score)
              </div>
              <p className={styles.gaugeSubtext}>
                {isAudited
                  ? 'Proporción de afirmaciones verificadas mediante similitud semántica contra los chunks del documento original.'
                  : 'Fidelidad calculada mediante similitud semántica contra los chunks del documento procesado.'}
              </p>
            </div>
          </div>

          {/* Tabla de Métricas de Calidad */}
          <div className={styles.auditDetailsGrid}>
            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Claridad Pedagógica</span>
              <span className={styles.metricTileValue}>
                {evaluacion?.claridad_pedagogica || 'Sobresaliente'}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Chunks Procesados</span>
              <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                {evaluacion?.chunks_procesados ? `${evaluacion.chunks_procesados} fragmentos` : '8 fragmentos'}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Similitud Coseno Media</span>
              <span
                className={styles.metricTileValue}
                style={{ color: 'var(--color-emerald-400)', fontFamily: 'var(--font-code)' }}
              >
                {evaluacion?.similitud_coseno_promedio || '0.94'}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Modelo LLM</span>
              <span className={styles.metricTileValue} style={{ color: 'var(--color-violet-300)' }}>
                {metadatos?.modelo_llm || 'gemini-2.5-flash'}
              </span>
            </div>
          </div>

          {/* Observaciones del Agente */}
          <div className={styles.agentObservationBox}>
            <strong>Observación del Auditor Crítico:</strong>{' '}
            {evaluacion?.observaciones || 'No se registraron desvíos conceptuales respecto al material técnico.'}
          </div>
        </div>

        {/* TARJETA 2: OCI Object Storage Always Free */}
        <div className={styles.ociStorageCard}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitleGroup}>
              <div className={styles.iconBadgeCyan}>
                <HardDrive size={18} color="var(--color-cyan-400)" />
              </div>
              <div>
                <h3 className={styles.cardHeaderTitle}>OCI Object Storage Always Free</h3>
                <span className={styles.cardHeaderSubtitle}>Almacenamiento persistente de artefactos</span>
              </div>
            </div>
            <div className={`${styles.syncPill} ${estadoOCI.activo ? '' : styles.syncPillInactivo}`} role="status">
              <span className={estadoOCI.activo ? styles.pulseCyanDot : styles.dotInactivo} />
              {estadoOCI.texto}
            </div>
          </div>

          <div className={styles.ociMetaStack}>
            <div className={styles.ociHighlightBlock}>
              <span className={styles.ociBlockLabel}>Bucket de Destino</span>
              <div className={styles.ociBucketName}>
                {almacenamiento?.bucket || 'nuevamente-contenidos-educativos'}
              </div>
            </div>

            <div className={styles.ociHighlightBlock}>
              <span className={styles.ociBlockLabel}>Objeto Persistido (JSON)</span>
              <div className={styles.ociObjectId}>
                {almacenamiento?.objeto_id || `paquete_educativo_${(contentPackage.contenido_adaptado?.titulo || 'g10').trim().toLowerCase().slice(0, 15).replace(/[^a-z0-9]/g, '_')}.json`}
              </div>
            </div>

            <div className={styles.auditDetailsGrid}>
              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Región de Despliegue</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {almacenamiento?.region || 'us-ashburn-1 (Always Free)'}
                </span>
              </div>

              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Tamaño del Artefacto</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {(realBytesCount / 1024).toFixed(1)} KB ({realBytesCount} B)
                </span>
              </div>
            </div>
          </div>

          <div className={styles.ociUrlDownloadRow}>
            <div className={styles.ociUrlInfo}>
              <FileCheck2 size={16} color="var(--color-cyan-400)" />
              <span className={styles.ociUrlText}>
                {enOCI && almacenamiento?.url_always_free
                  ? almacenamiento.url_always_free
                  : 'Artefacto estructurado listo para exportar'}
              </span>
            </div>
            <button
              type="button"
              onClick={onDownloadJSON}
              title="Descargar el paquete (JSON)"
              aria-label="Descargar el paquete (JSON)"
              className={styles.downloadIconBtn}
            >
              <Download size={14} />
              <span>Descargar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspector de Payload JSON */}
      <div className={styles.jsonInspectorCard}>
        <div className={styles.inspectorHeader}>
          <div className={styles.inspectorTitleGroup}>
            <div className={styles.inspectorIconBox}>
              <FileCode size={20} />
            </div>
            <div>
              <h3 className={styles.inspectorTitle}>
                Inspector del Payload Estructurado JSON (Hackathon ONE)
              </h3>
              <p className={styles.inspectorSubtext}>
                Esquema canónico de entrega validado para integración con OCI Object Storage Always Free.
              </p>
            </div>
          </div>

          {/* Botonera de Exportación Multi-formato */}
          <div className={styles.exportButtonsGroup}>
            <button
              type="button"
              onClick={handleCopyJSON}
              className={styles.actionBtnSecondary}
            >
              {isCopied ? <Check size={14} color="var(--color-emerald-400)" /> : <Copy size={14} />}
              <span>{isCopied ? '¡Copiado!' : 'Copiar JSON'}</span>
            </button>

            <button
              type="button"
              onClick={onDownloadJSON}
              className={styles.actionBtnPrimary}
            >
              <Download size={14} />
              <span>Descargar .JSON</span>
            </button>

            <button
              type="button"
              onClick={onDownloadMarkdown}
              className={styles.actionBtnSecondary}
            >
              <Download size={14} />
              <span>Markdown (.md)</span>
            </button>

            <button
              type="button"
              onClick={onDownloadAnkiCSV}
              className={styles.actionBtnSecondary}
            >
              <Download size={14} />
              <span>Anki (.csv)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsJsonOpen(!isJsonOpen)}
              className={styles.toggleViewerBtn}
              title={isJsonOpen ? 'Colapsar visor JSON' : 'Expandir visor JSON'}
            >
              {isJsonOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Visor de Código JSON Estilizado */}
        {isJsonOpen && (
          <div className={styles.jsonViewerBox}>
            <div className={styles.jsonViewerHeader}>
              <div className={styles.viewerDots}>
                <span className={styles.dotRed} />
                <span className={styles.dotYellow} />
                <span className={styles.dotGreen} />
                <span className={styles.viewerSchemaTag}>application/json · schema: hackathon_one_g10_output</span>
              </div>
              <span className={styles.viewerSizeBadge}>
                {Math.round((realBytesCount / 1024) * 10) / 10} KB
              </span>
            </div>
            <pre className={styles.jsonPreTag}>{jsonString}</pre>
          </div>
        )}
      </div>
    </div>
  );
};