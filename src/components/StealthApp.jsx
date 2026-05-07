import React, { useEffect, useRef, useState } from 'react';
import LoginScreen from './LoginScreen.jsx';
import CommsRoom from './CommsRoom.jsx';

// ─── Wake Lock Hook ──────────────────────────────────────────────────────────
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

  // Wake Lock: mantiene la pantalla activa mientras haya una sesión con token
  const isScreenLocked = useWakeLock(token !== null);

  const handleConnect = async ({ nickname: name, room }) => {
    const cleanedName = typeof name === 'string' ? name.trim() : '';
    const cleanedRoom = typeof room === 'string' ? room.trim() : '';

    if (!cleanedName || !cleanedRoom) {
      return;
    }

    setIsLoadingToken(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanedName,
          roomName: cleanedRoom,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) {
        throw new Error(
          payload.error ?? 'No fue posible obtener el token de acceso.',
        );
      }

      setNickname(cleanedName);
      setRoomName(payload.roomName ?? cleanedRoom);
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
  };

  const handleDisconnect = () => {
    setNickname(null);
    setRoomName(null);
    setToken(null);
    setErrorMessage('');
  };

  if (!nickname || !roomName || !token) {
    return (
      <LoginScreen
        onConnect={handleConnect}
        isLoading={isLoadingToken}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <CommsRoom
      nickname={nickname}
      roomName={roomName}
      token={token}
      serverUrl={import.meta.env.PUBLIC_LIVEKIT_URL}
      onDisconnect={handleDisconnect}
    />
  );
}
