import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { spawn } from 'child_process'
import { EXTERNAL_LINKS } from '../shared/links'
import { APP_VERSION } from '../shared/version'

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
}

export interface UpdateProgress {
  percent: number
  downloaded: number
  total: number
  speed: string
}

let activeRequest: http.ClientRequest | null = null
let activeFileStream: fs.WriteStream | null = null
let isDownloadCancelled = false

/**
 * Compare semantic versions (e.g., "2.2.0" vs "2.1.0")
 * Returns 1 if v1 > v2, -1 if v1 < v2, and 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = (v1 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const p2 = (v2 || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(p1.length, p2.length)

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0
    const num2 = p2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

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
      currentVersion
    }
  }
}

/**
 * Download update installer to %TEMP% with progress, then launch and quit.
 */
export function downloadAndInstallUpdate(
  downloadUrl: string,
  onProgress: (progress: UpdateProgress) => void
): Promise<{ success: boolean; error?: string }> {
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

                // Launch setup wizard detached from this process, then cleanly quit this app
                const installerProcess = spawn(targetFile, [], {
                  detached: true,
                  stdio: 'ignore'
                })
                installerProcess.unref()

                // Small delay to allow spawn to detach before exiting
                setTimeout(() => {
                  app.quit()
                }, 500)

                resolve({ success: true })
              } catch (err: any) {
                reject(new Error(`Failed to launch installer: ${err.message}`))
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
 * Cancel currently active update download
 */
export function cancelUpdateDownload(): boolean {
  isDownloadCancelled = true
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
