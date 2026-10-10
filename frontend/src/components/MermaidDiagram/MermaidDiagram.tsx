import React, { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  GitFork,
  Code2,
  Copy,
  Check,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import styles from './MermaidDiagram.module.css';

interface MermaidDiagramProps {
  chart?: string;
  title?: string;
}

// Configuración global singleton de Mermaid para tema oscuro
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  themeVariables: {
    darkMode: true,
    background: '#090d16',
    primaryColor: '#4f46e5',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#6366f1',
    lineColor: '#38bdf8',
    secondaryColor: '#0284c7',
    tertiaryColor: '#1e293b',
    edgeLabelBackground: '#0f172a',
    nodeTextColor: '#f8fafc',
  },
});

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  title = 'Diagrama de Arquitectura y Flujo Técnico',
}) => {
  const rawId = useId();
  const safeId = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCode, setShowCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Fallback si no viene chart o viene vacío
  const cleanChart = (chart || '').trim() || `flowchart TD
    A[Fuente de Datos / PDF] --> B[Pipeline NovaMind]
    B --> C[Adaptación Pedagógica]
    C --> D[Estudiante / Destinatario]`;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setRenderError(null);

    const renderChart = async () => {
      try {
        // Limpiar sintaxis innecesaria como backticks markdown si vinieran incluidos
        let code = cleanChart;
        if (code.startsWith('```mermaid')) {
          code = code.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '');
        } else if (code.startsWith('```')) {
          code = code.replace(/^```\s*/, '').replace(/```\s*$/, '');
        }
        code = code.trim();

        const { svg } = await mermaid.render(`${safeId}-svg`, code);
        if (isMounted) {
          setSvgHtml(svg);
          setRenderError(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn('[MermaidDiagram] Fallo de renderizado SVG:', err);
        if (isMounted) {
          setRenderError(err?.message || 'Error al procesar la sintaxis Mermaid.');
          setIsLoading(false);
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
      // Ignorar si clipboard falla
    }
  };

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
            Mermaid.js Interactivo
          </span>
        </div>

        <div className={styles.headerActions}>
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
        <div
          ref={containerRef}
          className={styles.chartContainer}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      )}
    </div>
  );
};
