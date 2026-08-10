import React from 'react';

/**
 * ZPingLogo — Placeholder monograma: Z + ondas de sonido.
 * Reemplazar/actualizar cuando el logo definitivo esté listo.
 */
export default function ZPingLogo({ className = '', style }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ZPing logo"
    >
      {/* Anillo exterior */}
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.25" />
      
      {/* Letra Z estilizada */}
      <path
        d="M13 14h13l-9 12h9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Ondas de sonido */}
      <path
        d="M29 16c1.5 1.5 1.5 6.5 0 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      <path
        d="M32 13c3 3 3 11 0 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  );
}
