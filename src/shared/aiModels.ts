import { EXTERNAL_LINKS } from './links'

/**
 * Centralized AI Models Configuration & Dynamic Chain Builders
 * Single source of truth for AI model policies, blocklists, and dynamic resolution.
 * Follows the same modular design as @shared/links and @shared/version.
 */

export const AI_MODELS_CONFIG = {
  // Model resolver in-memory cache time-to-live (6 hours)
  CACHE_TTL_MS: 6 * 60 * 60 * 1000,

  // Batch sizing & retry cascading
  DEFAULT_BATCH_SIZE: 35,
  MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: 2500,

  // Thinking level for thinking-capable models (saves ~70% tokens on dialogue)
  THINKING_LEVEL: 'low' as const,

  // Offline emergency seeds (used only if live API model discovery completely times out)
  GEMINI_EMERGENCY_SEEDS: [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  ],

  OPENAI_EMERGENCY_SEEDS: [
    'gpt-4o-mini',
    'gpt-4o'
  ]
} as const

/**
 * Patterns of models strictly excluded from subtitle generation and translation.
 * Filters out short-lived variants, deprecated versions, preview endpoints, and non-text models.
 */
export const GEMINI_EXCLUDED_PATTERNS = [
  // Short-lived Flash models
  '3.6-flash',
  '3.7-flash',

  // Deprecated 2.x models
  '2.5',
  '2.0',
  'gemini-2',

  // Preview & floating latest aliases
  'preview',
  'latest',

  // Specialized Non-Text / Incompatible Endpoints
  'tts',
  'live',
  'image',
  'transcribe',
  'omni',
  'embedding',
  'nano-banana',
  'veo',
  'imagen',
  'lyria',
  'cyber',
  'gemma',
  '8b',
  'aqa',
  'learnlm',
  'vision'
] as const

/**
 * Checks whether a given Gemini model ID matches any excluded lifecycle or capability pattern.
 */
export function isGeminiModelExcluded(modelId: string): boolean {
  if (!modelId) return true
  const lower = modelId.toLowerCase().trim()
  return GEMINI_EXCLUDED_PATTERNS.some((pattern) => lower.includes(pattern))
}

/**
 * Dynamically builds an optimal, self-healing Gemini priority chain from live models returned by Google.
 * Priority hierarchy:
 * 1. User preferred model (if explicitly set and not excluded)
 * 2. Full-sized Flash models sorted descending by version (e.g. 4.0 -> 3.8 -> 3.5)
 * 3. Lite Flash models sorted descending by version (e.g. 3.5-lite -> 3.1-lite)
 * 4. Pro models sorted descending by version (high-accuracy emergency rescue tier)
 * Zero hardcoded models: Automatically adapts to future Google releases and retirements.
 */
