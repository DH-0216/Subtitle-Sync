import React from 'react'
import { Sparkles, Lock, Square, FolderOpen, Loader2, CheckCircle2 } from 'lucide-react'
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
  onOpenFolder
}) => {
  const isSubtitleSource = config.sourceType === 'subtitle'
  const sourceFileName = config.sourceSubPath ? config.sourceSubPath.split(/[\/\\]/).pop() : null

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
                : 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            3
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">
            {isSubtitleSource ? 'Translate Subtitle with AI' : 'Generate Subtitle'}
          </h2>
        </div>

        {!unlocked && (
          <span className="flex items-center gap-1.5 text-xs text-amber-950 bg-amber-100 border border-amber-300 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700 font-bold">
            <Lock className="w-3.5 h-3.5" /> {isSubtitleSource ? 'Choose subtitle in Step 2 first' : 'Select movie in Step 1 first'}
          </span>
        )}
      </div>

      {/* Summary Banner */}
      <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F19]/60 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-800 dark:bg-blue-600 text-white shadow-2xs">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
            {isSubtitleSource
              ? 'Ready to translate dialogues into Spoken Sinhala'
              : 'Ready to transcribe speech into subtitles'}
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {isSubtitleSource ? (
              <>
                The engine will parse dialogues from{' '}
                <span className="font-mono font-bold text-blue-900 dark:text-blue-300">
                  {sourceFileName || 'chosen subtitle file'}
                </span>{' '}
                and translate them into natural{' '}
                <span className="font-bold text-blue-800 dark:text-blue-400">
                  {config.language === 'si' ? 'Spoken Sinhala' : config.language.toUpperCase()}
                </span>{' '}
                directly via AI in ~10–20 seconds into a{' '}
                <span className="font-bold uppercase text-blue-800 dark:text-blue-400">
                  .{config.format}
                </span>{' '}
                file.
              </>
            ) : (
              <>
                The engine will extract audio from track #{selectedTrack ?? 0} and transcribe subtitles in{' '}
                <span className="font-bold text-blue-800 dark:text-blue-400">
                  {config.language === 'original'
                    ? "Movie's Language"
                    : config.language === 'si'
                    ? 'Spoken Sinhala'
                    : config.language.toUpperCase()}
                </span>{' '}
                using the <span className="font-bold uppercase text-blue-800 dark:text-blue-400">{config.modelQuality}</span> model
                into a <span className="font-bold uppercase text-blue-800 dark:text-blue-400">.{config.format}</span> subtitle file.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Live Progress Bar */}
      {(isGenerating || (progress === 100 && lastOutputDir)) && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 dark:bg-[#0B0F19]/80 dark:border-slate-800 shadow-2xs transition-all duration-300">
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {isGenerating ? (
                <Loader2 className="w-4 h-4 text-blue-800 dark:text-blue-400 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {statusMessage || (isGenerating ? (isSubtitleSource ? 'Translating dialogue cues via AI...' : 'Transcribing speech to subtitle cues...') : 'Subtitle processing complete!')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <span
                className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold text-white shadow-2xs ${
                  isGenerating ? 'bg-blue-800 dark:bg-blue-600' : 'bg-emerald-700 dark:bg-emerald-600'
                }`}
              >
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isGenerating
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
        {!isGenerating ? (
          <button
            onClick={() => onStartGenerate()}
            disabled={!unlocked}
            className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-xs group cursor-pointer ${
              unlocked
                ? 'bg-blue-800 hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white'
                : 'bg-slate-200 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 cursor-not-allowed shadow-none'
            }`}
          >
            <Sparkles className="w-4 h-4" /> {isSubtitleSource ? 'Translate Subtitle with AI' : 'Generate Subtitles'}
          </button>
        ) : (
          <button
            onClick={onCancelGenerate}
            className="flex-1 py-3 px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-rose-700 hover:bg-rose-800 text-white shadow-2xs cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" /> Cancel
          </button>
        )}

        {lastOutputDir && !isGenerating && (
          <button
            onClick={onOpenFolder}
            className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors shrink-0 shadow-2xs cursor-pointer"
            title="Open folder containing generated subtitle"
          >
            <FolderOpen className="w-4 h-4 text-blue-800 dark:text-blue-400" /> Open Destination
          </button>
        )}
      </div>
    </div>
  )
}
