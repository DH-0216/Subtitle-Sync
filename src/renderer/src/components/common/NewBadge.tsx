import React from 'react'

export interface NewBadgeProps {
  /** Text to display inside the badge. Defaults to "NEW" */
  text?: string
  /** Visual style preset variant */
  variant?: 'gradient' | 'primary' | 'amber' | 'emerald' | 'glass'
  /** Size preset */
  size?: 'xs' | 'sm'
  /** Additional CSS class names */
  className?: string
}

/**
 * A sleek, high-polish, reusable "NEW" badge component.
 * Can be used as a standalone inline label or as a floating overlay on cards/icons.
 */
export const NewBadge: React.FC<NewBadgeProps> = ({
  text = 'NEW',
  variant = 'gradient',
  size = 'xs',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'text-[7.5px] px-1.5 py-0.5 leading-none tracking-wider',
    sm: 'text-[9px] px-2 py-0.5 leading-tight tracking-wide'
  }[size]

  const variantClasses = {
    gradient:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-xs border border-blue-400/40',
    primary:
      'bg-app-primary text-app-primary-fg shadow-xs border border-white/20',
    amber:
      'bg-amber-500 text-white dark:bg-amber-500/90 shadow-xs border border-amber-300/30',
    emerald:
      'bg-emerald-500 text-white shadow-xs border border-emerald-300/30',
    glass:
      'bg-blue-600/85 backdrop-blur-md text-white border border-white/30 shadow-xs'
  }[variant]

  return (
    <span
      className={`inline-flex items-center justify-center font-black uppercase rounded-full select-none shrink-0 ${sizeClasses} ${variantClasses} ${className}`}
    >
      {text}
    </span>
  )
}
