import React from 'react'
import { Languages } from 'lucide-react'
import {
  TRANSLATION_LANGUAGES,
  TranslationLanguageConfig,
  WHISPER_SPEECH_LANGUAGES,
  SpeechLanguageConfig
} from '@shared/translationPrompts'

export interface LanguageOption {
  code: string
  name: string
  nativeName?: string
  description?: string
}

export interface LanguageSelectorProps {
  value: string
  onChange: (code: string) => void
  /**
   * 'translate': Supported AI translation target languages (Sinhala, English, Tamil, Hindi, Spanish)
   * 'generate': Whisper Speech-to-Text languages (Original, English, Sinhala, Tamil, Hindi, Spanish)
   */
  mode?: 'translate' | 'generate'
  currentAudioTrackLang?: string
  label?: string
  showLabel?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  selectClassName?: string
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  mode = 'translate',
  currentAudioTrackLang = 'Audio',
  label = mode === 'generate' ? 'Target Subtitle Language' : 'Target Language',
  showLabel = false,
  disabled = false,
  size = 'md',
  className = '',
  selectClassName = ''
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg',
    md: 'text-xs font-medium px-3 py-2.5 rounded-xl'
  }[size]

  let options: LanguageOption[] = []

  if (mode === 'generate') {
    options = WHISPER_SPEECH_LANGUAGES.map((l: SpeechLanguageConfig) => {
      if (l.isOriginal) {
        const langTag =
          currentAudioTrackLang && currentAudioTrackLang !== 'Audio'
            ? ` (${currentAudioTrackLang.toUpperCase()})`
            : ' (Auto-detect)'
        return {
          code: l.code,
          name: `Original Spoken Language${langTag}`
        }
      }
      return {
        code: l.code,
        name: l.label || l.name,
        description: l.description
      }
    })
  } else {
    // Translation mode
    options = TRANSLATION_LANGUAGES.map((l: TranslationLanguageConfig) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      description: l.label
    }))
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <label className="text-xs font-bold text-app-text flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>{label}</span>
        </label>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${selectClassName}`}
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.name} {opt.nativeName ? `(${opt.nativeName})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
