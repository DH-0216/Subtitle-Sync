import { app, shell, BrowserWindow, ipcMain, dialog, safeStorage, Menu, MenuItem, clipboard, Notification } from 'electron'
import { join, basename } from 'path'
import * as fs from 'fs'
import { probeVideoFile, findBinary, getSubtitleSyncDetails } from './media'
import { SyncEngine } from './syncEngine'
import { parseSrt, getUniqueFilePath } from './srtTools'
import { analyzeRecommendation } from './recommender'
import {
  getWhisperModelPath,
  getWhisperBinary,
  downloadWhisperModel,
  cancelModelDownload,
  executeSubtitleGeneration,
  cancelSubtitleGeneration,
  getAvailableWhisperModels
} from './generatorEngine'
import {
  isGeminiModelExcluded,
  buildDynamicGeminiChain,
  buildDynamicOpenAiChain,
  AiProviderId,
  getAiProvider
} from '@shared/aiModels'
import {
  extractSingleSubtitleTrack,
  extractMultipleSubtitleTracks,
  cancelExtraction
} from './extractorEngine'
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  cancelUpdateDownload,
  restartAndInstallApp
} from './updater'
import { EXTERNAL_LINKS, getGeminiVerifyUrl } from '@shared/links'
import { formatUserFriendlyError } from '@shared/errorUtils'

// Prevent unhandled errors (e.g. offline network sockets, unexpected stream breaks) from crashing the application
process.on('uncaughtException', (err) => {
  console.error('[MAIN PROCESS] Uncaught exception safely handled:', err)
})

process.on('unhandledRejection', (reason) => {
  console.warn('[MAIN PROCESS] Unhandled rejection safely handled:', reason)
})

let mainWindow: BrowserWindow | null = null
let activeSyncEngine: SyncEngine | null = null

// Settings file
const settingsDir = app.getPath('userData')
const settingsFile = join(settingsDir, 'settings.json')

function encryptSecret(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plainText)
      return encrypted.toString('base64')
    }
  } catch (err) {
    console.error('Failed to encrypt secret with DPAPI:', err)
  }
  return plainText
}

function decryptSecret(cipherText: string): string {
  if (!cipherText || typeof cipherText !== 'string') return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(cipherText, 'base64')
      return safeStorage.decryptString(buffer)
    }
  } catch (err) {
    // If decryption fails (e.g. legacy plain text), fallback to raw
    return cipherText
  }
  return cipherText
}

function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
      const settings = { ...raw }

      // Decrypt encrypted API key if present
      if (settings.aiApiKeyEncrypted) {
        settings.aiApiKey = decryptSecret(settings.aiApiKeyEncrypted)
        delete settings.aiApiKeyEncrypted
      } else if (settings.aiApiKey) {
        // Automatically migrate legacy plain-text key to encrypted format on disk
        saveSettings(settings)
      }

      return settings
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return { theme: 'dark', checkUpdates: true, defaultMode: 'Standard' }
}

function saveSettings(settings: any) {
  try {
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true })
    }

    const toSave = { ...settings }

    // Encrypt sensitive API key using OS DPAPI before writing to disk
    if (toSave.aiApiKey) {
      toSave.aiApiKeyEncrypted = encryptSecret(toSave.aiApiKey)
      delete toSave.aiApiKey // Remove plain-text key from disk JSON
    }

    fs.writeFileSync(settingsFile, JSON.stringify(toSave, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Failed to save settings:', e)
    return false
  }
}

