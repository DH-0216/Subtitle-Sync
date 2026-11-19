import React from 'react'
import { Step1Translate } from '../components/Step1Translate'
import { Step2Translate } from '../components/Step2Translate'
import { Step3Translate } from '../components/Step3Translate'
import { SubtitleTrack } from '../components/Step1Video'
import { useMediaStore, useSettingsStore, useUIStore } from '../store'
import { useTranslateWorkflow, useVideoMedia, useExtractWorkflow } from '../hooks'

export interface TranslateViewProps {
  workflow?: ReturnType<typeof useTranslateWorkflow>
  video?: ReturnType<typeof useVideoMedia>
  extract?: ReturnType<typeof useExtractWorkflow>

  // Step 1: Subtitle or Video (optional overrides)
  translateSubPath?: string | null
  onSelectTranslateSubtitle?: (path: string) => void
  onBrowseTranslateSubtitle?: () => void
  onRemoveTranslateSubtitle?: () => void
  translateSubError?: string | null
  onClearTranslateSubError?: () => void
  videoPath?: string | null
  subtitleTracks?: SubtitleTrack[]
  onExtractAndTranslateSubtitle?: (track: SubtitleTrack) => void | Promise<void>
  isExtracting?: boolean
  onBrowseVideo?: () => void
  onSelectVideo?: (path: string) => void
  onRemoveVideo?: () => void

  // Step 2: Language & Format (optional overrides)
  translateLanguage?: string
  onChangeLanguage?: (lang: string) => void
  translateFormat?: 'srt' | 'vtt' | 'txt'
  onChangeFormat?: (fmt: 'srt' | 'vtt' | 'txt') => void
  aiApiKey?: string
  aiProvider?: string
  aiModel?: string
  onOpenSettings?: () => void
  isOnline?: boolean

  // Step 3: Execution (optional overrides)
  isTranslating?: boolean
  translateProgress?: number
  translateStatusMessage?: string
  lastOutputDir?: string | null
  onStartTranslateSubtitle?: () => void
  onCancelTranslate?: () => void
  onOpenFolder?: (folder?: string) => void
}

export const TranslateView: React.FC<TranslateViewProps> = (props) => {
  const { workflow, video, extract } = props
  const mediaStore = useMediaStore()
  const settingsStore = useSettingsStore()
  const uiStore = useUIStore()

  // Step 1: Subtitle or Video
  const translateSubPath = props.translateSubPath !== undefined ? props.translateSubPath : workflow?.translateSubPath || null
  const onSelectTranslateSubtitle = props.onSelectTranslateSubtitle ?? workflow?.handleSelectTranslateSubtitle ?? (() => {})
  const onBrowseTranslateSubtitle = props.onBrowseTranslateSubtitle ?? workflow?.handleBrowseTranslateSubtitle ?? (() => {})
  const onRemoveTranslateSubtitle =
    props.onRemoveTranslateSubtitle ??
    (() => {
      workflow?.setTranslateSubPath(null)
      workflow?.setTranslateSubError(null)
    })
  const translateSubError = props.translateSubError !== undefined ? props.translateSubError : workflow?.translateSubError || null
  const onClearTranslateSubError = props.onClearTranslateSubError ?? (() => workflow?.setTranslateSubError(null))
  const videoPath = props.videoPath !== undefined ? props.videoPath : (video?.videoPath || mediaStore.videoPath)
  const subtitleTracks = props.subtitleTracks !== undefined ? props.subtitleTracks : (video?.subtitleTracks || mediaStore.subtitleTracks || [])
  const onExtractAndTranslateSubtitle = props.onExtractAndTranslateSubtitle ?? workflow?.handleExtractAndTranslateSubtitle ?? (() => {})
  const isExtracting = props.isExtracting !== undefined ? props.isExtracting : (extract?.isExtracting || false)
  const onBrowseVideo =
    props.onBrowseVideo ??
    (async () => {
      video?.handleClearVideoError()
      const file = await window.api.dialog.openVideo()
      if (file) {
        workflow?.setTranslateSubPath(null)
        workflow?.setTranslateSubError(null)
        video?.handleSelectVideo(file)
      }
    })
  const onSelectVideo =
    props.onSelectVideo ??
    ((path: string) => {
      workflow?.setTranslateSubPath(null)
      workflow?.setTranslateSubError(null)
      video?.handleSelectVideo(path)
    })
  const onRemoveVideo = props.onRemoveVideo ?? video?.handleRemoveVideo ?? mediaStore.clearMedia

  // Step 2: Language & Format
  const translateLanguage = props.translateLanguage ?? workflow?.translateLanguage ?? 'si'
  const onChangeLanguage = props.onChangeLanguage ?? workflow?.setTranslateLanguage ?? (() => {})
  const translateFormat = props.translateFormat ?? workflow?.translateFormat ?? settingsStore.defaultSubtitleFormat
  const onChangeFormat = props.onChangeFormat ?? workflow?.setTranslateFormat ?? (() => {})
  const aiApiKey = props.aiApiKey ?? settingsStore.aiApiKey
  const aiProvider = props.aiProvider ?? settingsStore.aiProvider
  const aiModel = props.aiModel ?? settingsStore.aiModel
  const isOnline = props.isOnline !== undefined ? props.isOnline : uiStore.isOnline
  const handleOpenSettings = props.onOpenSettings ?? (() => uiStore.setSettingsModalOpen(true, 'ai'))

  // Step 3: Execution
  const isTranslating = props.isTranslating !== undefined ? props.isTranslating : (workflow?.isTranslating || false)
  const translateProgress = props.translateProgress !== undefined ? props.translateProgress : (workflow?.translateProgress || 0)
  const translateStatusMessage = props.translateStatusMessage !== undefined ? props.translateStatusMessage : (workflow?.translateStatusMessage || '')
  const lastOutputDir = props.lastOutputDir !== undefined ? props.lastOutputDir : mediaStore.lastOutputDir
  const onStartTranslateSubtitle = props.onStartTranslateSubtitle ?? workflow?.handleStartTranslate ?? (() => {})
  const onCancelTranslate = props.onCancelTranslate ?? workflow?.handleCancelTranslate ?? (() => {})
  const onOpenFolder = props.onOpenFolder ?? mediaStore.openFolder
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
        onOpenSettings={handleOpenSettings}
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
