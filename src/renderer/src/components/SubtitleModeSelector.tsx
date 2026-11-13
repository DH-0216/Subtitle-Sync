import React from 'react'
import { RefreshCw, Sparkles, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

export type SubtitleAction = 'sync' | 'generate' | 'extract'

interface SubtitleModeSelectorProps {
  action: SubtitleAction
  hasVideo: boolean
  onSelectAction: (action: SubtitleAction) => void
}

export const SubtitleModeSelector: React.FC<SubtitleModeSelectorProps> = ({
  action,
  hasVideo,
  onSelectAction
}) => {
  const handleGenerateClick = () => {
    if (!hasVideo) {
      toast.error('Please select a movie/video first in Step 1 to generate subtitles!', {
        id: 'need-video-for-generation'
      })
      return
    }
    onSelectAction('generate')
  }

  const handleExtractClick = () => {
    onSelectAction('extract')
    if (!hasVideo) {
      toast('Select a movie/video in Step 1 to extract its encoded subtitles!', {
        id: 'need-video-for-extract',
        icon: '📥'
      })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900/60 border border-blue-200/80 dark:border-slate-800/80 rounded-xl px-4 py-2 shadow-xs transition-all overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider shrink-0">
          Subtitle Mode:
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate hidden xl:inline">
          {action === 'sync'
            ? 'Align existing subtitle file'
            : action === 'extract'
            ? 'Extract encoded subtitle from video'
            : 'Create new subtitle from video speech'}
        </span>
      </div>

      <div className="inline-flex items-center p-1 bg-blue-50/80 dark:bg-slate-950/70 border border-blue-100 dark:border-slate-800 rounded-lg shrink-0 flex-nowrap">
        <button
          type="button"
          onClick={() => onSelectAction('sync')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            action === 'sync'
              ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>Synchronize Subtitle</span>
        </button>

        <button
          type="button"
          onClick={handleExtractClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            action === 'extract'
              ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileDown className="w-3.5 h-3.5 shrink-0" />
          <span>Extract Subtitle</span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
              action === 'extract'
                ? 'bg-blue-500/80 text-white'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
            }`}
          >
            SRT
          </span>
        </button>

        <button
          type="button"
          onClick={handleGenerateClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            action === 'generate'
              ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Generate Subtitle</span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
              action === 'generate'
                ? 'bg-blue-500/80 text-white'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
            }`}
          >
            AI
          </span>
        </button>
      </div>
    </div>
  )
}
