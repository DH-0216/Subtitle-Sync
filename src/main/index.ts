import { app, shell, BrowserWindow, ipcMain, dialog, safeStorage, Menu, MenuItem, clipboard } from 'electron'
import { join, basename } from 'path'
import * as fs from 'fs'
import { probeVideoFile, findBinary, getSubtitleSyncDetails } from './media'
import { SyncEngine } from './syncEngine'
import { parseSrt } from './srtTools'
import { analyzeRecommendation } from './recommender'
import {
  getWhisperModelPath,
  getWhisperBinary,
  downloadWhisperModel,
  cancelModelDownload,
  executeSubtitleGeneration,
  cancelSubtitleGeneration
} from './generatorEngine'
import { EXTERNAL_LINKS, getGeminiVerifyUrl } from '@shared/links'
import { formatUserFriendlyError } from '@shared/errorUtils'

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

  // Helper: Fetch available models from AI Provider
  const fetchAvailableModels = async (
    provider: 'gemini' | 'openai',
    apiKey: string
  ): Promise<{ success: boolean; models: Array<{ id: string; name: string; description?: string }>; error?: string }> => {
    const cleanKey = apiKey.trim()
    if (!cleanKey) {
      return { success: false, models: [], error: 'Please enter an API Key first.' }
    }

    try {
      if (provider === 'gemini') {
        const url = getGeminiVerifyUrl(cleanKey)
        const res = await fetch(url)
        if (!res.ok) {
          const errJson = await res.json().catch(() => null)
          const errMsg = errJson?.error?.message || `HTTP ${res.status}`
          return { success: false, models: [], error: errMsg }
        }
        const data = await res.json()
        const rawList = Array.isArray(data?.models) ? data.models : []

        // Filter for generation models that support generateContent
        const filtered = rawList.filter((m: any) => {
          const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
          return methods.includes('generateContent')
        })

        const formatted = filtered.map((m: any) => {
          const rawId = (m.name || '').replace(/^models\//, '')
          const displayName = m.displayName || rawId
          return {
            id: rawId,
            name: displayName !== rawId ? `${displayName} (${rawId})` : rawId,
            description: m.description || ''
          }
        })

        // Sort: prioritize high-capacity stable flash models at the top
        const stablePriority = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite']
        formatted.sort((a, b) => {
          const aPrio = stablePriority.indexOf(a.id)
          const bPrio = stablePriority.indexOf(b.id)
          if (aPrio !== -1 && bPrio !== -1) return aPrio - bPrio
          if (aPrio !== -1) return -1
          if (bPrio !== -1) return 1

          const aFlash = a.id.toLowerCase().includes('flash')
          const bFlash = b.id.toLowerCase().includes('flash')
          if (aFlash && !bFlash) return -1
          if (!aFlash && bFlash) return 1
          return b.id.localeCompare(a.id)
        })

        return { success: true, models: formatted }
      } else {
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

        // Filter for chat completion models (gpt-4, gpt-3.5, o1, o3, chatgpt-)
        const validPrefixes = ['gpt-4', 'gpt-3.5', 'o1', 'o3', 'chatgpt-']
        const exclude = ['realtime', 'audio', 'tts', 'transcription', 'whisper', 'embedding', 'dall-e']

        const formatted = rawList
          .filter((m: any) => {
            const id = (m.id || '').toLowerCase()
            const matchesPrefix = validPrefixes.some((p) => id.startsWith(p))
            const isExcluded = exclude.some((e) => id.includes(e))
            return matchesPrefix && !isExcluded
          })
          .map((m: any) => ({
            id: m.id,
            name: m.id,
            description: ''
          }))
          .sort((a, b) => {
            const aMini = a.id.includes('mini')
            const bMini = b.id.includes('mini')
            if (aMini && !bMini) return -1
            if (!aMini && bMini) return 1
            return b.id.localeCompare(a.id)
          })

        return { success: true, models: formatted }
      }
    } catch (err: any) {
      const friendlyErr = formatUserFriendlyError(err)
      return { success: false, models: [], error: friendlyErr }
    }
  }

  // IPC: Verify AI API Key
  ipcMain.handle('ai:verifyKey', async (_event, { provider, apiKey }: { provider: 'gemini' | 'openai'; apiKey: string }) => {
    if (!apiKey || !apiKey.trim()) {
      return { valid: false, message: 'Please enter an API Key first.' }
    }
    const cleanKey = apiKey.trim()
    const result = await fetchAvailableModels(provider, cleanKey)

    if (result.success) {
      const providerName = provider === 'gemini' ? 'Gemini' : 'OpenAI'
      return {
        valid: true,
        message: `${providerName} API Key is valid and active (${result.models.length} models detected)!`,
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
  ipcMain.handle('ai:fetchModels', async (_event, { provider, apiKey }: { provider: 'gemini' | 'openai'; apiKey: string }) => {
    return fetchAvailableModels(provider, apiKey)
  })

  // IPC: Check Binaries Status
  ipcMain.handle('engine:checkBinaries', () => {
    const ffmpeg = findBinary('ffmpeg')
    const ffsubsync = findBinary('ffsubsync')
    return {
      ffmpegReady: Boolean(ffmpeg),
      ffsubsyncReady: Boolean(ffsubsync),
      ffmpegPath: ffmpeg,
      ffsubsyncPath: ffsubsync
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

  // IPC: Read subtitle preview cues
  ipcMain.handle('subtitles:preview', async (_event, subPath: string, maxCues = 60) => {
    try {
      if (!fs.existsSync(subPath)) return null
      const content = fs.readFileSync(subPath, 'utf-8')
      const cues = parseSrt(content)
      return {
        fileName: basename(subPath),
        fullPath: subPath,
        totalCues: cues.length,
        cues: cues.slice(0, maxCues),
        rawSample: content.slice(0, 3000)
      }
    } catch (e: any) {
      return { error: e.message }
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

    const logCb = (line: string) => {
      event.sender.send('sync:event', { type: 'log', message: line })
    }
    const statusCb = (status: string) => {
      event.sender.send('sync:event', { type: 'status', message: status })
    }
    const progressCb = (percent: number, message?: string) => {
      event.sender.send('sync:event', { type: 'progress', percent, message })
    }

    activeSyncEngine = new SyncEngine(logCb, statusCb, progressCb)

    try {
      let result: { success: boolean; score: number | null }
      if (params.mode === 'Smart') {
        result = await activeSyncEngine.runSmart(params)
      } else if (params.mode === 'Split sync') {
        result = await activeSyncEngine.runSplit(params)
      } else {
        result = await activeSyncEngine.runStandard(params)
      }

      if (activeSyncEngine?.isCancelled()) {
        if (params.out && fs.existsSync(params.out)) {
          try {
            fs.unlinkSync(params.out)
          } catch (e) {}
        }
        activeSyncEngine = null
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
      activeSyncEngine = null
      return { success: result.success }
    } catch (e: any) {
      event.sender.send('sync:event', { type: 'error', message: e.message })
      activeSyncEngine = null
      return { success: false }
    }
  })

  // IPC: Cancel Sync
  ipcMain.handle('engine:cancelSync', () => {
    if (activeSyncEngine) {
      activeSyncEngine.cancel()
      activeSyncEngine = null
      return true
    }
    return false
  })

  // IPC: Generator Handlers
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
