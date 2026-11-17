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
    <div className={`space-y-2 p-4 rounded-xl bg-app-card-inner border border-app-card-inner-border ${className}`}>
      <div className="flex justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-app-primary animate-ping shrink-0" />
          <span className="truncate">{statusMessage || 'Processing...'}</span>
        </span>
        <span className="shrink-0 ml-2">{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
        <div
          className="bg-app-primary h-2 rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${Math.max(5, progress)}%` }}
        />
      </div>
    </div>
  )
}
