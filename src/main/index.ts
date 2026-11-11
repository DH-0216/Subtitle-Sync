import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { probeVideoFile, findBinary, getSubtitleSyncDetails } from './media'
import { SyncEngine } from './syncEngine'
import { parseSrt } from './srtTools'
import { analyzeRecommendation } from './recommender'

let mainWindow: BrowserWindow | null = null
let activeSyncEngine: SyncEngine | null = null

// Settings file
const settingsDir = app.getPath('userData')
const settingsFile = join(settingsDir, 'settings.json')

function loadSettings() {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
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
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
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
      shell.showItemInFolder(fullPath)
      return true
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

      event.sender.send('sync:event', {
        type: 'done',
        success: result.success,
        score: result.score,
        output: params.out
      })
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
