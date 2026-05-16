import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const VOICEMOD_VOICE_PRESETS = Object.freeze([
  { id: 'nofx', label: 'Clean', aliases: ['nofx', 'no fx', 'clean'] },
  { id: 'robot', label: 'Robot', aliases: ['robot'] },
  { id: 'demon', label: 'Demon', aliases: ['demon'] },
  { id: 'magic-chords', label: 'Magic Chords', aliases: ['magic chords', 'magic-chords', 'magicchords'] },
  { id: 'little-kevin', label: 'Little Kevin', aliases: ['little kevin', 'little-kevin', 'littlekevin'] },
  { id: 'titan', label: 'Titan', aliases: ['titan'] },
]);

export const VOICEMOD_VOICES = Object.freeze(
  VOICEMOD_VOICE_PRESETS.map(({ id, label }) => ({ id, label, enabled: true }))
);

export const EQ_GAIN_RANGE = Object.freeze({
  min: -12,
  max: 12,
  step: 1,
});

const DEFAULT_MIC_CONSTRAINTS = Object.freeze({
  audio: {
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: false,
  },
  video: false,
});

const EMPTY_GRAPH = Object.freeze({
  nodes: [],
  stoppables: [],
});

const VOICEMOD_WS_URL = 'ws://localhost:59129/v1/';
const VOICEMOD_REQUEST_TIMEOUT_MS = 5000;
const VOICEMOD_CLIENT_KEY = import.meta.env.PUBLIC_VOICEMOD_CLIENT_KEY?.trim() ?? '';

const createActionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `stealth-comms-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') return null;

  const audioWindow = window;
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
};

const setAudioParam = (param, value, context) => {
  param.cancelScheduledValues(context.currentTime);
  param.setValueAtTime(value, context.currentTime);
};

const rampAudioParam = (param, value, context, duration = 0.035) => {
  const startTime = context.currentTime;
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(param.value, startTime);
  param.linearRampToValueAtTime(value, startTime + duration);
};

const clampEqGain = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(EQ_GAIN_RANGE.max, Math.max(EQ_GAIN_RANGE.min, Math.round(numericValue)));
};

const stopStreamTracks = (stream) => {
  stream?.getTracks().forEach((track) => {
    if (track.readyState !== 'ended') track.stop();
  });
};

const parseVoicemodMessage = (event) => {
  if (typeof event.data !== 'string') return null;

  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
};

const getResponseId = (message) => message?.actionID ?? message?.actionId ?? message?.id ?? null;

const getVoiceIdFromMessage = (message) =>
  message?.actionObject?.voiceID ?? message?.actionObject?.voiceId ?? message?.actionObject?.currentVoice ?? null;

const normalizeVoiceKey = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

const mapVoicemodPresetVoices = (remoteVoices) => {
  if (!Array.isArray(remoteVoices) || remoteVoices.length === 0) return VOICEMOD_VOICES;

  return VOICEMOD_VOICE_PRESETS.map((preset) => {
    const aliasKeys = preset.aliases.map(normalizeVoiceKey);
    const match = remoteVoices.find((voice) => {
      const remoteKeys = [voice?.id, voice?.friendlyName, voice?.name].map(normalizeVoiceKey);
      return aliasKeys.some((aliasKey) => remoteKeys.includes(aliasKey));
    });

    return {
      id: match?.id ?? preset.id,
      label: preset.label,
      enabled: match?.enabled !== false,
    };
  });
};

const getVoicemodErrorMessage = (message) => {
  if (!message) return '';
  const payloadStatus = message.payload?.status;
  const actionStatus = message.actionObject?.status;
  if (Number(payloadStatus?.code) >= 400) return payloadStatus.description ?? 'Voicemod rechazo la autorizacion.';
  if (Number(actionStatus?.code) >= 400) return actionStatus.description ?? 'Voicemod rechazo la accion.';
  if (typeof message.error === 'string') return message.error;
  if (typeof message.message === 'string' && Number(message.statusCode) >= 400) return message.message;
  if (typeof message.actionObject?.error === 'string') return message.actionObject.error;
  if (typeof message.actionObject?.message === 'string' && Number(message.actionObject?.statusCode) >= 400) {
    return message.actionObject.message;
  }
  return '';
};

const rejectPendingRequests = (pendingRequests, error) => {
  pendingRequests.forEach(({ reject, timeoutId }) => {
    clearTimeout(timeoutId);
    reject(error);
  });
  pendingRequests.clear();
};

const connectClearMicEqualizer = (context, input, graph) => {
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  setAudioParam(highpass.frequency, 150, context);
  setAudioParam(highpass.Q, 0.707, context);

  const presence = context.createBiquadFilter();
  presence.type = 'peaking';
  setAudioParam(presence.frequency, 2500, context);
  setAudioParam(presence.gain, 3, context);
  setAudioParam(presence.Q, 1, context);

  input.connect(highpass);
  highpass.connect(presence);
  graph.nodes.push(highpass, presence);

  return presence;
};

const connectNativeRobotEffect = (context, input, graph) => {
  const ringGain = context.createGain();
  setAudioParam(ringGain.gain, 0, context);

  const oscillator = context.createOscillator();
  oscillator.type = 'sawtooth';
  setAudioParam(oscillator.frequency, 50, context);

  const modulationDepth = context.createGain();
  setAudioParam(modulationDepth.gain, 0.78, context);

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  setAudioParam(lowpass.frequency, 3000, context);
  setAudioParam(lowpass.Q, 0.707, context);

  input.connect(ringGain);
  oscillator.connect(modulationDepth);
  modulationDepth.connect(ringGain.gain);
  ringGain.connect(lowpass);
  oscillator.start();

  graph.nodes.push(ringGain, oscillator, modulationDepth, lowpass);
  graph.stoppables.push(oscillator);

  return lowpass;
};

const connectManualEqualizer = (context, input, graph, gains, eqNodesRef) => {
  const bass = context.createBiquadFilter();
  bass.type = 'lowshelf';
  setAudioParam(bass.frequency, 200, context);
  setAudioParam(bass.gain, gains.bass, context);

  const mid = context.createBiquadFilter();
  mid.type = 'peaking';
  setAudioParam(mid.frequency, 2500, context);
  setAudioParam(mid.Q, 1, context);
  setAudioParam(mid.gain, gains.mid, context);

  const treble = context.createBiquadFilter();
  treble.type = 'highshelf';
  setAudioParam(treble.frequency, 5000, context);
  setAudioParam(treble.gain, gains.treble, context);

  input.connect(bass);
  bass.connect(mid);
  mid.connect(treble);

  graph.nodes.push(bass, mid, treble);
  eqNodesRef.current = { bass, mid, treble };

  return treble;
};

export function useVoiceProcessor({ initialClearMicEnabled = true, initialNativeRobotEnabled = false } = {}) {
  const [bassGain, setBassGainState] = useState(0);
  const [clearMicEnabled, setClearMicEnabledState] = useState(Boolean(initialClearMicEnabled));
  const [currentVoiceId, setCurrentVoiceId] = useState('nofx');
  const [error, setError] = useState('');
  const [isChangingVoice, setChangingVoice] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [isNativeRobotEnabled, setNativeRobotEnabledState] = useState(Boolean(initialNativeRobotEnabled));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [midGain, setMidGainState] = useState(0);
  const [processedStream, setProcessedStream] = useState(null);
  const [trebleGain, setTrebleGainState] = useState(0);
  const [voices, setVoices] = useState(VOICEMOD_VOICES);

  const clearMicEnabledRef = useRef(clearMicEnabled);
  const contextRef = useRef(null);
  const destinationRef = useRef(null);
  const eqGainsRef = useRef({ bass: bassGain, mid: midGain, treble: trebleGain });
  const eqNodesRef = useRef({ bass: null, mid: null, treble: null });
  const graphRef = useRef(EMPTY_GRAPH);
  const inputStreamRef = useRef(null);
  const isNativeRobotEnabledRef = useRef(isNativeRobotEnabled);
  const isUnmountedRef = useRef(false);
  const ownsInputStreamRef = useRef(false);
  const pendingRequestsRef = useRef(new Map());
  const registerPromiseRef = useRef(null);
  const registerResolverRef = useRef(null);
  const sourceRef = useRef(null);
  const websocketRef = useRef(null);

  const disposeGraph = useCallback(() => {
    sourceRef.current?.disconnect();

    graphRef.current.stoppables.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Oscillators can already be stopped during quick hot swaps.
      }
    });

    graphRef.current.nodes.forEach((node) => {
      node.disconnect();
    });

    graphRef.current = EMPTY_GRAPH;
    eqNodesRef.current = { bass: null, mid: null, treble: null };
  }, []);

  const ensureAudioContext = useCallback(() => {
    const AudioContextConstructor = getAudioContextConstructor();
    if (!AudioContextConstructor) {
      throw new Error('Web Audio API no esta disponible en este navegador.');
    }

    if (!contextRef.current || contextRef.current.state === 'closed') {
      const context = new AudioContextConstructor({ latencyHint: 'interactive' });
      const destination = context.createMediaStreamDestination();

      contextRef.current = context;
      destinationRef.current = destination;
      if (!isUnmountedRef.current) setProcessedStream(destination.stream);
    }

    return contextRef.current;
  }, []);

  const rebuildGraph = useCallback(() => {
    const context = contextRef.current;
    const source = sourceRef.current;
    const destination = destinationRef.current;

    if (!context || !source || !destination || context.state === 'closed') return;

    disposeGraph();

    const graph = { nodes: [], stoppables: [] };
    let output = source;

    if (clearMicEnabledRef.current) {
      output = connectClearMicEqualizer(context, output, graph);
    }

    if (isNativeRobotEnabledRef.current) {
      output = connectNativeRobotEffect(context, output, graph);
    }

    output = connectManualEqualizer(context, output, graph, eqGainsRef.current, eqNodesRef);

    const outputGain = context.createGain();
    setAudioParam(outputGain.gain, 0.0001, context);
    output.connect(outputGain);
    outputGain.connect(destination);
    rampAudioParam(outputGain.gain, 1, context, 0.04);
    graph.nodes.push(outputGain);

    graphRef.current = graph;
    if (!isUnmountedRef.current) setIsProcessing(true);
  }, [disposeGraph]);

  const updateManualEqGains = useCallback(() => {
    const context = contextRef.current;
    if (!context || context.state === 'closed') return;

    const { bass, mid, treble } = eqNodesRef.current;
    if (bass) rampAudioParam(bass.gain, eqGainsRef.current.bass, context);
    if (mid) rampAudioParam(mid.gain, eqGainsRef.current.mid, context);
    if (treble) rampAudioParam(treble.gain, eqGainsRef.current.treble, context);
  }, []);

  const attachInputStream = useCallback(
    async (stream, { ownsStream = false } = {}) => {
      const audioTrack = stream?.getAudioTracks?.()[0];
      if (!audioTrack || audioTrack.readyState === 'ended') {
        throw new Error('Se requiere un MediaStream de microfono activo.');
      }

      const context = ensureAudioContext();
      if (context.state === 'suspended') await context.resume();

      disposeGraph();
      sourceRef.current?.disconnect();
      sourceRef.current = context.createMediaStreamSource(stream);

      if (ownsInputStreamRef.current && inputStreamRef.current && inputStreamRef.current !== stream) {
        stopStreamTracks(inputStreamRef.current);
      }

      inputStreamRef.current = stream;
      ownsInputStreamRef.current = ownsStream;

      if (!isUnmountedRef.current) {
        setError('');
        setIsReady(true);
      }

      rebuildGraph();

      return {
        inputStream: stream,
        processedStream: destinationRef.current.stream,
        processedTrack: destinationRef.current.stream.getAudioTracks()[0] ?? null,
      };
    },
    [disposeGraph, ensureAudioContext, rebuildGraph]
  );

  const requestMicrophoneStream = useCallback(
    async (constraints = DEFAULT_MIC_CONSTRAINTS) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('La captura de microfono no esta disponible en este navegador.');
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return await attachInputStream(stream, { ownsStream: true });
      } catch (streamError) {
        const message = streamError instanceof Error ? streamError.message : String(streamError);
        if (!isUnmountedRef.current) setError(message);
        throw streamError;
      }
    },
    [attachInputStream]
  );

  const release = useCallback(
    async ({ stopInput = true, updateState = true } = {}) => {
      disposeGraph();
      sourceRef.current?.disconnect();
      sourceRef.current = null;

      if (stopInput && ownsInputStreamRef.current) {
        stopStreamTracks(inputStreamRef.current);
      }

      stopStreamTracks(destinationRef.current?.stream);

      const context = contextRef.current;
      contextRef.current = null;
      destinationRef.current = null;
      inputStreamRef.current = null;
      ownsInputStreamRef.current = false;

      if (updateState && !isUnmountedRef.current) {
        setIsProcessing(false);
        setIsReady(false);
        setProcessedStream(null);
      }

      if (context && context.state !== 'closed') {
        await context.close();
      }
    },
    [disposeGraph]
  );

  const resume = useCallback(async () => {
    const context = ensureAudioContext();
    if (context.state === 'suspended') await context.resume();
  }, [ensureAudioContext]);

  const setClearMicEnabled = useCallback((nextEnabled) => {
    setClearMicEnabledState((current) => {
      const enabled = typeof nextEnabled === 'function' ? Boolean(nextEnabled(current)) : Boolean(nextEnabled);
      clearMicEnabledRef.current = enabled;
      return enabled;
    });
  }, []);

  const setNativeRobotEnabled = useCallback((nextEnabled) => {
    setNativeRobotEnabledState((current) => {
      const enabled = typeof nextEnabled === 'function' ? Boolean(nextEnabled(current)) : Boolean(nextEnabled);
      isNativeRobotEnabledRef.current = enabled;
      return enabled;
    });
  }, []);

  const setBassGain = useCallback((nextGain) => {
    setBassGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, bass: gain };
      return gain;
    });
  }, []);

  const setMidGain = useCallback((nextGain) => {
    setMidGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, mid: gain };
      return gain;
    });
  }, []);

  const setTrebleGain = useCallback((nextGain) => {
    setTrebleGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, treble: gain };
      return gain;
    });
  }, []);

  const handleVoicemodMessage = useCallback((message) => {
    const messageError = getVoicemodErrorMessage(message);
    const responseId = getResponseId(message);

    if (messageError) {
      if (responseId && pendingRequestsRef.current.has(responseId)) {
        const pending = pendingRequestsRef.current.get(responseId);
        clearTimeout(pending.timeoutId);
        pending.reject(new Error(messageError));
        pendingRequestsRef.current.delete(responseId);
      }
      if (!isUnmountedRef.current) setError(messageError);
      return;
    }

    if (registerResolverRef.current) {
      registerResolverRef.current();
      registerResolverRef.current = null;
      if (!isUnmountedRef.current) setConnected(true);
    }

    const voiceId = getVoiceIdFromMessage(message);
    if (voiceId && !isUnmountedRef.current) {
      setCurrentVoiceId(voiceId);
    }

    if (message?.actionType === 'getVoices') {
      const remoteVoices = message?.actionObject?.voices;
      if (Array.isArray(remoteVoices) && !isUnmountedRef.current) {
        setVoices(mapVoicemodPresetVoices(remoteVoices));
      }

      pendingRequestsRef.current.forEach((pending, requestId) => {
        if (pending.action === 'getVoices') {
          clearTimeout(pending.timeoutId);
          pending.resolve(message);
          pendingRequestsRef.current.delete(requestId);
        }
      });
    }

    if (message?.actionType === 'voiceChangedEvent') {
      pendingRequestsRef.current.forEach((pending, requestId) => {
        if (pending.action === 'loadVoice' && (!pending.voiceId || pending.voiceId === voiceId)) {
          clearTimeout(pending.timeoutId);
          pending.resolve(message);
          pendingRequestsRef.current.delete(requestId);
        }
      });
      return;
    }

    if (responseId && pendingRequestsRef.current.has(responseId)) {
      const pending = pendingRequestsRef.current.get(responseId);
      clearTimeout(pending.timeoutId);
      pending.resolve(message);
      pendingRequestsRef.current.delete(responseId);
    }
  }, []);

  const connectVoicemod = useCallback(async () => {
    if (!VOICEMOD_CLIENT_KEY) {
      throw new Error('PUBLIC_VOICEMOD_CLIENT_KEY no esta configurada.');
    }

    if (typeof WebSocket === 'undefined') {
      throw new Error('WebSocket no esta disponible en este navegador.');
    }

    const existingSocket = websocketRef.current;
    if (existingSocket?.readyState === WebSocket.OPEN) {
      return existingSocket;
    }

    if (registerPromiseRef.current) {
      await registerPromiseRef.current;
      return websocketRef.current;
    }

    const socket = new WebSocket(VOICEMOD_WS_URL);
    websocketRef.current = socket;

    registerPromiseRef.current = new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        registerResolverRef.current = null;
        registerPromiseRef.current = null;
        if (!isUnmountedRef.current) setConnected(false);
        reject(new Error('Voicemod no respondio al registro del cliente.'));
      }, VOICEMOD_REQUEST_TIMEOUT_MS);

      registerResolverRef.current = () => {
        clearTimeout(timeoutId);
        registerPromiseRef.current = null;
        resolve();
      };

      socket.addEventListener('open', () => {
        socket.send(
          JSON.stringify({
            action: 'registerClient',
            id: createActionId(),
            payload: {
              clientKey: VOICEMOD_CLIENT_KEY,
            },
          })
        );
      });

      socket.addEventListener('message', (event) => {
        const message = parseVoicemodMessage(event);
        if (message) handleVoicemodMessage(message);
      });

      socket.addEventListener('error', () => {
        clearTimeout(timeoutId);
        registerResolverRef.current = null;
        registerPromiseRef.current = null;
        if (!isUnmountedRef.current) setConnected(false);
        reject(new Error('No fue posible conectar con Voicemod en localhost.'));
      });

      socket.addEventListener('close', () => {
        clearTimeout(timeoutId);
        registerResolverRef.current = null;
        registerPromiseRef.current = null;
        websocketRef.current = null;
        if (!isUnmountedRef.current) setConnected(false);
        rejectPendingRequests(pendingRequestsRef.current, new Error('La conexion con Voicemod se cerro.'));
      });
    });

    await registerPromiseRef.current;
    return socket;
  }, [handleVoicemodMessage]);

  const sendVoicemodAction = useCallback(
    async (action, payload, options = {}) => {
      const socket = await connectVoicemod();
      const requestId = createActionId();

      return new Promise((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error(`Voicemod no confirmo la accion ${action}.`));
        }, VOICEMOD_REQUEST_TIMEOUT_MS);

        pendingRequestsRef.current.set(requestId, {
          action,
          reject,
          resolve,
          timeoutId,
          voiceId: options.voiceId ?? null,
        });

        socket.send(
          JSON.stringify({
            action,
            id: requestId,
            payload,
          })
        );
      });
    },
    [connectVoicemod]
  );

  const refreshVoicemodVoices = useCallback(async () => {
    if (!isUnmountedRef.current) setError('');

    try {
      return await sendVoicemodAction('getVoices', {});
    } catch (voicesError) {
      const message = voicesError instanceof Error ? voicesError.message : String(voicesError);
      if (!isUnmountedRef.current) setError(message);
      throw voicesError;
    }
  }, [sendVoicemodAction]);

  const changeVoicemodVoice = useCallback(
    async (voiceId) => {
      const cleanVoiceId = typeof voiceId === 'string' ? voiceId.trim() : '';
      if (!cleanVoiceId) {
        throw new Error('voiceId es obligatorio para cambiar la voz de Voicemod.');
      }

      if (!isUnmountedRef.current) {
        setChangingVoice(true);
        setError('');
      }

      try {
        const response = await sendVoicemodAction(
          'loadVoice',
          {
            voiceID: cleanVoiceId,
          },
          {
            voiceId: cleanVoiceId,
          }
        );
        if (!isUnmountedRef.current) setCurrentVoiceId(cleanVoiceId);
        return response;
      } catch (voiceError) {
        const message = voiceError instanceof Error ? voiceError.message : String(voiceError);
        if (!isUnmountedRef.current) setError(message);
        throw voiceError;
      } finally {
        if (!isUnmountedRef.current) setChangingVoice(false);
      }
    },
    [sendVoicemodAction]
  );

  const processedTrack = useMemo(() => processedStream?.getAudioTracks()[0] ?? null, [processedStream]);

  useEffect(() => {
    clearMicEnabledRef.current = clearMicEnabled;
    isNativeRobotEnabledRef.current = isNativeRobotEnabled;
    rebuildGraph();
  }, [clearMicEnabled, isNativeRobotEnabled, rebuildGraph]);

  useEffect(() => {
    eqGainsRef.current = {
      bass: bassGain,
      mid: midGain,
      treble: trebleGain,
    };
    updateManualEqGains();
  }, [bassGain, midGain, trebleGain, updateManualEqGains]);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      registerResolverRef.current = null;
      registerPromiseRef.current = null;
      rejectPendingRequests(pendingRequestsRef.current, new Error('La conexion con Voicemod se cerro.'));

      const socket = websocketRef.current;
      websocketRef.current = null;
      if (socket && typeof WebSocket !== 'undefined' && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }

      void release({ updateState: false });
    };
  }, [release]);

  return {
    attachInputStream,
    bassGain,
    changeVoicemodVoice,
    clearMicEnabled,
    currentVoiceId,
    error,
    eqGainRange: EQ_GAIN_RANGE,
    isChangingVoice,
    isConnected,
    isNativeRobotEnabled,
    isProcessing,
    isReady,
    isVoicemodConfigured: Boolean(VOICEMOD_CLIENT_KEY),
    midGain,
    processedStream,
    processedTrack,
    refreshVoicemodVoices,
    release,
    requestMicrophoneStream,
    resume,
    setBassGain,
    setClearMicEnabled,
    setMidGain,
    setNativeRobotEnabled,
    setTrebleGain,
    trebleGain,
    voices,
  };
}
