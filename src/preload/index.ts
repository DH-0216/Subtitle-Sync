import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AiProviderId } from '../shared/aiModels'
import { cleanPathString, FileValidationItem } from '../shared/fileSanitizer'

const api = {
  getPathForFile: (file: File): string => {
    try {
      const p = webUtils.getPathForFile(file)
      if (p) return cleanPathString(p)
      return cleanPathString((file as any).path || file.name || '')
    } catch {
      return cleanPathString((file as any).path || file.name || '')
    }
  },
  file: {
    cleanPath: (raw: string): string => cleanPathString(raw),
    validate: (paths: string[], expected?: 'video' | 'subtitle' | 'any'): Promise<FileValidationItem[]> =>
      ipcRenderer.invoke('file:validate', { paths, expected })
  },
  dialog: {
    openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
    openVideos: () => ipcRenderer.invoke('dialog:openVideos'),
    openSubtitles: () => ipcRenderer.invoke('dialog:openSubtitles'),
    openFolder: (title?: string) => ipcRenderer.invoke('dialog:openFolder', title),
    selectFolder: (defaultPath?: string) => ipcRenderer.invoke('dialog:selectFolder', defaultPath),
    saveSrt: (defaultPath: string) => ipcRenderer.invoke('dialog:saveSrt', defaultPath)
  },
  batch: {
    scanFolder: (folderPath: string) => ipcRenderer.invoke('batch:scanFolder', folderPath)
  },
  shell: {
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings)
  },
  window: {
    setBackgroundMaterial: (material: 'acrylic' | 'mica' | 'none') =>
      ipcRenderer.invoke('window:setBackgroundMaterial', material)
  },
  notification: {
    show: (title: string, body: string) => ipcRenderer.invoke('notification:show', { title, body })
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
  },
  ai: {
    verifyKey: (provider: AiProviderId, apiKey: string) =>
      ipcRenderer.invoke('ai:verifyKey', { provider, apiKey }),
    fetchModels: (provider: AiProviderId, apiKey: string) =>
      ipcRenderer.invoke('ai:fetchModels', { provider, apiKey })
  },
  engine: {
    checkBinaries: () => ipcRenderer.invoke('engine:checkBinaries'),
    probe: (videoPath: string) => ipcRenderer.invoke('engine:probe', videoPath),
    inspectSubtitle: (subPath: string) => ipcRenderer.invoke('subtitles:inspect', subPath),
    recommend: (videoPath: string, subPath: string) => ipcRenderer.invoke('engine:recommend', videoPath, subPath),
    startSync: (params: {
      video: string
      sub: string
      out: string
      mode: 'Standard' | 'Smart' | 'Split sync'
      trackIndex?: number | null
      subFps?: number | null
    }) => ipcRenderer.invoke('engine:startSync', params),
    cancelSync: () => ipcRenderer.invoke('engine:cancelSync'),
    onEvent: (callback: (data: any) => void) => {
      const sub = (_: any, data: any) => callback(data)
      ipcRenderer.on('sync:event', sub)
      return () => ipcRenderer.removeListener('sync:event', sub)
    }
  },
  generator: {
    getAvailableModels: (forceRefresh?: boolean) => ipcRenderer.invoke('generator:getAvailableModels', forceRefresh),
    checkModel: (quality: string) => ipcRenderer.invoke('generator:checkModel', quality),
    checkWhisper: () => ipcRenderer.invoke('generator:checkWhisper'),
    downloadModel: (quality: string) => ipcRenderer.invoke('generator:downloadModel', quality),
    cancelDownload: () => ipcRenderer.invoke('generator:cancelDownload'),
    startGenerate: (params: any) => ipcRenderer.invoke('generator:startGenerate', params),
    cancelGenerate: (job?: 'translate' | 'generate') => ipcRenderer.invoke('generator:cancelGenerate', job),
    onDownloadProgress: (callback: (data: any) => void) => {
      const sub = (_: any, data: any) => callback(data)
      ipcRenderer.on('generator:downloadProgress', sub)
      return () => ipcRenderer.removeListener('generator:downloadProgress', sub)
    }
  },
  extractor: {
    extractSingle: (params: {
      videoPath: string
      track: any
      outputPath?: string
      outputDir?: string
      cleanTags?: boolean
    }) => ipcRenderer.invoke('extractor:extractSingle', params),
    extractMultiple: (params: {
      videoPath: string
      tracks: any[]
      outputDir?: string
      cleanTags?: boolean
    }) => ipcRenderer.invoke('extractor:extractMultiple', params),
    cancel: () => ipcRenderer.invoke('extractor:cancel'),
    onEvent: (callback: (data: any) => void) => {
      const sub = (_: any, data: any) => callback(data)
      ipcRenderer.on('extractor:event', sub)
      return () => ipcRenderer.removeListener('extractor:event', sub)
    }
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    downloadAndInstall: (downloadUrl: string) => ipcRenderer.invoke('updater:downloadAndInstall', { downloadUrl }),
    restartAndInstall: () => ipcRenderer.invoke('updater:restartAndInstall'),
    cancel: () => ipcRenderer.invoke('updater:cancel'),
    onProgress: (callback: (data: any) => void) => {
      const sub = (_: any, data: any) => callback(data)
      ipcRenderer.on('updater:progress', sub)
      return () => ipcRenderer.removeListener('updater:progress', sub)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
