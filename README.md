# Stealth Comms — El Tren de Algarve

> Aplicación de comunicaciones de voz táctica en tiempo real, construida con Astro + React + LiveKit.
> Versión actual: **V1.2** · Plataforma: [stealth-comms.vercel.app](https://stealth-comms.vercel.app)

---

## 🚀 Estructura del Proyecto

```text
stealth-comms/
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   └── logo-tren.png
├── src/
│   ├── components/
│   │   ├── CommsRoom.jsx       ← Sala de comunicaciones LiveKit + UI táctica
│   │   ├── LoginScreen.jsx     ← Pantalla de autenticación de operador
│   │   ├── StealthApp.jsx      ← Orquestador principal (sesión, canales, sub-rooms)
│   │   └── Welcome.astro
│   ├── hooks/
│   │   └── useVoiceProcessor.js  ← Motor de procesamiento de audio nativo (Web Audio API)
│   ├── layouts/
│   ├── pages/
│   │   ├── index.astro           ← Entry point — hidrata StealthApp con client:only
│   │   └── api/
│   │       └── getToken.js       ← Endpoint SSR: genera JWT de LiveKit
│   └── styles/
│       └── global.css
├── .env.example                  ← Plantilla de variables de entorno (segura para Git)
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

---

## 🎧 Arquitectura de Audio Híbrida (V1.2)

Stealth Comms implementa una arquitectura de procesamiento de audio en dos vías independientes, diseñadas para operar de forma aislada o en conjunto.

### Vía 1 — Procesamiento Nativo (Web Audio API)

El hook `src/hooks/useVoiceProcessor.js` actúa como un **interceptor de señal de audio** entre el micrófono del operador y el stream transmitido a LiveKit.

```
[Micrófono]
    │
    ▼
[getUserMedia Stream]
    │
    ▼
[AudioContext — Web Audio API]
    │
    ├─► [ClearMic Equalizer]     ← Highpass 150Hz + Presence 2.5kHz (+3dB)
    │       (activable on/off)
    │
    ├─► [Preset de Voz]          ← Robot / Demon / Small / Giant / Elder / Clean
    │       (conmutable en caliente sin reiniciar el contexto)
    │
    ├─► [Ecualizador Manual 3 Bandas]
    │       Bass   → lowshelf  200Hz  (±12dB)
    │       Mid    → peaking  2500Hz  (±12dB)
    │       Treble → highshelf 5000Hz (±12dB)
    │
    ▼
[MediaStreamDestination]         ← Stream procesado
    │
    ▼
[LiveKit — localParticipant.setMicrophoneEnabled()]
    │
    ▼
[WebRTC → Servidor LiveKit → Participantes remotos]
```

**Ciclo de vida del AudioContext:**
El hook implementa un ciclo de cierre completo en `release()`, que llama explícitamente a `context.close()` para liberar los recursos de CPU del cliente y prevenir fugas de memoria. Este `release()` se invoca automáticamente al desmontar el componente React mediante un `useEffect` cleanup.

**LiveKit no procesa el audio:** LiveKit se encarga exclusivamente del transporte WebRTC de baja latencia. El procesamiento de señal ocurre completamente en el cliente antes de que el stream llegue a LiveKit.

---

### Vía 2 — Control Remoto API Voicemod V3 (Opcional)

La integración con Voicemod V3 es **completamente opcional** y no interfiere con la Vía 1. Su propósito es convertir la aplicación web en un **control remoto táctico** para la aplicación de escritorio de Voicemod, que debe estar ejecutándose en la máquina del operador.

```
[Stealth Comms Web App]
    │
    │  HTTP → Localhost (puerto Voicemod)
    ▼
[Voicemod Desktop App — Control API]
    │   https://control-api.voicemod.net/
    │
    ▼
[Procesamiento de voz en tiempo real — Voicemod Engine]
```

**Variables de entorno requeridas para Voicemod:**

| Variable | Scope | Descripción |
|---|---|---|
| `PUBLIC_VOICEMOD_CLIENT_KEY` | Cliente (Astro `PUBLIC_`) | Clave de autenticación para la Control API de Voicemod V3 |

La clave se consume en el cliente mediante `import.meta.env.PUBLIC_VOICEMOD_CLIENT_KEY`. La URL de la Control API (`https://control-api.voicemod.net/`) **nunca debe hardcodearse** — debe gestionarse como variable de entorno si se necesita configurar el endpoint.

**Estado actual (V1.2):** La Vía 2 está en fase de integración. Los botones de control de Voicemod están visualmente aislados en la UI para el operador, sin afectar la funcionalidad de la Vía 1.

---

### Resumen de Variables de Entorno

| Variable | Scope | Requerida | Descripción |
|---|---|---|---|
| `LIVEKIT_API_KEY` | Solo servidor (SSR) | ✅ Sí | API Key del servidor LiveKit |
| `LIVEKIT_API_SECRET` | Solo servidor (SSR) | ✅ Sí | Secret del servidor LiveKit |
| `PUBLIC_LIVEKIT_URL` | Cliente + Servidor | ✅ Sí | URL WebSocket del servidor LiveKit (`wss://...`) |
| `PUBLIC_VOICEMOD_CLIENT_KEY` | Cliente | ⚙️ Opcional | Clave de cliente para Voicemod V3 Control API |

> Copia `.env.example` como `.env` y rellena los valores. **Nunca subas `.env` a Git.**

---

## 🔐 Seguridad del Endpoint `/api/getToken`

El endpoint SSR de generación de tokens implementa:
- **Sanitización estricta** de `username` y `roomName` con allowlist regex.
- **Identidad anónima** generada con `crypto.randomUUID()` — el nombre real del operador no se expone como `identity` en LiveKit.
- **TTL de 1 hora** por token de acceso.
- **`canPublishData: false`** — superficie de ataque minimizada.
- **`Cache-Control: no-store`** en todas las respuestas de token.

---

## 🧞 Comandos

Todos los comandos se ejecutan desde la raíz del proyecto:

| Comando | Acción |
| :--- | :--- |
| `npm install` | Instala dependencias |
| `npm run dev` | Servidor de desarrollo en `localhost:4321` |
| `npm run build` | Build de producción en `./dist/` |
| `npm run preview` | Preview local del build antes de desplegar |
| `npm run astro ...` | Comandos CLI de Astro |

---

## ☁️ Despliegue en Vercel

El proyecto usa el adaptador oficial `@astrojs/vercel` con output `static` + SSR híbrido para el endpoint de tokens.

**Inyección de variables de entorno en Vercel:**

```bash
# Mediante Vercel CLI
vercel env add LIVEKIT_API_KEY production
vercel env add LIVEKIT_API_SECRET production
vercel env add PUBLIC_LIVEKIT_URL production
vercel env add PUBLIC_VOICEMOD_CLIENT_KEY production   # opcional

# Verificar
vercel env ls
```

O desde el panel web: **Settings → Environment Variables** en el proyecto de Vercel.

---

## 📦 Stack Tecnológico

| Tecnología | Rol |
|---|---|
| [Astro 5](https://astro.build) | Framework SSG/SSR — estructura y routing |
| [React 19](https://react.dev) | UI de la sala de comunicaciones (`client:only`) |
| [LiveKit](https://livekit.io) | Transporte WebRTC en tiempo real |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | Procesamiento de señal de audio nativo |
| [Tailwind CSS v4](https://tailwindcss.com) | Estilos tácticos |
| [Vite PWA](https://vite-pwa-org.netlify.app) | Progressive Web App — instalable |
| [Vercel](https://vercel.com) | Plataforma de despliegue |

---

*Stealth Comms — Nébula Code © 2026*
