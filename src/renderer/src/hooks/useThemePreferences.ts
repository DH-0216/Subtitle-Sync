import { useState, useEffect, useCallback } from 'react'
import { AiProviderId, isValidAiProvider } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'
import { SyncMode } from '../components/Step3Sync'
import {
  ThemeMode,
  ResolvedTheme,
  resolveTheme,
  applyThemeToDocument
} from '../theme'

export function useThemePreferences() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = window.localStorage.getItem('app_theme') as ThemeMode
      if (cached === 'glass' || cached === 'light' || cached === 'dark' || cached === 'system') {
        return cached
      }
    }
    return 'dark'
  })
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const activeThemeDef = resolveTheme(theme, isSystemDark)
  const effectiveTheme: ResolvedTheme = activeThemeDef.id

  const [defaultMode, setDefaultMode] = useState<SyncMode>('Standard')
  const [checkUpdates, setCheckUpdates] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState<AiProviderId>('gemini')
  const [aiModel, setAiModel] = useState('auto')
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT)

  useEffect(() => {
    applyThemeToDocument(activeThemeDef, theme)
  }, [activeThemeDef, theme])

  const notifyJobComplete = useCallback((title: string, body: string) => {
    if (notificationsEnabled && window.api?.notification?.show) {
      window.api.notification.show(title, body)
    }
  }, [notificationsEnabled])

  const handleSetTheme = useCallback((newTheme: ThemeMode, autoDownloadUpdates?: boolean) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('app_theme', newTheme)
      }
    } catch {}
    setTheme(newTheme)
    window.api?.settings?.save({
      theme: newTheme,
      defaultMode,
      checkUpdates,
      ...(autoDownloadUpdates !== undefined ? { autoDownloadUpdates } : {}),
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    })
  }, [aiApiKey, aiModel, aiPrompt, aiProvider, checkUpdates, defaultMode, notificationsEnabled])

  const handleSaveSettings = useCallback((autoDownloadUpdates?: boolean) => {
    window.api?.settings?.save({
      theme,
      defaultMode,
      checkUpdates,
      ...(autoDownloadUpdates !== undefined ? { autoDownloadUpdates } : {}),
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    })
  }, [aiApiKey, aiModel, aiPrompt, aiProvider, checkUpdates, defaultMode, notificationsEnabled, theme])

  return {
    theme,
    setTheme,
    isSystemDark,
    activeThemeDef,
    effectiveTheme,
    defaultMode,
    setDefaultMode,
    checkUpdates,
    setCheckUpdates,
    notificationsEnabled,
    setNotificationsEnabled,
    aiApiKey,
    setAiApiKey,
    aiProvider,
    setAiProvider,
    aiModel,
    setAiModel,
    aiPrompt,
    setAiPrompt,
    notifyJobComplete,
    handleSetTheme,
    handleSaveSettings
  }
}
