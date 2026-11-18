import React, { useState } from 'react'
import { FileText, Plus, Trash2, CheckCircle2, X } from 'lucide-react'
import { MetadataBadge } from './MetadataBadge'
import { StepCard } from './common/StepCard'
import { Badge } from './common/Badge'
import { FileDropzone } from './common/FileDropzone'
import { cleanPathString } from '@shared/fileSanitizer'

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
  errorMessage?: string | null
  onClearError?: () => void
  onBrowse: () => void
  onRemove: (id: string) => void
  onClearAll: () => void
  onDropFiles: (paths: string[]) => void
}

export const Step2Subtitles: React.FC<Step2SubtitlesProps> = ({
  subtitles,
  errorMessage,
  onClearError,
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
        const raw = window.api.getPathForFile ? window.api.getPathForFile(f) : ((f as any).path || f.name)
        const clean = cleanPathString(raw)
        if (clean) paths.push(clean)
      }
      onDropFiles(paths)
    }
  }

  const badge = subtitles.length > 0 ? (
    <Badge
      text={`${subtitles.length} ${subtitles.length === 1 ? 'file' : 'files'}`}
      variant="subtle"
      size="xs"
    />
  ) : undefined

  const headerRight = subtitles.length > 0 ? (
    <div className="flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-app-text-muted hover:text-rose-500 flex items-center gap-1 transition-colors font-semibold cursor-pointer whitespace-nowrap"
      >
        <Trash2 className="w-3.5 h-3.5" /> Clear All
      </button>
      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
      </span>
    </div>
  ) : undefined

  return (
    <StepCard
      step={2}
      title="Out-of-Sync Subtitle(s)"
      badge={badge}
      headerRight={headerRight}
      errorMessage={errorMessage}
      errorTitle="Unsupported Subtitle File"
      onClearError={onClearError}
    >
      {subtitles.length === 0 ? (
        <FileDropzone
          icon={<FileText className="w-6 h-6" />}
          title={
            <>
              Drag &amp; drop subtitle(s) here, or <span className="text-blue-600 dark:text-blue-400 underline font-extrabold">browse</span>
            </>
          }
          subtitle="Supports SRT, ASS, SSA, VTT (Batch processing supported)"
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onBrowse}
        />
      ) : (
        <div className="space-y-2">
          <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
            {subtitles.map((sub) => (
              <div
                key={sub.id}
                className="bg-app-card-inner border border-app-card-inner-border rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-blue-400 transition-colors shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-app-primary text-app-primary-fg shadow-xs flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-app-text truncate" title={sub.path}>
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
                    type="button"
                    onClick={() => onRemove(sub.id)}
                    className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove subtitle"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onBrowse}
            className="w-full py-2.5 border-2 border-dashed border-app-btn-border hover:border-app-primary text-app-btn-text hover:text-app-primary bg-app-btn hover:bg-app-btn-hover rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add more subtitles
          </button>
        </div>
      )}
    </StepCard>
  )
}
