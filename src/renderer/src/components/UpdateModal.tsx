import React, { useEffect } from 'react'
import {
  X,
  Sparkles,
  Download,
  Loader2,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react'
import { UserFriendlyReleaseNotes } from './UserFriendlyReleaseNotes'

export interface AppUpdateData {
  updateAvailable: boolean
  currentVersion: string
  latestVersion?: string
  releaseName?: string
  releaseNotes?: string
  publishedAt?: string
  downloadUrl?: string
  assetName?: string
  assetSize?: number
  releaseUrl?: string
}

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: AppUpdateData | null
  isDownloading: boolean
  downloadProgress: number
  downloadSpeed?: string
  downloadedBytes?: number
  totalBytes?: number
  errorMessage?: string | null
  onDownloadAndInstall: (downloadUrl: string) => void
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

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isDownloading,
  downloadProgress,
  downloadSpeed = '0 MB/s',
  downloadedBytes = 0,
  totalBytes = 0,
  errorMessage,
  onDownloadAndInstall,
  onCancelDownload
}) => {
  // ESC to close if not downloading
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDownloading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDownloading, onClose])

  if (!isOpen || !updateInfo) return null

  const targetUrl = updateInfo.downloadUrl || updateInfo.releaseUrl || ''

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>New Update Available</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  v{updateInfo.latestVersion}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A new version of Subtitle Sync Studio is ready to download
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Version Transition Banner */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111625] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="text-slate-500 dark:text-slate-400 font-normal">Installed:</span>
              <span className="font-mono bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">
                v{updateInfo.currentVersion}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mx-1" />
              <span className="text-slate-500 dark:text-slate-400 font-normal">Latest:</span>
              <span className="font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                v{updateInfo.latestVersion}
              </span>
            </div>

            {updateInfo.assetSize && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Size: ~{formatBytes(updateInfo.assetSize)}
              </span>
            )}
          </div>

          {/* Release Notes Changelog (User-Friendly Display) */}
          <UserFriendlyReleaseNotes
            releaseNotes={updateInfo.releaseNotes}
            releaseUrl={updateInfo.releaseUrl}
            latestVersion={updateInfo.latestVersion}
          />

          {/* Live Download Progress Section */}
          {isDownloading && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-950 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>
                    {downloadProgress >= 100
                      ? 'Download complete! Launching setup wizard...'
                      : 'Downloading update installer...'}
                  </span>
                </div>
                <span>{Math.round(downloadProgress)}%</span>
              </div>

              {/* Progress Bar Track */}
              <div className="w-full h-2.5 bg-blue-200/60 dark:bg-blue-900/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, downloadProgress))}%` }}
                />
              </div>

              {/* Speed & Stats */}
              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <span>
                  {formatBytes(downloadedBytes)} / {formatBytes(totalBytes || updateInfo.assetSize)}
                </span>
                <span className="font-mono font-medium">{downloadSpeed}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Official release verified from GitHub. Once downloaded, the installer will run automatically.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-3">
          {isDownloading ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onCancelDownload}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel Download
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Remind Me Later
              </button>

              <div className="flex items-center gap-2">
                {updateInfo.downloadUrl ? (
                  <button
                    type="button"
                    onClick={() => onDownloadAndInstall(updateInfo.downloadUrl!)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-800 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download &amp; Install</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.api?.shell?.openExternal(targetUrl)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-800 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open GitHub Release</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
