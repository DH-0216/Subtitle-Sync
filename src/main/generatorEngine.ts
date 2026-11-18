import { app } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { findBinary, killProcessTree } from './media'
import { parseSrt, writeSrt, removeHallucinationLoops, getUniqueFilePath, cleanSdhFromCues } from './srtTools'
import { AiProviderId } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT, getLanguageConfig } from '@shared/translationPrompts'
import {
  getWhisperModelPath,
  getWhisperBinary
} from './services/whisperModelManager'
import {
  translateCuesWithGemini
} from './services/geminiTranslator'
import {
  translateCuesWithOpenAI
} from './services/openaiTranslator'
import {
  extractAudioWithFfmpeg,
  runWhisperTranscription
} from './services/whisperRunner'

export * from './services/whisperModelManager'
export * from './services/geminiTranslator'
export * from './services/openaiTranslator'
export * from './services/whisperRunner'
export { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'

export interface GenerateParams {
  video?: string
  sourceType?: 'video' | 'subtitle'
  sourceSubPath?: string
  deleteSourceAfter?: boolean
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

let activeGeneratorProcess: any = null
let isGenerationCancelled = false
let activeGenerateAbortController: AbortController | null = null

let isTranslationCancelled = false
let activeTranslateAbortController: AbortController | null = null

let pendingGeneratorReject: ((err: Error) => void) | null = null
const activeCreatedFiles = new Set<string>()

export function cleanupActiveGenerationFiles(): void {
  for (const filePath of activeCreatedFiles) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch {
      // ignore
    }
  }
  activeCreatedFiles.clear()
}

/**
 * AI Provider Translation Dispatch Registry
 */
const AI_TRANSLATION_HANDLERS = {
  gemini: (cues: any[], apiKey: string, model?: string, prompt?: string, onLog?: any, onProg?: any, targetLang?: string, opts?: any) =>
    translateCuesWithGemini(cues, apiKey, model, prompt, onLog, onProg, {
      isCancelled: opts?.isCancelled || (() => isTranslationCancelled),
      abortSignal: opts?.abortSignal || activeTranslateAbortController?.signal,
      targetLang: targetLang || 'si'
    }),
  openai: (cues: any[], apiKey: string, model?: string, prompt?: string, onLog?: any, onProg?: any, targetLang?: string, opts?: any) =>
    translateCuesWithOpenAI(cues, apiKey, model, prompt, onLog, onProg, {
      isCancelled: opts?.isCancelled || (() => isTranslationCancelled),
      abortSignal: opts?.abortSignal || activeTranslateAbortController?.signal,
      targetLang: targetLang || 'si'
    })
}

async function translateCuesViaAi(
  cues: any[],
  provider: AiProviderId,
  apiKey: string,
  model: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void,
  targetLang?: string,
  opts?: { isCancelled?: () => boolean; abortSignal?: AbortSignal }
): Promise<any[]> {
  const handler = AI_TRANSLATION_HANDLERS[provider]
  if (!handler) {
    throw new Error(`Unsupported AI provider "${provider}".`)
  }
  return handler(cues, apiKey, model, customPrompt, onLog, onProgress, targetLang, opts)
}

/**
 * Main Subtitle Generation & Translation Execution
 */
export async function executeSubtitleGeneration(
  params: GenerateParams,
  onEvent: (data: any) => void
): Promise<{ success: boolean; output?: string; message?: string }> {
  const isSubtitleSource = params.sourceType === 'subtitle' || (!params.video && params.sourceSubPath)

  if (isSubtitleSource) {
    isTranslationCancelled = false
    activeTranslateAbortController = new AbortController()
  } else {
    isGenerationCancelled = false
    activeGenerateAbortController = new AbortController()
    activeCreatedFiles.clear()
  }

  const {
    video,
    trackIndex,
    modelQuality = 'base',
    format,
    language,
    aiApiKey,
    aiProvider,
    aiModel,
    customPrompt,
    sourceType,
    sourceSubPath,
    deleteSourceAfter
  } = params

  // Workflow A: Translate an existing subtitle file (.srt) directly via AI
  if (sourceType === 'subtitle' || (!video && sourceSubPath)) {
    if (!sourceSubPath || !fs.existsSync(sourceSubPath)) {
      throw new Error(`Subtitle file not found: ${sourceSubPath || 'None'}`)
    }
    if (deleteSourceAfter) {
      activeCreatedFiles.add(sourceSubPath)
    }

    try {
      onEvent({ type: 'status', message: 'Reading subtitle file...' })
      onEvent({ type: 'progress', percent: 10, message: 'Reading subtitle cues...' })
      onEvent({ type: 'log', message: `[SUBTITLE] Translating existing subtitle file: ${sourceSubPath}` })

      const rawSrt = fs.readFileSync(sourceSubPath, 'utf-8')
      const cues = parseSrt(rawSrt)
      if (!cues || cues.length === 0) {
        throw new Error('No valid subtitle cues found in the chosen subtitle file.')
      }

      onEvent({ type: 'log', message: `[SUBTITLE] Loaded ${cues.length} cues from ${sourceSubPath}` })

      let processedCues = cleanSdhFromCues(removeHallucinationLoops(cues))
      const targetBase = video ? video.replace(/\.[^/.]+$/, '') : sourceSubPath.replace(/\.[^/.]+$/, '')
      let finalSrtPath = sourceSubPath

      const supportedAiLanguages = ['si', 'en', 'ta', 'hi', 'es']
      if (supportedAiLanguages.includes(language)) {
        const langConfig = getLanguageConfig(language)
        const langName = langConfig?.name || language.toUpperCase()

        if (!aiApiKey) {
          throw new Error(`AI API Key required for ${langName} translation. Please configure your API Key in Settings.`)
        }

        onEvent({ type: 'status', message: `Translating subtitles into ${langName} via AI...` })
        onEvent({ type: 'progress', percent: 20, message: `Translating dialogue into ${langName}...` })

        const translatedCues = await translateCuesViaAi(
          processedCues,
          aiProvider || 'gemini',
          aiApiKey,
          aiModel,
          customPrompt,
          (msg) => onEvent({ type: 'log', message: msg }),
          (batchIdx, totalBatches) => {
            const translatePct = Math.min(95, Math.round(20 + (batchIdx / totalBatches) * 75))
            onEvent({
              type: 'progress',
              percent: translatePct,
              message: `Translating to ${langName} (${batchIdx}/${totalBatches})...`
            })
          },
          language,
          {
            isCancelled: () => isTranslationCancelled,
            abortSignal: activeTranslateAbortController?.signal
          }
        )

        if (isTranslationCancelled) {
          throw new Error('Subtitle translation cancelled by user.')
        }

        processedCues = cleanSdhFromCues(removeHallucinationLoops(translatedCues))
        const langSlug = langConfig?.name?.toLowerCase() || language
        finalSrtPath = `${targetBase}.${langSlug}.translated.srt`
      } else {
        throw new Error(`Target language '${language}' is not supported for AI translation. Supported languages: Sinhala, English, Tamil, Hindi, Spanish.`)
      }

      finalSrtPath = getUniqueFilePath(finalSrtPath)
      const finalContent = writeSrt(processedCues)
      let finalOutputPath = finalSrtPath

      if (format === 'vtt') {
        const vttContent = `WEBVTT\n\n${finalContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
        finalOutputPath = getUniqueFilePath(finalSrtPath.replace(/\.srt$/, '.vtt'))
        fs.writeFileSync(finalOutputPath, vttContent, 'utf-8')
      } else {
        fs.writeFileSync(finalOutputPath, finalContent, 'utf-8')
      }

      if (deleteSourceAfter && fs.existsSync(sourceSubPath)) {
        try {
          fs.unlinkSync(sourceSubPath)
        } catch {}
      }

      onEvent({ type: 'progress', percent: 100, message: 'Subtitle translation complete!' })
      onEvent({ type: 'status', message: 'Subtitle translation complete!' })
      onEvent({ type: 'log', message: `[SUBTITLE] Translated subtitle saved: ${finalOutputPath}` })

      return { success: true, output: finalOutputPath }
    } catch (err: any) {
      if (deleteSourceAfter && fs.existsSync(sourceSubPath)) {
        try {
          fs.unlinkSync(sourceSubPath)
        } catch {}
        activeCreatedFiles.delete(sourceSubPath)
      }
      throw err
    }
  }

  // Workflow B: Transcribe video audio via Whisper speech-to-text
  if (!video) {
    throw new Error('Video path is required to generate subtitles from video.')
  }

  const ffmpeg = findBinary('ffmpeg')
  if (!ffmpeg) throw new Error('ffmpeg.exe not found in bin/ folder.')

  const whisper = getWhisperBinary()
  if (!whisper) throw new Error('whisper.exe (or whisper-cli.exe) not found. Please install Whisper in bin/.')

  const modelPath = getWhisperModelPath(modelQuality)
  if (!modelPath) throw new Error(`MODEL_NOT_FOUND:${modelQuality}`)

  onEvent({ type: 'status', message: 'Extracting 16kHz audio from video...' })
  onEvent({ type: 'progress', percent: 5, message: 'Extracting audio track...' })
  onEvent({ type: 'log', message: `[MEDIA] Extracting audio stream using FFmpeg: ${ffmpeg}` })

  const tempWav = join(app.getPath('temp'), `whisper_audio_${Date.now()}.wav`)
  activeCreatedFiles.add(tempWav)

  try {
    // Step 1: Extract 16kHz audio
    await extractAudioWithFfmpeg({
      ffmpeg,
      video,
      trackIndex,
      tempWav,
      onProcessStart: (proc) => {
        activeGeneratorProcess = proc
      },
      isCancelled: () => isGenerationCancelled
    })

    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    let totalDurationSec = (params.durationSec && params.durationSec > 0) ? params.durationSec : 0
    if (totalDurationSec <= 0 && fs.existsSync(tempWav)) {
      const stats = fs.statSync(tempWav)
      totalDurationSec = Math.max(0, stats.size - 44) / 32000
    }

    onEvent({ type: 'status', message: 'Running Whisper AI transcription...' })
    onEvent({ type: 'progress', percent: 10, message: 'Starting Whisper AI transcription...' })

    const langSlug = language === 'si' ? 'sinhala' : (language === 'en' ? 'english' : 'original')
    const isBridgeTranslation = language === 'si'
    const outBase = isBridgeTranslation
      ? join(app.getPath('temp'), `whisper_bridge_${Date.now()}`)
      : getUniqueFilePath(video.replace(/\.[^/.]+$/, `.${langSlug}.generated.srt`)).replace(/\.srt$/, '')

    const generatedSrt = `${outBase}.srt`
    activeCreatedFiles.add(generatedSrt)

    // Step 2: Run Whisper transcription
    await runWhisperTranscription({
      whisper,
      ffmpeg,
      modelPath,
      tempWav,
      outBase,
      generatedSrt,
      language,
      trackLanguage: params.trackLanguage,
      totalDurationSec,
      onEvent,
      onProcessStart: (proc) => {
        activeGeneratorProcess = proc
      },
      isCancelled: () => isGenerationCancelled
    })

    if (isGenerationCancelled) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    if (fs.existsSync(tempWav)) {
      try {
        fs.unlinkSync(tempWav)
      } catch {}
    }
    activeCreatedFiles.delete(tempWav)

    // Step 3: Handle AI Translation for non-English target languages
    let finalSrtPath = generatedSrt
    const videoAiLanguages = ['si', 'ta', 'hi', 'es']
    if (videoAiLanguages.includes(language)) {
      const langConfig = getLanguageConfig(language)
      const langName = langConfig?.name || language.toUpperCase()

      if (!aiApiKey) {
        throw new Error(`AI API Key required for ${langName} translation. Please set it in Settings.`)
      }

      onEvent({ type: 'status', message: `Translating subtitles into ${langName}...` })
      onEvent({ type: 'progress', percent: 75, message: `Translating into ${langName}...` })

      const srtContent = fs.readFileSync(generatedSrt, 'utf-8')
      const parsedCues = removeHallucinationLoops(parseSrt(srtContent))
      const initialCuesCount = parsedCues.length
      const rawCues = cleanSdhFromCues(parsedCues)
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
          (msg) => onEvent({ type: 'log', message: msg }),
          (batchIdx, totalBatches) => {
            const translatePct = Math.min(95, Math.round(75 + (batchIdx / totalBatches) * 20))
            onEvent({
              type: 'progress',
              percent: translatePct,
              message: `Translating to ${langName} (${batchIdx}/${totalBatches})...`
            })
          },
          language,
          {
            isCancelled: () => isGenerationCancelled,
            abortSignal: activeGenerateAbortController?.signal
          }
        )

        if (isGenerationCancelled) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        const finalCues = cleanSdhFromCues(removeHallucinationLoops(translatedCues))
        const finalSrt = writeSrt(finalCues)
        const langSlug = langConfig?.name?.toLowerCase() || language
        finalSrtPath = getUniqueFilePath(video.replace(/\.[^/.]+$/, `.${langSlug}.generated.srt`))
        fs.writeFileSync(finalSrtPath, finalSrt, 'utf-8')
        onEvent({ type: 'log', message: `[AI TRANSLATION] Translated subtitle saved: ${finalSrtPath}` })

        if (fs.existsSync(generatedSrt)) {
          try {
            fs.unlinkSync(generatedSrt)
          } catch {}
        }
        activeCreatedFiles.delete(generatedSrt)
      } catch (err: any) {
        if (fs.existsSync(generatedSrt)) {
          try {
            fs.unlinkSync(generatedSrt)
          } catch {}
        }
        activeCreatedFiles.delete(generatedSrt)
        if (isGenerationCancelled) throw err
        throw new Error(`AI Translation issue: ${err.message}`)
      }
    }

    // Step 4: Handle .vtt format
    let finalOutputPath = finalSrtPath
    if (format === 'vtt') {
      if (isGenerationCancelled) throw new Error('Subtitle generation cancelled by user.')
      const srtContent = fs.readFileSync(finalSrtPath, 'utf-8')
      const vttContent = `WEBVTT\n\n${srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`
      finalOutputPath = getUniqueFilePath(finalSrtPath.replace(/\.srt$/, '.vtt'))
      fs.writeFileSync(finalOutputPath, vttContent, 'utf-8')
    }

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

export function cancelSubtitleGeneration(job?: 'translate' | 'generate'): void {
  if (!job || job === 'generate') {
    isGenerationCancelled = true
    const proc = activeGeneratorProcess
    activeGeneratorProcess = null
    if (proc) {
      killProcessTree(proc)
    }
    if (activeGenerateAbortController) {
      try {
        activeGenerateAbortController.abort()
      } catch {}
      activeGenerateAbortController = null
    }
    if (pendingGeneratorReject) {
      const rej = pendingGeneratorReject
      pendingGeneratorReject = null
      rej(new Error('Subtitle generation cancelled by user.'))
    }
    cleanupActiveGenerationFiles()
  }

  if (!job || job === 'translate') {
    isTranslationCancelled = true
    if (activeTranslateAbortController) {
      try {
        activeTranslateAbortController.abort()
      } catch {}
      activeTranslateAbortController = null
    }
  }
}
