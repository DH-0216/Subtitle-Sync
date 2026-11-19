import React from 'react'
import { Cpu, RefreshCw } from 'lucide-react'
import {
  DEFAULT_WHISPER_MODELS,
  WhisperModelOption,
  WhisperModelCategory
} from '@shared/whisperModels'

export type { WhisperModelOption, WhisperModelCategory }
export { DEFAULT_WHISPER_MODELS }

export interface WhisperModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  availableModels?: WhisperModelOption[]
  isLoading?: boolean
  onRefresh?: () => void
  label?: string
  showLabel?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  selectClassName?: string
}

export const WhisperModelSelector: React.FC<WhisperModelSelectorProps> = ({
  value,
  onChange,
  availableModels = [],
  isLoading = false,
  onRefresh,
  label = 'Whisper AI Model',
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

  // If availableModels is populated, use it. Otherwise, use centralized DEFAULT_WHISPER_MODELS
  const activeModels = availableModels.length > 0 ? availableModels : DEFAULT_WHISPER_MODELS

  // Model categories for dynamic grouping
  const recommendedModels = activeModels.filter((m) => m.category === 'recommended')
  const standardModels = activeModels.filter(
    (m) => m.category === 'standard' || m.category === 'high_accuracy'
  )
  const englishOnlyModels = activeModels.filter((m) => m.category === 'english_only')
  const quantizedModels = activeModels.filter((m) => m.category === 'quantized')
  const customModels = activeModels.filter((m) => m.category === 'custom')

  const hasGroupedModels = availableModels.length > 0

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>{label}</span>
          </label>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading || disabled}
              className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking...' : 'Check Models'}</span>
            </button>
          )}
        </div>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${selectClassName}`}
      >
        {recommendedModels.length > 0 && (
          <optgroup label="⭐ Recommended Models">
            {recommendedModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}{' '}
                {m.speedHint ? `• ${m.speedHint}` : ''}
              </option>
            ))}
          </optgroup>
        )}

        {standardModels.length > 0 && (
          <optgroup label="📦 Standard Multi-lingual Models">
            {standardModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
              </option>
            ))}
          </optgroup>
        )}

        {englishOnlyModels.length > 0 && (
          <optgroup label="🇬🇧 English-Only Optimized (.en)">
            {englishOnlyModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
              </option>
            ))}
          </optgroup>
        )}

        {quantizedModels.length > 0 && (
          <optgroup label="⚡ Quantized Fast (Q5/Q8)">
            {quantizedModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
              </option>
            ))}
          </optgroup>
        )}

        {customModels.length > 0 && (
          <optgroup label="📁 Custom Local Models">
            {customModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.sizeFormatted}) — Local
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
