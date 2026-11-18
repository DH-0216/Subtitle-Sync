import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as crypto from 'crypto'
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
let isRestartingForUpdate = false

// Automatic silent install on quit if user downloaded update and selected "Restart Later"
app.on('before-quit', () => {
  // If user explicitly clicked "Restart to Apply", restartAndInstallApp already created the relaunch script
  if (isPortable() || isRestartingForUpdate) return

  if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
    try {
      const updateBat = join(app.getPath('temp'), 'launch-setup.bat')
      const pid = process.pid
      const batContent = [
        '@echo off',
        'setlocal EnableDelayedExpansion',
        `set "APP_PID=${pid}"`,
        `set "INSTALLER=${downloadedInstallerPath}"`,
        'set /a wait_count=0',
        ':wait_process',
        'tasklist /fi "PID eq %APP_PID%" 2>nul | findstr "%APP_PID%" >nul',
        'if not errorlevel 1 (',
        '    timeout /t 1 /nobreak >nul',
        '    set /a wait_count+=1',
        '    if !wait_count! lss 30 goto wait_process',
        ')',
        'start "" "%INSTALLER%" /S',
        '(goto) 2>nul & del "%~f0"'
      ].join('\r\n') + '\r\n'

      fs.writeFileSync(updateBat, batContent, 'utf-8')
      const child = spawn('cmd.exe', ['/c', updateBat], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
    } catch (e) {
      console.warn('[UPDATER] Failed to launch setup on app quit:', e)
    }
  }
})

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
  deltaSize?: number
  isDeltaAvailable?: boolean
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

interface ParsedLatestYml {
  version: string
  path?: string
  releaseDate?: string
  size?: number
  sha512?: string
}

let activeRequest: http.ClientRequest | null = null
let activeFileStream: fs.WriteStream | null = null
let isDownloadCancelled = false

export { compareVersions }

/**
 * Check whether the application is running as a standalone Portable executable
 */
export function isPortable(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR || process.env.PORTABLE_EXECUTABLE_FILE)
}

/**
 * Parse electron-builder's latest.yml format
 */
function parseLatestYml(yamlText: string): ParsedLatestYml | null {
  try {
    const versionMatch = yamlText.match(/^version:\s*['"]?([^'"\r\n#]+)['"]?/m)
    if (!versionMatch) return null

    const version = versionMatch[1].trim()
    const pathMatch = yamlText.match(/^path:\s*['"]?([^'"\r\n#]+)['"]?/m)
    const releaseDateMatch = yamlText.match(/^releaseDate:\s*['"]?([^'"\r\n#]+)['"]?/m)
    const sha512Match = yamlText.match(/^sha512:\s*['"]?([^'"\r\n#]+)['"]?/m)
    const sizeMatch = yamlText.match(/^\s*size:\s*(\d+)/m)

    return {
      version,
      path: pathMatch ? pathMatch[1].trim() : undefined,
      releaseDate: releaseDateMatch ? releaseDateMatch[1].trim() : undefined,
      size: sizeMatch ? parseInt(sizeMatch[1], 10) : undefined,
      sha512: sha512Match ? sha512Match[1].trim() : undefined
    }
  } catch {
    return null
  }
}

/**
 * Fetch official release SHA-256 checksums map from GitHub releases
 */
async function fetchReleaseChecksums(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_CHECKSUMS, {
      headers: {
        'User-Agent': `SubtitleSyncStudio/${APP_VERSION}`
      }
    })
    if (!res.ok) {
      console.warn(`[UPDATER] SHA256SUMS.txt responded with HTTP ${res.status}`)
      return map
    }
    const text = await res.text()
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const match = trimmed.match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/)
      if (match) {
        const hash = match[1].toLowerCase()
        const rawFileName = match[2].trim().toLowerCase()
        const leafFileName = rawFileName.split(/[/\\]/).pop() || rawFileName
        map.set(rawFileName, hash)
        map.set(leafFileName, hash)
      }
    }
  } catch (err) {
    console.warn('[UPDATER] Could not fetch SHA256SUMS.txt:', err)
  }
  return map
}

/**
 * Check GitHub Releases for newer version of Subtitle Sync Studio.
 * Uses static latest.yml download first (zero rate limits), falling back to REST API.
 */
