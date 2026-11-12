import React, { useEffect } from 'react'
import { X, Cpu, Download, Loader2, AlertCircle, HardDrive } from 'lucide-react'

interface ModelDownloadModalProps {
  isOpen: boolean
  onClose: () => void
  modelQuality: 'tiny' | 'base' | 'small' | 'medium'
  isDownloading: boolean
  downloadProgress: number
  downloadSpeed?: string
  downloadedBytes?: number
  totalBytes?: number
  errorMessage?: string | null
  onStartDownload: () => void
  onCancelDownload: () => void
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return `${mb.toFixed(1)} MB`
}

export const ModelDownloadModal: React.FC<ModelDownloadModalProps> = ({
  isOpen,
  onClose,
  modelQuality,
  isDownloading,
  downloadProgress,
  downloadSpeed,
  downloadedBytes,
  totalBytes,
  errorMessage,
  onStartDownload,
  onCancelDownload
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDownloading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDownloading, onClose])

  if (!isOpen) return null

  const modelInfoMap = {
    tiny: { name: 'ggml-tiny.bin', size: '~75 MB', desc: 'Ultra-fast transcription model' },
    base: { name: 'ggml-base.bin', size: '~140 MB', desc: 'Fast & balanced transcription model' },
    small: { name: 'ggml-small.bin', size: '~460 MB', desc: 'High precision movie transcription model' },
    medium: { name: 'ggml-medium.bin', size: '~1.5 GB', desc: 'Maximum accuracy transcription model' }
  }

  const currentInfo = modelInfoMap[modelQuality] || modelInfoMap.small

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) onClose()
      }}
    >
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-[480px] shadow-2xl p-6 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Whisper AI Model Required
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                One-time download for offline speech transcription
              </p>
            </div>
          </div>

          {!isDownloading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Model Card Info */}
        <div className="p-4 rounded-xl border border-blue-200/90 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-xs text-blue-900 dark:text-blue-200">
              {currentInfo.name}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300">
              {currentInfo.size}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {currentInfo.desc}. Stored locally in your app folder so you can transcribe speech completely offline anytime.
          </p>

          <div className="pt-2 border-t border-blue-100/60 dark:border-blue-900/30 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <HardDrive className="w-3.5 h-3.5" />
            <span>Saved permanently to local storage</span>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Live Progress Bar when downloading */}
        {isDownloading ? (
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Downloading model...
                </span>
              </div>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {Math.round(downloadProgress)}%
              </span>
            </div>

            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(3, downloadProgress))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes) || currentInfo.size}</span>
              <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                {downloadSpeed || 'Calculating speed...'}
              </span>
            </div>

            <button
              type="button"
              onClick={onCancelDownload}
              className="w-full py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              Cancel Download
            </button>
          </div>
        ) : (
          /* Action Buttons */
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onStartDownload}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30 active:scale-[0.99] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Start Download ({currentInfo.size})</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
