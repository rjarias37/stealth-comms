import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const VOICE_PRESETS = Object.freeze({
  clean: { id: 'clean', label: 'Limpio' },
  robot: { id: 'robot', label: 'Robot' },
  demon: { id: 'demon', label: 'Demonio' },
  small: { id: 'small', label: 'Pequeño' },
  giant: { id: 'giant', label: 'Gigante' },
  elder: { id: 'elder', label: 'Anciano' },
});

const DEFAULT_MIC_CONSTRAINTS = Object.freeze({
  audio: {
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: false,
});

export const EQ_GAIN_RANGE = Object.freeze({
  min: -12,
  max: 12,
  step: 1,
});

const EMPTY_GRAPH = Object.freeze({
  nodes: [],
  stoppables: [],
});

const PRESET_IDS = new Set(Object.keys(VOICE_PRESETS));

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') return null;

  /** @type {Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }} */
  const audioWindow = window;

  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
};

const setAudioParam = (param, value, context) => {
  param.cancelScheduledValues(context.currentTime);
  param.setValueAtTime(value, context.currentTime);
};

const rampAudioParam = (param, value, context) => {
  const startTime = context.currentTime;
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(param.value, startTime);
  param.linearRampToValueAtTime(value, startTime + 0.025);
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

const makeDistortionCurve = (amount = 18, sampleCount = 44100) => {
  const curve = new Float32Array(sampleCount);
  const deg = Math.PI / 180;

  for (let index = 0; index < sampleCount; index += 1) {
    const x = (index * 2) / sampleCount - 1;
    curve[index] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }

  return curve;
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

const connectRobotPreset = (context, input, graph) => {
  const ringGain = context.createGain();
  setAudioParam(ringGain.gain, 0, context);

  const oscillator = context.createOscillator();
  oscillator.type = 'sawtooth';
  setAudioParam(oscillator.frequency, 50, context);

  const modulationDepth = context.createGain();
  setAudioParam(modulationDepth.gain, 0.85, context);

  input.connect(ringGain);
  oscillator.connect(modulationDepth);
  modulationDepth.connect(ringGain.gain);
  oscillator.start();

  graph.nodes.push(ringGain, oscillator, modulationDepth);
  graph.stoppables.push(oscillator);

  return ringGain;
};

const connectDemonPreset = (context, input, graph) => {
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  setAudioParam(lowpass.frequency, 800, context);
  setAudioParam(lowpass.Q, 1.15, context);

  const shaper = context.createWaveShaper();
  shaper.curve = makeDistortionCurve();
  shaper.oversample = '2x';

  input.connect(lowpass);
  lowpass.connect(shaper);
  graph.nodes.push(lowpass, shaper);

  return shaper;
};

const connectSmallPreset = (context, input, graph) => {
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  setAudioParam(highpass.frequency, 1000, context);
  setAudioParam(highpass.Q, 0.9, context);

  input.connect(highpass);
  graph.nodes.push(highpass);

  return highpass;
};

const connectGiantPreset = (context, input, graph) => {
  const dryGain = context.createGain();
  setAudioParam(dryGain.gain, 0.72, context);

  const delay = context.createDelay(0.16);
  setAudioParam(delay.delayTime, 0.04, context);

  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  setAudioParam(lowpass.frequency, 1000, context);
  setAudioParam(lowpass.Q, 0.85, context);

  const feedback = context.createGain();
  setAudioParam(feedback.gain, 0.3, context);

  const wetGain = context.createGain();
  setAudioParam(wetGain.gain, 0.58, context);

  const mix = context.createGain();
  setAudioParam(mix.gain, 0.88, context);

  input.connect(dryGain);
  dryGain.connect(mix);

  input.connect(delay);
  delay.connect(lowpass);
  lowpass.connect(wetGain);
  wetGain.connect(mix);
  lowpass.connect(feedback);
  feedback.connect(delay);

  graph.nodes.push(dryGain, delay, lowpass, feedback, wetGain, mix);

  return mix;
};

const connectElderPreset = (context, input, graph) => {
  const bandpass = context.createBiquadFilter();
  bandpass.type = 'bandpass';
  setAudioParam(bandpass.frequency, 2000, context);
  setAudioParam(bandpass.Q, 0.72, context);

  const tremoloGain = context.createGain();
  setAudioParam(tremoloGain.gain, 0.45, context);

  const lfo = context.createOscillator();
  lfo.type = 'sine';
  setAudioParam(lfo.frequency, 5.5, context);

  const lfoDepth = context.createGain();
  setAudioParam(lfoDepth.gain, 0.25, context);

  input.connect(bandpass);
  bandpass.connect(tremoloGain);
  lfo.connect(lfoDepth);
  lfoDepth.connect(tremoloGain.gain);
  lfo.start();

  graph.nodes.push(bandpass, tremoloGain, lfo, lfoDepth);
  graph.stoppables.push(lfo);

  return tremoloGain;
};

const connectPreset = (context, input, preset, graph) => {
  switch (preset) {
    case 'robot':
      return connectRobotPreset(context, input, graph);
    case 'demon':
      return connectDemonPreset(context, input, graph);
    case 'small':
      return connectSmallPreset(context, input, graph);
    case 'giant':
      return connectGiantPreset(context, input, graph);
    case 'elder':
      return connectElderPreset(context, input, graph);
    case 'clean':
    default:
      return input;
  }
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

export const isVoicePreset = (value) => PRESET_IDS.has(value);

export function useVoiceProcessor({ initialPreset = 'clean', initialClearMicEnabled = true } = {}) {
  const [preset, setPresetState] = useState(() => (isVoicePreset(initialPreset) ? initialPreset : 'clean'));
  const [clearMicEnabled, setClearMicEnabled] = useState(Boolean(initialClearMicEnabled));
  const [bassGain, setBassGainState] = useState(0);
  const [midGain, setMidGainState] = useState(0);
  const [trebleGain, setTrebleGainState] = useState(0);
  const [processedStream, setProcessedStream] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const contextRef = useRef(null);
  const destinationRef = useRef(null);
  const graphRef = useRef(EMPTY_GRAPH);
  const inputStreamRef = useRef(null);
  const ownsInputStreamRef = useRef(false);
  const sourceRef = useRef(null);
  const presetRef = useRef(preset);
  const clearMicEnabledRef = useRef(clearMicEnabled);
  const eqGainsRef = useRef({ bass: bassGain, mid: midGain, treble: trebleGain });
  const eqNodesRef = useRef({ bass: null, mid: null, treble: null });

  const disposeGraph = useCallback(() => {
    sourceRef.current?.disconnect();

    graphRef.current.stoppables.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Oscillators throw if the graph was already stopped during a hot swap.
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
      throw new Error('Web Audio API no está disponible en este navegador.');
    }

    if (!contextRef.current || contextRef.current.state === 'closed') {
      const context = new AudioContextConstructor({ latencyHint: 'interactive' });
      const destination = context.createMediaStreamDestination();

      contextRef.current = context;
      destinationRef.current = destination;
      setProcessedStream(destination.stream);
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

    output = connectPreset(context, output, presetRef.current, graph);
    output = connectManualEqualizer(context, output, graph, eqGainsRef.current, eqNodesRef);
    output.connect(destination);

    graphRef.current = graph;
    setIsProcessing(true);
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
        throw new Error('Se requiere un MediaStream de micrófono activo.');
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
      setError(null);
      rebuildGraph();
      setIsReady(true);

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
        throw new Error('La captura de micrófono no está disponible en este navegador.');
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return await attachInputStream(stream, { ownsStream: true });
      } catch (streamError) {
        setError(streamError);
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

      if (updateState) {
        setProcessedStream(null);
        setIsReady(false);
        setIsProcessing(false);
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

  const setPreset = useCallback((nextPreset) => {
    if (!isVoicePreset(nextPreset)) return;

    presetRef.current = nextPreset;
    setPresetState(nextPreset);
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

  const processedTrack = useMemo(() => processedStream?.getAudioTracks()[0] ?? null, [processedStream]);

  useEffect(() => {
    presetRef.current = preset;
    clearMicEnabledRef.current = clearMicEnabled;
    rebuildGraph();
  }, [clearMicEnabled, preset, rebuildGraph]);

  useEffect(() => {
    eqGainsRef.current = {
      bass: bassGain,
      mid: midGain,
      treble: trebleGain,
    };
    updateManualEqGains();
  }, [bassGain, midGain, trebleGain, updateManualEqGains]);

  useEffect(() => {
    return () => {
      void release({ updateState: false });
    };
  }, [release]);

  return {
    attachInputStream,
    bassGain,
    clearMicEnabled,
    error,
    eqGainRange: EQ_GAIN_RANGE,
    isProcessing,
    isReady,
    midGain,
    preset,
    presets: VOICE_PRESETS,
    processedStream,
    processedTrack,
    release,
    requestMicrophoneStream,
    resume,
    setBassGain,
    setClearMicEnabled,
    setMidGain,
    setPreset,
    setTrebleGain,
    trebleGain,
  };
}
