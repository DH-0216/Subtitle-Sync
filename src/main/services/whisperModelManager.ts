import { app } from 'electron'
import { join, dirname } from 'path'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import { findBinary } from '../media'
import { getWhisperModelDownloadUrl, EXTERNAL_LINKS } from '@shared/links'
import { DEFAULT_WHISPER_MODELS } from '@shared/whisperModels'

export interface WhisperModelInfo {
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
}

let activeDownloadRequest: any = null

export function getModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function formatModelSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size'
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function buildModelMeta(id: string, sizeBytes: number): {
  label: string
  name: string
  description: string
  category: WhisperModelInfo['category']
  speedHint?: string
  isRecommended?: boolean
} {
  const sizeFormatted = formatModelSize(sizeBytes)
  const isEnOnly = id.endsWith('.en')
  const isQuantized = id.includes('-q5_') || id.includes('-q8_') || id.includes('-q4_')

  let category: WhisperModelInfo['category'] = 'standard'
  let label = id
  let description = 'Speech-to-text offline transcription model'
  let speedHint = ''
  let isRecommended = false

  if (id === 'base') {
    category = 'recommended'
    isRecommended = true
    label = 'Base (Recommended)'
    description = 'Fast & balanced (~16x real-time), optimal for movie dialogue and daily use'
    speedHint = '⚡ Fast (~16x)'
  } else if (id === 'large-v3-turbo') {
    category = 'recommended'
    isRecommended = true
    label = 'Large v3 Turbo (Recommended)'
    description = 'State-of-the-art accuracy with fast 8x real-time inference'
    speedHint = '⚡ Accurate (~8x)'
  } else if (id === 'tiny') {
    label = 'Tiny'
    description = 'Ultra-fast, lowest memory usage (~32x real-time), lower precision'
    speedHint = '⚡⚡ Ultra Fast (~32x)'
  } else if (id === 'small') {
    label = 'Small'
    description = 'High precision for complex accents, dialects and background audio'
    speedHint = '⚡ Precision (~6x)'
  } else if (id === 'medium') {
    category = 'high_accuracy'
    label = 'Medium'
    description = 'Very high accuracy model for intricate movie dialogue (~2x real-time)'
    speedHint = 'High Accuracy (~2x)'
  } else if (id === 'large-v3') {
    category = 'high_accuracy'
    label = 'Large v3'
    description = 'Maximum multilingual accuracy whisper model (~1x real-time)'
    speedHint = 'Maximum Accuracy (~1x)'
  } else if (id === 'large-v2') {
    category = 'high_accuracy'
    label = 'Large v2'
    description = 'High precision large v2 model'
  } else if (id === 'large-v1') {
    category = 'high_accuracy'
    label = 'Large v1'
    description = 'Legacy large v1 model'
  } else if (isQuantized) {
    category = 'quantized'
    label = id.toUpperCase()
    description = 'Quantized model variant: 50% smaller download and reduced RAM requirements'
    speedHint = 'Low RAM'
  } else if (isEnOnly) {
    category = 'english_only'
    const basePart = id.replace(/\.en$/, '')
    label = `${basePart.charAt(0).toUpperCase() + basePart.slice(1)} (English Only)`
    description = 'Trained specifically for English speech recognition with optimal vocabulary'
    speedHint = 'English Only'
  }

  const name = `${label} (~${sizeFormatted}${speedHint ? ` — ${speedHint}` : ''})`
  return { label, name, description, category, speedHint, isRecommended }
}

const FALLBACK_MODELS_CATALOG: Array<{ id: string; filename: string; sizeBytes: number }> =
  DEFAULT_WHISPER_MODELS.map((m) => ({
    id: m.id,
    filename: `ggml-${m.id}.bin`,
    sizeBytes: m.sizeBytes || 0
  }))

let cachedRemoteModels: Array<{ id: string; filename: string; sizeBytes: number }> | null = null
let cachedModelsFetchTime = 0

