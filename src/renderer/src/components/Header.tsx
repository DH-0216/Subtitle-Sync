import React from 'react'
import { Settings, Info, RefreshCw } from 'lucide-react'
import appIcon from '../assets/app_icon.png'
import { APP_VERSION } from '@shared/version'
import { SubtitleAction } from './SubtitleModeSelector'

interface HeaderProps {
  currentAction: SubtitleAction
  onOpenSettings: () => void
  onOpenAbout: () => void
  isUpdateReady?: boolean
  onRestartToApplyUpdate?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  currentAction,
  onOpenSettings,
  onOpenAbout,
  isUpdateReady = false,
  onRestartToApplyUpdate
}) => {
  return (
    <header className="bg-[#F2F6FD] dark:bg-[#0B0F19] border-b border-[#CADEFC] dark:border-slate-800/80 pr-5 py-2.5 flex items-center justify-between shrink-0 z-20">
      <div className="flex items-center min-w-0 flex-1">
        {/* App Branding (Matches sidebar column width) */}
        <div className="w-56 xl:w-60 px-5 shrink-0 flex items-center gap-2.5">
          <img
            src={appIcon}
            alt="Subtitle Sync Studio"
            className="w-8 h-8 rounded-lg object-contain shadow-xs"
          />
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap">
              Subtitle Sync
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 dark:bg-blue-500/10 dark:text-blue-400">
              v{APP_VERSION}
            </span>
          </div>
        </div>

        {/* Active Mode Title & Description (Aligned directly at the sidebar divider line) */}
        <div className="min-w-0 hidden sm:block pl-3.5 pt-0.5">
          <h1 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight leading-tight truncate">
            {currentAction === 'sync' && 'Synchronize Subtitles'}
            {currentAction === 'extract' && 'Extract Encoded Subtitles'}
            {currentAction === 'translate' && 'Translate Subtitles (Cloud AI)'}
            {currentAction === 'generate' && 'Generate Subtitles (Whisper AI)'}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {currentAction === 'sync' && 'Align out-of-sync subtitle files (.srt) automatically with movie audio'}
            {currentAction === 'extract' && 'Extract embedded subtitle streams from MKV or MP4 video containers'}
            {currentAction === 'translate' && 'Translate subtitle dialogue into other languages using Cloud AI (Gemini / OpenAI)'}
            {currentAction === 'generate' && 'Transcribe speech from movie audio using local offline Whisper AI'}
          </p>
        </div>
      </div>

      {/* Right Navbar Utility Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isUpdateReady && onRestartToApplyUpdate && (
          <button
            type="button"
            onClick={onRestartToApplyUpdate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer animate-pulse mr-1"
            title="Update downloaded! Click to restart."
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restart to Update</span>
          </button>
        )}

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="Settings & Preferences"
          aria-label="Open settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* About */}
        <button
          type="button"
          onClick={onOpenAbout}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          title="About Subtitle Sync"
          aria-label="About Subtitle Sync"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
