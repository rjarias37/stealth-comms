// Ubicación: /src/components/CommsRoom.jsx

import React, { useMemo, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useConnectionQualityIndicator, // ✅ Corregido: El nombre correcto del hook
} from '@livekit/components-react';
import { Mic, MicOff, PhoneOff, Headphones, SignalHigh, SignalMedium, SignalLow, AlertTriangle } from 'lucide-react';

// ... (funciones getParticipantName y getInitials se mantienen igual)

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
          {/* Indicador visual de señal */}
          <div className={`flex items-center gap-1 text-[10px] ${getSignalColor(quality)} font-bold uppercase`}>
            <SignalHigh size={10} />
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

// ... (Resto del componente CommsRoomUI y export default se mantienen igual)