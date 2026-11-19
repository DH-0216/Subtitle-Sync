import { create } from 'zustand'
import toast from 'react-hot-toast'
import { WhisperModelModalItem } from '../components/ModelDownloadModal'
import { formatUserFriendlyError } from '@shared/errorUtils'
import { useLogStore } from './useLogStore'
import { useSettingsStore } from './useSettingsStore'

export interface WhisperState {
  downloadModalOpen: boolean
  activeModelQuality: string
  isDownloadingModel: boolean
  modelDownloadProgress: number
  modelDownloadSpeed: string
  modelDownloadedBytes: number
  modelTotalBytes: number
  modelDownloadError: string | null
  whisperModels: any[]
  isLoadingWhisperModels: boolean
  whisperModelsSource: 'remote' | 'cached' | 'fallback'

  setDownloadModalOpen: (open: boolean) => void
  setActiveModelQuality: (quality: string) => void
  loadWhisperModels: (forceRefresh?: boolean) => Promise<void>
  handleStartDownloadModel: (quality?: string, onComplete?: () => void) => Promise<void>
  handleCancelDownloadModel: () => Promise<void>
}

export const useWhisperStore = create<WhisperState>((set, get) => {
  // Listen to model download progress from Electron generator service
  if (typeof window !== 'undefined' && window.api?.generator?.onDownloadProgress) {
    window.api.generator.onDownloadProgress((data: any) => {
      set({
        modelDownloadProgress: data.percent || 0,
        modelDownloadedBytes: data.downloaded || 0,
        modelTotalBytes: data.total || 0,
        modelDownloadSpeed: data.speed || get().modelDownloadSpeed
      })
    })
  }

  return {
    downloadModalOpen: false,
    activeModelQuality: 'base',
    isDownloadingModel: false,
    modelDownloadProgress: 0,
    modelDownloadSpeed: '',
    modelDownloadedBytes: 0,
    modelTotalBytes: 0,
    modelDownloadError: null,
    whisperModels: [],
    isLoadingWhisperModels: false,
    whisperModelsSource: 'fallback',

    setDownloadModalOpen: (open) => set({ downloadModalOpen: open }),
    setActiveModelQuality: (quality) => set({ activeModelQuality: quality }),

    loadWhisperModels: async (forceRefresh = false) => {
      if (!window.api?.generator?.getAvailableModels) return
      set({ isLoadingWhisperModels: true })
      try {
        const res = await window.api.generator.getAvailableModels(forceRefresh)
        if (res?.models && res.models.length > 0) {
          set({
            whisperModels: res.models,
            whisperModelsSource: res.source || 'fallback'
          })
          if (forceRefresh) {
            if (res.source === 'remote') {
              toast.success(`Loaded ${res.models.length} live models from Hugging Face!`, { icon: '🤗' })
            } else {
              toast('Using local/cached models catalog', { icon: '📂' })
            }
          }
        }
      } catch (e: any) {
        if (forceRefresh) {
          toast.error('Failed to fetch models from Hugging Face: ' + (e?.message || 'Network error'))
        }
      } finally {
        set({ isLoadingWhisperModels: false })
      }
    },

    handleStartDownloadModel: async (quality?: string, onComplete?: () => void) => {
      const targetQuality = quality || get().activeModelQuality
      if (!navigator.onLine) {
        toast.error('No internet connection. Please connect to the internet to download this Whisper model.', {
          duration: 5500,
          icon: '📡'
        })
        set({
          modelDownloadError:
            'No internet connection detected. An active internet connection is required to download models.'
        })
        return
      }

      if (!window.api?.generator?.downloadModel) {
        toast.error('Please restart the application to load backend!')
        return
      }

      set({
        isDownloadingModel: true,
        modelDownloadError: null,
        modelDownloadProgress: 0
      })

      try {
        const res = await window.api.generator.downloadModel(targetQuality)
        set({ isDownloadingModel: false })
        if (res?.success) {
          toast.success(`Whisper model (${targetQuality}) ready!`)
          useSettingsStore
            .getState()
            .notifyJobComplete('Whisper Model Ready', `Whisper ${targetQuality.toUpperCase()} model downloaded and ready!`)
          set({ downloadModalOpen: false })
          get().loadWhisperModels(false)
          if (onComplete) onComplete()
        } else {
          const friendly = formatUserFriendlyError(res?.error || 'Failed to download model.')
          set({ modelDownloadError: friendly })
          toast.error(friendly)
        }
      } catch (err: any) {
        set({ isDownloadingModel: false })
        const friendly = formatUserFriendlyError(err)
        set({ modelDownloadError: friendly })
        toast.error(friendly)
      }
    },

    handleCancelDownloadModel: async () => {
      if (window.api?.generator?.cancelDownload) {
        try {
          await window.api.generator.cancelDownload()
        } catch {}
      }
      set({ isDownloadingModel: false, modelDownloadProgress: 0 })
      toast('Model download cancelled.')
      useLogStore.getState().addLog('[USER] Model download cancelled.')
    }
  }
})
