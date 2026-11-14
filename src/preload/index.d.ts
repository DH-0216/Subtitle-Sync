import type { AiProviderId } from '../shared/aiModels'

export interface IElectronAPI {
  dialog: {
    openVideo: () => Promise<string | null>
    openSubtitles: () => Promise<string[]>
    selectFolder: (defaultPath?: string) => Promise<string | null>
    saveSrt: (defaultPath: string) => Promise<string | null>
  }
  shell: {
    showItemInFolder: (path: string) => Promise<boolean>
    openPath: (path: string) => Promise<boolean>
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
    verifyKey: (provider: AiProviderId, apiKey: string) => Promise<{
      valid: boolean
      message: string
      models?: Array<{ id: string; name: string; description?: string }>
    }>
    fetchModels: (provider: AiProviderId, apiKey: string) => Promise<{
      success: boolean
      models: Array<{ id: string; name: string; description?: string }>
      error?: string
    }>
  }
  engine: {
    checkBinaries: () => Promise<{
      ffmpegReady: boolean
      ffsubsyncReady: boolean
      whisperReady: boolean
      ffmpegPath: string | null
      ffsubsyncPath: string | null
      whisperPath: string | null
    }>
    probe: (videoPath: string) => Promise<{
      tracks: Array<{
        index: number
        codec: string
        language: string
        title: string
        channels: number
      }>
      subtitleTracks: Array<{
        index: number
        streamIndex: number
        codec: string
        language: string
        title: string
        isDefault: boolean
        isForced: boolean
        isText: boolean
      }>
      details: {
        fps: number | null
        duration: string
        durationSec: number | null
        resolution: string
        audioCount: number
        subtitleCount: number
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
    }) => Promise<{ success: boolean; cancelled?: boolean }>
    cancelSync: () => Promise<boolean>
    onEvent: (callback: (data: any) => void) => () => void
  }
  generator: {
    getAvailableModels: (forceRefresh?: boolean) => Promise<{
      models: Array<{
        id: string
        filename: string
        name: string
        label: string
        sizeBytes: number
        sizeFormatted: string
        description: string
        category: 'recommended' | 'standard' | 'high_accuracy' | 'quantized' | 'english_only' | 'custom'
        isDownloaded: boolean
        localPath: string | null
        speedHint?: string
        isRecommended?: boolean
      }>
      source: 'remote' | 'cached' | 'fallback'
      error?: string
    }>
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
  extractor: {
    extractSingle: (params: {
      videoPath: string
      track: {
        index: number
        streamIndex: number
        codec: string
        language: string
        title: string
        isDefault: boolean
        isForced: boolean
        isText: boolean
      }
      outputPath?: string
      outputDir?: string
      cleanTags?: boolean
    }) => Promise<{
      success: boolean
      outputPath?: string
      trackIndex: number
      streamIndex: number
      language: string
      title: string
      cuesCount?: number
      durationStr?: string
      error?: string
      cancelled?: boolean
    }>
    extractMultiple: (params: {
      videoPath: string
      tracks: Array<{
        index: number
        streamIndex: number
        codec: string
        language: string
        title: string
        isDefault: boolean
        isForced: boolean
        isText: boolean
      }>
      outputDir?: string
      cleanTags?: boolean
    }) => Promise<{
      success: boolean
      extracted: Array<{
        success: boolean
        outputPath?: string
        trackIndex: number
        streamIndex: number
        language: string
        title: string
        cuesCount?: number
        durationStr?: string
      }>
      failed: Array<{
        trackIndex: number
        streamIndex: number
        language: string
        title: string
        error?: string
      }>
      totalProcessed: number
      cancelled?: boolean
    }>
    cancel: () => Promise<boolean>
    onEvent: (callback: (data: any) => void) => () => void
  }
  updater: {
    check: () => Promise<{
      updateAvailable: boolean
      currentVersion: string
      latestVersion?: string
      releaseName?: string
      releaseNotes?: string
      publishedAt?: string
      downloadUrl?: string
      assetName?: string
      assetSize?: number
      releaseUrl?: string
    }>
    downloadAndInstall: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>
    cancel: () => Promise<boolean>
    onProgress: (callback: (data: { percent: number; downloaded: number; total: number; speed: string }) => void) => () => void
  }
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}
