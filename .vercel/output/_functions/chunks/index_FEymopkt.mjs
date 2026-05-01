import { c as createComponent } from './astro-component_BR7GloKI.mjs';
import 'piccolore';
import { l as createRenderInstruction, n as renderHead, o as renderComponent, r as renderTemplate } from './entrypoint_DtLPzJAu.mjs';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useEffect, useMemo } from 'react';
import { LiveKitRoom, useParticipants, useLocalParticipant, RoomAudioRenderer, useIsSpeaking } from '@livekit/components-react';
import { PhoneOff, Mic, MicOff, Headphones } from 'lucide-react';

async function renderScript(result, id) {
  const inlined = result.inlinedScripts.get(id);
  let content = "";
  if (inlined != null) {
    if (inlined) {
      content = `<script type="module">${inlined}</script>`;
    }
  } else {
    const resolved = await result.resolve(id);
    content = `<script type="module" src="${result.userAssetsBase ? (result.base === "/" ? "" : result.base) + result.userAssetsBase : ""}${resolved}"></script>`;
  }
  return createRenderInstruction({ type: "script", id, content });
}

function LoginScreen({
  onConnect,
  isLoading = false,
  errorMessage = ""
}) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);
  const handleConnect = (e) => {
    e.preventDefault();
    if (isLoading) {
      return;
    }
    const cleanedNickname = nickname.trim();
    const cleanedRoomCode = roomCode.trim();
    if (cleanedNickname.length > 0 && cleanedRoomCode.length > 0) {
      onConnect({
        nickname: cleanedNickname,
        room: cleanedRoomCode
      });
    }
  };
  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };
  return /* @__PURE__ */ jsx("div", { className: "min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-sm flex flex-col items-center", children: [
    /* @__PURE__ */ jsx("div", { className: "w-64 h-64 mb-10 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx(
      "img",
      {
        src: "/logo-tren.png",
        alt: "El Tren de Algarve",
        className: "w-full h-full object-contain drop-shadow-2xl"
      }
    ) }),
    /* @__PURE__ */ jsxs("form", { onSubmit: handleConnect, className: "w-full flex flex-col gap-4", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Ingresa tu Nickname",
          value: nickname,
          onChange: (e) => setNickname(e.target.value),
          disabled: isLoading,
          className: "w-full bg-[#e2e8f0] text-[#0f172a] placeholder-gray-500 font-bold text-center rounded-full py-4 px-6 focus:outline-none focus:ring-4 focus:ring-accent transition-all",
          required: true
        }
      ),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          placeholder: "Ingresa Codigo de Sala",
          value: roomCode,
          onChange: (e) => setRoomCode(e.target.value),
          disabled: isLoading,
          className: "w-full bg-[#e2e8f0] text-[#0f172a] placeholder-gray-500 font-bold text-center rounded-full py-4 px-6 focus:outline-none focus:ring-4 focus:ring-accent transition-all",
          required: true
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "submit",
          disabled: isLoading,
          className: "w-full bg-[#e2e8f0] text-[#0f172a] font-bold uppercase tracking-wider text-center rounded-full py-4 px-6 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          children: isLoading ? "Conectando..." : "Conectar"
        }
      ),
      deferredPrompt ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: handleInstallApp,
          className: "w-full bg-transparent border border-[#e2e8f0]/50 text-[#e2e8f0] font-bold uppercase tracking-wider text-center rounded-full py-3 px-6 hover:bg-[#e2e8f0]/10 transition-colors",
          children: "⬇️ Instalar App"
        }
      ) : null
    ] }),
    errorMessage ? /* @__PURE__ */ jsx("p", { className: "mt-4 text-xs text-red-300 text-center", children: errorMessage }) : null,
    /* @__PURE__ */ jsx("p", { className: "mt-12 text-xs text-slate-500", children: "Desarrollado by Raymond Arias" })
  ] }) });
}

