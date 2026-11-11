import React, { useState, useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { Header } from './components/Header'
import { Step1Video } from './components/Step1Video'
import { Step2Subtitles, SubtitleItem } from './components/Step2Subtitles'
import { Step3Sync, SyncMode } from './components/Step3Sync'
import { ActivityConsole } from './components/ActivityConsole'
import { AudioTrackModal } from './components/AudioTrackModal'
import { SettingsModal } from './components/SettingsModal'
import { AboutModal } from './components/AboutModal'

export default function App() {
  // Theme & Preferences
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [defaultMode, setDefaultMode] = useState<SyncMode>('Standard')
  const [checkUpdates, setCheckUpdates] = useState(true)
  const [engineReady, setEngineReady] = useState(false)

  // Modals
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [aboutModalOpen, setAboutModalOpen] = useState(false)

  const isAnyModalOpen = audioModalOpen || settingsModalOpen || aboutModalOpen

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

  // Step 2: Subtitles
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const subtitlesRef = React.useRef<SubtitleItem[]>([])
  const currentSubIndexRef = React.useRef(0)

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
      }
    })

    window.api?.engine?.checkBinaries().then((res: any) => {
      if (res) {
        const isReady = res.ffmpegReady && res.ffsubsyncReady
        setEngineReady(isReady)
        if (isReady) {
          setLogs((prev) => [
            ...prev,
            `[ENGINE] FFmpeg detected: ${res.ffmpegPath}`,
            `[ENGINE] ffsubsync detected: ${res.ffsubsyncPath}`
          ])
        } else {
          if (!res.ffmpegReady) setLogs((prev) => [...prev, '[WARNING] ffmpeg.exe missing from bin/ folder.'])
          if (!res.ffsubsyncReady) setLogs((prev) => [...prev, '[WARNING] ffsubsync.exe missing from bin/ folder.'])
        }
      }
    })
  }, [])

  // Listen to background sync events
  useEffect(() => {
    if (!window.api?.engine?.onEvent) return

    const unsubEvent = window.api.engine.onEvent((event: any) => {
      if (event.type === 'log') {
        setLogs((prev) => [...prev, event.message])
      } else if (event.type === 'status') {
        setStatusMessage(event.message)
      } else if (event.type === 'progress') {
        const subIdx = currentSubIndexRef.current
        const total = subtitlesRef.current.length || 1
        const filePct = typeof event.percent === 'number' ? event.percent : 0
        const overallPct = Math.min(100, Math.max(0, Math.round(((subIdx * 100) + filePct) / total)))
        setProgress(overallPct)
        if (event.message) {
          if (total > 1) {
            setStatusMessage(`[${subIdx + 1}/${total}] ${event.message}`)
          } else {
            setStatusMessage(event.message)
          }
        }
      } else if (event.type === 'done') {
        if (event.success) {
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

    return () => {
      unsubEvent()
    }
  }, [])

  // Probe Video File
  const handleSelectVideo = async (filePath: string) => {
    setVideoPath(filePath)
    setLogs((prev) => [...prev, `[MEDIA] Loading video: ${filePath}`])
    setStatusMessage('Probing video audio tracks...')

    try {
      const res = await window.api.engine.probe(filePath)
      if (res) {
        setAudioTracks(res.tracks || [])
        setVideoDetails(res.details || null)
        if (res.tracks && res.tracks.length > 0) {
          setSelectedTrack(res.tracks[0].index)
        }
        setLogs((prev) => [
          ...prev,
          `[MEDIA] Detected ${res.tracks?.length || 0} audio stream(s), Duration: ${res.details?.duration || 'Unknown'}, FPS: ${res.details?.fps || 'Unknown'}`
        ])
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
    setSubtitles((prev) => prev.filter((s) => s.id !== id))
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

    setIsSyncing(true)
    setProgress(0)
    setLogs((prev) => [
      ...prev,
      `=== Starting ${syncMode} synchronization session ===`,
      `Movie: ${videoPath}`,
      `Total Subtitles: ${subtitles.length}`
    ])
    setStatusMessage(`Preparing ${syncMode} synchronization...`)

    let successCount = 0

    for (let i = 0; i < subtitles.length; i++) {
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
      if (res?.success) {
        successCount++
      }
    }

    setProgress(100)
    setIsSyncing(false)
    if (successCount === subtitles.length) {
      setStatusMessage(`All ${subtitles.length} subtitle(s) synchronized successfully!`)
    } else if (successCount > 0) {
      setStatusMessage(`Completed: ${successCount}/${subtitles.length} synchronized.`)
    } else {
      setStatusMessage('Synchronization failed.')
    }
  }

  const handleCancelSync = async () => {
    await window.api.engine.cancelSync()
    setIsSyncing(false)
    setStatusMessage('Cancelled by user')
    setLogs((prev) => [...prev, '[USER] Synchronization cancelled.'])
  }

  const handleOpenFolder = () => {
    if (lastOutputDir) {
      window.api.shell.showItemInFolder(lastOutputDir)
    }
  }

  const handleSaveSettings = () => {
    window.api?.settings?.save({
      theme,
      defaultMode,
      checkUpdates
    })
  }

  const isUnlocked = Boolean(videoPath && subtitles.length > 0)

  return (
    <div
      className={`min-h-screen ${
        theme === 'dark' ? 'dark bg-[#0B0F19] text-slate-100' : 'bg-gradient-to-br from-[#EBF2FE] via-[#F0F5FF] to-[#E5EDFD] text-slate-900'
      } ${isAnyModalOpen ? 'overflow-hidden max-h-screen' : ''} flex flex-col font-sans transition-colors duration-200`}
    >
      <Header
        theme={theme}
        setTheme={handleSetTheme}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenAbout={() => setAboutModalOpen(true)}
        engineReady={engineReady}
      />

      <main className="flex-1 max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto p-6 space-y-5">
        {/* Step 1: Reference Movie */}
        <Step1Video
          videoPath={videoPath}
          videoDetails={videoDetails}
          audioTracks={audioTracks}
          selectedTrack={selectedTrack}
          onBrowse={handleBrowseVideo}
          onRemove={() => {
            setVideoPath(null)
            setAudioTracks([])
            setVideoDetails(null)
          }}
          onSelectTrackModal={() => setAudioModalOpen(true)}
          onDropFile={(path) => handleSelectVideo(path)}
        />

        {/* Step 2: Subtitle Files */}
        <Step2Subtitles
          subtitles={subtitles}
          onBrowse={handleBrowseSubtitles}
          onRemove={handleRemoveSubtitle}
          onClearAll={() => setSubtitles([])}
          onDropFiles={(paths) => handleAddSubtitles(paths)}
        />

        {/* Step 3: Synchronization Settings & Action */}
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

        {/* Live Activity Console */}
        <ActivityConsole logs={logs} onClear={() => setLogs([])} isSyncing={isSyncing} />
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="max-w-5xl xl:max-w-6xl 2xl:max-w-[1400px] w-full mx-auto px-6 pb-6 pt-1 space-y-2.5">
        {/* Status bar row */}
        <div className="flex items-center justify-between text-xs py-2 px-3.5 rounded-xl bg-blue-100/60 dark:bg-transparent border border-blue-200/80 dark:border-transparent">
          <div className="flex items-center gap-2 text-blue-950 dark:text-slate-400 font-semibold">
            <span
              className={`text-sm leading-none ${
                isSyncing
                  ? 'text-blue-600 animate-pulse'
                  : progress === 100 && lastOutputDir
                  ? 'text-emerald-600'
                  : 'text-blue-400 dark:text-slate-500'
              }`}
            >
              ●
            </span>
            <span>{statusMessage || 'Select movie and subtitle(s)'}</span>
          </div>

          <button
            onClick={handleOpenFolder}
            disabled={!lastOutputDir}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-semibold text-xs transition-all duration-200 ${
              lastOutputDir
                ? 'border-blue-600 bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-600/30 dark:bg-blue-600/25 dark:hover:bg-blue-600/35 dark:border-blue-500/50 dark:text-blue-300 dark:hover:text-blue-100 cursor-pointer active:scale-98'
                : 'border-blue-200/70 bg-blue-50/50 text-blue-900/40 dark:border-slate-800/80 dark:bg-[#111625]/60 dark:text-slate-500 cursor-not-allowed shadow-none'
            }`}
            title={lastOutputDir ? 'Open folder containing synced subtitles' : 'No output folder available yet'}
          >
            <FolderOpen
              className={`w-3.5 h-3.5 ${
                lastOutputDir
                  ? 'text-white dark:text-blue-400'
                  : 'text-blue-900/35 dark:text-slate-500'
              }`}
            />
            <span>Open Output Folder</span>
          </button>
        </div>

        {/* Developer attribution & GitHub row */}
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-blue-100 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-400">Developed by DH-0216</span>
          <button
            onClick={() => {
              const url = 'https://github.com/DH-0216/Subtitle-Sync'
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
        theme={theme}
        setTheme={handleSetTheme}
        checkUpdates={checkUpdates}
        setCheckUpdates={setCheckUpdates}
        onSave={handleSaveSettings}
      />

      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
    </div>
  )
}
