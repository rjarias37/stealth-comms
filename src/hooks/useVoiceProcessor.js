import { useCallback, useEffect, useRef, useState } from 'react';

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

const VOICEMOD_WS_URL = 'ws://localhost:59129/v1/';
const VOICEMOD_REQUEST_TIMEOUT_MS = 5000;
const VOICEMOD_CLIENT_KEY = import.meta.env.PUBLIC_VOICEMOD_CLIENT_KEY?.trim() ?? '';

const createActionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `stealth-comms-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export function useVoiceProcessor() {
  const [currentVoiceId, setCurrentVoiceId] = useState('nofx');
  const [error, setError] = useState('');
  const [isChangingVoice, setChangingVoice] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [voices, setVoices] = useState(VOICEMOD_VOICES);

  const pendingRequestsRef = useRef(new Map());
  const registerPromiseRef = useRef(null);
  const registerResolverRef = useRef(null);
  const isUnmountedRef = useRef(false);
  const websocketRef = useRef(null);

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
    };
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
      setError(messageError);
      return;
    }

    if (registerResolverRef.current) {
      registerResolverRef.current();
      registerResolverRef.current = null;
      if (!isUnmountedRef.current) setConnected(true);
    }

    const voiceId = getVoiceIdFromMessage(message);
    if (voiceId) {
      setCurrentVoiceId(voiceId);
    }

    if (message?.actionType === 'getVoices') {
      const remoteVoices = message?.actionObject?.voices;
      if (Array.isArray(remoteVoices)) {
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
      throw new Error('PUBLIC_VOICEMOD_CLIENT_KEY no está configurada.');
    }

    if (typeof WebSocket === 'undefined') {
      throw new Error('WebSocket no está disponible en este navegador.');
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
        reject(new Error('Voicemod no respondió al registro del cliente.'));
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
        rejectPendingRequests(pendingRequestsRef.current, new Error('La conexión con Voicemod se cerró.'));
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
          reject(new Error(`Voicemod no confirmó la acción ${action}.`));
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
    setError('');

    try {
      return await sendVoicemodAction('getVoices', {});
    } catch (voicesError) {
      const message = voicesError instanceof Error ? voicesError.message : String(voicesError);
      setError(message);
      throw voicesError;
    }
  }, [sendVoicemodAction]);

  const changeVoicemodVoice = useCallback(
    async (voiceId) => {
      const cleanVoiceId = typeof voiceId === 'string' ? voiceId.trim() : '';
      if (!cleanVoiceId) {
        throw new Error('voiceId es obligatorio para cambiar la voz de Voicemod.');
      }

      setChangingVoice(true);
      setError('');

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
        setCurrentVoiceId(cleanVoiceId);
        return response;
      } catch (voiceError) {
        const message = voiceError instanceof Error ? voiceError.message : String(voiceError);
        setError(message);
        throw voiceError;
      } finally {
        setChangingVoice(false);
      }
    },
    [sendVoicemodAction]
  );

  return {
    changeVoicemodVoice,
    currentVoiceId,
    error,
    isChangingVoice,
    isConnected,
    isVoicemodConfigured: Boolean(VOICEMOD_CLIENT_KEY),
    refreshVoicemodVoices,
    voices,
  };
}
