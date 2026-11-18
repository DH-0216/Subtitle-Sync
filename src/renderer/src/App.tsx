import React, { useState, useEffect, useCallback } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { Sidebar } from './components/Sidebar'
import { SubtitleAction } from './components/SubtitleModeSelector'
import { SyncView, ExtractView, TranslateView, GenerateView } from './views'
import { ActivityConsole } from './components/ActivityConsole'
import { AudioTrackModal } from './components/AudioTrackModal'
import { SettingsModal } from './components/SettingsModal'
import { AboutModal } from './components/AboutModal'
import { ModelDownloadModal } from './components/ModelDownloadModal'
import { UpdateModal } from './components/UpdateModal'
import { isValidAiProvider } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'
import { ThemeMode } from './theme'
import {
  useThemePreferences,
  useAppUpdater,
  useVideoMedia,
  useSyncWorkflow,
  useExtractWorkflow,
  useGenerateWorkflow,
  useTranslateWorkflow
} from './hooks'

export type { ThemeMode }

export default function App() {
  // Activity Console Logs & Status
  const [logs, setLogs] = useState<string[]>([])
  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
  }, [])

  // Modals & Mode
  const [subtitleAction, setSubtitleAction] = useState<SubtitleAction>('sync')
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'ai'>('general')
  const [aboutModalOpen, setAboutModalOpen] = useState(false)
  const [engineReady, setEngineReady] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

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
    notifyJobComplete,
    handleSetTheme,
    handleSaveSettings
  } = useThemePreferences()

  // 2. In-App Updater Hook
  const updater = useAppUpdater({ notifyJobComplete, addLog })

  // 3. Shared Output Helper
  const handleOutputReady = useCallback((filePath: string, dirPath: string) => {
    sync.setLastOutputFile(filePath)
    sync.setLastOutputDir(dirPath)
  }, [])

  // 4. Video & Media Hook
  const video = useVideoMedia({
    subtitleAction,
    addLog,
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

  // 5. Sync Workflow Hook
  const sync = useSyncWorkflow({
    videoPath: video.videoPath,
    selectedTrack: video.selectedTrack,
    onVideoSelect: (p) => video.handleSelectVideo(p),
    addLog,
    notifyJobComplete
  })

  // 6. Extract Workflow Hook
  const extract = useExtractWorkflow({
    videoPath: video.videoPath,
    subtitleTracks: video.subtitleTracks,
    addLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
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
    onOpenSettingsAiTab: () => {
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
    },
    addLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
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
    extractCleanTags: extract.extractCleanTags,
    onOpenSettingsAiTab: () => {
      setSettingsInitialTab('ai')
      setSettingsModalOpen(true)
    },
    onRemoveVideo: () => video.handleRemoveVideo(),
    setIsGenerating: generate.setIsGenerating,
    setGenerateProgress: generate.setGenerateProgress,
    setGenerateStatusMessage: generate.setGenerateStatusMessage,
    setIsExtracting: extract.setIsExtracting,
    setExtractStatusMessage: extract.setExtractStatusMessage,
    addLog,
    notifyJobComplete,
    onOutputReady: (f, d) => {
      sync.setLastOutputFile(f)
      sync.setLastOutputDir(d)
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
        if (s.theme) setTheme(s.theme)
        if (s.defaultMode) {
          setDefaultMode(s.defaultMode)
          sync.setSyncMode(s.defaultMode)
        }
        if (s.checkUpdates !== undefined) setCheckUpdates(s.checkUpdates)
        if (s.autoDownloadUpdates !== undefined) updater.setAutoDownloadUpdates(s.autoDownloadUpdates)
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
  useEffect(() => {
    if (!window.api?.engine?.onEvent) return
    const unsub = window.api.engine.onEvent((event: any) => {
      if (event.type === 'log') {
        addLog(event.message)
      } else if (event.type === 'status') {
        if (generate.isGeneratingRef.current) {
          if (!generate.generateCancelledRef.current) {
            generate.setGenerateStatusMessage(event.message)
          }
        } else {
          if (!sync.syncCancelledRef.current) {
            sync.setStatusMessage(event.message)
          }
        }
      } else if (event.type === 'progress') {
        const filePct = typeof event.percent === 'number' ? event.percent : 0
        if (generate.isGeneratingRef.current) {
          if (!generate.generateCancelledRef.current) {
            generate.setGenerateProgress(filePct)
            if (event.message) generate.setGenerateStatusMessage(event.message)
          }
        } else {
          if (!sync.syncCancelledRef.current) {
            sync.setProgress(filePct)
            if (event.message) sync.setStatusMessage(event.message)
          }
        }
      }
    })
    return () => unsub()
  }, [addLog, generate, sync])

  // Open containing folder
  const handleOpenFolder = useCallback(async () => {
    if (sync.lastOutputFile && window.api?.shell?.showItemInFolder) {
      const opened = await window.api.shell.showItemInFolder(sync.lastOutputFile)
      if (opened) return
    }
    if (sync.lastOutputDir) {
      if (window.api?.shell?.openPath) {
        const opened = await window.api.shell.openPath(sync.lastOutputDir)
        if (opened) return
      } else if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(sync.lastOutputDir)
        if (opened) return
      }
    }
    if (sync.subtitles.length > 0 && sync.subtitles[0]?.path) {
      if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(sync.subtitles[0].path)
        if (opened) return
      }
    }
    if (video.videoPath) {
      if (window.api?.shell?.showItemInFolder) {
        const opened = await window.api.shell.showItemInFolder(video.videoPath)
        if (opened) return
      }
    }
    toast.error('No folder or subtitle selected yet.')
  }, [sync.lastOutputFile, sync.lastOutputDir, sync.subtitles, video.videoPath])

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
                  : 'Translate Subtitle (Cloud AI)'
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
                  onBrowseVideo={video.handleBrowseVideo}
                  onSelectVideo={video.handleSelectVideo}
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
                  isGenerating={generate.isGenerating}
                  generateProgress={generate.generateProgress}
                  generateStatusMessage={generate.generateStatusMessage}
                  lastOutputDir={sync.lastOutputDir}
                  onStartTranslateSubtitle={translate.handleStartTranslate}
                  onCancelGenerate={generate.handleCancelGenerate}
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
                    addLog(`[AUDIO] Selected track #${idx} for subtitle generation`)
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

              {/* Console */}
              <div className="!mt-auto pt-2 pb-1" style={{ marginTop: 'auto' }}>
                <ActivityConsole
                  logs={logs}
                  onClear={() => setLogs([])}
                  isSyncing={sync.isSyncing || generate.isGenerating || extract.isExtracting}
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
          addLog(`[AUDIO] Selected audio reference track #${idx}`)
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
        aiApiKey={aiApiKey}
        setAiApiKey={setAiApiKey}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        aiModel={aiModel}
        setAiModel={setAiModel}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
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
