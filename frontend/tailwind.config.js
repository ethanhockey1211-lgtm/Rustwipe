/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rust: {
          50:  '#fff3ee',
          100: '#ffe4d3',
          200: '#ffc5a5',
          300: '#ff9d6d',
          400: '#ff6a32',
          500: '#e05a1d',
          600: '#cd3d00',
          700: '#a83100',
          800: '#8a2b06',
          900: '#72270c',
        },
        dark: {
          50:  '#f8fafc',
          100: '#e2e8f0',
          200: '#94a3b8',
          300: '#64748b',
          400: '#475569',
          500: '#334155',
          600: '#1e293b',
          700: '#0f172a',
          800: '#0d1117',
          900: '#080d14',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
