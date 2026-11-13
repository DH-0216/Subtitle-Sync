import { app } from 'electron'
import { join, dirname } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'
import { spawn } from 'child_process'
import { findBinary, killProcessTree } from './media'
import { parseSrt, SrtCue, writeSrt, removeHallucinationLoops, getUniqueFilePath, cleanSdhFromCues, sanitizeSinhalaScript } from './srtTools'
import { getWhisperModelDownloadUrl, getGeminiGenerateUrl, EXTERNAL_LINKS } from '@shared/links'
import {
  AI_MODELS_CONFIG,
  isGeminiModelExcluded,
  buildDynamicGeminiChain,
  buildDynamicOpenAiChain,
  AiProviderId
} from '@shared/aiModels'

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

export interface GenerateParams {
  video?: string
  sourceType?: 'video' | 'subtitle'
  sourceSubPath?: string
  trackIndex?: number | null
  trackLanguage?: string | null
  durationSec?: number | null
  modelQuality?: string
  format: 'srt' | 'vtt'
  language: string
  aiApiKey?: string
  aiProvider?: AiProviderId
  aiModel?: string
  customPrompt?: string
}

function mapTrackLangToWhisper(langCode?: string | null): string {
  if (!langCode) return 'auto'
  const c = langCode.trim().toLowerCase()
  if (c.startsWith('en')) return 'en'
  if (c.startsWith('es') || c === 'spa') return 'es'
  if (c.startsWith('fr') || c === 'fra' || c === 'fre') return 'fr'
  if (c.startsWith('de') || c === 'deu' || c === 'ger') return 'de'
  if (c.startsWith('ru') || c === 'rus') return 'ru'
  if (c.startsWith('it') || c === 'ita') return 'it'
  if (c.startsWith('ja') || c === 'jpn') return 'ja'
  if (c.startsWith('ko') || c === 'kor') return 'ko'
  if (c.startsWith('zh') || c === 'zho' || c === 'chi') return 'zh'
  if (c.startsWith('hi') || c === 'hin') return 'hi'
  if (c.startsWith('ta') || c === 'tam') return 'ta'
  if (c.startsWith('si') || c === 'sin') return 'si'
  if (c.startsWith('pt') || c === 'por') return 'pt'
  if (c.startsWith('ar') || c === 'ara') return 'ar'
  if (c.length === 2) return c
  return 'auto'
}

export const DEFAULT_AI_PROMPT = `You are an expert subtitle translator specializing in natural, authentic spoken colloquial Sinhala (ස්වාභාවික කථාබහ සිංහල) for cinema and movies.
Translate the following movie subtitle lines into natural, spoken Sinhala as people actually speak in day-to-day life.
RULES:
1. Use colloquial spoken Sinhala (කථාබහ කරන බස), NOT formal/bookish written Sinhala (e.g. use "කරනවා", "යනවා", "නෑ/නැහැ", "මොකක්ද", NEVER use "කරන්නේය", "ගියේය", "නැත", "කුමක්ද").
2. Contextual Idioms & Slang: Never translate idioms literally word-for-word (e.g., "give me a hand" -> "මට උදව් කරන්න", "break a leg" -> "වැඩේ හොඳට කරන්න / සුබ පැතුම්", "chill out" -> "කූල් එකේ ඉන්න"). Translate the emotion, intent, and colloquial nuance.
3. Homonym & Context Awareness: Resolve mistranslated homonyms and ambiguous words based on surrounding movie dialogue (e.g., distinguish "fair", "bark", "right", "bear").
4. Character Names & Modern Words: Keep character names, locations, and commonly spoken modern loan words natural.
5. Strict Script Purity (සිංහල අකුරු පමණි): Output ONLY authentic Sinhala script (අ-ෆ). NEVER mix Telugu, Tamil, Hindi/Devanagari, or Arabic characters under any circumstances.
6. Remove Background Sounds & Sound Effects (SDH): CAREFULLY REMOVE non-dialogue audio descriptions, sound effects, and music tags enclosed in brackets [ ] or parentheses ( ) (e.g. "[mysterious music plays]", "[engine roaring]", "[police sirens wail]", "[screaming]", "[applause]", "[groans]", "[laughs]", "(sighs)", "(whispering)").
   - If a line contains spoken dialogue with a sound effect (e.g. "[sighs] Where are we going?"), remove the sound effect completely and translate ONLY the spoken dialogue ("අපි කොහෙද යන්නේ?").
   - If an entire line contains ONLY background sounds or music descriptions with no spoken dialogue, output a dash "-" for that line.
7. 1:1 Complete Line Mapping - NEVER Skip or Merge: Every single numbered line [index] in the input MUST have an exact corresponding [index] in your output. Even short lines like "[120] Hey, you know what?" MUST be translated individually as "[120] ඒයි, දන්නවද වැඩක්?". NEVER combine multiple lines into one and NEVER leave any line untranslated in English.
8. Maintain the exact format "[index] Translated line".
9. Return exactly the same number of numbered lines without dropping any lines.
10. Do not include introductory, markdown formatting or explanatory text.`

let activeGeneratorProcess: any = null
let activeDownloadRequest: any = null
let isGenerationCancelled = false
let activeAbortController: AbortController | null = null
let pendingGeneratorReject: ((err: Error) => void) | null = null
const activeCreatedFiles = new Set<string>()

