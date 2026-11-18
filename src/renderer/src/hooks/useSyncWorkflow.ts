import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  isVideoFile,
  isSubtitleFile,
  getUnsupportedFileMessage,
  getFileName
} from '@shared/fileSanitizer'
import { SubtitleItem } from '../components/Step2Subtitles'
import { SyncMode } from '../components/Step3Sync'

interface UseSyncWorkflowOptions {
  videoPath: string | null
  selectedTrack: number | null
  onVideoSelect: (path: string) => void
  addLog: (msg: string) => void
  notifyJobComplete: (title: string, body: string) => void
}

export function useSyncWorkflow({
  videoPath,
  selectedTrack,
  onVideoSelect,
  addLog,
  notifyJobComplete
}: UseSyncWorkflowOptions) {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [subtitleError, setSubtitleError] = useState<string | null>(null)
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

  const syncCancelledRef = useRef(false)
  const currentSubIndexRef = useRef(0)
  const isSyncingRef = useRef(false)

  useEffect(() => {
    isSyncingRef.current = isSyncing
  }, [isSyncing])

  const handleClearSubtitleError = useCallback(() => {
    setSubtitleError(null)
  }, [])

  const handleAddSubtitles = useCallback(async (rawPaths: string[]) => {
    setSubtitleError(null)
    if (!rawPaths || rawPaths.length === 0) return
    const cleanPaths = rawPaths.map(cleanPathString).filter(Boolean)
    if (cleanPaths.length === 0) return

    let expandedPaths = [...cleanPaths]
    if (window.api?.file?.validate) {
      try {
        const valResults = await window.api.file.validate(cleanPaths, 'subtitle')
        if (Array.isArray(valResults) && valResults.length > 0) {
          const dirItems = valResults.filter(
            (v: any) => v.isDirectory && v.directorySubtitles && v.directorySubtitles.length > 0
          )
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

    for (const p of expandedPaths) {
      if (isVideoFile(p)) {
        const fileName = getFileName(p)
        if (!videoPath) {
          toast.success(`Detected movie "${fileName}"! Loaded into Step 1.`, { icon: '🎬' })
          addLog(`[FILE] Movie dropped on subtitles: loaded "${fileName}" into Step 1`)
          onVideoSelect(p)
        } else {
          const msg = `"${fileName}" is a video file. To change your reference movie, drop it into Step 1.`
          setSubtitleError(msg)
          toast(msg, { icon: 'ℹ️' })
          addLog(`[FILE] ℹ️ ${msg}`)
        }
        continue
      }

      if (!isSubtitleFile(p)) {
        const msg = getUnsupportedFileMessage(p, 'subtitle')
        setSubtitleError(msg)
        toast.error(msg)
        addLog(`[FILE] ⚠️ Unsupported subtitle: ${msg}`)
        continue
      }

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
    addLog(`[SUBTITLES] Added ${newItems.length} subtitle file(s)`)
    toast.success(`Added ${newItems.length} subtitle file(s)!`, { icon: '📄' })
  }, [addLog, onVideoSelect, subtitles, videoPath])

  const handleBrowseSubtitles = useCallback(async () => {
    setSubtitleError(null)
    const files = await window.api.dialog.openSubtitles()
    if (files && files.length > 0) {
      handleAddSubtitles(files)
    }
  }, [handleAddSubtitles])

  const handleRemoveSubtitle = useCallback((id: string) => {
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
  }, [])

  // Intelligent Recommender Trigger
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
          addLog(`[RECOMMENDER] Recommended mode: ${res.mode} - ${res.title}`)
        }
      })
    } else {
      setRecommendation(null)
      setRecommendedMode(null)
      setRecommendedReason(null)
    }
  }, [videoPath, subtitlePathsKey, userSelectedMode, addLog])

  const handleSetSyncMode = useCallback((m: SyncMode) => {
    setSyncMode(m)
    setUserSelectedMode(true)
  }, [])

  const handleStartSync = useCallback(async () => {
    if (!videoPath || subtitles.length === 0) return

    syncCancelledRef.current = false
    setIsSyncing(true)
    setProgress(0)
    setLastOutputDir(null)
    setLastOutputFile(null)
    addLog(`=== Starting ${syncMode} synchronization session ===`)
    addLog(`Movie: ${videoPath}`)
    addLog(`Total Subtitles: ${subtitles.length}`)
    setStatusMessage(`Preparing ${syncMode} synchronization...`)

    let successCount = 0

    for (let i = 0; i < subtitles.length; i++) {
      if (syncCancelledRef.current) break
      currentSubIndexRef.current = i
      const sub = subtitles[i]
      const ext = sub.path.substring(sub.path.lastIndexOf('.'))
      const outPath = sub.path.replace(new RegExp(`\\${ext}$`, 'i'), `.synced${ext}`)

      addLog(`[SYNC] (${i + 1}/${subtitles.length}) Processing: ${sub.name}`)

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
  }, [addLog, notifyJobComplete, selectedTrack, subtitles, syncMode, videoPath])

  const handleCancelSync = useCallback(async () => {
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
    addLog('[USER] Synchronization cancelled.')
  }, [addLog])

  const resetSyncState = useCallback(() => {
    setUserSelectedMode(false)
    setProgress(0)
    setStatusMessage('')
    setLastOutputDir(null)
    setLastOutputFile(null)
  }, [])

  return {
    subtitles,
    setSubtitles,
    subtitleError,
    setSubtitleError,
    syncMode,
    setSyncMode,
    recommendedMode,
    recommendedReason,
    recommendation,
    userSelectedMode,
    setUserSelectedMode,
    isSyncing,
    progress,
    setProgress,
    statusMessage,
    setStatusMessage,
    lastOutputDir,
    setLastOutputDir,
    lastOutputFile,
    setLastOutputFile,
    isSyncingRef,
    syncCancelledRef,
    handleAddSubtitles,
    handleBrowseSubtitles,
    handleRemoveSubtitle,
    handleClearSubtitleError,
    handleSetSyncMode,
    handleStartSync,
    handleCancelSync,
    resetSyncState
  }
}
