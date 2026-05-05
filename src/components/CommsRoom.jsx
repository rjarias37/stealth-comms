import React, { useMemo, useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useConnectionQualityIndicator,
} from '@livekit/components-react';
import { Mic, MicOff, PhoneOff, Headphones, SignalHigh, SignalMedium, SignalLow, AlertTriangle, Radio } from 'lucide-react';

function getParticipantName(participant) {
  return participant?.name?.trim() || participant?.identity || 'Invitado';
}

function getInitials(value) {
  const name = value.trim();
  if (!name) {
    return 'NA';
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function ParticipantRow({ participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  const displayName = getParticipantName(participant);
  
  // 📡 Obtenemos la calidad de conexión (Excellent, Good, Poor, Lost)
  const { quality } = useConnectionQualityIndicator({ participant });

  // Lógica de colores tácticos para la señal
  const getSignalColor = (q) => {
    switch (q) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-green-400';
      case 'poor': return 'text-yellow-500';
      default: return 'text-red-500';
    }
  };

  // Icono dinámico según la señal
  const SignalIcon = (() => {
    switch (quality) {
      case 'excellent': return SignalHigh;
      case 'good': return SignalMedium;
      case 'poor': return SignalLow;
      default: return AlertTriangle;
    }
  })();

  return (
    <div className="bg-[#0f172a] rounded-xl p-3 flex items-center justify-between shadow-sm border border-slate-800">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
            isSpeaking ? 'ring-2 ring-green-500 bg-slate-700' : 'bg-slate-700'
          }`}
        >
          {getInitials(displayName)}
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{displayName}</span>
          {/* Indicador visual de señal con ícono dinámico */}
          <div className={`flex items-center gap-1 text-[10px] ${getSignalColor(quality)} font-bold uppercase`}>
            <SignalIcon size={10} />
            {quality}
          </div>
        </div>
      </div>
      {isMuted ? (
        <MicOff size={18} className="text-red-500" />
      ) : (
        <Mic size={18} className="text-slate-400" />
      )}
    </div>
  );
}

function CommsRoomUI({ nickname, roomName, onDisconnect }) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [isUpdatingMic, setIsUpdatingMic] = useState(false);
  const [isHeadphonesMuted, setIsHeadphonesMuted] = useState(false);
  const activeRoomName = roomName?.trim() || 'Sala';

  // 1. Estado para el modo Walkie-Talkie
  const [isPttMode, setIsPttMode] = useState(false);

  // 2. Función para alternar el modo
  const handleTogglePttMode = async () => {
    const nextMode = !isPttMode;
    setIsPttMode(nextMode);
    // Seguridad táctica: Si encendemos el modo Walkie-Talkie, apagamos el mic por defecto
    if (nextMode && localParticipant && isMicrophoneEnabled) {
      await localParticipant.setMicrophoneEnabled(false);
    }
  };

  // 3. Efecto para escuchar la Barra Espaciadora SOLO en modo PTT
  useEffect(() => {
    if (!isPttMode || !localParticipant) return;

    const handleKeyDown = async (e) => {
      if (e.code === 'Space' && !e.repeat && !isUpdatingMic) {
        e.preventDefault();
        await localParticipant.setMicrophoneEnabled(true);
      }
    };

    const handleKeyUp = async (e) => {
      if (e.code === 'Space' && !isUpdatingMic) {
        e.preventDefault();
        await localParticipant.setMicrophoneEnabled(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPttMode, localParticipant, isUpdatingMic]);

  const sortedParticipants = useMemo(() => {
    const sorted = [...participants];
    const localIdentity = localParticipant?.identity;

    sorted.sort((a, b) => {
      if (localIdentity && a.identity === localIdentity) {
        return -1;
      }
      if (localIdentity && b.identity === localIdentity) {
        return 1;
      }
      return getParticipantName(a).localeCompare(getParticipantName(b));
    });

    return sorted;
  }, [participants, localParticipant]);

  const handleDisconnectClick = async () => {
    if (!localParticipant?.room) {
      onDisconnect();
      return;
    }

    try {
      await localParticipant.room.disconnect();
    } catch (error) {
      console.error('Error disconnecting from LiveKit room:', error);
      onDisconnect();
    }
  };

  const handleToggleMic = async () => {
    if (!localParticipant || isUpdatingMic) {
      return;
    }

    setIsUpdatingMic(true);
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      console.error('Error toggling microphone state:', error);
    } finally {
      setIsUpdatingMic(false);
    }
  };

  return (
    <>
      <RoomAudioRenderer muted={isHeadphonesMuted} />

      <div className="w-full max-w-sm sm:max-w-xl md:max-w-4xl transition-all duration-300 flex flex-col h-[700px] bg-[#0f172a] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative">
        <div className="p-6 flex flex-col items-center border-b border-slate-800">
          <img
            src="/logo-tren.png"
            alt="Logo"
            className="w-24 h-24 object-contain mb-4 drop-shadow-lg"
          />
          <div className="w-full bg-[#e2e8f0] text-[#0f172a] rounded-full py-3 px-6 flex justify-between items-center font-bold">
            <span>{activeRoomName}</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              {sortedParticipants.length} online
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-slate-200 rounded-t-3xl mt-4 mx-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortedParticipants.length > 0 ? (
              sortedParticipants.map((participant) => (
                <ParticipantRow
                  key={participant.sid || participant.identity}
                  participant={participant}
                />
              ))
            ) : (
              <div className="bg-[#0f172a] rounded-xl p-3 text-sm text-slate-300 border border-slate-800">
                Conectando a la sala como {nickname}...
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f172a] p-4 flex justify-between items-center border-t border-slate-800 pb-8">
          <div className="flex flex-col items-center">
            <button
              onClick={handleDisconnectClick}
              className="w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
            >
              <PhoneOff size={20} className="text-red-600" />
            </button>
            <span className="text-[10px] mt-1 text-slate-400 uppercase font-bold">
              Salir
            </span>
          </div>

          {/* Botón Modo Walkie-Talkie */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleTogglePttMode}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isPttMode 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-[#e2e8f0] hover:bg-slate-300'
              }`}
            >
              <Radio size={20} className={isPttMode ? 'text-white' : 'text-slate-700'} />
            </button>
            <span className="text-[10px] mt-1 text-slate-400 uppercase font-bold">
              {isPttMode ? 'PTT ON' : 'PTT OFF'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={handleToggleMic}
              disabled={!localParticipant || isUpdatingMic}
              className="w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors disabled:opacity-60"
            >
              {isMicrophoneEnabled ? (
                <Mic size={20} className="text-slate-700" />
              ) : (
                <MicOff size={20} className="text-red-600" />
              )}
            </button>
            <span className="text-[10px] mt-1 text-slate-400 uppercase font-bold">
              {isMicrophoneEnabled ? 'Mutear' : 'Activar'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsHeadphonesMuted((current) => !current)}
              className="w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors"
            >
              <Headphones
                size={20}
                className={isHeadphonesMuted ? 'text-red-600' : 'text-slate-700'}
              />
            </button>
            <span className="text-[10px] mt-1 text-slate-400 uppercase font-bold">
              {isHeadphonesMuted ? 'Escuchar' : 'Silenciar'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CommsRoom({
  nickname,
  roomName,
  token,
  serverUrl,
  onDisconnect,
}) {
  const [connectionError, setConnectionError] = useState('');

  if (!serverUrl) {
    return (
      <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white">
        <p className="text-sm text-red-300 text-center max-w-sm">
          Falta configurar PUBLIC_LIVEKIT_URL en tu archivo .env.
        </p>
        <button
          onClick={onDisconnect}
          className="mt-4 px-4 py-2 bg-[#e2e8f0] text-[#0f172a] rounded-full font-bold"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={Boolean(token && serverUrl)}
      audio={true}
      video={false}
      className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white"
      onDisconnected={onDisconnect}
      onError={(error) => {
        console.error('LiveKit room error:', error);
        setConnectionError(error.message);
      }}
    >
      <CommsRoomUI
        nickname={nickname}
        roomName={roomName}
        onDisconnect={onDisconnect}
      />
      {connectionError ? (
        <p className="mt-3 text-xs text-red-300">{connectionError}</p>
      ) : null}
    </LiveKitRoom>
  );
}