export function cleanupActiveGenerationFiles(): void {
  for (const filePath of activeCreatedFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (e) {
      // ignore
    }
  }
  activeCreatedFiles.clear()
}

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

const FALLBACK_MODELS_CATALOG: Array<{ id: string; filename: string; sizeBytes: number }> = [
  { id: 'base', filename: 'ggml-base.bin', sizeBytes: 147964211 },
  { id: 'large-v3-turbo', filename: 'ggml-large-v3-turbo.bin', sizeBytes: 1625977916 },
  { id: 'small', filename: 'ggml-small.bin', sizeBytes: 487847979 },
  { id: 'tiny', filename: 'ggml-tiny.bin', sizeBytes: 77793139 },
  { id: 'medium', filename: 'ggml-medium.bin', sizeBytes: 1533155455 },
  { id: 'large-v3', filename: 'ggml-large-v3.bin', sizeBytes: 3095033481 },
  { id: 'large-v3-turbo-q5_0', filename: 'ggml-large-v3-turbo-q5_0.bin', sizeBytes: 574000000 },
  { id: 'base-q5_1', filename: 'ggml-base-q5_1.bin', sizeBytes: 60000000 },
  { id: 'small-q5_1', filename: 'ggml-small-q5_1.bin', sizeBytes: 191000000 },
  { id: 'medium-q5_0', filename: 'ggml-medium-q5_0.bin', sizeBytes: 539000000 },
  { id: 'base.en', filename: 'ggml-base.en.bin', sizeBytes: 147964211 },
  { id: 'small.en', filename: 'ggml-small.en.bin', sizeBytes: 487847979 },
  { id: 'tiny.en', filename: 'ggml-tiny.en.bin', sizeBytes: 77793139 },
  { id: 'medium.en', filename: 'ggml-medium.en.bin', sizeBytes: 1533155455 }
]

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

/**
 * Dynamically queries Hugging Face repository API for whisper.cpp models
 * and merges with locally downloaded models on the user machine.
 */
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

  // Scan local directories for any user-added models (*.bin / *.gguf)
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

  // Build model info objects
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

  // Add any local files found on disk that weren't in the remote/fallback catalog
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

  // Sort logically:
  // 1. Recommended models (Base, Large v3 Turbo)
  // 2. Standard multilingual models (Tiny, Small, Medium, Large v3)
  // 3. English-only models
  // 4. Quantized variants
  // 5. Custom local models
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

export function getWhisperBinary(): string | null {
  return findBinary('whisper') || findBinary('whisper-cli') || findBinary('main')
}

/**
 * Downloads a Whisper GGUF model with streaming progress and redirect handling
 */
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

          // Calculate speed every 0.5 seconds and retain the value smoothly
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

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Dynamically queries Google Gemini API to discover all currently active models
 * supporting text generation for this API key. Zero hardcoded model names.
 */
// In-memory 6-hour model cache for self-healing resolver
let geminiModelCache: {
  models: string[]
  timestamp: number
  keyHash: string
} | null = null

export function invalidateGeminiModelCache(): void {
  geminiModelCache = null
}

/**
 * Self-healing cached model resolver. Dynamically queries live models from Google API
 * and builds an optimal priority chain using @shared/aiModels.
 * Activates 6-hour caching and auto-recovers on model deprecation (404).
 */
export async function getActiveFallbackChain(
  apiKey: string,
  preferredModel?: string,
  onLog?: (msg: string) => void
): Promise<string[]> {
  const keyHash = apiKey.slice(-6)
  const now = Date.now()

  // Return cached chain if valid and unexpired
  if (
    geminiModelCache &&
    geminiModelCache.keyHash === keyHash &&
    now - geminiModelCache.timestamp < AI_MODELS_CONFIG.CACHE_TTL_MS &&
    geminiModelCache.models.length > 0
  ) {
    const cached = geminiModelCache.models
    if (preferredModel && preferredModel !== 'auto' && !isGeminiModelExcluded(preferredModel)) {
      return Array.from(new Set([preferredModel, ...cached]))
    }
    return cached
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data?.models) ? data.models : []
      const rawIds = rawList
        .filter((m: any) => {
          const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
          return methods.includes('generateContent')
        })
        .map((m: any) => m.name || '')

      const dynamicChain = buildDynamicGeminiChain(rawIds, preferredModel)
      if (dynamicChain.length > 0) {
        geminiModelCache = {
          models: dynamicChain,
          timestamp: now,
          keyHash
        }
        return dynamicChain
      }
    }
  } catch (err: any) {
    onLog?.(`[AI TRANSLATION] Notice: Live model query failed (${err?.message || 'Network error'}). Using fallback chain.`)
  }

  // Fallback to dynamic emergency chain
  return buildDynamicGeminiChain([], preferredModel)
}

// Backward-compatible alias for getActiveFallbackChain
export const getGeminiCandidateModels = getActiveFallbackChain

/**
 * Dynamically detects the optimal active Gemini model from the provider at runtime.
 */
async function resolveGeminiModel(apiKey: string, onLog: (msg: string) => void): Promise<string> {
  const candidates = await getActiveFallbackChain(apiKey, undefined, onLog)
  if (candidates.length > 0 && candidates[0] !== 'auto') {
    onLog(`[AI TRANSLATION] Selected primary active model: ${candidates[0]}`)
    return candidates[0]
  }
  return candidates[0] || AI_MODELS_CONFIG.GEMINI_EMERGENCY_SEEDS[0]
}

