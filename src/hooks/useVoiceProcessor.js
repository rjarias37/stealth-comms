import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DebugLog } from './debugLog.js';

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

const EMPTY_GRAPH = Object.freeze({ nodes: [], stoppables: [] });

// ─── Helpers de Web Audio API ────────────────────────────────────────────────

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

// ─── Nodos de procesamiento de audio ─────────────────────────────────────────

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

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useVoiceProcessor({
  initialClearMicEnabled = true,
  initialNativeRobotEnabled = false,
  micDeviceId = '',
} = {}) {
  const [bassGain, setBassGainState] = useState(0);
  const [clearMicEnabled, setClearMicEnabledState] = useState(Boolean(initialClearMicEnabled));
  const [error, setError] = useState('');
  const [isNativeRobotEnabled, setNativeRobotEnabledState] = useState(Boolean(initialNativeRobotEnabled));
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [midGain, setMidGainState] = useState(0);
  const [processedStream, setProcessedStream] = useState(null);
  const [trebleGain, setTrebleGainState] = useState(0);

  const analyserDataRef = useRef(null);
  const analyserFrameRef = useRef(null);
  const analyserRef = useRef(null);
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
  const sourceRef = useRef(null);

  // ─── Medidor de volumen del micrófono ───────────────────────────────────
  const stopMicVolumeMeter = useCallback((resetVolume = false) => {
    if (typeof window !== 'undefined' && analyserFrameRef.current !== null) {
      window.cancelAnimationFrame(analyserFrameRef.current);
    }

    analyserDataRef.current = null;
    analyserFrameRef.current = null;
    analyserRef.current = null;

    if (resetVolume && !isUnmountedRef.current) {
      setMicVolume(0);
    }
  }, []);

  const startMicVolumeMeter = useCallback((analyser) => {
    if (typeof window === 'undefined') return;

    stopMicVolumeMeter();

    analyserRef.current = analyser;
    analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);

    const updateVolume = () => {
      const activeAnalyser = analyserRef.current;
      const frequencyData = analyserDataRef.current;

      if (!activeAnalyser || !frequencyData || isUnmountedRef.current) return;

      activeAnalyser.getByteFrequencyData(frequencyData);

      let total = 0;
      for (let index = 0; index < frequencyData.length; index += 1) {
        total += frequencyData[index];
      }

      const average = frequencyData.length > 0 ? total / frequencyData.length : 0;
      const nextVolume = Math.min(100, Math.max(0, Math.round((average / 255) * 100)));
      setMicVolume(nextVolume);

      analyserFrameRef.current = window.requestAnimationFrame(updateVolume);
    };

    analyserFrameRef.current = window.requestAnimationFrame(updateVolume);
  }, [stopMicVolumeMeter]);

  // ─── Gestión del grafo de audio ─────────────────────────────────────────
  const disposeGraph = useCallback(() => {
    stopMicVolumeMeter();

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
  }, [stopMicVolumeMeter]);

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

    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    graph.nodes.push(analyser);
    startMicVolumeMeter(analyser);

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

    DebugLog.processor.graphRebuild(
      clearMicEnabledRef.current,
      isNativeRobotEnabledRef.current,
      { bass: eqGainsRef.current.bass, mid: eqGainsRef.current.mid, treble: eqGainsRef.current.treble }
    );
  }, [disposeGraph, startMicVolumeMeter]);

  const updateManualEqGains = useCallback(() => {
    const context = contextRef.current;
    if (!context || context.state === 'closed') return;

    const { bass, mid, treble } = eqNodesRef.current;
    if (bass) rampAudioParam(bass.gain, eqGainsRef.current.bass, context);
    if (mid) rampAudioParam(mid.gain, eqGainsRef.current.mid, context);
    if (treble) rampAudioParam(treble.gain, eqGainsRef.current.treble, context);
  }, []);

  // ─── Gestión del stream de entrada ──────────────────────────────────────
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
        const err = new Error('La captura de microfono no esta disponible en este navegador.');
        DebugLog.mic.error(err);
        throw err;
      }

      // Inyectar el deviceId seleccionado en las restricciones de audio
      const mergedConstraints = micDeviceId
        ? {
            ...constraints,
            audio: {
              ...constraints.audio,
              deviceId: { exact: micDeviceId },
            },
          }
        : constraints;

      DebugLog.mic.request(mergedConstraints);

      try {
        const stream = await navigator.mediaDevices.getUserMedia(mergedConstraints);
        DebugLog.mic.gotStream(stream);
        return await attachInputStream(stream, { ownsStream: true });
      } catch (streamError) {
        DebugLog.mic.error(streamError);
        const message = streamError instanceof Error ? streamError.message : String(streamError);
        if (!isUnmountedRef.current) setError(message);
        throw streamError;
      }
    },
    [attachInputStream, micDeviceId]
  );

  const release = useCallback(
    async ({ stopInput = true, updateState = true } = {}) => {
      DebugLog.mic.release(`stopInput=${stopInput} updateState=${updateState}`);
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
        setMicVolume(0);
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

  // ─── Setters ────────────────────────────────────────────────────────────
  const setClearMicEnabled = useCallback((nextEnabled) => {
    setClearMicEnabledState((current) => {
      const enabled = typeof nextEnabled === 'function' ? Boolean(nextEnabled(current)) : Boolean(nextEnabled);
      clearMicEnabledRef.current = enabled;
      DebugLog.processor.clearMicToggle(enabled);
      return enabled;
    });
  }, []);

  const setNativeRobotEnabled = useCallback((nextEnabled) => {
    setNativeRobotEnabledState((current) => {
      const enabled = typeof nextEnabled === 'function' ? Boolean(nextEnabled(current)) : Boolean(nextEnabled);
      isNativeRobotEnabledRef.current = enabled;
      DebugLog.processor.robotToggle(enabled);
      return enabled;
    });
  }, []);

  const setBassGain = useCallback((nextGain) => {
    setBassGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, bass: gain };
      DebugLog.processor.eqChange('bass', gain);
      return gain;
    });
  }, []);

  const setMidGain = useCallback((nextGain) => {
    setMidGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, mid: gain };
      DebugLog.processor.eqChange('mid', gain);
      return gain;
    });
  }, []);

  const setTrebleGain = useCallback((nextGain) => {
    setTrebleGainState((currentGain) => {
      const gain = clampEqGain(typeof nextGain === 'function' ? nextGain(currentGain) : nextGain);
      eqGainsRef.current = { ...eqGainsRef.current, treble: gain };
      DebugLog.processor.eqChange('treble', gain);
      return gain;
    });
  }, []);

  // ─── Derivados ──────────────────────────────────────────────────────────
  const processedTrack = useMemo(() => processedStream?.getAudioTracks()[0] ?? null, [processedStream]);

  // ─── Effects ────────────────────────────────────────────────────────────
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
      void release({ updateState: false });
    };
  }, [release]);

  return {
    attachInputStream,
    bassGain,
    clearMicEnabled,
    error,
    eqGainRange: EQ_GAIN_RANGE,
    isNativeRobotEnabled,
    isProcessing,
    isReady,
    micDeviceId,
    micVolume,
    midGain,
    processedStream,
    processedTrack,
    release,
    requestMicrophoneStream,
    resume,
    setBassGain,
    setClearMicEnabled,
    setMidGain,
    setNativeRobotEnabled,
    setTrebleGain,
    trebleGain,
  };
}