function createWindow(): void {
  const iconPath = join(__dirname, '../../app_icon.ico')

  mainWindow = new BrowserWindow({
    width: 900,
    height: 840,
    minWidth: 720,
    minHeight: 580,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0B0F19',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Set application edit menu for standard keyboard shortcuts (Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z)
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]
  const appMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(appMenu)

  // Context Menu for right-click on input, textarea, and selectable text
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const contextMenu = new Menu()
    if (params.isEditable) {
      contextMenu.append(new MenuItem({ label: 'Cut', role: 'cut', accelerator: 'CmdOrCtrl+X' }))
      contextMenu.append(new MenuItem({ label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' }))
      contextMenu.append(new MenuItem({ label: 'Paste', role: 'paste', accelerator: 'CmdOrCtrl+V' }))
      contextMenu.append(new MenuItem({ type: 'separator' }))
      contextMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }))
      contextMenu.popup()
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      contextMenu.append(new MenuItem({ label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' }))
      contextMenu.append(new MenuItem({ label: 'Select All', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }))
      contextMenu.popup()
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.subtitlesync.studio')
  }

  // IPC: Desktop Notifications
  ipcMain.handle('notification:show', (_event, { title, body }: { title: string; body: string }) => {
    try {
      if (Notification.isSupported()) {
        const iconPath = join(__dirname, '../../app_icon.png')
        const notif = new Notification({
          title,
          body,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: false
        })
        notif.on('click', () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.show()
            mainWindow.focus()
          }
        })
        notif.show()
        return true
      }
    } catch (err) {
      console.error('Failed to show notification:', err)
    }
    return false
  })
  // IPC: File Dialogs
  ipcMain.handle('dialog:openVideo', async () => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Movie / Video',
      properties: ['openFile'],
      filters: [
        { name: 'Video Files', extensions: ['mkv', 'mp4', 'avi', 'mov', 'm4v', 'webm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return res.canceled ? null : res.filePaths[0]
  })

  ipcMain.handle('dialog:openSubtitles', async () => {
    if (!mainWindow) return []
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Out-of-Sync Subtitles',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Subtitle Files', extensions: ['srt', 'ass', 'ssa', 'vtt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('shell:showItemInFolder', async (_event, fullPath: string) => {
    if (fullPath && fs.existsSync(fullPath)) {
      try {
        const stat = fs.statSync(fullPath)
        if (stat.isDirectory()) {
          // Open directly INSIDE the directory
          await shell.openPath(fullPath)
          return true
        }
        shell.showItemInFolder(fullPath)
        return true
      } catch (e) {
        shell.showItemInFolder(fullPath)
        return true
      }
    }
    return false
  })

  ipcMain.handle('shell:openPath', async (_event, targetPath: string) => {
    if (targetPath && fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath)
        const folder = stat.isDirectory() ? targetPath : join(targetPath, '..')
        await shell.openPath(folder)
        return true
      } catch (e) {
        return false
      }
    }
    return false
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url)
      return true
    }
    return false
  })

  // IPC: Settings
  ipcMain.handle('settings:load', () => loadSettings())
  ipcMain.handle('settings:save', (_event, settings) => saveSettings(settings))

  // IPC: Clipboard
  ipcMain.handle('clipboard:readText', () => clipboard.readText())
  ipcMain.handle('clipboard:writeText', (_event, text: string) => clipboard.writeText(text))

  // Helper types & registry for provider model fetchers
  type ModelFetcher = (
    apiKey: string
  ) => Promise<{ success: boolean; models: Array<{ id: string; name: string; description?: string }>; error?: string }>

  const fetchGeminiModels: ModelFetcher = async (cleanKey) => {
    const url = getGeminiVerifyUrl(cleanKey)
    const res = await fetch(url)
    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`
      return { success: false, models: [], error: errMsg }
    }
    const data = await res.json()
    const rawList = Array.isArray(data?.models) ? data.models : []

    const supported = rawList.filter((m: any) => {
      const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
      return methods.includes('generateContent')
    })
    const rawIds = supported.map((m: any) => (m.name || '').replace(/^models\//, ''))
    const orderedChain = buildDynamicGeminiChain(rawIds)

    const rawMap = new Map<string, any>()
    for (const m of supported) {
      const id = (m.name || '').replace(/^models\//, '')
      rawMap.set(id, m)
    }

    const formatted = orderedChain.map((id) => {
      const m = rawMap.get(id)
      const displayName = m?.displayName || id
      return {
        id,
        name: displayName !== id ? `${displayName} (${id})` : id,
        description: m?.description || ''
      }
    })

    return { success: true, models: formatted }
  }

  const fetchOpenAiModels: ModelFetcher = async (cleanKey) => {
    const url = EXTERNAL_LINKS.OPENAI_MODELS_API
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cleanKey}` }
    })
    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      const errMsg = errJson?.error?.message || `HTTP ${res.status}`
      return { success: false, models: [], error: errMsg }
    }
    const data = await res.json()
    const rawList = Array.isArray(data?.data) ? data.data : []
    const rawIds = rawList.map((m: any) => m.id || '')

    const orderedChain = buildDynamicOpenAiChain(rawIds)
    const formatted = orderedChain.map((id) => ({
      id,
      name: id,
      description: ''
    }))

    return { success: true, models: formatted }
  }

  /**
   * Extensible Model Fetchers Registry
   * To add a new provider in the future, simply add its fetcher function here.
   */
  const AI_MODEL_FETCHERS: Record<AiProviderId, ModelFetcher> = {
    gemini: fetchGeminiModels,
    openai: fetchOpenAiModels
  }

  // Helper: Fetch available models from AI Provider
  const fetchAvailableModels = async (
    provider: AiProviderId,
    apiKey: string
  ): Promise<{ success: boolean; models: Array<{ id: string; name: string; description?: string }>; error?: string }> => {
    const cleanKey = apiKey.trim()
    if (!cleanKey) {
      return { success: false, models: [], error: 'Please enter an API Key first.' }
    }

    const fetcher = AI_MODEL_FETCHERS[provider]
    if (!fetcher) {
      return { success: false, models: [], error: `Unsupported AI provider: ${provider}` }
    }

    try {
      return await fetcher(cleanKey)
    } catch (err: any) {
      const friendlyErr = formatUserFriendlyError(err)
      return { success: false, models: [], error: friendlyErr }
    }
  }

  // IPC: Verify AI API Key
  ipcMain.handle('ai:verifyKey', async (_event, { provider, apiKey }: { provider: AiProviderId; apiKey: string }) => {
    if (!apiKey || !apiKey.trim()) {
      return { valid: false, message: 'Please enter an API Key first.' }
    }
    const cleanKey = apiKey.trim()
    const result = await fetchAvailableModels(provider, cleanKey)

    if (result.success) {
      const providerMeta = getAiProvider(provider)
      return {
        valid: true,
        message: `${providerMeta.name} API Key is valid and active (${result.models.length} models detected)!`,
        models: result.models
      }
    } else {
      const friendlyErr = formatUserFriendlyError(result.error)
      return {
        valid: false,
        message: friendlyErr,
        models: []
      }
    }
  })

  // IPC: Fetch Available AI Models
  ipcMain.handle('ai:fetchModels', async (_event, { provider, apiKey }: { provider: AiProviderId; apiKey: string }) => {
    return fetchAvailableModels(provider, apiKey)
  })

  // IPC: Check Binaries Status
  ipcMain.handle('engine:checkBinaries', () => {
    const ffmpeg = findBinary('ffmpeg')
    const ffsubsync = findBinary('ffsubsync')
    const whisper = getWhisperBinary()
    return {
      ffmpegReady: Boolean(ffmpeg),
      ffsubsyncReady: Boolean(ffsubsync),
      whisperReady: Boolean(whisper),
      ffmpegPath: ffmpeg,
      ffsubsyncPath: ffsubsync,
      whisperPath: whisper
    }
  })

  // IPC: Probe Video
  ipcMain.handle('engine:probe', async (_event, videoPath: string) => {
    return probeVideoFile(videoPath)
  })

  // IPC: Read and count subtitle cues with full media metadata
  ipcMain.handle('subtitles:inspect', async (_event, subPath: string) => {
    try {
      if (!fs.existsSync(subPath)) return null
      const content = fs.readFileSync(subPath, 'utf-8')
      const cues = parseSrt(content)
      const details = getSubtitleSyncDetails(subPath, cues, content)
      return {
        cueCount: cues.length,
        durationMs: cues.length > 0 ? Math.max(...cues.map((c) => c.endMs)) : 0,
        fps: details.fps,
        tag: details.tag,
        lines: details.lines,
        span: details.span
      }
    } catch (e) {
      return null
    }
  })

  // IPC: Recommender
  ipcMain.handle('engine:recommend', async (_event, videoPath: string, subPath: string) => {
    try {
      const probeRes = await probeVideoFile(videoPath)
      const content = fs.readFileSync(subPath, 'utf-8')
      const cues = parseSrt(content)
      return analyzeRecommendation(
        probeRes.details,
        cues,
        subPath.split(/[\/\\]/).pop() || '',
        videoPath.split(/[\/\\]/).pop() || '',
        content
      )
    } catch (e) {
      return {
        mode: 'Standard',
        title: '🎬 Ready to synchronize subtitles with reference movie.',
        hint: 'Defaulting to Standard sync.',
        type: 'info'
      }
    }
  })

  // IPC: Start Sync
  ipcMain.handle('engine:startSync', async (event, params: {
    video: string
    sub: string
    out: string
    mode: 'Standard' | 'Smart' | 'Split sync'
    trackIndex?: number | null
    subFps?: number | null
  }) => {
    if (activeSyncEngine) {
      activeSyncEngine.cancel()
    }

    // Auto-increment (1), (2), etc. if output file already exists
    params.out = getUniqueFilePath(params.out)

    const logCb = (line: string) => {
      event.sender.send('sync:event', { type: 'log', message: line })
    }
    const statusCb = (status: string) => {
      event.sender.send('sync:event', { type: 'status', message: status })
    }
    const progressCb = (percent: number, message?: string) => {
      event.sender.send('sync:event', { type: 'progress', percent, message })
    }

    if (!params.video || !fs.existsSync(params.video)) {
      logCb(`[ERROR] Video file does not exist or cannot be accessed: "${params.video}"`)
      statusCb('Failed: Video file not found')
      event.sender.send('sync:event', {
        type: 'done',
        success: false,
        score: null
      })
      return { success: false, error: 'Video file not found' }
    }

    if (!params.sub || !fs.existsSync(params.sub)) {
      logCb(`[ERROR] Subtitle file does not exist or cannot be accessed: "${params.sub}"`)
      statusCb('Failed: Subtitle file not found')
      event.sender.send('sync:event', {
        type: 'done',
        success: false,
        score: null
      })
      return { success: false, error: 'Subtitle file not found' }
    }

    const currentEngine = new SyncEngine(logCb, statusCb, progressCb)
    activeSyncEngine = currentEngine

    try {
      let result: { success: boolean; score: number | null }
      if (params.mode === 'Smart') {
        result = await currentEngine.runSmart(params)
      } else if (params.mode === 'Split sync') {
        result = await currentEngine.runSplit(params)
      } else {
        result = await currentEngine.runStandard(params)
      }

      if (currentEngine.isCancelled() || (activeSyncEngine && activeSyncEngine.isCancelled())) {
        if (params.out && fs.existsSync(params.out)) {
          try {
            fs.unlinkSync(params.out)
          } catch (e) {}
        }
        if (activeSyncEngine === currentEngine) {
          activeSyncEngine = null
        }
        return { success: false, cancelled: true }
      }

      if (result.success) {
        event.sender.send('sync:event', {
          type: 'done',
          success: true,
          score: result.score,
          output: params.out
        })
      } else {
        event.sender.send('sync:event', {
          type: 'done',
          success: false,
          score: null
        })
      }
      if (activeSyncEngine === currentEngine) {
        activeSyncEngine = null
      }
      return { success: result.success, out: params.out }
    } catch (e: any) {
      event.sender.send('sync:event', { type: 'error', message: e.message })
      if (activeSyncEngine === currentEngine) {
        activeSyncEngine = null
      }
      return { success: false }
    }
  })

  // IPC: Cancel Sync
  ipcMain.handle('engine:cancelSync', () => {
    if (activeSyncEngine) {
      activeSyncEngine.cancel()
      return true
    }
    return false
  })

  // IPC: Generator Handlers
  ipcMain.handle('generator:getAvailableModels', (_event, forceRefresh?: boolean) => {
    return getAvailableWhisperModels(forceRefresh)
  })

  ipcMain.handle('generator:checkModel', (_event, quality: string) => {
    const path = getWhisperModelPath(quality)
    return { exists: Boolean(path), path }
  })

  ipcMain.handle('generator:checkWhisper', () => {
    const path = getWhisperBinary()
    return { exists: Boolean(path), path }
  })

  ipcMain.handle('generator:downloadModel', async (event, quality: string) => {
    try {
      const savedPath = await downloadWhisperModel(quality, (progressData) => {
        event.sender.send('generator:downloadProgress', progressData)
      })
      return { success: true, path: savedPath }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('generator:cancelDownload', () => {
    cancelModelDownload()
    return true
  })

  ipcMain.handle('generator:startGenerate', async (event, params) => {
    try {
      const result = await executeSubtitleGeneration(params, (data) => {
        event.sender.send('sync:event', data)
      })
      return result
    } catch (e: any) {
      return { success: false, message: e.message }
    }
  })

  ipcMain.handle('generator:cancelGenerate', () => {
    cancelSubtitleGeneration()
    return true
  })

  // IPC: Extractor Handlers
  ipcMain.handle('extractor:extractSingle', async (event, params) => {
    const logCb = (line: string) => {
      event.sender.send('extractor:event', { type: 'log', message: line })
    }
    return extractSingleSubtitleTrack(params, logCb)
  })

  ipcMain.handle('extractor:extractMultiple', async (event, params) => {
    const progressCb = (data: { percent: number; message: string; currentTrack?: string }) => {
      event.sender.send('extractor:event', { type: 'progress', ...data })
    }
    const logCb = (line: string) => {
      event.sender.send('extractor:event', { type: 'log', message: line })
    }
    return extractMultipleSubtitleTracks(params, progressCb, logCb)
  })

  ipcMain.handle('extractor:cancel', () => {
    cancelExtraction()
    return true
  })

  ipcMain.handle('dialog:selectFolder', async (_event, defaultPath?: string) => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder for Extracted Subtitles',
      defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled ? null : res.filePaths[0]
  })

  ipcMain.handle('dialog:saveSrt', async (_event, defaultPath: string) => {
    if (!mainWindow) return null
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Extracted Subtitle As',
      defaultPath,
      filters: [{ name: 'SubRip Subtitle (*.srt)', extensions: ['srt'] }]
    })
    return res.canceled ? null : res.filePath
  })

  // IPC: In-App Auto-Updater Handlers
  ipcMain.handle('updater:check', async () => {
    try {
      return await checkForAppUpdate()
    } catch (e: any) {
      console.warn('[UPDATER] Handled check error:', e?.message || e)
      return {
        updateAvailable: false,
        currentVersion: APP_VERSION.replace(/^v/i, ''),
        error: e?.message || 'Could not connect to update server'
      }
    }
  })

  ipcMain.handle('updater:downloadAndInstall', async (event, { downloadUrl }: { downloadUrl: string }) => {
    try {
      const res = await downloadAndInstallUpdate(downloadUrl, (progress) => {
        event.sender.send('updater:progress', progress)
      })
      return res
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to download update' }
    }
  })

  ipcMain.handle('updater:cancel', () => {
    return cancelUpdateDownload()
  })

  ipcMain.handle('updater:restartAndInstall', () => {
    restartAndInstallApp()
    return true
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
