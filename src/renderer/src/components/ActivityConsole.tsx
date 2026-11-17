import React, { useRef, useEffect, useState } from 'react'
import { Terminal, Trash2, Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'

interface ActivityConsoleProps {
  logs: string[]
  onClear: () => void
  isSyncing?: boolean
  className?: string
}

export const ActivityConsole: React.FC<ActivityConsoleProps> = ({ logs, onClear, isSyncing, className = '' }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [copied, setCopied] = useState(false)

  // Auto-expand when synchronization starts
  useEffect(() => {
    if (isSyncing) {
      setIsExpanded(true)
    }
  }, [isSyncing])

  // Auto-scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (isExpanded && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs, isExpanded, isMaximized])

  const handleCopy = () => {
    if (logs.length > 0) {
      navigator.clipboard.writeText(logs.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev)
    if (isExpanded) {
      setIsMaximized(false)
    }
  }

  return (
    <div className={`bg-app-card border border-app-card-border rounded-2xl overflow-hidden shadow-xs transition-all duration-300 ${className}`}>
      {/* Header Bar */}
      <div
        className="bg-app-card-header text-app-text px-4 py-2.5 flex items-center justify-between border-b border-app-card-header-border transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-app-text" />
          <span className="font-bold text-xs uppercase tracking-wider text-app-text">
            Console Activity
          </span>
          {logs.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-app-card-inner-hover text-app-text border border-app-card-inner-border">
              {logs.length} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Action buttons (only when expanded or when logs exist) */}
          {isExpanded && logs.length > 0 && (
            <>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                title="Copy all logs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onClear}
                className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                title="Clear console"
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
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic select-none">
              Console idle. Start a synchronization to view real-time engine stdout/stderr and score ratings.
            </div>
          ) : (
            logs.map((line, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap break-all font-mono">
                {line.startsWith('[ERROR]') ? (
                  <span className="text-rose-400 font-semibold">{line}</span>
                ) : line.startsWith('[SUCCESS]') ? (
                  <span className="text-emerald-400 font-semibold">{line}</span>
                ) : line.startsWith('[ENGINE]') ? (
                  <span className="text-blue-400 font-medium">{line}</span>
                ) : line.startsWith('[MEDIA]') ? (
                  <span className="text-indigo-300 font-medium">{line}</span>
                ) : line.includes('score') || line.includes('Score') ? (
                  <span className="text-teal-400 font-semibold">{line}</span>
                ) : (
                  <span className="text-slate-300">{line}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
