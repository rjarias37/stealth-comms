import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import CommsRoom from './CommsRoom.jsx';
import ChannelHeader from './ChannelHeader.jsx';

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

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <ChannelHeader
        channelId={canal}
        displayName={session.nickname || ''}
        screenActive={isScreenLocked}
        onChangeChannel={() => {
          const next = CANALES[(CANALES.indexOf(canal) + 1) % CANALES.length];
          handleCambiarCanal(next);
        }}
      />

      <div className="pt-12">
        {!session.nickname || !session.roomName || !session.token ? (
          <LoginScreen
            onConnect={handleConnect}
            isLoading={session.loading}
            errorMessage={session.error}
            activeCanal={canal}
          />
        ) : (
          <CommsRoom
            nickname={session.nickname}
            roomName={session.roomName}
            token={session.token}
            serverUrl={import.meta.env.PUBLIC_LIVEKIT_URL}
            onDisconnect={handleDisconnect}
            onRequestSubRoom={handleRequestSubRoom}
          />
        )}
      </div>
    </>
  );
}
