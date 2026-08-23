import React, { useEffect, useMemo, useState } from 'react';
import { Bug, Copy, Trash2, Download, X } from 'lucide-react';
import { DebugLog } from '../hooks/debugLog.js';

function line(e) {
  if (!e || e.type === 'cleared') return '';
  return `${e.t} [${e.l.toUpperCase()}] [${e.tag}] ${e.msg}`;
}

export default function DebugPanel({ open, onClose }) {
  const [logs, setLogs] = useState(() => DebugLog.getLogs());

  useEffect(() => {
    DebugLog.enablePersist(true);
    setLogs(DebugLog.getLogs());
    return DebugLog.subscribe((entry) => {
      if (entry?.type === 'cleared') setLogs([]);
      else setLogs(DebugLog.getLogs());
    });
  }, []);

  const text = useMemo(() => logs.map(line).filter(Boolean).join('\n'), [logs]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      DebugLog.info('DEBUG', 'copied log to clipboard', `${logs.length} entries`);
    } catch (err) {
      DebugLog.error('DEBUG', 'copy failed', err);
    }
  };

  const download = () => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zping-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="Debug log">
      <div style={styles.panel}>
        <div style={styles.header}>
          <div style={styles.titleWrap}>
            <Bug size={15} color="var(--c-accent-cyan)" />
            <div>
              <p style={styles.title}>DEBUG LOG</p>
              <p style={styles.subtitle}>{logs.length} eventos capturados</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={styles.iconBtn} aria-label="Cerrar debug">
            <X size={14} />
          </button>
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={copy} style={styles.actionBtn}><Copy size={12} /> Copiar</button>
          <button type="button" onClick={download} style={styles.actionBtn}><Download size={12} /> Descargar</button>
          <button type="button" onClick={() => DebugLog.clear()} style={styles.dangerBtn}><Trash2 size={12} /> Limpiar</button>
        </div>

        <pre style={styles.logBox}>{text || 'Sin eventos todavía. Interactúa con la sala para generar logs.'}</pre>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '14px',
  },
  panel: {
    width: 'min(980px, 100%)',
    height: 'min(760px, 92dvh)',
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderBottom: '1px solid var(--c-border)',
    background: 'var(--c-bg-elevated)',
  },
  titleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: 'var(--c-accent-cyan)',
  },
  subtitle: {
    margin: '2px 0 0',
    fontSize: '0.64rem',
    color: 'var(--c-text-muted)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: '1px solid var(--c-border)',
    flexWrap: 'wrap',
  },
  actionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--c-bg-elevated)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text-primary)',
    borderRadius: 'var(--r-sm)',
    padding: '7px 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  dangerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255,77,109,0.10)',
    border: '1px solid rgba(255,77,109,0.32)',
    color: 'var(--c-error)',
    borderRadius: 'var(--r-sm)',
    padding: '7px 10px',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    cursor: 'pointer',
  },
  iconBtn: {
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text-secondary)',
    borderRadius: 'var(--r-sm)',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  logBox: {
    flex: 1,
    margin: 0,
    padding: '12px 14px',
    overflow: 'auto',
    background: '#05060A',
    color: '#D7E2F0',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.64rem',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
};
