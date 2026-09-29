import React from 'react';
import { Play } from 'lucide-react';
import type { ScriptItem } from '../../../types/api';
import styles from './ScriptViewer.module.css';

interface ScriptViewerProps {
  items?: ScriptItem[];
  title?: string;
}

const DEFAULT_SCENES: ScriptItem[] = [
  {
    time: '00:00 — 01:00',
    title: 'Contexto e Introducción',
    narracion:
      'Imagina que tu equipo necesita una red privada y segura dentro de Oracle Cloud Infrastructure.',
    visual: 'Diagrama de una VCN con subredes y gateways en OCI.',
  },
  {
    time: '01:00 — 03:30',
    title: 'Conceptos clave y segmentación',
    narracion:
      'Dentro de la VCN divides el espacio en subredes públicas y privadas para aislar servicios.',
    visual: 'Animación de flujo de tráfico ingress y egress en tiempo real.',
  },
  {
    time: '03:30 — 05:00',
    title: 'Cierre y mejores prácticas',
    narracion:
      'Las reglas de seguridad y listas de acceso son las guardianas de tu arquitectura en la nube.',
    visual: 'Checklist final de seguridad y persistencia OCI Object Storage.',
  },
];

export const ScriptViewer: React.FC<ScriptViewerProps> = ({
  items,
  title = 'GUION EDUCATIVO · REDES PRIVADAS VCN',
}) => {
  const sceneList = (items && items.length > 0) ? items : DEFAULT_SCENES;

  return (
    <div className={styles.script}>
      <div className={styles.surfaceTop}>
        <span>{title}</span>
        <span className={styles.sourceAnchor}>
          <Play size={12} /> ESCENAS: {sceneList.length}
        </span>
      </div>

      {sceneList.map((item, index) => {
        const timeDisplay =
          item.time ||
          item.tiempo_estimado ||
          (item.minuto_aproximado !== undefined
            ? `Minuto ${item.minuto_aproximado}`
            : `0${index}:00 — 0${index + 1}:00`);

        const sceneTitle = item.title || item.titulo || `Escena ${index + 1}`;
        const narrationText = item.narracion || item.que_se_dice || '';
        const visualText = item.apoyo_visual_sugerido || item.visual || item.que_se_ve || 'Esquema didáctico en pantalla';

        return (
          <div className={styles.scriptRow} key={`${index}-${timeDisplay}`}>
            <div className={styles.scriptTime}>
              <span>
                <span className={styles.pulseDot} />
                {timeDisplay}
              </span>
              <b>{sceneTitle}</b>
            </div>

            <div className={styles.scriptCol}>
              <span>LOCUCIÓN / SCRIPT</span>
              <p>{narrationText}</p>
            </div>

            <div className={styles.scriptCol}>
              <span>APOYO VISUAL SUGERIDO</span>
              <p>{visualText}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};