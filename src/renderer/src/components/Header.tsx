import React from 'react'
import { Settings, Info, Sun, Moon, CheckCircle2, AlertTriangle, WifiOff } from 'lucide-react'
import appIcon from '../assets/app_icon.png'

interface HeaderProps {
  theme: string
  setTheme: (t: 'dark' | 'light') => void
  onOpenSettings: () => void
  onOpenAbout: () => void
  engineReady: boolean
  isOnline?: boolean
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  onOpenSettings,
  onOpenAbout,
  engineReady,
  isOnline = true
}) => {
  return (
    <header className="bg-white dark:bg-[#0B0F19] border-b border-slate-300 dark:border-slate-800 sticky top-0 z-30 shadow-xs dark:shadow-none transition-colors">
      <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <img
            src={appIcon}
            alt="Subtitle Sync Studio"
            className="w-10 h-10 rounded-xl object-contain shadow-xs"
          />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">Subtitle Sync Studio</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25">
                v2.0.0
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">Automatic speech-to-subtitle audio alignment</p>
          </div>
        </div>

      <div className="flex items-center gap-2">
        {/* Offline Badge */}
        {!isOnline && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800/90 dark:text-slate-300 dark:border-slate-700 shadow-2xs"
            title="You are currently offline. Movie speech transcription and subtitle synchronization work 100% locally."
          >
            <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Offline</span>
          </div>
        )}

        {/* Engine Ready Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
            engineReady
              ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25'
              : 'bg-amber-100 text-amber-950 border-amber-400 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25'
          }`}
        >
          {engineReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Engine Ready</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Checking Engine...</span>
            </>
          )}
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700/80 dark:bg-transparent dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
          title="Settings & Preferences"
        >
          <Settings className="w-3.5 h-3.5 text-slate-700 dark:text-slate-400" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl text-slate-900 hover:text-black bg-white hover:bg-slate-50 border border-slate-300 dark:bg-transparent dark:border-transparent dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/80 transition-colors shadow-2xs cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenAbout}
          className="p-2 rounded-xl text-slate-900 hover:text-black bg-white hover:bg-slate-50 border border-slate-300 dark:bg-transparent dark:border-transparent dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/80 transition-colors shadow-2xs cursor-pointer"
          title="About & GitHub"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  </header>
  )
}
