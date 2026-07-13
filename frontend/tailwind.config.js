/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1437',
          800: '#111C44',
          700: '#1B254B',
        },
        accent: {
          DEFAULT: '#4318FF',
          500: '#4318FF',
          600: '#3311DB',
        },
        muted: '#A3AED0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};