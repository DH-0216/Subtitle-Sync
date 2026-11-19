import { create } from 'zustand'
import toast from 'react-hot-toast'
import { AppUpdateData } from '../components/UpdateModal'
import { APP_VERSION, compareVersions } from '@shared/version'
import { useLogStore } from './useLogStore'
import { useSettingsStore } from './useSettingsStore'

export interface UpdaterState {
  updateModalOpen: boolean
  appUpdateInfo: AppUpdateData | null
  isDownloadingUpdate: boolean
  updateDownloadProgress: number
  updateDownloadSpeed: string
  updateDownloadedBytes: number
  updateTotalBytes: number
  updateErrorMessage: string | null
  autoDownloadUpdates: boolean
  isUpdateReady: boolean

  setUpdateModalOpen: (open: boolean) => void
  setAppUpdateInfo: (info: AppUpdateData | null) => void
  setAutoDownloadUpdates: (auto: boolean) => void
  setIsUpdateReady: (ready: boolean) => void
  handleCheckForAppUpdates: (silent?: boolean, autoDownloadIfEnabled?: boolean) => Promise<void>
  handleDownloadAndInstallUpdate: (downloadUrl?: string) => Promise<void>
  handleRestartToApply: () => void
  handleRestartLater: () => void
  handleCancelUpdateDownload: () => Promise<void>
}

export const useUpdaterStore = create<UpdaterState>((set, get) => {
  // Listen to in-app updater download progress events from Electron main process
  if (typeof window !== 'undefined' && window.api?.updater?.onProgress) {
    window.api.updater.onProgress((data: any) => {
      set({
        updateDownloadProgress: data.percent || 0,
        updateDownloadSpeed: data.speed || '',
        updateDownloadedBytes: data.downloaded || 0,
        updateTotalBytes: data.total || 0
      })
    })
  }

  return {
    updateModalOpen: false,
    appUpdateInfo: null,
    isDownloadingUpdate: false,
    updateDownloadProgress: 0,
    updateDownloadSpeed: '',
    updateDownloadedBytes: 0,
    updateTotalBytes: 0,
    updateErrorMessage: null,
    autoDownloadUpdates: false,
    isUpdateReady: false,

    setUpdateModalOpen: (open) => set({ updateModalOpen: open }),
    setAppUpdateInfo: (info) => set({ appUpdateInfo: info }),
    setAutoDownloadUpdates: (auto) => set({ autoDownloadUpdates: auto }),
    setIsUpdateReady: (ready) => set({ isUpdateReady: ready }),

    handleDownloadAndInstallUpdate: async (downloadUrl?: string) => {
      const targetUrl = downloadUrl || get().appUpdateInfo?.downloadUrl
      if (!targetUrl) return
      set({
        isDownloadingUpdate: true,
        updateDownloadProgress: 0,
        updateErrorMessage: null
      })
      useLogStore.getState().addLog(`[UPDATER] Starting in-app download: ${targetUrl}`)

      try {
        if (window.api?.updater?.downloadAndInstall) {
          const res = await window.api.updater.downloadAndInstall(targetUrl)
          if (res?.success) {
            set({ isUpdateReady: true })
            useSettingsStore
              .getState()
              .notifyJobComplete(
                'Update Ready to Install',
                'Subtitle Sync Studio update has been downloaded. Restart anytime to apply.'
              )
            toast.success(
              'Update ready! Click Restart to apply, or it will apply on your next launch.',
              { duration: 6000 }
            )
          } else if (res?.error) {
            if (!res.error.toLowerCase().includes('cancel')) {
              set({ updateErrorMessage: res.error })
              toast.error(res.error)
              useLogStore.getState().addLog(`[UPDATER] Download failed: ${res.error}`)
            }
          }
        }
      } catch (err: any) {
        if (!err?.message?.toLowerCase().includes('cancel')) {
          const msg = err?.message || 'Failed to download update.'
          set({ updateErrorMessage: msg })
          toast.error(msg)
        }
      } finally {
        set({ isDownloadingUpdate: false })
      }
    },

    handleCheckForAppUpdates: async (silent: boolean = false, autoDownloadIfEnabled: boolean = false) => {
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
            set({ appUpdateInfo: info })
            useLogStore.getState().addLog(`[UPDATER] New version available: v${info.latestVersion}`)

            if (silent && autoDownloadIfEnabled && get().autoDownloadUpdates && info.downloadUrl) {
              useLogStore.getState().addLog(`[UPDATER] Auto-downloading update in background: v${info.latestVersion}`)
              get().handleDownloadAndInstallUpdate(info.downloadUrl)
            } else {
              set({ updateModalOpen: true })
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
    },

    handleRestartToApply: () => {
      if (window.api?.updater?.restartAndInstall) {
        window.api.updater.restartAndInstall()
      }
    },

    handleRestartLater: () => {
      set({ updateModalOpen: false })
      toast.success('Update ready! It will be applied automatically next time you launch the app.', {
        icon: '🕒',
        duration: 5000
      })
    },

    handleCancelUpdateDownload: async () => {
      try {
        if (window.api?.updater?.cancel) {
          await window.api.updater.cancel()
        }
      } catch {}
      set({ isDownloadingUpdate: false, updateDownloadProgress: 0 })
      toast('Update download cancelled.')
    }
  }
})
