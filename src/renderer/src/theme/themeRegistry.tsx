import React from 'react'

export interface ThemeDefinition {
  id: string
  label: string
  description: string
  isDarkBase: boolean
  htmlClasses: string[]
  canvasClass: string
  preview: React.ReactNode
}

export interface SystemThemeOption {
  id: 'system'
  label: string
  description: string
  preview: React.ReactNode
}

export type ThemeRegistryItem = SystemThemeOption | ThemeDefinition

// System preview representation (half dark / half light)
const SystemPreview: React.FC = () => (
  <div className="w-full h-full flex items-stretch">
    <div className="w-1/2 h-full bg-[#181D26] p-1 flex items-stretch justify-center">
      <div className="w-full h-full bg-[#2A3140] rounded-xs" />
    </div>
    <div className="w-1/2 h-full bg-[#DCE5F2] p-1 flex items-stretch justify-center border-l border-slate-400/30">
      <div className="w-full h-full bg-[#B8C8DE] rounded-xs" />
    </div>
  </div>
)

// Dark theme preview representation
const DarkPreview: React.FC = () => (
  <div className="w-full h-full bg-[#181D26] p-1.5 flex items-stretch gap-1.5">
    <div className="flex-1 h-full bg-[#2A3140] rounded-xs" />
    <div className="flex-1 h-full bg-[#2A3140] rounded-xs" />
  </div>
)

// Light theme preview representation (Software Mansion blue palette)
const LightPreview: React.FC = () => (
  <div className="w-full h-full bg-[#DCE5F2] p-1.5 flex items-stretch gap-1.5">
    <div className="flex-1 h-full bg-[#B8C8DE] rounded-xs" />
    <div className="flex-1 h-full bg-[#B8C8DE] rounded-xs" />
  </div>
)

/**
 * System theme metadata
 */
export const SYSTEM_THEME: SystemThemeOption = {
  id: 'system',
  label: 'System',
  description: 'Syncs automatically with your operating system preference',
  preview: <SystemPreview />
}

/**
 * All concrete theme definitions.
 */
export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Deep charcoal interface with vibrant electric blue accents',
    isDarkBase: true,
    htmlClasses: ['dark'],
    canvasClass: 'dark bg-[#0B0F19] text-slate-100',
    preview: <DarkPreview />
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Crisp modern interface with vibrant electric blue accents',
    isDarkBase: false,
    htmlClasses: [],
    canvasClass: 'bg-[#E8F1FC] text-slate-900',
    preview: <LightPreview />
  }
] as const

/**
 * Complete list of available themes including 'system' option.
 */
export const AVAILABLE_THEMES: readonly ThemeRegistryItem[] = [
  SYSTEM_THEME,
  ...THEME_DEFINITIONS
]

// Inferred Theme types - dynamically updated whenever THEME_DEFINITIONS changes
export type ThemeMode = 'system' | (typeof THEME_DEFINITIONS)[number]['id']
export type ResolvedTheme = (typeof THEME_DEFINITIONS)[number]['id']

/**
 * Resolves any ThemeMode (including 'system') to its corresponding concrete ThemeDefinition.
 */
export function resolveTheme(mode: ThemeMode, isSystemDark: boolean): ThemeDefinition {
  if (mode === 'system') {
    const targetId = isSystemDark ? 'dark' : 'light'
    const match = THEME_DEFINITIONS.find((t) => t.id === targetId)
    return match || THEME_DEFINITIONS[0]
  }
  const match = THEME_DEFINITIONS.find((t) => t.id === mode)
  return match || THEME_DEFINITIONS[0]
}

/**
 * Collects all HTML classes used across all defined themes to allow clean removal when switching.
 * Includes legacy 'glass' class to guarantee clean removal if user previously had it.
 */
export const ALL_THEME_HTML_CLASSES = Array.from(
  new Set(['glass', ...THEME_DEFINITIONS.flatMap((t) => t.htmlClasses)])
)

/**
 * Pure helper to apply the active theme classes & data attributes to document.documentElement.
 */
export function applyThemeToDocument(themeDef: ThemeDefinition, mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Strip away all known theme classes cleanly (including any leftover 'glass')
  ALL_THEME_HTML_CLASSES.forEach((cls) => root.classList.remove(cls))

  // Apply the target theme's classes
  themeDef.htmlClasses.forEach((cls) => root.classList.add(cls))

  // Set data-theme attributes for CSS variables and styling selectors
  root.setAttribute('data-theme', themeDef.id)
  root.setAttribute('data-theme-mode', mode)
}
