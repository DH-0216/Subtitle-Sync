import { SrtCue, sanitizeSinhalaScript } from '../srtTools'
import { buildDynamicOpenAiChain } from '@shared/aiModels'
import { DEFAULT_AI_PROMPT } from '@shared/translationPrompts'

export async function getOpenAiCandidateModels(apiKey: string, preferredModel?: string): Promise<string[]> {
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

function cleanTranslationText(text: string, targetLang?: string): string {
  if (!text) return ''
  if (targetLang === 'si') {
    return sanitizeSinhalaScript(text.trim())
  }
  return text.replace(/[ \t]{2,}/g, ' ').trim()
}

export async function translateCuesWithOpenAI(
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
    if (options?.isCancelled?.()) {
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

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            signal: options?.abortSignal,
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
                parsedMap[idx] = cleanTranslationText(m[2], options?.targetLang)
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

      if (attempt < maxRetries && !options?.isCancelled?.()) {
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
      const trans = lineMap[c.index] ? cleanTranslationText(lineMap[c.index], options?.targetLang) : ''
      translatedCues.push({
        ...c,
        text: trans || c.text
      })
    }
  }

  return translatedCues
}
