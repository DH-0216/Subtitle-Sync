import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { AppUpdateData } from '../components/UpdateModal'
import { APP_VERSION, compareVersions } from '@shared/version'

interface UseAppUpdaterOptions {
  notifyJobComplete: (title: string, body: string) => void
  addLog: (msg: string) => void
}

export function useAppUpdater({ notifyJobComplete, addLog }: UseAppUpdaterOptions) {
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateData | null>(null)
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false)
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0)
  const [updateDownloadSpeed, setUpdateDownloadSpeed] = useState('')
  const [updateDownloadedBytes, setUpdateDownloadedBytes] = useState(0)
  const [updateTotalBytes, setUpdateTotalBytes] = useState(0)
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null)
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useState(false)
  const autoDownloadUpdatesRef = useRef(autoDownloadUpdates)
  const [isUpdateReady, setIsUpdateReady] = useState(false)

  useEffect(() => {
    autoDownloadUpdatesRef.current = autoDownloadUpdates
  }, [autoDownloadUpdates])

  // Listen to in-app updater download progress events from Electron main process
  useEffect(() => {
    if (window.api?.updater?.onProgress) {
      const unsub = window.api.updater.onProgress((data: any) => {
        setUpdateDownloadProgress(data.percent || 0)
        setUpdateDownloadSpeed(data.speed || '')
        setUpdateDownloadedBytes(data.downloaded || 0)
        setUpdateTotalBytes(data.total || 0)
      })
      return () => unsub()
    }
  }, [])

  const handleDownloadAndInstallUpdate = useCallback(async (downloadUrl: string) => {
    if (!downloadUrl) return
    setIsDownloadingUpdate(true)
    setUpdateDownloadProgress(0)
    setUpdateErrorMessage(null)
    addLog(`[UPDATER] Starting in-app download: ${downloadUrl}`)

    try {
      if (window.api?.updater?.downloadAndInstall) {
        const res = await window.api.updater.downloadAndInstall(downloadUrl)
        if (res?.success) {
          setIsUpdateReady(true)
          notifyJobComplete(
            'Update Ready to Install',
            'Subtitle Sync Studio update has been downloaded. Restart anytime to apply.'
          )
          toast.success('Update ready! Click Restart to apply, or it will apply on your next launch.', { duration: 6000 })
        } else if (res?.error) {
          if (!res.error.toLowerCase().includes('cancel')) {
            setUpdateErrorMessage(res.error)
            toast.error(res.error)
            addLog(`[UPDATER] Download failed: ${res.error}`)
          }
        }
      }
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        setUpdateErrorMessage(err?.message || 'Failed to download update.')
        toast.error(err?.message || 'Failed to download update.')
      }
    } finally {
      setIsDownloadingUpdate(false)
    }
  }, [addLog, notifyJobComplete])

  const handleCheckForAppUpdates = useCallback(async (silent: boolean = false, autoDownloadIfEnabled: boolean = false) => {
    if (!navigator.onLine) {
      if (!silent) {
        toast.error('You are offline. Connect to the internet to check for updates.', { icon: '📡' })
      }
      return
    }

    try {
      if (window.api?.updater?.check) {
        const info = await window.api.updater.check()
        if (info.error) {
          if (!silent) {
            toast.error('Could not check for updates. No internet connection.', { icon: '📡' })
          }
          return
        }

        if (info.updateAvailable && info.latestVersion && compareVersions(info.latestVersion, APP_VERSION) > 0) {
          setAppUpdateInfo(info)
          addLog(`[UPDATER] New version available: v${info.latestVersion}`)

          // If autoDownloadUpdates is ON and running on startup, auto-download in background without forcing restart
          if (silent && autoDownloadIfEnabled && autoDownloadUpdatesRef.current && info.downloadUrl) {
            addLog(`[UPDATER] Auto-downloading update in background: v${info.latestVersion}`)
            handleDownloadAndInstallUpdate(info.downloadUrl)
          } else {
            // Open update window for user to download or remind later
            setUpdateModalOpen(true)
            if (!silent) {
              toast.success(`Update available: v${info.latestVersion}!`, { duration: 4000, icon: '🚀' })
            }
          }
        } else {
          if (!silent) {
            toast.success(`You're on the latest version (v${APP_VERSION})!`, { duration: 3000, icon: '✅' })
          }
        }
      }
    } catch (err: any) {
      if (!silent) {
        toast.error('Failed to check for updates: ' + (err?.message || 'Network error'))
      }
    }
  }, [addLog, handleDownloadAndInstallUpdate])

  const handleRestartToApply = useCallback(() => {
    if (window.api?.updater?.restartAndInstall) {
      window.api.updater.restartAndInstall()
    }
  }, [])

  const handleRestartLater = useCallback(() => {
    setUpdateModalOpen(false)
    toast.success('Update ready! It will be applied automatically next time you launch the app.', {
      icon: '🕒',
      duration: 5000
    })
  }, [])

  const handleCancelUpdateDownload = useCallback(async () => {
    try {
      if (window.api?.updater?.cancel) {
        await window.api.updater.cancel()
      }
    } catch {}
    setIsDownloadingUpdate(false)
    setUpdateDownloadProgress(0)
    toast('Update download cancelled.')
  }, [])

  return {
    updateModalOpen,
    setUpdateModalOpen,
    appUpdateInfo,
    setAppUpdateInfo,
    isDownloadingUpdate,
    updateDownloadProgress,
    updateDownloadSpeed,
    updateDownloadedBytes,
    updateTotalBytes,
    updateErrorMessage,
    autoDownloadUpdates,
    setAutoDownloadUpdates,
    autoDownloadUpdatesRef,
    isUpdateReady,
    handleCheckForAppUpdates,
    handleDownloadAndInstallUpdate,
    handleRestartToApply,
    handleRestartLater,
    handleCancelUpdateDownload
  }
}
