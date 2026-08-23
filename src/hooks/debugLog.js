// ─── Debug Logger Centralizado ──────────────────────────────────────────────
// Guarda en memoria (array) y opcionalmente en localStorage para persistir entre recargas

const MAX_ENTRIES = 2000;
const STORAGE_KEY = 'zping_debug_log';

let _logs = [];
let _listeners = new Set();
let _persistEnabled = false;

function now() {
  return new Date().toISOString();
}

function formatArgs(args) {
  return args.map((a) => {
    if (a instanceof Error) return `[Error: ${a.message}]${a.stack ? '\n' + a.stack : ''}`;
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a, (k, v) => (v instanceof MediaStreamTrack ? `[MediaStreamTrack:${v.kind}:${v.id.slice(0, 8)}]` : v), 2);
      } catch {
        return String(a);
      }
    }
    return String(a);
  }).join(' ');
}

function addEntry(level, tag, ...args) {
  const entry = {
    t: now(),
    l: level,
    tag,
    msg: formatArgs(args),
  };

  _logs.push(entry);
  if (_logs.length > MAX_ENTRIES) _logs.shift();

  if (_persistEnabled) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_logs.slice(-500)));
    } catch { }
  }

  _listeners.forEach((fn) => {
    try { fn(entry); } catch { }
  });

  // También log a consola para visibilidad inmediata
  const prefix = `[${level}] [${tag}]`;
  if (level === 'error') console.error(prefix, ...args);
  else if (level === 'warn') console.warn(prefix, ...args);
  else console.log(prefix, ...args);
}

export const DebugLog = {
  enablePersist(enabled = true) {
    _persistEnabled = enabled;
    if (enabled) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) _logs = JSON.parse(stored);
      } catch { }
    }
  },

  getLogs() {
    return [..._logs];
  },

  clear() {
    _logs = [];
    if (_persistEnabled) localStorage.removeItem(STORAGE_KEY);
    _listeners.forEach((fn) => fn({ type: 'cleared' }));
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  // Niveles
  debug(tag, ...args) { addEntry('debug', tag, ...args); },
  info(tag, ...args) { addEntry('info', tag, ...args); },
  warn(tag, ...args) { addEntry('warn', tag, ...args); },
  error(tag, ...args) { addEntry('error', tag, ...args); },

  // Helpers semánticos para la app
  device: {
    enumerate: (devices) => addEntry('info', 'DEVICE', 'enumerate', `inputs=${devices.audioInputs?.length ?? 0} outputs=${devices.audioOutputs?.length ?? 0}`),
    selectMic: (id, label) => addEntry('info', 'DEVICE', 'selectMic', `id=${id} label="${label}"`),
    selectOutput: (id, label) => addEntry('info', 'DEVICE', 'selectOutput', `id=${id} label="${label}"`),
    change: (kind, oldId, newId) => addEntry('info', 'DEVICE', 'change', `${kind} ${oldId} -> ${newId}`),
    devicechange: () => addEntry('info', 'DEVICE', 'devicechange event fired'),
  },

  mic: {
    request: (constraints) => addEntry('info', 'MIC', 'request', JSON.stringify(constraints)),
    gotStream: (stream) => addEntry('info', 'MIC', 'gotStream', `id=${stream.id} tracks=${stream.getTracks().map(t => `${t.kind}:${t.label}(${t.id.slice(0,8)})`).join(', ')}`),
    error: (err) => addEntry('error', 'MIC', 'error', err),
    release: (reason) => addEntry('info', 'MIC', 'release', reason),
    trackEnded: (track) => addEntry('warn', 'MIC', 'trackEnded', `${track.kind}:${track.id.slice(0,8)}`),
  },

  processor: {
    graphRebuild: (clearMic, robot, eq) => addEntry('info', 'PROC', 'graphRebuild', `clearMic=${clearMic} robot=${robot} eq=${JSON.stringify(eq)}`),
    clearMicToggle: (enabled) => addEntry('info', 'PROC', 'clearMicToggle', enabled),
    robotToggle: (enabled) => addEntry('info', 'PROC', 'robotToggle', enabled),
    eqChange: (band, value) => addEntry('debug', 'PROC', 'eqChange', `${band}=${value}`),
    error: (err) => addEntry('error', 'PROC', 'error', err),
  },

  livekit: {
    connect: (url, room) => addEntry('info', 'LK', 'connect', `url=${url} room=${room}`),
    connected: () => addEntry('info', 'LK', 'connected'),
    disconnected: (reason) => addEntry('warn', 'LK', 'disconnected', reason),
    reconnecting: () => addEntry('info', 'LK', 'reconnecting'),
    error: (err) => addEntry('error', 'LK', 'error', err),
  },

  track: {
    publish: (name, source, trackId) => addEntry('info', 'TRACK', 'publish', `name=${name} source=${source} id=${trackId?.slice(0,8)}`),
    unpublish: (name, trackId) => addEntry('info', 'TRACK', 'unpublish', `name=${name} id=${trackId?.slice(0,8)}`),
    mute: (trackId, publicationId) => addEntry('info', 'TRACK', 'mute', `track=${trackId?.slice(0,8)} pub=${publicationId?.slice(0,8)}`),
    unmute: (trackId, publicationId) => addEntry('info', 'TRACK', 'unmute', `track=${trackId?.slice(0,8)} pub=${publicationId?.slice(0,8)}`),
    subscribed: (participantId, trackId, kind) => addEntry('info', 'TRACK', 'subscribed', `participant=${participantId?.slice(0,8)} track=${trackId?.slice(0,8)} kind=${kind}`),
    subscriptionFailed: (participantId, trackId, err) => addEntry('error', 'TRACK', 'subFailed', `participant=${participantId?.slice(0,8)} track=${trackId?.slice(0,8)} err=${err?.message ?? err}`),
    ended: (trackId) => addEntry('warn', 'TRACK', 'ended', `track=${trackId?.slice(0,8)}`),
  },

  participant: {
    joined: (identity, name) => addEntry('info', 'PART', 'joined', `identity=${identity} name=${name}`),
    left: (identity, name) => addEntry('info', 'PART', 'left', `identity=${identity} name=${name}`),
    metadataChanged: (identity, metadata) => addEntry('debug', 'PART', 'metaChange', `identity=${identity} meta=${JSON.stringify(metadata)}`),
  },

  audioOutput: {
    setSinkId: (elementCount, deviceId) => addEntry('info', 'AUDIO_OUT', 'setSinkId', `elements=${elementCount} deviceId=${deviceId}`),
    setSinkIdError: (err, deviceId) => addEntry('error', 'AUDIO_OUT', 'setSinkIdError', `deviceId=${deviceId} err=${err?.message ?? err}`),
    unsupported: () => addEntry('warn', 'AUDIO_OUT', 'setSinkId unsupported in this browser'),
  },

  ptt: {
    toggle: (enabled) => addEntry('info', 'PTT', 'toggle', enabled),
    talk: (down) => addEntry('debug', 'PTT', down ? 'down' : 'up'),
  },

  subroom: {
    create: (code) => addEntry('info', 'SUBROOM', 'create', code),
    join: (code) => addEntry('info', 'SUBROOM', 'join', code),
    leave: (code) => addEntry('info', 'SUBROOM', 'leave', code),
    switch: (from, to) => addEntry('info', 'SUBROOM', 'switch', `${from} -> ${to}`),
  },
};

// Auto-habilitar persistencia si hay flag en URL (?debug=1)
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') === '1') DebugLog.enablePersist(true);
}