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
  clipboard: {
    readText: () => Promise<string>
    writeText: (text: string) => Promise<void>
  }
  ai: {
    verifyKey: (provider: 'gemini' | 'openai', apiKey: string) => Promise<{ valid: boolean; message: string }>
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
    previewSubtitle: (subPath: string, maxCues?: number) => Promise<{
      fileName: string
      fullPath: string
      totalCues: number
      cues: Array<{
        index: number
        startMs: number
        endMs: number
        text: string
      }>
      rawSample?: string
      error?: string
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
  generator: {
    checkModel: (quality: string) => Promise<{ exists: boolean; path: string | null }>
    checkWhisper: () => Promise<{ exists: boolean; path: string | null }>
    downloadModel: (quality: string) => Promise<{ success: boolean; path?: string; error?: string }>
    cancelDownload: () => Promise<boolean>
    startGenerate: (params: any) => Promise<{ success: boolean; output?: string; message?: string }>
    cancelGenerate: () => Promise<boolean>
    onDownloadProgress: (callback: (data: {
      percent: number
      downloaded: number
      total: number
      speed: string
    }) => void) => () => void
  }
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
