import React from 'react'
import { Step1Translate } from '../components/Step1Translate'
import { Step2Translate } from '../components/Step2Translate'
import { Step3Translate } from '../components/Step3Translate'
import { SubtitleTrack } from '../components/Step1Video'

export interface TranslateViewProps {
  // Step 1: Subtitle or Video
  translateSubPath: string | null
  onSelectTranslateSubtitle: (path: string) => void
  onBrowseTranslateSubtitle: () => void
  onRemoveTranslateSubtitle: () => void
  translateSubError: string | null
  onClearTranslateSubError: () => void
  videoPath: string | null
  subtitleTracks: SubtitleTrack[]
  onExtractAndTranslateSubtitle: (track: SubtitleTrack) => void | Promise<void>
  isExtracting: boolean
  onBrowseVideo: () => void
  onSelectVideo: (path: string) => void
  onRemoveVideo: () => void

  // Step 2: Language & Format
  translateLanguage: string
  onChangeLanguage: (lang: string) => void
  translateFormat: 'srt' | 'vtt' | 'txt'
  onChangeFormat: (fmt: 'srt' | 'vtt' | 'txt') => void
  aiApiKey: string
  aiProvider: string
  aiModel: string
  onOpenSettings: () => void
  isOnline: boolean

  // Step 3: Execution
  isTranslating: boolean
  translateProgress: number
  translateStatusMessage: string
  lastOutputDir: string | null
  onStartTranslateSubtitle: () => void
  onCancelTranslate: () => void
  onOpenFolder: (folder?: string) => void
}

export const TranslateView: React.FC<TranslateViewProps> = ({
  translateSubPath,
  onSelectTranslateSubtitle,
  onBrowseTranslateSubtitle,
  onRemoveTranslateSubtitle,
  translateSubError,
  onClearTranslateSubError,
  videoPath,
  subtitleTracks,
  onExtractAndTranslateSubtitle,
  isExtracting,
  onBrowseVideo,
  onSelectVideo,
  onRemoveVideo,
  translateLanguage,
  onChangeLanguage,
  translateFormat,
  onChangeFormat,
  aiApiKey,
  aiProvider,
  aiModel,
  onOpenSettings,
  isOnline,
  isTranslating,
  translateProgress,
  translateStatusMessage,
  lastOutputDir,
  onStartTranslateSubtitle,
  onCancelTranslate,
  onOpenFolder
}) => {
  return (
    <>
      <Step1Translate
        sourceSubPath={translateSubPath}
        onSelectSubtitle={onSelectTranslateSubtitle}
        onBrowseSubtitle={onBrowseTranslateSubtitle}
        onRemoveSubtitle={onRemoveTranslateSubtitle}
        errorMessage={translateSubError}
        onClearError={onClearTranslateSubError}
        videoPath={videoPath}
        subtitleTracks={subtitleTracks}
        onExtractAndUseSubtitle={onExtractAndTranslateSubtitle}
        isExtracting={isExtracting}
        onBrowseVideo={onBrowseVideo}
        onSelectVideo={onSelectVideo}
        onRemoveVideo={onRemoveVideo}
      />

      <Step2Translate
        language={translateLanguage}
        onChangeLanguage={onChangeLanguage}
        format={translateFormat}
        onChangeFormat={onChangeFormat}
        aiApiKey={aiApiKey}
        aiProvider={aiProvider}
        aiModel={aiModel}
        onOpenSettings={onOpenSettings}
        isOnline={isOnline}
      />

      <Step3Translate
        unlocked={Boolean(translateSubPath)}
        isTranslating={isTranslating}
        sourceSubPath={translateSubPath}
        language={translateLanguage}
        aiProvider={aiProvider}
        aiModel={aiModel}
        format={translateFormat}
        progress={translateProgress}
        statusMessage={translateStatusMessage}
        lastOutputDir={lastOutputDir}
        onStartTranslate={onStartTranslateSubtitle}
        onCancelTranslate={onCancelTranslate}
        onOpenFolder={onOpenFolder}
      />
    </>
  )
}
