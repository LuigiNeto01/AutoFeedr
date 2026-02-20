/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        bg: '#070b14',
        surface: '#0f1627',
        panel: '#121b2f',
        border: '#2a3a5f',
        accent: '#1cb4c8',
        running: '#1f6feb',
        success: '#13a96d',
        warning: '#d59724',
        danger: '#d14c63',
        muted: '#8ea3c9',
      },
      boxShadow: {
        panel: '0 12px 40px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'fade-slide': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-slide': 'fade-slide 180ms ease-out',
      },
    },
  },
  plugins: [],
}
