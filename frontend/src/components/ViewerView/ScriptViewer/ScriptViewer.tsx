import React from 'react';
import { Play } from 'lucide-react';
import styles from './ScriptViewer.module.css';

interface Scene {
  tiempo: string;
  titulo: string;
  locucion: string;
  visual: string;
}

const DEFAULT_SCENES: Scene[] = [
  {
    tiempo: '00:00 — 01:00',
    titulo: 'Introducción & Analogía',
    locucion: 'Imagina que tu empresa necesita una oficina privada en la nube. Esa oficina es tu Virtual Cloud Network.',
    visual: 'Esquema animado de una VCN aislada con un límite punteado en OCI.',
  },
  {
    tiempo: '01:00 — 03:30',
    titulo: 'Segmentación y Guardias',
    locucion: 'Dentro de la oficina dividimos recepción (subred pública) de bóvedas (subred privada), controladas por Security Lists.',
    visual: 'Demostración de paquetes de datos filtrados por reglas de entrada y salida.',
  },
  {
    tiempo: '03:30 — 05:00',
    titulo: 'Cierre y Checklist',
    locucion: 'Con el Internet Gateway activo, solo las aplicaciones públicas interactúan con el exterior de forma segura.',
    visual: 'Resumen en pantalla de los 3 pasos clave de configuración.',
  },
];

export const ScriptViewer: React.FC = () => {
  return (
    <div className={styles.scriptWrap}>
      <div className={styles.surfaceTop}>
        <span>GUION EDUCATIVO PARA CLASE / VIDEO</span>
        <span className={styles.sourceAnchor}>
          <Play size={13} /> DURACIÓN ESTIMADA: 5 MIN
        </span>
      </div>

      <div className={styles.timeline}>
        {DEFAULT_SCENES.map((scene) => (
          <div key={scene.tiempo} className={styles.sceneCard}>
            <div className={styles.timeBlock}>
              <span className={styles.timeTag}>
                <span className={styles.pulseDot} />
                {scene.tiempo}
              </span>
              <b>{scene.titulo}</b>
            </div>

            <div className={styles.columnBlock}>
              <span>LOCUCIÓN / GUION</span>
              <p>{scene.locucion}</p>
            </div>

            <div className={styles.columnBlock}>
              <span>APOYO VISUAL SUGERIDO</span>
              <p>{scene.visual}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};