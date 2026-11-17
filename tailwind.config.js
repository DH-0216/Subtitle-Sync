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
        // Centralized Semantic Theme Tokens (Mapped to CSS variables per active theme)
        app: {
          canvas: 'var(--app-canvas-bg)',
          text: 'var(--app-text-main)',
          'text-muted': 'var(--app-text-muted)',

          header: 'var(--app-header-bg)',
          'header-border': 'var(--app-header-border)',

          footer: 'var(--app-footer-bg)',
          'footer-border': 'var(--app-footer-border)',
          'footer-text': 'var(--app-footer-text)',

          sidebar: 'var(--app-sidebar-bg)',
          'sidebar-border': 'var(--app-sidebar-border)',
          'sidebar-hover': 'var(--app-sidebar-hover)',
          'sidebar-status': 'var(--app-sidebar-status-bg)',
          'sidebar-status-border': 'var(--app-sidebar-status-border)',

          card: 'var(--app-card-bg)',
          'card-locked': 'var(--app-card-locked-bg)',
          'card-border': 'var(--app-card-border)',
          'card-header': 'var(--app-card-header)',
          'card-header-border': 'var(--app-card-header-border)',
          'card-inner': 'var(--app-card-inner-bg)',
          'card-inner-border': 'var(--app-card-inner-border)',
          'card-inner-hover': 'var(--app-card-inner-hover)',

          modal: 'var(--app-modal-bg)',
          'modal-border': 'var(--app-modal-border)',
          'modal-header': 'var(--app-modal-header-bg)',
          'modal-header-border': 'var(--app-modal-header-border)',
          'modal-sidebar': 'var(--app-modal-sidebar-bg)',
          'modal-sidebar-border': 'var(--app-modal-sidebar-border)',

          input: 'var(--app-input-bg)',
          'input-border': 'var(--app-input-border)',
          'input-text': 'var(--app-input-text)',

          btn: 'var(--app-btn-secondary-bg)',
          'btn-hover': 'var(--app-btn-secondary-hover)',
          'btn-border': 'var(--app-btn-secondary-border)',
          'btn-text': 'var(--app-btn-secondary-text)',

          dropzone: 'var(--app-dropzone-bg)',
          'dropzone-border': 'var(--app-dropzone-border)',
          'dropzone-hover': 'var(--app-dropzone-hover-bg)',
          'dropzone-hover-border': 'var(--app-dropzone-hover-border)',
          'dropzone-drag': 'var(--app-dropzone-drag-bg)',
          'dropzone-icon-bg': 'var(--app-dropzone-icon-bg)',
          'dropzone-icon-border': 'var(--app-dropzone-icon-border)',
          'dropzone-icon-text': 'var(--app-dropzone-icon-text)',

          primary: 'var(--app-primary-bg)',
          'primary-hover': 'var(--app-primary-hover-bg)',
          'primary-fg': 'var(--app-primary-fg)',

          accent: 'var(--app-accent-text)',
          'accent-hover': 'var(--app-accent-hover)',
          'accent-bg': 'var(--app-accent-bg)',
          'accent-border': 'var(--app-accent-border)'
        },
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