export function buildDynamicGeminiChain(liveModelIds: string[], preferredModel?: string): string[] {
  const approved = liveModelIds
    .map((id) => id.replace(/^models\//, '').trim())
    .filter((id) => id.length > 0 && !isGeminiModelExcluded(id))

  // 1. Separate full Flash models vs Lite Flash models
  const flashModels = approved.filter((id) => id.toLowerCase().includes('flash'))
  const fullFlash = flashModels
    .filter((id) => !id.toLowerCase().includes('lite'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))

  const liteFlash = flashModels
    .filter((id) => id.toLowerCase().includes('lite'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))

  // 2. High-accuracy Pro models as emergency rescue tier
  const proModels = approved
    .filter((id) => id.toLowerCase().includes('pro'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }))

  const dynamicChain = [
    ...(preferredModel && preferredModel !== 'auto' && !isGeminiModelExcluded(preferredModel) ? [preferredModel] : []),
    ...fullFlash,
    ...liteFlash,
    ...proModels
  ]

  const unique = Array.from(new Set(dynamicChain))
  return unique.length > 0 ? unique : [...AI_MODELS_CONFIG.GEMINI_EMERGENCY_SEEDS]
}

/**
 * OpenAI exclusion patterns for non-chat endpoints.
 */
export const OPENAI_EXCLUDED_PATTERNS = [
  'realtime',
  'audio',
  'tts',
  'transcription',
  'whisper',
  'embedding',
  'dall-e',
  'moderation',
  'instruct'
] as const

/**
 * Checks whether an OpenAI model is suitable for chat/subtitle translation.
 */
export function isOpenAiModelExcluded(modelId: string): boolean {
  if (!modelId) return true
  const lower = modelId.toLowerCase().trim()
  const isChatPrefix = lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('chatgpt-')
  if (!isChatPrefix) return true
  return OPENAI_EXCLUDED_PATTERNS.some((p) => lower.includes(p))
}

/**
 * Dynamically builds OpenAI priority chain from live models.
 */
export function buildDynamicOpenAiChain(liveModelIds: string[], preferredModel?: string): string[] {
  const approved = liveModelIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && !isOpenAiModelExcluded(id))
    .sort((a, b) => {
      const aMini = a.includes('mini')
      const bMini = b.includes('mini')
      if (aMini && !bMini) return -1
      if (!aMini && bMini) return 1
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
    })

  const chain = [
    ...(preferredModel && preferredModel !== 'auto' && !isOpenAiModelExcluded(preferredModel) ? [preferredModel] : []),
    ...approved
  ]

  const unique = Array.from(new Set(chain))
  return unique.length > 0 ? unique : [...AI_MODELS_CONFIG.OPENAI_EMERGENCY_SEEDS]
}

/**
 * Supported AI Providers (easily extensible by adding new provider IDs here)
 */
export type AiProviderId = 'gemini' | 'openai'

export interface AiProviderMeta {
  id: AiProviderId
  name: string
  label: string
  company: string
  keyPlaceholder: string
  portalUrl?: string
  portalLabel?: string
  notice?: string
  emergencySeeds: readonly string[]
  isModelExcluded: (modelId: string) => boolean
  buildDynamicChain: (liveModelIds: string[], preferredModel?: string) => string[]
}

/**
 * Centralized AI Providers Registry
 * To add a new provider (e.g. Anthropic, DeepSeek, Groq):
 * 1. Add its ID to AiProviderId union above
 * 2. Add its metadata configuration here
 * 3. Implement its translator in generatorEngine.ts & fetcher in index.ts
 */
export const AI_PROVIDERS: Record<AiProviderId, AiProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    label: 'Gemini API Key',
    company: 'Google',
    keyPlaceholder: 'AIzaSy...',
    portalUrl: EXTERNAL_LINKS.GEMINI_API_KEY_PORTAL,
    portalLabel: 'Get free key',
    notice: 'Stored securely on your local device only. Google Gemini offers a free daily quota.',
    emergencySeeds: AI_MODELS_CONFIG.GEMINI_EMERGENCY_SEEDS,
    isModelExcluded: isGeminiModelExcluded,
    buildDynamicChain: buildDynamicGeminiChain
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    label: 'OpenAI API Key',
    company: 'OpenAI',
    keyPlaceholder: 'sk-...',
    portalUrl: EXTERNAL_LINKS.OPENAI_API_KEY_PORTAL,
    portalLabel: 'Get API key',
    notice: 'Stored securely on your local device only. Requires billing balance or credit on OpenAI.',
    emergencySeeds: AI_MODELS_CONFIG.OPENAI_EMERGENCY_SEEDS,
    isModelExcluded: isOpenAiModelExcluded,
    buildDynamicChain: buildDynamicOpenAiChain
  }
}

export const AI_PROVIDER_LIST: AiProviderMeta[] = Object.values(AI_PROVIDERS)

export function getAiProvider(provider: string | undefined): AiProviderMeta {
  if (provider && provider in AI_PROVIDERS) {
    return AI_PROVIDERS[provider as AiProviderId]
  }
  return AI_PROVIDERS.gemini
}

export function isValidAiProvider(provider: any): provider is AiProviderId {
  return typeof provider === 'string' && provider in AI_PROVIDERS
}
