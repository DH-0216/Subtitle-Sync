import { create } from 'zustand'
import toast from 'react-hot-toast'
import { AudioTrack, SubtitleTrack } from '../components/Step1Video'
import { cleanPathString } from '@shared/fileSanitizer'

export interface MediaState {
  videoPath: string | null
  videoDetails: any | null
  audioTracks: AudioTrack[]
  selectedTrack: number | null
  subtitleTracks: SubtitleTrack[]
  videoError: string | null

  lastOutputFile: string | null
  lastOutputDir: string | null

  setVideoPath: (path: string | null) => void
  setVideoDetails: (details: any) => void
  setAudioTracks: (tracks: AudioTrack[]) => void
  setSelectedTrack: (trackIndex: number | null) => void
  setSubtitleTracks: (tracks: SubtitleTrack[]) => void
  setVideoError: (error: string | null) => void
  setOutput: (file: string | null, dir: string | null) => void
  openFolder: (explicitPath?: string) => Promise<void>
  clearMedia: () => void
}

export const useMediaStore = create<MediaState>((set, get) => ({
  videoPath: null,
  videoDetails: null,
  audioTracks: [],
  selectedTrack: null,
  subtitleTracks: [],
  videoError: null,

  lastOutputFile: null,
  lastOutputDir: null,

  setVideoPath: (path) => set({ videoPath: path }),
  setVideoDetails: (details) => set({ videoDetails: details }),
  setAudioTracks: (tracks) => set({ audioTracks: tracks }),
  setSelectedTrack: (trackIndex) => set({ selectedTrack: trackIndex }),
  setSubtitleTracks: (tracks) => set({ subtitleTracks: tracks }),
  setVideoError: (error) => set({ videoError: error }),
  setOutput: (file, dir) => set({ lastOutputFile: file, lastOutputDir: dir }),

  openFolder: async (explicitPath?: string) => {
    const { lastOutputFile, lastOutputDir, videoPath } = get()
    const candidateList = [explicitPath, lastOutputDir, lastOutputFile, videoPath]
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

  clearMedia: () =>
    set({
      videoPath: null,
      videoDetails: null,
      audioTracks: [],
      selectedTrack: null,
      subtitleTracks: [],
      videoError: null
    })
}))
