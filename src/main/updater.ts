import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'
import { autoUpdater, CancellationToken } from 'electron-updater'
import { EXTERNAL_LINKS } from '../shared/links'
import { APP_VERSION, compareVersions } from '../shared/version'

// Configure differential auto-updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.allowDowngrade = false
autoUpdater.allowPrerelease = false

// Silence internal logger and handle offline network safely
autoUpdater.logger = {
  info: (msg: any) => console.log('[UPDATER]', msg),
  warn: (msg: any) => console.warn('[UPDATER]', msg),
  error: (msg: any) => console.warn('[UPDATER]', msg),
  debug: () => {}
}

// Permanent safety handler: Never crash app if network is offline
export function registerPermanentErrorHandler(): void {
  autoUpdater.removeAllListeners('error')
  autoUpdater.on('error', (err) => {
    console.warn('[UPDATER] Handled background updater event (offline or network unavailable):', err?.message || err)
  })
}

registerPermanentErrorHandler()

let activeCancellationToken: CancellationToken | null = null
let downloadedInstallerPath: string | null = null

export interface UpdateInfo {
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
  error?: string
}

export interface UpdateProgress {
  percent: number
  downloaded: number
  total: number
  speed: string
}

export interface UpdateDownloadResult {
  success: boolean
  readyToInstall?: boolean
  error?: string
}

let activeRequest: http.ClientRequest | null = null
let activeFileStream: fs.WriteStream | null = null
let isDownloadCancelled = false

export { compareVersions }

/**
 * Check GitHub Releases for newer version of Subtitle Sync Studio
 */
export async function checkForAppUpdate(): Promise<UpdateInfo> {
  const currentVersion = APP_VERSION.replace(/^v/i, '')

  try {
    const res = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': `SubtitleSyncStudio/${APP_VERSION}`
      }
    })

    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`)
    }

    const data = await res.json()
    const latestTag = (data.tag_name || '').trim()
    const cleanLatest = latestTag.replace(/^v/i, '')

    const isNewer = compareVersions(cleanLatest, currentVersion) > 0

    if (!isNewer) {
      return {
        updateAvailable: false,
        currentVersion
      }
    }

    // Find Windows Installer asset (SubtitleSync-Setup.exe or any .exe installer)
    const assets = Array.isArray(data.assets) ? data.assets : []
    const setupAsset =
      assets.find((a: any) => (a.name || '').toLowerCase() === 'subtitlesync-setup.exe') ||
      assets.find((a: any) => (a.name || '').toLowerCase().includes('setup') && (a.name || '').endsWith('.exe')) ||
      assets.find((a: any) => (a.name || '').endsWith('.exe') && !(a.name || '').toLowerCase().includes('portable')) ||
      assets.find((a: any) => (a.name || '').endsWith('.exe'))

    return {
      updateAvailable: true,
      currentVersion,
      latestVersion: cleanLatest,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || 'No release notes provided for this version.',
      publishedAt: data.published_at,
      downloadUrl: setupAsset?.browser_download_url,
      assetName: setupAsset?.name || 'SubtitleSync-Setup.exe',
      assetSize: setupAsset?.size,
      releaseUrl: data.html_url || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE
    }
  } catch (err: any) {
    console.warn('[UPDATER] Failed to check for updates:', err?.message || err)
    return {
      updateAvailable: false,
      currentVersion,
      error: err?.message || 'Could not connect to update server'
    }
  }
}

/**
 * Direct HTTP installer download (fallback when differential update is unavailable or in development mode)
 */
function executeDirectDownload(
  downloadUrl: string,
  onProgress: (progress: UpdateProgress) => void
): Promise<UpdateDownloadResult> {
  return new Promise((resolve, reject) => {
    isDownloadCancelled = false
    const tempDir = app.getPath('temp')
    const targetFile = join(tempDir, 'SubtitleSync-Setup-Update.exe')
    const partFile = `${targetFile}.part`

    let downloadedBytes = 0
    let totalBytes = 0
    let lastTime = Date.now()
    let lastBytes = 0
    let currentSpeed = '0 MB/s'

    // Clean up any stale part file before starting
    if (fs.existsSync(partFile)) {
      try {
        fs.unlinkSync(partFile)
      } catch {}
    }

    const executeRequest = (currentUrl: string, redirectCount = 0) => {
      if (isDownloadCancelled) {
        reject(new Error('Download cancelled by user.'))
        return
      }

      if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading update.'))
        return
      }

      const client = currentUrl.startsWith('https') ? https : http
      const req = client.get(
        currentUrl,
        {
          headers: {
            'User-Agent': `SubtitleSyncStudio/${APP_VERSION}`
          }
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            executeRequest(res.headers.location, redirectCount + 1)
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download update installer (HTTP ${res.statusCode})`))
            return
          }

          totalBytes = parseInt(res.headers['content-length'] || '0', 10)
          activeFileStream = fs.createWriteStream(partFile)

          res.on('data', (chunk) => {
            if (isDownloadCancelled) {
              res.destroy()
              activeFileStream?.close()
              try {
                if (fs.existsSync(partFile)) fs.unlinkSync(partFile)
              } catch {}
              reject(new Error('Download cancelled by user.'))
              return
            }

            downloadedBytes += chunk.length
            const now = Date.now()
            const timeDiff = (now - lastTime) / 1000

            if (timeDiff >= 0.4) {
              const bytesDiff = downloadedBytes - lastBytes
              const bytesPerSec = bytesDiff / timeDiff
              const mbPerSec = bytesPerSec / (1024 * 1024)
              currentSpeed = `${mbPerSec.toFixed(1)} MB/s`
              lastTime = now
              lastBytes = downloadedBytes
            }

            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
            onProgress({
              percent,
              downloaded: downloadedBytes,
              total: totalBytes,
              speed: currentSpeed
            })
          })

          res.pipe(activeFileStream)

          activeFileStream.on('finish', () => {
            activeFileStream?.close(() => {
              if (isDownloadCancelled) {
                try {
                  if (fs.existsSync(partFile)) fs.unlinkSync(partFile)
                } catch {}
                reject(new Error('Download cancelled by user.'))
                return
              }

              try {
                if (fs.existsSync(targetFile)) {
                  fs.unlinkSync(targetFile)
                }
                fs.renameSync(partFile, targetFile)
                downloadedInstallerPath = targetFile

                resolve({ success: true, readyToInstall: true })
              } catch (err: any) {
                reject(new Error(`Failed to save installer: ${err.message}`))
              }
            })
          })

          activeFileStream.on('error', (err) => {
            reject(err)
          })
        }
      )

      activeRequest = req

      req.on('error', (err) => {
        if (isDownloadCancelled) {
          resolve({ success: false, error: 'Cancelled' })
        } else {
          reject(err)
        }
      })
    }

    executeRequest(downloadUrl)
  })
}

