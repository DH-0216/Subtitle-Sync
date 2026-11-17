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
  ShieldCheck,
  RefreshCw
} from 'lucide-react'
import { UserFriendlyReleaseNotes } from './UserFriendlyReleaseNotes'
import { compareVersions } from '@shared/version'

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
  deltaSize?: number
  isDeltaAvailable?: boolean
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
  isUpdateReady?: boolean
  onRestartToApply?: () => void
  onRestartLater?: () => void
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
  isUpdateReady = false,
  onRestartToApply,
  onRestartLater,
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

  if (!isOpen || !updateInfo || !updateInfo.updateAvailable) return null

  // Safety guard: Never show update modal if latest version is not strictly newer than current version
  if (
    updateInfo.latestVersion &&
    updateInfo.currentVersion &&
    compareVersions(updateInfo.latestVersion, updateInfo.currentVersion) <= 0
  ) {
    return null
  }

  const targetUrl = updateInfo.downloadUrl || updateInfo.releaseUrl || ''

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-app-modal border border-app-modal-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-app-modal-header-border flex items-center justify-between bg-app-modal-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-app-text flex items-center gap-2">
                <span>New Update Available</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  v{updateInfo.latestVersion}
                </span>
              </h3>
              <p className="text-xs text-app-text-muted mt-0.5">
                {isUpdateReady
                  ? 'Update downloaded and ready to apply'
                  : 'A new version of Subtitle Sync Studio is ready to download'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={isUpdateReady && onRestartLater ? onRestartLater : onClose}
            disabled={isDownloading}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors disabled:opacity-40 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Version Transition Banner */}
          <div className="p-3.5 rounded-xl border border-app-card-inner-border bg-app-card-inner flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-app-text">
              <span className="text-app-text-muted font-normal">Installed:</span>
              <span className="font-mono bg-app-card-inner-hover px-2 py-0.5 rounded text-app-text">
                v{updateInfo.currentVersion}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mx-1" />
              <span className="text-app-text-muted font-normal">Latest:</span>
              <span className="font-mono bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                v{updateInfo.latestVersion}
              </span>
            </div>

            {(updateInfo.assetSize || updateInfo.deltaSize) && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-text-muted">
                <span>Size:</span>
                {updateInfo.isDeltaAvailable || (totalBytes > 0 && totalBytes < (updateInfo.assetSize || 0) * 0.9) ? (
                  <span className="font-mono text-app-text">
                    ~{formatBytes(totalBytes > 0 ? totalBytes : updateInfo.deltaSize || 20 * 1024 * 1024)} (Delta)
                  </span>
                ) : (
                  <span className="font-mono text-app-text">
                    ~{formatBytes(updateInfo.assetSize)}
                  </span>
                )}
              </div>
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
                      ? 'Download complete! Ready to apply...'
                      : (updateInfo.isDeltaAvailable || (totalBytes > 0 && updateInfo.assetSize && totalBytes < updateInfo.assetSize * 0.9))
                      ? 'Downloading fast delta patch...'
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
              <div className="flex items-center justify-between text-[11px] text-app-text-muted">
                <span className="flex items-center gap-1.5">
                  <span>{formatBytes(downloadedBytes)} / {formatBytes(totalBytes || updateInfo.deltaSize || updateInfo.assetSize)}</span>
                  {updateInfo.assetSize && (totalBytes || updateInfo.deltaSize) && (totalBytes || updateInfo.deltaSize!) < updateInfo.assetSize * 0.9 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      (⚡ Saved {formatBytes(updateInfo.assetSize - (totalBytes || updateInfo.deltaSize!))}!)
                    </span>
                  )}
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

          <div className="flex items-center gap-2 text-[11px] text-app-text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              {isUpdateReady
                ? 'Update is downloaded and ready. Restart whenever you are ready to apply.'
                : 'Official release verified from GitHub. Once downloaded, you can restart anytime to apply.'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-app-modal-header-border bg-app-modal-header flex items-center justify-between gap-3">
          {isDownloading ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onCancelDownload}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-app-btn-border bg-app-btn text-app-btn-text hover:bg-app-btn-hover transition-colors cursor-pointer"
              >
                Cancel Download
              </button>
            </div>
          ) : isUpdateReady ? (
            <>
              <button
                type="button"
                onClick={onRestartLater || onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-app-btn-border bg-app-btn text-app-btn-text hover:bg-app-btn-hover transition-colors cursor-pointer"
              >
                Restart Later
              </button>

              <button
                type="button"
                onClick={onRestartToApply}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart Now to Apply</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-app-btn-border bg-app-btn text-app-btn-text hover:bg-app-btn-hover transition-colors cursor-pointer"
              >
                Remind Me Later
              </button>

              <div className="flex items-center gap-2">
                {updateInfo.downloadUrl ? (
                  <button
                    type="button"
                    onClick={() => onDownloadAndInstall(updateInfo.downloadUrl!)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-app-primary hover:bg-app-primary-hover text-app-primary-fg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download &amp; Install</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.api?.shell?.openExternal(targetUrl)}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-app-primary hover:bg-app-primary-hover text-app-primary-fg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
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
