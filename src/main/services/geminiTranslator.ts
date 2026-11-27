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

export function invalidateGeminiModelCache(): void {
  geminiModelCache = null
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

export const getGeminiCandidateModels = getActiveFallbackChain

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

  const batchSize = 35
  const translatedCues: SrtCue[] = []
  const instruction = customPrompt && customPrompt.trim().length > 0 ? customPrompt.trim() : DEFAULT_AI_PROMPT
  const totalBatches = Math.ceil(cues.length / batchSize)

  for (let i = 0; i < cues.length; i += batchSize) {
    if (options?.isCancelled?.()) {
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
      if (options?.isCancelled?.()) {
        throw new Error('Subtitle generation cancelled by user.')
      }

      const activeCandidates = [
        currentModel,
        ...candidateModels.filter((m) => m !== currentModel)
      ]

      for (const model of activeCandidates) {
        if (options?.isCancelled?.()) {
          throw new Error('Subtitle generation cancelled by user.')
        }

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
            genConfig.thinkingConfig = { thinkingLevel }
          }

          const requestBody = {
            contents: [
              {
                parts: [
                  {
                    text: `${instruction}\n\nInput Subtitle Cues (JSON Array):\n${batchInputJson}`
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
              signal: options?.abortSignal
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
                    parsedMap[item.index] = cleanTranslationText(item.text, options?.targetLang)
                  }
                }
              } else {
                const lines = content.split('\n').filter((l: string) => l.trim().length > 0)
                for (const l of lines) {
                  const m = l.match(/^\[?(\d+)\]?[:\s-]+(.*)$/)
                  if (m) {
                    const idx = parseInt(m[1], 10)
                    parsedMap[idx] = cleanTranslationText(m[2], options?.targetLang)
                  }
                }
              }

              const missing = batch.filter((c) => !parsedMap[c.index] || parsedMap[c.index].length === 0)
              if (missing.length > 0 && attempt < maxRetries) {
                onLog(`[AI TRANSLATION] Model missed ${missing.length} cue(s) in batch ${batchIdx}. Retrying for complete translation...`)
                break
              }

              lineMap = parsedMap
              batchSuccess = true
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
              const reason = status === 429
                ? 'Rate Limit (429)'
                : `Server High Demand / Outage (${status})`
              onLog(`[AI TRANSLATION] Model '${model}' experienced ${reason}. Cascading to next candidate in chain...`)
              break
            }

            break
          } catch (e: any) {
            lastErrDetail = e.message
            break
          }
        }

        if (batchSuccess) break
      }

      if (batchSuccess) break

      if (attempt < maxRetries && !options?.isCancelled?.()) {
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
      const trans = lineMap[c.index] ? cleanTranslationText(lineMap[c.index], options?.targetLang) : ''
      translatedCues.push({
        ...c,
        text: trans || c.text
      })
    }
  }

  return translatedCues
}
