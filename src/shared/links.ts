/**
 * Centralized External Links, API Endpoints & Download Mirrors
 * Single source of truth for all external network destinations.
 */

export const EXTERNAL_LINKS = {
  // GitHub Repository & Release Info
  REPO_OWNER: 'DH-0216',
  REPO_NAME: 'Subtitle-Sync',
  REPO_SLUG: 'DH-0216/Subtitle-Sync',
  GITHUB_REPO: 'https://github.com/DH-0216/Subtitle-Sync',
  GITHUB_RELEASES_PAGE: 'https://github.com/DH-0216/Subtitle-Sync/releases',
  GITHUB_LATEST_RELEASE_API: 'https://api.github.com/repos/DH-0216/Subtitle-Sync/releases/latest',

  // Developer & API Key Portals
  GEMINI_API_KEY_PORTAL: 'https://aistudio.google.com/app/apikey',

  // AI Service Endpoints
  GEMINI_MODELS_API: 'https://generativelanguage.googleapis.com/v1beta/models',
  GEMINI_API_BASE: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash',
  OPENAI_MODELS_API: 'https://api.openai.com/v1/models',

  // Offline Whisper Model CDN / Mirror
  WHISPER_MODELS_BASE: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'
} as const

/**
 * Construct full direct download URL for a Whisper GGUF model
 */
export function getWhisperModelDownloadUrl(modelFileName: string): string {
  return `${EXTERNAL_LINKS.WHISPER_MODELS_BASE}/${modelFileName}`
}

/**
 * Construct Google Gemini model URL for key verification (checks models list)
 */
export function getGeminiVerifyUrl(apiKey: string): string {
  return `${EXTERNAL_LINKS.GEMINI_MODELS_API}?key=${apiKey}`
}

/**
 * Construct Google Gemini generate content URL for AI translation
 * Defaults to Gemini 3.8 Flash with automatic multi-model fallback support
 */
export function getGeminiGenerateUrl(apiKey: string, model: string = 'gemini-3.8-flash'): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
}
