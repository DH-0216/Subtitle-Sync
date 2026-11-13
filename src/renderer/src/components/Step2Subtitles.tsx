import React, { useState } from 'react'
import { FileText, Plus, Trash2, CheckCircle2, X } from 'lucide-react'

export interface SubtitleItem {
  id: string
  path: string
  name: string
  cues?: number
  fps?: number
  tag?: string
  lines?: number
  span?: string
}

interface Step2SubtitlesProps {
  subtitles: SubtitleItem[]
  onBrowse: () => void
  onRemove: (id: string) => void
  onClearAll: () => void
  onDropFiles: (paths: string[]) => void
}

export const Step2Subtitles: React.FC<Step2SubtitlesProps> = ({
  subtitles,
  onBrowse,
  onRemove,
  onClearAll,
  onDropFiles
}) => {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i]
        paths.push((f as any).path || f.name)
      }
      onDropFiles(paths)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/60 border-2 border-blue-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm shadow-blue-500/10 dark:shadow-md dark:shadow-black/20 hover:border-blue-300 dark:hover:border-slate-700/70 transition-all">
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-blue-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-blue-600/30">
            2
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Out-of-Sync Subtitle(s)
          </h2>
          {subtitles.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20">
              {subtitles.length} {subtitles.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>

        {subtitles.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={onClearAll}
              className="text-xs text-blue-700 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1 transition-colors font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full dark:border-emerald-500/25">
              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
            </span>
          </div>
        )}
      </div>

      {subtitles.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onBrowse}
          className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? 'border-blue-600 bg-blue-100/60 dark:bg-blue-500/10 scale-[0.99] shadow-lg shadow-blue-500/20'
              : 'border-blue-300 hover:border-blue-600 bg-blue-50/70 hover:bg-blue-100/50 dark:border-slate-800 dark:hover:border-blue-500/50 dark:bg-[#0B0F19]/50 dark:hover:bg-[#0B0F19]/80'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-600 dark:bg-slate-800/80 text-white dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-600/30">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-blue-950 dark:text-slate-200 mb-1">
            Drag & drop subtitle(s) here, or <span className="text-blue-600 dark:text-blue-400 underline font-extrabold">browse</span>
          </p>
          <p className="text-xs text-blue-800/80 dark:text-slate-400 font-medium">Supports SRT, ASS, SSA, VTT (Batch processing supported)</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {subtitles.map((sub) => (
              <div
                key={sub.id}
                className="bg-blue-50/70 dark:bg-[#0B0F19]/70 border-2 border-blue-200/90 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-blue-300 dark:hover:border-slate-700 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white shadow-xs shadow-blue-600/30 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-blue-950 dark:text-slate-200 truncate" title={sub.path}>
                      {sub.name}
                    </p>
                    {/* Subtitle details: 🎬 fps • 🏷️ tag • 📝 lines • ⏱️ span */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {sub.fps && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 font-bold shadow-2xs">
                          🎬 {sub.fps} fps
                        </span>
                      )}
                      {sub.tag && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 font-bold shadow-2xs">
                          🏷️ {sub.tag}
                        </span>
                      )}
                      {sub.lines !== undefined && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 font-mono font-bold shadow-2xs">
                          📝 {sub.lines.toLocaleString()} lines
                        </span>
                      )}
                      {sub.span && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60 font-mono font-medium shadow-2xs">
                          ⏱️ {sub.span}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onRemove(sub.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove subtitle"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onBrowse}
            className="w-full py-2.5 border-2 border-dashed border-blue-300 hover:border-blue-600 text-blue-700 hover:text-blue-900 bg-blue-50/70 hover:bg-blue-100/60 dark:border-slate-800 dark:hover:border-blue-500/60 dark:text-slate-300 dark:hover:text-blue-300 dark:bg-[#0B0F19]/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add more subtitles
          </button>
        </div>
      )}
    </div>
  )
}
