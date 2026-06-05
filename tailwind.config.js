/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#ffffff', light: '#ffffff' },
        surface: { DEFAULT: '#f8fafc', light: '#f8fafc' },
        primary: {
          DEFAULT: '#22c55e',
          light: '#86efac',
          dark: '#16a34a',
        },
        accent: '#f59e0b',
        text: {
          primary: '#000000',
          secondary: '#1f2937',
          muted: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'soft': '0 2px 12px rgba(0,0,0,0.03)',
        'soft-up': '0 -2px 12px rgba(0,0,0,0.03)',
        'glow': '0 0 20px rgba(34,197,94,0.15)',
      },
      animation: {
        'scan': 'scan 1.8s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'draw-arc': 'drawArc 1.5s ease-out forwards',
        'count-up': 'countUp 0.8s ease-out forwards',
        'slide-in': 'slideIn 0.4s ease-out forwards',
      },
      keyframes: {
        scan: {
          '0%': { top: '0%', opacity: '0.6' },
          '50%': { opacity: '0.3' },
          '100%': { top: '100%', opacity: '0' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        drawArc: {
          from: { strokeDashoffset: '660' },
          to: { strokeDashoffset: '0' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