export async function checkForAppUpdate(): Promise<UpdateInfo> {
  const currentVersion = APP_VERSION.replace(/^v/i, '')

  // 1. Primary Strategy: Check latest.yml via static release asset (immune to GitHub 60 req/hr rate limit)
  try {
    const ymlRes = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_RAW_YML, {
      headers: {
        'User-Agent': `SubtitleSyncStudio/${APP_VERSION}`
      }
    })

    if (ymlRes.ok) {
      const ymlText = await ymlRes.text()
      const parsedYml = parseLatestYml(ymlText)

      if (parsedYml?.version) {
        const cleanLatest = parsedYml.version.replace(/^v/i, '').trim()
        const isNewer = compareVersions(cleanLatest, currentVersion) > 0

        if (!isNewer) {
          return {
            updateAvailable: false,
            currentVersion
          }
        }

        const isPortableApp = isPortable()
        const targetFileName = isPortableApp
          ? 'SubtitleSync-Portable.exe'
          : (parsedYml.path || 'SubtitleSync-Setup.exe')

        const downloadUrl = `${EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_DOWNLOAD_BASE}/${targetFileName}`
        const releaseUrl = `${EXTERNAL_LINKS.GITHUB_RELEASES_PAGE}/tag/v${cleanLatest}`

        // Non-blocking query to GitHub API for rich release notes & title if available
        let releaseName = `v${cleanLatest}`
        let releaseNotes = `Subtitle Sync Studio v${cleanLatest} is now available.`
        let publishedAt = parsedYml.releaseDate

        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 3500)
          const apiRes = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_API, {
            signal: controller.signal,
            headers: {
              Accept: 'application/vnd.github.v3+json',
              'User-Agent': `SubtitleSyncStudio/${APP_VERSION}`
            }
          })
          clearTimeout(timeoutId)
          if (apiRes.ok) {
            const apiData = await apiRes.json()
            if (apiData.name) releaseName = apiData.name
            if (apiData.body) releaseNotes = apiData.body
            if (apiData.published_at) publishedAt = apiData.published_at
          }
        } catch {
          // GitHub API rate limited or unreachable: harmless, latest.yml already succeeded
        }

        const isDelta = !isPortableApp
        const rawSize = parsedYml.size || 153000000
        const estimatedDelta = isDelta ? Math.round(rawSize * 0.14) : undefined

        return {
          updateAvailable: true,
          currentVersion,
          latestVersion: cleanLatest,
          releaseName,
          releaseNotes,
          publishedAt,
          downloadUrl,
          assetName: targetFileName,
          assetSize: rawSize,
          deltaSize: estimatedDelta,
          isDeltaAvailable: isDelta,
          releaseUrl
        }
      }
    }
  } catch (ymlErr) {
    console.warn('[UPDATER] Could not fetch latest.yml, falling back to GitHub API:', ymlErr)
  }

  // 2. Fallback Strategy: GitHub REST API query
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

    // Detect matching asset based on installation type (Portable vs Installer)
    const assets = Array.isArray(data.assets) ? data.assets : []
    let targetAsset: any = null

    if (isPortable()) {
      targetAsset =
        assets.find((a: any) => (a.name || '').toLowerCase() === 'subtitlesync-portable.exe') ||
        assets.find((a: any) => (a.name || '').toLowerCase().includes('portable') && (a.name || '').endsWith('.exe'))
    } else {
      targetAsset =
        assets.find((a: any) => (a.name || '').toLowerCase() === 'subtitlesync-setup.exe') ||
        assets.find((a: any) => (a.name || '').toLowerCase().includes('setup') && (a.name || '').endsWith('.exe')) ||
        assets.find((a: any) => (a.name || '').endsWith('.exe') && !(a.name || '').toLowerCase().includes('portable'))
    }

    if (!targetAsset) {
      targetAsset = assets.find((a: any) => (a.name || '').endsWith('.exe'))
    }

    if (!targetAsset || !targetAsset.browser_download_url) {
      console.warn('[UPDATER] New release published, but executable assets are still being uploaded.')
      return {
        updateAvailable: false,
        currentVersion
      }
    }

    const defaultAssetName = isPortable() ? 'SubtitleSync-Portable.exe' : 'SubtitleSync-Setup.exe'
    const isDelta = !isPortable()
    const rawSize = targetAsset?.size || 151000000
    const estimatedDelta = isDelta ? Math.round(rawSize * 0.14) : undefined

    return {
      updateAvailable: true,
      currentVersion,
      latestVersion: cleanLatest,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || 'No release notes provided for this version.',
      publishedAt: data.published_at,
      downloadUrl: targetAsset?.browser_download_url,
      assetName: targetAsset?.name || defaultAssetName,
      assetSize: targetAsset?.size,
      deltaSize: estimatedDelta,
      isDeltaAvailable: isDelta,
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
 * Direct HTTP installer download with streaming SHA-256 integrity verification
 */
function executeDirectDownload(
  downloadUrl: string,
  onProgress: (progress: UpdateProgress) => void
): Promise<UpdateDownloadResult> {
  return new Promise((resolve, reject) => {
    if (!downloadUrl) {
      reject(new Error('Update download link is not ready yet. Please try again in a few moments.'))
      return
    }
    isDownloadCancelled = false
    const tempDir = app.getPath('temp')
    const fileName = isPortable() ? 'SubtitleSync-Portable-Update.exe' : 'SubtitleSync-Setup-Update.exe'
    const targetAssetFileName = isPortable() ? 'SubtitleSync-Portable.exe' : 'SubtitleSync-Setup.exe'
    const targetFile = join(tempDir, fileName)
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
          const sha256Hash = crypto.createHash('sha256')

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

            sha256Hash.update(chunk)
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
            activeFileStream?.close(async () => {
              if (isDownloadCancelled) {
                try {
                  if (fs.existsSync(partFile)) fs.unlinkSync(partFile)
                } catch {}
                reject(new Error('Download cancelled by user.'))
                return
              }

              try {
                // Verify SHA-256 integrity before saving or launching
                const calculatedHash = sha256Hash.digest('hex').toLowerCase()
                console.log(`[UPDATER] Calculated SHA-256 for ${targetAssetFileName}: ${calculatedHash}`)

                const checksums = await fetchReleaseChecksums()
                const expectedHash =
                  checksums.get(targetAssetFileName.toLowerCase()) ||
                  checksums.get(fileName.toLowerCase())

                if (expectedHash) {
                  if (calculatedHash !== expectedHash.toLowerCase()) {
                    console.error(
                      `[UPDATER] SHA-256 mismatch! Expected: ${expectedHash}, Got: ${calculatedHash}`
                    )
                    if (fs.existsSync(partFile)) {
                      try {
                        fs.unlinkSync(partFile)
                      } catch {}
                    }
                    reject(
                      new Error(
                        'Integrity verification failed: The downloaded update does not match the official release checksum (corrupt download). Please try downloading again.'
                      )
                    )
                    return
                  }
                  console.log(`[UPDATER] SHA-256 integrity verified successfully for ${targetAssetFileName}.`)
                } else {
                  console.warn(
                    `[UPDATER] No official SHA-256 entry found for ${targetAssetFileName} in SHA256SUMS.txt. Proceeding.`
                  )
                }

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
  downloadedInstallerPath = null

  if (app.isPackaged && !isPortable()) {
    return new Promise((resolve) => {
      activeCancellationToken = new CancellationToken()

      autoUpdater.removeAllListeners('download-progress')
      autoUpdater.removeAllListeners('update-downloaded')
      autoUpdater.removeAllListeners('error')

      let fallbackTriggered = false

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
        fallbackTriggered = true
        registerPermanentErrorHandler()
        downloadedInstallerPath = null
        resolve({ success: true, readyToInstall: true })
      })

      const handleFallback = (err?: any) => {
        if (fallbackTriggered || isDownloadCancelled) return
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
          repo: 'Subtitle-Sync',
          vPrefixedTagName: true
        } as any)

        autoUpdater.checkForUpdates()
          .then(() => {
            if (isDownloadCancelled) return
            return autoUpdater.downloadUpdate(activeCancellationToken)
          })
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
  isRestartingForUpdate = true
  const pid = process.pid

  // 1. Portable Edition Handler: Active process wait loop prevents Windows file locking race conditions
  if (isPortable()) {
    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
    const portableFile = process.env.PORTABLE_EXECUTABLE_FILE || 'SubtitleSync-Portable.exe'

    if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath) && portableDir) {
      const targetPortablePath = join(portableDir, portableFile)
      const updateBat = join(app.getPath('temp'), 'update-portable.bat')

      try {
        const batContent = [
          '@echo off',
          'setlocal EnableDelayedExpansion',
          `set "APP_PID=${pid}"`,
          `set "UPDATE_FILE=${downloadedInstallerPath}"`,
          `set "TARGET_FILE=${targetPortablePath}"`,
          'set /a wait_count=0',
          ':wait_process',
          'tasklist /fi "PID eq %APP_PID%" 2>nul | findstr "%APP_PID%" >nul',
          'if not errorlevel 1 (',
          '    timeout /t 1 /nobreak >nul',
          '    set /a wait_count+=1',
          '    if !wait_count! lss 30 goto wait_process',
          ')',
          'set /a copy_count=0',
          ':copy_retry',
          'copy /y "%UPDATE_FILE%" "%TARGET_FILE%" >nul 2>nul',
          'if errorlevel 1 (',
          '    timeout /t 1 /nobreak >nul',
          '    set /a copy_count+=1',
          '    if !copy_count! lss 15 goto copy_retry',
          ')',
          'if exist "%TARGET_FILE%" (',
          '    del "%UPDATE_FILE%" >nul 2>nul',
          '    start "" "%TARGET_FILE%"',
          ')',
          '(goto) 2>nul & del "%~f0"'
        ].join('\r\n') + '\r\n'

        fs.writeFileSync(updateBat, batContent, 'utf-8')

        const child = spawn('cmd.exe', ['/c', updateBat], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()

        setTimeout(() => {
          app.quit()
        }, 300)
        return
      } catch (err) {
        console.warn('[UPDATER] Failed to create portable replacement script, spawning directly:', err)
      }
    }

    if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
      try {
        const child = spawn(downloadedInstallerPath, [], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        setTimeout(() => {
          app.quit()
        }, 300)
        return
      } catch (err) {
        console.warn('[UPDATER] Failed to launch downloaded portable executable:', err)
      }
    }

    app.relaunch()
    app.quit()
    return
  }

  // 2. Direct downloaded installer handler (fallback or direct download)
  // Executes silently with /S and automatically relaunches the application
  if (downloadedInstallerPath && fs.existsSync(downloadedInstallerPath)) {
    try {
      const updateBat = join(app.getPath('temp'), 'launch-setup.bat')
      const currentExe = process.execPath

      const batContent = [
        '@echo off',
        'setlocal EnableDelayedExpansion',
        `set "APP_PID=${pid}"`,
        `set "INSTALLER=${downloadedInstallerPath}"`,
        `set "APP_EXE=${currentExe}"`,
        'set /a wait_count=0',
        ':wait_process',
        'tasklist /fi "PID eq %APP_PID%" 2>nul | findstr "%APP_PID%" >nul',
        'if not errorlevel 1 (',
        '    timeout /t 1 /nobreak >nul',
        '    set /a wait_count+=1',
        '    if !wait_count! lss 30 goto wait_process',
        ')',
        ':: Run installer silently with /S and wait for completion',
        'start /wait "" "%INSTALLER%" /S',
        ':: Clean up downloaded installer',
        'del "%INSTALLER%" >nul 2>nul',
        'timeout /t 1 /nobreak >nul',
        ':: Relaunch updated application',
        'start "" "%APP_EXE%"',
        '(goto) 2>nul & del "%~f0"'
      ].join('\r\n') + '\r\n'

      fs.writeFileSync(updateBat, batContent, 'utf-8')

      const child = spawn('cmd.exe', ['/c', updateBat], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      setTimeout(() => {
        app.quit()
      }, 300)
      return
    } catch (e) {
      console.warn('[UPDATER] Failed to spawn setup installer batch, trying direct spawn:', e)
      try {
        const child = spawn(downloadedInstallerPath, ['/S'], {
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
        setTimeout(() => app.quit(), 300)
        return
      } catch (err) {
        console.warn('[UPDATER] Direct spawn failed:', err)
      }
    }
  }

  // 3. Standard Installed Edition Handler (NSIS differential update via autoUpdater)
  if (app.isPackaged) {
    try {
      app.removeAllListeners('window-all-closed')
      // Pass isSilent = true for silent background install, isForceRunAfter = true for automatic relaunch
      autoUpdater.quitAndInstall(true, true)
      setTimeout(() => {
        app.exit(0)
      }, 5000)
      return
    } catch (e) {
      console.warn('[UPDATER] autoUpdater.quitAndInstall failed:', e)
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
