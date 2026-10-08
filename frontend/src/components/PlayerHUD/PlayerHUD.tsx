import React from 'react';
import { Flame, Shield, Award } from 'lucide-react';
import styles from './PlayerHUD.module.css';

interface PlayerHUDProps {
  xp: number;
  streakDays: number;
  cognitiveShields: number;
  maxShields?: number;
  completedStationsCount: number;
  totalStations?: number;
  onOpenAchievements: () => void;
  recentXpGain: number | null;
  unlockedBadgesCount: number;
  totalBadgesCount?: number;
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({
  xp,
  streakDays,
  cognitiveShields,
  maxShields = 3,
  completedStationsCount,
  totalStations = 5,
  onOpenAchievements,
  recentXpGain,
  unlockedBadgesCount,
  totalBadgesCount = 4,
}) => {
  const completionPercentage = Math.round((completedStationsCount / totalStations) * 100);
  const currentLevel = Math.floor(xp / 100) + 1;
  const isDanger = cognitiveShields <= 1;

  return (
    <div className={styles.hudWrapper}>
      <div className={styles.container}>
        {/* Lado Izquierdo: Nivel, XP, Racha y Escudos */}
        <div className={styles.statsGroup}>
          {/* Nivel & XP */}
          <div className={styles.xpBadge}>
            <span className={styles.levelTag}>L{currentLevel}</span>
            <div className={styles.xpValues}>
              <span className={styles.xpNumber}>{xp}</span>
              <span className={styles.xpUnit}>XP</span>
            </div>

            {recentXpGain && (
              <span className={styles.floatingXp}>+{recentXpGain} XP</span>
            )}
          </div>

          {/* Racha */}
          <div className={styles.streakBadge}>
            <Flame className={styles.flameIcon} />
            <span className={styles.streakLabel}>
              Racha: <strong className={styles.streakDays}>{streakDays}d</strong>
            </span>
          </div>

          {/* Escudos Cognitivos */}
          <div className={`${styles.shieldsBadge} ${isDanger ? styles.shieldsBadgeDanger : ''}`}>
            <span className={styles.shieldsLabel}>Escudos:</span>
            <div className={styles.shieldList}>
              {Array.from({ length: maxShields }).map((_, i) => {
                const isActive = i < cognitiveShields;

                let iconClass = styles.shieldInactive;
                if (isActive) {
                  iconClass = isDanger ? styles.shieldActiveDanger : styles.shieldActive;
                }

                return (
                  <Shield
                    key={i}
                    className={`${styles.shieldIcon} ${iconClass}`}
                  />
                );
              })}
            </div>
            <span className={`${styles.shieldRatio} ${isDanger ? styles.shieldRatioDanger : ''}`}>
              {cognitiveShields}/{maxShields}
            </span>
          </div>
        </div>

        {/* Lado Derecho: Progreso de Estaciones & Trofeos MDA */}
        <div className={styles.actionGroup}>
          <div className={styles.progressContainer}>
            <span className={styles.progressLabel}>Progreso:</span>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className={styles.progressPercentage}>
              {completionPercentage}%
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenAchievements}
            className={styles.trophiesButton}
            title="Abrir Vitrina de Trofeos MDA"
          >
            <Award size={16} />
            <span>Trofeos MDA</span>
            <span className={styles.trophyCount}>
              {unlockedBadgesCount} / {totalBadgesCount}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};