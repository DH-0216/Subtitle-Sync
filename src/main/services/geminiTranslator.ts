import { app } from 'electron'
import * as fs from 'fs'
import { join } from 'path'
import { SrtCue, sanitizeSinhalaScript } from '../srtTools'
import { getGeminiGenerateUrl, getGeminiVerifyUrl } from '@shared/links'
import {
  AI_MODELS_CONFIG,
  GeminiThinkingLevel,
  buildDynamicGeminiChain,
  isValidGeminiThinkingLevel
} from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'

let geminiModelCache: {
  models: string[]
  timestamp: number
  keyHash: string
} | null = null

function getPersistedCachePath(): string | null {
  try {
    return typeof app?.getPath === 'function'
      ? join(app.getPath('userData'), 'gemini-models-cache.json')
      : null
  } catch {
    return null
  }
}

function readPersistedGeminiModels(): string[] {
  const cachePath = getPersistedCachePath()
  if (!cachePath) return []
  try {
    if (!fs.existsSync(cachePath)) return []
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    return Array.isArray(parsed?.models)
      ? parsed.models.filter((m: unknown): m is string => typeof m === 'string' && m.length > 0)
      : []
  } catch {
    return []
  }
}

function writePersistedGeminiModels(models: string[]): void {
  const cachePath = getPersistedCachePath()
  if (!cachePath) return
  try {
    fs.writeFileSync(cachePath, JSON.stringify({ models, updatedAt: Date.now() }, null, 2), 'utf-8')
  } catch {
    // Non-fatal: in-memory cache still works
  }
}

function applyPreferredModel(chain: string[], preferredModel?: string): string[] {
  if (preferredModel && preferredModel !== 'auto' && chain[0] !== preferredModel) {
    return [preferredModel, ...chain.filter((m) => m !== preferredModel)]
  }
  return chain
}

/**
 * Updates both the in-memory and on-disk dynamic Gemini fallback chain
 * so offline/fallback runs always use the latest live-discovered models.
 */
export function updateGeminiModelCache(apiKey: string, models: string[]): void {
  if (!models || models.length === 0) return
  geminiModelCache = {
    models: [...models],
    timestamp: Date.now(),
    keyHash: apiKey.slice(-6)
  }
  writePersistedGeminiModels(models)
}

/**
 * Immediately removes a retired/404 model from both in-memory and persisted fallback chains
 * and invalidates the cache TTL so the next lookup refreshes from the live API.
 */
export function evictGeminiModel(modelId: string): void {
  if (geminiModelCache) {
    geminiModelCache = {
      ...geminiModelCache,
      models: geminiModelCache.models.filter((m) => m !== modelId),
      timestamp: 0
    }
  }
  const persisted = readPersistedGeminiModels()
  if (persisted.length > 0) {
    const remaining = persisted.filter((m) => m !== modelId)
    writePersistedGeminiModels(remaining)
  }
}

export async function getActiveFallbackChain(
  apiKey: string,
  preferredModel?: string,
  onLog?: (msg: string) => void
): Promise<string[]> {
  const keyHash = apiKey.slice(-6)
  const now = Date.now()

  if (
    geminiModelCache &&
    geminiModelCache.keyHash === keyHash &&
    now - geminiModelCache.timestamp < AI_MODELS_CONFIG.CACHE_TTL_MS &&
    geminiModelCache.models.length > 0
  ) {
    return applyPreferredModel(geminiModelCache.models, preferredModel)
  }

  try {
    const res = await fetch(getGeminiVerifyUrl(apiKey))
    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data?.models) ? data.models : []
      const rawIds = rawList
        .filter((m: any) => {
          const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
          return methods.includes('generateContent')
        })
        .map((m: any) => m.name || '')

      const baseChain = buildDynamicGeminiChain(rawIds)
      if (baseChain.length > 0) {
        updateGeminiModelCache(apiKey, baseChain)
        return applyPreferredModel(baseChain, preferredModel)
      }
    }
  } catch (err: any) {
    onLog?.(`[AI TRANSLATION] Notice: Live model query failed (${err?.message || 'Network error'}). Using persisted fallback chain.`)
  }

  const persisted = readPersistedGeminiModels()
  return buildDynamicGeminiChain(persisted, preferredModel)
}

export async function resolveGeminiModel(apiKey: string, onLog: (msg: string) => void): Promise<string> {
  const candidates = await getActiveFallbackChain(apiKey, undefined, onLog)
  if (candidates.length > 0 && candidates[0] !== 'auto') {
    onLog(`[AI TRANSLATION] Selected primary active model: ${candidates[0]}`)
    return candidates[0]
  }
  return candidates[0] || AI_MODELS_CONFIG.GEMINI_EMERGENCY_SEEDS[0]
}

