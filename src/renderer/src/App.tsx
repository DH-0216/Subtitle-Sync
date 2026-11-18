import React, { useState, useEffect, useCallback, useRef } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Sidebar } from './components/Sidebar'
import { SubtitleAction } from './components/SubtitleModeSelector'
import { SyncView, ExtractView, TranslateView, GenerateView, BatchView } from './views'
import { ActivityConsole, LogEntry, LogCategory } from './components/ActivityConsole'
import { AudioTrackModal } from './components/AudioTrackModal'
import { SettingsModal } from './components/SettingsModal'
import { AboutModal } from './components/AboutModal'
import { ModelDownloadModal } from './components/ModelDownloadModal'
import { UpdateModal } from './components/UpdateModal'
import { isValidAiProvider } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'
import { cleanPathString } from '@shared/fileSanitizer'
import { ThemeMode } from './theme'
import {
  useThemePreferences,
  useAppUpdater,
  useVideoMedia,
  useSyncWorkflow,
  useExtractWorkflow,
  useGenerateWorkflow,
  useTranslateWorkflow,
  useBatchWorkflow
} from './hooks'

export type { ThemeMode }

export default function App() {
  // Modals & Mode
  const [subtitleAction, setSubtitleAction] = useState<SubtitleAction>('sync')
  const subtitleActionRef = useRef<SubtitleAction>('sync')
  useEffect(() => {
    subtitleActionRef.current = subtitleAction
  }, [subtitleAction])

  // Activity Console Logs & Status (Categorized by active workflow)
  const logIdCounter = useRef(0)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const addLog = useCallback((text: string, category: LogCategory = 'system') => {
    setLogs((prev) => [...prev, { id: ++logIdCounter.current, text, category }])
  }, [])

  const addSyncLog = useCallback((msg: string) => addLog(msg, 'sync'), [addLog])
  const addExtractLog = useCallback((msg: string) => addLog(msg, 'extract'), [addLog])
  const addTranslateLog = useCallback((msg: string) => addLog(msg, 'translate'), [addLog])
  const addGenerateLog = useCallback((msg: string) => addLog(msg, 'generate'), [addLog])
  const addBatchLog = useCallback((msg: string) => addLog(msg, 'batch'), [addLog])
  const addVideoLog = useCallback((msg: string) => addLog(msg, subtitleActionRef.current), [addLog])

  const handleClearLogs = useCallback((category?: SubtitleAction | 'all') => {
    if (!category || category === 'all') {
      setLogs([])
    } else {
      setLogs((prev) => prev.filter((l) => l.category !== category))
    }
  }, [])

  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'ai'>('general')
  const [aboutModalOpen, setAboutModalOpen] = useState(false)
  const [engineReady, setEngineReady] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [defaultSubtitleFormat, setDefaultSubtitleFormat] = useState<'srt' | 'vtt' | 'txt'>('srt')

  // 1. Theme & Settings Hook
  const {
    theme,
    setTheme,
    activeThemeDef,
    defaultMode,
    setDefaultMode,
    checkUpdates,
    setCheckUpdates,
    notificationsEnabled,
    setNotificationsEnabled,
    aiApiKey,
    setAiApiKey,
    aiProvider,
    setAiProvider,
    aiModel,
    setAiModel,
    aiPrompt,
    setAiPrompt,
    aiPromptsByLang,
    setAiPromptsByLang,
    notifyJobComplete,
    handleSetTheme,
    handleSaveSettings
  } = useThemePreferences()

  // 2. In-App Updater Hook
  const updater = useAppUpdater({ notifyJobComplete, addLog: (m) => addLog(m, 'system') })

  // 3. Video & Media Hook
  const video = useVideoMedia({
    subtitleAction,
    addLog: addVideoLog,
    setStatusMessage: (msg) => sync.setStatusMessage(msg),
    onSubtitleDropped: (paths) => sync.handleAddSubtitles(paths),
    onTranslateSubtitleDropped: (path) => translate.handleSelectTranslateSubtitle(path),
    onVideoReset: () => {
      sync.resetSyncState()
      extract.setSelectedExtractTrackIndices([])
      generate.setGenerateProgress(0)
      extract.setExtractProgress(0)
    }
  })

  // 4. Sync Workflow Hook
  const sync = useSyncWorkflow({
    videoPath: video.videoPath,
    selectedTrack: video.selectedTrack,
    onVideoSelect: (p) => video.handleSelectVideo(p),
    addLog: addSyncLog,
    notifyJobComplete
  })

  // 6. Extract Workflow Hook
  const extract = useExtractWorkflow({
    videoPath: video.videoPath,
    subtitleTracks: video.subtitleTracks,
    addLog: addExtractLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
    },
    onOutputClear: () => {
      sync.setLastOutputFile(null)
      sync.setLastOutputDir(null)
    }
  })

  // 7. Generate Workflow Hook
  const generate = useGenerateWorkflow({
    videoPath: video.videoPath,
    videoDetails: video.videoDetails,
    audioTracks: video.audioTracks,
    selectedTrack: video.selectedTrack,
    aiApiKey,
    aiProvider,
    aiModel,
    aiPrompt,
    aiPromptsByLang,
    onOpenSettingsAiTab: () => {
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
    },
    addLog: addGenerateLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
    },
    onOutputClear: () => {
      sync.setLastOutputFile(null)
      sync.setLastOutputDir(null)
    }
  })

  // 8. Translate Workflow Hook
  const translate = useTranslateWorkflow({
    videoPath: video.videoPath,
    isOnline,
    aiApiKey,
    aiProvider,
    aiModel,
    aiPrompt,
    aiPromptsByLang,
    extractCleanTags: extract.extractCleanTags,
    onOpenSettingsAiTab: () => {
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
    },
    onRemoveVideo: () => video.handleRemoveVideo(),
    setIsExtracting: extract.setIsExtracting,
    setExtractStatusMessage: extract.setExtractStatusMessage,
    addLog: addTranslateLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
    }
  })

  // 9. Batch Process Workflow Hook
  const batch = useBatchWorkflow({
    aiApiKey,
    aiProvider,
    aiModel,
    aiPrompt,
    aiPromptsByLang,
    addLog: addBatchLog,
    notifyJobComplete,
    onOpenSettingsAiTab: () => {
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
    }
  })

  // Online / Offline Listeners
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

  // Global Drag & Drop browser navigation guard
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

  // Check Engine Binaries and Initial Settings
  useEffect(() => {
    window.api?.settings?.load().then((s: any) => {
      if (s) {
        if (s.theme) {
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('app_theme', s.theme)
            }
          } catch {}
          setTheme(s.theme)
        }
        if (s.defaultMode) {
          setDefaultMode(s.defaultMode)
          sync.setSyncMode(s.defaultMode)
        }
        if (s.checkUpdates !== undefined) setCheckUpdates(s.checkUpdates)
        if (s.autoDownloadUpdates !== undefined) updater.setAutoDownloadUpdates(s.autoDownloadUpdates)
        if (s.notificationsEnabled !== undefined) setNotificationsEnabled(s.notificationsEnabled)
        if (s.defaultSubtitleFormat) {
          setDefaultSubtitleFormat(s.defaultSubtitleFormat)
          const whisperFormat = s.defaultSubtitleFormat === 'txt' ? 'srt' : s.defaultSubtitleFormat
          generate.setGenerateConfig((prev) => ({ ...prev, format: whisperFormat }))
          translate.setTranslateFormat(s.defaultSubtitleFormat)
          batch.setGenerateFormat(whisperFormat)
          batch.setTranslateFormat(s.defaultSubtitleFormat)
        }
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
        if (s.aiPromptsByLang && typeof s.aiPromptsByLang === 'object') {
          setAiPromptsByLang(s.aiPromptsByLang)
        }
      }
    })

    window.api?.engine?.checkBinaries().then((res: any) => {
      if (res) {
        const isReady = res.ffmpegReady && res.ffsubsyncReady && res.whisperReady
        setEngineReady(isReady)
        if (isReady) {
          addLog(`[ENGINE] FFmpeg detected: ${res.ffmpegPath}`)
          addLog(`[ENGINE] ffsubsync detected: ${res.ffsubsyncPath}`)
          addLog(`[ENGINE] Whisper AI detected: ${res.whisperPath}`)
        } else {
          if (!res.ffmpegReady) addLog('[WARNING] ffmpeg.exe missing from bin/ folder.')
          if (!res.ffsubsyncReady) addLog('[WARNING] ffsubsync.exe missing from bin/ folder.')
          if (!res.whisperReady) addLog('[WARNING] whisper.exe missing from bin/ folder.')
        }
      }
    })

    const startupTimer = setTimeout(() => {
      window.api?.settings?.load().then((s: any) => {
        const shouldCheck = s?.checkUpdates !== undefined ? s.checkUpdates : true
        if (shouldCheck && navigator.onLine) {
          updater.handleCheckForAppUpdates(true, true)
        }
      })
    }, 2500)

    return () => clearTimeout(startupTimer)
  }, [])

  // Initial Whisper model catalog load
  useEffect(() => {
    generate.loadWhisperModels(false)
  }, [generate.loadWhisperModels])

  // Global Engine Event Listener (logs, status, progress)
  const engineHandlersRef = React.useRef({ generate, translate, sync, batch, addLog })
  engineHandlersRef.current = { generate, translate, sync, batch, addLog }

  useEffect(() => {
    if (!window.api?.engine?.onEvent) return
    const unsub = window.api.engine.onEvent((event: any) => {
      const { generate: gen, translate: trans, sync: snc, batch: btc, addLog: log } = engineHandlersRef.current
      if (btc.isProcessing) {
        btc.handleEngineEvent(event)
      }
      if (event.type === 'log') {
        const cat: LogCategory =
          subtitleActionRef.current === 'batch' ? 'batch' :
          event.job === 'translate' ? 'translate' :
          event.job === 'generate' ? 'generate' :
          event.job === 'sync' ? 'sync' :
          subtitleActionRef.current
        log(event.message, cat)
      } else if (event.type === 'status') {
        if (event.job === 'translate') {
          if (!trans.translateCancelledRef.current) {
            trans.setTranslateStatusMessage(event.message)
          }
        } else if (event.job === 'generate') {
          if (!gen.generateCancelledRef.current) {
            gen.setGenerateStatusMessage(event.message)
          }
        } else if (event.job === 'sync') {
          if (!snc.syncCancelledRef.current) {
            snc.setStatusMessage(event.message)
          }
        } else {
          if (trans.isTranslatingRef.current && !gen.isGeneratingRef.current) {
            trans.setTranslateStatusMessage(event.message)
          } else if (gen.isGeneratingRef.current && !trans.isTranslatingRef.current) {
            gen.setGenerateStatusMessage(event.message)
          } else {
            snc.setStatusMessage(event.message)
          }
        }
      } else if (event.type === 'progress') {
        const filePct = typeof event.percent === 'number' ? event.percent : 0
        if (event.job === 'translate') {
          if (!trans.translateCancelledRef.current) {
            trans.setTranslateProgress(filePct)
            if (event.message) trans.setTranslateStatusMessage(event.message)
          }
        } else if (event.job === 'generate') {
          if (!gen.generateCancelledRef.current) {
            gen.setGenerateProgress(filePct)
            if (event.message) gen.setGenerateStatusMessage(event.message)
          }
        } else if (event.job === 'sync') {
          if (!snc.syncCancelledRef.current) {
            snc.setProgress(filePct)
            if (event.message) snc.setStatusMessage(event.message)
          }
        } else {
          if (trans.isTranslatingRef.current && !gen.isGeneratingRef.current) {
            trans.setTranslateProgress(filePct)
            if (event.message) trans.setTranslateStatusMessage(event.message)
          } else if (gen.isGeneratingRef.current && !trans.isTranslatingRef.current) {
            gen.setGenerateProgress(filePct)
            if (event.message) gen.setGenerateStatusMessage(event.message)
          } else {
            snc.setProgress(filePct)
            if (event.message) snc.setStatusMessage(event.message)
          }
        }
      }
    })
    return () => unsub()
  }, [])

  // Open containing folder or highlight destination file
  const handleOpenFolder = useCallback(
    async (explicitPath?: string) => {
      const candidateList: (string | null | undefined)[] = [explicitPath]

      // Add workflow fallbacks in priority order
      candidateList.push(
        batch.lastBatchOutputDir,
        extract.extractOutputDir,
        sync.lastOutputFile,
        sync.lastOutputDir,
        sync.subtitles[0]?.path,
        video.videoPath
      )

      for (const target of candidateList) {
        if (target && typeof target === 'string' && target.trim()) {
          const clean = cleanPathString(target)
          if (clean) {
            try {
              if (window.api?.shell?.showItemInFolder) {
                const opened = await window.api.shell.showItemInFolder(clean)
                if (opened) return
              }
              if (window.api?.shell?.openPath) {
                const opened = await window.api.shell.openPath(clean)
                if (opened) return
              }
            } catch (err) {
              console.warn('Failed to open path:', err)
            }
          }
        }
      }

      toast.error('Could not locate destination file or folder.')
    },
    [
      batch.lastBatchOutputDir,
      extract.extractOutputDir,
      sync.lastOutputFile,
      sync.lastOutputDir,
      sync.subtitles,
      video.videoPath
    ]
  )

  const isAnyModalOpen =
    audioModalOpen ||
    settingsModalOpen ||
    aboutModalOpen ||
    generate.downloadModalOpen ||
    updater.updateModalOpen

  return (
    <div
      className={`h-screen w-screen overflow-hidden ${activeThemeDef.canvasClass} ${isAnyModalOpen ? 'overflow-hidden max-h-screen' : ''} flex flex-col font-sans transition-colors duration-200`}
    >
      {/* Header */}
      <Header
        currentAction={subtitleAction}
        onOpenSettings={() => {
          setSettingsInitialTab('general')
          setSettingsModalOpen(true)
        }}
        onOpenAbout={() => setAboutModalOpen(true)}
        isUpdateReady={updater.isUpdateReady}
        onRestartToApplyUpdate={updater.handleRestartToApply}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          currentAction={subtitleAction}
          onSelectAction={(action) => {
            setSubtitleAction(action)
            addLog(
              `[WORKFLOW] Switched to: ${
                action === 'sync'
                  ? 'Synchronize Subtitle'
                  : action === 'extract'
                  ? 'Extract Subtitle'
                  : action === 'generate'
                  ? 'Generate Subtitle (Whisper AI)'
                  : action === 'translate'
                  ? 'Translate Subtitle (Cloud AI)'
                  : 'Batch Process'
              }`
            )
          }}
          engineReady={engineReady}
          isOnline={isOnline}
        />

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <main className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto px-6 pt-6 pb-3.5 flex flex-col gap-5 flex-1">
              {subtitleAction === 'sync' && (
                <SyncView
                  videoPath={video.videoPath}
                  videoDetails={video.videoDetails}
                  audioTracks={video.audioTracks}
                  selectedTrack={video.selectedTrack}
                  subtitleTracks={video.subtitleTracks}
                  videoError={video.videoError}
                  onClearVideoError={video.handleClearVideoError}
                  onBrowseVideo={video.handleBrowseVideo}
                  onRemoveVideo={video.handleRemoveVideo}
                  onSelectTrackModal={() => setAudioModalOpen(true)}
                  onSelectVideo={video.handleSelectVideo}
                  onDropFilesOnVideo={video.handleDropFilesOnVideo}
                  subtitles={sync.subtitles}
                  subtitleError={sync.subtitleError}
                  onClearSubtitleError={sync.handleClearSubtitleError}
                  onBrowseSubtitles={sync.handleBrowseSubtitles}
                  onRemoveSubtitle={sync.handleRemoveSubtitle}
                  onClearAllSubtitles={() => {
                    sync.setSubtitleError(null)
                    sync.setSubtitles([])
                    sync.resetSyncState()
                  }}
                  onAddSubtitles={sync.handleAddSubtitles}
                  isSyncing={sync.isSyncing}
                  syncMode={sync.syncMode}
                  setSyncMode={sync.handleSetSyncMode}
                  recommendation={sync.recommendation}
                  userSelectedMode={sync.userSelectedMode}
                  recommendedMode={sync.recommendedMode}
                  recommendedReason={sync.recommendedReason}
                  progress={sync.progress}
                  statusMessage={sync.statusMessage}
                  lastOutputDir={sync.lastOutputDir}
                  onStartSync={sync.handleStartSync}
                  onCancelSync={sync.handleCancelSync}
                  onOpenFolder={handleOpenFolder}
                />
              )}

              {subtitleAction === 'extract' && (
                <ExtractView
                  videoPath={video.videoPath}
                  videoDetails={video.videoDetails}
                  audioTracks={video.audioTracks}
                  selectedTrack={video.selectedTrack}
                  subtitleTracks={video.subtitleTracks}
                  videoError={video.videoError}
                  onClearVideoError={video.handleClearVideoError}
                  onBrowseVideo={video.handleBrowseVideo}
                  onRemoveVideo={video.handleRemoveVideo}
                  onSelectTrackModal={() => setAudioModalOpen(true)}
                  onSelectVideo={video.handleSelectVideo}
                  onDropFilesOnVideo={video.handleDropFilesOnVideo}
                  selectedExtractTrackIndices={extract.selectedExtractTrackIndices}
                  onToggleExtractTrack={(idx) =>
                    extract.setSelectedExtractTrackIndices((prev) =>
                      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                    )
                  }
                  onSelectAllExtractTracks={() => {
                    const textTracks = video.subtitleTracks.filter((t) => t.isText)
                    extract.setSelectedExtractTrackIndices(textTracks.map((t) => t.index))
                  }}
                  onDeselectAllExtractTracks={() => extract.setSelectedExtractTrackIndices([])}
                  onExtractSingleNow={extract.handleExtractSingleNow}
                  onRescan={() => video.videoPath && video.handleSelectVideo(video.videoPath)}
                  onSwitchToGenerate={() => setSubtitleAction('generate')}
                  isExtracting={extract.isExtracting}
                  extractProgress={extract.extractProgress}
                  extractStatusMessage={extract.extractStatusMessage}
                  lastOutputDir={sync.lastOutputDir}
                  extractCleanTags={extract.extractCleanTags}
                  setExtractCleanTags={extract.setExtractCleanTags}
                  onStartExtract={extract.handleStartExtract}
                  onCancelExtract={extract.handleCancelExtract}
                  onOpenFolder={handleOpenFolder}
                  extractOutputDir={extract.extractOutputDir}
                  onChangeExtractOutputDir={extract.handleSelectOutputDir}
                />
              )}

              {subtitleAction === 'translate' && (
                <TranslateView
                  translateSubPath={translate.translateSubPath}
                  onSelectTranslateSubtitle={translate.handleSelectTranslateSubtitle}
                  onBrowseTranslateSubtitle={translate.handleBrowseTranslateSubtitle}
                  onRemoveTranslateSubtitle={() => {
                    translate.setTranslateSubPath(null)
                    translate.setTranslateSubError(null)
                  }}
                  translateSubError={translate.translateSubError}
                  onClearTranslateSubError={() => translate.setTranslateSubError(null)}
                  videoPath={video.videoPath}
                  subtitleTracks={video.subtitleTracks}
                  onExtractAndTranslateSubtitle={translate.handleExtractAndTranslateSubtitle}
                  isExtracting={extract.isExtracting}
                  onBrowseVideo={async () => {
                    video.handleClearVideoError()
                    const file = await window.api.dialog.openVideo()
                    if (file) {
                      translate.setTranslateSubPath(null)
                      translate.setTranslateSubError(null)
                      video.handleSelectVideo(file)
                    }
                  }}
                  onSelectVideo={(path) => {
                    translate.setTranslateSubPath(null)
                    translate.setTranslateSubError(null)
                    video.handleSelectVideo(path)
                  }}
                  onRemoveVideo={video.handleRemoveVideo}
                  translateLanguage={translate.translateLanguage}
                  onChangeLanguage={translate.setTranslateLanguage}
                  translateFormat={translate.translateFormat}
                  onChangeFormat={translate.setTranslateFormat}
                  aiApiKey={aiApiKey}
                  aiProvider={aiProvider}
                  aiModel={aiModel}
                  onOpenSettings={() => {
                    setSettingsInitialTab('ai')
                    setSettingsModalOpen(true)
                  }}
                  isOnline={isOnline}
                  isTranslating={translate.isTranslating}
                  translateProgress={translate.translateProgress}
                  translateStatusMessage={translate.translateStatusMessage}
                  lastOutputDir={sync.lastOutputDir}
                  onStartTranslateSubtitle={translate.handleStartTranslate}
                  onCancelTranslate={translate.handleCancelTranslate}
                  onOpenFolder={handleOpenFolder}
                />
              )}

              {subtitleAction === 'generate' && (
                <GenerateView
                  videoPath={video.videoPath}
                  videoDetails={video.videoDetails}
                  audioTracks={video.audioTracks}
                  selectedTrack={video.selectedTrack}
                  subtitleTracks={video.subtitleTracks}
                  videoError={video.videoError}
                  onClearVideoError={video.handleClearVideoError}
                  onBrowseVideo={video.handleBrowseVideo}
                  onRemoveVideo={video.handleRemoveVideo}
                  onSelectTrackModal={() => setAudioModalOpen(true)}
                  onSelectVideo={video.handleSelectVideo}
                  onDropFilesOnVideo={video.handleDropFilesOnVideo}
                  onSelectTrack={(idx) => {
                    video.setSelectedTrack(idx)
                    addGenerateLog(`[AUDIO] Selected track #${idx} for subtitle generation`)
                  }}
                  generateConfig={generate.generateConfig}
                  onChangeGenerateConfig={(newCfg) =>
                    generate.setGenerateConfig((prev) => ({ ...prev, ...newCfg }))
                  }
                  isOnline={isOnline}
                  whisperModels={generate.whisperModels}
                  isLoadingWhisperModels={generate.isLoadingWhisperModels}
                  onRefreshWhisperModels={() => generate.loadWhisperModels(true)}
                  whisperModelsSource={generate.whisperModelsSource}
                  isGenerating={generate.isGenerating}
                  onSwitchToTranslate={() => setSubtitleAction('translate')}
                  generateProgress={generate.generateProgress}
                  generateStatusMessage={generate.generateStatusMessage}
                  lastOutputDir={sync.lastOutputDir}
                  onStartGenerate={() => generate.handleStartGenerate()}
                  onCancelGenerate={generate.handleCancelGenerate}
                  onOpenFolder={handleOpenFolder}
                />
              )}

              {subtitleAction === 'batch' && (
                <BatchView
                  batchMode={batch.batchMode}
                  setBatchMode={batch.setBatchMode}
                  items={batch.items}
                  isProcessing={batch.isProcessing}
                  overallProgress={batch.overallProgress}
                  activeItemId={batch.activeItemId}
                  syncMode={batch.syncMode}
                  setSyncMode={batch.setSyncMode}
                  whisperModelQuality={batch.whisperModelQuality}
                  setWhisperModelQuality={batch.setWhisperModelQuality}
                  generateLanguage={batch.generateLanguage}
                  setGenerateLanguage={batch.setGenerateLanguage}
                  generateFormat={batch.generateFormat}
                  setGenerateFormat={batch.setGenerateFormat}
                  translateLanguage={batch.translateLanguage}
                  setTranslateLanguage={batch.setTranslateLanguage}
                  translateFormat={batch.translateFormat}
                  setTranslateFormat={batch.setTranslateFormat}
                  translateSource={batch.translateSource}
                  setTranslateSource={batch.setTranslateSource}
                  preferredTrackLang={batch.preferredTrackLang}
                  setPreferredTrackLang={batch.setPreferredTrackLang}
                  extractTrackOption={batch.extractTrackOption}
                  setExtractTrackOption={batch.setExtractTrackOption}
                  extractCleanTags={batch.extractCleanTags}
                  setExtractCleanTags={batch.setExtractCleanTags}
                  availableWhisperModels={generate.whisperModels}
                  aiApiKey={aiApiKey}
                  aiProvider={aiProvider}
                  aiModel={aiModel}
                  onOpenSettingsAiTab={() => {
                    setSettingsInitialTab('ai')
                    setSettingsModalOpen(true)
                  }}
                  lastBatchOutputDir={batch.lastBatchOutputDir}
                  onAddFiles={batch.handleAddFiles}
                  onAddFolder={batch.handleAddFolder}
                  onDropFiles={batch.handleDropFiles}
                  onAssignSubtitle={batch.handleAssignSubtitle}
                  onRemoveItem={batch.handleRemoveItem}
                  onClearCompleted={batch.handleClearCompleted}
                  onClearAll={batch.handleClearAll}
                  onRetryItem={batch.handleRetryItem}
                  onStartBatch={batch.handleStartBatch}
                  onStopBatch={batch.handleStopBatch}
                  onOpenFolder={handleOpenFolder}
                />
              )}

              {/* Console */}
              <div className="!mt-auto pt-2 pb-1" style={{ marginTop: 'auto' }}>
                <ActivityConsole
                  logs={logs}
                  currentAction={subtitleAction}
                  onClear={handleClearLogs}
                  isSyncing={
                    sync.isSyncing ||
                    generate.isGenerating ||
                    extract.isExtracting ||
                    translate.isTranslating ||
                    batch.isProcessing
                  }
                />
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <AudioTrackModal
        isOpen={audioModalOpen}
        onClose={() => setAudioModalOpen(false)}
        tracks={video.audioTracks}
        selectedTrack={video.selectedTrack}
        onSelectTrack={(idx) => {
          video.setSelectedTrack(idx)
          addSyncLog(`[AUDIO] Selected audio reference track #${idx}`)
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
        autoDownloadUpdates={updater.autoDownloadUpdates}
        setAutoDownloadUpdates={updater.setAutoDownloadUpdates}
        notificationsEnabled={notificationsEnabled}
        setNotificationsEnabled={setNotificationsEnabled}
        defaultSubtitleFormat={defaultSubtitleFormat}
        setDefaultSubtitleFormat={(fmt) => {
          setDefaultSubtitleFormat(fmt)
          const whisperFormat = fmt === 'txt' ? 'srt' : fmt
          generate.setGenerateConfig((prev) => ({ ...prev, format: whisperFormat }))
          translate.setTranslateFormat(fmt)
          batch.setGenerateFormat(whisperFormat)
          batch.setTranslateFormat(fmt)
        }}
        aiApiKey={aiApiKey}
        setAiApiKey={setAiApiKey}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        aiModel={aiModel}
        setAiModel={setAiModel}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiPromptsByLang={aiPromptsByLang}
        setAiPromptsByLang={setAiPromptsByLang}
        onSave={() => handleSaveSettings(updater.autoDownloadUpdates)}
        onOpenUpdateModal={(info) => {
          updater.setAppUpdateInfo(info)
          updater.setUpdateModalOpen(true)
        }}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

      <ModelDownloadModal
        isOpen={generate.downloadModalOpen}
        onClose={() => generate.setDownloadModalOpen(false)}
        modelQuality={generate.generateConfig.modelQuality}
        modelInfo={generate.whisperModels.find((m) => m.id === generate.generateConfig.modelQuality)}
        isDownloading={generate.isDownloadingModel}
        downloadProgress={generate.modelDownloadProgress}
        downloadSpeed={generate.modelDownloadSpeed}
        downloadedBytes={generate.modelDownloadedBytes}
        totalBytes={generate.modelTotalBytes}
        errorMessage={generate.modelDownloadError}
        onStartDownload={generate.handleStartDownloadModel}
        onCancelDownload={generate.handleCancelDownloadModel}
      />

      <UpdateModal
        isOpen={updater.updateModalOpen}
        onClose={() => updater.setUpdateModalOpen(false)}
        updateInfo={updater.appUpdateInfo}
        isDownloading={updater.isDownloadingUpdate}
        downloadProgress={updater.updateDownloadProgress}
        downloadSpeed={updater.updateDownloadSpeed}
        downloadedBytes={updater.updateDownloadedBytes}
        totalBytes={updater.updateTotalBytes}
        isUpdateReady={updater.isUpdateReady}
        onRestartToApply={updater.handleRestartToApply}
        onRestartLater={updater.handleRestartLater}
        errorMessage={updater.updateErrorMessage}
        onDownloadAndInstall={updater.handleDownloadAndInstallUpdate}
        onCancelDownload={updater.handleCancelUpdateDownload}
      />

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
