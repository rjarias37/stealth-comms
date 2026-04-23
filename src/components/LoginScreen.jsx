import React, { useEffect, useState } from 'react';

export default function LoginScreen({
  onConnect,
  isLoading = false,
  errorMessage = '',
}) {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
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
        room: cleanedRoomCode,
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

  return (
    <div className="min-h-screen bg-[#0a1128] flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-64 h-64 mb-10 rounded-full flex items-center justify-center">
          <img
            src="/logo-tren.png"
            alt="El Tren de Algarve"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
        </div>

        <form onSubmit={handleConnect} className="w-full flex flex-col gap-4">
          <input
            type="text"
            placeholder="Ingresa tu Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#e2e8f0] text-[#0f172a] placeholder-gray-500 font-bold text-center rounded-full py-4 px-6 focus:outline-none focus:ring-4 focus:ring-accent transition-all"
            required
          />

          <input
            type="text"
            placeholder="Ingresa Codigo de Sala"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#e2e8f0] text-[#0f172a] placeholder-gray-500 font-bold text-center rounded-full py-4 px-6 focus:outline-none focus:ring-4 focus:ring-accent transition-all"
            required
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#e2e8f0] text-[#0f172a] font-bold uppercase tracking-wider text-center rounded-full py-4 px-6 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Conectando...' : 'Conectar'}
          </button>

          {deferredPrompt ? (
            <button
              type="button"
              onClick={handleInstallApp}
              className="w-full bg-transparent border border-[#e2e8f0]/50 text-[#e2e8f0] font-bold uppercase tracking-wider text-center rounded-full py-3 px-6 hover:bg-[#e2e8f0]/10 transition-colors"
            >
              {'\u2B07\uFE0F Instalar App'}
            </button>
          ) : null}
        </form>

        {errorMessage ? (
          <p className="mt-4 text-xs text-red-300 text-center">{errorMessage}</p>
        ) : null}

        <p className="mt-12 text-xs text-slate-500">Desarrollado by Raymond Arias</p>
      </div>
    </div>
  );
}
