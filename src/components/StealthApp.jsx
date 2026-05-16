import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import CommsRoom from './CommsRoom.jsx';

// ─── Canales base disponibles ────────────────────────────────────────────────
const CANALES = ['ALFA', 'BRAVO', 'CHARLIE', 'OMEGA'];

// ─── Sanitización de room codes (espejo del backend) ─────────────────────────
const ROOM_MAX_LEN = 64;
function sanitizeRoomCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().slice(0, ROOM_MAX_LEN).replace(/[^A-Z0-9_\-]/g, '');
}

// ─── Hook: Wake Lock ──────────────────────────────────────────────────────────
function useWakeLock(isActive) {
  const ref    = useRef(null);
  const [locked, setLocked] = useState(false);

  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      ref.current = await navigator.wakeLock.request('screen');
      setLocked(true);
    } catch (err) {
      console.warn('Wake Lock:', err.message);
    }
  }, []);

  const release = useCallback(async () => {
    if (!ref.current) return;
    try {
      await ref.current.release();
      ref.current = null;
      setLocked(false);
    } catch (err) {
      console.warn('Wake Lock release:', err.message);
    }
  }, []);

  useEffect(() => {
    if (isActive) { acquire(); } else { release(); }

    const onVisibility = () => {
      if (isActive && document.visibilityState === 'visible') acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [isActive, acquire, release]);

  return locked;
}

// ─── Estado de sesión inicial ─────────────────────────────────────────────────
const INITIAL_SESSION = {
  nickname:  null,
  roomName:  null,
  token:     null,
  loading:   false,
  error:     '',
};

// ─── StealthApp ───────────────────────────────────────────────────────────────
export default function StealthApp() {
  const [session, setSession]     = useState(INITIAL_SESSION);
  const [canal, setCanal]         = useState('ALFA');
  // activeRoom puede ser el canal base o un sub-canal temporal
  const [activeRoom, setActiveRoom] = useState(null);
  const isReconnecting            = useRef(false);
  const isScreenLocked            = useWakeLock(session.token !== null);

  // ─── fetchToken ─────────────────────────────────────────────────────────
  const fetchToken = useCallback(async (name, room) => {
    setSession((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const res = await fetch('/api/getToken', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: name, roomName: room }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.token) {
        throw new Error(payload.error ?? 'No fue posible obtener el token.');
      }

      setSession({
        nickname: name,
        roomName: payload.roomName ?? room,
        token:    payload.token,
        loading:  false,
        error:    '',
      });
    } catch (err) {
      setSession({
        ...INITIAL_SESSION,
        error: err instanceof Error ? err.message : 'Error inesperado.',
      });
    }
  }, []);

  // ─── Conexión inicial ────────────────────────────────────────────────────
  const handleConnect = useCallback(({ nickname }) => {
    const cleanName = typeof nickname === 'string' ? nickname.trim() : '';
    if (!cleanName) return;
    const room = sanitizeRoomCode(canal);
    setActiveRoom(room);
    fetchToken(cleanName, room);
  }, [canal, fetchToken]);

  // ─── Desconexión completa ────────────────────────────────────────────────
  const handleDisconnect = useCallback(() => {
    setSession(INITIAL_SESSION);
    setActiveRoom(null);
    isReconnecting.current = false;
  }, []);

  // ─── Cambio de canal base (reconexión automática) ────────────────────────
  const handleCambiarCanal = useCallback((nuevoCanal) => {
    if (nuevoCanal === canal) return;
    setCanal(nuevoCanal);

    if (session.token !== null && session.nickname !== null) {
      isReconnecting.current = true;
      const room = sanitizeRoomCode(nuevoCanal);
      setActiveRoom(room);
      setSession((prev) => ({ ...prev, token: null, roomName: null }));
    }
  }, [canal, session.token, session.nickname]);

  // ─── Auto-reconexión al cambiar canal ───────────────────────────────────
  useEffect(() => {
    if (
      isReconnecting.current &&
      session.nickname !== null &&
      session.token === null &&
      activeRoom !== null
    ) {
      isReconnecting.current = false;
      fetchToken(session.nickname, activeRoom);
    }
  }, [canal, session.token, session.nickname, activeRoom, fetchToken]);

  // ─── Sub-room: cambio de sala sin salir de la sesión ────────────────────
  const handleRequestSubRoom = useCallback((fullRoomCode) => {
    const clean = sanitizeRoomCode(fullRoomCode);
    if (!clean || !session.nickname) return;
    setActiveRoom(clean);
    // Recortar sesión actual para forzar nuevo token con el sub-canal
    isReconnecting.current = true;
    setSession((prev) => ({ ...prev, token: null, roomName: null }));
  }, [session.nickname]);

  // ─── Auto-reconexión cuando cambia activeRoom (sub-rooms) ───────────────
  useEffect(() => {
    if (
      isReconnecting.current &&
      session.nickname !== null &&
      session.token === null &&
      activeRoom !== null
    ) {
      isReconnecting.current = false;
      fetchToken(session.nickname, activeRoom);
    }
  }, [activeRoom, session.token, session.nickname, fetchToken]);

  // ─── Channel selector (header táctico) ──────────────────────────────────
  const ChannelHeader = (
    <div style={hs.bar} aria-label="Selector de canal">
      <div style={hs.inner}>
        <span style={hs.label} className="font-mono animate-pulse-gold">📡 CANAL</span>
        <select
          value={canal}
          onChange={(e) => handleCambiarCanal(e.target.value)}
          style={hs.select}
          className="font-mono"
          aria-label="Selector de canal de comunicaciones"
        >
          {CANALES.map((c) => (
            <option key={c} value={c} style={{ background: 'var(--c-bg-base)', color: '#fff' }}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {isScreenLocked && (
        <span style={hs.shield} className="font-mono" title="Escudo de pantalla activo">
          🔒 SHIELD
        </span>
      )}
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!session.nickname || !session.roomName || !session.token) {
    return (
      <>
        {ChannelHeader}
        <div style={{ paddingTop: '44px' }}>
          <LoginScreen
            onConnect={handleConnect}
            isLoading={session.loading}
            errorMessage={session.error}
            activeCanal={canal}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {ChannelHeader}
      <div style={{ paddingTop: '44px' }}>
        <CommsRoom
          nickname={session.nickname}
          roomName={session.roomName}
          token={session.token}
          serverUrl={import.meta.env.PUBLIC_LIVEKIT_URL}
          onDisconnect={handleDisconnect}
          onRequestSubRoom={handleRequestSubRoom}
        />
      </div>
    </>
  );
}

// ─── Estilos del header ───────────────────────────────────────────────────────
const hs = {
  bar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    background: 'rgba(8,11,18,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--c-border)',
  },
  inner: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--c-bg-elevated)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    padding: '4px 14px',
  },
  label: {
    fontSize: '0.625rem',
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: 'var(--c-gold)',
  },
  select: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--c-text-primary)',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.12em',
    cursor: 'pointer',
  },
  shield: {
    position: 'absolute',
    right: '16px',
    fontSize: '0.5625rem',
    color: 'var(--c-gold)',
    letterSpacing: '0.15em',
    opacity: 0.6,
  },
};
