import React, { useState, useEffect } from 'react'
import { X, FileText, Search, Copy, Check, FolderOpen, Clock, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Cue {
  index: number
  startMs: number
  endMs: number
  text: string
}

interface SubtitlePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  subPath: string | null
  onOpenFolder?: () => void
}

function formatTime(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms))
  const h = String(Math.floor(safeMs / 3600000)).padStart(2, '0')
  const m = String(Math.floor((safeMs % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((safeMs % 60000) / 1000)).padStart(2, '0')
  const milli = String(safeMs % 1000).padStart(3, '0')
  return `${h}:${m}:${s},${milli}`
}

export const SubtitlePreviewModal: React.FC<SubtitlePreviewModalProps> = ({
  isOpen,
  onClose,
  subPath,
  onOpenFolder
}) => {
  const [loading, setLoading] = useState(false)
  const [cues, setCues] = useState<Cue[]>([])
  const [totalCues, setTotalCues] = useState(0)
  const [fileName, setFileName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !subPath) return

    setLoading(true)
    setError(null)
    setSearchQuery('')
    setCopied(false)

    window.api?.engine?.previewSubtitle(subPath, 100).then((res: any) => {
      setLoading(false)
      if (res && !res.error) {
        setCues(res.cues || [])
        setTotalCues(res.totalCues || 0)
        setFileName(res.fileName || subPath.split(/[\/\\]/).pop() || 'Subtitle')
      } else {
        setError(res?.error || 'Could not load subtitle file.')
      }
    }).catch((err: any) => {
      setLoading(false)
      setError(err.message || 'Failed to inspect subtitle.')
    })
  }, [isOpen, subPath])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredCues = searchQuery.trim()
    ? cues.filter((c) => c.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : cues

  const handleCopyAll = () => {
    if (cues.length === 0) return
    const formatted = cues
      .map((c) => `${c.index}\n${formatTime(c.startMs)} --> ${formatTime(c.endMs)}\n${c.text}\n`)
      .join('\n')
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true)
      toast.success('Subtitle cues copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] transition-all">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Subtitle Preview
                </h3>
                {totalCues > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                    {totalCues} Cues
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {fileName || subPath}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search dialogues in preview..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            disabled={cues.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Copy cues to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy All'}</span>
          </button>

          {onOpenFolder && (
            <button
              type="button"
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              title="Open enclosing folder"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Folder</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-medium">Parsing subtitle cues...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="w-6 h-6" />
              <span className="text-xs font-semibold">{error}</span>
            </div>
          ) : filteredCues.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              {searchQuery ? 'No dialogue matches your search.' : 'No subtitle cues found in file.'}
            </div>
          ) : (
            filteredCues.map((cue) => (
              <div
                key={cue.index}
                className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-slate-700 transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    #{cue.index}
                  </span>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {formatTime(cue.startMs)} → {formatTime(cue.endMs)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-sans">
                  {cue.text}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>
            {totalCues > 100
              ? `Displaying first 100 of ${totalCues} total cues`
              : `Showing ${cues.length} cues`}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
