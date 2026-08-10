import React from 'react';
import ZPingLogo from './ZPingLogo.jsx';

/**
 * ChannelHeader — Barra superior ZPing.
 * @param {{ channelId: string, displayName: string, screenActive: boolean, onChangeChannel: () => void }} props
 */
export default function ChannelHeader({
  channelId,
  displayName,
  screenActive,
  onChangeChannel,
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-z-base/90 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto max-w-md h-full px-4 flex items-center justify-between">
        {/* Logo + identidad */}
        <div className="flex items-center gap-2.5 min-w-0">
          <ZPingLogo className="w-7 h-7 text-z-cyan shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-sm tracking-wide text-z-primary">ZPING</span>
            <span className="text-[10px] text-z-muted tracking-wider">BETA</span>
          </div>
        </div>

        {/* Selector de canal */}
        <button
          type="button"
          onClick={onChangeChannel}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-z-surface border border-white/10 hover:border-z-cyan/40 transition-colors"
          title="Cambiar canal"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-z-success animate-pulse-cyan" />
          <span className="font-mono text-xs text-z-secondary uppercase tracking-wider truncate max-w-[100px]">
            {channelId || 'OFFLINE'}
          </span>
        </button>

        {/* Estado de pantalla activa */}
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-z-secondary shrink-0">
          {screenActive ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-z-success" />
              <span className="hidden sm:inline">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-z-muted" />
              <span className="hidden sm:inline">IDLE</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
