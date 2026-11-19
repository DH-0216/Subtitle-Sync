import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  ThemeMode,
  ResolvedTheme,
  ThemeDefinition,
  resolveTheme,
  applyThemeToDocument,
  AVAILABLE_THEMES
} from './themeRegistry'

interface ThemeContextType {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  themeDefinition: ThemeDefinition
  setTheme: (mode: ThemeMode) => void
  availableThemes: typeof AVAILABLE_THEMES
}

const defaultThemeDef = resolveTheme('dark', true)

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolvedTheme: 'dark',
  themeDefinition: defaultThemeDef,
  setTheme: () => {},
  availableThemes: AVAILABLE_THEMES
})

export const ThemeProvider: React.FC<{
  initialTheme?: ThemeMode
  onSaveTheme?: (mode: ThemeMode) => void
  children: React.ReactNode
}> = ({ initialTheme = 'dark', onSaveTheme, children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme)
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  )

  // Listen to OS system color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Resolve current active theme definition
  const themeDefinition = resolveTheme(theme, isSystemDark)
  const resolvedTheme = themeDefinition.id

  // Apply CSS classes to documentElement via registry helper
  useEffect(() => {
    applyThemeToDocument(themeDefinition, theme)
  }, [themeDefinition, theme])

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme)
      onSaveTheme?.(newTheme)
    },
    [onSaveTheme]
  )

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        themeDefinition,
        setTheme,
        availableThemes: AVAILABLE_THEMES
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
