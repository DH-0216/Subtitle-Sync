import React from 'react'
import { AlertCircle, X, Lock } from 'lucide-react'

export interface StepCardProps {
  step: number
  title: string
  badge?: React.ReactNode
  headerRight?: React.ReactNode
  unlocked?: boolean
  lockedMessage?: string
  errorMessage?: string | null
  errorTitle?: string
  onClearError?: () => void
  className?: string
  children: React.ReactNode
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  title,
  badge,
  headerRight,
  unlocked = true,
  lockedMessage,
  errorMessage,
  errorTitle = 'Error',
  onClearError,
  className = '',
  children
}) => {
  return (
    <div
      className={`border rounded-2xl p-5 shadow-xs transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        unlocked
          ? 'bg-[#F9FBFE] dark:bg-slate-900 border-[#CADEFC] dark:border-slate-800'
          : 'bg-[#EDF3FB]/70 dark:bg-slate-900 border-[#CADEFC] dark:border-slate-800 opacity-80'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-[#CADEFC] dark:border-slate-800 gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center border shadow-xs shrink-0 ${
              unlocked
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            {step}
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase truncate">
            {title}
          </h2>
          {badge}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!unlocked && lockedMessage && (
            <span className="flex items-center gap-1.5 text-xs text-amber-950 bg-amber-100 border border-amber-300 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700 font-bold">
              <Lock className="w-3.5 h-3.5" /> {lockedMessage}
            </span>
          )}
          {headerRight}
        </div>
      </div>

      {/* Dismissible Error Banner */}
      {errorMessage && (
        <div className="mb-3.5 p-3.5 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold text-rose-950 dark:text-rose-100">{errorTitle}</p>
              <p className="text-[11.5px] text-rose-800 dark:text-rose-300 leading-relaxed break-words">{errorMessage}</p>
            </div>
          </div>
          {onClearError && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClearError()
              }}
              className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 p-1 rounded-lg shrink-0 cursor-pointer"
              title="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  )
}
