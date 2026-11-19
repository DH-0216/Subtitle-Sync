import React, { useEffect, useCallback, useRef } from 'react'
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
import { cleanPathString } from '@shared/fileSanitizer'
import { ThemeMode } from './theme'
import { useLogStore, useUIStore, useSettingsStore, useUpdaterStore, useWhisperStore } from './store'
import {
  useVideoMedia,
  useSyncWorkflow,
  useExtractWorkflow,
  useGenerateWorkflow,
  useTranslateWorkflow,
  useBatchWorkflow
} from './hooks'

export type { ThemeMode }

export default function App() {
  // 1. UI Navigation & Modals Store (Zustand)
  const {
    subtitleAction,
    setSubtitleAction,
    audioModalOpen,
    setAudioModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
    settingsInitialTab,
    setSettingsInitialTab,
    aboutModalOpen,
    setAboutModalOpen,
    engineReady,
    setEngineReady,
    isOnline,
    setIsOnline
  } = useUIStore()

  const subtitleActionRef = useRef<SubtitleAction>(subtitleAction)
  useEffect(() => {
    subtitleActionRef.current = subtitleAction
  }, [subtitleAction])

  // 2. Activity Console Logs Store (Zustand)
  const {
    logs,
    addLog,
    addSyncLog,
    addExtractLog,
    addTranslateLog,
    addGenerateLog,
    addBatchLog,
    addVideoLog: storeAddVideoLog,
    clearLogs: handleClearLogs
  } = useLogStore()

  const addVideoLog = useCallback(
    (msg: string) => storeAddVideoLog(msg, subtitleActionRef.current),
    [storeAddVideoLog]
  )

  // 3. Theme & Settings Preferences Store (Zustand)
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
    defaultSubtitleFormat,
    setDefaultSubtitleFormat,
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
    handleSaveSettings,
    setIsSystemDark
  } = useSettingsStore()

  // Listen to OS system color scheme changes for theme updates
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setIsSystemDark])

  // 4. In-App Updater Store (Zustand)
  const updater = useUpdaterStore()

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

  // 5. Extract Workflow Hook
  const extract = useExtractWorkflow()

  // 6. Generate Workflow Hook
  const generate = useGenerateWorkflow()

  // 7. Translate Workflow Hook
  const translate = useTranslateWorkflow({
    extractCleanTags: extract.extractCleanTags,
    onRemoveVideo: () => video.handleRemoveVideo(),
    setIsExtracting: extract.setIsExtracting,
    setExtractStatusMessage: extract.setExtractStatusMessage
  })

  // 8. Batch Process Workflow Hook
  const batch = useBatchWorkflow()

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

  // Synchronize default subtitle format across workflow configs
  useEffect(() => {
    const whisperFormat = defaultSubtitleFormat === 'txt' ? 'srt' : defaultSubtitleFormat
    generate.setGenerateConfig((prev) => ({ ...prev, format: whisperFormat }))
    translate.setTranslateFormat(defaultSubtitleFormat)
    batch.setGenerateFormat(whisperFormat)
    batch.setTranslateFormat(defaultSubtitleFormat)
  }, [defaultSubtitleFormat])

  // Check Engine Binaries and Initial Settings
  useEffect(() => {
    useSettingsStore.getState().loadSettings().then(() => {
      const mode = useSettingsStore.getState().defaultMode
      if (mode) sync.setSyncMode(mode)
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
      const shouldCheck = useSettingsStore.getState().checkUpdates
      if (shouldCheck && navigator.onLine) {
        updater.handleCheckForAppUpdates(true, true)
      }
    }, 2500)

    return () => clearTimeout(startupTimer)
  }, [])

  // Initial Whisper model catalog load
  useEffect(() => {
    useWhisperStore.getState().loadWhisperModels(false)
  }, [])

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
                <SyncView workflow={sync} video={video} onOpenFolder={handleOpenFolder} />
              )}

              {subtitleAction === 'extract' && (
                <ExtractView workflow={extract} video={video} onOpenFolder={handleOpenFolder} />
              )}

              {subtitleAction === 'translate' && (
                <TranslateView workflow={translate} video={video} extract={extract} onOpenFolder={handleOpenFolder} />
              )}

              {subtitleAction === 'generate' && (
                <GenerateView workflow={generate} video={video} onOpenFolder={handleOpenFolder} />
              )}

              {subtitleAction === 'batch' && (
                <BatchView workflow={batch} onOpenFolder={handleOpenFolder} />
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
      <AudioTrackModal />
      <SettingsModal />
      <AboutModal />
      <ModelDownloadModal onStartDownload={generate.handleStartDownloadModel} />
      <UpdateModal />

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
