import React from 'react'

export interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  title?: string
  showLabel?: boolean
  onText?: string
  offText?: string
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  className = '',
  title,
  showLabel = true,
  onText = 'Enabled',
  offText = 'Disabled'
}) => {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`flex items-center gap-2.5 cursor-pointer select-none group disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={title}
    >
      {showLabel && (
        <span className="text-xs font-semibold text-app-text">
          {checked ? onText : offText}
        </span>
      )}
      <div
        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
          checked ? 'bg-app-primary' : 'bg-app-card-inner-border'
        }`}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </button>
  )
}
