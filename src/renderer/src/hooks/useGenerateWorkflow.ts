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

interface UseGenerateWorkflowOptions {
  videoPath: string | null
  videoDetails: any
  audioTracks: AudioTrack[]
  selectedTrack: number | null
  aiApiKey: string
  aiProvider: AiProviderId
  aiModel: string
  aiPrompt: string
  aiPromptsByLang?: Record<string, string>
  onOpenSettingsAiTab: () => void
  addLog: (msg: string) => void
  notifyJobComplete: (title: string, body: string) => void
  onOutputReady?: (filePath: string, dirPath: string) => void
  onOutputClear?: () => void
}

export function useGenerateWorkflow({
  videoPath,
  videoDetails,
  audioTracks,
  selectedTrack,
  aiApiKey,
  aiProvider,
  aiModel,
  aiPrompt,
  aiPromptsByLang,
  onOpenSettingsAiTab,
  addLog,
  notifyJobComplete,
  onOutputReady,
  onOutputClear
}: UseGenerateWorkflowOptions) {
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

  // Whisper Models State
  const [whisperModels, setWhisperModels] = useState<any[]>([])
  const [isLoadingWhisperModels, setIsLoadingWhisperModels] = useState(false)
  const [whisperModelsSource, setWhisperModelsSource] = useState<'remote' | 'cached' | 'fallback'>('fallback')

  // Model Download Modal State
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [isDownloadingModel, setIsDownloadingModel] = useState(false)
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0)
  const [modelDownloadSpeed, setModelDownloadSpeed] = useState('')
  const [modelDownloadedBytes, setModelDownloadedBytes] = useState(0)
  const [modelTotalBytes, setModelTotalBytes] = useState(0)
  const [modelDownloadError, setModelDownloadError] = useState<string | null>(null)

  const generateCancelledRef = useRef(false)
  const isGeneratingRef = useRef(false)

  const setIsGeneratingSync = useCallback((val: boolean) => {
    isGeneratingRef.current = val
    setIsGenerating(val)
  }, [])

  useEffect(() => {
    isGeneratingRef.current = isGenerating
  }, [isGenerating])

  const loadWhisperModels = useCallback(async (forceRefresh = false) => {
    if (!window.api?.generator?.getAvailableModels) return
    setIsLoadingWhisperModels(true)
    try {
      const res = await window.api.generator.getAvailableModels(forceRefresh)
      if (res?.models && res.models.length > 0) {
        setWhisperModels(res.models)
        setWhisperModelsSource(res.source || 'fallback')
        if (forceRefresh) {
          if (res.source === 'remote') {
            toast.success(`Loaded ${res.models.length} live models from Hugging Face!`, { icon: '🤗' })
          } else {
            toast('Using local/cached models catalog', { icon: '📂' })
          }
        }
      }
    } catch (e: any) {
      if (forceRefresh) {
        toast.error('Failed to fetch models from Hugging Face: ' + (e?.message || 'Network error'))
      }
    } finally {
      setIsLoadingWhisperModels(false)
    }
  }, [])

  // Listen to model download progress
  useEffect(() => {
    if (!window.api?.generator?.onDownloadProgress) return
    const unsub = window.api.generator.onDownloadProgress((data: any) => {
      setModelDownloadProgress(data.percent || 0)
      setModelDownloadedBytes(data.downloaded || 0)
      setModelTotalBytes(data.total || 0)
      if (data.speed) {
        setModelDownloadSpeed(data.speed)
      }
    })
    return () => unsub()
  }, [])

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
          setDownloadModalOpen(true)
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
        customPrompt: resolveEffectiveAiPrompt(effectiveConfig.language, aiPrompt, aiPromptsByLang)
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
  }, [addLog, aiApiKey, aiModel, aiPrompt, aiProvider, audioTracks, generateConfig, notifyJobComplete, onOpenSettingsAiTab, onOutputReady, selectedTrack, videoDetails?.durationSec, videoPath])

  const handleCancelGenerate = useCallback(async () => {
    generateCancelledRef.current = true
    isGeneratingRef.current = false
    try {
      await window.api.generator.cancelGenerate()
    } catch {}
    setIsGenerating(false)
    setGenerateProgress(0)
    setGenerateStatusMessage('Cancelled by user')
    if (onOutputClear) onOutputClear()
    toast('Subtitle generation cancelled', { icon: '⏹️', duration: 2500 })
    addLog('[USER] Subtitle generation cancelled.')
  }, [addLog, onOutputClear])

  const handleStartDownloadModel = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('No internet connection. Please connect to the internet to download this Whisper model.', {
        duration: 5500,
        icon: '📡'
      })
      setModelDownloadError('No internet connection detected. An active internet connection is required to download models.')
      return
    }

    if (!window.api?.generator?.downloadModel) {
      toast.error('Please restart the application to load backend!')
      return
    }

    setIsDownloadingModel(true)
    setModelDownloadError(null)
    setModelDownloadProgress(0)

    try {
      const res = await window.api.generator.downloadModel(generateConfig.modelQuality)
      setIsDownloadingModel(false)
      if (res?.success) {
        toast.success(`Whisper model (${generateConfig.modelQuality}) ready!`)
        notifyJobComplete(
          'Whisper Model Ready',
          `Whisper ${generateConfig.modelQuality.toUpperCase()} model downloaded and ready!`
        )
        setDownloadModalOpen(false)
        loadWhisperModels(false)
        handleStartGenerate()
      } else {
        const friendly = formatUserFriendlyError(res?.error || 'Failed to download model.')
        setModelDownloadError(friendly)
        toast.error(friendly)
      }
    } catch (err: any) {
      setIsDownloadingModel(false)
      const friendly = formatUserFriendlyError(err)
      setModelDownloadError(friendly)
      toast.error(friendly)
    }
  }, [generateConfig.modelQuality, handleStartGenerate, loadWhisperModels, notifyJobComplete])

  const handleCancelDownloadModel = useCallback(async () => {
    if (window.api?.generator?.cancelDownload) {
      await window.api.generator.cancelDownload()
    }
    setIsDownloadingModel(false)
    setModelDownloadProgress(0)
    toast('Model download cancelled')
  }, [])

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