function getParticipantName(participant) {
  return participant?.name?.trim() || participant?.identity || "Invitado";
}
function getInitials(value) {
  const name = value.trim();
  if (!name) {
    return "NA";
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
  return /* @__PURE__ */ jsxs("div", { className: "bg-[#0f172a] rounded-xl p-3 flex items-center justify-between shadow-sm", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: `w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isSpeaking ? "ring-2 ring-green-500 bg-slate-700" : "bg-slate-700"}`,
          children: getInitials(displayName)
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "font-semibold", children: displayName })
    ] }),
    isMuted ? /* @__PURE__ */ jsx(MicOff, { size: 18, className: "text-red-500" }) : /* @__PURE__ */ jsx(Mic, { size: 18, className: "text-slate-400" })
  ] });
}
function CommsRoomUI({ nickname, roomName, onDisconnect }) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const [isUpdatingMic, setIsUpdatingMic] = useState(false);
  const [isHeadphonesMuted, setIsHeadphonesMuted] = useState(false);
  const activeRoomName = roomName?.trim() || "Sala";
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
      console.error("Error disconnecting from LiveKit room:", error);
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
      console.error("Error toggling microphone state:", error);
    } finally {
      setIsUpdatingMic(false);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(RoomAudioRenderer, { muted: isHeadphonesMuted }),
    /* @__PURE__ */ jsxs("div", { className: "w-full max-w-sm flex flex-col h-[700px] bg-[#0f172a] rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative", children: [
      /* @__PURE__ */ jsxs("div", { className: "p-6 flex flex-col items-center border-b border-slate-800", children: [
        /* @__PURE__ */ jsx(
          "img",
          {
            src: "/logo-tren.png",
            alt: "Logo",
            className: "w-24 h-24 object-contain mb-4 drop-shadow-lg"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "w-full bg-[#e2e8f0] text-[#0f172a] rounded-full py-3 px-6 flex justify-between items-center font-bold", children: [
          /* @__PURE__ */ jsx("span", { children: activeRoomName }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-xs", children: [
            /* @__PURE__ */ jsx("span", { className: "w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" }),
            sortedParticipants.length,
            " online"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex-1 p-6 overflow-y-auto bg-slate-200 rounded-t-3xl mt-4 mx-2", children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: sortedParticipants.length > 0 ? sortedParticipants.map((participant) => /* @__PURE__ */ jsx(
        ParticipantRow,
        {
          participant
        },
        participant.sid || participant.identity
      )) : /* @__PURE__ */ jsxs("div", { className: "bg-[#0f172a] rounded-xl p-3 text-sm text-slate-300", children: [
        "Conectando a la sala como ",
        nickname,
        "..."
      ] }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "bg-[#0f172a] p-4 flex justify-between items-center border-t border-slate-800 pb-8", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleDisconnectClick,
              className: "w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-red-100 transition-colors",
              children: /* @__PURE__ */ jsx(PhoneOff, { size: 20, className: "text-red-600" })
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-1 text-slate-400 uppercase font-bold", children: "Salir" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: handleToggleMic,
              disabled: !localParticipant || isUpdatingMic,
              className: "w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors disabled:opacity-60",
              children: isMicrophoneEnabled ? /* @__PURE__ */ jsx(Mic, { size: 20, className: "text-slate-700" }) : /* @__PURE__ */ jsx(MicOff, { size: 20, className: "text-red-600" })
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-1 text-slate-400 uppercase font-bold", children: isMicrophoneEnabled ? "Mutear" : "Activar" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => setIsHeadphonesMuted((current) => !current),
              className: "w-12 h-12 bg-[#e2e8f0] rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors",
              children: /* @__PURE__ */ jsx(
                Headphones,
                {
                  size: 20,
                  className: isHeadphonesMuted ? "text-red-600" : "text-slate-700"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] mt-1 text-slate-400 uppercase font-bold", children: isHeadphonesMuted ? "Escuchar" : "Silenciar" })
        ] })
      ] })
    ] })
  ] });
}
function CommsRoom({
  nickname,
  roomName,
  token,
  serverUrl,
  onDisconnect
}) {
  const [connectionError, setConnectionError] = useState("");
  if (!serverUrl) {
    return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-red-300 text-center max-w-sm", children: "Falta configurar PUBLIC_LIVEKIT_URL en tu archivo .env." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: onDisconnect,
          className: "mt-4 px-4 py-2 bg-[#e2e8f0] text-[#0f172a] rounded-full font-bold",
          children: "Volver"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs(
    LiveKitRoom,
    {
      token,
      serverUrl,
      connect: Boolean(token && serverUrl),
      audio: true,
      video: false,
      className: "min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white",
      onDisconnected: onDisconnect,
      onError: (error) => {
        console.error("LiveKit room error:", error);
        setConnectionError(error.message);
      },
      children: [
        /* @__PURE__ */ jsx(
          CommsRoomUI,
          {
            nickname,
            roomName,
            onDisconnect
          }
        ),
        connectionError ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-red-300", children: connectionError }) : null
      ]
    }
  );
}

function StealthApp() {
  const [nickname, setNickname] = useState(null);
  const [roomName, setRoomName] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const handleConnect = async ({ nickname: name, room }) => {
    const cleanedName = typeof name === "string" ? name.trim() : "";
    const cleanedRoom = typeof room === "string" ? room.trim() : "";
    if (!cleanedName || !cleanedRoom) {
      return;
    }
    setIsLoadingToken(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/getToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanedName,
          roomName: cleanedRoom
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token) {
        throw new Error(
          payload.error ?? "No fue posible obtener el token de acceso."
        );
      }
      setNickname(cleanedName);
      setRoomName(payload.roomName ?? cleanedRoom);
      setToken(payload.token);
    } catch (error) {
      setNickname(null);
      setRoomName(null);
      setToken(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Error inesperado al solicitar el token."
      );
    } finally {
      setIsLoadingToken(false);
    }
  };
  const handleDisconnect = () => {
    setNickname(null);
    setRoomName(null);
    setToken(null);
    setErrorMessage("");
  };
  if (!nickname || !roomName || !token) {
    return /* @__PURE__ */ jsx(
      LoginScreen,
      {
        onConnect: handleConnect,
        isLoading: isLoadingToken,
        errorMessage
      }
    );
  }
  return /* @__PURE__ */ jsx(
    CommsRoom,
    {
      nickname,
      roomName,
      token,
      serverUrl: "wss://my-valkie-talkie-v1-z6nfzti3.livekit.cloud",
      onDisconnect: handleDisconnect
    }
  );
}

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`<html lang="es"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="description" content="El Tren de Algarve"><meta name="application-name" content="Stealth Comms"><meta name="theme-color" content="#0a1128"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Stealth Comms"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" type="image/png" href="/logo-tren.png"><link rel="apple-touch-icon" href="/logo-tren.png"><title>Stealth Comms | El Tren de Algarve</title>${renderScript($$result, "E:/Proyecto Walki Talki/stealth-comms/src/pages/index.astro?astro&type=script&index=0&lang.ts")}${renderHead()}</head> <body class="bg-[#0a1128]"> ${renderComponent($$result, "StealthApp", StealthApp, { "client:load": true, "client:component-hydration": "load", "client:component-path": "E:/Proyecto Walki Talki/stealth-comms/src/components/StealthApp.jsx", "client:component-export": "default" })} </body></html>`;
}, "E:/Proyecto Walki Talki/stealth-comms/src/pages/index.astro", void 0);

const $$file = "E:/Proyecto Walki Talki/stealth-comms/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
