import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  isSubtitleFile,
  getUnsupportedFileMessage,
  getFileName
} from '@shared/fileSanitizer'
import { formatUserFriendlyError } from '@shared/errorUtils'
import { AiProviderId } from '@shared/aiModels'
import { resolveEffectiveAiPrompt } from '@shared/translationPrompts'
import { GenerateConfig } from '../components/Step2Generate'
import { AudioTrack } from '../components/Step1Video'
import { useMediaStore, useLogStore, useSettingsStore, useUIStore, useWhisperStore } from '../store'

interface UseGenerateWorkflowOptions {
  videoPath?: string | null
  videoDetails?: any
  audioTracks?: AudioTrack[]
  selectedTrack?: number | null
  aiApiKey?: string
  aiProvider?: AiProviderId
  aiModel?: string
  aiPrompt?: string
  aiPromptsByLang?: Record<string, string>
  onOpenSettingsAiTab?: () => void
  addLog?: (msg: string) => void
  notifyJobComplete?: (title: string, body: string) => void
  onOutputReady?: (filePath: string, dirPath: string) => void
  onOutputClear?: () => void
}

export function useGenerateWorkflow(options: UseGenerateWorkflowOptions = {}) {
  const mediaStore = useMediaStore()
  const logStore = useLogStore()
  const settingsStore = useSettingsStore()
  const uiStore = useUIStore()
  const whisperStore = useWhisperStore()

  const videoPath = options.videoPath ?? mediaStore.videoPath
  const videoDetails = options.videoDetails ?? mediaStore.videoDetails
  const audioTracks = options.audioTracks ?? mediaStore.audioTracks
  const selectedTrack = options.selectedTrack ?? mediaStore.selectedTrack
  const aiApiKey = options.aiApiKey ?? settingsStore.aiApiKey
  const aiProvider = options.aiProvider ?? settingsStore.aiProvider
  const aiModel = options.aiModel ?? settingsStore.aiModel
  const aiPrompt = options.aiPrompt ?? settingsStore.aiPrompt
  const aiPromptsByLang = options.aiPromptsByLang ?? settingsStore.aiPromptsByLang
  const onOpenSettingsAiTab =
    options.onOpenSettingsAiTab ?? (() => uiStore.setSettingsModalOpen(true, 'ai'))
  const addLog = options.addLog ?? logStore.addGenerateLog
  const notifyJobComplete = options.notifyJobComplete ?? settingsStore.notifyJobComplete
  const onOutputReady = options.onOutputReady ?? mediaStore.setOutput
  const onOutputClear = options.onOutputClear ?? (() => mediaStore.setOutput(null, null))
  const [generateConfig, setGenerateConfig] = useState<GenerateConfig>({
    sourceType: 'video',
    sourceSubPath: null,
    language: 'original',
    modelQuality: 'base',
    format: 'srt'
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateStatusMessage, setGenerateStatusMessage] = useState('')
  const [generateSubError, setGenerateSubError] = useState<string | null>(null)

  // Whisper Models & Model Download State from Zustand Store
  const whisperModels = whisperStore.whisperModels
  const isLoadingWhisperModels = whisperStore.isLoadingWhisperModels
  const whisperModelsSource = whisperStore.whisperModelsSource
  const loadWhisperModels = whisperStore.loadWhisperModels
  const downloadModalOpen = whisperStore.downloadModalOpen
  const setDownloadModalOpen = whisperStore.setDownloadModalOpen
  const isDownloadingModel = whisperStore.isDownloadingModel
  const modelDownloadProgress = whisperStore.modelDownloadProgress
  const modelDownloadSpeed = whisperStore.modelDownloadSpeed
  const modelDownloadedBytes = whisperStore.modelDownloadedBytes
  const modelTotalBytes = whisperStore.modelTotalBytes
  const modelDownloadError = whisperStore.modelDownloadError

  const generateCancelledRef = useRef(false)
  const isGeneratingRef = useRef(false)

  const setIsGeneratingSync = useCallback((val: boolean) => {
    isGeneratingRef.current = val
    setIsGenerating(val)
  }, [])

  useEffect(() => {
    isGeneratingRef.current = isGenerating
  }, [isGenerating])

  const handleClearGenerateSubError = useCallback(() => {
    setGenerateSubError(null)
  }, [])

  const handleSelectGenerateSubtitle = useCallback(async (rawPath: string) => {
    setGenerateSubError(null)
    const clean = cleanPathString(rawPath)
    if (!clean) return

    if (!isSubtitleFile(clean)) {
      const msg = getUnsupportedFileMessage(clean, 'subtitle')
      setGenerateSubError(msg)
      toast.error(msg)
      addLog(`[FILE] ⚠️ Unsupported subtitle for translation: ${msg}`)
      return
    }

    setGenerateSubError(null)
    setGenerateConfig((prev) => ({
      ...prev,
      sourceType: 'subtitle',
      sourceSubPath: clean
    }))
    const fileName = getFileName(clean)
    toast.success(`Selected subtitle: ${fileName}`)
    addLog(`[SUBTITLE] Selected file for AI translation: ${clean}`)
  }, [addLog])

  const handleBrowseGenerateSubtitle = useCallback(async () => {
    try {
      const files = await window.api.dialog.openSubtitles()
      if (files && files.length > 0) {
        handleSelectGenerateSubtitle(files[0])
      }
    } catch (e: any) {
      toast.error('Failed to open subtitle: ' + e?.message)
    }
  }, [handleSelectGenerateSubtitle])

  const handleStartGenerate = useCallback(async (overrideConfig?: Partial<GenerateConfig>) => {
    const isEvent =
      overrideConfig &&
      typeof overrideConfig === 'object' &&
      ('nativeEvent' in overrideConfig || 'target' in overrideConfig || '_reactName' in overrideConfig)
    const validOverride = isEvent ? undefined : overrideConfig

    const effectiveConfig = {
      ...generateConfig,
      ...validOverride
    }
    const isSubtitleSource = effectiveConfig.sourceType === 'subtitle'

    if (isSubtitleSource) {
      if (!effectiveConfig.sourceSubPath) {
        toast.error('Please choose a subtitle file (.srt) to translate in Step 2!')
        return
      }
    } else {
      if (!videoPath) {
        toast.error('Please select a reference movie in Step 1 first!')
        return
      }
    }

    if (isSubtitleSource || ['si', 'ta', 'hi', 'es'].includes(effectiveConfig.language)) {
      if (!aiApiKey.trim()) {
        toast.error('Please enter your AI API Key in Settings to translate subtitles!', {
          duration: 5000,
          icon: '🔑'
        })
        onOpenSettingsAiTab()
        return
      }
    }

    if (!isSubtitleSource) {
      try {
        const modelCheck = await window.api.generator.checkModel(effectiveConfig.modelQuality)
        if (!modelCheck?.exists) {
          whisperStore.setActiveModelQuality(effectiveConfig.modelQuality)
          whisperStore.setDownloadModalOpen(true)
          return
        }
      } catch (e) {
        // ignore
      }

      try {
        const whisperCheck = await window.api.generator.checkWhisper()
        if (!whisperCheck?.exists) {
          toast.error('whisper.exe not found in bin/ folder. Please place whisper.exe into the bin/ directory.', {
            duration: 6000,
            icon: '⚠️'
          })
          addLog(
            '[ERROR] whisper.exe (or whisper-cli.exe) not found in bin/. Please place the whisper executable into the bin/ directory.'
          )
          return
        }
      } catch (e) {
        // ignore
      }
    }

    generateCancelledRef.current = false
    isGeneratingRef.current = true
    setIsGenerating(true)
    setGenerateProgress(5)
    setGenerateStatusMessage(isSubtitleSource ? 'Starting AI dialogue translation...' : 'Starting subtitle generation...')
    addLog(
      isSubtitleSource
        ? `=== Starting Subtitle Translation ===`
        : `=== Starting Subtitle Generation ===`
    )
    addLog(isSubtitleSource ? `Source Subtitle: ${effectiveConfig.sourceSubPath}` : `Movie: ${videoPath}`)
    addLog(!isSubtitleSource ? `Selected Audio Track: #${selectedTrack ?? 0}` : `Bypassing Whisper: Direct text translation mode`)
    addLog(`Target Language: ${effectiveConfig.language}`)
    addLog(!isSubtitleSource ? `Model Quality: ${effectiveConfig.modelQuality}` : `Model: Cloud AI (${aiModel || 'Auto'})`)
    addLog(`Output Format: .${effectiveConfig.format}`)

    const activeTrack = audioTracks.find((t) => t.index === selectedTrack)
    const trackLanguage = activeTrack?.language || ''

    try {
      const res = await window.api.generator.startGenerate({
        video: videoPath || '',
        trackIndex: selectedTrack,
        trackLanguage,
        durationSec: videoDetails?.durationSec,
        ...effectiveConfig,
        aiApiKey,
        aiProvider,
        aiModel,
        customPrompt: resolveEffectiveAiPrompt(effectiveConfig.language, aiPrompt, aiPromptsByLang),
        saveBridgeFile: settingsStore.saveBridgeFile
      })

      if (res?.success) {
        if (effectiveConfig.deleteSourceAfter) {
          setGenerateConfig((prev) => ({
            ...prev,
            sourceSubPath: null,
            deleteSourceAfter: false
          }))
        }
        setGenerateProgress(100)
        setGenerateStatusMessage(isSubtitleSource ? 'Subtitle translation complete!' : 'Subtitles generated successfully!')
        toast.success(isSubtitleSource ? 'Subtitle translated successfully!' : 'Subtitle generated successfully!', { duration: 4000 })
        notifyJobComplete(
          isSubtitleSource ? 'Subtitle Translation Complete' : 'Subtitle Generation Complete',
          isSubtitleSource
            ? 'Your translated Spoken Sinhala subtitle is ready!'
            : 'Your generated subtitle has been saved successfully!'
        )
        if (res.output && onOutputReady) {
          const folder = res.output.substring(
            0,
            Math.max(res.output.lastIndexOf('/'), res.output.lastIndexOf('\\'))
          )
          onOutputReady(res.output, folder)
        }
      } else {
        if (effectiveConfig.deleteSourceAfter) {
          setGenerateConfig((prev) => ({
            ...prev,
            sourceSubPath: null,
            deleteSourceAfter: false
          }))
        }
        setGenerateProgress(0)
        const isCancelled = res?.message?.toLowerCase().includes('cancel')
        const friendlyMsg = formatUserFriendlyError(res?.message || (isSubtitleSource ? 'Translation failed' : 'Generation failed'))
        setGenerateStatusMessage(isCancelled ? 'Cancelled by user' : friendlyMsg)
        if (!isCancelled) {
          toast.error(friendlyMsg, { duration: 5000 })
          addLog(`[ERROR] ${res?.message || 'Processing failed'}`)
        }
      }
    } catch (err: any) {
      if (effectiveConfig.deleteSourceAfter) {
        setGenerateConfig((prev) => ({
          ...prev,
          sourceSubPath: null,
          deleteSourceAfter: false
        }))
      }
      setGenerateProgress(0)
      const isCancelled = err.message?.toLowerCase().includes('cancel')
      if (isCancelled) {
        setGenerateStatusMessage('Cancelled by user')
      } else {
        const friendlyMsg = formatUserFriendlyError(err)
        addLog(`[ERROR] ${err.message}`)
        setGenerateStatusMessage(friendlyMsg)
        toast.error(friendlyMsg, { duration: 5000 })
      }
    } finally {
      isGeneratingRef.current = false
      setIsGenerating(false)
    }
  }, [addLog, aiApiKey, aiModel, aiPrompt, aiProvider, audioTracks, generateConfig, notifyJobComplete, onOpenSettingsAiTab, onOutputReady, selectedTrack, settingsStore.saveBridgeFile, videoDetails?.durationSec, videoPath])

  const handleCancelGenerate = useCallback(async () => {
    generateCancelledRef.current = true
    isGeneratingRef.current = false
    try {
      await window.api.generator.cancelGenerate('generate')
    } catch {}
    setIsGenerating(false)
    setGenerateProgress(0)
    setGenerateStatusMessage('Cancelled by user')
    if (onOutputClear) onOutputClear()
    toast('Subtitle generation cancelled', { icon: '⏹️', duration: 2500 })
    addLog('[USER] Subtitle generation cancelled.')
  }, [addLog, onOutputClear])

  const handleStartDownloadModel = useCallback(async () => {
    await whisperStore.handleStartDownloadModel(generateConfig.modelQuality, handleStartGenerate)
  }, [generateConfig.modelQuality, handleStartGenerate, whisperStore])

  const handleCancelDownloadModel = useCallback(async () => {
    await whisperStore.handleCancelDownloadModel()
  }, [whisperStore])

  return {
    generateConfig,
    setGenerateConfig,
    isGenerating,
    setIsGenerating: setIsGeneratingSync,
    setIsGeneratingSync,
    generateProgress,
    setGenerateProgress,
    generateStatusMessage,
    setGenerateStatusMessage,
    generateSubError,
    setGenerateSubError,
    whisperModels,
    isLoadingWhisperModels,
    whisperModelsSource,
    loadWhisperModels,
    downloadModalOpen,
    setDownloadModalOpen,
    isDownloadingModel,
    modelDownloadProgress,
    modelDownloadSpeed,
    modelDownloadedBytes,
    modelTotalBytes,
    modelDownloadError,
    generateCancelledRef,
    isGeneratingRef,
    handleClearGenerateSubError,
    handleSelectGenerateSubtitle,
    handleBrowseGenerateSubtitle,
    handleStartGenerate,
    handleCancelGenerate,
    handleStartDownloadModel,
    handleCancelDownloadModel
  }
}
