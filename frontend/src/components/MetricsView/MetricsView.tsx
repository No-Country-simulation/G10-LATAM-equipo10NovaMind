import React, { useState } from 'react';
import {
  Cloud,
  Code2,
  Check,
  Copy,
  Download,
  CheckCircle2,
  ArrowLeft,
  LockKeyhole,
} from 'lucide-react';
import type { RespuestaAdaptacion } from '../../types/api';
import styles from './MetricsView.module.css';

interface MetricsViewProps {
  data: RespuestaAdaptacion;
  onBack: () => void;
}

export const MetricsView: React.FC<MetricsViewProps> = ({ data, onBack }) => {
  const [copied, setCopied] = useState(false);

  const payloadString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard?.writeText(payloadString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([payloadString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = data.almacenamiento_oci.objeto_id || 'contenido-educativo-oci.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const fidelityPercentage = Math.round(data.evaluacion_calidad.anclaje_fuente_score * 100);

  return (
    <div className={styles.contentGrid}>
      <section className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PASO 03 / EVALUATOR & CLOUD VIEW</p>
          <h1 className={styles.headingTitle}>Auditoría y persistencia</h1>
          <p className={styles.subheading}>
            Trazabilidad completa desde los chunks originales hasta OCI Object Storage.
          </p>
        </div>
        <div className={styles.liveBadgeGreen}>
          OCI OBJECT STORAGE · ALWAYS FREE
        </div>
      </section>

      <div className={styles.metricsGrid}>
        {/* Columna Izquierda: OCI Object Storage & Fidelidad RAG */}
        <section className={styles.glassCard}>
          <div className={styles.cardHeading}>
            <div className={`${styles.iconBox} ${styles.orange}`}>
              <Cloud size={18} />
            </div>
            <div>
              <h2>OCI Object Storage</h2>
              <p>Persistencia del paquete educativo</p>
            </div>
            <span className={styles.statusPill}>
              {data.almacenamiento_oci.status_upload.toUpperCase()}
            </span>
          </div>

          <div className={styles.gaugeWrap}>
            <div className={styles.gauge}>
              <div>
                <strong>{fidelityPercentage}%</strong>
                <span>FIDELITY</span>
              </div>
            </div>
            <div className={styles.gaugeInfo}>
              <h3>Zero Hallucination</h3>
              <p>{data.evaluacion_calidad.observaciones}</p>
              <small>6 chunks anclados · Claridad: {data.evaluacion_calidad.claridad_pedagogica}</small>
            </div>
          </div>

          <div className={styles.ociDetails}>
            <div className={styles.detailRow}>
              <span>BUCKET DE DESTINO</span>
              <b>{data.almacenamiento_oci.bucket}</b>
            </div>
            <div className={styles.detailRow}>
              <span>OBJECT ID GENERADO</span>
              <b>{data.almacenamiento_oci.objeto_id}</b>
            </div>
            <div className={styles.detailRow}>
              <span>REGIÓN DE DESPLIEGUE</span>
              <b>
                us-ashburn-1 <em>(OCI Always Free Tier)</em>
              </b>
            </div>
            <div className={styles.detailRow}>
              <span>COSTO ESTIMADO</span>
              <b className={styles.greenText}>
                $ 0.00 USD <em>(Always Free)</em>
              </b>
            </div>
          </div>
        </section>

        {/* Columna Derecha: Visor JSON Estructurado */}
        <section className={styles.glassCard}>
          <div className={styles.cardHeading}>
            <div className={`${styles.iconBox} ${styles.blue}`}>
              <Code2 size={18} />
            </div>
            <div>
              <h2>Estructura JSON final</h2>
              <p>Payload validado listo para integración externa</p>
            </div>
            <div className={styles.codeActions}>
              <button
                type="button"
                className={styles.codeButton}
                onClick={handleCopy}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                type="button"
                className={styles.codeButton}
                onClick={handleDownload}
              >
                <Download size={13} /> Descargar
              </button>
            </div>
          </div>

          <pre className={styles.jsonPre}>
            <code>{payloadString}</code>
          </pre>

          <div className={styles.jsonFooter}>
            <span>
              <CheckCircle2 size={14} /> Schema Pydantic validado
            </span>
            <span>RespuestaAdaptacion · v2.0</span>
          </div>
        </section>
      </div>

      <div className={styles.bottomActions}>
        <button type="button" className={styles.secondaryButton} onClick={onBack}>
          <ArrowLeft size={15} /> Regresar al visor
        </button>
        <span className={styles.auditNote}>
          <LockKeyhole size={13} /> Auditoría verificable · NuevaMente
        </span>
      </div>
    </div>
  );
};