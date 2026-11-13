import React from 'react'
import { Zap, Search, Scissors, Lock, RefreshCw, Square, FolderOpen, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'

export type SyncMode = 'Standard' | 'Smart' | 'Split sync'

export interface RecommendationData {
  mode: SyncMode
  title: string
  hint: string
  type: 'warning' | 'success' | 'info'
}

interface Step3SyncProps {
  unlocked: boolean
  isSyncing: boolean
  syncMode: SyncMode
  setSyncMode: (m: SyncMode) => void
  recommendation?: RecommendationData | null
  userSelectedMode?: boolean
  recommendedMode?: string | null
  recommendedReason?: string | null
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  onStartSync: () => void
  onCancelSync: () => void
  onOpenFolder: () => void
}

export const Step3Sync: React.FC<Step3SyncProps> = ({
  unlocked,
  isSyncing,
  syncMode,
  setSyncMode,
  recommendation,
  userSelectedMode,
  recommendedMode,
  recommendedReason,
  progress,
  statusMessage,
  lastOutputDir,
  onStartSync,
  onCancelSync,
  onOpenFolder
}) => {
  const modes: { id: SyncMode; title: string; desc: string; icon: any }[] = [
    {
      id: 'Standard',
      title: 'Standard',
      desc: 'Fast 1-pass alignment. Best for fixed time shift.',
      icon: Zap
    },
    {
      id: 'Smart',
      title: 'Smart',
      desc: '4-pass scoring algorithm. Fixes speed & fps drift.',
      icon: Search
    },
    {
      id: 'Split sync',
      title: 'Split sync',
      desc: 'Piecewise alignment for different cuts & TV ads.',
      icon: Scissors
    }
  ]

  return (
    <div
      className={`border rounded-2xl p-5 shadow-xs transition-all ${
        unlocked
          ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800'
          : 'bg-slate-50/70 dark:bg-slate-900 border-slate-300 dark:border-slate-800 opacity-80'
      }`}
    >
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center border shadow-xs ${
              unlocked
                ? 'bg-blue-800 text-white border-blue-800 dark:bg-blue-600 dark:border-blue-600'
                : 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            3
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">
            Synchronization
          </h2>
        </div>

        {!unlocked && (
          <span className="flex items-center gap-1.5 text-xs text-amber-950 bg-amber-100 border border-amber-300 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700 font-bold">
            <Lock className="w-3.5 h-3.5" /> Complete Steps 1 & 2 first
          </span>
        )}
      </div>

      {/* Dedicated Analysis & Mode Recommendation Banner (From Previous App) */}
      {recommendation && unlocked && (
        <div
          className={`mb-4 p-4 rounded-xl border transition-all duration-300 shadow-xs flex flex-col gap-2.5 ${
            recommendation.type === 'warning'
              ? 'bg-amber-50/90 border-amber-300/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-500/30 dark:text-amber-200'
              : recommendation.type === 'success'
              ? 'bg-emerald-50/90 border-emerald-300/80 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-500/30 dark:text-emerald-200'
              : 'bg-blue-50/90 border-blue-200 text-blue-950 dark:bg-blue-950/30 dark:border-blue-500/30 dark:text-blue-200'
          }`}
        >
          {/* Title */}
          <div className="font-bold text-xs sm:text-sm flex items-start gap-2 leading-snug">
            <span className="w-5 shrink-0 text-center text-sm leading-none">
              {recommendation.type === 'warning' ? '⚡' : recommendation.type === 'success' ? '✅' : '🎬'}
            </span>
            <span className="font-semibold">{recommendation.title.replace(/^[⚡✅🎬💡⚠️]\s*/, '')}</span>
          </div>

          {/* Hint */}
          <div className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
            <span className="w-5 shrink-0 text-center text-sm leading-none">💡</span>
            <span>{recommendation.hint.replace(/^💡\s*/, '')}</span>
          </div>

          {/* Auto-selection or manual selection message */}
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-start gap-2 leading-relaxed">
            <span className="w-5 shrink-0 text-center text-sm leading-none">🎯</span>
            <div>
              {!userSelectedMode ? (
                <span>
                  Automatically selected &quot;{recommendation.mode}&quot; according to recommendation.{' '}
                  {recommendation.mode === 'Split sync'
                    ? 'If it does not fix the subtitle, try "Smart" mode or check if the audio track matches.'
                    : "If it does not fix the subtitle, try again and select the 'Split sync' option."}
                </span>
              ) : (
                <span>
                  Selected &quot;{syncMode}&quot;
                  {recommendation.mode && recommendation.mode !== syncMode ? ` (Recommended: "${recommendation.mode}")` : ''}.{' '}
                  {syncMode === 'Split sync'
                    ? 'If it does not fix the subtitle, try "Smart" mode or verify the audio track.'
                    : "If it does not fix the subtitle, try again and select the 'Split sync' option."}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {modes.map((m) => {
          const Icon = m.icon
          const selected = syncMode === m.id
          const isRec = recommendedMode === m.id

          return (
            <div
              key={m.id}
              onClick={() => unlocked && !isSyncing && setSyncMode(m.id)}
              className={`p-3.5 rounded-xl border relative transition-all duration-200 ${
                unlocked
                  ? selected
                    ? 'bg-blue-50 border-2 border-blue-800 shadow-xs dark:bg-blue-950/50 dark:border-blue-500 cursor-pointer'
                    : 'bg-white hover:bg-slate-50 border-slate-300 dark:bg-[#0B0F19] dark:border-slate-800 dark:hover:border-slate-700 shadow-2xs cursor-pointer'
                  : selected
                    ? 'bg-slate-100/80 dark:bg-slate-800/40 border-2 border-slate-300 dark:border-slate-700'
                    : 'bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800'
              } ${!unlocked || isSyncing ? 'cursor-not-allowed pointer-events-none' : ''}`}
            >
              {isRec && unlocked && (
                <span className="absolute -top-2.5 right-2 text-[10px] font-bold uppercase tracking-wider bg-blue-800 text-white dark:bg-blue-600 px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Best Match
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    unlocked && selected
                      ? 'bg-blue-800 dark:bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className={`text-sm font-bold ${unlocked ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                  {m.title}
                </h3>
              </div>
              <p className={`text-xs leading-relaxed ${unlocked ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {m.desc}
              </p>
            </div>
          )
        })}
      </div>

      {/* Live Progress Bar with Percentage */}
      {unlocked && (isSyncing || (progress === 100 && lastOutputDir)) && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-300 dark:bg-[#0B0F19] dark:border-slate-800 shadow-2xs transition-all duration-300">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {isSyncing ? (
                <Loader2 className="w-4 h-4 text-blue-800 dark:text-blue-400 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              )}
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {statusMessage || (isSyncing ? 'Synchronizing audio & speech...' : 'Synchronization complete!')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <span
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold text-white shadow-2xs ${
                  isSyncing ? 'bg-blue-800 dark:bg-blue-600' : 'bg-emerald-700 dark:bg-emerald-600'
                }`}
              >
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isSyncing
                  ? 'bg-blue-800 dark:bg-blue-500'
                  : 'bg-emerald-700 dark:bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, progress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {!isSyncing ? (
          <button
            onClick={onStartSync}
            disabled={!unlocked}
            className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs group cursor-pointer ${
              unlocked
                ? 'bg-blue-800 hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 cursor-not-allowed shadow-none'
            }`}
          >
            <RefreshCw className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180" /> Synchronize Subtitles
          </button>
        ) : (
          <button
            onClick={onCancelSync}
            className="flex-1 py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-rose-700 hover:bg-rose-800 text-white shadow-2xs cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" /> Cancel Synchronization
          </button>
        )}

        {lastOutputDir && !isSyncing && (
          <button
            onClick={onOpenFolder}
            className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors shrink-0 shadow-2xs cursor-pointer"
            title="Open folder containing synced subtitles"
          >
            <FolderOpen className="w-4 h-4 text-blue-800 dark:text-blue-400" /> Open Destination
          </button>
        )}
      </div>
    </div>
  )
}
