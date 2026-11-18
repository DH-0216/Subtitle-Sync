import React from 'react'
import { X } from 'lucide-react'

export interface ModalHeaderProps {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  onClose: () => void
  rightContent?: React.ReactNode
  className?: string
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  title,
  subtitle,
  icon,
  onClose,
  rightContent,
  className = ''
}) => {
  return (
    <div
      className={`flex items-center justify-between px-6 py-4 border-b border-app-modal-header-border bg-app-modal-header shrink-0 select-none ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-app-accent-bg border border-app-accent-border flex items-center justify-center text-app-accent shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-bold text-app-text text-base leading-tight truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-app-text-muted truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {rightContent}
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
          title="Close"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
