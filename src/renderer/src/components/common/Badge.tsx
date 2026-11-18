import React from 'react'

export type BadgeVariant =
  | 'auto'
  | 'new'
  | 'beta'
  | 'gradient'
  | 'amber'
  | 'primary'
  | 'emerald'
  | 'glass'
  | 'subtle'

export interface BadgeProps {
  /** Text to display inside the badge. Defaults to "NEW" */
  text?: string
  /** Visual style preset variant. Defaults to "auto" which selects based on text ('NEW' -> gradient, 'BETA' -> amber) */
  variant?: BadgeVariant
  /** Size preset */
  size?: 'xs' | 'sm' | 'md'
  /** Additional CSS class names */
  className?: string
}

/**
 * A sleek, high-polish, reusable Badge component for "NEW", "BETA", and status indicators.
 * Can be used as a standalone inline label or as a floating overlay on cards/icons/nav.
 */
export const Badge: React.FC<BadgeProps> = ({
  text = 'NEW',
  variant = 'auto',
  size = 'xs',
  className = ''
}) => {
  const sizeClasses = {
    xs: 'text-[7.5px] px-1.5 py-0.5 leading-none tracking-wider',
    sm: 'text-[8.5px] px-1.5 py-0.5 leading-tight tracking-wide',
    md: 'text-[9.5px] px-2 py-0.5 leading-tight tracking-wide'
  }[size]

  // Resolve 'auto' variant based on text content
  let resolvedVariant = variant
  if (resolvedVariant === 'auto') {
    const upper = (text || '').trim().toUpperCase()
    if (upper === 'BETA') {
      resolvedVariant = 'beta'
    } else if (upper === 'NEW') {
      resolvedVariant = 'new'
    } else {
      resolvedVariant = 'gradient'
    }
  }

  const variantClasses: Record<string, string> = {
    new: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-xs border border-blue-400/40',
    gradient:
      'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 text-white shadow-xs border border-blue-400/40',
    beta: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-xs border border-amber-300/40',
    amber:
      'bg-amber-500 text-white dark:bg-amber-500/90 shadow-xs border border-amber-300/30',
    primary:
      'bg-app-primary text-app-primary-fg shadow-xs border border-white/20',
    emerald:
      'bg-emerald-500 text-white shadow-xs border border-emerald-300/30',
    glass:
      'bg-blue-600/85 backdrop-blur-md text-white border border-white/30 shadow-xs',
    subtle:
      'bg-app-card-inner text-app-text-muted border border-app-card-inner-border'
  }

  const activeVariantClass = variantClasses[resolvedVariant] || variantClasses.gradient

  return (
    <span
      className={`inline-flex items-center justify-center font-black uppercase rounded-full select-none shrink-0 ${sizeClasses} ${activeVariantClass} ${className}`}
    >
      {text}
    </span>
  )
}
