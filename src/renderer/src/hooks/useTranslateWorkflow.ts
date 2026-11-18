import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  getFileExtension,
  getFileName
} from '@shared/fileSanitizer'
import { AiProviderId } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT, resolveEffectiveAiPrompt } from '@shared/translationPrompts'
import { SubtitleTrack } from '../components/Step1Video'

interface UseTranslateWorkflowOptions {
  videoPath: string | null
  isOnline: boolean
  aiApiKey: string
  aiProvider: AiProviderId
  aiModel: string
  aiPrompt: string
  aiPromptsByLang?: Record<string, string>
  extractCleanTags: boolean
  onOpenSettingsAiTab: () => void
  onRemoveVideo: () => void
  setIsGenerating: (g: boolean) => void
  setGenerateProgress: (p: number) => void
  setGenerateStatusMessage: (msg: string) => void
  setIsExtracting: (e: boolean) => void
  setExtractStatusMessage: (msg: string) => void
  addLog: (msg: string) => void
  notifyJobComplete: (title: string, body: string) => void
  onOutputReady?: (filePath: string, dirPath: string) => void
}

export function useTranslateWorkflow({
  videoPath,
  isOnline,
  aiApiKey,
  aiProvider,
  aiModel,
  aiPrompt,
  aiPromptsByLang,
  extractCleanTags,
  onOpenSettingsAiTab,
  onRemoveVideo,
  setIsGenerating,
  setGenerateProgress,
  setGenerateStatusMessage,
  setIsExtracting,
  setExtractStatusMessage,
  addLog,
  notifyJobComplete,
  onOutputReady
}: UseTranslateWorkflowOptions) {
  const [translateSubPath, setTranslateSubPath] = useState<string | null>(null)
  const [translateLanguage, setTranslateLanguage] = useState('si')
  const [translateFormat, setTranslateFormat] = useState<'srt' | 'vtt' | 'txt'>('srt')
  const [translateSubError, setTranslateSubError] = useState<string | null>(null)

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

    setIsGenerating(true)
    setGenerateProgress(5)
    setGenerateStatusMessage('Starting AI subtitle translation...')

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
        language: translateLanguage,
        format: translateFormat,
        aiApiKey,
        aiProvider,
        aiModel,
        customPrompt: resolveEffectiveAiPrompt(translateLanguage, aiPrompt, aiPromptsByLang)
      })

      if (res?.success) {
        setGenerateProgress(100)
        setGenerateStatusMessage('AI subtitle translation complete!')
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
        setGenerateProgress(0)
        const errMsg = res?.message || (res as any)?.error || 'Translation failed.'
        setGenerateStatusMessage(errMsg)
        toast.error(`Translation failed: ${errMsg}`)
      }
    } catch (err: any) {
      setGenerateProgress(0)
      setGenerateStatusMessage('Translation error occurred.')
      toast.error(`Error: ${err?.message || err}`)
    } finally {
      setIsGenerating(false)
    }
  }, [addLog, aiApiKey, aiModel, aiPrompt, aiProvider, isOnline, notifyJobComplete, onOpenSettingsAiTab, onOutputReady, setGenerateProgress, setGenerateStatusMessage, setIsGenerating, translateFormat, translateLanguage, translateSubPath, videoPath])

  return {
    translateSubPath,
    setTranslateSubPath,
    translateLanguage,
    setTranslateLanguage,
    translateFormat,
    setTranslateFormat,
    translateSubError,
    setTranslateSubError,
    handleSelectTranslateSubtitle,
    handleBrowseTranslateSubtitle,
    handleExtractAndTranslateSubtitle,
    handleStartTranslate
  }
}
