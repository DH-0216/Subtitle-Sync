import React from 'react'
import { Github, ExternalLink } from 'lucide-react'
import appIcon from '../assets/app_icon.png'
import { EXTERNAL_LINKS } from '@shared/links'
import { APP_VERSION } from '@shared/version'
import { useUIStore } from '../store'

interface AboutModalProps {
  isOpen?: boolean
  onClose?: () => void
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose
}) => {
  const storeIsOpen = useUIStore((s) => s.aboutModalOpen)
  const storeClose = () => useUIStore.getState().setAboutModalOpen(false)

  const isOpen = propIsOpen ?? storeIsOpen
  const onClose = propOnClose ?? storeClose

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-app-card border border-app-card-border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-center transition-colors">
        <div className="p-6">
          <img
            src={appIcon}
            alt="Subtitle Sync Studio"
            className="w-16 h-16 rounded-2xl object-contain mx-auto mb-3.5 shadow-xl shadow-blue-500/25"
          />

          <h3 className="font-bold text-lg text-app-text tracking-tight">Subtitle Sync Studio</h3>
          <p className="text-xs text-app-accent font-semibold mb-3">Version {APP_VERSION} (Electron Edition)</p>

          <p className="text-xs text-app-text-muted leading-relaxed mb-4">
            A modern, high-precision desktop application to automatically synchronize out-of-sync
            subtitles with movie audio streams using standalone ffsubsync and FFmpeg.
          </p>

          <div className="bg-app-card-inner rounded-xl p-3 text-xs text-app-text border border-app-card-inner-border mb-4">
            <p className="font-semibold text-app-text mb-0.5">100% Free & Open Source</p>
            <p className="text-[11px] text-app-text-muted">Licensed under GNU GPL v3</p>
          </div>

          <a
            href={EXTERNAL_LINKS.GITHUB_REPO}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-app-btn hover:bg-app-btn-hover text-app-btn-text flex items-center justify-center gap-2 border border-app-btn-border transition-colors shadow-2xs"
          >
            <Github className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3.5 h-3.5 text-app-text-muted" />
          </a>
        </div>

        <div className="px-5 py-3 bg-app-header border-t border-app-header-border flex justify-between items-center text-[11px] text-app-text-muted">
          <span className="font-medium text-app-text">Developed by DH-0216</span>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text transition-colors font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
