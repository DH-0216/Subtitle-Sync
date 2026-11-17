import React, { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Sidebar } from './components/Sidebar'
import { Step1Video, SubtitleTrack } from './components/Step1Video'
import { SubtitleAction } from './components/SubtitleModeSelector'
import { Step2Subtitles, SubtitleItem } from './components/Step2Subtitles'
import { Step2Generate, GenerateConfig } from './components/Step2Generate'
import { Step2Extract } from './components/Step2Extract'
import { Step1Translate } from './components/Step1Translate'
import { Step2Translate } from './components/Step2Translate'
import { Step3Translate } from './components/Step3Translate'
import { Step3Sync, SyncMode } from './components/Step3Sync'
import { Step3Generate } from './components/Step3Generate'
import { Step3Extract } from './components/Step3Extract'
import { ActivityConsole } from './components/ActivityConsole'
import { AudioTrackModal } from './components/AudioTrackModal'
import { SettingsModal, DEFAULT_AI_PROMPT } from './components/SettingsModal'
import { AboutModal } from './components/AboutModal'
import { ModelDownloadModal } from './components/ModelDownloadModal'
import { UpdateModal, AppUpdateData } from './components/UpdateModal'
import { formatUserFriendlyError } from '@shared/errorUtils'
import { AiProviderId, isValidAiProvider } from '@shared/aiModels'
import { APP_VERSION, compareVersions } from '@shared/version'
import {
  cleanPathString,
  isVideoFile,
  isSubtitleFile,
  getFileExtension,
  getUnsupportedFileMessage,
  getFileName,
  FileValidationItem
} from '@shared/fileSanitizer'

import {
  ThemeMode,
  ResolvedTheme,
  resolveTheme,
  applyThemeToDocument
} from './theme'

export type { ThemeMode }

