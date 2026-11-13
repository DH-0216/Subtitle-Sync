import React, { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { Header } from './components/Header'
import { Step1Video, SubtitleTrack } from './components/Step1Video'
import { SubtitleModeSelector, SubtitleAction } from './components/SubtitleModeSelector'
import { Step2Subtitles, SubtitleItem } from './components/Step2Subtitles'
import { Step2Generate, GenerateConfig } from './components/Step2Generate'
import { Step2Extract } from './components/Step2Extract'
import { Step3Sync, SyncMode } from './components/Step3Sync'
import { Step3Generate } from './components/Step3Generate'
import { Step3Extract, ExtractedFileItem } from './components/Step3Extract'
import { ActivityConsole } from './components/ActivityConsole'
import { AudioTrackModal } from './components/AudioTrackModal'
import { SettingsModal, DEFAULT_AI_PROMPT } from './components/SettingsModal'
import { AboutModal } from './components/AboutModal'
import { ModelDownloadModal } from './components/ModelDownloadModal'
import { EXTERNAL_LINKS } from '@shared/links'
import { formatUserFriendlyError } from '@shared/errorUtils'

export default function App() {
  // Theme & Preferences
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [defaultMode, setDefaultMode] = useState<SyncMode>('Standard')
  const [checkUpdates, setCheckUpdates] = useState(true)
  const [engineReady, setEngineReady] = useState(false)
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini')
  const [aiModel, setAiModel] = useState('auto')
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT)

  // Modals
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'ai'>('general')
  const [aboutModalOpen, setAboutModalOpen] = useState(false)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [isDownloadingModel, setIsDownloadingModel] = useState(false)
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0)
  const [modelDownloadSpeed, setModelDownloadSpeed] = useState('')
  const [modelDownloadedBytes, setModelDownloadedBytes] = useState(0)
  const [modelTotalBytes, setModelTotalBytes] = useState(0)
  const [modelDownloadError, setModelDownloadError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Track online/offline network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.success('Internet connection restored!', { duration: 3500, icon: '🌐' })
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast('You are now in Offline Mode. Subtitle sync and movie transcription run 100% locally!', {
        duration: 5500,
        icon: '📡'
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const isAnyModalOpen =
    audioModalOpen ||
    settingsModalOpen ||
    aboutModalOpen ||
    downloadModalOpen

  // Lock behind-window scroll whenever any modal (settings, audio track, about) is open
  useEffect(() => {
    if (isAnyModalOpen) {
      const originalBodyOverflow = document.body.style.overflow
      const originalHtmlOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'

      return () => {
        document.body.style.overflow = originalBodyOverflow
        document.documentElement.style.overflow = originalHtmlOverflow
      }
    }
  }, [isAnyModalOpen])

  // Step 1: Video
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoDetails, setVideoDetails] = useState<any>(null)
  const [audioTracks, setAudioTracks] = useState<any[]>([])
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null)

  // Subtitle Workflow Mode (Sync Existing vs Generate)
  const [subtitleAction, setSubtitleAction] = useState<SubtitleAction>('sync')

  // Step 2 (Generate Mode): Generation Settings
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
  const [whisperModels, setWhisperModels] = useState<any[]>([])
  const [isLoadingWhisperModels, setIsLoadingWhisperModels] = useState(false)
  const [whisperModelsSource, setWhisperModelsSource] = useState<'remote' | 'cached' | 'fallback'>('fallback')

  const loadWhisperModels = React.useCallback(async (forceRefresh = false) => {
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

  // Step 2 (Extract Mode): Encoded Subtitles State
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [selectedExtractTrackIndices, setSelectedExtractTrackIndices] = useState<number[]>([])
  const [extractOutputDir, setExtractOutputDir] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [extractStatusMessage, setExtractStatusMessage] = useState('')
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFileItem[]>([])
  const [extractCleanTags, setExtractCleanTags] = useState(true)

  // Step 2 (Sync Mode): Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const subtitlesRef = React.useRef<SubtitleItem[]>([])
  const currentSubIndexRef = React.useRef(0)
  const syncCancelledRef = React.useRef(false)
  const isGeneratingRef = React.useRef(false)
  const isSyncingRef = React.useRef(false)

  useEffect(() => {
    subtitlesRef.current = subtitles
  }, [subtitles])

  // Step 3: Sync
  const [syncMode, setSyncMode] = useState<SyncMode>('Standard')
  const [recommendedMode, setRecommendedMode] = useState<string | null>(null)
  const [recommendedReason, setRecommendedReason] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<any>(null)
  const [userSelectedMode, setUserSelectedMode] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [lastOutputDir, setLastOutputDir] = useState<string | null>(null)
  const [lastOutputFile, setLastOutputFile] = useState<string | null>(null)

  useEffect(() => {
    isGeneratingRef.current = isGenerating
  }, [isGenerating])

  useEffect(() => {
    isSyncingRef.current = isSyncing
  }, [isSyncing])

  // Console Logs
  const [logs, setLogs] = useState<string[]>([])

  // Sync theme with HTML class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const handleSetTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    window.api?.settings?.save({
      theme: newTheme,
      defaultMode,
      checkUpdates
    })
  }

  // Load Settings & Check Engine Binaries on Mount
  useEffect(() => {
    window.api?.settings?.load().then((s: any) => {
      if (s) {
        if (s.theme) setTheme(s.theme)
        if (s.defaultMode) {
          setDefaultMode(s.defaultMode)
          setSyncMode(s.defaultMode)
        }
        if (s.checkUpdates !== undefined) setCheckUpdates(s.checkUpdates)
        if (s.aiApiKey) setAiApiKey(s.aiApiKey)
        if (s.aiProvider) setAiProvider(s.aiProvider)
        if (s.aiModel) setAiModel(s.aiModel)
        if (s.aiPrompt) setAiPrompt(s.aiPrompt)
      }
    })

    window.api?.engine?.checkBinaries().then((res: any) => {
      if (res) {
        const isReady = res.ffmpegReady && res.ffsubsyncReady && res.whisperReady
        setEngineReady(isReady)
        if (isReady) {
          setLogs((prev) => [
            ...prev,
            `[ENGINE] FFmpeg detected: ${res.ffmpegPath}`,
            `[ENGINE] ffsubsync detected: ${res.ffsubsyncPath}`,
            `[ENGINE] Whisper AI detected: ${res.whisperPath}`
          ])
        } else {
          if (!res.ffmpegReady) setLogs((prev) => [...prev, '[WARNING] ffmpeg.exe missing from bin/ folder.'])
          if (!res.ffsubsyncReady) setLogs((prev) => [...prev, '[WARNING] ffsubsync.exe missing from bin/ folder.'])
          if (!res.whisperReady) setLogs((prev) => [...prev, '[WARNING] whisper.exe missing from bin/ folder.'])
        }
      }
    })
  }, [])

  // Load available Whisper models dynamically
  useEffect(() => {
    loadWhisperModels(false)
  }, [loadWhisperModels])

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

  // Listen to background sync events
  useEffect(() => {
    if (!window.api?.engine?.onEvent) return

    const unsubEvent = window.api.engine.onEvent((event: any) => {
      if (event.type === 'log') {
        setLogs((prev) => [...prev, event.message])
      } else if (event.type === 'status') {
        if (isGeneratingRef.current) {
          setGenerateStatusMessage(event.message)
        } else {
          setStatusMessage(event.message)
        }
      } else if (event.type === 'progress') {
        const filePct = typeof event.percent === 'number' ? event.percent : 0
        if (isGeneratingRef.current) {
          setGenerateProgress(filePct)
          if (event.message) {
            setGenerateStatusMessage(event.message)
          }
        } else {
          const subIdx = currentSubIndexRef.current
          const total = subtitlesRef.current.length || 1
          const overallPct = Math.min(100, Math.max(0, Math.round(((subIdx * 100) + filePct) / total)))
          setProgress(overallPct)
          if (event.message) {
            if (total > 1) {
              setStatusMessage(`[${subIdx + 1}/${total}] ${event.message}`)
            } else {
              setStatusMessage(event.message)
            }
          }
        }
      } else if (event.type === 'done') {
        if (event.success) {
          if (isGeneratingRef.current) {
            setGenerateProgress(100)
            setGenerateStatusMessage('Subtitle generation complete!')
          }
          setLogs((prev) => [
            ...prev,
            `[SUCCESS] Output generated: ${event.output} (Score: ${event.score !== null ? event.score : 'N/A'})`
          ])
          if (event.output) {
            const folder = event.output.substring(
              0,
              Math.max(event.output.lastIndexOf('/'), event.output.lastIndexOf('\\'))
            )
            setLastOutputDir(folder)
            setLastOutputFile(event.output)
          }
        } else {
          setLogs((prev) => [...prev, '[ERROR] Synchronization pass failed.'])
        }
      } else if (event.type === 'error') {
        setLogs((prev) => [...prev, `[ERROR] ${event.message}`])
        setStatusMessage('Error occurred during sync.')
        setIsSyncing(false)
      }
    })

    // Listen to extractor events
    const unsubExtract = window.api?.extractor?.onEvent
      ? window.api.extractor.onEvent((event: any) => {
          if (event.type === 'progress') {
            const p = typeof event.percent === 'number' ? event.percent : 0
            setExtractProgress(p)
            if (event.message) setExtractStatusMessage(event.message)
          } else if (event.type === 'log') {
            setLogs((prev) => [...prev, event.message])
          }
        })
      : undefined

    return () => {
      unsubEvent()
      unsubExtract?.()
    }
  }, [])

  // Probe Video File
  const handleSelectVideo = async (filePath: string) => {
    setVideoPath(filePath)
    setLogs((prev) => [...prev, `[MEDIA] Loading video: ${filePath}`])
    setStatusMessage('Probing video audio and subtitle tracks...')

    try {
      const res = await window.api.engine.probe(filePath)
      if (res) {
        setAudioTracks(res.tracks || [])
        setVideoDetails(res.details || null)
        const subTracks = res.subtitleTracks || []
        setSubtitleTracks(subTracks)
        const textTracks = subTracks.filter((t) => t.isText)
        setSelectedExtractTrackIndices(textTracks.map((t) => t.index))
        setExtractedFiles([])
        setExtractOutputDir(null)

        if (res.tracks && res.tracks.length > 0) {
          setSelectedTrack(res.tracks[0].index)
        }

        if (subTracks.length > 0) {
          const subSummary = subTracks
            .map(
              (t) =>
                `#${t.index + 1} [${t.language.toUpperCase()}: ${t.codec}${
                  t.title ? ' - ' + t.title : ''
                }${!t.isText ? ' (Image)' : ''}]`
            )
            .join(', ')
          setLogs((prev) => [
            ...prev,
            `[MEDIA] Detected ${res.tracks?.length || 0} audio stream(s), ${
              subTracks.length
            } embedded subtitle track(s): ${subSummary}`
          ])
        } else {
          setLogs((prev) => [
            ...prev,
            `[MEDIA] Detected ${res.tracks?.length || 0} audio stream(s), 0 embedded subtitle track(s). Duration: ${
              res.details?.duration || 'Unknown'
            }, FPS: ${res.details?.fps || 'Unknown'}`
          ])
        }
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `[ERROR] Probing failed: ${e.message}`])
    }
    setStatusMessage('Ready')
  }

  // Browse video
  const handleBrowseVideo = async () => {
    const file = await window.api.dialog.openVideo()
    if (file) {
      handleSelectVideo(file)
    }
  }

  // Handle Subtitles
  const handleAddSubtitles = async (paths: string[]) => {
    const newItems: SubtitleItem[] = []
    for (const p of paths) {
      const name = p.split(/[\/\\]/).pop() || p
      const inspectRes = await window.api.engine.inspectSubtitle(p)
      newItems.push({
        id: Math.random().toString(36).substring(7),
        path: p,
        name,
        cues: inspectRes?.cueCount,
        fps: inspectRes?.fps,
        tag: inspectRes?.tag,
        lines: inspectRes?.lines,
        span: inspectRes?.span
      })
    }
    setSubtitles((prev) => [...prev, ...newItems])
    setLogs((prev) => [...prev, `[SUBTITLES] Added ${paths.length} subtitle file(s)`])
  }

  const handleBrowseSubtitles = async () => {
    const files = await window.api.dialog.openSubtitles()
    if (files && files.length > 0) {
      handleAddSubtitles(files)
    }
  }

  const handleRemoveSubtitle = (id: string) => {
    setSubtitles((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        setProgress(0)
        setStatusMessage('')
        setLastOutputDir(null)
        setLastOutputFile(null)
      }
      return next
    })
  }

  // Intelligent Recommender Trigger
  useEffect(() => {
    if (videoPath && subtitles.length > 0) {
      window.api.engine.recommend(videoPath, subtitles[0].path).then((res: any) => {
        if (res) {
          setRecommendation(res)
          setRecommendedMode(res.mode)
          setRecommendedReason(res.hint || res.title)
          if (!userSelectedMode && res.mode) {
            setSyncMode(res.mode as SyncMode)
          }
          setLogs((prev) => [...prev, `[RECOMMENDER] ${res.title}`])
        }
      })
    } else {
      setRecommendation(null)
      setRecommendedMode(null)
      setRecommendedReason(null)
    }
  }, [videoPath, subtitles.length])

  const handleSetSyncMode = (m: SyncMode) => {
    setSyncMode(m)
    setUserSelectedMode(true)
  }

  // Start Sync Execution
  const handleStartSync = async () => {
    if (!videoPath || subtitles.length === 0) return

    syncCancelledRef.current = false
    setIsSyncing(true)
    setProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setLogs((prev) => [
      ...prev,
      `=== Starting ${syncMode} synchronization session ===`,
      `Movie: ${videoPath}`,
      `Total Subtitles: ${subtitles.length}`
    ])
    setStatusMessage(`Preparing ${syncMode} synchronization...`)

    let successCount = 0

    for (let i = 0; i < subtitles.length; i++) {
      if (syncCancelledRef.current) break
      currentSubIndexRef.current = i
      const sub = subtitles[i]
      const ext = sub.path.substring(sub.path.lastIndexOf('.'))
      const outPath = sub.path.replace(new RegExp(`\\${ext}$`, 'i'), `.synced${ext}`)

      setLogs((prev) => [...prev, `[SYNC] (${i + 1}/${subtitles.length}) Processing: ${sub.name}`])

      const res = await window.api.engine.startSync({
        video: videoPath,
        sub: sub.path,
        out: outPath,
        mode: syncMode,
        trackIndex: selectedTrack
      })
      if (syncCancelledRef.current || res?.cancelled) {
        break
      }
      if (res?.success) {
        successCount++
        const savedOut = (res as any)?.out || outPath
        setLastOutputFile(savedOut)
        const folder = savedOut.substring(
          0,
          Math.max(savedOut.lastIndexOf('/'), savedOut.lastIndexOf('\\'))
        )
        setLastOutputDir(folder)
      }
    }

    if (syncCancelledRef.current) {
      setIsSyncing(false)
      setProgress(0)
      setLastOutputDir(null)
      setLastOutputFile(null)
      return
    }

    setProgress(100)
    setIsSyncing(false)
    if (successCount === subtitles.length) {
      const msg = `All ${subtitles.length} subtitle(s) synchronized successfully!`
      setStatusMessage(msg)
      toast.success(msg, { duration: 4000 })
    } else if (successCount > 0) {
      const msg = `Completed: ${successCount}/${subtitles.length} synchronized.`
      setStatusMessage(msg)
      toast.success(msg, { duration: 4000 })
    } else {
      setStatusMessage('Synchronization failed.')
      toast.error('Synchronization failed. Please check logs or try another sync mode.', { duration: 4000 })
    }
  }

  const handleCancelSync = async () => {
    syncCancelledRef.current = true
    await window.api.engine.cancelSync()
    setIsSyncing(false)
    setProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setStatusMessage('Cancelled by user')
    toast('Synchronization cancelled', { icon: '⏹️', duration: 2500 })
    setLogs((prev) => [...prev, '[USER] Synchronization cancelled.'])
  }

  const handleStartDownloadModel = async () => {
    if (!navigator.onLine) {
      toast.error('No internet connection. Please connect to the internet to download this Whisper model.', {
        duration: 5500,
        icon: '📡'
      })
      setModelDownloadError('No internet connection detected. An active internet connection is required to download models.')
      return
    }

    if (!window.api?.generator?.downloadModel) {
      toast.error('Please restart the application (stop terminal and re-run npm run dev) to load backend!')
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
  }

  const handleCancelDownloadModel = async () => {
    if (window.api?.generator?.cancelDownload) {
      await window.api.generator.cancelDownload()
    }
    setIsDownloadingModel(false)
    setModelDownloadProgress(0)
    toast('Model download cancelled')
  }

  const handleBrowseGenerateSubtitle = async () => {
    try {
      const files = await window.api.dialog.openSubtitles()
      if (files && files.length > 0) {
        setGenerateConfig((prev) => ({
          ...prev,
          sourceType: 'subtitle',
          sourceSubPath: files[0]
        }))
        const fileName = files[0].split(/[/\\]/).pop()
        toast.success(`Selected subtitle: ${fileName}`)
        setLogs((prev) => [...prev, `[SUBTITLE] Selected file for AI translation: ${files[0]}`])
      }
    } catch (e: any) {
      toast.error('Failed to open subtitle: ' + e?.message)
    }
  }

  const handleTranslateExtractedWithAi = (item: ExtractedFileItem) => {
    setGenerateConfig((prev) => ({
      ...prev,
      sourceType: 'subtitle',
      sourceSubPath: item.outputPath,
      language: 'si'
    }))
    setSubtitleAction('generate')
    toast.success(`Loaded "${item.fileName}" for AI Translation!`, { icon: '✨' })
    setLogs((prev) => [...prev, `[AI TRANSLATION] Switched to AI Translate for extracted track: ${item.fileName}`])
  }

  // Start Generate / Translate Execution
  const handleStartGenerate = async () => {
    const isSubtitleSource = generateConfig.sourceType === 'subtitle'

    if (isSubtitleSource) {
      if (!generateConfig.sourceSubPath) {
        toast.error('Please choose a subtitle file (.srt) to translate in Step 2!')
        return
      }
    } else {
      if (!videoPath) {
        toast.error('Please select a reference movie in Step 1 first!')
        return
      }
    }

    if (!window.api?.generator?.startGenerate) {
      toast.error('Backend updated! Please restart your terminal (Ctrl+C then "npm run dev") to activate!', {
        duration: 6500,
        icon: '🔄'
      })
      setLogs((prev) => [
        ...prev,
        '[NOTICE] New Electron main/preload backend code detected. Please restart your development server (Ctrl+C and npm run dev) to apply changes.'
      ])
      return
    }

    // Guard: Check internet connection & AI API Key if target language is Spoken Sinhala
    if (generateConfig.language === 'si') {
      if (!navigator.onLine) {
        toast.error(
          'Internet connection required for AI Spoken Sinhala translation. You can still generate subtitles offline by selecting "Movie\'s Language"!',
          { duration: 6000, icon: '📡' }
        )
        setLogs((prev) => [
          ...prev,
          '[NETWORK] Offline: Internet connection required for AI Spoken Sinhala translation.'
        ])
        return
      }

      if (!aiApiKey.trim()) {
        toast.error('Please enter your AI API Key in Settings to translate subtitles into Spoken Sinhala!', {
          duration: 5000,
          icon: '🔑'
        })
        setSettingsInitialTab('ai')
        setSettingsModalOpen(true)
        return
      }
    }

    // Only verify Whisper binaries & models if generating from video!
    if (!isSubtitleSource) {
      // Check if Whisper model exists
      try {
        const modelCheck = await window.api.generator.checkModel(generateConfig.modelQuality)
        if (!modelCheck?.exists) {
          setDownloadModalOpen(true)
          return
        }
      } catch (e) {
        // ignore
      }

      // Check if Whisper binary exists
      try {
        const whisperCheck = await window.api.generator.checkWhisper()
        if (!whisperCheck?.exists) {
          toast.error('whisper.exe not found in bin/ folder. Please place whisper.exe into the bin/ directory.', {
            duration: 6000,
            icon: '⚠️'
          })
          setLogs((prev) => [
            ...prev,
            '[ERROR] whisper.exe (or whisper-cli.exe) not found in bin/. Please place the whisper executable into the bin/ directory.'
          ])
          return
        }
      } catch (e) {
        // ignore
      }
    }

    setIsGenerating(true)
    setGenerateProgress(5)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setGenerateStatusMessage(isSubtitleSource ? 'Starting AI dialogue translation...' : 'Starting subtitle generation...')
    setLogs((prev) => [
      ...prev,
      isSubtitleSource
        ? `=== Starting Subtitle Translation ===`
        : `=== Starting Subtitle Generation ===`,
      isSubtitleSource ? `Source Subtitle: ${generateConfig.sourceSubPath}` : `Movie: ${videoPath}`,
      !isSubtitleSource ? `Selected Audio Track: #${selectedTrack ?? 0}` : `Bypassing Whisper: Direct text translation mode`,
      `Target Language: ${generateConfig.language}`,
      !isSubtitleSource ? `Model Quality: ${generateConfig.modelQuality}` : `Model: Cloud AI (${aiModel || 'Auto'})`,
      `Output Format: .${generateConfig.format}`
    ])

    const activeTrack = audioTracks.find((t) => t.index === selectedTrack)
    const trackLanguage = activeTrack?.language || ''

    try {
      const res = await window.api.generator.startGenerate({
        video: videoPath,
        trackIndex: selectedTrack,
        trackLanguage,
        durationSec: videoDetails?.durationSec,
        ...generateConfig,
        aiApiKey,
        aiProvider,
        aiModel,
        customPrompt: aiPrompt
      })

      if (res?.success) {
        setGenerateProgress(100)
        setGenerateStatusMessage(isSubtitleSource ? 'Subtitle translation complete!' : 'Subtitles generated successfully!')
        toast.success(isSubtitleSource ? 'Subtitle translated successfully!' : 'Subtitle generated successfully!', { duration: 4000 })
        if (res.output) {
          const folder = res.output.substring(
            0,
            Math.max(res.output.lastIndexOf('/'), res.output.lastIndexOf('\\'))
          )
          setLastOutputDir(folder)
          setLastOutputFile(res.output)
        }
      } else {
        setGenerateProgress(0)
        setLastOutputDir(null)
        setLastOutputFile(null)
        const isCancelled = res?.message?.toLowerCase().includes('cancel')
        const friendlyMsg = formatUserFriendlyError(res?.message || (isSubtitleSource ? 'Translation failed' : 'Generation failed'))
        setGenerateStatusMessage(isCancelled ? 'Cancelled by user' : friendlyMsg)
        if (!isCancelled) {
          toast.error(friendlyMsg, { duration: 5000 })
          setLogs((prev) => [...prev, `[ERROR] ${res?.message || 'Processing failed'}`])
        }
      }
    } catch (err: any) {
      setGenerateProgress(0)
      setLastOutputDir(null)
      setLastOutputFile(null)
      const isCancelled = err.message?.toLowerCase().includes('cancel')
      if (isCancelled) {
        setGenerateStatusMessage('Cancelled by user')
      } else {
        const friendlyMsg = formatUserFriendlyError(err)
        setLogs((prev) => [...prev, `[ERROR] ${err.message}`])
        setGenerateStatusMessage(friendlyMsg)
        toast.error(friendlyMsg, { duration: 5000 })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCancelGenerate = async () => {
    await window.api.generator.cancelGenerate()
    setIsGenerating(false)
    setGenerateProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setGenerateStatusMessage('Generation cancelled by user')
    toast('Subtitle generation cancelled', { icon: '⏹️' })
    setLogs((prev) => [...prev, '[USER] Subtitle generation cancelled.'])
  }

  // Extractor Handlers
  const handleToggleExtractTrack = (trackIndex: number) => {
    setSelectedExtractTrackIndices((prev) =>
      prev.includes(trackIndex) ? prev.filter((i) => i !== trackIndex) : [...prev, trackIndex]
    )
  }

  const handleSelectAllExtractTracks = () => {
    const textTracks = subtitleTracks.filter((t) => t.isText)
    setSelectedExtractTrackIndices(textTracks.map((t) => t.index))
  }

  const handleDeselectAllExtractTracks = () => {
    setSelectedExtractTrackIndices([])
  }

  const handleChangeExtractOutputDir = async () => {
    if (!window.api?.dialog?.selectFolder) return
    const defaultDir =
      extractOutputDir ||
      (videoPath ? videoPath.substring(0, Math.max(videoPath.lastIndexOf('/'), videoPath.lastIndexOf('\\'))) : undefined)
    const selected = await window.api.dialog.selectFolder(defaultDir)
    if (selected) {
      setExtractOutputDir(selected)
      toast.success('Destination folder updated!')
    }
  }

  const handleStartExtract = async () => {
    if (!videoPath) {
      toast.error('Please select a reference movie in Step 1 first!')
      return
    }

    const tracksToExtract = subtitleTracks.filter(
      (t) => selectedExtractTrackIndices.includes(t.index) && t.isText
    )

    if (tracksToExtract.length === 0) {
      toast.error('Please select at least 1 text subtitle track to extract!')
      return
    }

    setIsExtracting(true)
    setExtractProgress(5)
    setExtractStatusMessage('Starting subtitle extraction with FFmpeg...')
    setLogs((prev) => [
      ...prev,
      `=== Extracting Subtitle Tracks ===`,
      `Movie: ${videoPath}`,
      `Selected tracks: ${tracksToExtract.length} of ${subtitleTracks.length}`
    ])

    try {
      const res = await window.api.extractor.extractMultiple({
        videoPath,
        tracks: tracksToExtract,
        outputDir: extractOutputDir || undefined,
        cleanTags: extractCleanTags
      })

      if (res.cancelled) {
        setExtractProgress(0)
        setExtractStatusMessage('Extraction cancelled by user.')
        toast('Extraction cancelled', { icon: '⏹️' })
      } else if (res.success && res.extracted.length > 0) {
        const fileItems: ExtractedFileItem[] = res.extracted.map((e) => ({
          outputPath: e.outputPath!,
          fileName: e.outputPath!.split(/[/\\]/).pop() || 'subtitle.extracted.srt',
          trackIndex: e.trackIndex,
          language: e.language,
          title: e.title,
          cuesCount: e.cuesCount,
          durationStr: e.durationStr
        }))

        setExtractedFiles(fileItems)
        setExtractProgress(100)
        setExtractStatusMessage(`Extracted ${fileItems.length} subtitle file(s) successfully!`)
        toast.success(`Extracted ${fileItems.length} subtitle(s) to .SRT!`, { duration: 4500 })

        const lastFile = fileItems[fileItems.length - 1].outputPath
        const folder = lastFile.substring(
          0,
          Math.max(lastFile.lastIndexOf('/'), lastFile.lastIndexOf('\\'))
        )
        setLastOutputDir(folder)
        setLastOutputFile(lastFile)
      } else {
        setExtractProgress(0)
        setExtractStatusMessage('Failed to extract subtitle tracks.')
        toast.error('Subtitle extraction failed. See activity console for details.')
      }
    } catch (err: any) {
      setExtractProgress(0)
      setExtractStatusMessage('Extraction error.')
      toast.error(err.message || 'Error during extraction')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleExtractSingleNow = async (track: SubtitleTrack) => {
    if (!videoPath) return
    setIsExtracting(true)
    setExtractProgress(20)
    setExtractStatusMessage(`Extracting Track #${track.index + 1} (${track.language.toUpperCase()})...`)
    setLogs((prev) => [
      ...prev,
      `[EXTRACT] Extracting single track #${track.index + 1} (${track.language.toUpperCase()}) from ${videoPath}`
    ])

    try {
      const res = await window.api.extractor.extractSingle({
        videoPath,
        track,
        outputDir: extractOutputDir || undefined,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        const fileItem: ExtractedFileItem = {
          outputPath: res.outputPath,
          fileName: res.outputPath.split(/[/\\]/).pop() || 'subtitle.extracted.srt',
          trackIndex: res.trackIndex,
          language: res.language,
          title: res.title,
          cuesCount: res.cuesCount,
          durationStr: res.durationStr
        }
        setExtractedFiles((prev) => [
          fileItem,
          ...prev.filter((f) => f.outputPath !== fileItem.outputPath)
        ])
        setExtractProgress(100)
        setExtractStatusMessage(`Track #${track.index + 1} extracted successfully!`)
        toast.success(`Extracted to ${fileItem.fileName}!`, { duration: 4000 })
        const folder = res.outputPath.substring(
          0,
          Math.max(res.outputPath.lastIndexOf('/'), res.outputPath.lastIndexOf('\\'))
        )
        setLastOutputDir(folder)
        setLastOutputFile(res.outputPath)
      } else {
        toast.error(res.error || 'Failed to extract track')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract track')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleCancelExtract = async () => {
    if (window.api?.extractor?.cancel) {
      await window.api.extractor.cancel()
    }
    setIsExtracting(false)
    setExtractProgress(0)
    setExtractStatusMessage('Extraction cancelled')
    toast('Extraction cancelled', { icon: '⏹️' })
  }

  const handleSendExtractedToSync = async (item: ExtractedFileItem) => {
    try {
      const info = await window.api.engine.inspectSubtitle(item.outputPath)
      const newItem: SubtitleItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        path: item.outputPath,
        name: item.fileName,
        cues: info?.cueCount || item.cuesCount,
        fps: info?.fps,
        tag: info?.tag,
        lines: info?.lines,
        span: info?.span
      }

      setSubtitles([newItem])
      setSubtitleAction('sync')
      toast.success(`Loaded "${item.fileName}" into Synchronizer!`, { icon: '🔄', duration: 4000 })
      setLogs((prev) => [
        ...prev,
        `[WORKFLOW] Sent extracted subtitle "${item.fileName}" to Synchronizer queue.`
      ])
    } catch (e: any) {
      toast.error(`Failed to load subtitle: ${e.message}`)
    }
  }

  const handleOpenFolder = async () => {
    // 1. If generated / synced output file exists, open INSIDE containing folder and highlight it
    if (lastOutputFile && window.api?.shell?.showItemInFolder) {
      const opened = await window.api.shell.showItemInFolder(lastOutputFile)
      if (opened) return
    }

    // 2. If output directory is recorded, open directly INSIDE that folder
    if (lastOutputDir) {
      if (window.api?.shell?.openPath) {
        const opened = await window.api.shell.openPath(lastOutputDir)
        if (opened) return
      } else if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(lastOutputDir)
        if (opened) return
      }
    }

    // 3. If user selected a subtitle in Step 2, open INSIDE the folder where that original subtitle is located
    if (subtitles.length > 0 && subtitles[0]?.path) {
      if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(subtitles[0].path)
        if (opened) return
      }
      const subFolder = subtitles[0].path.substring(
        0,
        Math.max(subtitles[0].path.lastIndexOf('/'), subtitles[0].path.lastIndexOf('\\'))
      )
      if (subFolder && window.api?.shell?.openPath) {
        const opened = await window.api.shell.openPath(subFolder)
        if (opened) return
      }
    }

    // 4. Fallback: If movie video exists, open INSIDE the folder where the movie is located
    if (videoPath) {
      if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(videoPath)
        if (opened) return
      }
      const vidFolder = videoPath.substring(
        0,
        Math.max(videoPath.lastIndexOf('/'), videoPath.lastIndexOf('\\'))
      )
      if (vidFolder && window.api?.shell?.openPath) {
        const opened = await window.api.shell.openPath(vidFolder)
        if (opened) return
      }
    }

    toast.error('No folder or subtitle selected yet.')
  }

  const handleSaveSettings = () => {
    window.api?.settings?.save({
      theme,
      defaultMode,
      checkUpdates,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    })
  }

  const isUnlocked = Boolean(videoPath && subtitles.length > 0)

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark' ? 'dark bg-[#0B0F19] text-slate-100' : 'bg-slate-100 text-slate-900'
      } ${isAnyModalOpen ? 'overflow-hidden max-h-screen' : ''} flex flex-col font-sans transition-colors duration-200`}
    >
      <Header
        theme={theme}
        setTheme={handleSetTheme}
        onOpenSettings={() => {
          setSettingsInitialTab('general')
          setSettingsModalOpen(true)
        }}
        onOpenAbout={() => setAboutModalOpen(true)}
        engineReady={engineReady}
        isOnline={isOnline}
      />

      <main className="flex-1 max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto p-6 space-y-5">
        {/* Step 1: Reference Movie */}
        <Step1Video
          videoPath={videoPath}
          videoDetails={videoDetails}
          audioTracks={audioTracks}
          selectedTrack={selectedTrack}
          subtitleTracks={subtitleTracks}
          onBrowse={handleBrowseVideo}
          onRemove={() => {
            setVideoPath(null)
            setAudioTracks([])
            setVideoDetails(null)
            setSelectedTrack(null)
            setSubtitleTracks([])
            setSelectedExtractTrackIndices([])
            setExtractedFiles([])
            setSubtitleAction('sync')
          }}
          onSelectTrackModal={() => setAudioModalOpen(true)}
          onDropFile={(path) => handleSelectVideo(path)}
        />

        {/* Selection Option above Step 2 */}
        <SubtitleModeSelector
          action={subtitleAction}
          hasVideo={Boolean(videoPath)}
          onSelectAction={(action) => {
            if ((action === 'generate' || action === 'extract') && !videoPath) return
            setSubtitleAction(action)
            if (action === 'extract' && videoPath && subtitleTracks.length === 0) {
              handleSelectVideo(videoPath)
            }
            setLogs((prev) => [
              ...prev,
              `[WORKFLOW] Switched to: ${
                action === 'sync'
                  ? 'Synchronize Existing Subtitle'
                  : action === 'generate'
                  ? 'Generate Subtitle'
                  : 'Extract Encoded Subtitles'
              }`
            ])
          }}
        />

        {/* Step 2: Subtitle Files, Generation Settings, or Extractor */}
        {subtitleAction === 'sync' ? (
          <Step2Subtitles
            subtitles={subtitles}
            onBrowse={handleBrowseSubtitles}
            onRemove={handleRemoveSubtitle}
            onClearAll={() => {
              setSubtitles([])
              setProgress(0)
              setStatusMessage('')
              setLastOutputDir(null)
              setLastOutputFile(null)
            }}
            onDropFiles={(paths) => handleAddSubtitles(paths)}
          />
        ) : subtitleAction === 'generate' ? (
          <Step2Generate
            videoPath={videoPath}
            selectedTrack={selectedTrack}
            audioTracks={audioTracks}
            onSelectTrack={(idx) => {
              setSelectedTrack(idx)
              setLogs((prev) => [...prev, `[AUDIO] Selected track #${idx} for subtitle generation`])
            }}
            config={generateConfig}
            onChangeConfig={(newCfg) =>
              setGenerateConfig((prev) => ({ ...prev, ...newCfg }))
            }
            isOnline={isOnline}
            availableModels={whisperModels}
            isLoadingModels={isLoadingWhisperModels}
            onRefreshModels={() => loadWhisperModels(true)}
            modelsSource={whisperModelsSource}
            extractedFiles={extractedFiles}
            onBrowseSubtitle={handleBrowseGenerateSubtitle}
          />
        ) : (
          <Step2Extract
            videoPath={videoPath}
            subtitleTracks={subtitleTracks}
            selectedTrackIndices={selectedExtractTrackIndices}
            outputDir={extractOutputDir}
            onToggleTrack={handleToggleExtractTrack}
            onSelectAllTracks={handleSelectAllExtractTracks}
            onDeselectAllTracks={handleDeselectAllExtractTracks}
            onChangeOutputDir={handleChangeExtractOutputDir}
            onExtractSingleNow={handleExtractSingleNow}
            onRescan={() => videoPath && handleSelectVideo(videoPath)}
            onSwitchToGenerate={() => setSubtitleAction('generate')}
            isExtracting={isExtracting}
          />
        )}

        {/* Step 3: Synchronization, Generate Action, or Extract Action */}
        {subtitleAction === 'sync' ? (
          <Step3Sync
            unlocked={isUnlocked}
            isSyncing={isSyncing}
            syncMode={syncMode}
            setSyncMode={handleSetSyncMode}
            recommendation={recommendation}
            userSelectedMode={userSelectedMode}
            recommendedMode={recommendedMode}
            recommendedReason={recommendedReason}
            progress={progress}
            statusMessage={statusMessage}
            lastOutputDir={lastOutputDir}
            onStartSync={handleStartSync}
            onCancelSync={handleCancelSync}
            onOpenFolder={handleOpenFolder}
          />
        ) : subtitleAction === 'generate' ? (
          <Step3Generate
            unlocked={
              generateConfig.sourceType === 'subtitle'
                ? Boolean(generateConfig.sourceSubPath)
                : Boolean(videoPath)
            }
            isGenerating={isGenerating}
            config={generateConfig}
            selectedTrack={selectedTrack}
            progress={generateProgress}
            statusMessage={generateStatusMessage}
            lastOutputDir={lastOutputDir}
            onStartGenerate={handleStartGenerate}
            onCancelGenerate={handleCancelGenerate}
            onOpenFolder={handleOpenFolder}
          />
        ) : (
          <Step3Extract
            unlocked={Boolean(videoPath && subtitleTracks.length > 0)}
            isExtracting={isExtracting}
            selectedCount={selectedExtractTrackIndices.length}
            progress={extractProgress}
            statusMessage={extractStatusMessage}
            lastOutputDir={lastOutputDir}
            extractedFiles={extractedFiles}
            cleanTags={extractCleanTags}
            setCleanTags={setExtractCleanTags}
            onStartExtract={handleStartExtract}
            onCancelExtract={handleCancelExtract}
            onOpenFolder={handleOpenFolder}
            onSendToSync={handleSendExtractedToSync}
            onTranslateWithAi={handleTranslateExtractedWithAi}
          />
        )}

        {/* Live Activity Console */}
        <ActivityConsole logs={logs} onClear={() => setLogs([])} isSyncing={isSyncing || isGenerating || isExtracting} />
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto px-6 pb-6 pt-1 space-y-2.5">
        {/* Status bar row */}
        {/* Bottom Status & Destination bar */}
        <div className="flex items-center justify-between text-xs py-2 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold">
            <span
              className={`text-sm leading-none ${
                (subtitleAction === 'sync' ? isSyncing : subtitleAction === 'generate' ? isGenerating : isExtracting)
                  ? 'text-blue-800 dark:text-blue-400 animate-pulse'
                  : (subtitleAction === 'sync' ? progress === 100 : subtitleAction === 'generate' ? generateProgress === 100 : extractProgress === 100) && lastOutputDir
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              ●
            </span>
            <span>
              {subtitleAction === 'sync'
                ? statusMessage || 'Select movie and subtitle(s)'
                : subtitleAction === 'generate'
                ? generateStatusMessage || (videoPath ? 'Ready to generate subtitle from movie audio' : 'Select reference movie in Step 1')
                : extractStatusMessage || (videoPath ? (subtitleTracks.length > 0 ? `${subtitleTracks.length} embedded track(s) detected` : 'No embedded subtitle tracks detected') : 'Select movie file in Step 1')}
            </span>
          </div>

          <button
            onClick={handleOpenFolder}
            disabled={!lastOutputDir && subtitles.length === 0 && !videoPath}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-bold text-xs transition-all duration-200 ${
              lastOutputDir || subtitles.length > 0 || videoPath
                ? 'border-blue-800 bg-blue-800 hover:bg-blue-900 text-white shadow-xs dark:bg-blue-600 dark:hover:bg-blue-500 dark:border-blue-600 cursor-pointer active:scale-98'
                : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed shadow-none'
            }`}
            title={
              lastOutputDir
                ? 'Open folder containing generated / synced subtitles'
                : subtitles.length > 0
                ? 'Open folder containing original selected subtitle'
                : videoPath
                ? 'Open folder containing selected movie'
                : 'No movie or subtitle selected yet'
            }
          >
            <FolderOpen
              className={`w-3.5 h-3.5 ${
                lastOutputDir || subtitles.length > 0 || videoPath
                  ? 'text-white dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            />
            <span>Open Output Folder</span>
          </button>
        </div>

        {/* Developer attribution & GitHub row */}
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-semibold">
          <span>Developed by DH-0216</span>
          <button
            onClick={() => {
              const url = EXTERNAL_LINKS.GITHUB_REPO
              if (window.api?.shell?.openExternal) {
                window.api.shell.openExternal(url)
              } else {
                window.open(url, '_blank')
              }
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>GitHub Repository ↗</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <AudioTrackModal
        isOpen={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        tracks={audioTracks}
        selectedTrack={selectedTrack}
        onSelectTrack={(idx) => {
          setSelectedTrack(idx)
          setLogs((prev) => [...prev, `[AUDIO] Selected audio reference track #${idx}`])
        }}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
        theme={theme}
        setTheme={handleSetTheme}
        checkUpdates={checkUpdates}
        setCheckUpdates={setCheckUpdates}
        aiApiKey={aiApiKey}
        setAiApiKey={setAiApiKey}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        aiModel={aiModel}
        setAiModel={setAiModel}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        onSave={handleSaveSettings}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

      <ModelDownloadModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        modelQuality={generateConfig.modelQuality}
        modelInfo={whisperModels.find((m) => m.id === generateConfig.modelQuality)}
        isDownloading={isDownloadingModel}
        downloadProgress={modelDownloadProgress}
        downloadSpeed={modelDownloadSpeed}
        downloadedBytes={modelDownloadedBytes}
        totalBytes={modelTotalBytes}
        errorMessage={modelDownloadError}
        onStartDownload={handleStartDownloadModel}
        onCancelDownload={handleCancelDownloadModel}
      />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: theme === 'dark' ? '#1E293B' : '#FFFFFF',
            color: theme === 'dark' ? '#F8FAFC' : '#0F172A',
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFFFF'
            }
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#FFFFFF'
            }
          }
        }}
      />
    </div>
  )
}
