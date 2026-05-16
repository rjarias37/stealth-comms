import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useConnectionQualityIndicator,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  Mic, MicOff, PhoneOff, Headphones,
  SignalHigh, SignalMedium, SignalLow, AlertTriangle,
  Radio, Plus, X, Hash, SlidersHorizontal,
} from 'lucide-react';
import { useVoiceProcessor } from '../hooks/useVoiceProcessor.js';

// ─── Constantes ──────────────────────────────────────────────────────────────
const SUBROOM_MAX_LEN = 24;
const SUBROOM_RE      = /^[A-Z0-9_\-]+$/;
const PROCESSED_TRACK_NAME = 'stealth-comms-processed-mic';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeRoomCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().slice(0, SUBROOM_MAX_LEN).replace(/[^A-Z0-9_\-]/g, '');
}

function getParticipantName(p) {
  return p?.name?.trim() || p?.identity || 'Operador';
}

function getInitials(value) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

function getSignalMeta(quality) {
  switch (quality) {
    case 'excellent': return { Icon: SignalHigh,   color: 'var(--c-green)' };
    case 'good':      return { Icon: SignalMedium,  color: 'var(--c-green)' };
    case 'poor':      return { Icon: SignalLow,     color: 'var(--c-amber)' };
    default:          return { Icon: AlertTriangle, color: 'var(--c-red)'   };
  }
}

function getErrorMessage(error) {
  if (!error) return '';
  return error instanceof Error ? error.message : String(error);
}

async function unpublishProcessedMic(localParticipant, publication, fallbackTrack) {
  if (!localParticipant || typeof localParticipant.unpublishTrack !== 'function') return;

  const track = publication?.track ?? fallbackTrack;
  if (track) {
    await localParticipant.unpublishTrack(track, false);
  }
}

function formatDb(value) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return `${safeValue > 0 ? '+' : ''}${safeValue} dB`;
}

function ManualEqSlider({ label, max, min, onChange, step, value }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-300">{label}</span>
        <span className="font-mono text-[0.62rem] font-bold tabular-nums text-amber-300">{formatDb(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-950 accent-[#c9a227] outline-none [box-shadow:inset_0_0_0_1px_rgba(148,163,184,0.18)] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#c9a227] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#c9a227] [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(201,162,39,0.18)]"
      />
    </label>
  );
}

// ─── ParticipantRow ───────────────────────────────────────────────────────────
function ParticipantRow({ participant }) {
  const isSpeaking = useIsSpeaking(participant);
  const isMuted    = !participant.isMicrophoneEnabled;
  const name       = getParticipantName(participant);
  const { quality } = useConnectionQualityIndicator({ participant });
  const { Icon, color } = getSignalMeta(quality);

  return (
    <div style={{
      ...s.participantRow,
      ...(isSpeaking ? s.participantRowSpeaking : {}),
    }}>
      <div style={{
        ...s.avatar,
        ...(isSpeaking ? s.avatarSpeaking : {}),
      }}>
        {getInitials(name)}
      </div>
      <div style={s.participantInfo}>
        <span style={s.participantName}>{name}</span>
        <span style={{ ...s.signalBadge, color }}>
          <Icon size={9} />
          {quality || 'unknown'}
        </span>
      </div>
      <div style={s.micIndicator}>
        {isMuted
          ? <MicOff size={14} color="var(--c-red)" />
          : <Mic    size={14} color="var(--c-text-muted)" />
        }
      </div>
    </div>
  );
}

// ─── SubRoomManager — gestión de canales temporales ─────────────────────────
function SubRoomManager({ baseRoom, onSwitchRoom, activeSubRoom, onCreateSubRoom }) {
  const [input, setInput]   = useState('');
  const [error, setError]   = useState('');
  const inputRef            = useRef(null);

  const handleCreate = () => {
    const code = sanitizeRoomCode(input);
    if (!code) { setError('Código inválido.'); return; }
    if (!SUBROOM_RE.test(code)) { setError('Solo A-Z, 0-9, guión y guión-bajo.'); return; }
    setError('');
    setInput('');
    onCreateSubRoom(code);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
  };

  const mainRoomCode = sanitizeRoomCode(baseRoom);

  return (
    <div style={s.subRoomPanel}>
      <p style={s.subRoomTitle} className="font-mono">SUB-CANALES</p>

      {/* Canal principal */}
      <button
        style={{
          ...s.subRoomChip,
          ...(activeSubRoom === null ? s.subRoomChipActive : {}),
        }}
        onClick={() => onSwitchRoom(null)}
      >
        <Hash size={10} />
        {mainRoomCode}
        <span style={s.chipMain}>MAIN</span>
      </button>

      {/* Sub-rooms creados */}
      {activeSubRoom !== null && (
        <button
          style={{ ...s.subRoomChip, ...s.subRoomChipActive }}
          onClick={() => onSwitchRoom(activeSubRoom)}
        >
          <Hash size={10} />
          {activeSubRoom}
          <span
            role="button"
            tabIndex={0}
            aria-label="Cerrar sub-canal"
            style={s.chipClose}
            onClick={(e) => { e.stopPropagation(); onSwitchRoom(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onSwitchRoom(null); } }}
          >
            <X size={8} />
          </span>
        </button>
      )}

      {/* Crear nuevo sub-canal */}
      <div style={s.subRoomInput}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(sanitizeRoomCode(e.target.value)); setError(''); }}
          onKeyDown={handleKey}
          placeholder="NUEVO-CANAL"
          maxLength={SUBROOM_MAX_LEN}
          aria-label="Código de nuevo sub-canal"
          style={s.subRoomTextField}
          className="font-mono"
        />
        <button
          onClick={handleCreate}
          disabled={!input.trim()}
          style={s.subRoomAddBtn}
          aria-label="Crear sub-canal"
        >
          <Plus size={12} />
        </button>
      </div>
      {error && <p style={s.subRoomError}>{error}</p>}
    </div>
  );
}

