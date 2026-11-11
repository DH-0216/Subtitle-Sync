import React from 'react'
import { Github, ExternalLink } from 'lucide-react'
import appIcon from '../assets/app_icon.png'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-center transition-colors">
        <div className="p-6">
          <img
            src={appIcon}
            alt="Subtitle Sync Studio"
            className="w-16 h-16 rounded-2xl object-contain mx-auto mb-3.5 shadow-xl shadow-blue-500/25"
          />

          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">Subtitle Sync Studio</h3>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-3">Version 2.0.0 (Electron Edition)</p>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
            A modern, high-precision desktop application to automatically synchronize out-of-sync
            subtitles with movie audio streams using standalone ffsubsync and FFmpeg.
          </p>

          <div className="bg-slate-50 dark:bg-[#0B0F19]/80 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 mb-4">
            <p className="font-semibold text-slate-900 dark:text-slate-200 mb-0.5">100% Free & Open Source</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Licensed under GNU GPL v3</p>
          </div>

          <a
            href="https://github.com/DH-0216/Subtitle-Sync"
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700/80 transition-colors shadow-2xs"
          >
            <Github className="w-4 h-4" /> View on GitHub <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-[#0B0F19] border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">Developed by DH-0216</span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
