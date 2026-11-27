import React, { useRef, useState } from 'react'
import { Brain, AlertTriangle, Info } from 'lucide-react'
import { GEMINI_THINKING_LEVELS, GeminiThinkingLevel } from '@shared/aiModels'

export interface ThinkingLevelSelectorProps {
  value: GeminiThinkingLevel
  onChange: (level: GeminiThinkingLevel) => void
  disabled?: boolean
  showTip?: boolean
  className?: string
}

export const ThinkingLevelSelector: React.FC<ThinkingLevelSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showTip = true,
  className = ''
}) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragPercent, setDragPercent] = useState<number | null>(null)

  const levels = GEMINI_THINKING_LEVELS
  const maxIndex = levels.length - 1
  const activeIndex = Math.max(0, levels.indexOf(value))
  const steppedPercent = (activeIndex / maxIndex) * 100
  const displayPercent = dragPercent !== null ? dragPercent : steppedPercent
  const isHighActive = value === 'high'

  const resolveClientX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return null
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const nearestIdx = Math.round(ratio * maxIndex)
    return {
      percent: ratio * 100,
      level: levels[nearestIdx]
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const resolved = resolveClientX(e.clientX)
    if (!resolved) return
    setDragPercent(resolved.percent)
    if (resolved.level !== value) {
      onChange(resolved.level)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || dragPercent === null) return
    const resolved = resolveClientX(e.clientX)
    if (!resolved) return
    setDragPercent(resolved.percent)
    if (resolved.level !== value) {
      onChange(resolved.level)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPercent === null) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDragPercent(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = levels[Math.min(maxIndex, activeIndex + 1)]
      if (next !== value) onChange(next)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const prev = levels[Math.max(0, activeIndex - 1)]
      if (prev !== value) onChange(prev)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(levels[0])
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(levels[maxIndex])
    }
  }

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold text-app-text">
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>Thinking Level</span>
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
            isHighActive
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
              : 'text-app-text-muted'
          }`}
        >
          {value === 'low' ? 'Low (Recommended)' : value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      </div>

      <div className="px-2 pt-2 pb-1 select-none">
        <div className="space-y-2">
          {/* Draggable Track + Dots */}
          <div
            ref={trackRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="Gemini Thinking Level"
            aria-valuemin={0}
            aria-valuemax={maxIndex}
            aria-valuenow={activeIndex}
            aria-valuetext={value}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            className="relative flex items-center justify-between h-6 cursor-pointer touch-none focus:outline-hidden group"
          >
            {/* Background track */}
            <div className="absolute left-0 right-0 h-1.5 rounded-full bg-app-input-border/70" />

            {/* Active filled track */}
            <div
              className={`absolute left-0 h-1.5 rounded-full pointer-events-none ${
                dragPercent === null ? 'transition-all duration-150' : ''
              } ${isHighActive ? 'bg-amber-500' : 'bg-blue-600'}`}
              style={{ width: `${displayPercent}%` }}
            />

            {/* Step stop dots */}
            {levels.map((level, idx) => {
              const stepPct = (idx / maxIndex) * 100
              const isPassed = displayPercent >= stepPct - 0.5
              return (
                <span
                  key={level}
                  style={{ left: `${stepPct}%` }}
                  className={`absolute -translate-x-1/2 w-2.5 h-2.5 rounded-full pointer-events-none transition-colors ${
                    isPassed
                      ? isHighActive
                        ? 'bg-amber-500'
                        : 'bg-blue-600'
                      : 'bg-app-card border-2 border-app-input-border'
                  }`}
                />
              )
            })}

            {/* Draggable active thumb */}
            <span
              style={{ left: `${displayPercent}%` }}
              className={`absolute -translate-x-1/2 w-4 h-4 rounded-full pointer-events-none border-2 border-white dark:border-zinc-900 shadow-sm ${
                dragPercent === null ? 'transition-all duration-150' : 'scale-110'
              } ${
                isHighActive
                  ? 'bg-amber-500 ring-4 ring-amber-500/25'
                  : 'bg-blue-600 ring-4 ring-blue-500/25'
              }`}
            />
          </div>

          {/* Clickable labels under dots */}
          <div className="flex items-center justify-between">
            {levels.map((level) => {
              const isActive = value === level
              const isHigh = level === 'high'
              const label = level.charAt(0).toUpperCase() + level.slice(1)

              return (
                <button
                  key={level}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(level)}
                  className={`text-[11px] transition-colors cursor-pointer ${
                    isActive
                      ? isHigh
                        ? 'font-bold text-amber-600 dark:text-amber-400'
                        : 'font-bold text-blue-600 dark:text-blue-400'
                      : 'font-medium text-app-text-muted hover:text-app-text'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {showTip &&
        (isHighActive ? (
          <div className="text-[11px] flex items-start gap-2 px-2.5 py-2 rounded-lg border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/35 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>High Thinking Warning:</strong> Uses significantly more tokens per batch, makes translations noticeably slower, and can exhaust free-tier API quotas or trigger rate limits (429) much faster. Recommended only for complex idioms or dense dialogue.
            </span>
          </div>
        ) : (
          <div className="text-[11px] flex items-start gap-2 px-2.5 py-2 rounded-lg border border-app-card-inner-border bg-app-input/60 text-app-text-muted">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <span>
              {value === 'low' && (
                <>
                  <strong>Low (Recommended):</strong> Best balance for subtitle dialogue — saves ~70% thinking tokens while keeping translations fast and accurate.
                </>
              )}
              {value === 'medium' && (
                <>
                  <strong>Medium:</strong> Extra reasoning for context and slang with moderate token usage and slightly slower batch times.
                </>
              )}
            </span>
          </div>
        ))}
    </div>
  )
}
