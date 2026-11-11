import React, { useState, useEffect } from 'react'
import { X, Settings as SettingsIcon, ExternalLink, RefreshCw } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  checkUpdates: boolean
  setCheckUpdates: (c: boolean) => void
  onSave?: () => void
}

const APP_VERSION = '2.0.0'
const GITHUB_REPO = 'DH-0216/Subtitle-Sync'

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  checkUpdates,
  setCheckUpdates,
  onSave
}) => {
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>(`Current Version: v${APP_VERSION}`)
  const [updateStatusType, setUpdateStatusType] = useState<'normal' | 'success' | 'warning' | 'error'>('normal')
  const [updateUrl, setUpdateUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleToggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    window.api?.settings?.save({
      theme: newTheme,
      check_updates_startup: checkUpdates
    })
  }

  const handleToggleAutoUpdate = (enabled: boolean) => {
    setCheckUpdates(enabled)
    window.api?.settings?.save({
      theme,
      check_updates_startup: enabled
    })
  }

  const handleCheckNow = async () => {
    setCheckingUpdate(true)
    setUpdateStatus('Checking GitHub Releases...')
    setUpdateStatusType('normal')

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const latestTag = data.tag_name || ''
      const cleanLatest = latestTag.replace(/^v/, '')
      const cleanCurrent = APP_VERSION.replace(/^v/, '')

      if (cleanLatest && cleanLatest !== cleanCurrent) {
        setUpdateStatus(`Update available: ${latestTag}`)
        setUpdateStatusType('success')
        setUpdateUrl(data.html_url || `https://github.com/${GITHUB_REPO}/releases`)
      } else {
        setUpdateStatus(`✅ You're on the latest version (v${APP_VERSION})`)
        setUpdateStatusType('success')
        setUpdateUrl(null)
      }
    } catch (e: any) {
      setUpdateStatus('⚠️ No internet connection. Please check your network and try again.')
      setUpdateStatusType('error')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleOpenGitHub = () => {
    const url = `https://github.com/${GITHUB_REPO}`
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleOpenRelease = () => {
    if (!updateUrl) return
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(updateUrl)
    } else {
      window.open(updateUrl, '_blank')
    }
  }

  const handleDone = () => {
    if (onSave) onSave()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-[520px] shadow-2xl p-6 transition-colors">
        {/* Header Row */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">
              Settings & Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card 1: Appearance Mode */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 mb-3.5 flex items-center justify-between transition-colors">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Appearance Mode
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toggle between Dark and Light interface themes
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleToggleTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
            title="Toggle theme"
          >
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Dark mode
            </span>
            <div
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Card 2: Software Updates */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 mb-3.5 space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Automatic Updates
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Check for newer versions automatically on startup
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleToggleAutoUpdate(!checkUpdates)}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              title="Toggle auto update"
            >
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Enabled
              </span>
              <div
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                  checkUpdates ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                    checkUpdates ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-medium truncate ${
                  updateStatusType === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : updateStatusType === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {updateStatus}
              </p>
              {updateUrl && (
                <button
                  onClick={handleOpenRelease}
                  className="text-[11px] text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-500 mt-0.5 block"
                >
                  Click to view and download release
                </button>
              )}
            </div>

            <button
              onClick={handleCheckNow}
              disabled={checkingUpdate}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              {checkingUpdate ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <span>🔍 Check Now</span>
              )}
            </button>
          </div>
        </div>

        {/* Card 3: About */}
        <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 mb-5 flex items-center justify-between transition-colors">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Subtitle Sync Studio
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Developed by DH-0216
            </p>
          </div>

          <button
            onClick={handleOpenGitHub}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5"
            title="Open GitHub Repository"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Done Button */}
        <button
          onClick={handleDone}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-md shadow-blue-600/25 active:scale-[0.99]"
        >
          Done
        </button>
      </div>
    </div>
  )
}
