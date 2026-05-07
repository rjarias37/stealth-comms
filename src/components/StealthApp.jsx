import React, { useCallback, useEffect, useRef, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import CommsRoom from './CommsRoom.jsx';

// ─── Canales disponibles ──────────────────────────────────────────────────────
const CANALES = ['ALFA', 'BRAVO', 'CHARLIE', 'OMEGA'];

// ─── Wake Lock Hook ───────────────────────────────────────────────────────────
// Prevents the device screen from sleeping while an active session is running.
function useWakeLock(isActive) {
  const wakeLockRef = useRef(null);
  const [locked, setLocked] = useState(false);

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      console.warn('⚠️ Wake Lock no soportado en este navegador.');
      return;
    }
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setLocked(true);
      console.log('🔒 Escudo de pantalla ACTIVO: Bloqueo de suspensión habilitado.');
    } catch (err) {
      console.error('❌ Error al activar el bloqueo de suspensión:', err.message);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setLocked(false);
        console.log('🔓 Escudo de pantalla INACTIVO: Bloqueo liberado.');
      } catch (err) {
        console.error('❌ Error al liberar el bloqueo:', err.message);
      }
    }
  };

  useEffect(() => {
    if (isActive) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = async () => {
      if (isActive && wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isActive]);

  return locked;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function StealthApp() {
  const [nickname, setNickname] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ─── Canal activo ───────────────────────────────────────────────────────────
  const [canal, setCanal] = useState('ALFA');
  // Ref para saber si el cambio de canal es el que disparó una reconexión
  const isReconnecting = useRef(false);

  // Wake Lock: activo sólo mientras haya sesión en curso
  const isScreenLocked = useWakeLock(token !== null);

  // ─── Lógica de obtención de token ──────────────────────────────────────────
  const fetchToken = useCallback(async (name, room) => {
    setIsLoadingToken(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: name,
          roomName: room,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) {
        throw new Error(
          payload.error ?? 'No fue posible obtener el token de acceso.',
        );
      }

      setNickname(name);
      setRoomName(payload.roomName ?? room);
      setToken(payload.token);
    } catch (error) {
      setNickname(null);
      setRoomName(null);
      setToken(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Error inesperado al solicitar el token.',
      );
    } finally {
      setIsLoadingToken(false);
    }
  }, []);

  // ─── Conexión inicial desde LoginScreen ─────────────────────────────────────
  // LoginScreen ya no controla el room; el room siempre es el canal activo.
  const handleConnect = async ({ nickname: name }) => {
    const cleanedName = typeof name === 'string' ? name.trim() : '';
    if (!cleanedName) return;
    await fetchToken(cleanedName, canal);
  };

  // ─── Desconexión ───────────────────────────────────────────────────────────
  const handleDisconnect = () => {
    setNickname(null);
    setRoomName(null);
    setToken(null);
    setErrorMessage('');
    isReconnecting.current = false;
  };

  // ─── Cambio de canal en caliente ───────────────────────────────────────────
  const handleCambiarCanal = (nuevoCanal) => {
    if (nuevoCanal === canal) return;

    console.log(`📡 Cambiando canal: ${canal} → ${nuevoCanal}`);
    setCanal(nuevoCanal);

    // Si hay sesión activa, marcar para reconexión automática
    if (token !== null && nickname !== null) {
      isReconnecting.current = true;
      // Limpiar sesión actual — el useEffect detectará el cambio y reconectará
      setToken(null);
      setRoomName(null);
    }
  };

  // ─── Auto-reconexión al cambiar canal ──────────────────────────────────────
  // Se dispara cuando: (a) canal cambia, (b) token es null pero nickname existe
  // (lo que indica que fue una desconexión para reconectar, no un logout real).
  useEffect(() => {
    if (isReconnecting.current && nickname !== null && token === null) {
      console.log(`🔄 Reconectando a canal ${canal} como "${nickname}"...`);
      isReconnecting.current = false;
      fetchToken(nickname, canal);
    }
  }, [canal, token, nickname, fetchToken]);

  // ─── Selector de canal (Header táctico) ────────────────────────────────────
  const ChannelSelector = (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 bg-[#060d1f]/90 backdrop-blur-sm border-b border-[#1e295d]">
      <div className="flex items-center gap-2 bg-[#121c3a] border border-[#1e295d] rounded-lg px-3 py-1.5 text-xs text-[#00ffcc] font-mono tracking-wider">
        <span className="animate-pulse text-[#00ffcc] font-bold">📡 CANAL:</span>
        <select
          value={canal}
          onChange={(e) => handleCambiarCanal(e.target.value)}
          className="bg-transparent text-white font-bold outline-none cursor-pointer border-none p-0 focus:ring-0"
          aria-label="Selector de canal de comunicaciones"
        >
          {CANALES.map((c) => (
            <option key={c} value={c} className="bg-[#0a1128] text-white font-mono">
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Indicador de Wake Lock — sutil, sólo cuando está activo */}
      {isScreenLocked && (
        <span
          title="Escudo de pantalla activo"
          className="absolute right-4 text-[#00ffcc] text-xs font-mono opacity-60 tracking-widest"
        >
          🔒 SHIELD
        </span>
      )}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!nickname || !roomName || !token) {
    return (
      <>
        {ChannelSelector}
        {/* Offset para que el header no tape el contenido */}
        <div className="pt-10">
          <LoginScreen
            onConnect={handleConnect}
            isLoading={isLoadingToken}
            errorMessage={errorMessage}
            // Pasamos el canal activo para que LoginScreen pueda mostrarlo si lo desea
            activeCanal={canal}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {ChannelSelector}
      <div className="pt-10">
        <CommsRoom
          nickname={nickname}
          roomName={roomName}
          token={token}
          serverUrl={import.meta.env.PUBLIC_LIVEKIT_URL}
          onDisconnect={handleDisconnect}
        />
      </div>
    </>
  );
}
