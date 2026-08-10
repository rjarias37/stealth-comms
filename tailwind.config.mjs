/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'z-base': '#0A0B0F',
        'z-surface': '#14161F',
        'z-elevated': '#1C1F2A',
        'z-overlay': '#23283A',

        // Accents
        'z-cyan': '#00E5FF',
        'z-cyan-dim': '#00A3B3',
        'z-cyan-bright': '#33EBFF',
        'z-magenta': '#B829F7',
        'z-magenta-dim': '#8A1DBF',

        // Signals
        'z-success': '#00FF94',
        'z-warning': '#FFB800',
        'z-error': '#FF4D6D',

        // Text
        'z-primary': '#F0F2F5',
        'z-secondary': '#8B91A7',
        'z-muted': '#5B6275',
      },
      fontFamily: {
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'z-sm': '6px',
        'z-md': '10px',
        'z-lg': '16px',
        'z-xl': '20px',
      },
      boxShadow: {
        'cyan-glow': '0 0 24px rgba(0, 229, 255, 0.25)',
        'cyan-glow-lg': '0 0 40px rgba(0, 229, 255, 0.15)',
        'magenta-glow': '0 0 24px rgba(184, 41, 247, 0.20)',
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s ease-in-out infinite',
        'cyan-ring': 'cyan-ring 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'cyan-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 229, 255, 0.25)' },
          '50%': { boxShadow: '0 0 0 8px transparent' },
        },
      },
    },
  },
  plugins: [],
};
