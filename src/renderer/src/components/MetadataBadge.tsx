import React from 'react'

export interface MetadataBadgeProps {
  icon?: React.ReactNode
  label: React.ReactNode
  variant?: 'default' | 'mono' | 'emerald' | 'amber' | 'blue'
  className?: string
  title?: string
}

export const MetadataBadge: React.FC<MetadataBadgeProps> = ({
  icon,
  label,
  variant = 'default',
  className = '',
  title
}) => {
  const variantStyles = {
    default:
      'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium dark:font-normal',
    mono:
      'bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-mono font-medium dark:font-normal',
    emerald:
      'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 font-medium dark:font-normal',
    amber:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 font-medium dark:font-normal',
    blue:
      'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700 font-medium dark:font-normal'
  }[variant]

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[9px] leading-tight px-1.5 py-[0.5px] rounded border shadow-2xs select-none ${variantStyles} ${className}`}
    >
      {icon && <span className="opacity-80 shrink-0 text-[9px]">{icon}</span>}
      <span>{label}</span>
    </span>
  )
}
