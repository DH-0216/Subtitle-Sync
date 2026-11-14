import React, { useState } from 'react'
import { FileText, Plus, Trash2, CheckCircle2, X } from 'lucide-react'
import { MetadataBadge } from './MetadataBadge'

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
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i]
        const fullPath = window.api.getPathForFile ? window.api.getPathForFile(f) : ((f as any).path || f.name)
        paths.push(fullPath || f.name)
      }
      onDropFiles(paths)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-800 dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            2
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">
            Out-of-Sync Subtitle(s)
          </h2>
          {subtitles.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
              {subtitles.length} {subtitles.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>

        {subtitles.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={onClearAll}
              className="text-xs text-slate-700 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 flex items-center gap-1 transition-colors font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700">
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
              ? 'border-blue-800 bg-blue-50 dark:bg-blue-950/40 scale-[0.99] shadow-xs'
              : 'border-slate-400 hover:border-blue-800 bg-slate-50 hover:bg-blue-50/30 dark:border-slate-700 dark:hover:border-slate-600 dark:bg-[#0B0F19] dark:hover:bg-[#0E1424]'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100/90 border border-blue-300 text-blue-900 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            Drag & drop subtitle(s) here, or <span className="text-blue-800 dark:text-blue-400 underline font-extrabold">browse</span>
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Supports SRT, ASS, SSA, VTT (Batch processing supported)</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {subtitles.map((sub) => (
              <div
                key={sub.id}
                className="bg-slate-50 dark:bg-[#0B0F19] border border-slate-300 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-slate-400 dark:hover:border-slate-700 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-800 dark:bg-blue-600 text-white shadow-xs flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={sub.path}>
                      {sub.name}
                    </p>
                    {/* Subtitle details: 🎬 fps • 🏷️ tag • 📝 lines • ⏱️ span */}
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {sub.fps && (
                        <MetadataBadge icon="🎬" label={`${sub.fps} fps`} />
                      )}
                      {sub.tag && (
                        <MetadataBadge icon="🏷️" label={sub.tag} />
                      )}
                      {sub.lines !== undefined && (
                        <MetadataBadge variant="mono" icon="📝" label={`${sub.lines.toLocaleString()} lines`} />
                      )}
                      {sub.span && (
                        <MetadataBadge variant="mono" icon="⏱️" label={sub.span} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onRemove(sub.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
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
            className="w-full py-2.5 border-2 border-dashed border-slate-400 hover:border-blue-800 text-slate-800 hover:text-blue-900 bg-white hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:text-slate-300 dark:hover:text-blue-300 dark:bg-[#0B0F19] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add more subtitles
          </button>
        </div>
      )}
    </div>
  )
}
