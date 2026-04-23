import React, { useState } from 'react';
import LoginScreen from './LoginScreen.jsx'; 
import CommsRoom from './CommsRoom.jsx';

export default function StealthApp() {
  const [nickname, setNickname] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
