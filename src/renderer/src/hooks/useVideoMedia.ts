import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  cleanPathString,
  isVideoFile,
  isSubtitleFile,
  getUnsupportedFileMessage,
  getFileName
} from '@shared/fileSanitizer'
import { AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { SubtitleAction } from '../components/SubtitleModeSelector'

interface UseVideoMediaOptions {
  subtitleAction: SubtitleAction
  addLog: (msg: string) => void
  setStatusMessage: (msg: string) => void
  onSubtitleDropped?: (subPaths: string[]) => void
  onTranslateSubtitleDropped?: (subPath: string) => void
  onVideoReset?: () => void
}

export function useVideoMedia({
  subtitleAction,
  addLog,
  setStatusMessage,
  onSubtitleDropped,
  onTranslateSubtitleDropped,
  onVideoReset
}: UseVideoMediaOptions) {
  const [videoPath, setVideoPath] = useState<string | null>(null)
  const [videoDetails, setVideoDetails] = useState<any>(null)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [selectedTrack, setSelectedTrack] = useState<number | null>(null)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [videoError, setVideoError] = useState<string | null>(null)

  const handleClearVideoError = useCallback(() => {
    setVideoError(null)
  }, [])

  const handleRemoveVideo = useCallback(() => {
    setVideoError(null)
    setVideoPath(null)
    setAudioTracks([])
    setVideoDetails(null)
    setSelectedTrack(null)
    setSubtitleTracks([])
    if (onVideoReset) onVideoReset()
  }, [onVideoReset])

  const handleSelectVideo = useCallback(async (rawPath: string) => {
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
        if (onTranslateSubtitleDropped) {
          onTranslateSubtitleDropped(cleanPath)
        }
        return
      }
      const fileName = getFileName(cleanPath)
      const msg = `"${fileName}" is a subtitle file, not a movie. Routed to Step 2 Subtitles instead!`
      toast(msg, { icon: '📝' })
      addLog(`[FILE] Subtitle dropped on video zone: routed "${fileName}" to Step 2`)
      if (onSubtitleDropped) {
        onSubtitleDropped([cleanPath])
      }
      return
    }

    // 2. Unsupported format check: Not a video format
    if (!isVideoFile(cleanPath)) {
      const msg = getUnsupportedFileMessage(cleanPath, 'video')
      const fileName = getFileName(cleanPath)
      setVideoError(msg)
      toast.error(msg)
      addLog(`[FILE] ⚠️ Unsupported video: ${msg}`)
      setStatusMessage(`Unsupported file: ${fileName}`)
      return
    }

    setVideoError(null)
    setVideoPath(cleanPath)
    if (onVideoReset) onVideoReset()
    addLog(`[MEDIA] Loading video: ${cleanPath}`)
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

        if (subTracks.length > 0) {
          const subSummary = subTracks
            .map(
              (t: any) =>
                `#${t.index + 1} [${t.language.toUpperCase()}: ${t.codec}${
                  t.title ? ' - ' + t.title : ''
                }${!t.isText ? ' (Image)' : ''}]`
            )
            .join(', ')
          addLog(
            `[MEDIA] Detected ${audio.length} audio stream(s), ${
              subTracks.length
            } embedded subtitle track(s): ${subSummary}`
          )
        } else {
          addLog(
            `[MEDIA] Detected ${audio.length} audio stream(s), 0 embedded subtitle track(s). Duration: ${
              details?.duration || 'Unknown'
            }, FPS: ${details?.fps || 'Unknown'}`
          )
        }
      }
    } catch (e: any) {
      addLog(`[ERROR] Probing failed: ${e.message}`)
    }
    setStatusMessage('Ready')
  }, [addLog, onSubtitleDropped, onTranslateSubtitleDropped, onVideoReset, setStatusMessage, subtitleAction])

  const handleDropFilesOnVideo = useCallback(async (rawPaths: string[]) => {
    if (!rawPaths || rawPaths.length === 0) return
    const cleanPaths = rawPaths.map(cleanPathString).filter(Boolean)
    if (cleanPaths.length === 0) return

    if (cleanPaths.length > 1 && window.api?.file?.validate) {
      const valResults = await window.api.file.validate(cleanPaths, 'any')
      const videoItems = valResults.filter((v: any) => v.category === 'video' && v.exists && v.isFile)
      const subItems = valResults.filter((v: any) => v.category === 'subtitle' && v.exists && v.isFile)

      if (videoItems.length > 0 && subItems.length > 0) {
        toast.success(`Loaded reference movie and ${subItems.length} subtitle file(s)!`, { icon: '🎯' })
        await handleSelectVideo(videoItems[0].cleanPath)
        if (onSubtitleDropped) {
          onSubtitleDropped(subItems.map((s: any) => s.cleanPath))
        }
        return
      }
    }

    handleSelectVideo(cleanPaths[0])
  }, [handleSelectVideo, onSubtitleDropped])

  const handleBrowseVideo = useCallback(async () => {
    handleClearVideoError()
    const file = await window.api.dialog.openVideo()
    if (file) {
      handleSelectVideo(file)
    }
  }, [handleClearVideoError, handleSelectVideo])

  return {
    videoPath,
    setVideoPath,
    videoDetails,
    setVideoDetails,
    audioTracks,
    setAudioTracks,
    selectedTrack,
    setSelectedTrack,
    subtitleTracks,
    setSubtitleTracks,
    videoError,
    setVideoError,
    handleClearVideoError,
    handleRemoveVideo,
    handleSelectVideo,
    handleDropFilesOnVideo,
    handleBrowseVideo
  }
}
