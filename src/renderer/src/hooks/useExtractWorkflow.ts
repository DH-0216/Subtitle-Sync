import { useState, useRef, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { SubtitleTrack } from '../components/Step1Video'
import { useMediaStore, useLogStore, useSettingsStore } from '../store'

interface UseExtractWorkflowOptions {
  videoPath?: string | null
  subtitleTracks?: SubtitleTrack[]
  addLog?: (msg: string) => void
  notifyJobComplete?: (title: string, body: string) => void
  onOutputReady?: (filePath: string, dirPath: string) => void
  onOutputClear?: () => void
}

export function useExtractWorkflow(options: UseExtractWorkflowOptions = {}) {
  const mediaStore = useMediaStore()
  const logStore = useLogStore()
  const settingsStore = useSettingsStore()

  const videoPath = options.videoPath ?? mediaStore.videoPath
  const subtitleTracks = options.subtitleTracks ?? mediaStore.subtitleTracks
  const addLog = options.addLog ?? logStore.addExtractLog
  const notifyJobComplete = options.notifyJobComplete ?? settingsStore.notifyJobComplete
  const onOutputReady = options.onOutputReady ?? mediaStore.setOutput
  const onOutputClear = options.onOutputClear ?? (() => mediaStore.setOutput(null, null))
  const [selectedExtractTrackIndices, setSelectedExtractTrackIndices] = useState<number[]>([])
  const [extractOutputDir, setExtractOutputDir] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState(0)
  const [extractStatusMessage, setExtractStatusMessage] = useState('')
  const [extractCleanTags, setExtractCleanTags] = useState(true)

  const extractCancelledRef = useRef(false)

  // Listen to live extraction events & progress from FFmpeg
  useEffect(() => {
    if (!window.api?.extractor?.onEvent) return
    const unsub = window.api.extractor.onEvent((event: any) => {
      if (extractCancelledRef.current) return
      if (event.type === 'progress') {
        const p = typeof event.percent === 'number' ? event.percent : 0
        setExtractProgress(p)
        if (event.message) setExtractStatusMessage(event.message)
      } else if (event.type === 'log') {
        addLog(event.message)
      }
    })
    return () => unsub()
  }, [addLog])

  const handleStartExtract = useCallback(async () => {
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
    addLog(`=== Extracting Subtitle Tracks ===`)
    addLog(`Movie: ${videoPath}`)
    addLog(`Selected tracks: ${tracksToExtract.length} of ${subtitleTracks.length}`)

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
        const lastFile = res.extracted[res.extracted.length - 1].outputPath || ''
        setExtractProgress(100)
        setExtractStatusMessage(`Extracted ${res.extracted.length} subtitle file(s) successfully!`)
        toast.success(`Extracted ${res.extracted.length} subtitle(s) to .SRT!`, { duration: 4500 })
        notifyJobComplete(
          'Subtitle Extraction Complete',
          `Successfully extracted ${res.extracted.length} subtitle track(s) to .SRT!`
        )

        if (lastFile && onOutputReady) {
          const folder = lastFile.substring(
            0,
            Math.max(lastFile.lastIndexOf('/'), lastFile.lastIndexOf('\\'))
          )
          onOutputReady(lastFile, folder)
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
  }, [addLog, extractCleanTags, extractOutputDir, notifyJobComplete, onOutputReady, selectedExtractTrackIndices, subtitleTracks, videoPath])

  const handleExtractSingleNow = useCallback(async (track: SubtitleTrack) => {
    if (!videoPath) return
    setIsExtracting(true)
    setExtractProgress(20)
    setExtractStatusMessage(`Extracting Track #${track.index + 1} (${track.language.toUpperCase()})...`)
    addLog(
      `[EXTRACT] Extracting single track #${track.index + 1} (${track.language.toUpperCase()}) from ${videoPath}`
    )

    try {
      const res = await window.api.extractor.extractSingle({
        videoPath,
        track,
        outputDir: extractOutputDir || undefined,
        cleanTags: extractCleanTags
      })

      if (res.success && res.outputPath) {
        const fileName = res.outputPath.split(/[/\\]/).pop() || 'subtitle.extracted.srt'
        setExtractProgress(100)
        setExtractStatusMessage(`Track #${track.index + 1} extracted successfully!`)
        toast.success(`Extracted to ${fileName}!`, { duration: 4000 })
        if (onOutputReady) {
          const folder = res.outputPath.substring(
            0,
            Math.max(res.outputPath.lastIndexOf('/'), res.outputPath.lastIndexOf('\\'))
          )
          onOutputReady(res.outputPath, folder)
        }
      } else {
        toast.error(res.error || 'Failed to extract track')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract track')
    } finally {
      setIsExtracting(false)
    }
  }, [addLog, extractCleanTags, extractOutputDir, onOutputReady, videoPath])

  const handleCancelExtract = useCallback(async () => {
    extractCancelledRef.current = true
    try {
      if (window.api?.extractor?.cancel) {
        await window.api.extractor.cancel()
      }
    } catch {}
    setIsExtracting(false)
    setExtractProgress(0)
    setExtractStatusMessage('Extraction cancelled by user')
    if (onOutputClear) onOutputClear()
    toast('Extraction cancelled', { icon: '⏹️', duration: 2500 })
    addLog('[USER] Subtitle extraction cancelled.')
  }, [addLog, onOutputClear])

  const handleSelectOutputDir = useCallback(async () => {
    if (!window.api?.dialog?.selectFolder) return
    const dir = await window.api.dialog.selectFolder()
    if (dir) {
      setExtractOutputDir(dir)
      toast.success(`Custom export directory set!`, { icon: '📁' })
    }
  }, [])

  return {
    selectedExtractTrackIndices,
    setSelectedExtractTrackIndices,
    extractOutputDir,
    setExtractOutputDir,
    isExtracting,
    setIsExtracting,
    extractProgress,
    setExtractProgress,
    extractStatusMessage,
    setExtractStatusMessage,
    extractCleanTags,
    setExtractCleanTags,
    extractCancelledRef,
    handleStartExtract,
    handleExtractSingleNow,
    handleCancelExtract,
    handleSelectOutputDir
  }
}