// ─── CommsRoomUI ─────────────────────────────────────────────────────────────
function VoiceProcessorPanel({
  bassGain,
  clearMicEnabled,
  currentVoiceId,
  eqGainRange,
  errorMessage,
  isChangingVoice,
  isConfigured,
  isConnected,
  isLocalProcessing,
  isMicEnabled,
  isNativeRobotEnabled,
  isPublishing,
  midGain,
  onBassGainChange,
  onMidGainChange,
  onRobotToggle,
  onToggleClearMic,
  onTrebleGainChange,
  onVoiceChange,
  trebleGain,
  voices,
}) {
  const voicemodStatus = isChangingVoice
    ? 'CAMBIANDO VOZ'
    : isConnected
      ? 'VOICEMOD CONECTADO'
      : isConfigured
        ? 'VOICEMOD LISTO'
        : 'CLIENT KEY FALTANTE';
  const localStatus = isPublishing
    ? 'PUBLICANDO'
    : isMicEnabled
      ? isLocalProcessing ? 'PROCESADO ACTIVO' : 'MIC ACTIVO'
      : 'MIC EN SILENCIO';

  return (
    <div style={s.voicePanel}>
      <div style={s.voicePanelHeader}>
        <div>
          <p style={s.voicePanelTitle} className="font-mono">AJUSTES DE AUDIO</p>
          <p style={s.voicePanelStatus} className="font-mono">
            {localStatus}
          </p>
        </div>
      </div>

      <section className="rounded-md border border-slate-700/80 bg-slate-950/70 p-3 shadow-inner shadow-black/30">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-amber-200">
            PROCESAMIENTO LOCAL
          </p>
          <button
            type="button"
            onClick={onToggleClearMic}
            style={{
              ...s.voiceSwitch,
              ...(clearMicEnabled ? s.voiceSwitchActive : {}),
            }}
            aria-pressed={clearMicEnabled}
          >
            ClearMic {clearMicEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="grid gap-3">
          <ManualEqSlider
            label="Bajos (200Hz)"
            min={eqGainRange.min}
            max={eqGainRange.max}
            step={eqGainRange.step}
            value={bassGain}
            onChange={onBassGainChange}
          />
          <ManualEqSlider
            label="Medios (2.5kHz)"
            min={eqGainRange.min}
            max={eqGainRange.max}
            step={eqGainRange.step}
            value={midGain}
            onChange={onMidGainChange}
          />
          <ManualEqSlider
            label="Agudos (5kHz)"
            min={eqGainRange.min}
            max={eqGainRange.max}
            step={eqGainRange.step}
            value={trebleGain}
            onChange={onTrebleGainChange}
          />
        </div>

        <button
          type="button"
          onClick={onRobotToggle}
          style={{
            ...s.nativeRobotBtn,
            ...(isNativeRobotEnabled ? s.nativeRobotBtnActive : {}),
          }}
          aria-pressed={isNativeRobotEnabled}
        >
          Efecto Robot (Nativo) {isNativeRobotEnabled ? 'ON' : 'OFF'}
        </button>
      </section>

      <section className="rounded-md border border-amber-900/50 bg-gray-900 p-3 shadow-inner shadow-black/30">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.18em] text-amber-300">
              INTEGRACION VOICEMOD
            </p>
            <p className="mt-1 text-[0.68rem] leading-4 text-slate-400">
              Requiere App Desktop
            </p>
          </div>
          <span
            style={{
              ...s.voiceSwitch,
              ...(isConnected ? s.voiceSwitchActive : {}),
              cursor: 'default',
            }}
          >
            V3 API
          </span>
        </div>
        <p className="mb-3 rounded border border-amber-900/40 bg-black/25 px-2 py-1.5 text-[0.68rem] leading-4 text-amber-100/80">
          Abre Voicemod en tu PC para usar estos filtros
        </p>
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            {voicemodStatus}
          </span>
          <span className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.12em] text-slate-500">
            CONTROL REMOTO
          </span>
        </div>
        <div style={s.voicePresetGrid}>
          {voices.map((voice) => {
            const active = currentVoiceId === voice.id;
            const disabled = !isConfigured || isChangingVoice || voice.enabled === false;

            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => onVoiceChange(voice.id)}
                disabled={disabled}
                style={{
                  ...s.voicePresetBtn,
                  ...(active ? s.voicePresetBtnActive : {}),
                  ...(disabled ? s.voicePresetBtnDisabled : {}),
                }}
                aria-pressed={active}
              >
                {voice.label}
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage && (
        <p style={s.voiceError} className="font-mono" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function CommsRoomUI({ nickname, roomName, baseRoom, onDisconnect, onRequestSubRoom }) {
  const participants               = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [isUpdatingMic, setUpdatingMic]  = useState(false);
  const [isDeafened, setDeafened]        = useState(false);
  const [isPttMode, setPttMode]          = useState(false);
  const [showSubRooms, setShowSubRooms]  = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [activeSubRoom, setActiveSubRoom] = useState(null);
  const [voicePublication, setVoicePublication] = useState(null);
  const [isPublishingVoice, setPublishingVoice] = useState(false);
  const [isProcessedMicEnabled, setProcessedMicEnabled] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const processedTrackRef = useRef(null);
  const publicationRef = useRef(null);
  const {
    bassGain,
    changeVoicemodVoice,
    clearMicEnabled,
    currentVoiceId,
    eqGainRange,
    error: processorError,
    isChangingVoice,
    isConnected: isVoicemodConnected,
    isNativeRobotEnabled,
    isProcessing: isLocalProcessing,
    isVoicemodConfigured,
    midGain,
    processedTrack,
    refreshVoicemodVoices,
    release,
    requestMicrophoneStream,
    setBassGain,
    setClearMicEnabled,
    setMidGain,
    setNativeRobotEnabled,
    setTrebleGain,
    trebleGain,
    voices: voicemodVoices,
  } = useVoiceProcessor();

  const activeRoomDisplay = sanitizeRoomCode(roomName) || 'CANAL';
  const voiceErrorMessage = voiceError || getErrorMessage(processorError);

  useEffect(() => {
    processedTrackRef.current = processedTrack;
  }, [processedTrack]);

  useEffect(() => {
    if (!localParticipant) return undefined;

    let cancelled = false;
    const participant = localParticipant;

    const publishProcessedMic = async () => {
      setPublishingVoice(true);
      setVoiceError('');

      try {
        const existingMic = participant.getTrackPublication?.(Track.Source.Microphone);
        if (existingMic?.track && existingMic.trackName !== PROCESSED_TRACK_NAME) {
          await participant.unpublishTrack(existingMic.track, true);
        }

        const result = await requestMicrophoneStream();
        const trackToPublish = result.processedTrack;
        if (!trackToPublish) throw new Error('No se pudo crear el track de microfono procesado.');

        processedTrackRef.current = trackToPublish;

        if (cancelled) {
          await release({ updateState: false });
          return;
        }

        const publication = await participant.publishTrack(trackToPublish, {
          dtx: true,
          name: PROCESSED_TRACK_NAME,
          red: true,
          source: Track.Source.Microphone,
          stopMicTrackOnMute: false,
        });

        if (cancelled) {
          await unpublishProcessedMic(participant, publication, trackToPublish);
          await release({ updateState: false });
          return;
        }

        publicationRef.current = publication;
        setVoicePublication(publication);
        setProcessedMicEnabled(true);
      } catch (error) {
        publicationRef.current = null;
        setVoicePublication(null);
        setProcessedMicEnabled(false);
        setVoiceError(getErrorMessage(error));
        await release().catch(() => {});
      } finally {
        if (!cancelled) setPublishingVoice(false);
      }
    };

    void publishProcessedMic();

    return () => {
      cancelled = true;
      const publication = publicationRef.current;
      const fallbackTrack = processedTrackRef.current;
      publicationRef.current = null;
      processedTrackRef.current = null;
      void unpublishProcessedMic(participant, publication, fallbackTrack).finally(() => {
        void release({ updateState: false });
      });
    };
  }, [localParticipant, release, requestMicrophoneStream]);

  useEffect(() => {
    if (!showVoicePanel || !isVoicemodConfigured) return undefined;

    let cancelled = false;
    setVoiceError('');
    refreshVoicemodVoices().catch((error) => {
      if (!cancelled) setVoiceError(getErrorMessage(error));
    });

    return () => {
      cancelled = true;
    };
  }, [isVoicemodConfigured, refreshVoicemodVoices, showVoicePanel]);

  const setProcessedMicActive = useCallback(
    async (enabled) => {
      if (isUpdatingMic) return;

      const publication = publicationRef.current ?? voicePublication;
      const track = processedTrackRef.current;
      if (!publication && !track) return;

      setUpdatingMic(true);
      try {
        if (publication) {
          if (enabled) await publication.unmute();
          else await publication.mute();
        }

        if (track) track.enabled = enabled;
        setProcessedMicEnabled(enabled);
        setVoiceError('');
      } catch (error) {
        setVoiceError(getErrorMessage(error));
      } finally {
        setUpdatingMic(false);
      }
    },
    [isUpdatingMic, voicePublication]
  );

  // ─── PTT: modo Walkie-Talkie ────────────────────────────────────────────
  const handleTogglePtt = useCallback(async () => {
    const next = !isPttMode;
    setPttMode(next);
    if (next && isProcessedMicEnabled) {
      await setProcessedMicActive(false);
    }
  }, [isProcessedMicEnabled, isPttMode, setProcessedMicActive]);

  useEffect(() => {
    if (!isPttMode) return undefined;
    const onDown = async (e) => {
      if (e.code === 'Space' && !e.repeat && !isUpdatingMic) {
        e.preventDefault();
        await setProcessedMicActive(true);
      }
    };
    const onUp = async (e) => {
      if (e.code === 'Space' && !isUpdatingMic) {
        e.preventDefault();
        await setProcessedMicActive(false);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [isPttMode, isUpdatingMic, setProcessedMicActive]);

  const handleVoiceChange = useCallback(
    async (voiceId) => {
      setVoiceError('');
      try {
        await changeVoicemodVoice(voiceId);
      } catch (error) {
        setVoiceError(getErrorMessage(error));
      }
    },
    [changeVoicemodVoice]
  );

  // ─── Participantes ordenados ────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...participants];
    const localId = localParticipant?.identity;
    list.sort((a, b) => {
      if (a.identity === localId) return -1;
      if (b.identity === localId) return  1;
      return getParticipantName(a).localeCompare(getParticipantName(b));
    });
    return list;
  }, [participants, localParticipant]);

  // ─── Acciones ───────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    try {
      await localParticipant?.room?.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    onDisconnect();
  };

  const handleToggleMic = async () => {
    await setProcessedMicActive(!isProcessedMicEnabled);
  };

  const handleCreateSubRoom = (code) => {
    setActiveSubRoom(code);
    onRequestSubRoom(`${sanitizeRoomCode(baseRoom)}-${code}`);
    setShowSubRooms(false);
  };

  const handleSwitchRoom = (code) => {
    if (code === null) {
      setActiveSubRoom(null);
      onRequestSubRoom(sanitizeRoomCode(baseRoom));
    } else {
      setActiveSubRoom(code);
      onRequestSubRoom(`${sanitizeRoomCode(baseRoom)}-${code}`);
    }
    setShowSubRooms(false);
  };

  return (
    <>
      <RoomAudioRenderer muted={isDeafened} />

      <div style={s.roomWrap} className="card-tactical scan-line">
        {/* Header */}
        <div style={s.roomHeader}>
          <img src="/logo-tren.png" alt="Stealth Comms" style={s.headerLogo} fetchpriority="high" />
          <div style={s.headerInfo}>
            <span style={s.roomName} className="font-mono">{activeRoomDisplay}</span>
            <span className="badge-online font-mono" style={{ fontSize: '0.6rem' }}>
              {sorted.length} ONLINE
            </span>
          </div>
          <button
            style={s.subRoomToggle}
            onClick={() => setShowSubRooms((v) => !v)}
            aria-label="Gestionar sub-canales"
            title="Sub-canales"
          >
            <Hash size={14} color={showSubRooms ? 'var(--c-gold)' : 'var(--c-text-secondary)'} />
          </button>
          <button
            style={s.subRoomToggle}
            onClick={() => setShowVoicePanel((v) => !v)}
            aria-label="Procesador de voz"
            title="Procesador de voz"
          >
            <SlidersHorizontal size={14} color={showVoicePanel ? 'var(--c-gold)' : 'var(--c-text-secondary)'} />
          </button>
        </div>

        {/* Sub-room panel (desplegable) */}
        {showSubRooms && (
          <SubRoomManager
            baseRoom={baseRoom}
            activeSubRoom={activeSubRoom}
            onSwitchRoom={handleSwitchRoom}
            onCreateSubRoom={handleCreateSubRoom}
          />
        )}

        {showVoicePanel && (
          <VoiceProcessorPanel
            bassGain={bassGain}
            clearMicEnabled={clearMicEnabled}
            currentVoiceId={currentVoiceId}
            eqGainRange={eqGainRange}
            errorMessage={voiceErrorMessage}
            isChangingVoice={isChangingVoice}
            isConfigured={isVoicemodConfigured}
            isConnected={isVoicemodConnected}
            isLocalProcessing={isLocalProcessing}
            isMicEnabled={isProcessedMicEnabled}
            isNativeRobotEnabled={isNativeRobotEnabled}
            isPublishing={isPublishingVoice}
            midGain={midGain}
            trebleGain={trebleGain}
            voices={voicemodVoices}
            onBassGainChange={setBassGain}
            onMidGainChange={setMidGain}
            onRobotToggle={() => setNativeRobotEnabled((current) => !current)}
            onToggleClearMic={() => setClearMicEnabled((current) => !current)}
            onTrebleGainChange={setTrebleGain}
            onVoiceChange={handleVoiceChange}
          />
        )}

        {/* Lista de participantes */}
        <div style={s.participantList}>
          {sorted.length > 0 ? (
            <div style={s.participantGrid}>
              {sorted.map((p) => (
                <ParticipantRow key={p.sid || p.identity} participant={p} />
              ))}
            </div>
          ) : (
            <div style={s.emptyState} className="font-mono">
              ENLAZANDO COMO {nickname?.toUpperCase()}…
            </div>
          )}
        </div>

        {/* Barra de controles */}
        <div style={s.controls}>
          <ControlBtn
            id="ctrl-disconnect"
            onClick={handleDisconnect}
            label="SALIR"
            danger
            icon={<PhoneOff size={18} color="var(--c-red)" />}
          />
          <ControlBtn
            id="ctrl-ptt"
            onClick={handleTogglePtt}
            disabled={!voicePublication || isPublishingVoice}
            label={isPttMode ? 'PTT ON' : 'PTT OFF'}
            active={isPttMode}
            icon={<Radio size={18} color={isPttMode ? 'var(--c-bg-base)' : 'var(--c-text-secondary)'} />}
          />
          <ControlBtn
            id="ctrl-mic"
            onClick={handleToggleMic}
            disabled={!voicePublication || isUpdatingMic || isPublishingVoice}
            label={isProcessedMicEnabled ? 'MUTEAR' : 'ACTIVAR'}
            icon={isProcessedMicEnabled
              ? <Mic    size={18} color="var(--c-text-secondary)" />
              : <MicOff size={18} color="var(--c-red)" />
            }
          />
          <ControlBtn
            id="ctrl-audio"
            onClick={() => setDeafened((v) => !v)}
            label={isDeafened ? 'ESCUCHAR' : 'SILENCIAR'}
            icon={<Headphones size={18} color={isDeafened ? 'var(--c-red)' : 'var(--c-text-secondary)'} />}
          />
        </div>
      </div>
    </>
  );
}

// ─── ControlBtn ──────────────────────────────────────────────────────────────
function ControlBtn({ id, onClick, label, icon, disabled, danger, active }) {
  const base = {
    ...s.ctrlBtn,
    ...(danger  ? s.ctrlBtnDanger  : {}),
    ...(active  ? s.ctrlBtnActive  : {}),
    ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
  };
  return (
    <div style={s.ctrlItem}>
      <button id={id} onClick={onClick} disabled={disabled} style={base} aria-label={label}>
        {icon}
      </button>
      <span style={s.ctrlLabel} className="font-mono">{label}</span>
    </div>
  );
}

// ─── CommsRoom (export) ──────────────────────────────────────────────────────
export default function CommsRoom({ nickname, roomName, token, serverUrl, onDisconnect, onRequestSubRoom }) {
  const [connError, setConnError] = useState('');

  if (!serverUrl) {
    return (
      <div style={s.errorPage}>
        <p style={s.errorText} className="font-mono">
          ⚠ FALTA PUBLIC_LIVEKIT_URL EN EL ENTORNO
        </p>
        <button onClick={onDisconnect} className="btn-primary" style={{ marginTop: '16px' }}>
          VOLVER
        </button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={Boolean(token && serverUrl)}
      audio={false}
      video={false}
      style={s.livekitRoot}
      onDisconnected={onDisconnect}
      onError={(err) => { console.error('LiveKit error:', err); setConnError(err.message); }}
    >
      <CommsRoomUI
        nickname={nickname}
        roomName={roomName}
        baseRoom={roomName}
        onDisconnect={onDisconnect}
        onRequestSubRoom={onRequestSubRoom ?? (() => {})}
      />
      {connError && (
        <p style={{ ...s.errorText, marginTop: '12px' }} role="alert">{connError}</p>
      )}
    </LiveKitRoom>
  );
}

// ─── Estilos inline ───────────────────────────────────────────────────────────
const s = {
  livekitRoot: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'var(--c-bg-base)',
    color: 'var(--c-text-primary)',
    fontFamily: 'var(--font-sans)',
  },
  roomWrap: {
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '88dvh',
    position: 'relative',
    overflow: 'hidden',
  },
  roomHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderBottom: '1px solid var(--c-border)',
    background: 'var(--c-bg-surface)',
    flexShrink: 0,
  },
  headerLogo: {
    width: '36px',
    height: '36px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 8px rgba(201,162,39,0.4))',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    flex: 1,
  },
  roomName: {
    fontSize: '0.875rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--c-gold)',
  },
  subRoomToggle: {
    background: 'var(--c-bg-elevated)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm)',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'border-color 220ms ease',
  },
  // Sub-room panel
  subRoomPanel: {
    padding: '12px 16px',
    background: 'var(--c-bg-elevated)',
    borderBottom: '1px solid var(--c-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexShrink: 0,
  },
  subRoomTitle: {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: 'var(--c-text-muted)',
  },
  subRoomChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-full)',
    fontSize: '0.6875rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: 'var(--c-text-secondary)',
    cursor: 'pointer',
    transition: 'border-color 150ms ease, color 150ms ease',
    alignSelf: 'flex-start',
  },
  subRoomChipActive: {
    borderColor: 'var(--c-gold-dim)',
    color: 'var(--c-gold)',
  },
  chipMain: {
    fontSize: '0.5rem',
    letterSpacing: '0.15em',
    color: 'var(--c-text-muted)',
    marginLeft: '2px',
  },
  chipClose: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '2px',
    opacity: 0.6,
    cursor: 'pointer',
  },
  subRoomInput: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  subRoomTextField: {
    flex: 1,
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--c-gold)',
    fontSize: '0.6875rem',
    padding: '6px 10px',
    letterSpacing: '0.12em',
    outline: 'none',
    caretColor: 'var(--c-gold)',
  },
  subRoomAddBtn: {
    background: 'var(--c-gold)',
    border: 'none',
    borderRadius: 'var(--r-sm)',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  subRoomError: {
    fontSize: '0.625rem',
    color: 'var(--c-red)',
    fontFamily: 'var(--font-mono)',
  },
  voicePanel: {
    padding: '12px 16px 14px',
    background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(8,11,18,0.98))',
    borderBottom: '1px solid var(--c-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flexShrink: 0,
  },
  voicePanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  voicePanelTitle: {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: 'var(--c-gold)',
  },
  voicePanelStatus: {
    marginTop: '3px',
    fontSize: '0.55rem',
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: 'var(--c-text-muted)',
  },
  voiceSwitch: {
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-full)',
    color: 'var(--c-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: '0.56rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    padding: '7px 10px',
    textTransform: 'uppercase',
  },
  voiceSwitchActive: {
    background: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.45)',
    color: 'var(--c-green)',
  },
  nativeRobotBtn: {
    marginTop: '12px',
    width: '100%',
    minHeight: '34px',
    background: 'rgba(15,23,42,0.82)',
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--c-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.6rem',
    fontWeight: 800,
    letterSpacing: '0.1em',
    padding: '8px 10px',
    textTransform: 'uppercase',
  },
  nativeRobotBtnActive: {
    background: 'rgba(201,162,39,0.16)',
    borderColor: 'var(--c-gold-dim)',
    color: 'var(--c-gold)',
  },
  voicePresetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
  },
  voicePresetBtn: {
    minHeight: '32px',
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-sm)',
    color: 'var(--c-text-secondary)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.58rem',
    fontWeight: 800,
    letterSpacing: '0.08em',
    overflow: 'hidden',
    padding: '6px 7px',
    textOverflow: 'ellipsis',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  voicePresetBtnActive: {
    background: 'rgba(201,162,39,0.16)',
    borderColor: 'var(--c-gold-dim)',
    color: 'var(--c-gold)',
  },
  voicePresetBtnDisabled: {
    cursor: 'not-allowed',
    opacity: 0.45,
  },
  voiceError: {
    color: 'var(--c-red)',
    fontSize: '0.6rem',
    lineHeight: 1.5,
    letterSpacing: '0.06em',
  },
  // Participant list
  participantList: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 16px',
    background: 'var(--c-bg-base)',
  },
  participantGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
  },
  participantRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--c-bg-surface)',
    border: '1px solid var(--c-border)',
    borderRadius: 'var(--r-md)',
    padding: '10px 12px',
    transition: 'border-color 220ms ease',
  },
  participantRowSpeaking: {
    borderColor: 'var(--c-green)',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: 'var(--c-bg-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--c-text-secondary)',
    flexShrink: 0,
    transition: 'box-shadow 220ms ease',
  },
  avatarSpeaking: {
    animation: 'speaker-ring 1s ease-in-out infinite',
    color: 'var(--c-green)',
  },
  participantInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflow: 'hidden',
  },
  participantName: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--c-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  signalBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '0.5625rem',
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  micIndicator: { flexShrink: 0 },
  emptyState: {
    textAlign: 'center',
    fontSize: '0.6875rem',
    color: 'var(--c-text-muted)',
    letterSpacing: '0.12em',
    padding: '32px 0',
  },
  // Controls
  controls: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: '14px 16px 20px',
    borderTop: '1px solid var(--c-border)',
    background: 'var(--c-bg-surface)',
    flexShrink: 0,
  },
  ctrlItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '5px',
  },
  ctrlBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    background: 'var(--c-bg-elevated)',
    border: '1px solid var(--c-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 150ms ease, border-color 150ms ease, transform 100ms ease',
  },
  ctrlBtnDanger: {
    borderColor: 'rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)',
  },
  ctrlBtnActive: {
    background: 'var(--c-gold)',
    borderColor: 'var(--c-gold)',
  },
  ctrlLabel: {
    fontSize: '0.5rem',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--c-text-muted)',
    textTransform: 'uppercase',
  },
  // Error page
  errorPage: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'var(--c-bg-base)',
  },
  errorText: {
    fontSize: '0.75rem',
    color: 'var(--c-red)',
    textAlign: 'center',
    maxWidth: '320px',
    lineHeight: 1.6,
    letterSpacing: '0.08em',
  },
};
