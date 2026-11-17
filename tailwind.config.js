/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Electric Vibrant Blue
          600: '#2563eb', // Primary Action
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        },
        slate: {
          850: '#151e2e',
          950: '#0b0f19'
        },
        smBlue: {
          100: '#174082',
          80: '#2252A0',
          60: '#3566B6',
          20: '#B6CFF7',
          15: '#CADEFC',
          10: '#E0ECFF',
          5: '#F2F7FD',
          canvas: '#E8F1FC'
        }
      }
    }
  },
  plugins: []
}
