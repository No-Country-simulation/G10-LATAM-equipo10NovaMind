import { useState, useEffect } from 'react';
import type { AudiovisualScene } from '../../../types/videoStudio';
import { CheckCircle2 } from 'lucide-react';
import styles from './graphics.module.css';

interface Props {
  scene: AudiovisualScene;
}

export const TerminalCodeGraphic = ({ scene }: Props) => {
  const fullCommand = scene.elementosGraficos.snippetCodigo?.comando || 'oci network vcn create --cidr-block "10.0.0.0/16" --display-name "VCN-Core"';
  const fullOutput = scene.elementosGraficos.snippetCodigo?.salida || 'VCN Provisioned · ID: ocid1.vcn.oc1..aaaa (Status: 200 OK)';

  const [typedText, setTypedText] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    setTypedText('');
    setShowOutput(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index <= fullCommand.length) {
        setTypedText(fullCommand.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setShowOutput(true);
        }, 300);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [fullCommand]);

  return (
    <div className={styles.graphicCanvas}>
      <div className={styles.gridBackground} />
      <div className={styles.ambientGlowCyan} />
      <div className={styles.ambientGlowViolet} />

      <div className={styles.terminalContainer}>
        <div className={styles.terminalHeader}>
          <div className={styles.terminalDots}>
            <div className={styles.dotRed} />
            <div className={styles.dotYellow} />
            <div className={styles.dotGreen} />
          </div>
          <div className={styles.terminalTitle}>OCI Cloud Shell · Bash Session</div>
          <span style={{ fontSize: '10px', color: '#10b981', fontFamily: 'var(--font-code)' }}>● Connected</span>
        </div>

        <div className={styles.terminalBody}>
          <div>
            <span className={styles.promptSymbol}>user@oci-shell:~$</span>
            <span className={styles.commandText}>{typedText}</span>
            {!showOutput && <span className={styles.cursorBlink} />}
          </div>

          {showOutput && (
            <div className={styles.outputLine}>
              <CheckCircle2 size={16} color="#34d399" />
              <span style={{ color: '#34d399' }}>{fullOutput}</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Metric Card */}
      {scene.elementosGraficos.metricaDestacada && (
        <div className={styles.metricCard}>
          <div>
            <div className={styles.metricValue}>
              {scene.elementosGraficos.metricaDestacada.valor}
            </div>
            <div className={styles.metricLabel}>
              {scene.elementosGraficos.metricaDestacada.etiqueta}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
