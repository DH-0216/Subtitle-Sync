import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'
import { spawn } from 'child_process'
import { findBinary } from './media'
import { parseSrt, SrtCue, writeSrt, removeHallucinationLoops } from './srtTools'
import { getWhisperModelDownloadUrl, getGeminiGenerateUrl } from '@shared/links'

export interface GenerateParams {
  video: string
  trackIndex?: number | null
  trackLanguage?: string | null
  durationSec?: number | null
  modelQuality: 'tiny' | 'base' | 'small' | 'medium'
  format: 'srt' | 'vtt'
  language: string
  aiApiKey?: string
  aiProvider?: 'gemini' | 'openai'
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
5. Maintain the exact format "[index] Translated line".
6. Return exactly the same number of numbered lines without dropping any lines.
7. Do not include introductory, markdown formatting or explanatory text.`

let activeGeneratorProcess: any = null
let activeDownloadRequest: any = null
let isGenerationCancelled = false
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

export function getWhisperModelPath(quality: string): string | null {
  const modelName = `ggml-${quality}.bin`
  const locations = [
    join(getModelsDir(), modelName),
    join(app.getAppPath(), 'bin', 'models', modelName),
    join(app.getAppPath(), 'bin', modelName),
    join(process.resourcesPath, 'bin', 'models', modelName),
    join(process.resourcesPath, 'bin', modelName)
  ]

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc
    }
  }
  return null
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
    const modelName = `ggml-${quality}.bin`
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
async function getGeminiCandidateModels(apiKey: string, preferredModel?: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (res.ok) {
      const data = await res.json()
      const live = (data?.models || [])
        .filter((m: any) => {
          const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
          return methods.includes('generateContent')
        })
        .map((m: any) => (m.name || '').replace(/^models\//, ''))
        .filter((n: string) => n.length > 0)

      // Sort live models dynamically:
      // 1. Models containing 'flash' (fastest & high quota), newer versions first
      // 2. All other generation models, newer versions first
      const flashModels = live
        .filter((m) => m.toLowerCase().includes('flash'))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))

      const otherModels = live
        .filter((m) => !m.toLowerCase().includes('flash'))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))

      const ordered = [
        ...(preferredModel && preferredModel !== 'auto' ? [preferredModel] : []),
        ...flashModels,
        ...otherModels
      ]

      const unique = Array.from(new Set(ordered))
      if (unique.length > 0) {
        return unique
      }
    }
  } catch {
    // fallback
  }

  return preferredModel && preferredModel !== 'auto' ? [preferredModel] : ['gemini-flash']
}

/**
 * Dynamically detects the optimal active Gemini model from the provider at runtime.
 */
async function resolveGeminiModel(apiKey: string, onLog: (msg: string) => void): Promise<string> {
  const candidates = await getGeminiCandidateModels(apiKey)
  if (candidates.length > 0 && candidates[0] !== 'auto') {
    onLog(`[AI TRANSLATION] Auto-detected active model from Google: ${candidates[0]}`)
    return candidates[0]
  }
  return candidates[0] || 'gemini-flash'
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
      const exclude = ['realtime', 'audio', 'tts', 'transcription', 'whisper', 'embedding', 'dall-e', 'moderation', 'instruct']
      const chatModels = rawList
        .map((m: any) => m.id || '')
        .filter((id: string) => {
          const lower = id.toLowerCase()
          return (
            (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('chatgpt-')) &&
            !exclude.some((e) => lower.includes(e))
          )
        })
        .sort((a: string, b: string) => {
          const aMini = a.includes('mini')
          const bMini = b.includes('mini')
          if (aMini && !bMini) return -1
          if (!aMini && bMini) return 1
          return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
        })

      const ordered = [
        ...(preferredModel && preferredModel !== 'auto' ? [preferredModel] : []),
        ...chatModels
      ]
      const unique = Array.from(new Set(ordered))
      if (unique.length > 0) return unique
    }
  } catch {
    // fallback
  }
  return preferredModel && preferredModel !== 'auto' ? [preferredModel] : ['gpt-4o-mini']
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

  onLog(`[AI TRANSLATION] Target model: ${currentModel}`)
  const candidateModels = await getGeminiCandidateModels(apiKey, currentModel)

  const batchSize = 75
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

    const body = {
      contents: [
        {
          parts: [
            {
              text: `${instruction}

Input:
${promptText}`
            }
          ]
        }
      ]
    }

    let batchSuccess = false
    let lastErrDetail = ''
    let content = ''
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (isGenerationCancelled) {
        throw new Error('Subtitle generation cancelled by user.')
      }

      // Order candidate models with currentModel first
      const activeCandidates = [
        currentModel,
        ...candidateModels.filter((m) => m !== currentModel)
      ]

      for (const model of activeCandidates) {
        if (isGenerationCancelled) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        try {
          const response = await fetch(getGeminiGenerateUrl(apiKey, model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })

          if (response.ok) {
            if (model !== currentModel) {
              currentModel = model
              onLog(`[AI TRANSLATION] Switched to high-availability model: ${model}`)
            }
            const data = await response.json()
            content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
            batchSuccess = true
            break
          }

          const status = response.status
          const errText = await response.text()
          lastErrDetail = errText

          // 404 = Model deprecated/not found
          // 429 = Rate limit / quota spike
          // 500, 502, 503, 504 = Server high demand / temporary outage
          const isRetryable = [404, 429, 500, 502, 503, 504].includes(status)

          if (isRetryable) {
            const reason = status === 503
              ? 'high demand (spikes in demand are temporary)'
              : status === 429
              ? 'rate limit'
              : `server busy (${status})`
            onLog(`[AI TRANSLATION] Model '${model}' experienced ${reason}. Switching to alternative candidate...`)
            continue
          }

          // If a non-retryable 4xx client error (e.g. invalid key 401/403 or bad request 400), don't loop indefinitely
          break
        } catch (e: any) {
          lastErrDetail = e.message
        }
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

    // Parse translated lines
    const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
    const lineMap: Record<number, string> = {}

    for (const l of lines) {
      const m = l.match(/^\[(\d+)\]\s*(.*)$/)
      if (m) {
        lineMap[parseInt(m[1], 10)] = m[2].trim()
      }
    }

    for (const c of batch) {
      translatedCues.push({
        ...c,
        text: lineMap[c.index] || c.text
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
  const batchSize = 75
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

    let content = ''
    let batchSuccess = false
    let lastErrDetail = ''
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
            content = data?.choices?.[0]?.message?.content || ''
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

    const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
    const lineMap: Record<number, string> = {}

    for (const l of lines) {
      const m = l.match(/^\[(\d+)\]\s*(.*)$/)
      if (m) {
        lineMap[parseInt(m[1], 10)] = m[2].trim()
      }
    }

    for (const c of batch) {
      translatedCues.push({
        ...c,
        text: lineMap[c.index] || c.text
      })
    }
  }

  return translatedCues
}

/**
 * Unified AI Translation Dispatcher
 */
async function translateCuesViaAi(
  cues: SrtCue[],
  provider: 'gemini' | 'openai',
  apiKey: string,
  model: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void
): Promise<SrtCue[]> {
  if (provider === 'openai') {
    return translateCuesWithOpenAI(cues, apiKey, model, customPrompt, onLog, onProgress)
  }
  return translateCuesWithGemini(cues, apiKey, model, customPrompt, onLog, onProgress)
}

/**
 * Main Subtitle Generation Engine Execution
 */
export async function executeSubtitleGeneration(
  params: GenerateParams,
  onEvent: (data: any) => void
): Promise<{ success: boolean; output?: string; message?: string }> {
  isGenerationCancelled = false
  cleanupActiveGenerationFiles()

  const { video, trackIndex, modelQuality, format, language, aiApiKey, aiProvider, aiModel, customPrompt } = params

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
      if (isGenerationCancelled) {
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

      const proc = spawn(ffmpeg, ffmpegArgs, { windowsHide: true })
      activeGeneratorProcess = proc

      proc.on('close', (code) => {
        activeGeneratorProcess = null
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
        activeGeneratorProcess = null
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
      ? video.replace(/\.[^/.]+$/, `.temp_en.generated`)
      : video.replace(/\.[^/.]+$/, `.${langSlug}.generated`)

    const generatedSrt = `${outBase}.srt`
    activeCreatedFiles.add(generatedSrt)
    const cpuThreads = Math.max(1, Math.min(os.cpus().length, 16))

    await new Promise<void>((resolve, reject) => {
      if (isGenerationCancelled) {
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

      const proc = spawn(whisper, whisperArgs, { windowsHide: true })
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
        activeGeneratorProcess = null
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
        activeGeneratorProcess = null
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
      const rawCues = parseSrt(srtContent)

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

        const finalSinhalaSrt = writeSrt(translatedCues)
        finalSrtPath = video.replace(/\.[^/.]+$/, `.sinhala.generated.srt`)
        activeCreatedFiles.add(finalSrtPath)
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
      finalOutputPath = finalSrtPath.replace(/\.srt$/, '.vtt')
      activeCreatedFiles.add(finalOutputPath)
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
  if (activeGeneratorProcess) {
    try {
      activeGeneratorProcess.kill()
    } catch (e) {
      // ignore
    }
    activeGeneratorProcess = null
  }
  cleanupActiveGenerationFiles()
}
