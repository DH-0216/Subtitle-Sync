import React, { useState } from 'react'
import { FileText, X, CheckCircle2, Loader2, Zap, Film } from 'lucide-react'
import { SubtitleTrack } from './Step1Video'
import { isVideoFile, getFileName, cleanPathString } from '@shared/fileSanitizer'
import { StepCard } from './common/StepCard'
import { FileDropzone } from './common/FileDropzone'

interface Step1TranslateProps {
  sourceSubPath: string | null
  onSelectSubtitle: (path: string) => void
  onBrowseSubtitle: () => void
  onRemoveSubtitle: () => void
  errorMessage?: string | null
  onClearError?: () => void
  videoPath?: string | null
  subtitleTracks?: SubtitleTrack[]
  onExtractAndUseSubtitle?: (track: SubtitleTrack) => Promise<void> | void
  isExtracting?: boolean
  onBrowseVideo?: () => void
  onSelectVideo?: (path: string) => void
  onRemoveVideo?: () => void
}

export const Step1Translate: React.FC<Step1TranslateProps> = ({
  sourceSubPath,
  onSelectSubtitle,
  onBrowseSubtitle,
  onRemoveSubtitle,
  errorMessage,
  onClearError,
  videoPath,
  subtitleTracks = [],
  onExtractAndUseSubtitle,
  isExtracting = false,
  onBrowseVideo,
  onSelectVideo,
  onRemoveVideo
}) => {
  const [isSubDragOver, setIsSubDragOver] = useState(false)
  const [isVideoDragOver, setIsVideoDragOver] = useState(false)
  const [selectedEmbeddedTrackIndex, setSelectedEmbeddedTrackIndex] = useState<number>(() => {
    const textTracks = subtitleTracks.filter((t) => t.isText)
    return textTracks.length > 0 ? textTracks[0].index : 0
  })

  const textSubtitleTracks = subtitleTracks.filter((t) => t.isText)
  const fileName = sourceSubPath ? getFileName(sourceSubPath) : null

  const isDirectSubSelected = Boolean(sourceSubPath && !videoPath)
  const isMovieSelected = Boolean(videoPath)
  const isMovieSubReady = Boolean(videoPath && sourceSubPath)

  const handleSubDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSubDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const raw = window.api?.getPathForFile ? window.api.getPathForFile(file) : ((file as any).path || file.name)
      const fullPath = cleanPathString(raw)
      if (fullPath) {
        if (isVideoFile(fullPath)) {
          onRemoveSubtitle()
          if (onSelectVideo) onSelectVideo(fullPath)
        } else {
          if (onRemoveVideo) onRemoveVideo()
          onSelectSubtitle(fullPath)
        }
      }
    }
  }

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsVideoDragOver(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const raw = window.api?.getPathForFile ? window.api.getPathForFile(file) : ((file as any).path || file.name)
      const fullPath = cleanPathString(raw)
      if (fullPath) {
        if (isVideoFile(fullPath)) {
          onRemoveSubtitle()
          if (onSelectVideo) onSelectVideo(fullPath)
        } else {
          if (onRemoveVideo) onRemoveVideo()
          onSelectSubtitle(fullPath)
        }
      }
    }
  }

  const handleBrowseSubtitleChoice = () => {
    onBrowseSubtitle()
  }

  const handleBrowseVideoChoice = () => {
    if (onBrowseVideo) onBrowseVideo()
  }

  const handleRemoveMovieChoice = () => {
    if (isMovieSubReady) onRemoveSubtitle()
    if (onRemoveVideo) onRemoveVideo()
  }

  const headerRight = sourceSubPath ? (
    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700 whitespace-nowrap shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" /> Subtitle Ready
    </span>
  ) : null

  return (
    <StepCard
      step={1}
      title="Source Subtitle to Translate"
      headerRight={headerRight}
      errorMessage={errorMessage}
      errorTitle="Subtitle Error"
      onClearError={onClearError}
    >
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 lg:gap-12 items-stretch">
          {/* Option A: Existing Subtitle File */}
          <div className="flex flex-col h-full">
            {isDirectSubSelected ? (
              <div className="p-4 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between h-full min-h-[175px] transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-app-text truncate" title={sourceSubPath!}>
                          {fileName}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Selected Subtitle
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleBrowseSubtitleChoice}
                        className="text-[10.5px] font-bold text-app-btn-text px-2 py-0.5 rounded border border-app-btn-border bg-app-btn hover:bg-app-btn-hover transition-all cursor-pointer shadow-2xs"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={onRemoveSubtitle}
                        className="p-1 text-app-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove subtitle"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-app-text-muted truncate" title={sourceSubPath!}>
                    {sourceSubPath}
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Ready for translation</span>
                </div>
              </div>
            ) : (
              <FileDropzone
                icon={<FileText className="w-5 h-5" />}
                title={
                  <>
                    Use existing <span className="text-blue-700 dark:text-blue-400 underline font-extrabold">.srt file</span>
                  </>
                }
                subtitle="Drag & drop or browse .srt, .vtt, or .ass subtitle"
                isDragOver={isSubDragOver}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsSubDragOver(true)
                }}
                onDragLeave={() => setIsSubDragOver(false)}
                onDrop={handleSubDrop}
                onClick={handleBrowseSubtitleChoice}
                className={`h-full flex flex-col justify-center py-5 min-h-[175px] transition-opacity ${
                  isMovieSelected ? 'opacity-60 hover:opacity-100' : ''
                }`}
              />
            )}
          </div>

          {/* Middle "OR" Divider on Mobile */}
          <div className="md:hidden flex items-center justify-center my-2.5">
            <div className="w-full flex items-center gap-2">
              <div className="flex-1 h-px bg-app-card-inner-border" />
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-[#0B0F19] border border-blue-200 dark:border-app-card-inner-border text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider shadow-2xs">
                OR
              </span>
              <div className="flex-1 h-px bg-app-card-inner-border" />
            </div>
          </div>

          {/* Option B: Movie with Embedded Subtitles */}
          <div className="flex flex-col h-full">
            {!isMovieSelected ? (
              <FileDropzone
                icon={<Film className="w-5 h-5" />}
                title={
                  <>
                    Have movie with subtitles? <span className="text-blue-700 dark:text-blue-400 underline font-extrabold">Browse</span>
                  </>
                }
                subtitle="Extract from MKV or MP4 video container"
                isDragOver={isVideoDragOver}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsVideoDragOver(true)
                }}
                onDragLeave={() => setIsVideoDragOver(false)}
                onDrop={handleVideoDrop}
                onClick={handleBrowseVideoChoice}
                className={`h-full flex flex-col justify-center py-5 min-h-[175px] transition-opacity ${
                  isDirectSubSelected ? 'opacity-60 hover:opacity-100' : ''
                }`}
              />
            ) : isMovieSubReady ? (
              /* Movie Selected AND Track Extracted & Ready */
              <div className="p-4 rounded-xl border-2 border-emerald-400/80 dark:border-emerald-600/80 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between h-full min-h-[175px] transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <Film className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-app-text truncate block" title={videoPath!}>
                          {getFileName(videoPath!)}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Track Extracted
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleBrowseVideoChoice}
                        className="text-[10.5px] font-bold text-app-btn-text px-2 py-0.5 rounded border border-app-btn-border bg-app-btn hover:bg-app-btn-hover transition-all cursor-pointer shadow-2xs"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveMovieChoice}
                        className="p-1 text-app-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove movie"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-app-text-muted truncate" title={sourceSubPath!}>
                    Source: {fileName}
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Extracted track ready!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveSubtitle()}
                    className="text-[10.5px] font-bold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Select other track
                  </button>
                </div>
              </div>
            ) : (
              /* Movie Selected, Track Not Yet Extracted */
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsVideoDragOver(true)
                }}
                onDragLeave={() => setIsVideoDragOver(false)}
                onDrop={handleVideoDrop}
                className={`border-2 rounded-xl p-4 flex flex-col justify-between h-full min-h-[175px] transition-all duration-200 ${
                  isVideoDragOver
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40'
                    : 'border-blue-400 dark:border-blue-600/80 bg-blue-50/40 dark:bg-blue-950/20'
                }`}
              >
                {/* Movie Header */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Film className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-bold text-app-text truncate" title={videoPath!}>
                        {getFileName(videoPath!)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onBrowseVideo && (
                        <button
                          type="button"
                          onClick={handleBrowseVideoChoice}
                          className="text-[10.5px] font-bold text-app-btn-text px-2 py-0.5 rounded border border-app-btn-border bg-app-btn hover:bg-app-btn-hover transition-all cursor-pointer shadow-2xs"
                        >
                          Change
                        </button>
                      )}
                      {onRemoveVideo && (
                        <button
                          type="button"
                          onClick={handleRemoveMovieChoice}
                          className="p-1 text-app-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                          title="Remove movie"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-app-text-muted">
                    {textSubtitleTracks.length > 0
                      ? `${textSubtitleTracks.length} embedded text subtitle track${textSubtitleTracks.length === 1 ? '' : 's'} found`
                      : 'No embedded text tracks found'}
                  </p>
                </div>

                {/* Subtitle track extraction controls */}
                {textSubtitleTracks.length > 0 ? (
                  <div className="space-y-2 mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedEmbeddedTrackIndex}
                        onChange={(e) => setSelectedEmbeddedTrackIndex(Number(e.target.value))}
                        disabled={isExtracting}
                        className="flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 cursor-pointer disabled:opacity-60 min-w-0 truncate"
                      >
                        {textSubtitleTracks.map((t) => (
                          <option key={t.index} value={t.index}>
                            #{t.index + 1}: {t.language.toUpperCase()} ({t.codec}){t.title ? ` - ${t.title}` : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          const trk = textSubtitleTracks.find((t) => t.index === selectedEmbeddedTrackIndex) || textSubtitleTracks[0]
                          if (trk && onExtractAndUseSubtitle) {
                            onExtractAndUseSubtitle(trk)
                          }
                        }}
                        disabled={isExtracting}
                        className="px-3 py-1.5 rounded-lg bg-app-primary hover:bg-app-primary-hover text-app-primary-fg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
                        title="Extract this subtitle track and use it for translation"
                      >
                        {isExtracting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Extracting...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Extract &amp; Use</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      No text tracks found. Use existing subtitle file on the left or change movie.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Middle "OR" Badge on Desktop */}
        <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-[#0B0F19] border border-blue-200 dark:border-app-card-inner-border shadow-xs flex items-center justify-center">
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              OR
            </span>
          </div>
        </div>
      </div>
    </StepCard>
  )
}
