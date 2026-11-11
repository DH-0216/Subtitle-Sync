import React, { useRef, useEffect, useState } from 'react'
import { Terminal, Trash2, Copy, Check, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'

interface ActivityConsoleProps {
  logs: string[]
  onClear: () => void
  isSyncing?: boolean
}

export const ActivityConsole: React.FC<ActivityConsoleProps> = ({ logs, onClear, isSyncing }) => {
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
    <div className="bg-white dark:bg-[#0B0F19] border-2 border-blue-200/90 dark:border-slate-800/90 rounded-2xl overflow-hidden shadow-sm shadow-blue-500/10 dark:shadow-md transition-all duration-300">
      {/* Header Bar */}
      <div
        className="bg-blue-600 dark:bg-slate-900/80 text-white px-4 py-2.5 flex items-center justify-between border-b border-transparent transition-colors data-[expanded=true]:border-blue-700 dark:data-[expanded=true]:border-slate-800"
        data-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-blue-200 dark:text-blue-400" />
          <span className="font-extrabold text-xs uppercase tracking-wider text-white dark:text-slate-300">
            CONSOLE ACTIVITY
          </span>
          {logs.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-700/80 text-blue-100 border border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25">
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
                className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-blue-700/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Copy all logs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-300 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={onClear}
                className="p-1.5 rounded-lg text-blue-100 hover:text-rose-200 hover:bg-blue-700/80 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 transition-colors"
                title="Clear console"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-blue-700/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
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
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-white/40 bg-white hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-slate-200 text-xs font-bold transition-all shadow-xs"
          >
            <span>{isExpanded ? 'Hide Log' : 'Show Log'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-blue-700 dark:text-slate-200" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-blue-700 dark:text-slate-200" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Console Body */}
      {isExpanded && (
        <div
          ref={terminalRef}
          className={`overflow-y-auto font-mono text-xs text-slate-300 p-3.5 select-text bg-[#070a10] border-t border-slate-200/80 dark:border-slate-800 space-y-1 transition-all duration-300 ${
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
