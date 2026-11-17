import React from 'react'
import { Zap, Search, Scissors, RefreshCw, Sparkles } from 'lucide-react'
import { StepCard } from './common/StepCard'
import { Step3ActionFooter } from './common/Step3ActionFooter'

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
    <StepCard
      step={3}
      title="Synchronization"
      unlocked={unlocked}
      lockedMessage="Complete Steps 1 & 2 first"
    >
      {/* Analysis & Mode Recommendation Banner */}
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
          <div className="font-bold text-xs sm:text-sm flex items-start gap-2 leading-snug">
            <span className="w-5 shrink-0 text-center text-sm leading-none">
              {recommendation.type === 'warning' ? '⚡' : recommendation.type === 'success' ? '✅' : '🎬'}
            </span>
            <span className="font-semibold">{recommendation.title.replace(/^[⚡✅🎬💡⚠️]\s*/, '')}</span>
          </div>

          <div className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 leading-relaxed">
            <span className="w-5 shrink-0 text-center text-sm leading-none">💡</span>
            <span>{recommendation.hint.replace(/^💡\s*/, '')}</span>
          </div>

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
                    ? 'bg-blue-50 border-2 border-blue-600 shadow-xs dark:bg-blue-950/50 dark:border-blue-500 cursor-pointer'
                    : 'bg-app-card-inner hover:bg-app-card-inner-hover border-app-card-inner-border dark:hover:border-slate-700 shadow-2xs cursor-pointer'
                  : selected
                    ? 'bg-slate-100/80 dark:bg-slate-800/40 border-2 border-slate-300 dark:border-slate-700'
                    : 'bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800'
              } ${!unlocked || isSyncing ? 'cursor-not-allowed pointer-events-none' : ''}`}
            >
              {isRec && unlocked && (
                <span className="absolute -top-2.5 right-2 text-[10px] font-bold uppercase tracking-wider bg-app-primary text-app-primary-fg px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Best Match
                </span>
              )}
              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    unlocked && selected
                      ? 'bg-app-primary text-app-primary-fg shadow-2xs'
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

      {/* Reusable Action, Progress & Open Destination Footer */}
      <Step3ActionFooter
        isRunning={isSyncing}
        unlocked={unlocked}
        progress={progress}
        statusMessage={statusMessage}
        onStart={onStartSync}
        onCancel={onCancelSync}
        startIcon={<RefreshCw className="w-4 h-4" />}
        startLabel="Synchronize Subtitles"
        runningLabel="Cancel Synchronization"
        lastOutputDir={lastOutputDir}
        onOpenFolder={onOpenFolder}
      />
    </StepCard>
  )
}
