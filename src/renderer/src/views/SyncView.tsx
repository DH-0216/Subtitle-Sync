import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Subtitles, SubtitleItem } from '../components/Step2Subtitles'
import { Step3Sync, SyncMode } from '../components/Step3Sync'

export interface SyncViewProps {
  // Step 1: Video
  videoPath: string | null
  videoDetails: any
  audioTracks: AudioTrack[]
  selectedTrack: number
  subtitleTracks: SubtitleTrack[]
  videoError: string | null
  onClearVideoError: () => void
  onBrowseVideo: () => void
  onRemoveVideo: () => void
  onSelectTrackModal: () => void
  onSelectVideo: (path: string) => void
  onDropFilesOnVideo: (paths: string[]) => void

  // Step 2: Subtitles
  subtitles: SubtitleItem[]
  subtitleError: string | null
  onClearSubtitleError: () => void
  onBrowseSubtitles: () => void
  onRemoveSubtitle: (id: string) => void
  onClearAllSubtitles: () => void
  onAddSubtitles: (paths: string[]) => void

  // Step 3: Execution
  isSyncing: boolean
  syncMode: SyncMode
  setSyncMode: (mode: SyncMode) => void
  recommendation: any
  userSelectedMode: boolean
  recommendedMode: string | null
  recommendedReason: string
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  onStartSync: () => void
  onCancelSync: () => void
  onOpenFolder: (folder?: string) => void
}

export const SyncView: React.FC<SyncViewProps> = ({
  videoPath,
  videoDetails,
  audioTracks,
  selectedTrack,
  subtitleTracks,
  videoError,
  onClearVideoError,
  onBrowseVideo,
  onRemoveVideo,
  onSelectTrackModal,
  onSelectVideo,
  onDropFilesOnVideo,
  subtitles,
  subtitleError,
  onClearSubtitleError,
  onBrowseSubtitles,
  onRemoveSubtitle,
  onClearAllSubtitles,
  onAddSubtitles,
  isSyncing,
  syncMode,
  setSyncMode,
  recommendation,
  userSelectedMode,
  recommendedMode,
  recommendedReason,
  progress,
  statusMessage,
  lastOutputDir,
  onStartSync,
  onCancelSync,
  onOpenFolder
}) => {
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
