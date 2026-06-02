/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#1a1a2e', light: '#f5f5f5' },
        surface: { DEFAULT: '#1e1e30', light: '#ffffff' },
        primary: { DEFAULT: '#FF6B35', light: '#FF8C42', pale: '#FFB347' },
        accent: '#FFD93D',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
