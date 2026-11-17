import React from 'react'

export interface ProgressBarProps {
  progress: number
  statusMessage: string
  className?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  statusMessage,
  className = ''
}) => {
  return (
    <div className={`space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="flex justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-blue-800 dark:bg-blue-500 animate-ping shrink-0" />
          <span className="truncate">{statusMessage || 'Processing...'}</span>
        </span>
        <span className="shrink-0 ml-2">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className="bg-blue-800 dark:bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${Math.max(5, progress)}%` }}
        />
      </div>
    </div>
  )
}
