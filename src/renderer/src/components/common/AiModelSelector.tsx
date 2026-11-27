import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, RefreshCw, ChevronDown, Check } from 'lucide-react'
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
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updateMenuPosition()
  }, [isOpen, updateMenuPosition])

  // Close on outside click, Escape, or reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    const handleReposition = (e: Event) => {
      // Ignore scrolling inside the dropdown menu itself
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return
      }
      updateMenuPosition()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updateMenuPosition])

  // Close if disabled becomes true
  useEffect(() => {
    if (disabled && isOpen) setIsOpen(false)
  }, [disabled, isOpen])

  const getSelectedLabel = (): string => {
    if (value === 'auto' && showAutoOption) return autoOptionLabel
    const liveMatch = availableModels.find((m) => m.id === value)
    if (liveMatch) return liveMatch.name || liveMatch.id
    if (value && value !== 'auto') {
      if (!hasLiveModels && fallbackSeeds.includes(value)) return value
      return `${value} (Current selection)`
    }
    return autoOptionLabel
  }

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setIsOpen(false)
  }

  const isCustomSelection =
    Boolean(value) &&
    value !== 'auto' &&
    !availableModels.some((m) => m.id === value) &&
    !fallbackSeeds.includes(value)

  const menuContent = isOpen && typeof document !== 'undefined' && createPortal(
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: 'fixed',
        top: menuStyle.top,
        left: menuStyle.left,
        width: menuStyle.width,
        zIndex: 9999
      }}
      className="app-dropdown-menu max-h-56 overflow-y-auto rounded-xl border border-app-card-border bg-app-card shadow-xl py-1"
    >
      {showAutoOption && (
        <button
          type="button"
          role="option"
          aria-selected={value === 'auto'}
          onClick={() => handleSelect('auto')}
          className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
            value === 'auto'
              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
              : 'text-app-text hover:bg-app-btn-hover'
          }`}
        >
          <span className="truncate">{autoOptionLabel}</span>
          {value === 'auto' && <Check className="w-3.5 h-3.5 shrink-0" />}
        </button>
      )}

      {isCustomSelection && (
        <button
          type="button"
          role="option"
          aria-selected={true}
          onClick={() => handleSelect(value)}
          className="w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold"
        >
          <span className="truncate">{value} (Current selection)</span>
          <Check className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}

      {hasLiveModels ? (
        availableModels.map((m) => {
          const isSelected = value === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(m.id)}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-app-text hover:bg-app-btn-hover'
              }`}
            >
              <span className="truncate">{m.name || m.id}</span>
              {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          )
        })
      ) : (
        <>
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
            Offline Default Models
          </div>
          {fallbackSeeds.map((seed) => {
            const isSelected = value === seed
            return (
              <button
                key={seed}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(seed)}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'text-app-text hover:bg-app-btn-hover'
                }`}
              >
                <span className="truncate">{seed}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            )
          })}
        </>
      )}
    </div>,
    document.body
  )

  return (
    <div className={`space-y-1.5 relative ${className}`}>
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

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 text-left border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${selectClassName}`}
      >
        <span className="truncate">{getSelectedLabel()}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-app-text-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {menuContent}
    </div>
  )
}