function cleanTranslationText(text: string, targetLang?: string): string {
  if (!text) return ''
  if (targetLang === 'si') {
    return sanitizeSinhalaScript(text.trim())
  }
  return text.replace(/[ \t]{2,}/g, ' ').trim()
}

function parseGeminiResponseItems(content: string, targetLang?: string): Record<number, string> {
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
        const cleaned = cleanTranslationText(item.text, targetLang)
        if (cleaned.length > 0) {
          parsedMap[item.index] = cleaned
        }
      }
    }
  } else {
    const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
    for (const l of lines) {
      const m = l.match(/^\[?(\d+)\]?[:\s-]+(.*)$/)
      if (m) {
        const idx = parseInt(m[1], 10)
        const cleaned = cleanTranslationText(m[2], targetLang)
        if (cleaned.length > 0) {
          parsedMap[idx] = cleaned
        }
      }
    }
  }

  return parsedMap
}

function buildRequestSignal(abortSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(AI_MODELS_CONFIG.REQUEST_TIMEOUT_MS)
  if (abortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([abortSignal, timeoutSignal])
  }
  return abortSignal || timeoutSignal
}

export async function translateCuesWithGemini(
  cues: SrtCue[],
  apiKey: string,
  modelChoice: string | undefined,
  customPrompt: string | undefined,
  onLog: (msg: string) => void,
  onProgress?: (batchIdx: number, totalBatches: number) => void,
  options?: {
    isCancelled?: () => boolean
    abortSignal?: AbortSignal
    targetLang?: string
    thinkingLevel?: GeminiThinkingLevel
  }
): Promise<SrtCue[]> {
  const target = options?.targetLang || 'si'
  const thinkingLevel: GeminiThinkingLevel = isValidGeminiThinkingLevel(options?.thinkingLevel)
    ? options.thinkingLevel
    : AI_MODELS_CONFIG.THINKING_LEVEL
  onLog(`[AI TRANSLATION] Initiating Gemini ${target.toUpperCase()} translation (Thinking: ${thinkingLevel})...`)
  let currentModel = (modelChoice && modelChoice !== 'auto')
    ? modelChoice
    : await resolveGeminiModel(apiKey, onLog)

  onLog(`[AI TRANSLATION] Primary model: ${currentModel}`)
  let candidateModels = await getActiveFallbackChain(apiKey, currentModel, onLog)

  const batchSize = AI_MODELS_CONFIG.DEFAULT_BATCH_SIZE
  const instruction = customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_AI_PROMPT
  const batches: Array<{ batchIdx: number; startIdx: number; cues: SrtCue[] }> = []
  for (let i = 0; i < cues.length; i += batchSize) {
    batches.push({
      batchIdx: batches.length + 1,
      startIdx: i,
      cues: cues.slice(i, i + batchSize)
    })
  }

  const totalBatches = batches.length
  const batchResults: SrtCue[][] = new Array(totalBatches)
  let nextBatchPointer = 0
  let completedBatches = 0
  let rateLimitDetected = false

  const translateSingleBatch = async (batchEntry: { batchIdx: number; startIdx: number; cues: SrtCue[] }): Promise<SrtCue[]> => {
    const { batchIdx, startIdx, cues: batch } = batchEntry
    if (options?.isCancelled?.()) {
      throw new Error('Subtitle generation cancelled by user.')
    }

    onLog(`[AI TRANSLATION] Translating batch ${batchIdx} of ${totalBatches}...`)

    const contextStart = Math.max(0, startIdx - AI_MODELS_CONFIG.CONTEXT_WINDOW_CUES)
    const contextCues = cues.slice(contextStart, startIdx)
    const contextBlock = contextCues.length > 0
      ? `Preceding Dialogue Context (READ-ONLY for tone, pronouns, and continuity — DO NOT translate or include in JSON output):\n${JSON.stringify(
          contextCues.map((c) => ({ index: c.index, text: c.text.replace(/\n/g, ' ') }))
        )}\n\n`
      : ''

    let batchSuccess = false
    let lastErrDetail = ''
    const lineMap: Record<number, string> = {}
    const maxRetries = AI_MODELS_CONFIG.MAX_RETRIES

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (options?.isCancelled?.()) {
        throw new Error('Subtitle generation cancelled by user.')
      }

      const pendingCues = batch.filter((c) => !lineMap[c.index] || lineMap[c.index].length === 0)
      if (pendingCues.length === 0) {
        batchSuccess = true
        break
      }

      const batchInputJson = JSON.stringify(
        pendingCues.map((c) => ({
          index: c.index,
          text: c.text.replace(/\n/g, ' ')
        }))
      )

      const activeCandidates = [
        currentModel,
        ...candidateModels.filter((m) => m !== currentModel)
      ]

      let partialNeedsRetry = false

      for (const model of activeCandidates) {
        if (options?.isCancelled?.()) {
          throw new Error('Subtitle generation cancelled by user.')
        }

        for (const useThinking of [true, false]) {
          const genConfig: any = {
            temperature: AI_MODELS_CONFIG.TEMPERATURE,
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
            genConfig.thinkingConfig = { thinkingLevel }
          }

          const requestBody = {
            systemInstruction: {
              parts: [{ text: instruction }]
            },
            contents: [
              {
                parts: [
                  {
                    text: `${contextBlock}Input Subtitle Cues to Translate (JSON Array — return ONLY these exact indices):\n${batchInputJson}`
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
              signal: buildRequestSignal(options?.abortSignal)
            })

            if (response.ok) {
              if (model !== currentModel) {
                currentModel = model
                onLog(`[AI TRANSLATION] Cascaded to high-availability model: ${model}`)
              }
              const data = await response.json()
              const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
              const parsedMap = parseGeminiResponseItems(content, options?.targetLang)

              for (const c of pendingCues) {
                if (parsedMap[c.index]) {
                  lineMap[c.index] = parsedMap[c.index]
                }
              }

              const remaining = batch.filter((c) => !lineMap[c.index] || lineMap[c.index].length === 0)
              if (remaining.length === 0) {
                batchSuccess = true
                break
              }

              const recoveredCount = pendingCues.length - remaining.length
              if (attempt < maxRetries && recoveredCount > 0) {
                onLog(`[AI TRANSLATION] Batch ${batchIdx}: recovered ${recoveredCount}/${pendingCues.length} cues; retrying ${remaining.length} missing cue ID(s)...`)
                partialNeedsRetry = true
                break
              }

              if (attempt === maxRetries && Object.keys(lineMap).length > 0) {
                onLog(`[AI TRANSLATION] Notice: ${remaining.length} cue(s) in batch ${batchIdx} kept original text after ${maxRetries} attempts.`)
                batchSuccess = true
                break
              }

              lastErrDetail = `Model returned empty/incomplete cues (${remaining.length} missing)`
              break
            }

            const status = response.status
            const errText = await response.text()
            lastErrDetail = errText

            if (status === 400 && useThinking && errText.toLowerCase().includes('thinkingconfig')) {
              continue
            }

            if (status === 404) {
              onLog(`[AI TRANSLATION] Model '${model}' returned 404 (retired). Evicting from fallback chain and cascading to next candidate...`)
              evictGeminiModel(model)
              candidateModels = candidateModels.filter((m) => m !== model)
              if (currentModel === model) {
                currentModel = candidateModels[0] || currentModel
              }
              break
            }

            const isCascadeable = [429, 500, 502, 503, 504].includes(status)
            if (isCascadeable) {
              if (status === 429) {
                rateLimitDetected = true
              }
              const reason = status === 429
                ? 'Rate Limit (429)'
                : `Server High Demand / Outage (${status})`
              onLog(`[AI TRANSLATION] Model '${model}' experienced ${reason}. Cascading to next candidate in chain...`)
              break
            }

            break
          } catch (e: any) {
            lastErrDetail = e?.name === 'TimeoutError'
              ? `Request timed out after ${AI_MODELS_CONFIG.REQUEST_TIMEOUT_MS / 1000}s`
              : (e?.message || 'Network error')
            break
          }
        }

        if (batchSuccess || partialNeedsRetry) break
      }

      if (batchSuccess) break

      if (attempt < maxRetries && !options?.isCancelled?.()) {
        const delayMs = attempt * (partialNeedsRetry ? 800 : AI_MODELS_CONFIG.RETRY_BACKOFF_MS)
        if (!partialNeedsRetry) {
          onLog(`[AI TRANSLATION] Temporary provider busy state. Retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${maxRetries})...`)
        }
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

    return batch.map((c) => ({
      ...c,
      text: lineMap[c.index] || c.text
    }))
  }

  const workerCount = Math.min(AI_MODELS_CONFIG.CONCURRENCY, Math.max(1, totalBatches))
  const runWorker = async (workerIndex: number): Promise<void> => {
    if (workerIndex > 0 && AI_MODELS_CONFIG.WORKER_STAGGER_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, workerIndex * AI_MODELS_CONFIG.WORKER_STAGGER_MS))
    }

    while (true) {
      if (options?.isCancelled?.()) {
        throw new Error('Subtitle generation cancelled by user.')
      }
      // If a 429 rate limit was hit, throttle secondary workers down to concurrency 1
      if (rateLimitDetected && workerIndex > 0) {
        return
      }
      const idx = nextBatchPointer++
      if (idx >= totalBatches) return

      batchResults[idx] = await translateSingleBatch(batches[idx])
      completedBatches++
      if (onProgress) {
        onProgress(completedBatches, totalBatches)
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, (_, idx) => runWorker(idx)))
  return batchResults.flat()
}
