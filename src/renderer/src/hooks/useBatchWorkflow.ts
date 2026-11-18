import { useState, useRef, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  isVideoFile,
  isSubtitleFile,
  getFileName,
  getFileExtension
} from '@shared/fileSanitizer'
import { formatUserFriendlyError } from '@shared/errorUtils'
import { AiProviderId } from '@shared/aiModels'
import { resolveEffectiveAiPrompt } from '@shared/translationPrompts'
import {
  matchVideosWithSubtitles,
  naturalSortPaths,
  MatchedPair
} from '../utils/batchMatcher'
import { SyncMode } from '../components/Step3Sync'

export type BatchOperationType = 'sync' | 'generate' | 'translate'
export type BatchItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface BatchItem {
  id: string
  name: string
  jobType: BatchOperationType
  videoPath?: string
  subPath?: string
  status: BatchItemStatus
  progress: number
  statusMessage?: string
  outputPath?: string
  outputDir?: string
  error?: string
  episodeLabel?: string
  confidence?: 'high' | 'medium' | 'none'
  fileSizeFormatted?: string
}

interface UseBatchWorkflowOptions {
  aiApiKey: string
  aiProvider: AiProviderId
  aiModel: string
  aiPrompt: string
  aiPromptsByLang?: Record<string, string>
  addLog: (msg: string) => void
  notifyJobComplete: (title: string, body: string) => void
  onOpenSettingsAiTab: () => void
}

