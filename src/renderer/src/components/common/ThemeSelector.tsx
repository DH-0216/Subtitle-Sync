import React from 'react'
import { AVAILABLE_THEMES, ThemeMode } from '../../theme'
import { Badge } from './Badge'

export type { ThemeMode }

export interface ThemeSelectorProps {
  theme: ThemeMode
  onSelectTheme: (mode: ThemeMode) => void
  className?: string
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  theme,
  onSelectTheme,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider block">
        THEME
      </span>

      <div className="flex items-center gap-4 pt-1">
        {AVAILABLE_THEMES.map((opt) => {
          const isSelected = theme === opt.id
          const badgeText = opt.badge || (opt.id === 'glass' ? 'NEW' : undefined)

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectTheme(opt.id as ThemeMode)}
              className="group flex flex-col items-center cursor-pointer select-none focus:outline-hidden shrink-0"
              title={`Switch to ${opt.label} theme`}
            >
              <div className="relative">
                <div
                  className={`w-[68px] h-[46px] rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/30 dark:ring-blue-400/40 shadow-sm scale-[1.02]'
                      : 'border-app-card-inner-border opacity-70 group-hover:opacity-100 group-hover:border-blue-400'
                  }`}
                >
                  {opt.preview}
                </div>

                {badgeText && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 pointer-events-none drop-shadow-xs transition-transform group-hover:scale-110">
                    <Badge text={badgeText} />
                  </span>
                )}
              </div>
              <span
                className={`text-xs mt-1.5 text-center transition-colors ${
                  isSelected
                    ? 'font-bold text-app-text'
                    : 'text-app-text-muted group-hover:text-app-text'
                }`}
              >
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