export function getWhisperModelPath(quality: string): string | null {
  const clean = (quality || '').trim()
  if (!clean) return null

  const candidates: string[] = []
  if (clean.endsWith('.bin') || clean.endsWith('.gguf')) {
    candidates.push(clean)
  } else {
    candidates.push(`ggml-${clean}.bin`)
    candidates.push(`ggml-${clean}.gguf`)
    candidates.push(`${clean}.bin`)
  }

  for (const modelName of candidates) {
    const locations: string[] = [
      join(getModelsDir(), modelName)
    ]

    if (process.resourcesPath) {
      locations.push(join(process.resourcesPath, 'bin', 'models', modelName))
      locations.push(join(process.resourcesPath, 'bin', modelName))
      locations.push(join(process.resourcesPath, 'models', modelName))
    }

    try {
      const exeDir = dirname(app.getPath('exe'))
      locations.push(join(exeDir, 'bin', 'models', modelName))
      locations.push(join(exeDir, 'bin', modelName))
      locations.push(join(exeDir, 'models', modelName))
    } catch {}

    const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
    if (portableDir) {
      locations.push(join(portableDir, 'bin', 'models', modelName))
      locations.push(join(portableDir, 'bin', modelName))
      locations.push(join(portableDir, 'models', modelName))
    }

    try {
      locations.push(join(app.getAppPath(), 'bin', 'models', modelName))
      locations.push(join(app.getAppPath(), 'bin', modelName))
      locations.push(join(app.getAppPath(), 'models', modelName))
    } catch {}

    locations.push(join(process.cwd(), 'bin', 'models', modelName))
    locations.push(join(process.cwd(), 'bin', modelName))
    locations.push(join(process.cwd(), 'models', modelName))

    for (const loc of locations) {
      if (fs.existsSync(loc)) {
        return loc
      }
    }
  }

  return null
}

export function getWhisperBinary(): string | null {
  return findBinary('whisper') || findBinary('whisper-cli') || findBinary('main')
}

export async function getAvailableWhisperModels(forceRefresh = false): Promise<{
  models: WhisperModelInfo[]
  source: 'remote' | 'cached' | 'fallback'
  error?: string
}> {
  let rawList: Array<{ id: string; filename: string; sizeBytes: number }> = []
  let source: 'remote' | 'cached' | 'fallback' = 'fallback'
  let fetchError: string | undefined

  const isCacheFresh = cachedRemoteModels && !forceRefresh && (Date.now() - cachedModelsFetchTime < 10 * 60 * 1000)

  if (isCacheFresh && cachedRemoteModels) {
    rawList = cachedRemoteModels
    source = 'cached'
  } else {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(EXTERNAL_LINKS.WHISPER_MODELS_API, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Subtitle-Sync-Studio'
        }
      })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const files = data.filter(
            (item: any) =>
              item.type === 'file' &&
              typeof item.path === 'string' &&
              item.path.startsWith('ggml-') &&
              (item.path.endsWith('.bin') || item.path.endsWith('.gguf'))
          )

          if (files.length > 0) {
            rawList = files.map((f: any) => {
              const filename = f.path
              const id = filename.replace(/^ggml-/, '').replace(/\.(bin|gguf)$/, '')
              const sizeBytes = typeof f.size === 'number' ? f.size : 0
              return { id, filename, sizeBytes }
            })
            cachedRemoteModels = rawList
            cachedModelsFetchTime = Date.now()
            source = 'remote'
          }
        }
      } else {
        fetchError = `Hugging Face API returned HTTP ${res.status}`
      }
    } catch (e: any) {
      fetchError = e?.message || 'Failed to connect to Hugging Face'
    }

    if (rawList.length === 0) {
      rawList = cachedRemoteModels || FALLBACK_MODELS_CATALOG
      source = cachedRemoteModels ? 'cached' : 'fallback'
    }
  }

  const localDirs = [
    getModelsDir(),
    join(process.cwd(), 'bin', 'models'),
    join(process.cwd(), 'models')
  ]

  const discoveredLocalFiles = new Map<string, { path: string; sizeBytes: number }>()

  for (const dir of localDirs) {
    try {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir)
        for (const entry of entries) {
          if (entry.endsWith('.bin') || entry.endsWith('.gguf')) {
            const fullPath = join(dir, entry)
            try {
              const stats = fs.statSync(fullPath)
              discoveredLocalFiles.set(entry, { path: fullPath, sizeBytes: stats.size })
            } catch {}
          }
        }
      }
    } catch {}
  }

  const knownFilenames = new Set<string>()
  const models: WhisperModelInfo[] = []

  for (const raw of rawList) {
    knownFilenames.add(raw.filename)
    const localPath = getWhisperModelPath(raw.id)
    const isDownloaded = Boolean(localPath)
    const meta = buildModelMeta(raw.id, raw.sizeBytes)

    models.push({
      id: raw.id,
      filename: raw.filename,
      name: meta.name,
      label: meta.label,
      sizeBytes: raw.sizeBytes,
      sizeFormatted: formatModelSize(raw.sizeBytes),
      description: meta.description,
      category: meta.category,
      isDownloaded,
      localPath,
      speedHint: meta.speedHint,
      isRecommended: meta.isRecommended
    })
  }

  for (const [filename, fileData] of discoveredLocalFiles.entries()) {
    if (!knownFilenames.has(filename)) {
      const id = filename.replace(/^ggml-/, '').replace(/\.(bin|gguf)$/, '')
      const sizeFormatted = formatModelSize(fileData.sizeBytes)
      models.push({
        id,
        filename,
        name: `Custom Model: ${id} (${sizeFormatted})`,
        label: `Custom: ${id}`,
        sizeBytes: fileData.sizeBytes,
        sizeFormatted,
        description: `Custom local Whisper model located at ${fileData.path}`,
        category: 'custom',
        isDownloaded: true,
        localPath: fileData.path,
        speedHint: 'Local',
        isRecommended: false
      })
    }
  }

  const categoryRank: Record<WhisperModelInfo['category'], number> = {
    recommended: 1,
    standard: 2,
    high_accuracy: 3,
    english_only: 4,
    quantized: 5,
    custom: 6
  }

  models.sort((a, b) => {
    const rankDiff = (categoryRank[a.category] || 99) - (categoryRank[b.category] || 99)
    if (rankDiff !== 0) return rankDiff
    return (a.sizeBytes || 0) - (b.sizeBytes || 0)
  })

  return { models, source, error: fetchError }
}

