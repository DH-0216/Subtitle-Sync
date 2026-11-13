import React from 'react'
import { X, Music, Check } from 'lucide-react'
import { AudioTrack } from './Step1Video'

interface AudioTrackModalProps {
  isOpen: boolean
  onClose: () => void
  tracks: AudioTrack[]
  selectedTrack: number | null
  onSelectTrack: (trackIndex: number) => void
}

export const AudioTrackModal: React.FC<AudioTrackModalProps> = ({
  isOpen,
  onClose,
  tracks,
  selectedTrack,
  onSelectTrack
}) => {
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-colors">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Music className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Select Reference Audio Track</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {tracks.map((track) => {
            const isSelected = selectedTrack === track.index || (selectedTrack === null && track.index === 0)
            return (
              <div
                key={track.index}
                onClick={() => {
                  onSelectTrack(track.index)
                  onClose()
                }}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-100/90 border-blue-800 ring-1 ring-blue-800 shadow-2xs dark:bg-blue-950/40 dark:border-blue-500 dark:ring-blue-500/40'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70 dark:bg-[#0B0F19]/60 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-[#0B0F19]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-400 font-mono">
                      Track #{track.index}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/50 shadow-2xs">
                      {track.language ? track.language.toUpperCase() : 'UNKNOWN'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      ({track.codec}, {track.channels}ch)
                    </span>
                  </div>
                  {track.title && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic truncate">{track.title}</p>
                  )}
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-blue-800 dark:bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 bg-slate-50 dark:bg-[#0B0F19] border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
