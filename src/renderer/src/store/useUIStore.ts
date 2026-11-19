import { create } from 'zustand'
import { SubtitleAction } from '../components/SubtitleModeSelector'

export interface UIState {
  subtitleAction: SubtitleAction
  audioModalOpen: boolean
  settingsModalOpen: boolean
  settingsInitialTab: 'general' | 'ai'
  aboutModalOpen: boolean
  engineReady: boolean
  isOnline: boolean

  setSubtitleAction: (action: SubtitleAction) => void
  setAudioModalOpen: (open: boolean) => void
  setSettingsModalOpen: (open: boolean, initialTab?: 'general' | 'ai') => void
  setSettingsInitialTab: (tab: 'general' | 'ai') => void
  setAboutModalOpen: (open: boolean) => void
  setEngineReady: (ready: boolean) => void
  setIsOnline: (online: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  subtitleAction: 'sync',
  audioModalOpen: false,
  settingsModalOpen: false,
  settingsInitialTab: 'general',
  aboutModalOpen: false,
  engineReady: false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  setSubtitleAction: (action) => set({ subtitleAction: action }),
  setAudioModalOpen: (open) => set({ audioModalOpen: open }),
  setSettingsModalOpen: (open, initialTab) =>
    set((state) => ({
      settingsModalOpen: open,
      settingsInitialTab: initialTab ?? state.settingsInitialTab
    })),
  setSettingsInitialTab: (tab) => set({ settingsInitialTab: tab }),
  setAboutModalOpen: (open) => set({ aboutModalOpen: open }),
  setEngineReady: (ready) => set({ engineReady: ready }),
  setIsOnline: (online) => set({ isOnline: online })
}))
