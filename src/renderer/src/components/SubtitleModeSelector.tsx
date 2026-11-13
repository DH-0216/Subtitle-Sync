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
    if (!hasVideo) {
      toast.error('Please select a movie/video first in Step 1 to extract subtitles!', {
        id: 'need-video-for-extract'
      })
      return
    }
    onSelectAction('extract')
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2 shadow-xs transition-all overflow-hidden">
      <div className="flex items-center gap-2 min-w-0 overflow-hidden">
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider shrink-0">
          Subtitle Mode:
        </span>
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate hidden xl:inline font-medium">
          {action === 'sync'
            ? 'Align existing subtitle file'
            : action === 'extract'
            ? 'Extract encoded subtitle from video'
            : 'Create or translate subtitle via AI'}
        </span>
      </div>

      <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg shrink-0 flex-nowrap">
        <button
          type="button"
          onClick={() => onSelectAction('sync')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            action === 'sync'
              ? 'bg-blue-800 dark:bg-blue-600 text-white shadow-xs'
              : 'text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          <span>Synchronize Subtitle</span>
        </button>

        <button
          type="button"
          onClick={handleExtractClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            action === 'extract'
              ? 'bg-blue-800 dark:bg-blue-600 text-white shadow-xs'
              : 'text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
          }`}
        >
          <FileDown className="w-3.5 h-3.5 shrink-0" />
          <span>Extract Subtitle</span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
              action === 'extract'
                ? 'bg-blue-950 text-white'
                : 'bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            SRT
          </span>
        </button>

        <button
          type="button"
          onClick={handleGenerateClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            action === 'generate'
              ? 'bg-blue-800 dark:bg-blue-600 text-white shadow-xs'
              : 'text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Generate Subtitle</span>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
              action === 'generate'
                ? 'bg-blue-950 text-white'
                : 'bg-slate-300 text-slate-900 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            AI
          </span>
        </button>
      </div>
    </div>
  )
}
