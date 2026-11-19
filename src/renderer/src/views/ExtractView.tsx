import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Extract } from '../components/Step2Extract'
import { Step3Extract } from '../components/Step3Extract'
import { useMediaStore, useUIStore } from '../store'
import { useExtractWorkflow, useVideoMedia } from '../hooks'

export interface ExtractViewProps {
  workflow?: ReturnType<typeof useExtractWorkflow>
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

  // Step 2: Tracks (optional overrides)
  selectedExtractTrackIndices?: number[]
  onToggleExtractTrack?: (idx: number) => void
  onSelectAllExtractTracks?: () => void
  onDeselectAllExtractTracks?: () => void
  onExtractSingleNow?: (track: SubtitleTrack) => void
  onRescan?: () => void
  onSwitchToGenerate?: () => void
  isExtracting?: boolean

  // Step 3: Execution (optional overrides)
  extractProgress?: number
  extractStatusMessage?: string
  lastOutputDir?: string | null
  extractCleanTags?: boolean
  setExtractCleanTags?: (c: boolean) => void
  onStartExtract?: () => void
  onCancelExtract?: () => void
  onOpenFolder?: (folder?: string) => void
  extractOutputDir?: string | null
  onChangeExtractOutputDir?: () => void
}

export const ExtractView: React.FC<ExtractViewProps> = (props) => {
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

  // Step 2: Tracks
  const selectedExtractTrackIndices = props.selectedExtractTrackIndices ?? workflow?.selectedExtractTrackIndices ?? []
  const onToggleExtractTrack =
    props.onToggleExtractTrack ??
    ((idx: number) =>
      workflow?.setSelectedExtractTrackIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      ))
  const onSelectAllExtractTracks =
    props.onSelectAllExtractTracks ??
    (() => {
      const tracks = video?.subtitleTracks || mediaStore.subtitleTracks || []
      const textTracks = tracks.filter((t) => t.isText)
      workflow?.setSelectedExtractTrackIndices(textTracks.map((t) => t.index))
    })
  const onDeselectAllExtractTracks =
    props.onDeselectAllExtractTracks ?? (() => workflow?.setSelectedExtractTrackIndices([]))
  const onExtractSingleNow = props.onExtractSingleNow ?? workflow?.handleExtractSingleNow ?? (() => {})
  const onRescan =
    props.onRescan ??
    (() => {
      const currentPath = video?.videoPath || mediaStore.videoPath
      if (currentPath && video) video.handleSelectVideo(currentPath)
    })
  const isExtracting = props.isExtracting ?? workflow?.isExtracting ?? false
  const handleSwitchToGenerate =
    props.onSwitchToGenerate ?? (() => uiStore.setSubtitleAction('generate'))

  // Step 3: Execution
  const extractProgress = props.extractProgress ?? workflow?.extractProgress ?? 0
  const extractStatusMessage = props.extractStatusMessage ?? workflow?.extractStatusMessage ?? ''
  const lastOutputDir = props.lastOutputDir ?? workflow?.extractOutputDir ?? mediaStore.lastOutputDir
  const extractCleanTags = props.extractCleanTags ?? workflow?.extractCleanTags ?? true
  const setExtractCleanTags = props.setExtractCleanTags ?? workflow?.setExtractCleanTags ?? (() => {})
  const onStartExtract = props.onStartExtract ?? workflow?.handleStartExtract ?? (() => {})
  const onCancelExtract = props.onCancelExtract ?? workflow?.handleCancelExtract ?? (() => {})
  const onOpenFolder = props.onOpenFolder ?? mediaStore.openFolder
  const extractOutputDir = props.extractOutputDir ?? workflow?.extractOutputDir ?? null
  const onChangeExtractOutputDir = props.onChangeExtractOutputDir ?? workflow?.handleSelectOutputDir ?? (() => {})
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
        onSwitchToGenerate={handleSwitchToGenerate}
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