export default function App() {
  // Theme & Preferences
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [isSystemDark, setIsSystemDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const activeThemeDef = resolveTheme(theme, isSystemDark)
  const effectiveTheme: ResolvedTheme = activeThemeDef.id
  const [defaultMode, setDefaultMode] = useState<SyncMode>('Standard')
  const [checkUpdates, setCheckUpdates] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [engineReady, setEngineReady] = useState(false)
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState<AiProviderId>('gemini')
  const [aiModel, setAiModel] = useState('auto')
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT)

  // File selection inline error messages
  const [videoError, setVideoError] = useState<string | null>(null)
  const [subtitleError, setSubtitleError] = useState<string | null>(null)
  const [generateSubError, setGenerateSubError] = useState<string | null>(null)

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

  // In-App Auto-Updater States
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateData | null>(null)
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false)
  const [updateDownloadProgress, setUpdateDownloadProgress] = useState(0)
  const [updateDownloadSpeed, setUpdateDownloadSpeed] = useState('')
  const [updateDownloadedBytes, setUpdateDownloadedBytes] = useState(0)
  const [updateTotalBytes, setUpdateTotalBytes] = useState(0)
  const [updateErrorMessage, setUpdateErrorMessage] = useState<string | null>(null)
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useState(false)
  const autoDownloadUpdatesRef = React.useRef(autoDownloadUpdates)
  useEffect(() => {
    autoDownloadUpdatesRef.current = autoDownloadUpdates
  }, [autoDownloadUpdates])
  const [isUpdateReady, setIsUpdateReady] = useState(false)
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

  // Global window drag & drop protection: prevent browser from navigating away on dropped files
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => e.preventDefault()
    const handleWindowDrop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('drop', handleWindowDrop)
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

  const isAnyModalOpen =
    audioModalOpen ||
    settingsModalOpen ||
    aboutModalOpen ||
    downloadModalOpen ||
    updateModalOpen

  // Listen to in-app updater download progress events from Electron main process
  useEffect(() => {
    if (window.api?.updater?.onProgress) {
      const unsub = window.api.updater.onProgress((data: any) => {
        setUpdateDownloadProgress(data.percent || 0)
        setUpdateDownloadSpeed(data.speed || '')
        setUpdateDownloadedBytes(data.downloaded || 0)
        setUpdateTotalBytes(data.total || 0)
      })
      return () => unsub()
    }
  }, [])

  const handleCheckForAppUpdates = async (silent: boolean = false, autoDownloadIfEnabled: boolean = false) => {
    if (!navigator.onLine) {
      if (!silent) {
        toast.error('You are offline. Connect to the internet to check for updates.', { icon: '📡' })
      }
      return
    }

    try {
      if (window.api?.updater?.check) {
        const info = await window.api.updater.check()
        if (info.error) {
          if (!silent) {
            toast.error('Could not check for updates. No internet connection.', { icon: '📡' })
          }
          return
        }

        if (info.updateAvailable && info.latestVersion && compareVersions(info.latestVersion, APP_VERSION) > 0) {
          setAppUpdateInfo(info)
          setLogs((prev) => [...prev, `[UPDATER] New version available: v${info.latestVersion}`])

          // If autoDownloadUpdates is ON and running on startup, auto-download in background without forcing restart
          if (silent && autoDownloadIfEnabled && autoDownloadUpdatesRef.current && info.downloadUrl) {
            setLogs((prev) => [...prev, `[UPDATER] Auto-downloading update in background: v${info.latestVersion}`])
            handleDownloadAndInstallUpdate(info.downloadUrl)
          } else {
            // Open update window for user to download or remind later
            setUpdateModalOpen(true)
            if (!silent) {
              toast.success(`Update available: v${info.latestVersion}!`, { duration: 4000, icon: '🚀' })
            }
          }
        } else {
          if (!silent) {
            toast.success(`You're on the latest version (v${APP_VERSION})!`, { duration: 3000, icon: '✅' })
          }
        }
      }
    } catch (err: any) {
      if (!silent) {
        toast.error('Failed to check for updates: ' + (err?.message || 'Network error'))
      }
    }
  }

  const handleDownloadAndInstallUpdate = async (downloadUrl: string) => {
    if (!downloadUrl) return
    setIsDownloadingUpdate(true)
    setUpdateDownloadProgress(0)
    setUpdateErrorMessage(null)
    setLogs((prev) => [...prev, `[UPDATER] Starting in-app download: ${downloadUrl}`])

    try {
      if (window.api?.updater?.downloadAndInstall) {
        const res = await window.api.updater.downloadAndInstall(downloadUrl)
        if (res?.success) {
          setIsUpdateReady(true)
          notifyJobComplete(
            'Update Ready to Install',
            'Subtitle Sync Studio update has been downloaded. Restart anytime to apply.'
          )
          toast.success('Update ready! Click Restart to apply, or it will apply on your next launch.', { duration: 6000 })
        } else if (res?.error) {
          if (!res.error.toLowerCase().includes('cancel')) {
            setUpdateErrorMessage(res.error)
            toast.error(res.error)
            setLogs((prev) => [...prev, `[UPDATER] Download failed: ${res.error}`])
          }
        }
      }
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        setUpdateErrorMessage(err?.message || 'Failed to download update.')
        toast.error(err?.message || 'Failed to download update.')
      }
    } finally {
      setIsDownloadingUpdate(false)
    }
  }

  const handleRestartToApply = () => {
    if (window.api?.updater?.restartAndInstall) {
      window.api.updater.restartAndInstall()
    }
  }

  const handleRestartLater = () => {
    setUpdateModalOpen(false)
    toast.success('Update ready! It will be applied automatically next time you launch the app.', {
      icon: '🕒',
      duration: 5000
    })
  }

  const handleCancelUpdateDownload = async () => {
    try {
      if (window.api?.updater?.cancel) {
        await window.api.updater.cancel()
      }
    } catch {}
    setIsDownloadingUpdate(false)
    setUpdateDownloadProgress(0)
    toast('Update download cancelled.')
  }

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

  // Subtitle Workflow Mode (Sync Existing vs Extract vs Generate vs Translate)
  const [subtitleAction, setSubtitleAction] = useState<SubtitleAction>('sync')

  // Step 1: Video (Shared across modes)
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoDetails, setVideoDetails] = useState<any>(null)
  const [audioTracks, setAudioTracks] = useState<any[]>([])
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])

  const handleClearVideoError = () => {
    setVideoError(null)
  }

  const handleRemoveVideo = () => {
    setVideoError(null)
    setVideoPath(null)
    setAudioTracks([])
    setVideoDetails(null)
    setSelectedTrack(null)
    setSubtitleTracks([])
    setSelectedExtractTrackIndices([])
    setUserSelectedMode(false)
    setProgress(0)
    setStatusMessage('')
    setLastOutputDir(null)
    setLastOutputFile(null)
  }

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
  const [selectedExtractTrackIndices, setSelectedExtractTrackIndices] = useState<number[]>([])
  const [extractOutputDir, setExtractOutputDir] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [extractStatusMessage, setExtractStatusMessage] = useState('')
  const [extractCleanTags, setExtractCleanTags] = useState(true)

  // Step 1 & 2 (Translate Mode): Subtitle Translation State
  const [translateSubPath, setTranslateSubPath] = useState<string | null>(null)
  const [translateLanguage, setTranslateLanguage] = useState('si')
  const [translateFormat, setTranslateFormat] = useState<'srt' | 'vtt' | 'txt'>('srt')
  const [translateSubError, setTranslateSubError] = useState<string | null>(null)

  // Step 2 (Sync Mode): Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const subtitlesRef = React.useRef<SubtitleItem[]>([])
  const currentSubIndexRef = React.useRef(0)
  const syncCancelledRef = React.useRef(false)
  const generateCancelledRef = React.useRef(false)
  const extractCancelledRef = React.useRef(false)
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
    applyThemeToDocument(activeThemeDef, theme)
  }, [activeThemeDef, theme])

  const notifyJobComplete = (title: string, body: string) => {
    if (notificationsEnabled && window.api?.notification?.show) {
      window.api.notification.show(title, body)
    }
  }

  const handleSetTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme)
    window.api?.settings?.save({
      theme: newTheme,
      defaultMode,
      checkUpdates,
      autoDownloadUpdates,
      notificationsEnabled
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
        if (s.autoDownloadUpdates !== undefined) {
          setAutoDownloadUpdates(s.autoDownloadUpdates)
          autoDownloadUpdatesRef.current = s.autoDownloadUpdates
        }
        if (s.notificationsEnabled !== undefined) setNotificationsEnabled(s.notificationsEnabled)
        if (s.aiApiKey) setAiApiKey(s.aiApiKey)
        if (s.aiProvider && isValidAiProvider(s.aiProvider)) setAiProvider(s.aiProvider)
        if (s.aiModel) setAiModel(s.aiModel)
        if (s.aiPrompt) {
          if (!s.aiPrompt.includes('Background Sounds') && !s.aiPrompt.includes('SDH')) {
            setAiPrompt(DEFAULT_AI_PROMPT)
          } else {
            setAiPrompt(s.aiPrompt)
          }
        }
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

    // Non-blocking auto-check for updates on launch (runs after 2.5s)
    const startupTimer = setTimeout(() => {
      window.api?.settings?.load().then((s: any) => {
        const shouldCheck = s?.checkUpdates !== undefined ? s.checkUpdates : true
        if (shouldCheck && navigator.onLine) {
          handleCheckForAppUpdates(true, true)
        }
      })
    }, 2500)

    return () => clearTimeout(startupTimer)
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
          if (!generateCancelledRef.current) {
            setGenerateStatusMessage(event.message)
          }
        } else {
          if (!syncCancelledRef.current) {
            setStatusMessage(event.message)
          }
        }
      } else if (event.type === 'progress') {
        const filePct = typeof event.percent === 'number' ? event.percent : 0
        if (isGeneratingRef.current) {
          if (!generateCancelledRef.current) {
            setGenerateProgress(filePct)
            if (event.message) {
              setGenerateStatusMessage(event.message)
            }
          }
        } else {
          if (!syncCancelledRef.current) {
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
        }
      } else if (event.type === 'done') {
        if (event.success) {
          if (isGeneratingRef.current) {
            if (!generateCancelledRef.current) {
              setGenerateProgress(100)
              setGenerateStatusMessage('Subtitle generation complete!')
            }
          }
          if (!syncCancelledRef.current && !generateCancelledRef.current) {
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
          }
        } else {
          if (!syncCancelledRef.current && !generateCancelledRef.current) {
            setLogs((prev) => [...prev, '[ERROR] Synchronization pass failed.'])
          }
        }
      } else if (event.type === 'error') {
        if (!syncCancelledRef.current && !generateCancelledRef.current) {
          setLogs((prev) => [...prev, `[ERROR] ${event.message}`])
          setStatusMessage('Error occurred during sync.')
          setIsSyncing(false)
        }
      }
    })

    // Listen to extractor events
    const unsubExtract = window.api?.extractor?.onEvent
      ? window.api.extractor.onEvent((event: any) => {
          if (extractCancelledRef.current) return
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

  // Probe Video File with sanitization and validation
  const handleSelectVideo = async (rawPath: string) => {
    setVideoError(null)
    const cleanPath = cleanPathString(rawPath)
    if (!cleanPath) {
      const msg = 'Please select a valid file path.'
      setVideoError(msg)
      toast.error(msg)
      return
    }

    // 1. Direct synchronous format check: Subtitle file dropped on video
    if (isSubtitleFile(cleanPath)) {
      if (subtitleAction === 'translate') {
        handleSelectTranslateSubtitle(cleanPath)
        return
      }
      const fileName = getFileName(cleanPath)
      const msg = `"${fileName}" is a subtitle file, not a movie. Routed to Step 2 Subtitles instead!`
      toast(msg, { icon: '📝' })
      setLogs((prev) => [...prev, `[FILE] Subtitle dropped on video zone: routed "${fileName}" to Step 2`])
      handleAddSubtitles([cleanPath])
      return
    }

    // 2. Unsupported format check: Not a video format
    if (!isVideoFile(cleanPath)) {
      const msg = getUnsupportedFileMessage(cleanPath, 'video')
      const fileName = getFileName(cleanPath)
      setVideoError(msg)
      toast.error(msg)
      setLogs((prev) => [...prev, `[FILE] ⚠️ Unsupported video: ${msg}`])
      setStatusMessage(`Unsupported file: ${fileName}`)
      return
    }

    setVideoError(null)
    if (subtitleAction === 'translate') {
      setTranslateSubPath(null)
      setTranslateSubError(null)
    }
    setVideoPath(cleanPath)
    setUserSelectedMode(false)
    setProgress(0)
    setExtractProgress(0)
    setGenerateProgress(0)
    setExtractOutputDir(null)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setLogs((prev) => [...prev, `[MEDIA] Loading video: ${cleanPath}`])
    setStatusMessage('Probing video audio and subtitle tracks...')

    try {
      const res = await window.api.engine.probe(cleanPath)
      if (res) {
        const audio = res.tracks || []
        const details = res.details || null
        const subTracks = res.subtitleTracks || []
        const firstAudioIdx = audio.length > 0 ? audio[0].index : 0

        setAudioTracks(audio)
        setVideoDetails(details)
        setSubtitleTracks(subTracks)
        setSelectedTrack(firstAudioIdx)
        setSelectedExtractTrackIndices([])

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
            `[MEDIA] Detected ${audio.length} audio stream(s), ${
              subTracks.length
            } embedded subtitle track(s): ${subSummary}`
          ])
        } else {
          setLogs((prev) => [
            ...prev,
            `[MEDIA] Detected ${audio.length} audio stream(s), 0 embedded subtitle track(s). Duration: ${
              details?.duration || 'Unknown'
            }, FPS: ${details?.fps || 'Unknown'}`
          ])
        }
      }
    } catch (e: any) {
      setLogs((prev) => [...prev, `[ERROR] Probing failed: ${e.message}`])
    }
    setStatusMessage('Ready')
  }

  // Handle multi-file or single-file drop onto Step 1 Video
  const handleDropFilesOnVideo = async (rawPaths: string[]) => {
    if (!rawPaths || rawPaths.length === 0) return
    const cleanPaths = rawPaths.map(cleanPathString).filter(Boolean)
    if (cleanPaths.length === 0) return

    if (cleanPaths.length > 1 && window.api?.file?.validate) {
      const valResults = await window.api.file.validate(cleanPaths, 'any')
      const videoItems = valResults.filter((v) => v.category === 'video' && v.exists && v.isFile)
      const subItems = valResults.filter((v) => v.category === 'subtitle' && v.exists && v.isFile)

      if (videoItems.length > 0 && subItems.length > 0) {
        toast.success(`Loaded reference movie and ${subItems.length} subtitle file(s)!`, { icon: '🎯' })
        await handleSelectVideo(videoItems[0].cleanPath)
        await handleAddSubtitles(subItems.map((s) => s.cleanPath))
        return
      }
    }

    handleSelectVideo(cleanPaths[0])
  }

  // Browse video
  const handleBrowseVideo = async () => {
    handleClearVideoError()
    const file = await window.api.dialog.openVideo()
    if (file) {
      handleSelectVideo(file)
    }
  }

  // Handle Subtitles with sanitization, deduplication, and folder scanning
  const handleAddSubtitles = async (rawPaths: string[]) => {
    setSubtitleError(null)
    if (!rawPaths || rawPaths.length === 0) return
    const cleanPaths = rawPaths.map(cleanPathString).filter(Boolean)
    if (cleanPaths.length === 0) return

    // If folder dropped, expand directory subtitles via backend validate if available
    let expandedPaths = [...cleanPaths]
    if (window.api?.file?.validate) {
      try {
        const valResults = await window.api.file.validate(cleanPaths, 'subtitle')
        if (Array.isArray(valResults) && valResults.length > 0) {
          const dirItems = valResults.filter((v) => v.isDirectory && v.directorySubtitles && v.directorySubtitles.length > 0)
          if (dirItems.length > 0) {
            expandedPaths = []
            for (const v of valResults) {
              if (v.isDirectory && v.directorySubtitles && v.directorySubtitles.length > 0) {
                toast.success(`Found ${v.directorySubtitles.length} subtitle(s) in folder "${v.fileName}"!`)
                expandedPaths.push(...v.directorySubtitles)
              } else if (!v.isDirectory) {
                expandedPaths.push(v.cleanPath)
              }
            }
          }
        }
      } catch (e) {
        console.warn('Folder expansion check skipped:', e)
      }
    }

    const toProcess: string[] = []
    let skippedDuplicates = 0
    let skippedUnsupported = 0

    for (const p of expandedPaths) {
      // 1. Movie dropped on subtitle area: load into Step 1 or inform user
      if (isVideoFile(p)) {
        const fileName = getFileName(p)
        if (!videoPath) {
          toast.success(`Detected movie "${fileName}"! Loaded into Step 1.`, { icon: '🎬' })
          setLogs((prev) => [...prev, `[FILE] Movie dropped on subtitles: loaded "${fileName}" into Step 1`])
          handleSelectVideo(p)
        } else {
          const msg = `"${fileName}" is a video file. To change your reference movie, drop it into Step 1.`
          setSubtitleError(msg)
          toast(msg, { icon: 'ℹ️' })
          setLogs((prev) => [...prev, `[FILE] ℹ️ ${msg}`])
        }
        continue
      }

      // 2. Unsupported format check
      if (!isSubtitleFile(p)) {
        skippedUnsupported++
        const msg = getUnsupportedFileMessage(p, 'subtitle')
        setSubtitleError(msg)
        toast.error(msg)
        setLogs((prev) => [...prev, `[FILE] ⚠️ Unsupported subtitle: ${msg}`])
        continue
      }

      // 3. Deduplication check
      if (subtitles.some((s) => s.path === p) || toProcess.includes(p)) {
        skippedDuplicates++
        continue
      }

      toProcess.push(p)
    }

    if (skippedDuplicates > 0) {
      toast(`Skipped ${skippedDuplicates} duplicate subtitle(s).`, { icon: 'ℹ️' })
    }

    if (toProcess.length === 0) return

    setSubtitleError(null)
    const newItems: SubtitleItem[] = []
    for (const p of toProcess) {
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
    setUserSelectedMode(false)
    setProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setStatusMessage('Ready')
    setLogs((prev) => [...prev, `[SUBTITLES] Added ${newItems.length} subtitle file(s)`])
    toast.success(`Added ${newItems.length} subtitle file(s)!`, { icon: '📄' })
  }

  const handleBrowseSubtitles = async () => {
    setSubtitleError(null)
    const files = await window.api.dialog.openSubtitles()
    if (files && files.length > 0) {
      handleAddSubtitles(files)
    }
  }

  const handleRemoveSubtitle = (id: string) => {
    setUserSelectedMode(false)
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

  // Intelligent Recommender Trigger: automatically re-evaluates whenever video or subtitles change
  const subtitlePathsKey = subtitles.map((s) => s.path).join('|')

  useEffect(() => {
    if (videoPath && subtitles.length > 0) {
      const primarySub = subtitles[0].path
      window.api.engine.recommend(videoPath, primarySub).then((res: any) => {
        if (res) {
          setRecommendation(res)
          setRecommendedMode(res.mode)
          setRecommendedReason(res.hint || res.title)
          if (!userSelectedMode && res.mode) {
            setSyncMode(res.mode as SyncMode)
          }
          setLogs((prev) => [...prev, `[RECOMMENDER] Recommended mode: ${res.mode} - ${res.title}`])
        }
      })
    } else {
      setRecommendation(null)
      setRecommendedMode(null)
      setRecommendedReason(null)
    }
  }, [videoPath, subtitlePathsKey, userSelectedMode])

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
        syncCancelledRef.current = true
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
      setStatusMessage('Cancelled by user')
      return
    }

    setProgress(100)
    setIsSyncing(false)
    if (successCount === subtitles.length) {
      const msg = `All ${subtitles.length} subtitle(s) synchronized successfully!`
      setStatusMessage(msg)
      toast.success(msg, { duration: 4000 })
      notifyJobComplete('Subtitles Synchronized', msg)
    } else if (successCount > 0) {
      const msg = `Completed: ${successCount}/${subtitles.length} synchronized.`
      setStatusMessage(msg)
      toast.success(msg, { duration: 4000 })
      notifyJobComplete('Subtitles Synchronized', msg)
    } else {
      setStatusMessage('Synchronization failed.')
      toast.error('Synchronization failed. Please check logs or try another sync mode.', { duration: 4000 })
    }
  }

  const handleCancelSync = async () => {
    syncCancelledRef.current = true
    try {
      await window.api.engine.cancelSync()
    } catch {}
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
  }

  const handleCancelDownloadModel = async () => {
    if (window.api?.generator?.cancelDownload) {
      await window.api.generator.cancelDownload()
    }
    setIsDownloadingModel(false)
    setModelDownloadProgress(0)
    toast('Model download cancelled')
  }

  const handleSelectGenerateSubtitle = async (rawPath: string) => {
    setGenerateSubError(null)
    const clean = cleanPathString(rawPath)
    if (!clean) return

    if (!isSubtitleFile(clean)) {
      const msg = getUnsupportedFileMessage(clean, 'subtitle')
      setGenerateSubError(msg)
      toast.error(msg)
      setLogs((prev) => [...prev, `[FILE] ⚠️ Unsupported subtitle for translation: ${msg}`])
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
    setLogs((prev) => [...prev, `[SUBTITLE] Selected file for AI translation: ${clean}`])
  }

  const handleBrowseGenerateSubtitle = async () => {
    try {
      const files = await window.api.dialog.openSubtitles()
      if (files && files.length > 0) {
        handleSelectGenerateSubtitle(files[0])
      }
    } catch (e: any) {
      toast.error('Failed to open subtitle: ' + e?.message)
    }
  }

  const handleSelectTranslateSubtitle = (path: string) => {
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
      handleRemoveVideo()
    }
    toast.success(`Selected subtitle: ${getFileName(clean)}`)
    setLogs((prev) => [...prev, `[TRANSLATE] Selected subtitle file: ${clean}`])
  }

  const handleBrowseTranslateSubtitle = async () => {
    try {
      const files = await window.api.dialog.openSubtitles()
      if (files && files.length > 0) {
        handleSelectTranslateSubtitle(files[0])
      }
    } catch (e: any) {
      toast.error('Failed to open subtitle: ' + e?.message)
    }
  }

  const handleExtractAndTranslateSubtitle = async (track: SubtitleTrack) => {
    const vPath = videoPath
    if (!vPath) return

    if (!aiApiKey.trim()) {
      toast.error('Please enter your AI API Key in Settings to translate subtitles!', {
        duration: 5000,
        icon: '🔑'
      })
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
      return
    }

    if (!isOnline) {
      toast.error('Internet connection required for AI translation.', { icon: '📡' })
      return
    }

    setIsExtracting(true)
    setExtractStatusMessage(`Extracting Track #${track.index + 1} (${track.language.toUpperCase()})...`)
    setLogs((prev) => [
      ...prev,
      `[EXTRACT] Extracting embedded subtitle track #${track.index + 1} (${track.language.toUpperCase()}) temporarily for AI translation from ${vPath}`
    ])

    try {
      const res = await window.api.extractor.extractSingle({
        videoPath: vPath,
        track,
        isTemporary: true,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        setTranslateSubPath(res.outputPath)
        setTranslateLanguage('si')
        toast.success(`Track #${track.index + 1} selected! Ready for translation.`, { duration: 3500, icon: '✨' })
        setLogs((prev) => [...prev, `[AI TRANSLATION] Subtitle extracted to temporary file: ${res.outputPath}`])
      } else {
        toast.error(res.error || 'Failed to extract embedded subtitle track')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract embedded subtitle track')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleStartTranslate = async () => {
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
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
      return
    }

    setIsGenerating(true)
    setGenerateProgress(5)
    setGenerateStatusMessage('Starting AI subtitle translation...')
    setLastOutputDir(null)
    setLastOutputFile(null)

    setLogs((prev) => [
      ...prev,
      `=== Starting AI Subtitle Translation ===`,
      `Source Subtitle: ${translateSubPath}`,
      `Target Language: ${translateLanguage.toUpperCase()}`,
      `AI Provider: ${aiProvider.toUpperCase()} (${aiModel || 'default'})`
    ])

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
        customPrompt: aiPrompt
      })

      if (res?.success) {
        setGenerateProgress(100)
        setGenerateStatusMessage('AI subtitle translation complete!')
        toast.success('Subtitle translated successfully!', { duration: 4000 })
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
  }

  const handleExtractAndUseSubtitle = async (track: SubtitleTrack) => {
    const vPath = videoPath
    if (!vPath) return

    // Pre-check AI API Key if translating to Spoken Sinhala
    if (!aiApiKey.trim()) {
      toast.error('Please enter your AI API Key in Settings to translate subtitles into Spoken Sinhala!', {
        duration: 5000,
        icon: '🔑'
      })
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
      return
    }

    if (!navigator.onLine) {
      toast.error('Internet connection required for AI Spoken Sinhala translation.', { icon: '📡' })
      return
    }

    setIsExtracting(true)
    setExtractStatusMessage(`Extracting Track #${track.index + 1} (${track.language.toUpperCase()})...`)
    setLogs((prev) => [
      ...prev,
      `[EXTRACT] Extracting embedded subtitle track #${track.index + 1} (${track.language.toUpperCase()}) temporarily for AI translation from ${vPath}`
    ])

    try {
      const res = await window.api.extractor.extractSingle({
        videoPath: vPath,
        track,
        isTemporary: true,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        setGenerateConfig((prev) => ({
          ...prev,
          sourceType: 'subtitle',
          sourceSubPath: res.outputPath,
          deleteSourceAfter: true,
          language: 'si'
        }))
        setSubtitleAction('generate')
        toast.success(`Track #${track.index + 1} extracted! Starting AI Translation...`, { duration: 3000, icon: '🚀' })
        setLogs((prev) => [...prev, `[AI TRANSLATION] Subtitle extracted temporarily. Launching AI translation immediately...`])

        // Immediately start AI translation on the extracted track and clean up extracted track after finish!
        await handleStartGenerate({
          sourceType: 'subtitle',
          sourceSubPath: res.outputPath,
          deleteSourceAfter: true,
          language: 'si'
        })
      } else {
        toast.error(res.error || 'Failed to extract embedded subtitle track')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract embedded subtitle track')
    } finally {
      setIsExtracting(false)
    }
  }

  // Start Generate / Translate Execution
  const handleStartGenerate = async (overrideConfig?: Partial<GenerateConfig>) => {
    // Guard: Prevent React SyntheticEvent or MouseEvent (from onClick) from contaminating IPC payload
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
    if (effectiveConfig.language === 'si') {
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
        const modelCheck = await window.api.generator.checkModel(effectiveConfig.modelQuality)
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

    generateCancelledRef.current = false
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
      isSubtitleSource ? `Source Subtitle: ${effectiveConfig.sourceSubPath}` : `Movie: ${videoPath}`,
      !isSubtitleSource ? `Selected Audio Track: #${selectedTrack ?? 0}` : `Bypassing Whisper: Direct text translation mode`,
      `Target Language: ${effectiveConfig.language}`,
      !isSubtitleSource ? `Model Quality: ${effectiveConfig.modelQuality}` : `Model: Cloud AI (${aiModel || 'Auto'})`,
      `Output Format: .${effectiveConfig.format}`
    ])

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
        customPrompt: aiPrompt
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
        if (res.output) {
          const folder = res.output.substring(
            0,
            Math.max(res.output.lastIndexOf('/'), res.output.lastIndexOf('\\'))
          )
          setLastOutputDir(folder)
          setLastOutputFile(res.output)
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
      if (effectiveConfig.deleteSourceAfter) {
        setGenerateConfig((prev) => ({
          ...prev,
          sourceSubPath: null,
          deleteSourceAfter: false
        }))
      }
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
    generateCancelledRef.current = true
    try {
      await window.api.generator.cancelGenerate()
    } catch {}
    setIsGenerating(false)
    setGenerateProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setGenerateStatusMessage('Cancelled by user')
    toast('Subtitle generation cancelled', { icon: '⏹️', duration: 2500 })
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

    extractCancelledRef.current = false
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
        videoPath: videoPath,
        tracks: tracksToExtract,
        outputDir: extractOutputDir || undefined,
        cleanTags: extractCleanTags
      })

      if (res.cancelled) {
        setExtractProgress(0)
        setExtractStatusMessage('Extraction cancelled by user.')
        toast('Extraction cancelled', { icon: '⏹️' })
      } else if (res.success && res.extracted.length > 0) {
        const lastFile = res.extracted[res.extracted.length - 1].outputPath || ''
        setExtractProgress(100)
        setExtractStatusMessage(`Extracted ${res.extracted.length} subtitle file(s) successfully!`)
        toast.success(`Extracted ${res.extracted.length} subtitle(s) to .SRT!`, { duration: 4500 })
        notifyJobComplete(
          'Subtitle Extraction Complete',
          `Successfully extracted ${res.extracted.length} subtitle track(s) to .SRT!`
        )

        if (lastFile) {
          const folder = lastFile.substring(
            0,
            Math.max(lastFile.lastIndexOf('/'), lastFile.lastIndexOf('\\'))
          )
          setLastOutputDir(folder)
          setLastOutputFile(lastFile)
        }
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
        videoPath: videoPath,
        track,
        outputDir: extractOutputDir || undefined,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        const fileName = res.outputPath.split(/[/\\]/).pop() || 'subtitle.extracted.srt'
        setExtractProgress(100)
        setExtractStatusMessage(`Track #${track.index + 1} extracted successfully!`)
        toast.success(`Extracted to ${fileName}!`, { duration: 4000 })
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
    extractCancelledRef.current = true
    try {
      if (window.api?.extractor?.cancel) {
        await window.api.extractor.cancel()
      }
    } catch {}
    setIsExtracting(false)
    setExtractProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    setExtractStatusMessage('Extraction cancelled by user')
    toast('Extraction cancelled', { icon: '⏹️', duration: 2500 })
    setLogs((prev) => [...prev, '[USER] Subtitle extraction cancelled.'])
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
      autoDownloadUpdates,
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    })
  }

  const isUnlocked = Boolean(videoPath && subtitles.length > 0)

  return (
    <div
      className={`h-screen w-screen overflow-hidden ${activeThemeDef.canvasClass} ${isAnyModalOpen ? 'overflow-hidden max-h-screen' : ''} flex flex-col font-sans transition-colors duration-200`}
    >
      {/* Top Unified Header */}
      <Header
        currentAction={subtitleAction}
        onOpenSettings={() => {
          setSettingsInitialTab('general')
          setSettingsModalOpen(true)
        }}
        onOpenAbout={() => setAboutModalOpen(true)}
        isUpdateReady={isUpdateReady}
        onRestartToApplyUpdate={handleRestartToApply}
      />

      {/* Main Workspace: Left Sidebar + Right Content Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar Navigation */}
        <Sidebar
          currentAction={subtitleAction}
          onSelectAction={(action) => {
            setSubtitleAction(action)
            setLogs((prev) => [
              ...prev,
              `[WORKFLOW] Switched to: ${
                action === 'sync'
                  ? 'Synchronize Subtitle'
                  : action === 'extract'
                  ? 'Extract Subtitle'
                  : action === 'generate'
                  ? 'Generate Subtitle (Whisper AI)'
                  : 'Translate Subtitle (Cloud AI)'
              }`
            ])
          }}
          engineReady={engineReady}
          isOnline={isOnline}
        />

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          {/* Scrollable Middle Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <main className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto px-6 pt-6 pb-3.5 flex flex-col gap-5 flex-1">
            {/* Step 1: Reference Movie or Source Subtitle for Translation */}
        {subtitleAction === 'translate' ? (
          <Step1Translate
            sourceSubPath={translateSubPath}
            onSelectSubtitle={handleSelectTranslateSubtitle}
            onBrowseSubtitle={handleBrowseTranslateSubtitle}
            onRemoveSubtitle={() => {
              setTranslateSubPath(null)
              setTranslateSubError(null)
            }}
            errorMessage={translateSubError}
            onClearError={() => setTranslateSubError(null)}
            videoPath={videoPath}
            subtitleTracks={subtitleTracks}
            onExtractAndUseSubtitle={handleExtractAndTranslateSubtitle}
            isExtracting={isExtracting}
            onBrowseVideo={handleBrowseVideo}
            onSelectVideo={handleSelectVideo}
            onRemoveVideo={handleRemoveVideo}
          />
        ) : (
          <Step1Video
            videoPath={videoPath}
            videoDetails={videoDetails}
            audioTracks={audioTracks}
            selectedTrack={selectedTrack}
            subtitleTracks={subtitleTracks}
            errorMessage={videoError}
            onClearError={handleClearVideoError}
            onBrowse={handleBrowseVideo}
            onRemove={handleRemoveVideo}
            onSelectTrackModal={() => setAudioModalOpen(true)}
            onDropFile={(path) => handleSelectVideo(path)}
            onDropFiles={(paths) => handleDropFilesOnVideo(paths)}
          />
        )}

        {/* Step 2: Settings per Action */}
        {subtitleAction === 'sync' ? (
          <Step2Subtitles
            subtitles={subtitles}
            errorMessage={subtitleError}
            onClearError={() => setSubtitleError(null)}
            onBrowse={handleBrowseSubtitles}
            onRemove={handleRemoveSubtitle}
            onClearAll={() => {
              setSubtitleError(null)
              setSubtitles([])
              setUserSelectedMode(false)
              setProgress(0)
              setStatusMessage('')
              setLastOutputDir(null)
              setLastOutputFile(null)
            }}
            onDropFiles={(paths) => handleAddSubtitles(paths)}
          />
        ) : subtitleAction === 'extract' ? (
          <Step2Extract
            videoPath={videoPath}
            subtitleTracks={subtitleTracks}
            selectedTrackIndices={selectedExtractTrackIndices}
            onToggleTrack={handleToggleExtractTrack}
            onSelectAllTracks={handleSelectAllExtractTracks}
            onDeselectAllTracks={handleDeselectAllExtractTracks}
            onExtractSingleNow={handleExtractSingleNow}
            onRescan={() => videoPath && handleSelectVideo(videoPath)}
            onSwitchToGenerate={() => setSubtitleAction('generate')}
            isExtracting={isExtracting}
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
            isGenerating={isGenerating}
            subtitleTracks={subtitleTracks}
            onSwitchToTranslate={() => setSubtitleAction('translate')}
          />
        ) : (
          <Step2Translate
            language={translateLanguage}
            onChangeLanguage={setTranslateLanguage}
            format={translateFormat}
            onChangeFormat={setTranslateFormat}
            aiApiKey={aiApiKey}
            aiProvider={aiProvider}
            aiModel={aiModel}
            onOpenSettings={() => {
              setSettingsInitialTab('ai')
              setSettingsModalOpen(true)
            }}
            isOnline={isOnline}
          />
        )}

        {/* Step 3: Action Execution (Always visible, unlocked when ready, grayed out when locked) */}
        {subtitleAction === 'sync' ? (
          <Step3Sync
            unlocked={Boolean(videoPath && subtitles.length > 0)}
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
        ) : subtitleAction === 'extract' ? (
          <Step3Extract
            unlocked={Boolean(videoPath && subtitleTracks.length > 0 && selectedExtractTrackIndices.length > 0)}
            isExtracting={isExtracting}
            selectedCount={selectedExtractTrackIndices.length}
            progress={extractProgress}
            statusMessage={extractStatusMessage}
            lastOutputDir={lastOutputDir}
            cleanTags={extractCleanTags}
            setCleanTags={setExtractCleanTags}
            onStartExtract={handleStartExtract}
            onCancelExtract={handleCancelExtract}
            onOpenFolder={handleOpenFolder}
            videoPath={videoPath}
            outputDir={extractOutputDir}
            onChangeOutputDir={handleChangeExtractOutputDir}
          />
        ) : subtitleAction === 'generate' ? (
          <Step3Generate
            unlocked={Boolean(videoPath)}
            isGenerating={isGenerating}
            config={generateConfig}
            selectedTrack={selectedTrack}
            progress={generateProgress}
            statusMessage={generateStatusMessage}
            lastOutputDir={lastOutputDir}
            onStartGenerate={() => handleStartGenerate()}
            onCancelGenerate={handleCancelGenerate}
            onOpenFolder={handleOpenFolder}
          />
        ) : (
          <Step3Translate
            unlocked={Boolean(translateSubPath)}
            isTranslating={isGenerating}
            sourceSubPath={translateSubPath}
            language={translateLanguage}
            aiProvider={aiProvider}
            aiModel={aiModel}
            format={translateFormat}
            progress={generateProgress}
            statusMessage={generateStatusMessage}
            lastOutputDir={lastOutputDir}
            onStartTranslate={handleStartTranslate}
            onCancelTranslate={handleCancelGenerate}
            onOpenFolder={handleOpenFolder}
          />
        )}

        {/* Live Activity Console */}
        <div className="!mt-auto pt-2 pb-1" style={{ marginTop: 'auto' }}>
          <ActivityConsole logs={logs} onClear={() => setLogs([])} isSyncing={isSyncing || isGenerating || isExtracting} />
        </div>
      </main>
    </div>
  </div>
</div>

      {/* ---------------- FOOTER (Full screen width, completely across whole app) ---------------- */}
      <Footer />

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
        autoDownloadUpdates={autoDownloadUpdates}
        setAutoDownloadUpdates={setAutoDownloadUpdates}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
        aiApiKey={aiApiKey}
        setAiApiKey={setAiApiKey}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        aiModel={aiModel}
        setAiModel={setAiModel}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        onSave={handleSaveSettings}
        onOpenUpdateModal={(info) => {
          setAppUpdateInfo(info)
          setUpdateModalOpen(true)
        }}
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

      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={appUpdateInfo}
        isDownloading={isDownloadingUpdate}
        downloadProgress={updateDownloadProgress}
        downloadSpeed={updateDownloadSpeed}
        downloadedBytes={updateDownloadedBytes}
        totalBytes={updateTotalBytes}
        isUpdateReady={isUpdateReady}
        onRestartToApply={handleRestartToApply}
        onRestartLater={handleRestartLater}
        errorMessage={updateErrorMessage}
        onDownloadAndInstall={handleDownloadAndInstallUpdate}
        onCancelDownload={handleCancelUpdateDownload}
      />

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1E293B',
            color: '#F8FAFC',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
          },
          success: {
            duration: 3500,
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFFFF'
            }
          },
          error: {
            duration: 4000,
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
