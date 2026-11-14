/**
 * Utility functions for sanitizing raw errors, API responses, and technical exceptions
 * into clean, concise, human-friendly messages for toasts and UI status badges.
 */

export function formatUserFriendlyError(rawError: unknown): string {
  if (!rawError) return 'An unexpected error occurred.'

  let message = ''
  if (typeof rawError === 'string') {
    message = rawError
  } else if (rawError instanceof Error) {
    message = rawError.message
  } else if (typeof rawError === 'object') {
    const obj = rawError as any
    message = obj?.message || obj?.error?.message || JSON.stringify(rawError)
  }

  // Try extracting inner message if it contains embedded JSON
  const jsonMatch = message.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed?.error?.message) {
        message = parsed.error.message
      } else if (parsed?.message) {
        message = parsed.message
      }
    } catch {
      // not valid JSON, proceed with raw message
    }
  }

  const lower = message.toLowerCase()

  // 1. High Demand / 503 / Service Unavailable
  if (
    lower.includes('high demand') ||
    lower.includes('503') ||
    lower.includes('spikes in demand') ||
    lower.includes('unavailable')
  ) {
    return 'AI service is experiencing high demand. Please try again shortly or switch to Gemini 2.5 Flash in Settings.'
  }

  // 2. Rate Limits / Quota Exhaustion / 429
  if (
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota')
  ) {
    return 'API rate limit or quota exceeded. Please wait a moment before trying again, or check your API key quota.'
  }

  // 3. Invalid API Key / Authentication / 401 / 403
  if (
    lower.includes('api key not valid') ||
    lower.includes('invalid_argument') ||
    lower.includes('incorrect api key') ||
    lower.includes('unauthorized') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('permission_denied')
  ) {
    return 'Invalid API Key. Please verify your API Key in Settings > AI Translation.'
  }

  // 4. Model Not Found / Deprecated (404)
  if (
    lower.includes('not found') ||
    lower.includes('is not supported') ||
    lower.includes('no longer available') ||
    lower.includes('404')
  ) {
    return 'Selected AI model is not available. Please open Settings and select another active model.'
  }

  // 5. Network / Offline / Timeout
  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('network error')
  ) {
    return 'Network connection failed. Please check your internet connection.'
  }

  // 6. User cancellation
  if (lower.includes('cancel')) {
    return 'Operation cancelled by user.'
  }

  // 7. FFmpeg / Audio extraction errors
  if (lower.includes('ffmpeg') || lower.includes('audio extraction')) {
    return 'Audio extraction failed. The movie audio stream may be unsupported or corrupted.'
  }

  // 8. Whisper transcription errors
  if (lower.includes('whisper')) {
    if (lower.includes('model_not_found') || lower.includes('not found')) {
      return 'Whisper model file not found. Please download the model in the app.'
    }
    return 'Speech transcription failed. Please verify Whisper engine in Settings.'
  }

  // Clean up noisy technical prefixes
  let cleaned = message
    .replace(/^(\[ERROR\]|Error:|Gemini API Error:|OpenAI API Error:)\s*/i, '')
    .trim()

  // Strip raw JSON artifacts if any remain
  cleaned = cleaned.replace(/\{[\s\S]*\}/g, '').trim()

  // Clean trailing punctuation or separators
  cleaned = cleaned.replace(/[:\-–—\s]+$/, '')

  if (!cleaned) {
    return 'An error occurred during processing. Check Console Activity for details.'
  }

  // Cap message length so toasts remain compact and clean
  if (cleaned.length > 130) {
    return cleaned.substring(0, 127) + '...'
  }

  return cleaned
}
