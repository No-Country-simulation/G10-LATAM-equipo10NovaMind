import React, { useState } from "react";
import {
  BookOpen,
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
import styles from "./Station1ResumenNinja.module.css";

interface Station1Props {
  data: ResumenNinjaData;
  isCompleted: boolean;
  onCompleteStation: (xp: number) => void;
  onOpenNinjaBadge: () => void;
  diagramaMermaid?: string;
  onNextStation?: () => void;
}

export const Station1ResumenNinja: React.FC<Station1Props> = ({
  data,
  isCompleted,
  onCompleteStation,
  onOpenNinjaBadge,
  diagramaMermaid,
  onNextStation,
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

  const toggleConcept = (id: string) => {
    setCheckedConcepts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkedCount = Object.values(checkedConcepts).filter(Boolean).length;
  const allChecked = conceptos.length > 0 && checkedCount === conceptos.length;

  const handleAssimilation = () => {
    if (isCompleted) {
      triggerLevelUpConfetti();
      onOpenNinjaBadge();
      return;
    }

    if (!allChecked) return;

    onCompleteStation(50);
    triggerLevelUpConfetti();
    onOpenNinjaBadge();
  };

  return (
    <div className={styles.stationWrapper}>
      {/* Banner Superior con badge didáctico */}
      <div className={styles.topBanner}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerInfo}>
            <div className={styles.badgeRow}>
              <span className={styles.stationTag}>
                <Zap size={12} color="#fbbf24" />
                Estación 01 · Intuición Inicial
              </span>
              {isCompleted && (
                <span className={styles.completedTag}>
                  <CheckCircle2 size={14} /> Dominada (+50 XP)
                </span>
              )}
            </div>

            <h3 className={styles.bannerTitle}>
              {data?.titulo || "Resumen Conceptual"}
            </h3>
            <p className={styles.bannerDescription}>
              {data?.analogia_central ||
                "Analiza los principios rectores extraídos del material técnico."}
            </p>
          </div>

          {/* Insignia orientativa de lectura */}
          <div className={styles.microReadingBadge}>
            <div className={styles.bookIconBox}>
              <BookOpen size={16} />
            </div>
            <div>
              <div className={styles.microReadingLabel}>Microlectura</div>
              <div className={styles.microReadingEstimate}>~1 min estimado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Puntos Clave para Validación */}
      <div className={styles.conceptsCard}>
        <div className={styles.conceptsHeader}>
          <h4 className={styles.conceptsSubtitle}>
            <Sparkles size={16} color="var(--color-violet-400)" />
            Puntos Clave para Validación Rápida
          </h4>
          <span
            className={`${styles.conceptsRatio} ${
              allChecked ? styles.conceptsRatioAllChecked : ""
            }`}
          >
            {checkedCount}/{conceptos.length} Asimilados
          </span>
        </div>

        <div className={styles.conceptsList}>
          {conceptos.map((item, idx) => {
            const conceptId = item.id || `concept-${idx}`;
            const isChecked = !!checkedConcepts[conceptId];

            return (
              <button
                key={conceptId}
                type="button"
                onClick={() => toggleConcept(conceptId)}
                className={`${styles.conceptItem} ${
                  isChecked ? styles.conceptItemChecked : ""
                }`}
              >
                <div className={styles.checkboxIcon}>
                  {isChecked ? (
                    <CheckCircle2 size={20} color="var(--color-emerald-400)" />
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
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Métricas Técnicas */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricBox}>
          <div className={styles.metricHeader}>
            <ShieldAlert size={16} color="var(--color-rose-400)" />
            <span className={styles.metricLabel}>Riesgo / Desafío</span>
          </div>
          <div className={styles.metricValue}>
            {data?.metricas_rapidas?.riesgo || "Evaluado"}
          </div>
        </div>

        <div className={styles.metricBox}>
          <div className={styles.metricHeader}>
            <Rocket size={16} color="var(--color-cyan-400)" />
            <span className={styles.metricLabel}>Despliegue</span>
          </div>
          <div className={styles.metricValue}>
            {data?.metricas_rapidas?.despliegue || "Inmediato"}
          </div>
        </div>

        <div className={styles.metricBox}>
          <div className={styles.metricHeader}>
            <Globe size={16} color="var(--color-amber-400)" />
            <span className={styles.metricLabel}>Entorno / Tipo</span>
          </div>
          <div className={styles.metricValue}>
            {data?.metricas_rapidas?.tipo_oci || "Cloud Native"}
          </div>
        </div>

        <div className={styles.metricBox}>
          <div className={styles.metricHeader}>
            <Sparkles size={16} color="var(--color-emerald-400)" />
            <span className={styles.metricLabel}>Costo / Capa</span>
          </div>
          <div className={`${styles.metricValue} ${styles.metricValueEmerald}`}>
            {data?.metricas_rapidas?.costo || "Always Free"}
          </div>
        </div>
      </div>

      {/* Diagrama de Arquitectura y Flujo Mermaid */}
      <MermaidDiagram
        chart={diagramaMermaid}
        title="Diagrama de Arquitectura y Flujo del Documento"
      />

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
              : allChecked
                ? "¡Excelente! Todos los puntos validados. Ya puedes asimilar y reclamar tu medalla."
                : `Marca todos los conceptos clave (${checkedCount}/${conceptos.length}) para asimilar y ganar XP.`}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAssimilation}
          disabled={!isCompleted && !allChecked}
          className={`${styles.assimilationButton} ${
            isCompleted
              ? styles.buttonCompleted
              : allChecked
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
                color={allChecked ? "#fde047" : "var(--color-text-subtle)"}
                fill={allChecked ? "#fde047" : "none"}
              />
              <span>
                {allChecked
                  ? "Asimilar Conceptos (+50 XP)"
                  : `Asimilar (${checkedCount}/${conceptos.length})`}
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
            <span>Siguiente Estación: Flashcard Quest</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

