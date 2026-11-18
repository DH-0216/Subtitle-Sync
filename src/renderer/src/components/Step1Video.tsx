import React, { useState } from 'react'
import {
  Film,
  CheckCircle2,
  Music,
  X,
  FileUp
} from 'lucide-react'
import { MetadataBadge } from './MetadataBadge'
import { StepCard } from './common/StepCard'
import { FileDropzone } from './common/FileDropzone'
import { cleanPathString } from '@shared/fileSanitizer'

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
  errorMessage?: string | null
  onClearError?: () => void
  onBrowse: () => void
  onRemove: () => void
  onSelectTrackModal: () => void
  onDropFile?: (path: string) => void
  onDropFiles?: (paths: string[]) => void
}

export const Step1Video: React.FC<Step1VideoProps> = ({
  videoPath,
  videoDetails,
  audioTracks,
  selectedTrack,
  subtitleTracks = [],
  errorMessage,
  onClearError,
  onBrowse,
  onRemove,
  onSelectTrackModal,
  onDropFile,
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
        const file = e.dataTransfer.files[i]
        const raw = window.api.getPathForFile
          ? window.api.getPathForFile(file)
          : (file as any).path || file.name
        const clean = cleanPathString(raw)
        if (clean) paths.push(clean)
      }
      if (onDropFiles) {
        onDropFiles(paths)
      } else if (onDropFile && paths.length > 0) {
        onDropFile(paths[0])
      }
    }
  }

  const fileName = videoPath ? videoPath.split(/[\/\\]/).pop() : ''
  const currentTrackObj =
    audioTracks.find((t) => t.index === selectedTrack) || audioTracks[0]

  const headerRight = videoPath ? (
    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700 whitespace-nowrap shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" /> Ready
    </span>
  ) : undefined

  return (
    <StepCard
      step={1}
      title="Reference Movie / Video"
      headerRight={headerRight}
      errorMessage={errorMessage}
      errorTitle="Unsupported File"
      onClearError={onClearError}
    >
      {!videoPath ? (
        <FileDropzone
          icon={<Film className="w-6 h-6" />}
          title={
            <>
              Drag &amp; drop movie here, or <span className="text-blue-600 dark:text-blue-400 underline font-extrabold">browse</span>
            </>
          }
          subtitle="Supports MP4, MKV, AVI, MOV, WEBM, FLV, TS, M4V (Audio track extracted automatically)"
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={onBrowse}
        />
      ) : (
        <div className="bg-app-card-inner border border-app-card-inner-border rounded-xl p-4 space-y-3 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-app-primary text-app-primary-fg shadow-xs flex items-center justify-center shrink-0">
                <Film className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-app-text truncate" title={videoPath}>
                  {fileName}
                </p>
                {/* Video details: 🎬 FPS • ⏱️ Duration • 📺 Resolution • 🎵 Audio stream count */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {videoDetails?.fps && (
                    <MetadataBadge icon="🎬" label={`${videoDetails.fps} fps`} />
                  )}
                  {videoDetails?.duration && (
                    <MetadataBadge icon="⏱️" label={videoDetails.duration} />
                  )}
                  {videoDetails?.resolution && (
                    <MetadataBadge variant="mono" icon="📺" label={videoDetails.resolution} />
                  )}
                  {audioTracks.length > 0 && (
                    <MetadataBadge variant="mono" icon="🎵" label={`${audioTracks.length} audio track${audioTracks.length === 1 ? '' : 's'}`} />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onBrowse}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors cursor-pointer shadow-2xs"
              >
                Change
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                title="Remove video"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Audio Track & Subtitle Track Detection Row */}
          {(currentTrackObj || subtitleTracks.length > 0) && (
            <div className="pt-3 border-t border-app-card-inner-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {currentTrackObj && (
                  <div className="flex items-center gap-1.5 font-bold text-app-text">
                    <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Reference Audio:</span>
                    <span className="font-semibold text-app-text">
                      Track #{currentTrackObj.index + 1}
                      {currentTrackObj.language && ` (${currentTrackObj.language.toUpperCase()})`}
                      {currentTrackObj.title && ` - ${currentTrackObj.title}`}
                      {currentTrackObj.channels && ` [${currentTrackObj.channels}ch ${currentTrackObj.codec}]`}
                    </span>
                  </div>
                )}

                {subtitleTracks.length > 0 ? (
                  <div className="flex items-center gap-1.5 font-bold text-app-text">
                    <FileUp className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>Embedded Subtitles:</span>
                    <span className="font-semibold text-app-text">
                      {subtitleTracks.length} track{subtitleTracks.length === 1 ? '' : 's'} detected in container
                    </span>
                  </div>
                ) : videoPath ? (
                  <div className="flex items-center gap-1.5 text-app-text-muted">
                    <FileUp className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    <span>Encoded Subtitles: None detected in container</span>
                  </div>
                ) : null}
              </div>

              {/* Change Audio Track Button */}
              {audioTracks.length > 1 && (
                <button
                  type="button"
                  onClick={onSelectTrackModal}
                  className="text-xs font-bold text-app-primary-fg bg-app-primary hover:bg-app-primary-hover shadow-2xs px-3 py-1 rounded-lg transition-all cursor-pointer shrink-0 ml-auto"
                >
                  Change Audio Track ({audioTracks.length})
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </StepCard>
  )
}
