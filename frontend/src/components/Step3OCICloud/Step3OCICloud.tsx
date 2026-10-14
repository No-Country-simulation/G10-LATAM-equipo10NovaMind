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

const ESTADO_OCI: Record<string, { texto: string; activo: boolean }> = {
  completado: { texto: 'Guardado en OCI', activo: true },
  pendiente: { texto: 'Guardando…', activo: false },
  error: { texto: 'No se pudo guardar', activo: false },
  omitido: { texto: 'No guardado en OCI', activo: false },
  local: { texto: 'Guardado en el servidor, no en OCI', activo: false },
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

  // Regla 1: sin dato del backend se muestra «N/D» o «sin auditar», nunca un valor de relleno.
  // Antes, un paquete sin evaluación mostraba un 98 % y «Sincronizado» con un ETag inventado.
  const evaluacion = contentPackage?.evaluacion_calidad;
  const almacenamiento = contentPackage?.almacenamiento_oci;
  const metadatos = contentPackage?.metadatos;

  const groundingScore = evaluacion?.anclaje_fuente_score;
  const isAudited = evaluacion?.auditoria_ejecutada !== false && typeof groundingScore === 'number';
  const groundingLabel = isAudited ? `${Math.round(groundingScore * 100)}%` : 'N/D';

  // Sin credenciales de OCI el backend guarda en su disco y responde «completado» con este bucket
  // (storage/local_storage.py): está guardado, pero no en OCI.
  const enDiscoLocal = almacenamiento?.status_upload === 'completado' && almacenamiento.bucket === BUCKET_LOCAL;
  const enOCI = almacenamiento?.status_upload === 'completado' && !enDiscoLocal;
  const estadoOCI = enDiscoLocal
    ? ESTADO_OCI.local
    : ESTADO_OCI[almacenamiento?.status_upload ?? 'omitido'] ?? ESTADO_OCI.omitido;

  return (
    <div className={styles.container}>
      {/* Top Banner */}
      {contentPackage.persistencia?.package_id && <p role="status">
        Contenido privado guardado en Supabase · {contentPackage.persistencia.package_id}.
        El almacenamiento OCI se informa por separado y requiere credenciales válidas.
      </p>}
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
              {isAudited ? 'Auditada' : 'Sin auditar'}
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
                  ? 'Proporción de afirmaciones del contenido que un auditor independiente encontró respaldadas en el documento.'
                  : 'La auditoría de fidelidad no se ejecutó para este paquete. Revisa las citas de cada estación.'}
              </p>
            </div>
          </div>

          {/* Tabla de Métricas de Calidad */}
          <div className={styles.auditDetailsGrid}>
            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Claridad Pedagógica</span>
              <span className={styles.metricTileValue}>{isAudited ? evaluacion?.claridad_pedagogica || 'N/D' : 'N/D'}</span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Chunks Procesados</span>
              <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                {evaluacion?.chunks_procesados ? `${evaluacion.chunks_procesados} fragmentos` : 'N/D'}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Similitud Coseno Media</span>
              <span className={styles.metricTileValue} style={{ color: 'var(--color-emerald-400)', fontFamily: 'var(--font-code)' }}>
                {evaluacion?.similitud_coseno_promedio || 'N/D'}
              </span>
            </div>

            <div className={styles.metricTile}>
              <span className={styles.metricTileLabel}>Modelo LLM</span>
              <span className={styles.metricTileValue} style={{ color: 'var(--color-violet-300)' }}>
                {metadatos?.modelo_llm || 'N/D'}
              </span>
            </div>
          </div>

          {/* Observaciones del Agente */}
          {evaluacion?.observaciones && (
            <div className={styles.agentObservationBox}>
              <strong>{isAudited ? 'Observación del auditor:' : 'Nota:'}</strong> {evaluacion.observaciones}
            </div>
          )}
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
            <div className={`${styles.syncPill} ${estadoOCI.activo ? '' : styles.syncPillInactivo}`} role="status">
              <span className={estadoOCI.activo ? styles.pulseCyanDot : styles.dotInactivo} />
              {estadoOCI.texto}
            </div>
          </div>

          <div className={styles.ociMetaStack}>
            {enOCI && almacenamiento?.bucket && (
              <div className={styles.ociHighlightBlock}>
                <span className={styles.ociBlockLabel}>Bucket</span>
                <div className={styles.ociBucketName}>{almacenamiento.bucket}</div>
              </div>
            )}

            {enOCI && almacenamiento?.objeto_id && (
              <div className={styles.ociHighlightBlock}>
                <span className={styles.ociBlockLabel}>Objeto guardado</span>
                <div className={styles.ociObjectId}>{almacenamiento.objeto_id}</div>
              </div>
            )}

            {!enOCI && (
              <p className={styles.ociNota}>
                {enDiscoLocal
                  ? 'El servidor no tiene credenciales de OCI y guardó una copia en su propio disco. Puedes descargar el paquete aquí.'
                  : almacenamiento?.status_upload === 'error'
                    ? 'El servidor intentó guardar el paquete en OCI y falló. El contenido sigue disponible aquí y puedes descargarlo.'
                    : 'Este paquete no se guardó en OCI (el servidor no tiene credenciales configuradas o es un paquete de ejemplo). Puedes descargarlo igualmente.'}
              </p>
            )}

            <div className={styles.auditDetailsGrid}>
              {enOCI && almacenamiento?.region && (
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>Región OCI</span>
                  <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                    {almacenamiento.region}
                  </span>
                </div>
              )}

              <div className={styles.metricTile}>
                <span className={styles.metricTileLabel}>Tamaño del paquete</span>
                <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                  {realBytesCount} bytes
                </span>
              </div>

              {enOCI && almacenamiento?.etag && (
                <div className={styles.metricTile}>
                  <span className={styles.metricTileLabel}>ETag</span>
                  <span className={styles.metricTileValue} style={{ fontFamily: 'var(--font-code)' }}>
                    {almacenamiento.etag}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.ociUrlDownloadRow}>
            <span className={styles.ociUrlText}>
              {enOCI && almacenamiento?.url_always_free ? almacenamiento.url_always_free : 'Descargar el paquete (JSON)'}
            </span>
            <button
              type="button"
              onClick={onDownloadJSON}
              title="Descargar el paquete (JSON)"
              aria-label="Descargar el paquete (JSON)"
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
