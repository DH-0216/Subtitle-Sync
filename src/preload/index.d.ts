export interface IElectronAPI {
  dialog: {
    openVideo: () => Promise<string | null>
    openSubtitles: () => Promise<string[]>
  }
  shell: {
    showItemInFolder: (path: string) => Promise<boolean>
    openExternal: (url: string) => Promise<boolean>
  }
  settings: {
    load: () => Promise<any>
    save: (settings: any) => Promise<boolean>
  }
  engine: {
    checkBinaries: () => Promise<{
      ffmpegReady: boolean
      ffsubsyncReady: boolean
      ffmpegPath: string | null
      ffsubsyncPath: string | null
    }>
    probe: (videoPath: string) => Promise<{
      tracks: Array<{
        index: number
        codec: string
        language: string
        title: string
        channels: number
      }>
      details: {
        fps: number | null
        duration: string
        durationSec: number | null
        resolution: string
        audioCount: number
      }
    }>
    inspectSubtitle: (subPath: string) => Promise<{
      cueCount: number
      durationMs: number
      fps?: number
      tag?: string
      lines?: number
      span?: string
    } | null>
    recommend: (videoPath: string, subPath: string) => Promise<{
      mode: 'Standard' | 'Smart' | 'Split sync'
      title: string
      hint: string
      type: 'warning' | 'success' | 'info'
    }>
    startSync: (params: {
      video: string
      sub: string
      out: string
      mode: 'Standard' | 'Smart' | 'Split sync'
      trackIndex?: number | null
      subFps?: number | null
    }) => Promise<{ success: boolean }>
    cancelSync: () => Promise<boolean>
    onEvent: (callback: (data: any) => void) => () => void
  }
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