export function downloadWhisperModel(
  quality: string,
  onProgress: (data: { percent: number; downloaded: number; total: number; speed: string }) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const modelName = quality.endsWith('.bin') || quality.endsWith('.gguf')
      ? quality
      : quality.startsWith('ggml-')
        ? `${quality}.bin`
        : `ggml-${quality}.bin`
    const targetPath = join(getModelsDir(), modelName)
    const tempPath = `${targetPath}.part`
    const url = getWhisperModelDownloadUrl(modelName)

    let fileStream: fs.WriteStream | null = null
    let downloadedBytes = 0
    let totalBytes = 0
    let lastTime = Date.now()
    let lastBytes = 0
    let currentSpeed = ''

    const executeRequest = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects while downloading model.'))
        return
      }

      const client = currentUrl.startsWith('https') ? https : http
      const req = client.get(currentUrl, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          executeRequest(res.headers.location, redirectCount + 1)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download model (HTTP ${res.statusCode})`))
          return
        }

        totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        fileStream = fs.createWriteStream(tempPath)

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000

          if (timeDiff >= 0.5) {
            const bytesDiff = downloadedBytes - lastBytes
            const bytesPerSec = bytesDiff / timeDiff
            const mbPerSec = bytesPerSec / (1024 * 1024)
            currentSpeed = `${mbPerSec.toFixed(1)} MB/s`
            lastTime = now
            lastBytes = downloadedBytes
          }

          const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
          onProgress({ percent, downloaded: downloadedBytes, total: totalBytes, speed: currentSpeed })
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream?.close(() => {
            if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath)
            }
            fs.renameSync(tempPath, targetPath)
            resolve(targetPath)
          })
        })

        fileStream.on('error', (err) => {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
          reject(err)
        })
      })

      req.on('error', (err) => {
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath)
          } catch {
            // ignore
          }
        }
        const errCode = (err as any)?.code || ''
        if (errCode === 'ENOTFOUND' || errCode === 'ECONNREFUSED' || errCode === 'ETIMEDOUT') {
          reject(new Error('No internet connection detected. Please connect to the internet to download AI models.'))
        } else {
          reject(err)
        }
      })

      activeDownloadRequest = req
    }

    executeRequest(url)
  })
}

export function cancelModelDownload(): void {
  if (activeDownloadRequest) {
    try {
      activeDownloadRequest.destroy()
    } catch (e) {
      // ignore
    }
    activeDownloadRequest = null
  }
}
