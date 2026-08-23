import { useCallback, useEffect, useState } from 'react';
import { DebugLog } from './debugLog.js';

// ─── Persistencia en localStorage ────────────────────────────────────────────
const STORAGE_KEY_MIC = 'zping_mic_device_id';
const STORAGE_KEY_OUTPUT = 'zping_output_device_id';

function readStored(key) {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStored(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // localStorage puede estar bloqueado (modo incógnito, etc.)
  }
}

/**
 * Hook para enumerar y seleccionar dispositivos de audio.
 *
 * - Lista micrófonos (audioinput) y salidas (audiooutput)
 * - Persiste la selección en localStorage para recordar entre sesiones
 * - Reacciona a `devicechange` (conectar/desconectar USB, Bluetooth, etc.)
 * - Nota: los labels de los dispositivos solo están disponibles después de
 *   que el usuario concede permiso de micrófono. Antes de eso, el navegador
 *   los muestra como "Dispositivo 1", "Dispositivo 2", etc.
 */
export function useMediaDevices() {
  const [audioInputs, setAudioInputs] = useState([]);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState(() => readStored(STORAGE_KEY_MIC));
  const [selectedOutputId, setSelectedOutputId] = useState(() => readStored(STORAGE_KEY_OUTPUT));

  const enumerate = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioInputs(audioInputs);
      setAudioOutputs(audioOutputs);
      DebugLog.device.enumerate({ audioInputs, audioOutputs });
    } catch (err) {
      console.warn('useMediaDevices: enumerateDevices failed', err);
      DebugLog.error('DEVICE', 'enumerate failed', err);
    }
  }, []);

  // Enumerar al montar + escuchar devicechange
  useEffect(() => {
    void enumerate();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return undefined;

    const onChange = () => {
      DebugLog.device.devicechange();
      void enumerate();
    };
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
    };
  }, [enumerate]);

  const switchMicrophone = useCallback((deviceId) => {
    const device = audioInputs.find((d) => d.deviceId === deviceId);
    DebugLog.device.selectMic(deviceId, device?.label ?? 'unknown');
    setSelectedMicId(deviceId);
    writeStored(STORAGE_KEY_MIC, deviceId);
  }, [audioInputs]);

  const switchAudioOutput = useCallback((deviceId) => {
    const device = audioOutputs.find((d) => d.deviceId === deviceId);
    DebugLog.device.selectOutput(deviceId, device?.label ?? 'unknown');
    setSelectedOutputId(deviceId);
    writeStored(STORAGE_KEY_OUTPUT, deviceId);
  }, [audioOutputs]);

  return {
    audioInputs,
    audioOutputs,
    selectedMicId,
    selectedOutputId,
    switchMicrophone,
    switchAudioOutput,
    refreshDevices: enumerate,
  };
}
