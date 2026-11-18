import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Terminal, Trash2, Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2, Layers } from 'lucide-react'
import { SubtitleAction } from './SubtitleModeSelector'

export type LogCategory = SubtitleAction | 'system'

export interface LogEntry {
  id: number | string
  text: string
  category: LogCategory
}

interface ActivityConsoleProps {
  logs: LogEntry[] | string[]
  currentAction?: SubtitleAction
  onClear: (category?: SubtitleAction | 'all') => void
  isSyncing?: boolean
  className?: string
}

const ACTION_LABELS: Record<SubtitleAction, string> = {
  sync: 'Synchronize',
  extract: 'Extract',
  translate: 'Translate',
  generate: 'Generate'
}

export const ActivityConsole: React.FC<ActivityConsoleProps> = ({
  logs,
  currentAction = 'sync',
  onClear,
  isSyncing,
  className = ''
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Automatically switch to the selected option whenever the user switches sidebar tabs
  useEffect(() => {
    setShowAll(false)
  }, [currentAction])

  // Normalize logs
  const normalizedLogs: LogEntry[] = useMemo(() => {
    if (!logs || logs.length === 0) return []
    if (typeof logs[0] === 'string') {
      return (logs as string[]).map((text, idx) => ({
        id: idx,
        text,
        category: 'system' as LogCategory
      }))
    }
    return logs as LogEntry[]
  }, [logs])

  // Visible logs strictly based on currentAction (or showAll)
  const visibleLogs = useMemo(() => {
    if (showAll) {
      return normalizedLogs
    }
    return normalizedLogs.filter(
      (l) => l.category === currentAction || (currentAction === 'sync' && l.category === 'system')
    )
  }, [normalizedLogs, showAll, currentAction])

  // Auto-expand when a task starts running
  useEffect(() => {
    if (isSyncing) {
      setIsExpanded(true)
    }
  }, [isSyncing])

  // Auto-scroll terminal to bottom when new visible logs arrive
  useEffect(() => {
    if (isExpanded && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [visibleLogs, isExpanded, isMaximized])

  const handleCopy = () => {
    if (visibleLogs.length > 0) {
      navigator.clipboard.writeText(visibleLogs.map((l) => l.text).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClear = () => {
    onClear(showAll ? 'all' : currentAction)
  }

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev)
    if (isExpanded) {
      setIsMaximized(false)
    }
  }

  const getEmptyMessage = () => {
    if (showAll) {
      return 'Console idle. Start a task to view real-time engine stdout/stderr and logs.'
    }
    switch (currentAction) {
      case 'translate':
        return 'Translate activity idle. Start an AI translation to view real-time batch translation activity.'
      case 'generate':
        return 'Generate activity idle. Start subtitle generation to view Whisper AI and FFmpeg logs.'
      case 'sync':
        return 'Sync activity idle. Start a synchronization to view real-time engine stdout/stderr and score ratings.'
      case 'extract':
        return 'Extract activity idle. Select embedded tracks to view extraction logs.'
      default:
        return 'Console idle. Start a task to view real-time engine stdout/stderr and logs.'
    }
  }

  const renderLogLine = (line: string) => {
    if (line.startsWith('[ERROR]')) return <span className="text-rose-400 font-semibold">{line}</span>
    if (line.startsWith('[SUCCESS]')) return <span className="text-emerald-400 font-semibold">{line}</span>
    if (line.startsWith('[ENGINE]')) return <span className="text-blue-400 font-medium">{line}</span>
    if (line.startsWith('[MEDIA]')) return <span className="text-indigo-300 font-medium">{line}</span>
    if (line.startsWith('[TRANSLATE]') || line.startsWith('[AI TRANSLATION]'))
      return <span className="text-violet-300 font-medium">{line}</span>
    if (line.startsWith('[EXTRACT]')) return <span className="text-amber-300 font-medium">{line}</span>
    if (line.startsWith('[SYNC]')) return <span className="text-cyan-300 font-medium">{line}</span>
    if (line.startsWith('===')) return <span className="text-blue-300 font-bold">{line}</span>
    if (line.includes('score') || line.includes('Score')) return <span className="text-teal-400 font-semibold">{line}</span>
    return <span className="text-slate-300">{line}</span>
  }

  return (
    <div className={`bg-app-card border border-app-card-border rounded-2xl overflow-hidden shadow-xs transition-all duration-300 ${className}`}>
      {/* Header Bar */}
      <div className="bg-app-card-header text-app-text px-4 py-2.5 flex items-center justify-between border-b border-app-card-header-border transition-colors gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="w-4 h-4 text-app-text shrink-0" />
          <span className="font-bold text-xs uppercase tracking-wider text-app-text shrink-0">
            Console Activity
          </span>

          {/* Automatic Active Option Badge */}
          <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
            {showAll ? 'All Features' : ACTION_LABELS[currentAction] || currentAction}
          </span>

          {/* Line count */}
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-app-card-inner-hover text-app-text border border-app-card-inner-border shrink-0">
            {visibleLogs.length} {visibleLogs.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Action buttons (only when expanded or when logs exist) */}
          {isExpanded && (
            <>
              {/* Optional Show All / Current Toggle */}
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer ${
                  showAll
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-600'
                    : 'border-app-card-inner-border bg-app-card-inner text-app-text-muted hover:text-app-text'
                }`}
                title={showAll ? `Show only ${ACTION_LABELS[currentAction]} activity` : 'Show all console logs combined'}
              >
                <Layers className="w-3 h-3" />
                <span>{showAll ? 'Show Current' : 'Show All'}</span>
              </button>

              {visibleLogs.length > 0 && (
                <>
                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                    title={`Copy ${showAll ? 'all' : ACTION_LABELS[currentAction]} logs`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                    title={`Clear ${showAll ? 'all' : ACTION_LABELS[currentAction]} logs`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsMaximized((prev) => !prev)}
                    className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                    title={isMaximized ? 'Restore height' : 'Expand height'}
                  >
                    {isMaximized ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              )}
            </>
          )}

          {/* Expand / Collapse Button */}
          <button
            onClick={toggleExpand}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Log' : 'Show Log'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-app-btn-text" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-app-btn-text" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Console Body */}
      {isExpanded && (
        <div
          ref={terminalRef}
          className={`overflow-y-auto font-mono text-xs text-slate-300 p-3.5 select-text bg-[#070a10] border-t border-app-card-header-border space-y-1 transition-all duration-300 ${
            isMaximized ? 'h-96' : 'h-52'
          }`}
        >
          {visibleLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic select-none">
              {getEmptyMessage()}
            </div>
          ) : (
            visibleLogs.map((log) => (
              <div key={log.id} className="leading-relaxed whitespace-pre-wrap break-all font-mono">
                {renderLogLine(log.text)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
