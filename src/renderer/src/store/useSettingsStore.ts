import { create } from 'zustand'
import { AiProviderId, isValidAiProvider } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'
import { SyncMode } from '../components/Step3Sync'
import { ThemeMode, ThemeDefinition, resolveTheme, applyThemeToDocument } from '../theme'

function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    const cached = window.localStorage.getItem('app_theme') as ThemeMode
    if (cached === 'glass' || cached === 'light' || cached === 'dark' || cached === 'system') {
      return cached
    }
  }
  return 'dark'
}

function getInitialSystemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true
}

export interface SettingsState {
  theme: ThemeMode
  isSystemDark: boolean
  activeThemeDef: ThemeDefinition
  defaultMode: SyncMode
  checkUpdates: boolean
  autoDownloadUpdates: boolean
  notificationsEnabled: boolean
  defaultSubtitleFormat: 'srt' | 'vtt' | 'txt'
  aiApiKey: string
  aiProvider: AiProviderId
  aiModel: string
  aiPrompt: string
  aiPromptsByLang: Record<string, string>

  setTheme: (theme: ThemeMode) => void
  setIsSystemDark: (isDark: boolean) => void
  setDefaultMode: (mode: SyncMode) => void
  setCheckUpdates: (check: boolean) => void
  setAutoDownloadUpdates: (auto: boolean) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setDefaultSubtitleFormat: (format: 'srt' | 'vtt' | 'txt') => void
  setAiApiKey: (key: string) => void
  setAiProvider: (provider: AiProviderId) => void
  setAiModel: (model: string) => void
  setAiPrompt: (prompt: string) => void
  setAiPromptsByLang: (prompts: Record<string, string>) => void

  notifyJobComplete: (title: string, body: string) => void
  loadSettings: () => Promise<void>
  saveSettings: (partial?: Partial<SettingsState>) => void
  handleSaveSettings: (autoDownloadUpdates?: boolean) => void
  handleSetTheme: (newTheme: ThemeMode, autoDownloadUpdates?: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initialTheme = getInitialTheme()
  const initialSystemDark = getInitialSystemDark()
  const initialThemeDef = resolveTheme(initialTheme, initialSystemDark)

  // Apply initial theme to document
  if (typeof document !== 'undefined') {
    applyThemeToDocument(initialThemeDef, initialTheme)
  }

  return {
    theme: initialTheme,
    isSystemDark: initialSystemDark,
    activeThemeDef: initialThemeDef,
    defaultMode: 'Standard',
    checkUpdates: true,
    autoDownloadUpdates: false,
    notificationsEnabled: true,
    defaultSubtitleFormat: 'srt',
    aiApiKey: '',
    aiProvider: 'gemini',
    aiModel: 'auto',
    aiPrompt: DEFAULT_AI_PROMPT,
    aiPromptsByLang: {},

    setTheme: (theme) => {
      const def = resolveTheme(theme, get().isSystemDark)
      set({ theme, activeThemeDef: def })
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem('app_theme', theme)
        } catch {}
      }
      applyThemeToDocument(def, theme)
    },

    setIsSystemDark: (isSystemDark) => {
      const def = resolveTheme(get().theme, isSystemDark)
      set({ isSystemDark, activeThemeDef: def })
      applyThemeToDocument(def, get().theme)
    },

    setDefaultMode: (defaultMode) => set({ defaultMode }),
    setCheckUpdates: (checkUpdates) => set({ checkUpdates }),
    setAutoDownloadUpdates: (autoDownloadUpdates) => set({ autoDownloadUpdates }),
    setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    setDefaultSubtitleFormat: (defaultSubtitleFormat) => set({ defaultSubtitleFormat }),
    setAiApiKey: (aiApiKey) => set({ aiApiKey }),
    setAiProvider: (aiProvider) => set({ aiProvider }),
    setAiModel: (aiModel) => set({ aiModel }),
    setAiPrompt: (aiPrompt) => set({ aiPrompt }),
    setAiPromptsByLang: (aiPromptsByLang) => set({ aiPromptsByLang }),

    notifyJobComplete: (title: string, body: string) => {
      if (get().notificationsEnabled && window.api?.notification?.show) {
        window.api.notification.show(title, body)
      }
    },

    loadSettings: async () => {
      if (!window.api?.settings?.load) return
      try {
        const s = await window.api.settings.load()
        if (!s) return

        if (s.theme) {
          get().setTheme(s.theme)
        }
        if (s.defaultMode) {
          set({ defaultMode: s.defaultMode })
        }
        if (s.checkUpdates !== undefined) {
          set({ checkUpdates: s.checkUpdates })
        }
        if (s.autoDownloadUpdates !== undefined) {
          set({ autoDownloadUpdates: s.autoDownloadUpdates })
        }
        if (s.notificationsEnabled !== undefined) {
          set({ notificationsEnabled: s.notificationsEnabled })
        }
        if (s.defaultSubtitleFormat) {
          set({ defaultSubtitleFormat: s.defaultSubtitleFormat })
        }
        if (s.aiApiKey) {
          set({ aiApiKey: s.aiApiKey })
        }
        if (s.aiProvider && isValidAiProvider(s.aiProvider)) {
          set({ aiProvider: s.aiProvider })
        }
        if (s.aiModel) {
          set({ aiModel: s.aiModel })
        }
        if (s.aiPrompt) {
          if (!s.aiPrompt.includes('Background Sounds') && !s.aiPrompt.includes('SDH')) {
            set({ aiPrompt: DEFAULT_AI_PROMPT })
          } else {
            set({ aiPrompt: s.aiPrompt })
          }
        }
        if (s.aiPromptsByLang && typeof s.aiPromptsByLang === 'object') {
          set({ aiPromptsByLang: s.aiPromptsByLang })
        }
      } catch (err) {
        console.warn('Failed to load settings from storage:', err)
      }
    },

    saveSettings: (partial?: Partial<SettingsState>) => {
      const state = { ...get(), ...partial }
      window.api?.settings?.save?.({
        theme: state.theme,
        defaultMode: state.defaultMode,
        checkUpdates: state.checkUpdates,
        autoDownloadUpdates: state.autoDownloadUpdates,
        notificationsEnabled: state.notificationsEnabled,
        defaultSubtitleFormat: state.defaultSubtitleFormat,
        aiApiKey: state.aiApiKey,
        aiProvider: state.aiProvider,
        aiModel: state.aiModel,
        aiPrompt: state.aiPrompt,
        aiPromptsByLang: state.aiPromptsByLang
      })
    },

    handleSaveSettings: (autoDownloadUpdates?: boolean) => {
      get().saveSettings(autoDownloadUpdates !== undefined ? { autoDownloadUpdates } : undefined)
    },

    handleSetTheme: (newTheme: ThemeMode, autoDownloadUpdates?: boolean) => {
      get().setTheme(newTheme)
      get().saveSettings(autoDownloadUpdates !== undefined ? { autoDownloadUpdates } : undefined)
    }
  }
})
