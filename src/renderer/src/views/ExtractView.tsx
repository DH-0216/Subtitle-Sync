import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Extract } from '../components/Step2Extract'
import { Step3Extract } from '../components/Step3Extract'

export interface ExtractViewProps {
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

  // Step 2: Tracks
  selectedExtractTrackIndices: number[]
  onToggleExtractTrack: (idx: number) => void
  onSelectAllExtractTracks: () => void
  onDeselectAllExtractTracks: () => void
  onExtractSingleNow: (track: SubtitleTrack) => void
  onRescan: () => void
  onSwitchToGenerate: () => void
  isExtracting: boolean

  // Step 3: Execution
  extractProgress: number
  extractStatusMessage: string
  lastOutputDir: string | null
  extractCleanTags: boolean
  setExtractCleanTags: (c: boolean) => void
  onStartExtract: () => void
  onCancelExtract: () => void
  onOpenFolder: (folder?: string) => void
  extractOutputDir: string | null
  onChangeExtractOutputDir: () => void
}

export const ExtractView: React.FC<ExtractViewProps> = ({
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
  selectedExtractTrackIndices,
  onToggleExtractTrack,
  onSelectAllExtractTracks,
  onDeselectAllExtractTracks,
  onExtractSingleNow,
  onRescan,
  onSwitchToGenerate,
  isExtracting,
  extractProgress,
  extractStatusMessage,
  lastOutputDir,
  extractCleanTags,
  setExtractCleanTags,
  onStartExtract,
  onCancelExtract,
  onOpenFolder,
  extractOutputDir,
  onChangeExtractOutputDir
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

      <Step2Extract
        videoPath={videoPath}
        subtitleTracks={subtitleTracks}
        selectedTrackIndices={selectedExtractTrackIndices}
        onToggleTrack={onToggleExtractTrack}
        onSelectAllTracks={onSelectAllExtractTracks}
        onDeselectAllTracks={onDeselectAllExtractTracks}
        onExtractSingleNow={onExtractSingleNow}
        onRescan={onRescan}
        onSwitchToGenerate={onSwitchToGenerate}
        isExtracting={isExtracting}
      />

      <Step3Extract
        unlocked={Boolean(videoPath && subtitleTracks.length > 0 && selectedExtractTrackIndices.length > 0)}
        isExtracting={isExtracting}
        selectedCount={selectedExtractTrackIndices.length}
        progress={extractProgress}
        statusMessage={extractStatusMessage}
        lastOutputDir={lastOutputDir}
        cleanTags={extractCleanTags}
        setCleanTags={setExtractCleanTags}
        onStartExtract={onStartExtract}
        onCancelExtract={onCancelExtract}
        onOpenFolder={onOpenFolder}
        videoPath={videoPath}
        outputDir={extractOutputDir}
        onChangeOutputDir={onChangeExtractOutputDir}
      />
    </>
  )
}
