import React from 'react'
import { Step1Video, AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { Step2Generate, GenerateConfig } from '../components/Step2Generate'
import { Step3Generate } from '../components/Step3Generate'

export interface GenerateViewProps {
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

  // Step 2: Generation Config
  onSelectTrack: (idx: number) => void
  generateConfig: GenerateConfig
  onChangeGenerateConfig: (newCfg: Partial<GenerateConfig>) => void
  isOnline: boolean
  whisperModels: any[]
  isLoadingWhisperModels: boolean
  onRefreshWhisperModels: () => void
  whisperModelsSource: 'remote' | 'cached' | 'fallback'
  isGenerating: boolean
  onSwitchToTranslate: () => void

  // Step 3: Execution
  generateProgress: number
  generateStatusMessage: string
  lastOutputDir: string | null
  onStartGenerate: () => void
  onCancelGenerate: () => void
  onOpenFolder: (folder?: string) => void
}

export const GenerateView: React.FC<GenerateViewProps> = ({
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
  onSelectTrack,
  generateConfig,
  onChangeGenerateConfig,
  isOnline,
  whisperModels,
  isLoadingWhisperModels,
  onRefreshWhisperModels,
  whisperModelsSource,
  isGenerating,
  onSwitchToTranslate,
  generateProgress,
  generateStatusMessage,
  lastOutputDir,
  onStartGenerate,
  onCancelGenerate,
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
        onSwitchToTranslate={onSwitchToTranslate}
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