/**
 * Dynamically queries OpenAI API to discover active chat completion models for this API key.
 * Zero hardcoded model names.
 */
async function getOpenAiCandidateModels(apiKey: string, preferredModel?: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data?.data) ? data.data : []
      const rawIds = rawList.map((m: any) => m.id || '')
      return buildDynamicOpenAiChain(rawIds, preferredModel)
    }
  } catch {
    // fallback
  }
  return buildDynamicOpenAiChain([], preferredModel)
}

/**
 * Translates subtitle cues using Google Gemini API into natural spoken Sinhala.
 * Features automated multi-model fallback and retry to seamlessly withstand
 * HTTP 503 "High Demand" or HTTP 429 rate limit spikes.
 */
async function translateCuesWithGemini(
  cues: SrtCue[],
  apiKey: string,
  modelChoice: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void
): Promise<SrtCue[]> {
  onLog('[AI TRANSLATION] Initiating Gemini Spoken Sinhala translation...')
  let currentModel = (modelChoice && modelChoice !== 'auto')
    ? modelChoice
    : await resolveGeminiModel(apiKey, onLog)

  onLog(`[AI TRANSLATION] Primary model: ${currentModel}`)
  const candidateModels = await getActiveFallbackChain(apiKey, currentModel, onLog)

  const batchSize = 35
  const translatedCues: SrtCue[] = []
  const instruction = customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_AI_PROMPT
  const totalBatches = Math.ceil(cues.length / batchSize)

  for (let i = 0; i < cues.length; i += batchSize) {
    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }
    const batchIdx = Math.floor(i / batchSize) + 1
    const batch = cues.slice(i, i + batchSize)
    onLog(`[AI TRANSLATION] Translating batch ${batchIdx} of ${totalBatches}...`)
    if (onProgress) {
      onProgress(batchIdx, totalBatches)
    }

    const batchInputJson = JSON.stringify(
      batch.map((c) => ({
        index: c.index,
        text: c.text.replace(/\n/g, ' ')
      }))
    )

    let batchSuccess = false
    let lastErrDetail = ''
    let lineMap: Record<number, string> = {}
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (isGenerationCancelled) {
        throw new Error('Subtitle generation cancelled by user.')
      }

      // Prioritize currentModel, followed by the rest of the fallback chain
      const activeCandidates = [
        currentModel,
        ...candidateModels.filter((m) => m !== currentModel)
      ]

      for (const model of activeCandidates) {
        if (isGenerationCancelled) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        // Try with thinkingConfig: { thinkingLevel: 'low' }, and fallback if model rejects it
        for (const useThinking of [true, false]) {
          const genConfig: any = {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  index: { type: 'INTEGER' },
                  text: { type: 'STRING' }
                },
                required: ['index', 'text']
              }
            }
          }
          if (useThinking) {
            genConfig.thinkingConfig = { thinkingLevel: 'low' }
          }

          const requestBody = {
            contents: [
              {
                parts: [
                  {
                    text: `${instruction}

Input Subtitle Cues (JSON Array):
${batchInputJson}`
                  }
                ]
              }
            ],
            generationConfig: genConfig
          }

          try {
            const response = await fetch(getGeminiGenerateUrl(apiKey, model), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: activeAbortController?.signal
            })

            if (response.ok) {
              if (model !== currentModel) {
                currentModel = model
                onLog(`[AI TRANSLATION] Cascaded to high-availability model: ${model}`)
              }
              const data = await response.json()
              const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

              const parsedMap: Record<number, string> = {}
              let parsedItems: Array<{ index: number; text: string }> = []

              try {
                parsedItems = JSON.parse(content)
              } catch {
                const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
                if (match) {
                  try {
                    parsedItems = JSON.parse(match[1])
                  } catch {
                    // ignore
                  }
                }
              }

              if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                for (const item of parsedItems) {
                  if (typeof item.index === 'number' && typeof item.text === 'string') {
                    parsedMap[item.index] = sanitizeSinhalaScript(item.text.trim())
                  }
                }
              } else {
                // Fallback line regex in case model returns flat line formatting
                const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
                for (const l of lines) {
                  const m = l.match(/^\[?(\d+)\]?[:\s-]+(.*)$/)
                  if (m) {
                    const idx = parseInt(m[1], 10)
                    parsedMap[idx] = sanitizeSinhalaScript(m[2].trim())
                  }
                }
              }

              // 1:1 line completeness validation
              const missing = batch.filter((c) => !parsedMap[c.index] || parsedMap[c.index].length === 0)
              if (missing.length > 0 && attempt < maxRetries) {
                onLog(`[AI TRANSLATION] Model missed ${missing.length} cue(s) in batch ${batchIdx}. Retrying for complete translation...`)
                break // break thinking loop to retry attempt
              }

              lineMap = parsedMap
              batchSuccess = true
              break // success, break thinking loop
            }

            const status = response.status
            const errText = await response.text()
            lastErrDetail = errText

            // If 400 Bad Request is due to thinkingConfig not supported by this model, retry without it
            if (status === 400 && useThinking && errText.toLowerCase().includes('thinkingconfig')) {
              continue // next iteration in [true, false] loop tries without thinkingConfig
            }

            // 404 = Model retired / not found: Invalidate 6-hour cache immediately and cascade
            if (status === 404) {
              onLog(`[AI TRANSLATION] Model '${model}' returned 404 (retired). Invalidating cache and cascading to next candidate...`)
              invalidateGeminiModelCache()
              break // break thinking loop, advance to next model in activeCandidates
            }

            // 429 = Rate limit / quota pool exhausted: Cascade to next model (each has independent quota pool)
            // 500, 502, 503, 504 = Service high demand / temporary outage: Cascade
            const isCascadeable = [429, 500, 502, 503, 504].includes(status)
            if (isCascadeable) {
              const reason = status === 429
                ? 'Rate Limit (429)'
                : `Server High Demand / Outage (${status})`
              onLog(`[AI TRANSLATION] Model '${model}' experienced ${reason}. Cascading to next candidate in chain...`)
              break // break thinking loop, advance to next model
            }

            // Fail fast on non-retryable client errors (401/403 Invalid API Key, 400 Bad Request)
            break
          } catch (e: any) {
            lastErrDetail = e.message
            break
          }
        }

        if (batchSuccess) break
      }

      if (batchSuccess) break

      if (attempt < maxRetries && !isGenerationCancelled) {
        const delayMs = attempt * 2500
        onLog(`[AI TRANSLATION] Temporary provider busy state. Retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    if (!batchSuccess) {
      let cleanErr = lastErrDetail
      try {
        const parsed = JSON.parse(lastErrDetail)
        if (parsed?.error?.message) {
          cleanErr = parsed.error.message
        }
      } catch {
        // ignore
      }
      throw new Error(`Gemini API: ${cleanErr}`)
    }

    for (const c of batch) {
      const trans = lineMap[c.index] ? sanitizeSinhalaScript(lineMap[c.index]) : ''
      translatedCues.push({
        ...c,
        text: trans || c.text
      })
    }
  }

  return translatedCues
}

/**
 * Translates subtitle cues using OpenAI API with automated retry on rate limits / 503
 */
async function translateCuesWithOpenAI(
  cues: SrtCue[],
  apiKey: string,
  modelChoice: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void
): Promise<SrtCue[]> {
  const candidateModels = await getOpenAiCandidateModels(apiKey, modelChoice)
  let currentModel = (modelChoice && modelChoice !== 'auto')
    ? modelChoice
    : (candidateModels[0] || 'gpt-4o-mini')

  onLog(`[AI TRANSLATION] Initiating OpenAI (${currentModel}) translation...`)
  const batchSize = 30
  const translatedCues: SrtCue[] = []
  const instruction = customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_AI_PROMPT
  const totalBatches = Math.ceil(cues.length / batchSize)

  for (let i = 0; i < cues.length; i += batchSize) {
    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }
    const batchIdx = Math.floor(i / batchSize) + 1
    const batch = cues.slice(i, i + batchSize)
    onLog(`[AI TRANSLATION] Translating batch ${batchIdx} of ${totalBatches}...`)
    if (onProgress) {
      onProgress(batchIdx, totalBatches)
    }

    const promptText = batch.map((c) => `[${c.index}] ${c.text.replace(/\n/g, ' ')}`).join('\n')

    let batchSuccess = false
    let lastErrDetail = ''
    let lineMap: Record<number, string> = {}
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (isGenerationCancelled) {
        throw new Error('Subtitle generation cancelled by user.')
      }

      const activeCandidates = [
        currentModel,
        ...candidateModels.filter((m) => m !== currentModel)
      ]

      for (const model of activeCandidates) {
        if (isGenerationCancelled) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            signal: activeAbortController?.signal,
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: instruction },
                { role: 'user', content: promptText }
              ],
              temperature: 0.3
            })
          })

          if (response.ok) {
            if (model !== currentModel) {
              currentModel = model
              onLog(`[AI TRANSLATION] Switched to active OpenAI model: ${model}`)
            }
            const data = await response.json()
            const content = data?.choices?.[0]?.message?.content || ''

            const parsedMap: Record<number, string> = {}
            const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
            for (const l of lines) {
              const m = l.match(/^\[(\d+)\]\s*(.*)$/)
              if (m) {
                const idx = parseInt(m[1], 10)
                parsedMap[idx] = sanitizeSinhalaScript(m[2].trim())
              }
            }

            const missing = batch.filter((c) => !parsedMap[c.index] || parsedMap[c.index].length === 0)
            if (missing.length > 0 && attempt < maxRetries) {
              onLog(`[AI TRANSLATION] Model missed ${missing.length} line(s) in batch ${batchIdx}. Retrying for complete translation...`)
              continue
            }

            lineMap = parsedMap
            batchSuccess = true
            break
          }

          const status = response.status
          const errText = await response.text()
          lastErrDetail = errText

          const isRetryable = [429, 500, 502, 503, 504].includes(status)
          if (isRetryable) {
            onLog(`[AI TRANSLATION] OpenAI model '${model}' busy (${status}). Trying alternative...`)
            continue
          }
          break
        } catch (e: any) {
          lastErrDetail = e.message
        }
      }

      if (batchSuccess) break

      if (attempt < maxRetries && !isGenerationCancelled) {
        const delayMs = attempt * 2500
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    if (!batchSuccess) {
      let cleanErr = lastErrDetail
      try {
        const parsed = JSON.parse(lastErrDetail)
        if (parsed?.error?.message) {
          cleanErr = parsed.error.message
        }
      } catch {
        // ignore
      }
      throw new Error(`OpenAI API: ${cleanErr}`)
    }

    for (const c of batch) {
      const trans = lineMap[c.index] ? sanitizeSinhalaScript(lineMap[c.index]) : ''
      translatedCues.push({
        ...c,
        text: trans || c.text
      })
    }
  }

  return translatedCues
}

type AiTranslationHandler = (
  cues: SrtCue[],
  apiKey: string,
  model: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void
) => Promise<SrtCue[]>

/**
 * AI Provider Translation Dispatch Registry
 * To support a new provider, implement its translation function and register it here.
 */
const AI_TRANSLATION_HANDLERS: Record<AiProviderId, AiTranslationHandler> = {
  gemini: translateCuesWithGemini,
  openai: translateCuesWithOpenAI
}

/**
 * Unified AI Translation Dispatcher
 */
async function translateCuesViaAi(
  cues: SrtCue[],
  provider: AiProviderId,
  apiKey: string,
  model: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void
): Promise<SrtCue[]> {
  const handler = AI_TRANSLATION_HANDLERS[provider]
  if (!handler) {
    throw new Error(`Unsupported AI provider "${provider}". Supported providers: ${Object.keys(AI_TRANSLATION_HANDLERS).join(', ')}`)
  }
  return handler(cues, apiKey, model, customPrompt, onLog, onProgress)
}

/**
 * Main Subtitle Generation Engine Execution
 */
export async function executeSubtitleGeneration(
  params: GenerateParams,
  onEvent: (data: any) => void
): Promise<{ success: boolean; output?: string; message?: string }> {
  isGenerationCancelled = false
  activeAbortController = new AbortController()
  // Clean slate for tracking only current temporary scratch files (never delete previously saved user files)
  activeCreatedFiles.clear()

  const { video, trackIndex, modelQuality = 'base', format, language, aiApiKey, aiProvider, aiModel, customPrompt, sourceType, sourceSubPath } = params

  // Workflow A: Translate an existing subtitle file (.srt) directly via AI
  if (sourceType === 'subtitle' || (!video && sourceSubPath)) {
    if (!sourceSubPath || !fs.existsSync(sourceSubPath)) {
      throw new Error(`Subtitle file not found: ${sourceSubPath || 'None'}`)
    }

    onEvent({ type: 'status', message: 'Reading subtitle file...' })
    onEvent({ type: 'progress', percent: 10, message: 'Reading subtitle cues...' })
    onEvent({ type: 'log', message: `[SUBTITLE] Translating existing subtitle file: ${sourceSubPath}` })

    const rawSrt = fs.readFileSync(sourceSubPath, 'utf-8')
    const cues = parseSrt(rawSrt)
    if (!cues || cues.length === 0) {
      throw new Error('No valid subtitle cues found in the chosen subtitle file.')
    }

    onEvent({ type: 'log', message: `[SUBTITLE] Loaded ${cues.length} cues from ${sourceSubPath}` })

    let processedCues = removeHallucinationLoops(cues)
    const initialCuesCount = processedCues.length
    processedCues = cleanSdhFromCues(processedCues)
    const sdhCleanedCount = initialCuesCount - processedCues.length
    if (sdhCleanedCount > 0) {
      onEvent({
        type: 'log',
        message: `[SDH CLEANER] Purged ${sdhCleanedCount} background sound effect cues (e.g. [music], [screaming], (sighs)). Retained ${processedCues.length} clean dialogue cues.`
      })
    }
    let finalSrtPath = sourceSubPath

    if (language === 'si') {
      if (!aiApiKey) {
        throw new Error('AI API Key required for Spoken Sinhala translation. Please configure your Gemini or OpenAI API Key in Settings.')
      }

      onEvent({ type: 'status', message: 'Translating subtitles into Spoken Sinhala via AI...' })
      onEvent({ type: 'progress', percent: 20, message: 'Translating dialogue into Spoken Sinhala...' })

      const translatedCues = await translateCuesViaAi(
        processedCues,
        aiProvider || 'gemini',
        aiApiKey,
        aiModel,
        customPrompt,
        (msg) => {
          onEvent({ type: 'log', message: msg })
        },
        (batchIdx, totalBatches) => {
          const translatePct = Math.min(95, Math.round(20 + (batchIdx / totalBatches) * 75))
          onEvent({
            type: 'progress',
            percent: translatePct,
            message: `Translating to Spoken Sinhala (${batchIdx}/${totalBatches})...`
          })
        }
      )

      if (isGenerationCancelled) {
        throw new Error('Subtitle translation cancelled by user.')
      }

      processedCues = cleanSdhFromCues(removeHallucinationLoops(translatedCues))
      finalSrtPath = sourceSubPath.replace(/\.[^/.]+$/, '') + '.sinhala.translated.srt'
    } else {
      finalSrtPath = sourceSubPath.replace(/\.[^/.]+$/, '') + `.${language}.translated.srt`
    }

    // Auto-increment (1), (2), etc. if file already exists so previous subtitles are never overwritten
    finalSrtPath = getUniqueFilePath(finalSrtPath)

    let finalContent = writeSrt(processedCues)
    let finalOutputPath = finalSrtPath

    if (format === 'vtt') {
      const vttContent = `WEBVTT\n\n${finalContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
      finalOutputPath = getUniqueFilePath(finalSrtPath.replace(/\.srt$/, '.vtt'))
      fs.writeFileSync(finalOutputPath, vttContent, 'utf-8')
    } else {
      fs.writeFileSync(finalOutputPath, finalContent, 'utf-8')
    }

    // Clear cancellation tracker: successfully generated file should never be deleted
    activeCreatedFiles.clear()
    onEvent({ type: 'progress', percent: 100, message: 'Subtitle translation complete!' })
    onEvent({ type: 'status', message: 'Subtitle translation complete!' })
    onEvent({ type: 'log', message: `[SUBTITLE] Translated subtitle saved: ${finalOutputPath}` })

    return { success: true, output: finalOutputPath }
  }

  // Workflow B: Transcribe video audio via Whisper speech-to-text
  if (!video) {
    throw new Error('Video path is required to generate subtitles from video.')
  }

  const ffmpeg = findBinary('ffmpeg')
  if (!ffmpeg) {
    throw new Error('ffmpeg.exe not found in bin/ folder.')
  }

  const whisper = getWhisperBinary()
  if (!whisper) {
    throw new Error('whisper.exe (or whisper-cli.exe) not found. Please install Whisper in bin/.')
  }

  const modelPath = getWhisperModelPath(modelQuality)
  if (!modelPath) {
    throw new Error(`MODEL_NOT_FOUND:${modelQuality}`)
  }

  onEvent({ type: 'status', message: 'Extracting 16kHz audio from video...' })
  onEvent({ type: 'progress', percent: 5, message: 'Extracting audio track...' })
  onEvent({ type: 'log', message: `[MEDIA] Extracting audio stream using FFmpeg: ${ffmpeg}` })

  const tempWav = join(app.getPath('temp'), `whisper_audio_${Date.now()}.wav`)
  activeCreatedFiles.add(tempWav)

  try {
    // Step 1: Extract 16kHz mono audio via FFmpeg (using multi-threading for maximum speed)
    await new Promise<void>((resolve, reject) => {
      pendingGeneratorReject = reject
      if (isGenerationCancelled) {
        pendingGeneratorReject = null
        reject(new Error('Subtitle generation cancelled by user.'))
        return
      }

      const ffmpegArgs = [
        '-y',
        '-threads', '0',
        '-i', video,
        '-map', `0:a:${trackIndex ?? 0}`,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        tempWav
      ]

      const ffmpegDir = dirname(ffmpeg)
      const augmentedPath = [
        ffmpegDir,
        process.env.PATH || ''
      ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

      const proc = spawn(ffmpeg, ffmpegArgs, {
        windowsHide: true,
        cwd: ffmpegDir,
        env: {
          ...process.env,
          PATH: augmentedPath
        }
      })
      activeGeneratorProcess = proc

      proc.on('close', (code) => {
        if (activeGeneratorProcess === proc) activeGeneratorProcess = null
        if (pendingGeneratorReject === reject) pendingGeneratorReject = null
        if (isGenerationCancelled) {
          reject(new Error('Subtitle generation cancelled by user.'))
          return
        }
        if (code === 0 && fs.existsSync(tempWav)) {
          resolve()
        } else {
          reject(new Error(`FFmpeg audio extraction failed with exit code ${code}`))
        }
      })

      proc.on('error', (err) => {
        if (activeGeneratorProcess === proc) activeGeneratorProcess = null
        if (pendingGeneratorReject === reject) pendingGeneratorReject = null
        reject(err)
      })
    })

    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    // Calculate audio duration in seconds
    let totalDurationSec = (params.durationSec && params.durationSec > 0) ? params.durationSec : 0
    if (totalDurationSec <= 0 && fs.existsSync(tempWav)) {
      const stats = fs.statSync(tempWav)
      const audioBytes = Math.max(0, stats.size - 44)
      totalDurationSec = audioBytes / 32000
    }
    if (totalDurationSec > 0) {
      onEvent({
        type: 'log',
        message: `[MEDIA] Audio extracted: ${tempWav} (${Math.round(totalDurationSec)}s / ${formatTime(totalDurationSec)})`
      })
    }

    onEvent({ type: 'status', message: 'Running Whisper AI transcription...' })
    onEvent({ type: 'progress', percent: 10, message: 'Starting Whisper AI transcription...' })

    // Determine language label for output file naming (.english, .sinhala, .original)
    const getLanguageSlug = (lang: string): string => {
      if (lang === 'si') return 'sinhala'
      if (lang === 'en') return 'english'
      if (lang === 'original') return 'original'
      return lang.toLowerCase()
    }

    const langSlug = getLanguageSlug(language)

    // Step 2: Run Whisper with maximum CPU threads and performance flags
    // For Sinhala, Whisper creates a temporary English translation bridge file first.
    // For English or Original, Whisper outputs directly with the language name.
    const outBase = language === 'si'
      ? video.replace(/\.[^/.]+$/, `.temp_en_${Date.now()}`)
      : getUniqueFilePath(video.replace(/\.[^/.]+$/, `.${langSlug}.generated.srt`)).replace(/\.srt$/, '')

    const generatedSrt = `${outBase}.srt`
    activeCreatedFiles.add(generatedSrt)
    const cpuThreads = Math.max(1, Math.min(os.cpus().length, 16))

    await new Promise<void>((resolve, reject) => {
      pendingGeneratorReject = reject
      if (isGenerationCancelled) {
        pendingGeneratorReject = null
        reject(new Error('Subtitle generation cancelled by user.'))
        return
      }

      const whisperArgs = [
        '-m', modelPath,
        '-f', tempWav,
        '-osrt',
        '-of', outBase,
        '-t', String(cpuThreads),
        '-bs', '2',
        '-bo', '2',
        '-fa',
        '-sns',
        '-nf',
        '-et', '2.0',
        '-lpt', '-0.8',
        '-nth', '0.65',
        '-mc', '0',
        '-pp'
      ]

      if (language === 'en') {
        whisperArgs.push('-l', 'en')
      } else if (language === 'original') {
        const resolvedLang = mapTrackLangToWhisper(params.trackLanguage)
        whisperArgs.push('-l', resolvedLang)
      } else if (language === 'si') {
        // Use Whisper's offline translation mode (-tr) as an English bridge:
        whisperArgs.push('-tr')
      } else {
        whisperArgs.push('-l', 'auto')
      }

      onEvent({
        type: 'log',
        message: `[WHISPER] Command (${cpuThreads} threads, fast-beam=2, anti-loop ctx=0, no-fallback): ${whisper} ${whisperArgs.join(' ')}`
      })

      const whisperDir = dirname(whisper)
      const ffmpegDir = dirname(ffmpeg)
      const augmentedPath = [
        whisperDir,
        ffmpegDir,
        process.env.PATH || ''
      ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

      const proc = spawn(whisper, whisperArgs, {
        windowsHide: true,
        cwd: whisperDir,
        env: {
          ...process.env,
          PATH: augmentedPath
        }
      })
      activeGeneratorProcess = proc

      // Mapping Whisper progress: 10% -> 75% if Sinhala translation follows, or 10% -> 95% if direct output
      const whisperRange = language === 'si' ? 65 : 85
      let lastReportedPercent = 10
      let lastSpokenText = ''
      let repeatLogCount = 0

      const processWhisperLine = (line: string) => {
        if (isGenerationCancelled) return
        const l = line.trim()
        if (!l) return

        // Timestamp match: [00:29:55.000 --> 00:29:57.000] Dialogue
        const timeMatch = l.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\](?:\s*(.*))?$/)
        let isDuplicateSpoken = false

        if (timeMatch) {
          const spoken = (timeMatch[9] || '').trim().toLowerCase().replace(/['".,!?;:\s\-_()[\]]/g, '')
          if (spoken && spoken === lastSpokenText) {
            repeatLogCount++
            // Don't flood console with repeated identical lines
            if (repeatLogCount > 1) {
              isDuplicateSpoken = true
            }
          } else if (spoken) {
            lastSpokenText = spoken
            repeatLogCount = 1
          }

          if (totalDurationSec > 0) {
            const h = parseInt(timeMatch[5], 10)
            const m = parseInt(timeMatch[6], 10)
            const s = parseInt(timeMatch[7], 10)
            const currentSec = h * 3600 + m * 60 + s
            const fraction = Math.min(1.0, currentSec / totalDurationSec)
            const calcPercent = Math.min(
              10 + whisperRange,
              Math.max(10, Math.round(10 + fraction * whisperRange))
            )

            if (calcPercent > lastReportedPercent) {
              lastReportedPercent = calcPercent
              const msg = `Transcribing speech: ${formatTime(currentSec)} / ${formatTime(totalDurationSec)} (${Math.round(fraction * 100)}%)`
              onEvent({ type: 'progress', percent: calcPercent, message: msg })
            }
          }
        }

        if (!isDuplicateSpoken) {
          onEvent({ type: 'log', message: `[WHISPER] ${l}` })
        }

        // Match built-in Whisper -pp progress output: progress = XX%
        const progMatch = l.match(/progress\s*=\s*(\d+)%/)
        if (progMatch) {
          const p = parseInt(progMatch[1], 10)
          const fraction = Math.min(1.0, p / 100)
          const calcPercent = Math.min(
            10 + whisperRange,
            Math.max(10, Math.round(10 + fraction * whisperRange))
          )
          if (calcPercent > lastReportedPercent) {
            lastReportedPercent = calcPercent
            onEvent({
              type: 'progress',
              percent: calcPercent,
              message: `Transcribing speech (${p}%)...`
            })
          }
        }
      }

      proc.stdout.on('data', (d) => {
        const text = d.toString()
        const lines = text.split('\n')
        for (const l of lines) {
          processWhisperLine(l)
        }
      })

      proc.stderr.on('data', (d) => {
        const text = d.toString()
        const lines = text.split('\n')
        for (const l of lines) {
          processWhisperLine(l)
        }
      })

      proc.on('close', (code) => {
        if (activeGeneratorProcess === proc) activeGeneratorProcess = null
        if (pendingGeneratorReject === reject) pendingGeneratorReject = null
        if (isGenerationCancelled) {
          reject(new Error('Subtitle generation cancelled by user.'))
          return
        }
        if (code === 0 && fs.existsSync(generatedSrt)) {
          // Automatic De-hallucination Filter: clean up any runaway repeated lines caused by silence/music
          try {
            const rawSrt = fs.readFileSync(generatedSrt, 'utf-8')
            const cues = parseSrt(rawSrt)
            const cleaned = removeHallucinationLoops(cues)
            if (cues.length !== cleaned.length) {
              fs.writeFileSync(generatedSrt, writeSrt(cleaned), 'utf-8')
              onEvent({
                type: 'log',
                message: `[WHISPER] Cleaned up ${cues.length - cleaned.length} runaway repetition loop cue(s).`
              })
            }
          } catch (err: any) {
            onEvent({ type: 'log', message: `[WHISPER] Notice: De-hallucination pass: ${err.message}` })
          }
          resolve()
        } else {
          reject(new Error(`Whisper transcription failed with exit code ${code}`))
        }
      })

      proc.on('error', (err) => {
        if (activeGeneratorProcess === proc) activeGeneratorProcess = null
        if (pendingGeneratorReject === reject) pendingGeneratorReject = null
        reject(err)
      })
    })

    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    // Cleanup temp WAV
    if (fs.existsSync(tempWav)) {
      try {
        fs.unlinkSync(tempWav)
      } catch (e) {
        // ignore
      }
    }
    activeCreatedFiles.delete(tempWav)

    // Step 3: Handle AI Translation if user requested Spoken Sinhala
    let finalSrtPath = generatedSrt
    if (language === 'si') {
      if (!aiApiKey) {
        throw new Error('AI API Key required for Spoken Sinhala translation. Please set it in Settings.')
      }

      onEvent({ type: 'status', message: 'Translating subtitles into Spoken Sinhala...' })
      onEvent({ type: 'progress', percent: 75, message: 'Translating into Spoken Sinhala...' })

      const srtContent = fs.readFileSync(generatedSrt, 'utf-8')
      let rawCues = parseSrt(srtContent)
      rawCues = removeHallucinationLoops(rawCues)
      const initialCuesCount = rawCues.length
      rawCues = cleanSdhFromCues(rawCues)
      const sdhCleanedCount = initialCuesCount - rawCues.length
      if (sdhCleanedCount > 0) {
        onEvent({
          type: 'log',
          message: `[SDH CLEANER] Purged ${sdhCleanedCount} background sound effect cues. Retained ${rawCues.length} clean dialogue cues.`
        })
      }

      try {
        const translatedCues = await translateCuesViaAi(
          rawCues,
          aiProvider || 'gemini',
          aiApiKey,
          aiModel,
          customPrompt,
          (msg) => {
            onEvent({ type: 'log', message: msg })
          },
          (batchIdx, totalBatches) => {
            const translatePct = Math.min(95, Math.round(75 + (batchIdx / totalBatches) * 20))
            onEvent({
              type: 'progress',
              percent: translatePct,
              message: `Translating to Spoken Sinhala (${batchIdx}/${totalBatches})...`
            })
          }
        )

        if (isGenerationCancelled) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        const finalSinhalaCues = cleanSdhFromCues(removeHallucinationLoops(translatedCues))
        const finalSinhalaSrt = writeSrt(finalSinhalaCues)
        finalSrtPath = getUniqueFilePath(video.replace(/\.[^/.]+$/, `.sinhala.generated.srt`))
        fs.writeFileSync(finalSrtPath, finalSinhalaSrt, 'utf-8')
        onEvent({ type: 'log', message: `[AI TRANSLATION] Translated subtitle saved: ${finalSrtPath}` })

        // Clean up the temporary intermediate bridge file now that final Sinhala file is saved
        if (fs.existsSync(generatedSrt)) {
          try {
            fs.unlinkSync(generatedSrt)
          } catch (cleanupErr: any) {
            onEvent({
              type: 'log',
              message: `[MEDIA] Notice: Could not remove temporary bridge file (${cleanupErr?.message || 'File in use by OS'})`
            })
          }
        }
        activeCreatedFiles.delete(generatedSrt)
      } catch (err: any) {
        if (isGenerationCancelled) {
          throw err
        }
        onEvent({
          type: 'log',
          message: `[AI TRANSLATION] Translation notice: ${err.message}`
        })
        onEvent({
          type: 'log',
          message: `[AI TRANSLATION] Preserving original transcribed subtitle so your transcription is not lost: ${generatedSrt}`
        })
        finalSrtPath = generatedSrt
        throw new Error(`AI Translation issue: ${err.message}. Your speech-to-text transcription was successfully generated and preserved at: ${generatedSrt}`)
      }
    }

    // Step 4: Handle format conversion if .vtt was requested
    let finalOutputPath = finalSrtPath
    if (format === 'vtt') {
      if (isGenerationCancelled) {
        throw new Error('Subtitle generation cancelled by user.')
      }
      const srtContent = fs.readFileSync(finalSrtPath, 'utf-8')
      const vttContent = `WEBVTT\n\n${srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
      finalOutputPath = getUniqueFilePath(finalSrtPath.replace(/\.srt$/, '.vtt'))
      fs.writeFileSync(finalOutputPath, vttContent, 'utf-8')
    }

    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    // Generation completed successfully: remove all tracked files from cancellation pool
    activeCreatedFiles.clear()

    onEvent({ type: 'progress', percent: 100, message: 'Subtitle generation complete!' })
    onEvent({ type: 'done', success: true, output: finalOutputPath })

    return {
      success: true,
      output: finalOutputPath
    }
  } catch (err: any) {
    if (isGenerationCancelled) {
      cleanupActiveGenerationFiles()
    }
    throw err
  }
}

export function cancelSubtitleGeneration(): void {
  isGenerationCancelled = true
  const proc = activeGeneratorProcess
  activeGeneratorProcess = null
  if (proc) {
    killProcessTree(proc)
  }
  if (activeAbortController) {
    try {
      activeAbortController.abort()
    } catch {}
    activeAbortController = null
  }
  if (pendingGeneratorReject) {
    const rej = pendingGeneratorReject
    pendingGeneratorReject = null
    rej(new Error('Subtitle generation cancelled by user.'))
  }
  cleanupActiveGenerationFiles()
}
