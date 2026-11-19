import React from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { AiProviderId, AI_MODELS_CONFIG } from '@shared/aiModels'

export interface AiModelOption {
  id: string
  name: string
  description?: string
}

export interface AiModelSelectorProps {
  provider?: AiProviderId
  value: string
  onChange: (model: string) => void
  availableModels?: AiModelOption[]
  isLoading?: boolean
  onRefresh?: () => void
  showAutoOption?: boolean
  autoOptionLabel?: string
  label?: string
  showLabel?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  selectClassName?: string
}

export const AiModelSelector: React.FC<AiModelSelectorProps> = ({
  provider = 'gemini',
  value,
  onChange,
  availableModels = [],
  isLoading = false,
  onRefresh,
  showAutoOption = true,
  autoOptionLabel = 'Auto-detect latest active model from provider (Recommended)',
  label = 'AI Model',
  showLabel = false,
  disabled = false,
  size = 'md',
  className = '',
  selectClassName = ''
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg',
    md: 'text-xs font-medium px-3 py-2 rounded-xl'
  }[size]

  // Fallback emergency seeds when API hasn't fetched models yet
  const fallbackSeeds: readonly string[] =
    provider === 'gemini'
      ? AI_MODELS_CONFIG.GEMINI_EMERGENCY_SEEDS
      : AI_MODELS_CONFIG.OPENAI_EMERGENCY_SEEDS

  const hasLiveModels = availableModels.length > 0

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs font-semibold text-app-text">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <label>{label}</label>
            {hasLiveModels && (
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                Live ({availableModels.length})
              </span>
            )}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading || disabled}
              className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Fetching...' : 'Fetch Models'}</span>
            </button>
          )}
        </div>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${selectClassName}`}
      >
        {showAutoOption && <option value="auto">{autoOptionLabel}</option>}

        {/* Retain current custom value if not present in options */}
        {value &&
          value !== 'auto' &&
          !availableModels.some((m) => m.id === value) &&
          !fallbackSeeds.includes(value) && (
            <option value={value}>{value} (Current selection)</option>
          )}

        {hasLiveModels ? (
          availableModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.id}
            </option>
          ))
        ) : (
          <optgroup label="Offline Default Models">
            {fallbackSeeds.map((seed) => (
              <option key={seed} value={seed}>
                {seed}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  )
}
