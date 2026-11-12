import React from 'react'
import { Sparkles, Lock, Square, FolderOpen, Loader2, CheckCircle2, Eye } from 'lucide-react'
import { GenerateConfig } from './Step2Generate'

interface Step3GenerateProps {
  unlocked: boolean
  isGenerating: boolean
  config: GenerateConfig
  selectedTrack?: number | null
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  onStartGenerate: () => void
  onCancelGenerate: () => void
  onOpenFolder: () => void
  onPreview?: () => void
}

export const Step3Generate: React.FC<Step3GenerateProps> = ({
  unlocked,
  isGenerating,
  config,
  selectedTrack,
  progress,
  statusMessage,
  lastOutputDir,
  onStartGenerate,
  onCancelGenerate,
  onOpenFolder,
  onPreview
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900/60 border-2 rounded-2xl p-5 transition-all duration-300 ${
        unlocked
          ? 'border-blue-200/90 hover:border-blue-300 dark:border-slate-800/80 dark:hover:border-slate-700/70 shadow-sm shadow-blue-500/10 dark:shadow-md'
          : 'border-slate-200 dark:border-slate-900 opacity-60'
      }`}
    >
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-blue-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center border shadow-xs ${
              unlocked
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-600/30'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            3
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Generate Subtitle
          </h2>
        </div>

        {!unlocked && (
          <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400/90 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full dark:border-amber-500/20 font-medium">
            <Lock className="w-3.5 h-3.5" /> Select movie in Step 1 first
          </span>
        )}
      </div>

      {/* Summary Banner */}
      <div className="mb-4 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-600 text-white shadow-xs">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
            Ready to transcribe speech into subtitles
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            The engine will extract audio from track #{selectedTrack ?? 0} and transcribe subtitles in{' '}
            <span className="font-bold text-purple-700 dark:text-purple-300">
              {config.language === 'original'
                ? "Movie's Language"
                : config.language === 'si'
                ? 'Spoken Sinhala'
                : config.language.toUpperCase()}
            </span>{' '}
            using the <span className="font-bold uppercase text-purple-700 dark:text-purple-300">{config.modelQuality}</span> model
            into a <span className="font-bold uppercase text-purple-700 dark:text-purple-300">.{config.format}</span> subtitle file.
          </p>
        </div>
      </div>

      {/* Live Progress Bar */}
      {(isGenerating || (progress === 100 && lastOutputDir)) && (
        <div className="mb-4 p-3.5 rounded-xl bg-blue-50/40 border border-blue-200/80 dark:bg-[#0B0F19]/80 dark:border-slate-800 shadow-xs transition-all duration-300">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {isGenerating ? (
                <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {statusMessage || (isGenerating ? 'Transcribing speech to subtitle cues...' : 'Subtitle generation complete!')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <span
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold text-white shadow-xs ${
                  isGenerating ? 'bg-purple-600 dark:bg-purple-500' : 'bg-emerald-600 dark:bg-emerald-500'
                }`}
              >
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="h-3 w-full bg-blue-100 dark:bg-slate-900 rounded-full overflow-hidden border border-blue-200/90 dark:border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                isGenerating
                  ? 'bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 shadow-sm shadow-purple-500/50'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, progress))}%` }}
            >
              {isGenerating && (
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {!isGenerating ? (
          <button
            onClick={onStartGenerate}
            disabled={!unlocked}
            className={`flex-1 py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md group ${
              unlocked
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-blue-600/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                : 'bg-slate-200 text-slate-400 border border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700/50 cursor-not-allowed shadow-none'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Generate Subtitles
          </button>
        ) : (
          <button
            onClick={onCancelGenerate}
            className="flex-1 py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/25 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" /> Cancel Generation
          </button>
        )}

        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            disabled={!lastOutputDir}
            className={`py-3 px-4 rounded-xl border-2 font-bold text-xs flex items-center gap-2 transition-all shrink-0 shadow-2xs ${
              lastOutputDir
                ? 'border-purple-400 bg-purple-50 hover:bg-purple-100 text-purple-900 dark:border-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-200 cursor-pointer shadow-purple-500/10 hover:scale-[1.01]'
                : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-600 cursor-not-allowed opacity-60'
            }`}
            title={lastOutputDir ? 'Preview generated subtitle lines' : 'Preview will be available once subtitles are generated'}
          >
            <Eye className={`w-4 h-4 ${lastOutputDir ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-600'}`} />
            Preview Subtitle
          </button>
        )}

        {lastOutputDir && (
          <button
            onClick={onOpenFolder}
            className="py-3 px-4 rounded-xl border-2 border-blue-300 bg-blue-50/80 hover:bg-blue-100 text-blue-800 dark:border-slate-800 dark:bg-[#0B0F19]/80 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white font-bold text-xs flex items-center gap-2 transition-colors shrink-0 shadow-2xs cursor-pointer"
            title="Open folder containing generated subtitle"
          >
            <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Open Destination
          </button>
        )}
      </div>
    </div>
  )
}
