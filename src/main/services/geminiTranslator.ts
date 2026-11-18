import { SrtCue, sanitizeSinhalaScript } from '../srtTools'
import { getGeminiGenerateUrl } from '@shared/links'
import { AI_MODELS_CONFIG, buildDynamicGeminiChain } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'

let geminiModelCache: {
  models: string[]
  timestamp: number
  keyHash: string
} | null = null

export function invalidateGeminiModelCache(): void {
  geminiModelCache = null
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
    const cached = geminiModelCache.models
    if (preferredModel && preferredModel !== 'auto' && cached[0] !== preferredModel) {
      return [preferredModel, ...cached.filter((m) => m !== preferredModel)]
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

  return buildDynamicGeminiChain([], preferredModel)
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
  }
): Promise<SrtCue[]> {
  const target = options?.targetLang || 'si'
  onLog(`[AI TRANSLATION] Initiating Gemini ${target.toUpperCase()} translation...`)
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
            genConfig.thinkingConfig = { thinkingLevel: 'low' }
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
              onLog(`[AI TRANSLATION] Model '${model}' returned 404 (retired). Invalidating cache and cascading to next candidate...`)
              invalidateGeminiModelCache()
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
