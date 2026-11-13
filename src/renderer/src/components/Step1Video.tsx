import React, { useState } from 'react'
import { Film, Upload, CheckCircle2, Music, X, FileDown } from 'lucide-react'
import { MetadataBadge } from './MetadataBadge'

export interface AudioTrack {
  index: number
  codec: string
  language: string
  title: string
  channels: number
}

export interface SubtitleTrack {
  index: number
  streamIndex: number
  codec: string
  language: string
  title: string
  isDefault: boolean
  isForced: boolean
  isText: boolean
}

interface Step1VideoProps {
  videoPath: string | null
  videoDetails: {
    fps: number | null
    duration: string
    resolution: string
    audioCount: number
    subtitleCount?: number
  } | null
  audioTracks: AudioTrack[]
  selectedTrack: number | null
  subtitleTracks?: SubtitleTrack[]
  onBrowse: () => void
  onRemove: () => void
  onSelectTrackModal: () => void
  onDropFile: (path: string) => void
}

export const Step1Video: React.FC<Step1VideoProps> = ({
  videoPath,
  videoDetails,
  audioTracks,
  selectedTrack,
  subtitleTracks = [],
  onBrowse,
  onRemove,
  onSelectTrackModal,
  onDropFile
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
      const file = e.dataTransfer.files[0]
      onDropFile((file as any).path || file.name)
    }
  }

  const fileName = videoPath ? videoPath.split(/[\/\\]/).pop() : ''
  const currentTrackObj = audioTracks.find((t) => t.index === selectedTrack) || audioTracks[0]

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-800 dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            1
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">
            Reference Movie / Video
          </h2>
        </div>
        {videoPath && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </span>
        )}
      </div>

      {!videoPath ? (
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
          <div className="w-12 h-12 rounded-xl bg-blue-800 dark:bg-slate-800 text-white dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
            Drag & drop movie file here, or <span className="text-blue-800 dark:text-blue-400 underline font-extrabold">browse</span>
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Supports MKV, MP4, AVI, MOV, WEBM, M4V</p>
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-[#0B0F19] border border-slate-300 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-800 dark:bg-blue-600 text-white shadow-xs flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={videoPath}>
                  {fileName}
                </p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {videoDetails?.duration && (
                    <MetadataBadge variant="mono" icon="⏱" label={videoDetails.duration} />
                  )}
                  {videoDetails?.fps && (
                    <MetadataBadge variant="mono" icon="🎬" label={`${videoDetails.fps.toFixed(3)} fps`} />
                  )}
                  {videoDetails?.resolution && (
                    <MetadataBadge variant="mono" icon="🖥️" label={videoDetails.resolution} />
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Remove movie"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Tracks & Encoded Subtitles Information (Combined into single row) */}
          {(audioTracks.length > 0 || (subtitleTracks && subtitleTracks.length > 0) || videoPath) && (
            <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                {/* Audio Tracks Count & Languages */}
                {audioTracks.length > 0 && (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-300">
                    <Music className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>
                      Audio Tracks:{' '}
                      <strong className="text-blue-900 dark:text-blue-300 font-bold">
                        {audioTracks.length} {audioTracks.length === 1 ? 'Track' : 'Tracks'} Detected ({audioTracks
                          .slice(0, 4)
                          .map((t) => (t.language ? t.language.toUpperCase() : 'UNK'))
                          .join(', ')}
                        {audioTracks.length > 4 ? '...' : ''})
                      </strong>
                    </span>
                  </div>
                )}

                {/* Encoded Subtitle Tracks Count & Languages */}
                {subtitleTracks && subtitleTracks.length > 0 ? (
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-300">
                    <FileDown className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>
                      Encoded Subtitles:{' '}
                      <strong className="text-emerald-800 dark:text-emerald-400 font-bold">
                        {subtitleTracks.length} {subtitleTracks.length === 1 ? 'Track' : 'Tracks'} Detected ({subtitleTracks
                          .slice(0, 4)
                          .map((t) => t.language.toUpperCase())
                          .join(', ')}
                        {subtitleTracks.length > 4 ? '...' : ''})
                      </strong>
                    </span>
                  </div>
                ) : videoPath ? (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <FileDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    <span>Encoded Subtitles: None detected in container</span>
                  </div>
                ) : null}
              </div>

              {/* Change Audio Track Button */}
              {audioTracks.length > 1 && (
                <button
                  onClick={onSelectTrackModal}
                  className="text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-2xs px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ml-auto"
                >
                  Change Audio Track ({audioTracks.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
