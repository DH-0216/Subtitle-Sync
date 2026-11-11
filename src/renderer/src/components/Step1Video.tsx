import React, { useState } from 'react'
import { Film, Upload, CheckCircle2, Music, X } from 'lucide-react'

export interface AudioTrack {
  index: number
  codec: string
  language: string
  title: string
  channels: number
}

interface Step1VideoProps {
  videoPath: string | null
  videoDetails: {
    fps: number | null
    duration: string
    resolution: string
    audioCount: number
  } | null
  audioTracks: AudioTrack[]
  selectedTrack: number | null
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
    <div className="bg-white dark:bg-slate-900/60 border-2 border-blue-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm shadow-blue-500/10 dark:shadow-md dark:shadow-black/20 hover:border-blue-300 dark:hover:border-slate-700/70 transition-all">
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-blue-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-blue-600/30">
            1
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Reference Movie / Video
          </h2>
        </div>
        {videoPath && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full dark:border-emerald-500/25">
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
              ? 'border-blue-600 bg-blue-100/60 dark:bg-blue-500/10 scale-[0.99] shadow-lg shadow-blue-500/20'
              : 'border-blue-300 hover:border-blue-600 bg-blue-50/70 hover:bg-blue-100/50 dark:border-slate-800 dark:hover:border-blue-500/50 dark:bg-[#0B0F19]/50 dark:hover:bg-[#0B0F19]/80'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-600 dark:bg-slate-800/80 text-white dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-600/30">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-blue-950 dark:text-slate-200 mb-1">
            Drag & drop movie file here, or <span className="text-blue-600 dark:text-blue-400 underline font-extrabold">browse</span>
          </p>
          <p className="text-xs text-blue-800/80 dark:text-slate-400 font-medium">Supports MKV, MP4, AVI, MOV, WEBM, M4V</p>
        </div>
      ) : (
        <div className="bg-blue-50/70 dark:bg-[#0B0F19]/70 border-2 border-blue-200/90 dark:border-slate-800 rounded-xl p-4 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30 flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-blue-950 dark:text-slate-100 truncate" title={videoPath}>
                  {fileName}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {videoDetails?.duration && (
                    <span className="text-[11px] bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800/90 dark:text-slate-300 dark:border-slate-700/50 px-2 py-0.5 rounded font-mono font-bold shadow-2xs">
                      ⏱ {videoDetails.duration}
                    </span>
                  )}
                  {videoDetails?.fps && (
                    <span className="text-[11px] bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800/90 dark:text-slate-300 dark:border-slate-700/50 px-2 py-0.5 rounded font-mono font-bold shadow-2xs">
                      {videoDetails.fps.toFixed(3)} fps
                    </span>
                  )}
                  {videoDetails?.resolution && (
                    <span className="text-[11px] bg-blue-100/90 text-blue-900 border border-blue-300 dark:bg-slate-800/90 dark:text-slate-300 dark:border-slate-700/50 px-2 py-0.5 rounded font-mono font-bold shadow-2xs">
                      {videoDetails.resolution}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              title="Remove movie"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Track Selector */}
          {audioTracks.length > 0 && (
            <div className="mt-3.5 pt-3 border-t border-blue-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-blue-950 dark:text-slate-300">
                <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>
                  Audio Reference:{' '}
                  <strong className="text-blue-700 dark:text-blue-300 font-bold">
                    {currentTrackObj
                      ? `Track #${currentTrackObj.index}: ${currentTrackObj.language.toUpperCase()} (${currentTrackObj.codec}, ${currentTrackObj.channels}ch)`
                      : 'Default Audio Track'}
                  </strong>
                </span>
              </div>
              {audioTracks.length > 1 && (
                <button
                  onClick={onSelectTrackModal}
                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/30 px-3 py-1 rounded-lg transition-all"
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