export function useBatchWorkflow({
  aiApiKey,
  aiProvider,
  aiModel,
  aiPrompt,
  aiPromptsByLang,
  addLog,
  notifyJobComplete,
  onOpenSettingsAiTab
}: UseBatchWorkflowOptions) {
  const [batchMode, setBatchMode] = useState<BatchOperationType>('sync')
  const [items, setItems] = useState<BatchItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  // Configuration options
  const [syncMode, setSyncMode] = useState<SyncMode>('Standard')
  const [whisperModelQuality, setWhisperModelQuality] = useState('base')
  const [generateLanguage, setGenerateLanguage] = useState('original')
  const [generateFormat, setGenerateFormat] = useState<'srt' | 'vtt'>('srt')

  const [translateLanguage, setTranslateLanguage] = useState('si')
  const [translateFormat, setTranslateFormat] = useState<'srt' | 'vtt' | 'txt'>('srt')

  // Last output folder for quick reveal
  const [lastBatchOutputDir, setLastBatchOutputDir] = useState<string | null>(null)

  const isProcessingRef = useRef(false)
  const cancelRequestedRef = useRef(false)
  const activeItemIdRef = useRef<string | null>(null)

  useEffect(() => {
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  useEffect(() => {
    activeItemIdRef.current = activeItemId
  }, [activeItemId])

  // Helper: generate unique id
  const nextId = () => `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // 1. Add files via dialog
  const handleAddFiles = useCallback(async () => {
    try {
      if (batchMode === 'translate') {
        const paths = await window.api?.dialog?.openSubtitles()
        if (!paths || paths.length === 0) return
        const sorted = naturalSortPaths(paths)
        const newItems: BatchItem[] = sorted.map((p) => ({
          id: nextId(),
          name: getFileName(p),
          jobType: 'translate',
          subPath: p,
          status: 'pending',
          progress: 0
        }))
        setItems((prev) => [...prev, ...newItems])
        toast.success(`Added ${newItems.length} subtitle(s) to queue!`)
        addLog(`[BATCH] Added ${newItems.length} subtitle(s) for AI translation.`)
      } else {
        let paths: string[] = []
        if (window.api?.dialog?.openVideos) {
          paths = await window.api.dialog.openVideos()
        } else if (window.api?.dialog?.openVideo) {
          const single = await window.api.dialog.openVideo()
          if (single) paths = [single]
        } else {
          toast.error('File dialog is not available. Please restart the application.')
          return
        }

        if (!paths || paths.length === 0) return
        const sorted = naturalSortPaths(paths)
        const newItems: BatchItem[] = sorted.map((p) => ({
          id: nextId(),
          name: getFileName(p),
          jobType: batchMode,
          videoPath: p,
          status: 'pending',
          progress: 0
        }))
        setItems((prev) => [...prev, ...newItems])
        toast.success(`Added ${newItems.length} video(s) to queue!`)
        addLog(`[BATCH] Added ${newItems.length} video(s) to ${batchMode} queue.`)
      }
    } catch (err: any) {
      toast.error('Failed to add files: ' + (err?.message || err))
    }
  }, [addLog, batchMode])

  // 2. Add an entire folder / series
  const handleAddFolder = useCallback(async () => {
    try {
      let folder: string | null = null
      if (window.api?.dialog?.openFolder) {
        folder = await window.api.dialog.openFolder('Select Movie or TV Series Folder')
      } else if (window.api?.dialog?.selectFolder) {
        folder = await window.api.dialog.selectFolder()
      } else {
        toast.error('Folder dialog is not available. Please restart the application.')
        return
      }

      if (!folder) return

      if (!window.api?.batch?.scanFolder) {
        toast.error('Folder scanning is not ready yet. Please restart the application to reload backend!', {
          duration: 5000,
          icon: '🔄'
        })
        return
      }

      addLog(`[BATCH SCAN] Scanning folder: "${folder}"...`)
      const { videos, subtitles } = await window.api.batch.scanFolder(folder)

      if (batchMode === 'sync') {
        if (videos.length === 0) {
          toast.error('No supported video files found in selected folder.')
          return
        }
        const matches: MatchedPair[] = matchVideosWithSubtitles(videos, subtitles)
        const newItems: BatchItem[] = matches.map((m) => ({
          id: nextId(),
          name: getFileName(m.videoPath),
          jobType: 'sync',
          videoPath: m.videoPath,
          subPath: m.subPath || undefined,
          status: 'pending',
          progress: 0,
          confidence: m.confidence,
          episodeLabel: m.episodeLabel
        }))
        setItems((prev) => [...prev, ...newItems])
        const matchedCount = matches.filter((m) => m.subPath).length
        toast.success(`Loaded ${newItems.length} video(s) (${matchedCount} paired with subtitles)!`)
        addLog(`[BATCH] Loaded folder "${getFileName(folder)}": ${newItems.length} episodes, ${matchedCount} subtitles paired.`)
      } else if (batchMode === 'generate') {
        if (videos.length === 0) {
          toast.error('No supported video files found in selected folder.')
          return
        }
        const sorted = naturalSortPaths(videos)
        const newItems: BatchItem[] = sorted.map((p) => ({
          id: nextId(),
          name: getFileName(p),
          jobType: 'generate',
          videoPath: p,
          status: 'pending',
          progress: 0
        }))
        setItems((prev) => [...prev, ...newItems])
        toast.success(`Added ${newItems.length} video(s) for Whisper AI generation!`)
        addLog(`[BATCH] Added ${newItems.length} video(s) from folder "${getFileName(folder)}".`)
      } else {
        // translate mode
        if (subtitles.length === 0) {
          toast.error('No supported subtitle files found in selected folder.')
          return
        }
        const sorted = naturalSortPaths(subtitles)
        const newItems: BatchItem[] = sorted.map((p) => ({
          id: nextId(),
          name: getFileName(p),
          jobType: 'translate',
          subPath: p,
          status: 'pending',
          progress: 0
        }))
        setItems((prev) => [...prev, ...newItems])
        toast.success(`Added ${newItems.length} subtitle(s) for AI translation!`)
        addLog(`[BATCH] Added ${newItems.length} subtitle(s) from folder "${getFileName(folder)}".`)
      }
    } catch (err: any) {
      toast.error('Failed to scan folder: ' + (err?.message || err))
    }
  }, [addLog, batchMode])

  // 3. Drag and Drop onto batch queue
  const handleDropFiles = useCallback(async (rawPaths: string[]) => {
    if (!rawPaths || rawPaths.length === 0) return
    const cleanPaths = rawPaths.map(cleanPathString).filter(Boolean)
    if (cleanPaths.length === 0) return

    let discoveredVideos: string[] = []
    let discoveredSubs: string[] = []

    for (const p of cleanPaths) {
      if (isVideoFile(p)) {
        discoveredVideos.push(p)
      } else if (isSubtitleFile(p)) {
        discoveredSubs.push(p)
      } else {
        // Check if directory
        if (window.api?.batch?.scanFolder) {
          try {
            const scanRes = await window.api.batch.scanFolder(p)
            if (scanRes.videos?.length || scanRes.subtitles?.length) {
              discoveredVideos.push(...scanRes.videos)
              discoveredSubs.push(...scanRes.subtitles)
            }
          } catch {
            // ignore non-directory
          }
        }
      }
    }

    if (batchMode === 'sync') {
      if (discoveredVideos.length === 0 && discoveredSubs.length > 0) {
        // User dropped subtitles on existing items with missing subs
        setItems((prev) => {
          let updated = [...prev]
          const remainingSubs = [...discoveredSubs]
          updated = updated.map((item) => {
            if (item.jobType === 'sync' && !item.subPath && remainingSubs.length > 0) {
              const matches = matchVideosWithSubtitles([item.videoPath!], remainingSubs)
              if (matches[0]?.subPath) {
                const sub = matches[0].subPath
                const idx = remainingSubs.indexOf(sub)
                if (idx !== -1) remainingSubs.splice(idx, 1)
                return { ...item, subPath: sub, confidence: matches[0].confidence }
              }
            }
            return item
          })
          return updated
        })
        toast.success(`Assigned dropped subtitles to queue items!`)
        return
      }

      const matches = matchVideosWithSubtitles(discoveredVideos, discoveredSubs)
      const newItems: BatchItem[] = matches.map((m) => ({
        id: nextId(),
        name: getFileName(m.videoPath),
        jobType: 'sync',
        videoPath: m.videoPath,
        subPath: m.subPath || undefined,
        status: 'pending',
        progress: 0,
        confidence: m.confidence,
        episodeLabel: m.episodeLabel
      }))
      setItems((prev) => [...prev, ...newItems])
      toast.success(`Added ${newItems.length} video item(s) to queue!`)
    } else if (batchMode === 'generate') {
      if (discoveredVideos.length === 0) {
        toast.error('No video files dropped. Whisper generation requires video files.')
        return
      }
      const sorted = naturalSortPaths(discoveredVideos)
      const newItems: BatchItem[] = sorted.map((p) => ({
        id: nextId(),
        name: getFileName(p),
        jobType: 'generate',
        videoPath: p,
        status: 'pending',
        progress: 0
      }))
      setItems((prev) => [...prev, ...newItems])
      toast.success(`Added ${newItems.length} video(s) for subtitle generation!`)
    } else {
      // translate
      if (discoveredSubs.length === 0) {
        toast.error('No subtitle files dropped. AI translation requires subtitle files (.srt, .vtt).')
        return
      }
      const sorted = naturalSortPaths(discoveredSubs)
      const newItems: BatchItem[] = sorted.map((p) => ({
        id: nextId(),
        name: getFileName(p),
        jobType: 'translate',
        subPath: p,
        status: 'pending',
        progress: 0
      }))
      setItems((prev) => [...prev, ...newItems])
      toast.success(`Added ${newItems.length} subtitle(s) for AI translation!`)
    }
  }, [batchMode])

  // 4. Manually browse/assign a subtitle to a sync item
  const handleAssignSubtitle = useCallback(async (itemId: string) => {
    try {
      const subs = await window.api.dialog.openSubtitles()
      if (subs && subs.length > 0) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, subPath: subs[0], confidence: 'high' } : it))
        )
        toast.success(`Assigned subtitle: ${getFileName(subs[0])}`)
      }
    } catch (err: any) {
      toast.error('Could not select subtitle: ' + err?.message)
    }
  }, [])

  // 5. Item list manipulation
  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }, [])

  const handleClearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.status !== 'completed'))
    toast.success('Cleared completed items from queue')
  }, [])

  const handleClearAll = useCallback(() => {
    if (isProcessingRef.current) {
      toast.error('Please stop batch execution before clearing the queue.')
      return
    }
    setItems([])
    setOverallProgress(0)
    setActiveItemId(null)
  }, [])

  const handleRetryItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, status: 'pending', progress: 0, error: undefined } : it))
    )
  }, [])

  // 6. Real-time event handler hook for active item
  const handleEngineEvent = useCallback((event: any) => {
    const curId = activeItemIdRef.current
    if (!curId) return

    if (event.type === 'progress') {
      const pct = typeof event.percent === 'number' ? Math.round(event.percent) : 0
      setItems((prev) =>
        prev.map((it) =>
          it.id === curId
            ? { ...it, progress: pct, statusMessage: event.message || it.statusMessage }
            : it
        )
      )
    } else if (event.type === 'status') {
      setItems((prev) =>
        prev.map((it) =>
          it.id === curId ? { ...it, statusMessage: event.message || it.statusMessage } : it
        )
      )
    }
  }, [])

  // 7. Start sequential batch execution
  const handleStartBatch = useCallback(async () => {
    const pendingItems = items.filter((it) => it.status === 'pending' || it.status === 'failed')
    if (pendingItems.length === 0) {
      toast('No pending items in queue to process', { icon: 'ℹ️' })
      return
    }

    // Pre-flight check for translate / generate with AI translation
    const needsAi = pendingItems.some(
      (it) =>
        it.jobType === 'translate' ||
        (it.jobType === 'generate' && ['si', 'ta', 'hi', 'es'].includes(generateLanguage))
    )
    if (needsAi && !aiApiKey.trim()) {
      toast.error('Please enter your AI API Key in Settings to process AI translation tasks!', {
        duration: 5000,
        icon: '🔑'
      })
      onOpenSettingsAiTab()
      return
    }

    cancelRequestedRef.current = false
    setIsProcessing(true)
    addLog(`=== Starting Batch Processing Queue (${pendingItems.length} items) ===`)

    let completedCount = 0
    let failedCount = 0
    const totalItemsCount = items.length

    for (let i = 0; i < items.length; i++) {
      if (cancelRequestedRef.current) break

      const currentItem = items[i]
      if (currentItem.status === 'completed') {
        completedCount++
        continue
      }

      // If sync item has no subtitle, mark failed with clear reason
      if (currentItem.jobType === 'sync' && !currentItem.subPath) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === currentItem.id
              ? { ...it, status: 'failed', error: 'No subtitle assigned for synchronization.' }
              : it
          )
        )
        failedCount++
        addLog(`[BATCH SKIP] "${currentItem.name}" skipped: no subtitle assigned.`)
        continue
      }

      // Mark current item processing
      setActiveItemId(currentItem.id)
      setItems((prev) =>
        prev.map((it) =>
          it.id === currentItem.id
            ? { ...it, status: 'processing', progress: 5, statusMessage: 'Starting...' }
            : it
        )
      )

      addLog(`[BATCH] (${i + 1}/${totalItemsCount}) Processing [${currentItem.jobType.toUpperCase()}]: ${currentItem.name}`)

      try {
        let result: any = null

        // --- JOB A: Synchronize ---
        if (currentItem.jobType === 'sync') {
          const sub = currentItem.subPath!
          const ext = sub.substring(sub.lastIndexOf('.'))
          const outPath = sub.replace(new RegExp(`\\${ext}$`, 'i'), `.synced${ext}`)

          result = await window.api.engine.startSync({
            video: currentItem.videoPath!,
            sub,
            out: outPath,
            mode: syncMode
          })

          if (cancelRequestedRef.current || result?.cancelled) {
            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id
                  ? { ...it, status: 'cancelled', statusMessage: 'Cancelled by user' }
                  : it
              )
            )
            break
          }

          if (result?.success) {
            const finalOut = result.out || outPath
            const outDir = finalOut.substring(
              0,
              Math.max(finalOut.lastIndexOf('/'), finalOut.lastIndexOf('\\'))
            )
            setLastBatchOutputDir(outDir)
            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id
                  ? {
                      ...it,
                      status: 'completed',
                      progress: 100,
                      statusMessage: 'Synchronized successfully!',
                      outputPath: finalOut,
                      outputDir: outDir
                    }
                  : it
              )
            )
            completedCount++
            addLog(`[BATCH SUCCESS] Synced: ${finalOut}`)
          } else {
            throw new Error(result?.error || 'Synchronization failed.')
          }
        }

        // --- JOB B: Whisper Generate ---
        else if (currentItem.jobType === 'generate') {
          result = await window.api.generator.startGenerate({
            video: currentItem.videoPath,
            sourceType: 'video',
            modelQuality: whisperModelQuality,
            format: generateFormat,
            language: generateLanguage,
            aiApiKey,
            aiProvider,
            aiModel,
            customPrompt: resolveEffectiveAiPrompt(generateLanguage, aiPrompt, aiPromptsByLang)
          })

          if (cancelRequestedRef.current) break

          if (result?.success) {
            const finalOut = result.output
            const outDir = finalOut
              ? finalOut.substring(0, Math.max(finalOut.lastIndexOf('/'), finalOut.lastIndexOf('\\')))
              : undefined
            if (outDir) setLastBatchOutputDir(outDir)

            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id
                  ? {
                      ...it,
                      status: 'completed',
                      progress: 100,
                      statusMessage: 'Generated successfully!',
                      outputPath: finalOut,
                      outputDir: outDir
                    }
                  : it
              )
            )
            completedCount++
            addLog(`[BATCH SUCCESS] Generated subtitle: ${finalOut}`)
          } else {
            throw new Error(result?.message || result?.error || 'Generation failed.')
          }
        }

        // --- JOB C: AI Translate ---
        else if (currentItem.jobType === 'translate') {
          result = await window.api.generator.startGenerate({
            video: '',
            trackIndex: 0,
            sourceType: 'subtitle',
            sourceSubPath: currentItem.subPath,
            language: translateLanguage,
            format: translateFormat,
            aiApiKey,
            aiProvider,
            aiModel,
            customPrompt: resolveEffectiveAiPrompt(translateLanguage, aiPrompt, aiPromptsByLang)
          })

          if (cancelRequestedRef.current) break

          if (result?.success) {
            const finalOut = result.output
            const outDir = finalOut
              ? finalOut.substring(0, Math.max(finalOut.lastIndexOf('/'), finalOut.lastIndexOf('\\')))
              : undefined
            if (outDir) setLastBatchOutputDir(outDir)

            setItems((prev) =>
              prev.map((it) =>
                it.id === currentItem.id
                  ? {
                      ...it,
                      status: 'completed',
                      progress: 100,
                      statusMessage: 'Translated successfully!',
                      outputPath: finalOut,
                      outputDir: outDir
                    }
                  : it
              )
            )
            completedCount++
            addLog(`[BATCH SUCCESS] Translated subtitle: ${finalOut}`)
          } else {
            throw new Error(result?.message || result?.error || 'Translation failed.')
          }
        }
      } catch (err: any) {
        if (cancelRequestedRef.current) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === currentItem.id
                ? { ...it, status: 'cancelled', statusMessage: 'Cancelled by user' }
                : it
            )
          )
          break
        }
        failedCount++
        const friendly = formatUserFriendlyError(err)
        setItems((prev) =>
          prev.map((it) =>
            it.id === currentItem.id
              ? { ...it, status: 'failed', progress: 0, error: friendly, statusMessage: friendly }
              : it
          )
        )
        addLog(`[BATCH ERROR] Failed on "${currentItem.name}": ${err?.message || err}`)
      }

      // Update overall progress bar
      const overall = Math.round(((completedCount + failedCount) / totalItemsCount) * 100)
      setOverallProgress(overall)
    }

    setActiveItemId(null)
    setIsProcessing(false)

    if (cancelRequestedRef.current) {
      toast('Batch processing stopped', { icon: '⏹️', duration: 3000 })
      addLog('[BATCH] Processing stopped by user.')
      return
    }

    setOverallProgress(100)
    const summaryMsg = `Batch Complete: ${completedCount} succeeded, ${failedCount} failed out of ${totalItemsCount} items.`
    addLog(`=== ${summaryMsg} ===`)

    if (failedCount === 0) {
      toast.success(`All ${completedCount} item(s) processed successfully!`, { duration: 5000 })
      notifyJobComplete('Batch Processing Finished', `All ${completedCount} files in queue finished successfully!`)
    } else {
      toast(`${completedCount} succeeded, ${failedCount} failed`, { icon: '⚠️', duration: 5000 })
      notifyJobComplete('Batch Processing Finished', `${completedCount} items succeeded, ${failedCount} encountered errors.`)
    }
  }, [
    addLog,
    aiApiKey,
    aiModel,
    aiPrompt,
    aiPromptsByLang,
    aiProvider,
    generateFormat,
    generateLanguage,
    items,
    notifyJobComplete,
    onOpenSettingsAiTab,
    syncMode,
    translateFormat,
    translateLanguage,
    whisperModelQuality
  ])

  // 8. Stop / Cancel batch
  const handleStopBatch = useCallback(async () => {
    cancelRequestedRef.current = true
    setIsProcessing(false)
    try {
      await window.api.engine.cancelSync()
      await window.api.generator.cancelGenerate()
    } catch {}

    const curId = activeItemIdRef.current
    if (curId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === curId ? { ...it, status: 'cancelled', statusMessage: 'Cancelled by user' } : it
        )
      )
    }
    setActiveItemId(null)
    toast('Stopping batch queue...', { icon: '⏹️', duration: 2500 })
    addLog('[BATCH] User requested stop of batch queue.')
  }, [addLog])

  return {
    batchMode,
    setBatchMode,
    items,
    isProcessing,
    overallProgress,
    activeItemId,
    syncMode,
    setSyncMode,
    whisperModelQuality,
    setWhisperModelQuality,
    generateLanguage,
    setGenerateLanguage,
    generateFormat,
    setGenerateFormat,
    translateLanguage,
    setTranslateLanguage,
    translateFormat,
    setTranslateFormat,
    lastBatchOutputDir,
    handleAddFiles,
    handleAddFolder,
    handleDropFiles,
    handleAssignSubtitle,
    handleRemoveItem,
    handleClearCompleted,
    handleClearAll,
    handleRetryItem,
    handleStartBatch,
    handleStopBatch,
    handleEngineEvent
  }
}
