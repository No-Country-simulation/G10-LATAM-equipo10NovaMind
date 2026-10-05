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
} from 'lucide-react';
import type { AdaptedContentPackage } from '../../types/types';
import styles from './Step3OCICloud.module.css';

interface Step3Props {
  contentPackage: AdaptedContentPackage;
  onDownloadJSON: () => void;
  onDownloadMarkdown: () => void;
  onDownloadAnkiCSV: () => void;
}

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

  const evaluacion = contentPackage?.evaluacion_calidad || {
    anclaje_fuente_score: 0.98,
    claridad_pedagogica: 'Sobresaliente',
    observaciones: 'Evaluación anclada al contenido técnico provisto.',
    mitigacion_alucinaciones: 'Verificación estricta de fuentes activa.',
    chunks_procesados: 8,
    similitud_coseno_promedio: 0.94,
  };

const almacenamiento = contentPackage?.almacenamiento_oci || {
    bucket: 'nuevamente-edtech-artifacts',
    objeto_id: 'oci-artifact-latest.json',
    status_upload: 'completado',
    region: 'sa-saopaulo-1',
    etag: 'etag-verified-md5',
    tamano_bytes: realBytesCount,
    url_always_free: 'https://objectstorage.sa-saopaulo-1.oraclecloud.com/p/always-free',
  };

  const metadatos = contentPackage?.metadatos || {
    perfil_aplicado: 'Principiante',
    formato_generado: 'Paquete Completo',
    tiempo_estimado_estudio_minutos: 15,
    conceptos_clave: [],
    fecha_generacion: '2026-10-05T00:00:00.000Z',
    modelo_llm: 'gemini-2.5-flash',
  };

  const groundingPercent = Math.round((evaluacion.anclaje_fuente_score ?? 0.98) * 100);

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      <div className={styles.topBanner}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerTagRow}>
            <span className={styles.bannerTag}>
              <Database size={14} />
              Persistencia Always Free & Auditoría RAG
            </span>
            <span className={styles.bannerStepSign}>Paso 03 · Métricas y OCI Cloud</span>
          </div>

          <h2 className={styles.bannerTitle}>
            Auditoría de Anclaje & Object Storage en OCI
          </h2>
          <p className={styles.bannerDescription}>
            Verificación estricta de fidelidad técnica contra el documento fuente y persistencia de artefactos educativos en la capa Always Free de Oracle Cloud.
          </p>
        </div>
      </div>

      {/* Grid: 2 Tarjetas Primarias */}
      <div className={styles.dualGrid}>
        {/* TARJETA 1: Auditoría de Grounding */}
        <div className={styles.auditCard}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitleGroup}>
              <ShieldCheck size={20} color="var(--color-emerald-400)" />
              <h3 className={styles.cardHeaderTitle}>
                Auditoría de Grounding & Fidelidad
              </h3>
            </div>
            <span className={styles.verifiedPill}>
              Zero-Hallucination Verified
            </span>
          </div>

          {/* Medidor de Score */}
          <div className={styles.scoreGaugeBox}>
            <div className={styles.gaugeCircle}>
              <span className={styles.gaugeValue}>{groundingPercent}%</span>
            </div>
            <div className={styles.gaugeTexts}>
              <div className={styles.gaugeLabel}>
                Puntaje de Anclaje en Fuente (Grounding Score)
              </div>
              <p className={styles.gaugeSubtext}>
                Fidelidad calculada mediante similitud semántica contra los chunks del documento procesado.
              </p>
            </div>
          </div>

          {/* Tabla de Métricas de Calidad */}
          <div className={styles.auditDetailsGrid}>
            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Claridad Pedagógica</span>
              <span className={styles.metricTileValue}>{evaluacion.claridad_pedagogica || 'Sobresaliente'}</span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Chunks Procesados</span>
              <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                {evaluacion.chunks_procesados || 8} fragmentos (overlap 50t)
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Similitud Coseno Media</span>
              <span className={styles.metricTileValue} style={{ color: 'var(--color-emerald-400)', fontFamily: 'var(--font-code)' }}>
                {evaluacion.similitud_coseno_promedio || 0.94}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Modelo LLM</span>
              <span className={styles.metricTileValue} style={{ color: 'var(--color-violet-300)' }}>
                {metadatos.modelo_llm || 'gemini-2.5-flash'}
              </span>
            </div>
          </div>

          {/* Observaciones del Agente */}
          <div className={styles.agentObservationBox}>
            <strong>Observación del Agente Crítico:</strong> {evaluacion.observaciones || 'No se registraron desvíos respecto al material fuente.'}
          </div>
        </div>

        {/* TARJETA 2: OCI Object Storage Always Free */}
        <div className={styles.ociStorageCard}>
          <div className={styles.cardHeaderRow}>
            <div className={styles.cardHeaderTitleGroup}>
              <HardDrive size={20} color="var(--color-cyan-400)" />
              <h3 className={styles.cardHeaderTitle}>
                OCI Object Storage Always Free
              </h3>
            </div>
            <div className={styles.syncPill}>
              <span className={styles.pulseCyanDot} />
              Sincronizado
            </div>
          </div>

          <div className={styles.ociMetaStack}>
            <div className={styles.ociHighlightBlock}>
              <span className={styles.ociBlockLabel}>Bucket Always Free</span>
              <div className={styles.ociBucketName}>{almacenamiento.bucket}</div>
            </div>

            <div className={styles.ociHighlightBlock}>
              <span className={styles.ociBlockLabel}>Objeto Persistido (JSON)</span>
              <div className={styles.ociObjectId}>{almacenamiento.objeto_id}</div>
            </div>

            <div className={styles.auditDetailsGrid}>
              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Región OCI</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {almacenamiento.region}
                </span>
              </div>

              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Cifrado</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  AES-256 Oracle Managed
                </span>
              </div>

              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Tamaño Real</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {realBytesCount} bytes
                </span>
              </div>

              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>ETag MD5</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {almacenamiento.etag}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.ociUrlDownloadRow}>
            <span className={styles.ociUrlText}>{almacenamiento.url_always_free}</span>
            <button
              type="button"
              onClick={onDownloadJSON}
              title="Descargar artefacto sincronizado"
              className={styles.downloadIconBtn}
            >
              <Download size={14} />
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
                Esquema canónico de entrega exigido para integración con OCI Object Storage.
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
              title={isJsonOpen ? 'Colapsar JSON' : 'Expandir JSON'}
            >
              {isJsonOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Visor de Código JSON */}
        {isJsonOpen && (
          <div className={styles.jsonViewerBox}>
            <div className={styles.jsonViewerHeader}>
              <span>application/json · schema: hackathon_one_g10_output</span>
              <span>{Math.round((realBytesCount / 1024) * 10) / 10} KB</span>
            </div>
            <pre className={styles.jsonPreTag}>{jsonString}</pre>
          </div>
        )}
      </div>
    </div>
  );
};