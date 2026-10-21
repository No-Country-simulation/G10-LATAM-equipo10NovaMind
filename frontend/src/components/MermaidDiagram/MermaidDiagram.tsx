import React, { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  GitFork,
  Code2,
  Copy,
  Check,
  Eye,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  // RotateCcw,
  // Maximize2,
} from 'lucide-react';
import styles from './MermaidDiagram.module.css';

interface MermaidDiagramProps {
  chart?: string;
  title?: string;
}

// Configuración de Mermaid con tokens de arquitectura moderna / Dark Luxury
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  themeVariables: {
    darkMode: true,
    background: 'transparent',
    mainBkg: '#0e1422',
    nodeBorder: '#38bdf8',
    primaryColor: '#0e172a',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: 'rgba(56, 189, 248, 0.4)',
    lineColor: '#38bdf8',
    secondaryColor: '#1e1b4b',
    tertiaryColor: '#0f172a',
    edgeLabelBackground: '#0b0f19',
    clusterBkg: 'rgba(15, 23, 42, 0.65)',
    clusterBorder: 'rgba(56, 189, 248, 0.25)',
    titleColor: '#38bdf8',
    nodeTextColor: '#f8fafc',
  },
  themeCSS: `
    .node rect, .node circle, .node polygon {
      stroke-width: 1.5px !important;
      rx: 8px !important;
      ry: 8px !important;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.6));
    }
    .edgePath .path {
      stroke: #38bdf8 !important;
      stroke-width: 1.8px !important;
      filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.4));
    }
    .edgeLabel rect {
      fill: #060911 !important;
      stroke: rgba(255, 255, 255, 0.12) !important;
      rx: 4px !important;
      ry: 4px !important;
    }
    .edgeLabel span {
      color: #94a3b8 !important;
      font-size: 11px !important;
      font-weight: 600 !important;
    }
    .label text {
      fill: #f1f5f9 !important;
      font-weight: 600 !important;
      font-size: 13px !important;
    }
    .cluster rect {
      stroke-dasharray: 4 4 !important;
      rx: 12px !important;
    }
  `,
});

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  title = 'Diagrama de Arquitectura y Flujo Técnico',
}) => {
  const rawId = useId();
  const safeId = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [resultado, setResultado] = useState<{ chart: string; svg: string; error: string | null }>({
    chart: '',
    svg: '',
    error: null,
  });
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const cleanChart = (chart || '').trim();
  const isLoading = resultado.chart !== cleanChart;
  const svgHtml = isLoading ? '' : resultado.svg;
  const renderError = isLoading ? null : resultado.error;

  useEffect(() => {
    let isMounted = true;
    if (!cleanChart) return;

    const renderChart = async () => {
      try {
       let code = cleanChart;
        if (code.startsWith('```mermaid')) {
          code = code.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '');
        } else if (code.startsWith('```')) {
          code = code.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        code = code.trim();

        // 🟢 FORZAR ORIENTACIÓN HORIZONTAL (LR) PARA APROVECHAR EL ANCHO PANORÁMICO
        // Reemplaza graph TD, graph TB, flowchart TD, flowchart TB por LR
        code = code.replace(/^(graph|flowchart)\s+(TD|TB)/im, '$1 LR');

        const { svg } = await mermaid.render(`${safeId}-svg`, code);
        if (isMounted) setResultado({ chart: cleanChart, svg, error: null });
      } catch (err: unknown) {
        console.warn('[MermaidDiagram] Fallo de renderizado SVG:', err);
        if (isMounted) {
          setResultado({
            chart: cleanChart,
            svg: '',
            error: (err instanceof Error && err.message) || 'Error al procesar la sintaxis Mermaid.',
          });
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [cleanChart, safeId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignorar fallback
    }
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 2));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  if (!cleanChart) return null;

  return (
    <div className={styles.mermaidCard}>
      <div className={styles.cardHeader}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.iconBox}>
            <GitFork size={18} />
          </div>
          <div>
            <h4 className={styles.titleText}>{title}</h4>
          </div>
          <span className={styles.badgeLive}>
            <span className={styles.pulseDot} />
            Arquitectura Dinámica
          </span>
        </div>

        <div className={styles.headerActions}>
          {/* Controles de Zoom */}
          {!showCode && !renderError && (
            <div className={styles.zoomControlsGroup}>
              <button
                type="button"
                onClick={handleZoomOut}
                className={styles.toolBtn}
                title="Reducir zoom"
                aria-label="Reducir zoom"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className={styles.zoomResetBtn}
                title="Restablecer tamaño (100%)"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className={styles.toolBtn}
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className={`${styles.actionBtn} ${showCode ? styles.actionBtnActive : ''}`}
            title="Alternar vista entre Gráfico y Código Fuente"
          >
            {showCode ? <Eye size={14} /> : <Code2 size={14} />}
            <span>{showCode ? 'Ver Gráfico' : 'Ver Código'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={styles.actionBtn}
            title="Copiar definición Mermaid al portapapeles"
          >
            {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
            <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {showCode ? (
        <pre className={styles.codeContainer}>
          <code>{cleanChart}</code>
        </pre>
      ) : isLoading ? (
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <span>Renderizando diagrama de arquitectura...</span>
        </div>
      ) : renderError ? (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={16} />
            <span>Sintaxis no renderizable directamente por Mermaid en el navegador:</span>
          </div>
          <pre className={styles.codeContainer}>
            <code>{cleanChart}</code>
          </pre>
        </div>
      ) : (
        <div className={styles.canvasViewport}>
          <div
            ref={containerRef}
            className={styles.chartContainer}
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top center',
            }}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>
      )}
    </div>
  );
};