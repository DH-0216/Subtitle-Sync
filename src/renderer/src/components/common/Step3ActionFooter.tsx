import React from 'react'
import { FolderOpen, Square, Folder, LucideIcon } from 'lucide-react'

export interface Step3ActionFooterProps {
  isRunning: boolean
  unlocked: boolean
  progress: number
  statusMessage: string
  onStart: () => void
  onCancel: () => void
  startIcon?: LucideIcon | React.ReactNode
  startLabel: string
  runningLabel?: string
  lastOutputDir?: string | null
  onOpenFolder?: (path?: string) => void
  outputDir?: string | null
  onChangeOutputDir?: () => void
  disabled?: boolean
  disabledReason?: string
}

export const Step3ActionFooter: React.FC<Step3ActionFooterProps> = ({
  isRunning,
  unlocked,
  progress,
  statusMessage,
  onStart,
  onCancel,
  startIcon,
  startLabel,
  runningLabel = 'Cancel',
  lastOutputDir,
  onOpenFolder,
  outputDir,
  onChangeOutputDir,
  disabled = false,
  disabledReason
}) => {
  const IconComponent = startIcon

  return (
    <div className="space-y-3.5">
      {/* Optional Output Directory Row */}
      {outputDir !== undefined && (
        <div className="flex items-center justify-between gap-2.5 bg-slate-50 dark:bg-[#0B0F19] border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <Folder className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider shrink-0">
                Export To:
              </span>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate" title={outputDir || ''}>
                {outputDir || 'Same as movie folder'}
              </span>
            </div>
          </div>
          {onChangeOutputDir && (
            <button
              type="button"
              onClick={onChangeOutputDir}
              disabled={isRunning}
              className="text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-white px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all shrink-0 cursor-pointer shadow-2xs disabled:opacity-50"
            >
              Change Folder...
            </button>
          )}
        </div>
      )}

      {/* Progress Bar (Visible while running) */}
      {isRunning && (
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500 animate-ping shrink-0" />
              <span className="truncate">{statusMessage || 'Processing...'}</span>
            </span>
            <span className="shrink-0 ml-2">{progress}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${Math.max(5, progress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Buttons Row */}
      <div className="flex items-center gap-3">
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{runningLabel}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={!unlocked || disabled}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm shadow-xs transition-all ${
              unlocked && !disabled
                ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed shadow-none'
            }`}
          >
            {React.isValidElement(startIcon) ? (
              startIcon
            ) : typeof startIcon === 'function' ? (
              <startIcon className="w-4 h-4" />
            ) : null}
            <span>{(!unlocked || disabled) && disabledReason ? disabledReason : startLabel}</span>
          </button>
        )}

        {lastOutputDir && !isRunning && onOpenFolder && (
          <button
            type="button"
            onClick={() => onOpenFolder(lastOutputDir)}
            className="py-3 px-4 rounded-xl border border-slate-300 hover:border-blue-700 bg-white hover:bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shrink-0 shadow-2xs"
            title="Open containing output folder"
          >
            <FolderOpen className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Open Output Folder</span>
          </button>
        )}
      </div>
    </div>
  )
}
