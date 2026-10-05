import React, { useEffect } from 'react';
import { X, Award, CheckCircle2, Sparkles, Flame, Shield, Calendar } from 'lucide-react';
import { Achievement } from '../../types';
import styles from './BadgeModal.module.css';

interface BadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  singleBadge?: Achievement | null;
  allBadges: Achievement[];
  xp: number;
  streakDays: number;
  onContinueQuest?: () => void;
}

export const BadgeModal: React.FC<BadgeModalProps> = ({
  isOpen,
  onClose,
  singleBadge,
  allBadges = [],
  xp,
  streakDays,
  onContinueQuest,
}) => {
  // Cierre accesible con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentLevel = Math.floor(xp / 100) + 1;
  const getRankTitle = (lvl: number) => {
    if (lvl >= 4) return 'Máster de Dominio Cognitivo';
    if (lvl === 3) return 'Especialista en Arquitectura';
    if (lvl === 2) return 'Explorador Técnico';
    return 'Iniciado en Infraestructura';
  };

  const unlockedCount = allBadges.filter((b) => b.desbloqueado).length;

  const handleContinue = () => {
    onClose();
    if (onContinueQuest) {
      onContinueQuest();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Botón de cierre */}
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        {singleBadge ? (
          /* Celebración de medalla individual recién desbloqueada */
          <div className={styles.celebrationWrapper}>
            <div className={styles.badgeIconContainer}>
              <span>{singleBadge.icono}</span>
              <Sparkles size={20} className={styles.sparkleDecor} />
            </div>

            <div>
              <div className={styles.unlockedSubheader}>¡Medalla Desbloqueada!</div>
              <h3 className={styles.badgeCelebrationTitle}>{singleBadge.titulo}</h3>
              <p className={styles.badgeCelebrationDescription}>
                {singleBadge.descripcion}
              </p>
            </div>

            <div className={styles.ociNotice}>
              <div className={styles.ociNoticeTitle}>
                <Shield size={14} />
                <span>Logro Registrado en Sesión</span>
              </div>
              <p className={styles.ociNoticeText}>
                Artefacto consolidado en el perfil pedagógico y listo para sincronización con el almacenamiento de OCI.
              </p>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className={styles.ctaContinueButton}
            >
              ¡Continuar Ruta Cognitiva!
            </button>
          </div>
        ) : (
          /* Vitrina completa de trofeos */
          <div className={styles.showcaseWrapper}>
            <div className={styles.showcaseHeader}>
              <div className={styles.showcaseTitleGroup}>
                <div className={styles.showcaseTrophyIconBox}>
                  <Award size={18} />
                </div>
                <div>
                  <h3 className={styles.showcaseTitle}>Vitrina de Trofeos & Medallas</h3>
                  <div className={styles.showcaseRank}>
                    Nivel {currentLevel} · {getRankTitle(currentLevel)}
                  </div>
                </div>
              </div>

              <span className={styles.showcaseStatsRatio}>
                {unlockedCount} / {allBadges.length} Obtenidas
              </span>
            </div>

            {/* Resumen de estadísticas del estudiante */}
            <div className={styles.playerSummaryGrid}>
              <div className={styles.summaryCard}>
                <Sparkles size={18} className={styles.summaryIconViolet} />
                <div>
                  <div className={styles.summaryLabel}>Experiencia Total</div>
                  <div className={styles.summaryValue}>{xp} XP</div>
                </div>
              </div>

              <div className={styles.summaryCard}>
                <Flame size={18} className={styles.summaryIconAmber} />
                <div>
                  <div className={styles.summaryLabel}>Racha de Estudio</div>
                  <div className={styles.summaryValue}>{streakDays} Días</div>
                </div>
              </div>
            </div>

            {/* Listado de todas las medallas */}
            <div className={styles.badgeList}>
              {allBadges.map((badge) => (
                <div
                  key={badge.id}
                  className={`${styles.badgeItem} ${
                    badge.desbloqueado ? styles.badgeItemUnlocked : styles.badgeItemLocked
                  }`}
                >
                  <div className={styles.badgeContentLeft}>
                    <div
                      className={`${styles.badgeItemIconBox} ${
                        badge.desbloqueado
                          ? styles.badgeItemIconBoxUnlocked
                          : styles.badgeItemIconBoxLocked
                      }`}
                    >
                      {badge.icono}
                    </div>

                    <div className={styles.badgeDetails}>
                      <div className={styles.badgeItemTitle}>{badge.titulo}</div>
                      <div className={styles.badgeItemDesc}>{badge.descripcion}</div>
                      {badge.desbloqueado && badge.fecha && (
                        <div className={styles.badgeItemDate}>
                          <Calendar size={12} />
                          <span>Obtenido en sesión</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.badgeItemStatus}>
                    {badge.desbloqueado ? (
                      <span className={styles.statusUnlockedTag}>
                        <CheckCircle2 size={14} /> Obtenida
                      </span>
                    ) : (
                      <span className={styles.statusLockedTag}>Bloqueada</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className={styles.closeSecondaryButton}
            >
              Cerrar Vitrina
            </button>
          </div>
        )}
      </div>
    </div>
  );
};