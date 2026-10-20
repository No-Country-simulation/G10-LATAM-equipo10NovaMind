import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Zap,
  ShieldAlert,
  Rocket,
  Globe,
  Sparkles,
  Award,
  ArrowRight,
} from "lucide-react";
import type { ResumenNinjaData } from "../../../types/types";
import { triggerLevelUpConfetti } from "../../../utils/confetti";
import { MermaidDiagram } from "../../MermaidDiagram/MermaidDiagram";
import { FuenteChip } from "../../RecursoEstado/RecursoEstado";
import styles from "./Station1ResumenNinja.module.css";

interface Station1Props {
  data: ResumenNinjaData;
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenNinjaBadge: () => void;
  diagramaMermaid?: string;
  onNextStation?: () => void;
  /** Resumen ejecutivo inyectado desde Step2KnowledgeQuest */
  resumen?: React.ReactNode;
}

export const Station1ResumenNinja: React.FC<Station1Props> = ({
  data,
  isCompleted,
  onCompleteStation,
  onOpenNinjaBadge,
  diagramaMermaid,
  onNextStation,
  resumen,
}) => {
  const [prevData, setPrevData] = useState(data);
  const [checkedConcepts, setCheckedConcepts] = useState<
    Record<string, boolean>
  >({});

  if (data !== prevData) {
    setPrevData(data);
    setCheckedConcepts({});
  }

  const conceptos = data?.conceptos_clave || [];
  const totalConcepts = conceptos.length;

  const toggleConcept = (id: string) => {
    setCheckedConcepts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkedCount = Object.values(checkedConcepts).filter(Boolean).length;
  // Validación estricta del 100% de conceptos asimilados
  const isAllChecked = totalConcepts > 0 && checkedCount === totalConcepts;

  const handleAssimilation = () => {
    if (isCompleted) {
      triggerLevelUpConfetti();
      onOpenNinjaBadge();
      return;
    }

    if (!isAllChecked) return;

    onCompleteStation(50);
    triggerLevelUpConfetti();
    onOpenNinjaBadge();
  };

  return (
    <div className={styles.stationWrapper}>
      {/* Banner Superior con badge didáctico */}
      <div className={styles.topBanner}>
        {/* Escenografía lumínica y sinapsis de fondo a la derecha */}
        <div className={styles.bannerBackdropGlow} aria-hidden="true" />
<div className={styles.neuralArtBox} aria-hidden="true">
  <svg viewBox="0 0 240 240" className={styles.neuralSvg}>
    <defs>
      <radialGradient id="neuralCoreGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.75" />
        <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
        <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
      </linearGradient>
    </defs>

    {/* Núcleo radiante con respiración */}
    <circle cx="120" cy="120" r="105" fill="url(#neuralCoreGlow)" className={styles.pulsingCore} />

    {/* Órbita exterior punteada con rotación lenta */}
    <circle cx="120" cy="120" r="88" fill="none" stroke="rgba(139, 92, 246, 0.35)" strokeWidth="1.2" strokeDasharray="5 7" className={styles.orbitSpinSlow} />

    {/* Órbita 3D elíptica inclinada (efecto giroscópico) */}
    <ellipse cx="120" cy="120" rx="80" ry="32" fill="none" stroke="url(#orbitGrad)" strokeWidth="1.6" className={styles.orbitSpinReverse} />

    {/* Anillo interior cerrado */}
    <circle cx="120" cy="120" r="48" fill="none" stroke="rgba(56, 189, 248, 0.45)" strokeWidth="1.5" />

    {/* Centro de fusión cuántica */}
    <circle cx="120" cy="120" r="14" fill="#8b5cf6" className={styles.pulsingNode} />
    <circle cx="120" cy="120" r="6" fill="#ffffff" />

    {/* Satélites orbitales con luz propia */}
    <circle cx="168" cy="120" r="5" fill="#38bdf8" className={styles.satelliteCyan} />
    <circle cx="72" cy="120" r="4" fill="#a855f7" className={styles.satelliteViolet} />
    <g className={styles.greenOrbitGroup}>
  <circle cx="120" cy="32" r="4.5" fill="#34d399" className={styles.satelliteGreen} />
</g>
  </svg>
</div>

        <div className={styles.bannerContent}>
          <div className={styles.bannerInfo}>
            <div className={styles.badgeRow}>
              <span className={styles.stationTag}>
                Estación 01 · Intuición Inicial
              </span>
              {isCompleted && (
                <span className={styles.completedTag}>
                  <CheckCircle2 size={13} /> Dominada (+50 XP)
                </span>
              )}
            </div>

            <h3 className={styles.bannerTitle}>
              {data?.titulo || "Síntesis Conceptual"}
            </h3>
            <p className={styles.bannerDescription}>
              {data?.analogia_central ||
                "Analiza los principios rectores extraídos del material técnico."}
            </p>
          </div>
        </div>
      </div>

      {/* Sección Resumen: un solo contenedor elegante (CERO caja dentro de caja) */}
      {resumen && <div className={styles.resumenSectionWrapper}>{resumen}</div>}

      {/* Puntos Clave para Validación */}
      <div className={styles.conceptsCard}>
        <div className={styles.conceptsHeader}>
          <h4 className={styles.conceptsSubtitle}>
            <Sparkles size={16} color="var(--color-violet-400)" />
            Puntos Clave para Validación Rápida
          </h4>
          <span
            className={`${styles.conceptsRatio} ${
              isAllChecked ? styles.conceptsRatioAllChecked : ""
            }`}
          >
            {checkedCount}/{totalConcepts} Asimilados
          </span>
        </div>

        <div className={styles.conceptsList}>
          {conceptos.map((item, idx) => {
            const conceptId = item.id || `concept-${idx}`;
            const isChecked = !!checkedConcepts[conceptId];

            return (
              <div key={conceptId} className={styles.conceptRow}>
                <button
                  type="button"
                  onClick={() => toggleConcept(conceptId)}
                  className={`${styles.conceptItem} ${
                    isChecked ? styles.conceptItemChecked : ""
                  } ${item.fuente ? styles.conceptItemConFuente : ""}`}
                >
                  <div className={styles.checkboxIcon}>
                    {isChecked ? (
                      <CheckCircle2
                        size={20}
                        color="var(--color-emerald-400)"
                      />
                    ) : (
                      <Circle size={20} color="var(--color-text-subtle)" />
                    )}
                  </div>
                  <div className={styles.conceptContent}>
                    <div className={styles.conceptNumber}>
                      Concepto 0{idx + 1}
                    </div>
                    <p
                      className={`${styles.conceptText} ${
                        isChecked ? styles.conceptTextChecked : ""
                      }`}
                    >
                      {item.texto}
                    </p>
                    {item.explicacion && (
                      <p className={styles.conceptExplanation}>
                        {item.explicacion}
                      </p>
                    )}
                  </div>
                </button>
                {item.fuente && (
                  <div className={styles.conceptFuente}>
                    <FuenteChip fuente={item.fuente} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid de Métricas Técnicas */}
      {data?.metricas_rapidas && (
        <div className={styles.metricsGrid}>
          <div className={styles.metricBox}>
            <div className={styles.metricHeader}>
              <ShieldAlert size={16} color="var(--color-rose-400)" />
              <span className={styles.metricLabel}>Riesgo / Desafío</span>
            </div>
            <div className={styles.metricValue}>
              {data.metricas_rapidas.riesgo || "—"}
            </div>
          </div>

          <div className={styles.metricBox}>
            <div className={styles.metricHeader}>
              <Rocket size={16} color="var(--color-cyan-400)" />
              <span className={styles.metricLabel}>Despliegue</span>
            </div>
            <div className={styles.metricValue}>
              {data.metricas_rapidas.despliegue || "—"}
            </div>
          </div>

          <div className={styles.metricBox}>
            <div className={styles.metricHeader}>
              <Globe size={16} color="var(--color-amber-400)" />
              <span className={styles.metricLabel}>Entorno / Tipo</span>
            </div>
            <div className={styles.metricValue}>
              {data.metricas_rapidas.tipo_oci || "—"}
            </div>
          </div>

          <div className={styles.metricBox}>
            <div className={styles.metricHeader}>
              <Sparkles size={16} color="var(--color-emerald-400)" />
              <span className={styles.metricLabel}>Costo / Capa</span>
            </div>
            <div
              className={`${styles.metricValue} ${styles.metricValueEmerald}`}
            >
              {data.metricas_rapidas.costo || "—"}
            </div>
          </div>
        </div>
      )}

      {/* Diagrama Mermaid */}
      {diagramaMermaid?.trim() && (
        <MermaidDiagram
          chart={diagramaMermaid}
          title="Diagrama de Arquitectura y Flujo del Documento"
        />
      )}

      {/* CTA de Asimilación */}
      <div className={styles.assimilationBar}>
        <div>
          <div className={styles.assimilationTitle}>
            {isCompleted
              ? "¡Estación Dominada con Éxito!"
              : "¿Has interiorizado la intuición básica?"}
          </div>
          <div className={styles.assimilationSub}>
            {isCompleted
              ? "Has completado la asimilación y reclamado la Medalla Ninja."
              : isAllChecked
                ? "¡Excelente! Todos los puntos validados. Ya puedes asimilar y reclamar tu medalla."
                : `Marca todos los conceptos clave (${checkedCount}/${totalConcepts}) para asimilar y ganar XP.`}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAssimilation}
          disabled={!isCompleted && !isAllChecked}
          className={`${styles.assimilationButton} ${
            isCompleted
              ? styles.buttonCompleted
              : isAllChecked
                ? styles.buttonReady
                : styles.buttonDisabled
          }`}
        >
          {isCompleted ? (
            <>
              <Award size={16} color="var(--color-amber-400)" />
              <span>Ver Medalla Ninja Desbloqueada</span>
            </>
          ) : (
            <>
              <Zap
                size={16}
                color={isAllChecked ? "#fde047" : "var(--color-text-subtle)"}
                fill={isAllChecked ? "#fde047" : "none"}
              />
              <span>
                {isAllChecked
                  ? "Asimilar Conceptos (+50 XP)"
                  : `Asimilar (${checkedCount}/${totalConcepts})`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Botón de Siguiente Estación */}
      {onNextStation && (
        <div className={styles.stationNextFooter}>
          <button
            type="button"
            onClick={onNextStation}
            className={styles.nextStationBtn}
          >
            <span>Siguiente Estación: Tarjetas didácticas</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
