import React from 'react';
import { Mic, Volume2, RefreshCw } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDeviceLabel(device, fallbackIndex) {
  const label = device?.label?.trim();
  if (label) {
    // Los labels suelen venir como "Nombre (Hardware)": limpiar sufijos comunes
    return label.replace(/\s*\(.*?\)\s*$/g, '').trim() || label;
  }
  return `Dispositivo ${fallbackIndex}`;
}

function supportsAudioOutput() {
  if (typeof document === 'undefined') return false;
  const test = document.createElement('audio');
  return typeof test.setSinkId === 'function';
}

// ─── Select estilizado ────────────────────────────────────────────────────────
function DeviceSelect({ icon, label, devices, selectedId, onChange, disabled }) {
  const options = devices.map((d, i) => ({
    value: d.deviceId,
    label: getDeviceLabel(d, i + 1),
  }));

  // Si el deviceId seleccionado no está en la lista (ej. dispositivo desconectado),
  // añadimos una opción fantasma para que el <select> no se quede en vacío.
  if (selectedId && !options.some((o) => o.value === selectedId)) {
    options.unshift({ value: selectedId, label: '(Dispositivo no disponible)' });
  }

  return (
    <div style={ds.fieldRow}>
      <div style={ds.fieldIcon}>{icon}</div>
      <div style={ds.fieldContent}>
        <label style={ds.fieldLabel} className="font-mono">
          {label}
        </label>
        <select
          value={selectedId}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || options.length === 0}
          style={ds.select}
          className="font-mono"
        >
          <option value="">
            {options.length === 0 ? 'Sin dispositivos' : 'Por defecto (Windows)'}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── DeviceSelector ───────────────────────────────────────────────────────────
export default function DeviceSelector({
  audioInputs = [],
  audioOutputs = [],
  selectedMicId = '',
  selectedOutputId = '',
  onMicChange,
  onOutputChange,
  onRefresh,
}) {
  const canSetOutput = supportsAudioOutput();

  return (
    <section
      className="rounded-md border border-white/10 bg-z-base/70 p-3 shadow-inner shadow-black/30"
      style={ds.section}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-z-cyan-bright">
          DISPOSITIVOS
        </p>
        <button
          type="button"
          onClick={onRefresh}
          style={ds.refreshBtn}
          aria-label="Actualizar dispositivos"
          title="Actualizar lista de dispositivos"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      <div style={ds.fieldList}>
        <DeviceSelect
          icon={<Mic size={13} color="var(--c-accent-cyan)" />}
          label="MICRÓFONO"
          devices={audioInputs}
          selectedId={selectedMicId}
          onChange={onMicChange}
        />

        {canSetOutput && (
          <DeviceSelect
            icon={<Volume2 size={13} color="var(--c-accent-cyan)" />}
            label="SALIDA DE AUDIO"
            devices={audioOutputs}
            selectedId={selectedOutputId}
            onChange={onOutputChange}
          />
        )}

        {!canSetOutput && (
          <p style={ds.compatibilityNote} className="font-mono">
            La selección de salida no está disponible en este navegador.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const ds = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  refreshBtn: {
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm)',
    width: '26px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--c-text-secondary)',
    transition: 'color 150ms ease, border-color 150ms ease',
    flexShrink: 0,
  },
  fieldList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  },
  fieldIcon: {
    paddingTop: '18px',
    flexShrink: 0,
  },
  fieldContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: '0.56rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--c-text-muted)',
    textTransform: 'uppercase',
    paddingLeft: '2px',
  },
  select: {
    width: '100%',
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--c-text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    padding: '7px 28px 7px 10px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'><path d='M1 1l4 4 4-4' stroke='%238B91A7' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    transition: 'border-color 150ms ease',
  },
  compatibilityNote: {
    fontSize: '0.6rem',
    color: 'var(--c-text-muted)',
    lineHeight: 1.5,
    letterSpacing: '0.06em',
    padding: '4px 2px',
  },
};
