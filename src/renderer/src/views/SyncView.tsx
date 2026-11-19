import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Subtitles, SubtitleItem } from '../components/Step2Subtitles'
import { Step3Sync, SyncMode } from '../components/Step3Sync'
import { useMediaStore, useUIStore } from '../store'
import { useSyncWorkflow, useVideoMedia } from '../hooks'

export interface SyncViewProps {
  workflow?: ReturnType<typeof useSyncWorkflow>
  video?: ReturnType<typeof useVideoMedia>

  // Step 1: Video (optional overrides)
  videoPath?: string | null
  videoDetails?: any
  audioTracks?: AudioTrack[]
  selectedTrack?: number
  subtitleTracks?: SubtitleTrack[]
  videoError?: string | null
  onClearVideoError?: () => void
  onBrowseVideo?: () => void
  onRemoveVideo?: () => void
  onSelectTrackModal?: () => void
  onSelectVideo?: (path: string) => void
  onDropFilesOnVideo?: (paths: string[]) => void

  // Step 2: Subtitles (optional overrides)
  subtitles?: SubtitleItem[]
  subtitleError?: string | null
  onClearSubtitleError?: () => void
  onBrowseSubtitles?: () => void
  onRemoveSubtitle?: (id: string) => void
  onClearAllSubtitles?: () => void
  onAddSubtitles?: (paths: string[]) => void

  // Step 3: Execution (optional overrides)
  isSyncing?: boolean
  syncMode?: SyncMode
  setSyncMode?: (mode: SyncMode) => void
  recommendation?: any
  userSelectedMode?: boolean
  recommendedMode?: string | null
  recommendedReason?: string
  progress?: number
  statusMessage?: string
  lastOutputDir?: string | null
  onStartSync?: () => void
  onCancelSync?: () => void
  onOpenFolder?: (folder?: string) => void
}

export const SyncView: React.FC<SyncViewProps> = (props) => {
  const { workflow, video } = props
  const mediaStore = useMediaStore()
  const uiStore = useUIStore()

  // Video State & Actions
  const videoPath = props.videoPath !== undefined ? props.videoPath : (video?.videoPath ?? mediaStore.videoPath)
  const videoDetails = props.videoDetails !== undefined ? props.videoDetails : (video?.videoDetails ?? mediaStore.videoDetails)
  const audioTracks = props.audioTracks !== undefined ? props.audioTracks : (video?.audioTracks ?? mediaStore.audioTracks)
  const selectedTrack = props.selectedTrack !== undefined ? props.selectedTrack : (video?.selectedTrack ?? mediaStore.selectedTrack ?? 0)
  const subtitleTracks = props.subtitleTracks !== undefined ? props.subtitleTracks : (video?.subtitleTracks ?? mediaStore.subtitleTracks)
  const videoError = props.videoError !== undefined ? props.videoError : video?.videoError || null
  const onClearVideoError = props.onClearVideoError ?? video?.handleClearVideoError ?? (() => {})
  const onBrowseVideo = props.onBrowseVideo ?? video?.handleBrowseVideo ?? (() => {})
  const onRemoveVideo = props.onRemoveVideo ?? video?.handleRemoveVideo ?? mediaStore.clearMedia
  const onSelectTrackModal = props.onSelectTrackModal ?? (() => uiStore.setAudioModalOpen(true))
  const onSelectVideo = props.onSelectVideo ?? video?.handleSelectVideo ?? mediaStore.setVideoPath
  const onDropFilesOnVideo = props.onDropFilesOnVideo ?? video?.handleDropFilesOnVideo ?? (() => {})

  // Subtitle State & Actions
  const subtitles = props.subtitles ?? workflow?.subtitles ?? []
  const subtitleError = props.subtitleError !== undefined ? props.subtitleError : workflow?.subtitleError || null
  const onClearSubtitleError = props.onClearSubtitleError ?? workflow?.handleClearSubtitleError ?? (() => {})
  const onBrowseSubtitles = props.onBrowseSubtitles ?? workflow?.handleBrowseSubtitles ?? (() => {})
  const onRemoveSubtitle = props.onRemoveSubtitle ?? workflow?.handleRemoveSubtitle ?? (() => {})
  const onClearAllSubtitles =
    props.onClearAllSubtitles ??
    (() => {
      workflow?.setSubtitleError(null)
      workflow?.setSubtitles([])
      workflow?.resetSyncState()
    })
  const onAddSubtitles = props.onAddSubtitles ?? workflow?.handleAddSubtitles ?? (() => {})

  // Sync Workflow State & Actions
  const isSyncing = props.isSyncing ?? workflow?.isSyncing ?? false
  const syncMode = props.syncMode ?? workflow?.syncMode ?? 'Standard'
  const setSyncMode = props.setSyncMode ?? workflow?.handleSetSyncMode ?? (() => {})
  const recommendation = props.recommendation ?? workflow?.recommendation ?? null
  const userSelectedMode = props.userSelectedMode ?? workflow?.userSelectedMode ?? false
  const recommendedMode = props.recommendedMode ?? workflow?.recommendedMode ?? null
  const recommendedReason = props.recommendedReason ?? workflow?.recommendedReason ?? ''
  const progress = props.progress ?? workflow?.progress ?? 0
  const statusMessage = props.statusMessage ?? workflow?.statusMessage ?? ''
  const lastOutputDir = props.lastOutputDir ?? workflow?.lastOutputDir ?? mediaStore.lastOutputDir
  const onStartSync = props.onStartSync ?? workflow?.handleStartSync ?? (() => {})
  const onCancelSync = props.onCancelSync ?? workflow?.handleCancelSync ?? (() => {})
  const onOpenFolder = props.onOpenFolder ?? mediaStore.openFolder
  return (
    <>
      <Step1Video
        videoPath={videoPath}
        videoDetails={videoDetails}
        audioTracks={audioTracks}
        selectedTrack={selectedTrack}
        subtitleTracks={subtitleTracks}
        errorMessage={videoError}
        onClearError={onClearVideoError}
        onBrowse={onBrowseVideo}
        onRemove={onRemoveVideo}
        onSelectTrackModal={onSelectTrackModal}
        onDropFile={(path) => onSelectVideo(path)}
        onDropFiles={(paths) => onDropFilesOnVideo(paths)}
      />

      <Step2Subtitles
        subtitles={subtitles}
        errorMessage={subtitleError}
        onClearError={onClearSubtitleError}
        onBrowse={onBrowseSubtitles}
        onRemove={onRemoveSubtitle}
        onClearAll={onClearAllSubtitles}
        onDropFiles={(paths) => onAddSubtitles(paths)}
      />

      <Step3Sync
        unlocked={Boolean(videoPath && subtitles.length > 0)}
        isSyncing={isSyncing}
        syncMode={syncMode}
        setSyncMode={setSyncMode}
        recommendation={recommendation}
        userSelectedMode={userSelectedMode}
        recommendedMode={recommendedMode}
        recommendedReason={recommendedReason}
        progress={progress}
        statusMessage={statusMessage}
        lastOutputDir={lastOutputDir}
        onStartSync={onStartSync}
        onCancelSync={onCancelSync}
        onOpenFolder={onOpenFolder}
      />
    </>
  )
}