/**
 * Download update with differential delta support when packaged, with seamless fallback.
 */
export function downloadAndInstallUpdate(
  downloadUrl: string,
  onProgress: (progress: UpdateProgress) => void
): Promise<UpdateDownloadResult> {
  isDownloadCancelled = false

  if (app.isPackaged) {
    return new Promise((resolve) => {
      activeCancellationToken = new CancellationToken()

      autoUpdater.removeAllListeners('download-progress')
      autoUpdater.removeAllListeners('update-downloaded')
      autoUpdater.removeAllListeners('error')

      autoUpdater.on('download-progress', (progressObj) => {
        const speedMb = (progressObj.bytesPerSecond / (1024 * 1024)).toFixed(1)
        onProgress({
          percent: progressObj.percent,
          downloaded: progressObj.transferred,
          total: progressObj.total,
          speed: `${speedMb} MB/s`
        })
      })

      autoUpdater.once('update-downloaded', () => {
        registerPermanentErrorHandler()
        resolve({ success: true, readyToInstall: true })
      })

      let fallbackTriggered = false
      const handleFallback = (err?: any) => {
        if (fallbackTriggered) return
        fallbackTriggered = true
        registerPermanentErrorHandler()
        console.warn('[UPDATER] Differential update not available or failed, falling back to full download:', err?.message || err)
        executeDirectDownload(downloadUrl, onProgress)
          .then(resolve)
          .catch((e) => resolve({ success: false, error: e?.message || 'Download failed' }))
      }

      autoUpdater.once('error', handleFallback)

      try {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner: 'DH-0216',
          repo: 'Subtitle-Sync'
        })
        autoUpdater.checkForUpdates()
          .then(() => autoUpdater.downloadUpdate(activeCancellationToken))
          .catch(handleFallback)
      } catch (e) {
        handleFallback(e)
      }
    })
  }

  return executeDirectDownload(downloadUrl, onProgress)
}

/**
 * Restart the app to apply the downloaded update (never called automatically or unexpectedly)
 */
export function restartAndInstallApp(): void {
  if (app.isPackaged) {
    try {
      autoUpdater.quitAndInstall(false, true)
      return
    } catch (e) {
      console.warn('[UPDATER] autoUpdater.quitAndInstall failed, checking direct installer:', e)
    }
  }

  if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
    try {
      const installerProcess = spawn(downloadedInstallerPath, [], {
        detached: true,
        stdio: 'ignore'
      })
      installerProcess.unref()
      setTimeout(() => {
        app.quit()
      }, 400)
      return
    } catch (e) {
      console.warn('[UPDATER] Failed to spawn direct installer:', e)
    }
  }

  app.relaunch()
  app.quit()
}

/**
 * Cancel currently active update download
 */
export function cancelUpdateDownload(): boolean {
  isDownloadCancelled = true

  if (activeCancellationToken) {
    try {
      activeCancellationToken.cancel()
    } catch {}
    activeCancellationToken = null
  }

  if (activeRequest) {
    try {
      activeRequest.destroy()
    } catch {}
    activeRequest = null
  }
  if (activeFileStream) {
    try {
      activeFileStream.close()
    } catch {}
    activeFileStream = null
  }
  return true
}
