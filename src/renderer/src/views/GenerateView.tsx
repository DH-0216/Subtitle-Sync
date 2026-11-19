import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Generate, GenerateConfig } from '../components/Step2Generate'
import { Step3Generate } from '../components/Step3Generate'
import { useMediaStore, useUIStore, useLogStore } from '../store'
import { useGenerateWorkflow, useVideoMedia } from '../hooks'

export interface GenerateViewProps {
  workflow?: ReturnType<typeof useGenerateWorkflow>
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

  // Step 2: Generation Config (optional overrides)
  onSelectTrack?: (idx: number) => void
  generateConfig?: GenerateConfig
  onChangeGenerateConfig?: (newCfg: Partial<GenerateConfig>) => void
  isOnline?: boolean
  whisperModels?: any[]
  isLoadingWhisperModels?: boolean
  onRefreshWhisperModels?: () => void
  whisperModelsSource?: 'remote' | 'cached' | 'fallback'
  isGenerating?: boolean
  onSwitchToTranslate?: () => void

  // Step 3: Execution (optional overrides)
  generateProgress?: number
  generateStatusMessage?: string
  lastOutputDir?: string | null
  onStartGenerate?: () => void
  onCancelGenerate?: () => void
  onOpenFolder?: (folder?: string) => void
}

export const GenerateView: React.FC<GenerateViewProps> = (props) => {
  const { workflow, video } = props
  const mediaStore = useMediaStore()
  const uiStore = useUIStore()
  const logStore = useLogStore()

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

  // Step 2: Generation Config
  const onSelectTrack =
    props.onSelectTrack ??
    ((idx: number) => {
      video?.setSelectedTrack(idx)
      logStore.addGenerateLog(`[AUDIO] Selected track #${idx} for subtitle generation`)
    })
  const generateConfig =
    props.generateConfig ??
    workflow?.generateConfig ?? {
      sourceType: 'video',
      sourceSubPath: null,
      language: 'original',
      modelQuality: 'base',
      format: 'srt'
    }
  const onChangeGenerateConfig =
    props.onChangeGenerateConfig ??
    ((newCfg: Partial<GenerateConfig>) => {
      workflow?.setGenerateConfig((prev) => ({ ...prev, ...newCfg }))
    })
  const isOnline = props.isOnline !== undefined ? props.isOnline : uiStore.isOnline
  const whisperModels = props.whisperModels ?? workflow?.whisperModels ?? []
  const isLoadingWhisperModels = props.isLoadingWhisperModels !== undefined ? props.isLoadingWhisperModels : (workflow?.isLoadingWhisperModels || false)
  const onRefreshWhisperModels = props.onRefreshWhisperModels ?? (() => workflow?.loadWhisperModels(true))
  const whisperModelsSource = props.whisperModelsSource ?? workflow?.whisperModelsSource ?? 'fallback'
  const isGenerating = props.isGenerating !== undefined ? props.isGenerating : (workflow?.isGenerating || false)
  const handleSwitchToTranslate =
    props.onSwitchToTranslate ?? (() => uiStore.setSubtitleAction('translate'))

  // Step 3: Execution
  const generateProgress = props.generateProgress !== undefined ? props.generateProgress : (workflow?.generateProgress || 0)
  const generateStatusMessage = props.generateStatusMessage !== undefined ? props.generateStatusMessage : (workflow?.generateStatusMessage || '')
  const lastOutputDir = props.lastOutputDir !== undefined ? props.lastOutputDir : mediaStore.lastOutputDir
  const onStartGenerate = props.onStartGenerate ?? (() => workflow?.handleStartGenerate())
  const onCancelGenerate = props.onCancelGenerate ?? workflow?.handleCancelGenerate ?? (() => {})
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

      <Step2Generate
        videoPath={videoPath}
        selectedTrack={selectedTrack}
        audioTracks={audioTracks}
        onSelectTrack={onSelectTrack}
        config={generateConfig}
        onChangeConfig={(newCfg) => onChangeGenerateConfig(newCfg)}
        isOnline={isOnline}
        availableModels={whisperModels}
        isLoadingModels={isLoadingWhisperModels}
        onRefreshModels={onRefreshWhisperModels}
        modelsSource={whisperModelsSource}
        isGenerating={isGenerating}
        subtitleTracks={subtitleTracks}
        onSwitchToTranslate={handleSwitchToTranslate}
      />

      <Step3Generate
        unlocked={Boolean(videoPath)}
        isGenerating={isGenerating}
        config={generateConfig}
        selectedTrack={selectedTrack}
        progress={generateProgress}
        statusMessage={generateStatusMessage}
        lastOutputDir={lastOutputDir}
        onStartGenerate={onStartGenerate}
        onCancelGenerate={onCancelGenerate}
        onOpenFolder={onOpenFolder}
      />
    </>
  )
}
