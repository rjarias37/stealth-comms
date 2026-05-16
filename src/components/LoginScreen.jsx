import React, { useEffect, useId, useState } from 'react';

// ─── Constantes de sanitización (espejo del backend) ────────────────────────
const NICKNAME_MAX_LEN = 32;
const NICKNAME_RE      = /^[A-Za-z0-9_\-\. ]+$/;

function sanitizeNickname(raw) {
  if (typeof raw !== 'string') return '';
  // Recortar, limitar longitud y eliminar caracteres no permitidos
  return raw
    .trim()
    .slice(0, NICKNAME_MAX_LEN)
    .replace(/[^A-Za-z0-9_\-\. ]/g, '');
}

export default function LoginScreen({
  onConnect,
  isLoading = false,
  errorMessage = '',
  activeCanal = 'ALFA',
}) {
  const [nickname, setNickname]           = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [validationErr, setValidationErr]   = useState('');
  const inputId = useId();

  // ─── PWA install prompt ─────────────────────────────────────────────────
  useEffect(() => {
    const onPrompt    = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const onInstalled = ()  => setDeferredPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const cleaned = sanitizeNickname(e.target.value);
    setNickname(cleaned);
    if (validationErr) setValidationErr('');
  };

  const handleConnect = (e) => {
    e.preventDefault();
    if (isLoading) return;
    const cleaned = sanitizeNickname(nickname);
    if (!cleaned) {
      setValidationErr('Ingresa un identificador operativo.');
      return;
    }
    if (!NICKNAME_RE.test(cleaned)) {
      setValidationErr('Solo se permiten letras, números, guiones y espacios.');
      return;
    }
    onConnect({ nickname: cleaned });
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const displayError = validationErr || errorMessage;

  return (
    <div style={styles.root}>
      {/* Ruido de fondo decorativo */}
      <div style={styles.noise} aria-hidden="true" />

      <main style={styles.card} className="animate-slide-up card-tactical">
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src="/logo-tren.png"
            alt="Stealth Comms"
            style={styles.logo}
            fetchpriority="high"
            decoding="async"
          />
          <div style={styles.logoGlow} aria-hidden="true" />
        </div>

        {/* Título */}
        <div style={styles.titleBlock}>
          <h1 style={styles.title} className="font-mono">STEALTH COMMS</h1>
          <p style={styles.subtitle}>TACTICAL COMMUNICATIONS NETWORK</p>
        </div>

        {/* Canal activo */}
        <div style={styles.canalBadge} aria-label={`Canal activo: ${activeCanal}`}>
          <span style={styles.canalDot} className="animate-pulse-gold" />
          <span style={styles.canalLabel} className="font-mono">CANAL</span>
          <span style={styles.canalName} className="font-mono">{activeCanal}</span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleConnect} style={styles.form} noValidate>
          <label htmlFor={inputId} style={styles.inputLabel} className="font-mono">
            IDENTIFICADOR OPERATIVO
          </label>
          <input
            id={inputId}
            type="text"
            autoComplete="nickname"
            spellCheck="false"
            placeholder="callsign / nombre"
            value={nickname}
            onChange={handleChange}
            disabled={isLoading}
            maxLength={NICKNAME_MAX_LEN}
            aria-describedby={displayError ? 'login-error' : undefined}
            aria-invalid={!!displayError}
            className="input-tactical"
          />

          {displayError && (
            <p id="login-error" style={styles.errorMsg} role="alert" aria-live="assertive">
              {displayError}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !nickname.trim()}
            className="btn-primary"
            style={{ width: '100%', marginTop: '8px' }}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span style={styles.spinner} aria-hidden="true" />
                ENLAZANDO…
              </>
            ) : (
              'ESTABLECER ENLACE'
            )}
          </button>

          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstall}
              className="btn-ghost"
              style={{ width: '100%' }}
            >
              ⬇ INSTALAR APP
            </button>
          )}
        </form>

        <footer style={styles.footer}>
          <span style={styles.footerText}>
            © {new Date().getFullYear()} Raymond Arias · v2.0 · SaaS Táctico
          </span>
        </footer>
      </main>
    </div>
  );
}

/* ─── Estilos inline (Mobile-First, sin clases ad-hoc) ──────────────────── */
const styles = {
  root: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'var(--c-bg-base)',
    position: 'relative',
    overflow: 'hidden',
  },
  noise: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%,
      rgba(201,162,39,0.07) 0%, transparent 70%)`,
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
    padding: '36px 28px 28px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    position: 'relative',
    zIndex: 1,
  },
  logoWrap: {
    position: 'relative',
    width: '96px',
    height: '96px',
    flexShrink: 0,
  },
  logo: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 1,
    filter: 'drop-shadow(0 0 18px rgba(201,162,39,0.35))',
  },
  logoGlow: {
    position: 'absolute',
    inset: '-20%',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201,162,39,0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: 900,
    letterSpacing: '0.2em',
    color: 'var(--c-gold)',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.625rem',
    fontWeight: 500,
    letterSpacing: '0.18em',
    color: 'var(--c-text-muted)',
    textAlign: 'center',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-mono)',
  },
  canalBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(201,162,39,0.06)',
    border: '1px solid rgba(201,162,39,0.2)',
    borderRadius: 'var(--r-full)',
  },
  canalDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--c-gold)',
    flexShrink: 0,
  },
  canalLabel: {
    fontSize: '0.625rem',
    fontWeight: 500,
    letterSpacing: '0.15em',
    color: 'var(--c-text-muted)',
  },
  canalName: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: 'var(--c-gold-bright)',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  inputLabel: {
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'var(--c-text-muted)',
    textTransform: 'uppercase',
    paddingLeft: '4px',
  },
  errorMsg: {
    fontSize: '0.75rem',
    color: 'var(--c-red)',
    textAlign: 'center',
    padding: '0 4px',
    fontFamily: 'var(--font-mono)',
  },
  spinner: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '2px solid rgba(0,0,0,0.3)',
    borderTopColor: 'var(--c-bg-base)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footer: {
    marginTop: '4px',
    borderTop: '1px solid var(--c-border)',
    paddingTop: '16px',
    width: '100%',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.6rem',
    color: 'var(--c-text-muted)',
    letterSpacing: '0.06em',
    fontFamily: 'var(--font-mono)',
  },
};
