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
    <div className="w-1/2 h-full bg-[#FAFBFD] p-1 flex items-stretch justify-center border-l border-slate-300">
      <div className="w-full h-full bg-[#E2E8F0] rounded-xs" />
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

// Light theme preview representation (Clean minimalist palette)
const LightPreview: React.FC = () => (
  <div className="w-full h-full bg-[#FAFBFD] p-1.5 flex items-stretch gap-1.5 border border-slate-200">
    <div className="flex-1 h-full bg-[#FFFFFF] border border-slate-200 rounded-xs" />
    <div className="flex-1 h-full bg-[#FFFFFF] border border-slate-200 rounded-xs" />
  </div>
)

// Glassmorphism theme preview representation (crisp frosted translucent glass with light refraction)
const GlassPreview: React.FC = () => (
  <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-[#090D16]">
    {/* Background ambient refraction orbs shining through the glass */}
    <div
      className="absolute -top-2 -right-2 w-8 h-8 rounded-full pointer-events-none"
      style={{
        background: 'radial-gradient(circle, rgba(96, 165, 250, 0.45) 0%, rgba(59, 130, 246, 0) 70%)'
      }}
    />
    <div
      className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full pointer-events-none"
      style={{
        background: 'radial-gradient(circle, rgba(148, 163, 184, 0.3) 0%, transparent 70%)'
      }}
    />

    {/* Subtle dot matrix showing through the translucent frosted panels */}
    <div
      className="absolute inset-0 opacity-15 pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
        backgroundSize: '6px 6px'
      }}
    />

    {/* Frosted glass cards with crisp specular highlights and glare */}
    <div className="relative z-10 w-full h-full p-1.5 flex items-stretch gap-1.5">
      <div
        className="flex-1 h-full rounded-xs relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, transparent 60%)'
          }}
        />
      </div>

      <div
        className="flex-1 h-full rounded-xs relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.03) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(6px)'
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, transparent 60%)'
          }}
        />
      </div>
    </div>
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
    canvasClass: 'bg-app-canvas text-app-text',
    preview: <DarkPreview />
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Crisp modern interface with vibrant electric blue accents',
    isDarkBase: false,
    htmlClasses: [],
    canvasClass: 'bg-app-canvas text-app-text',
    preview: <LightPreview />
  },
  {
    id: 'glass',
    label: 'Glass',
    description: 'Sleek translucent frosted-glass cards with crisp monochrome highlights',
    isDarkBase: true,
    htmlClasses: ['dark', 'glass'],
    canvasClass: 'bg-app-canvas text-app-text',
    preview: <GlassPreview />
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

  // Temporarily disable CSS transitions during theme switch to prevent color glitching / intermediate color flashing
  const disableTransitions = document.createElement('style')
  disableTransitions.appendChild(
    document.createTextNode(
      `*, *::before, *::after {
        -webkit-transition: none !important;
        -moz-transition: none !important;
        -o-transition: none !important;
        -ms-transition: none !important;
        transition: none !important;
      }`
    )
  )
  document.head.appendChild(disableTransitions)

  // Selective removal: Only remove classes that are NOT in the target theme
  // (Prevents dropping 'dark' when switching between Dark and Glass, avoiding fallback to Light theme's blue tokens)
  ALL_THEME_HTML_CLASSES.forEach((cls) => {
    if (!themeDef.htmlClasses.includes(cls)) {
      root.classList.remove(cls)
    }
  })

  // Apply target theme classes
  themeDef.htmlClasses.forEach((cls) => root.classList.add(cls))

  // Set data-theme attributes for CSS variables and styling selectors
  root.setAttribute('data-theme', themeDef.id)
  root.setAttribute('data-theme-mode', mode)

  // Force reflow so the new theme values apply instantly without intermediate interpolation
  window.getComputedStyle(root).opacity

  // Re-enable transitions on the next frame cleanly
  requestAnimationFrame(() => {
    try {
      if (disableTransitions.parentNode) {
        disableTransitions.parentNode.removeChild(disableTransitions)
      }
    } catch {}
  })

  // Switch native Windows acrylic material dynamically when supported
  try {
    if (window.api?.window?.setBackgroundMaterial) {
      window.api.window.setBackgroundMaterial(themeDef.id === 'glass' ? 'acrylic' : 'none')
    }
  } catch {}
}
