import React from 'react'

export interface ProgressBarProps {
  progress?: number
  percent?: number
  statusMessage?: string
  className?: string
  trackClassName?: string
  barClassName?: string
  size?: 'xs' | 'sm' | 'md'
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  percent,
  statusMessage,
  className = '',
  trackClassName = '',
  barClassName = '',
  size = 'md'
}) => {
  const value = Math.min(100, Math.max(0, Math.round(progress ?? percent ?? 0)))

  const heightClasses = {
    xs: 'h-1.5',
    sm: 'h-2',
    md: 'h-2.5'
  }[size]

  if (statusMessage) {
    return (
      <div className={`space-y-2 p-4 rounded-xl bg-app-card-inner border border-app-card-inner-border ${className}`}>
        <div className="flex justify-between text-xs font-semibold text-app-text">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-app-primary animate-ping shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </span>
          <span className="shrink-0 ml-2">{value}%</span>
        </div>
        <div className={`w-full bg-app-card-inner-hover ${heightClasses} rounded-full overflow-hidden ${trackClassName}`}>
          <div
            className={`bg-app-primary ${heightClasses} rounded-full transition-all duration-300 ease-out shadow-xs ${barClassName}`}
            style={{ width: `${Math.max(3, value)}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full bg-app-card-inner-hover ${heightClasses} rounded-full overflow-hidden ${trackClassName} ${className}`}>
      <div
        className={`bg-app-primary ${heightClasses} rounded-full transition-all duration-300 ease-out shadow-xs ${barClassName}`}
        style={{ width: `${Math.max(2, value)}%` }}
      />
    </div>
  )
}
