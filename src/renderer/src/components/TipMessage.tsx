import React from 'react'
import { Lightbulb, ArrowRight, X } from 'lucide-react'

export type TipVariant = 'indigo' | 'blue' | 'amber' | 'emerald'

interface TipMessageProps {
  title?: string
  message: React.ReactNode
  variant?: TipVariant
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
  className?: string
  icon?: React.ReactNode
}

export const TipMessage: React.FC<TipMessageProps> = ({
  title = 'Tip:',
  message,
  variant = 'blue',
  actionLabel,
  onAction,
  onDismiss,
  className = '',
  icon
}) => {
  const variantStyles = {
    blue: {
      container: 'border-blue-200 bg-blue-50/80 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100',
      iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
      btn: 'bg-blue-600 hover:bg-blue-500 text-white',
      accent: 'text-blue-700 dark:text-blue-300'
    },
    indigo: {
      container: 'border-indigo-200 bg-indigo-50/80 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100',
      iconBg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300',
      btn: 'bg-indigo-700 hover:bg-indigo-800 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500',
      accent: 'text-indigo-700 dark:text-indigo-300'
    },
    amber: {
      container: 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
      iconBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
      btn: 'bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-600 dark:hover:bg-amber-500',
      accent: 'text-amber-700 dark:text-amber-300'
    },
    emerald: {
      container: 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100',
      iconBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300',
      btn: 'bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500',
      accent: 'text-emerald-700 dark:text-emerald-300'
    }
  }

  const style = variantStyles[variant] || variantStyles.blue

  return (
    <div
      className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-3 transition-all ${style.container} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${style.iconBg}`}>
          {icon || <Lightbulb className="w-3.5 h-3.5" />}
        </div>
        <div className="space-y-1.5 min-w-0">
          <div className="leading-relaxed">
            {title && <span className="font-bold mr-1.5">{title}</span>}
            <span className="font-normal opacity-90">{message}</span>
          </div>

          {actionLabel && onAction && (
            <div>
              <button
                type="button"
                onClick={onAction}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer shadow-2xs ${style.btn}`}
              >
                <span>{actionLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
          title="Dismiss tip"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
