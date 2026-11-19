import { useState, useRef, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  getFileExtension,
  getFileName
} from '@shared/fileSanitizer'
import { AiProviderId } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT, resolveEffectiveAiPrompt } from '@shared/translationPrompts'
import { SubtitleTrack } from '../components/Step1Video'
import { useMediaStore, useLogStore, useSettingsStore, useUIStore } from '../store'

interface UseTranslateWorkflowOptions {
  videoPath?: string | null
  isOnline?: boolean
  aiApiKey?: string
  aiProvider?: AiProviderId
  aiModel?: string
  aiPrompt?: string
  aiPromptsByLang?: Record<string, string>
  extractCleanTags?: boolean
  onOpenSettingsAiTab?: () => void
  onRemoveVideo?: () => void
  setIsExtracting?: (e: boolean) => void
  setExtractStatusMessage?: (msg: string) => void
  addLog?: (msg: string) => void
  notifyJobComplete?: (title: string, body: string) => void
  onOutputReady?: (filePath: string, dirPath: string) => void
}

export function useTranslateWorkflow(options: UseTranslateWorkflowOptions = {}) {
  const mediaStore = useMediaStore()
  const logStore = useLogStore()
  const settingsStore = useSettingsStore()
  const uiStore = useUIStore()

  const videoPath = options.videoPath ?? mediaStore.videoPath
  const isOnline = options.isOnline ?? uiStore.isOnline
  const aiApiKey = options.aiApiKey ?? settingsStore.aiApiKey
  const aiProvider = options.aiProvider ?? settingsStore.aiProvider
  const aiModel = options.aiModel ?? settingsStore.aiModel
  const aiPrompt = options.aiPrompt ?? settingsStore.aiPrompt
  const aiPromptsByLang = options.aiPromptsByLang ?? settingsStore.aiPromptsByLang
  const extractCleanTags = options.extractCleanTags ?? true
  const onOpenSettingsAiTab =
    options.onOpenSettingsAiTab ?? (() => uiStore.setSettingsModalOpen(true, 'ai'))
  const onRemoveVideo = options.onRemoveVideo ?? mediaStore.clearMedia
  const setIsExtracting = options.setIsExtracting
  const setExtractStatusMessage = options.setExtractStatusMessage
  const addLog = options.addLog ?? logStore.addTranslateLog
  const notifyJobComplete = options.notifyJobComplete ?? settingsStore.notifyJobComplete
  const onOutputReady = options.onOutputReady ?? mediaStore.setOutput
  const [translateSubPath, setTranslateSubPath] = useState<string | null>(null)
  const [isTempExtraction, setIsTempExtraction] = useState(false)
  const [translateLanguage, setTranslateLanguage] = useState('si')
  const [translateFormat, setTranslateFormat] = useState<'srt' | 'vtt' | 'txt'>('srt')
  const [translateSubError, setTranslateSubError] = useState<string | null>(null)

  const [isTranslating, setIsTranslating] = useState(false)
  const [translateProgress, setTranslateProgress] = useState(0)
  const [translateStatusMessage, setTranslateStatusMessage] = useState('')

  const isTranslatingRef = useRef(false)
  const translateCancelledRef = useRef(false)

  const setIsTranslatingSync = useCallback((val: boolean) => {
    isTranslatingRef.current = val
    setIsTranslating(val)
  }, [])

  useEffect(() => {
    isTranslatingRef.current = isTranslating
  }, [isTranslating])

  const handleSelectTranslateSubtitle = useCallback((path: string) => {
    const clean = cleanPathString(path)
    const ext = getFileExtension(clean)
    if (!['srt', 'vtt', 'ass', 'sub'].includes(ext)) {
      const msg = `Unsupported file format ".${ext}". Please provide a subtitle file (.srt, .vtt, .ass).`
      setTranslateSubError(msg)
      toast.error(msg)
      return
    }
    setTranslateSubError(null)
    setTranslateSubPath(clean)
    setIsTempExtraction(false)
    if (videoPath) {
      onRemoveVideo()
    }
    toast.success(`Selected subtitle: ${getFileName(clean)}`)
    addLog(`[TRANSLATE] Selected subtitle file: ${clean}`)
  }, [addLog, onRemoveVideo, videoPath])

  const handleBrowseTranslateSubtitle = useCallback(async () => {
    try {
      const files = await window.api.dialog.openSubtitles()
      if (files && files.length > 0) {
        handleSelectTranslateSubtitle(files[0])
      }
    } catch (e: any) {
      toast.error('Failed to open subtitle: ' + e?.message)
    }
  }, [handleSelectTranslateSubtitle])

  const handleExtractAndTranslateSubtitle = useCallback(async (track: SubtitleTrack) => {
    if (!videoPath) return

    if (!aiApiKey.trim()) {
      toast.error('Please enter your AI API Key in Settings to translate subtitles!', {
        duration: 5000,
        icon: '🔑'
      })
      onOpenSettingsAiTab()
      return
    }

    if (!isOnline) {
      toast.error('Internet connection required for AI translation.', { icon: '📡' })
      return
    }

    setIsExtracting(true)
    setExtractStatusMessage(`Extracting Track #${track.index + 1} (${track.language.toUpperCase()})...`)
    addLog(
      `[EXTRACT] Extracting embedded subtitle track #${track.index + 1} (${track.language.toUpperCase()}) temporarily for AI translation from ${videoPath}`
    )

    try {
      const res = await window.api.extractor.extractSingle({
        videoPath,
        track,
        isTemporary: true,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        setTranslateSubPath(res.outputPath)
        setIsTempExtraction(true)
        setTranslateLanguage('si')
        toast.success(`Track #${track.index + 1} selected! Ready for translation.`, { duration: 3500, icon: '✨' })
        addLog(`[AI TRANSLATION] Subtitle extracted to temporary file: ${res.outputPath}`)
      } else {
        toast.error(res.error || 'Failed to extract embedded subtitle track')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract embedded subtitle track')
    } finally {
      setIsExtracting(false)
    }
  }, [addLog, aiApiKey, extractCleanTags, isOnline, onOpenSettingsAiTab, setIsExtracting, setExtractStatusMessage, videoPath])

  const handleStartTranslate = useCallback(async () => {
    if (!translateSubPath) {
      toast.error('Please choose a subtitle file to translate in Step 1!')
      return
    }

    if (!isOnline) {
      toast.error('Internet connection required for AI translation.', { duration: 5000, icon: '📡' })
      return
    }

    if (!aiApiKey.trim()) {
      toast.error('Please enter your AI API Key in Settings to translate subtitles!', {
        duration: 5000,
        icon: '🔑'
      })
      onOpenSettingsAiTab()
      return
    }

    translateCancelledRef.current = false
    setIsTranslatingSync(true)
    setTranslateProgress(5)
    setTranslateStatusMessage('Starting AI subtitle translation...')

    addLog(`=== Starting AI Subtitle Translation ===`)
    addLog(`Source Subtitle: ${translateSubPath}`)
    addLog(`Target Language: ${translateLanguage.toUpperCase()}`)
    addLog(`AI Provider: ${aiProvider.toUpperCase()} (${aiModel || 'default'})`)

    try {
      const res = await window.api.generator.startGenerate({
        video: videoPath || '',
        trackIndex: 0,
        sourceType: 'subtitle',
        sourceSubPath: translateSubPath,
        deleteSourceAfter: isTempExtraction,
        language: translateLanguage,
        format: translateFormat,
        aiApiKey,
        aiProvider,
        aiModel,
        customPrompt: resolveEffectiveAiPrompt(translateLanguage, aiPrompt, aiPromptsByLang),
        saveBridgeFile: settingsStore.saveBridgeFile
      })

      if (res?.success) {
        if (isTempExtraction) {
          setTranslateSubPath(res.bridgeOutput || null)
          setIsTempExtraction(false)
        }
        setTranslateProgress(100)
        setTranslateStatusMessage('AI subtitle translation complete!')
        toast.success('Subtitle translated successfully!', { duration: 4000 })
        notifyJobComplete(
          'Subtitle Translation Complete',
          'Your translated subtitle is ready!'
        )
        if (res.output && onOutputReady) {
          const folder = res.output.substring(
            0,
            Math.max(res.output.lastIndexOf('/'), res.output.lastIndexOf('\\'))
          )
          onOutputReady(res.output, folder)
        }
      } else {
        setTranslateProgress(0)
        const isCancelled = res?.message?.toLowerCase().includes('cancel')
        const errMsg = res?.message || (res as any)?.error || 'Translation failed.'
        setTranslateStatusMessage(isCancelled ? 'Cancelled by user' : errMsg)
        if (!isCancelled) {
          toast.error(`Translation failed: ${errMsg}`)
        }
      }
    } catch (err: any) {
      setTranslateProgress(0)
      const isCancelled = err.message?.toLowerCase().includes('cancel')
      if (isCancelled) {
        setTranslateStatusMessage('Cancelled by user')
      } else {
        setTranslateStatusMessage('Translation error occurred.')
        toast.error(`Error: ${err?.message || err}`)
      }
    } finally {
      setIsTranslatingSync(false)
    }
  }, [addLog, aiApiKey, aiModel, aiPrompt, aiProvider, isOnline, isTempExtraction, notifyJobComplete, onOpenSettingsAiTab, onOutputReady, setIsTranslatingSync, settingsStore.saveBridgeFile, translateFormat, translateLanguage, translateSubPath, videoPath])

  const handleCancelTranslate = useCallback(async () => {
    translateCancelledRef.current = true
    isTranslatingRef.current = false
    try {
      await window.api.generator.cancelGenerate('translate')
    } catch {}
    setIsTranslating(false)
    setTranslateProgress(0)
    setTranslateStatusMessage('Cancelled by user')
    toast('Subtitle translation cancelled', { icon: '⏹️', duration: 2500 })
    addLog('[USER] Subtitle translation cancelled.')
  }, [addLog])

  return {
    translateSubPath,
    setTranslateSubPath,
    translateLanguage,
    setTranslateLanguage,
    translateFormat,
    setTranslateFormat,
    translateSubError,
    setTranslateSubError,
    isTranslating,
    setIsTranslating: setIsTranslatingSync,
    translateProgress,
    setTranslateProgress,
    translateStatusMessage,
    setTranslateStatusMessage,
    isTranslatingRef,
    translateCancelledRef,
    handleSelectTranslateSubtitle,
    handleBrowseTranslateSubtitle,
    handleExtractAndTranslateSubtitle,
    handleStartTranslate,
    handleCancelTranslate
  }
}
