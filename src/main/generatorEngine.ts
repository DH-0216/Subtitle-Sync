import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'
import { spawn } from 'child_process'
import { findBinary } from './media'
import { parseSrt, SrtCue, writeSrt } from './srtTools'

export interface GenerateParams {
  video: string
  trackIndex?: number | null
  modelQuality: 'tiny' | 'base' | 'small' | 'medium'
  format: 'srt' | 'vtt'
  language: string
  aiApiKey?: string
  aiProvider?: 'gemini' | 'openai'
  customPrompt?: string
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
    const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${modelName}`

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
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        reject(err)
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

/**
 * Translates subtitle cues using Google Gemini API into natural spoken Sinhala
 */
async function translateCuesWithGemini(
  cues: SrtCue[],
  apiKey: string,
  customPrompt: string | undefined,
  onLog: (msg: string) => void
): Promise<SrtCue[]> {
  onLog('[AI TRANSLATION] Initiating Gemini Spoken Sinhala translation...')
  const batchSize = 40
  const translatedCues: SrtCue[] = []
  const instruction = customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_AI_PROMPT

  for (let i = 0; i < cues.length; i += batchSize) {
    const batch = cues.slice(i, i + batchSize)
    onLog(`[AI TRANSLATION] Translating batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(cues.length / batchSize)}...`)

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API Error (${response.status}): ${errText}`)
    }

    const data = await response.json()
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

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
 * Main Subtitle Generation Engine Execution
 */
export async function executeSubtitleGeneration(
  params: GenerateParams,
  onEvent: (data: any) => void
): Promise<{ success: boolean; output?: string; message?: string }> {
  const { video, trackIndex, modelQuality, format, language, aiApiKey, aiProvider, customPrompt } = params

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

  // Step 1: Extract 16kHz mono audio via FFmpeg
  await new Promise<void>((resolve, reject) => {
    const ffmpegArgs = [
      '-y',
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

  onEvent({ type: 'log', message: `[MEDIA] Audio extracted: ${tempWav}` })
  onEvent({ type: 'status', message: 'Running Whisper AI transcription...' })
  onEvent({ type: 'progress', percent: 15, message: 'Transcribing speech to text...' })

  // Step 2: Run Whisper
  const outBase = video.replace(/\.[^/.]+$/, `.generated`)
  const generatedSrt = `${outBase}.srt`

  await new Promise<void>((resolve, reject) => {
    const whisperArgs = [
      '-m', modelPath,
      '-f', tempWav,
      '-osrt',
      '-of', outBase,
      '-t', '4'
    ]

    if (language === 'en') {
      whisperArgs.push('-l', 'en')
    } else if (language === 'original') {
      whisperArgs.push('-l', 'auto')
    } else if (language === 'si') {
      // Use Whisper's offline translation mode (-tr) as an English bridge:
      // Translates foreign speech (Korean, Tamil, Hindi, Spanish, etc.) into clean English text first,
      // which maximizes Gemini's accuracy and natural colloquial tone when translating to Sinhala.
      whisperArgs.push('-tr')
    } else {
      whisperArgs.push('-l', 'auto')
    }

    onEvent({ type: 'log', message: `[WHISPER] Command: ${whisper} ${whisperArgs.join(' ')}` })

    const proc = spawn(whisper, whisperArgs, { windowsHide: true })
    activeGeneratorProcess = proc

    proc.stdout.on('data', (d) => {
      const text = d.toString()
      const lines = text.split('\n')
      for (const l of lines) {
        if (l.trim()) {
          onEvent({ type: 'log', message: `[WHISPER] ${l.trim()}` })
        }
      }
    })

    proc.stderr.on('data', (d) => {
      const text = d.toString()
      const lines = text.split('\n')
      for (const l of lines) {
        if (l.trim()) {
          onEvent({ type: 'log', message: `[WHISPER] ${l.trim()}` })
        }
      }
    })

    proc.on('close', (code) => {
      activeGeneratorProcess = null
      if (code === 0 && fs.existsSync(generatedSrt)) {
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

  // Cleanup temp WAV
  if (fs.existsSync(tempWav)) {
    try {
      fs.unlinkSync(tempWav)
    } catch (e) {
      // ignore
    }
  }

  // Step 3: Handle AI Translation if user requested Spoken Sinhala
  let finalSrtPath = generatedSrt
  if (language === 'si') {
    if (!aiApiKey) {
      throw new Error('AI API Key required for Spoken Sinhala translation. Please set it in Settings.')
    }

    onEvent({ type: 'status', message: 'Translating subtitles into Spoken Sinhala...' })
    onEvent({ type: 'progress', percent: 80, message: 'Translating into Spoken Sinhala...' })

    const srtContent = fs.readFileSync(generatedSrt, 'utf-8')
    const rawCues = parseSrt(srtContent)
    const translatedCues = await translateCuesWithGemini(rawCues, aiApiKey, customPrompt, (msg) => {
      onEvent({ type: 'log', message: msg })
    })

    const finalSinhalaSrt = writeSrt(translatedCues)
    finalSrtPath = video.replace(/\.[^/.]+$/, `.sinhala.generated.srt`)
    fs.writeFileSync(finalSrtPath, finalSinhalaSrt, 'utf-8')
    onEvent({ type: 'log', message: `[AI TRANSLATION] Translated subtitle saved: ${finalSrtPath}` })
  }

  // Step 4: Handle format conversion if .vtt was requested
  let finalOutputPath = finalSrtPath
  if (format === 'vtt') {
    const srtContent = fs.readFileSync(finalSrtPath, 'utf-8')
    const vttContent = `WEBVTT\n\n${srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
    finalOutputPath = finalSrtPath.replace(/\.srt$/, '.vtt')
    fs.writeFileSync(finalOutputPath, vttContent, 'utf-8')
  }

  onEvent({ type: 'progress', percent: 100, message: 'Subtitle generation complete!' })
  onEvent({ type: 'done', success: true, output: finalOutputPath })

  return {
    success: true,
    output: finalOutputPath
  }
}

export function cancelSubtitleGeneration(): void {
  if (activeGeneratorProcess) {
    try {
      activeGeneratorProcess.kill()
    } catch (e) {
      // ignore
    }
    activeGeneratorProcess = null
  }
}
