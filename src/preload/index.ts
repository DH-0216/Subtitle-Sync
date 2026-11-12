import { contextBridge, ipcRenderer } from 'electron'

const api = {
  dialog: {
    openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
    openSubtitles: () => ipcRenderer.invoke('dialog:openSubtitles')
  },
  shell: {
    showItemInFolder: (path: string) => ipcRenderer.invoke('shell:showItemInFolder', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: any) => ipcRenderer.invoke('settings:save', settings)
  },
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text)
  },
  ai: {
    verifyKey: (provider: 'gemini' | 'openai', apiKey: string) =>
      ipcRenderer.invoke('ai:verifyKey', { provider, apiKey }),
    fetchModels: (provider: 'gemini' | 'openai', apiKey: string) =>
      ipcRenderer.invoke('ai:fetchModels', { provider, apiKey })
  },
  engine: {
    checkBinaries: () => ipcRenderer.invoke('engine:checkBinaries'),
    probe: (videoPath: string) => ipcRenderer.invoke('engine:probe', videoPath),
    inspectSubtitle: (subPath: string) => ipcRenderer.invoke('subtitles:inspect', subPath),
    previewSubtitle: (subPath: string, maxCues?: number) => ipcRenderer.invoke('subtitles:preview', subPath, maxCues),
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
    checkModel: (quality: string) => ipcRenderer.invoke('generator:checkModel', quality),
    checkWhisper: () => ipcRenderer.invoke('generator:checkWhisper'),
    downloadModel: (quality: string) => ipcRenderer.invoke('generator:downloadModel', quality),
    cancelDownload: () => ipcRenderer.invoke('generator:cancelDownload'),
    startGenerate: (params: any) => ipcRenderer.invoke('generator:startGenerate', params),
    cancelGenerate: () => ipcRenderer.invoke('generator:cancelGenerate'),
    onDownloadProgress: (callback: (data: any) => void) => {
      const sub = (_: any, data: any) => callback(data)
      ipcRenderer.on('generator:downloadProgress', sub)
      return () => ipcRenderer.removeListener('generator:downloadProgress', sub)
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
