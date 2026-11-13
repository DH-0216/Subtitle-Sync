import React from 'react'
import {
  FileDown,
  CheckCircle2,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  SquareCheck,
  Check
} from 'lucide-react'

export interface ExtractedFileItem {
  outputPath: string
  fileName: string
  trackIndex: number
  language: string
  title: string
  cuesCount?: number
  durationStr?: string
}

interface Step3ExtractProps {
  unlocked: boolean
  isExtracting: boolean
  selectedCount: number
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  extractedFiles: ExtractedFileItem[]
  cleanTags: boolean
  setCleanTags: (val: boolean) => void
  onStartExtract: () => void
  onCancelExtract: () => void
  onOpenFolder: (targetPath?: string) => void
  onSendToSync: (item: ExtractedFileItem) => void
}

export const Step3Extract: React.FC<Step3ExtractProps> = ({
  unlocked,
  isExtracting,
  selectedCount,
  progress,
  statusMessage,
  lastOutputDir,
  extractedFiles,
  cleanTags,
  setCleanTags,
  onStartExtract,
  onCancelExtract,
  onOpenFolder,
  onSendToSync
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900/60 border-2 rounded-2xl p-5 shadow-sm transition-all ${
        unlocked
          ? 'border-blue-200/90 dark:border-slate-800/80 shadow-blue-500/10 dark:shadow-md dark:shadow-black/20 hover:border-blue-300 dark:hover:border-slate-700/70'
          : 'border-slate-200/60 dark:border-slate-800/40 opacity-70 cursor-not-allowed'
      }`}
    >
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-blue-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-6 h-6 rounded-full text-white font-bold text-xs flex items-center justify-center shadow-xs ${
              unlocked ? 'bg-blue-600 shadow-blue-600/30' : 'bg-slate-400'
            }`}
          >
            3
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Extract & Export .SRT
          </h2>
        </div>

        {extractedFiles.length > 0 && !isExtracting && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full dark:border-emerald-500/25">
            <CheckCircle2 className="w-3.5 h-3.5" /> Extracted ({extractedFiles.length})
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Clean tags checkbox */}
        <div className="flex items-center justify-between bg-blue-50/50 dark:bg-[#0B0F19]/50 border border-blue-100 dark:border-slate-800 rounded-xl px-4 py-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={cleanTags}
              onChange={(e) => setCleanTags(e.target.checked)}
              disabled={isExtracting}
              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Clean formatting override tags (removes residual ASS curly brace tags like {"{\\pos}"}, {"{\\an8}"})</span>
          </label>
        </div>

        {/* Progress bar when extracting */}
        {isExtracting && (
          <div className="space-y-2 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
            <div className="flex justify-between text-xs font-semibold text-blue-950 dark:text-blue-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                {statusMessage || 'Extracting subtitle streams with FFmpeg...'}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out shadow-xs shadow-blue-500"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        {!isExtracting && extractedFiles.length === 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onStartExtract}
              disabled={!unlocked || selectedCount === 0}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold text-sm shadow-md transition-all ${
                unlocked && selectedCount > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 hover:scale-[1.01] active:scale-[0.99] cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
              }`}
            >
              <FileDown className="w-4 h-4" />
              <span>
                {selectedCount > 0
                  ? `Extract ${selectedCount} Subtitle ${selectedCount === 1 ? 'Track' : 'Tracks'} to .SRT`
                  : 'Select at least 1 track in Step 2'}
              </span>
            </button>
          </div>
        )}

        {/* Cancel button during extraction */}
        {isExtracting && (
          <button
            type="button"
            onClick={onCancelExtract}
            className="w-full py-2.5 px-4 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel Extraction
          </button>
        )}

        {/* Extracted results list */}
        {extractedFiles.length > 0 && !isExtracting && (
          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-700/50 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  Successfully extracted {extractedFiles.length} subtitle {extractedFiles.length === 1 ? 'file' : 'files'} to .SRT!
                </span>
              </div>
              <button
                type="button"
                onClick={onStartExtract}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" /> Extract Again
              </button>
            </div>

            <div className="space-y-2">
              {extractedFiles.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={item.outputPath}>
                      {item.fileName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-blue-600 dark:text-blue-400 uppercase">
                        {item.language}
                      </span>
                      {item.cuesCount !== undefined && (
                        <span>• {item.cuesCount.toLocaleString()} cues</span>
                      )}
                      {item.durationStr && <span>• {item.durationStr}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Primary action: Send to Synchronizer */}
                    <button
                      type="button"
                      onClick={() => onSendToSync(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
                      title="Send this extracted subtitle directly to Step 2 Subtitles to align with video"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Send to Synchronizer</span>
                    </button>

                    {/* Open folder button */}
                    <button
                      type="button"
                      onClick={() => onOpenFolder(item.outputPath)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Open folder in File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Folder</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
