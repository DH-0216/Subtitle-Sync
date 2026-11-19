import React from 'react'
import { Music, Check } from 'lucide-react'
import { AudioTrack } from './Step1Video'
import { ModalHeader } from './common'
import { useUIStore, useMediaStore, useLogStore } from '../store'

interface AudioTrackModalProps {
  isOpen?: boolean
  onClose?: () => void
  tracks?: AudioTrack[]
  selectedTrack?: number | null
  onSelectTrack?: (trackIndex: number) => void
}

export const AudioTrackModal: React.FC<AudioTrackModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  tracks: propTracks,
  selectedTrack: propSelectedTrack,
  onSelectTrack: propOnSelectTrack
}) => {
  const storeIsOpen = useUIStore((s) => s.audioModalOpen)
  const storeClose = () => useUIStore.getState().setAudioModalOpen(false)
  const storeTracks = useMediaStore((s) => s.audioTracks)
  const storeSelectedTrack = useMediaStore((s) => s.selectedTrack)

  const isOpen = propIsOpen ?? storeIsOpen
  const onClose = propOnClose ?? storeClose
  const tracks = propTracks ?? storeTracks
  const selectedTrack = propSelectedTrack !== undefined ? propSelectedTrack : storeSelectedTrack
  const onSelectTrack =
    propOnSelectTrack ??
    ((idx: number) => {
      useMediaStore.getState().setSelectedTrack(idx)
      useLogStore.getState().addSyncLog(`[AUDIO] Selected audio reference track #${idx}`)
    })

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
      <div className="bg-app-card border border-app-card-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transition-colors">
        <ModalHeader
          title="Select Reference Audio Track"
          icon={<Music className="w-4 h-4" />}
          onClose={onClose}
        />

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
                    ? 'bg-app-accent-bg border-app-primary ring-1 ring-app-primary shadow-2xs text-app-text'
                    : 'bg-app-card-inner border-app-card-inner-border hover:border-app-accent hover:bg-app-card-inner-hover'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-app-accent font-mono">
                      Track #{track.index}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-app-input text-app-input-text border border-app-input-border shadow-2xs">
                      {track.language ? track.language.toUpperCase() : 'UNKNOWN'}
                    </span>
                    <span className="text-[11px] text-app-text-muted font-mono">
                      ({track.codec}, {track.channels}ch)
                    </span>
                  </div>
                  {track.title && (
                    <p className="text-xs text-app-text-muted mt-1 italic truncate">{track.title}</p>
                  )}
                </div>

                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-app-primary text-app-primary-fg flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 bg-app-header border-t border-app-header-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-app-btn hover:bg-app-btn-hover border border-app-btn-border text-app-btn-text transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
