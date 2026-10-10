import { useState, useEffect } from 'react';
import type { DirectorScene, AdaptedContentPackage } from '../../types/types';
import type { AudiovisualStoryboard } from '../../types/videoStudio';
import { generateAudiovisualStoryboard } from '../../utils/videoStudioGenerator';
import { videoExporter } from '../../utils/videoExporter';
import { VideoPlayer } from './VideoPlayer';
import { X, Sparkles, Download, Film, Loader2 } from 'lucide-react';
import styles from './VideoStudio.module.css';

interface VideoStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  directorScenes: DirectorScene[];
  packageData: AdaptedContentPackage;
}

export const VideoStudioModal = ({
  isOpen,
  onClose,
  directorScenes,
  packageData,
}: VideoStudioModalProps) => {
  const [storyboard, setStoryboard] = useState<AudiovisualStoryboard | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Al abrir el modal, generar directamente el storyboard audiovisual basado en el contenido
  useEffect(() => {
    if (isOpen && directorScenes.length > 0) {
      let isCurrent = true;
      generateAudiovisualStoryboard(directorScenes, packageData, {
        escenasSeleccionadasIds: directorScenes.map((s) => s.id),
        ritmoPedagogico: 'natural',
        idioma: 'es-LATAM',
        vozSeleccionadaUri: '',
        estiloVisual: 'tecnologico',
        incluirSubtitulos: true,
        velocidadLocucion: 1.0,
        efectosSonido: true,
      }).then((sb) => {
        if (isCurrent) {
          setStoryboard(sb);
        }
      });
      return () => {
        isCurrent = false;
      };
    } else if (!isOpen) {
      setStoryboard(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickDownload = async () => {
    if (!storyboard || isExporting) return;
    setIsExporting(true);
    setExportProgress(10);

    try {
      const result = await videoExporter.exportStoryboardToVideo(
        storyboard,
        '',
        (p) => {
          setExportProgress(p.porcentaje);
        }
      );

      // Descarga automática
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Error en exportación rápida:', err);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header simple y limpio */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerBadgeRow}>
              <span className={styles.studioBadge}>
                <Sparkles size={12} color="#f0abfc" />
                Microclase Audiovisual
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                · Duración ajustada al contenido ({storyboard?.duracionTotalEstimada || 0}s)
              </span>
            </div>
            <h2 className={styles.modalTitle}>
              <Film size={20} color="#8b5cf6" />
              {packageData.contenido_adaptado?.titulo || 'Microclase Didáctica'}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleQuickDownload}
              disabled={isExporting || !storyboard}
              className={styles.secondaryActionBtn}
              title="Descargar video"
            >
              {isExporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Exportando ({exportProgress}%)...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Descargar Video</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              title="Cerrar reproductor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Reproductor de Video Central Directo con Controles Clásicos */}
        <div className={styles.modalBody} style={{ padding: '1rem', alignItems: 'center' }}>
          {storyboard ? (
            <div style={{ width: '100%', maxWidth: '1000px' }}>
              <VideoPlayer storyboard={storyboard} autoPlay={false} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem', color: '#cbd5e1' }}>
              <Loader2 size={32} color="#8b5cf6" className="animate-spin" />
              <span>Preparando microclase audiovisual...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
