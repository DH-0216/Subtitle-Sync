import React from 'react'
import { AVAILABLE_THEMES, ThemeMode } from '../../theme'

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
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        THEME
      </span>

      <div className="flex items-center gap-4">
        {AVAILABLE_THEMES.map((opt) => {
          const isSelected = theme === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectTheme(opt.id as ThemeMode)}
              className="group flex flex-col items-center cursor-pointer select-none focus:outline-hidden shrink-0"
              title={`Switch to ${opt.label} theme`}
            >
              <div
                className={`w-[68px] h-[46px] rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/30 dark:ring-blue-400/40 shadow-sm scale-[1.02]'
                    : 'border-slate-300 dark:border-slate-700/80 opacity-70 group-hover:opacity-100 group-hover:border-slate-400 dark:group-hover:border-slate-600'
                }`}
              >
                {opt.preview}
              </div>
              <span
                className={`text-xs mt-1.5 text-center transition-colors ${
                  isSelected
                    ? 'font-bold text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200'
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
