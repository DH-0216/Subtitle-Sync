import * as fs from 'fs'
import * as path from 'path'

/**
 * Pure TypeScript SRT parser, formatter, and timestamp manipulation tools.
 * Zero external dependencies.
 */

export interface SrtCue {
  index: number
  startMs: number
  endMs: number
  text: string
}

export function parseSrtTimestamp(ts: string): number | null {
  const match = ts.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/)
  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const ms = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10)

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms
}

export function formatSrtTimestamp(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms))
  const hours = Math.floor(safeMs / 3600000)
  const minutes = Math.floor((safeMs % 3600000) / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)
  const remainderMs = safeMs % 1000

  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  const s = String(seconds).padStart(2, '0')
  const milli = String(remainderMs).padStart(3, '0')

  return `${h}:${m}:${s},${milli}`
}

export function formatHms(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms))
  const hours = Math.floor(safeMs / 3600000)
  const minutes = Math.floor((safeMs % 3600000) / 60000)
  const seconds = Math.floor((safeMs % 60000) / 1000)

  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  const s = String(seconds).padStart(2, '0')

  return `${h}:${m}:${s}`
}

export function parseSrt(content: string): SrtCue[] {
  // Normalize newlines and strip BOM
  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = clean.split(/\n\n+/)
  const cues: SrtCue[] = []

  let idx = 1
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    let timeLine = ''
    let textStartIndex = 1

    if (lines[0].includes('-->')) {
      timeLine = lines[0]
      textStartIndex = 1
    } else if (lines.length >= 2 && lines[1].includes('-->')) {
      timeLine = lines[1]
      textStartIndex = 2
    } else {
      continue
    }

    const parts = timeLine.split('-->')
    if (parts.length !== 2) continue

    const startMs = parseSrtTimestamp(parts[0])
    const endMs = parseSrtTimestamp(parts[1])

    if (startMs === null || endMs === null) continue

    const text = lines.slice(textStartIndex).join('\n').trim()
    if (!text) continue

    cues.push({
      index: idx++,
      startMs,
      endMs,
      text
    })
  }

  return cues
}

export function writeSrt(cues: SrtCue[]): string {
  const output: string[] = []
  cues.forEach((cue, i) => {
    output.push(String(i + 1))
    output.push(`${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}`)
    output.push(cue.text)
    output.push('')
  })
  return output.join('\n')
}

export function cleanAndSortCues(cues: SrtCue[]): SrtCue[] {
  // Filter out invalid durations and sort chronologically
  const valid = cues
    .filter((c) => c.endMs > c.startMs && c.text.trim().length > 0)
    .sort((a, b) => a.startMs - b.startMs)

  // Re-index
  return valid.map((c, i) => ({
    ...c,
    index: i + 1
  }))
}

/**
 * Removes runaway hallucination loops where Whisper repeats dialogue
 * due to background music, ambient sound, or 30-second window context carryover.
 */
export function removeHallucinationLoops(cues: SrtCue[]): SrtCue[] {
  if (!cues || cues.length === 0) return cues

  const normalize = (text: string) =>
    text.trim().toLowerCase().replace(/['".,!?;:\s\-_()[\]]/g, '')

  // Pass 1: Remove immediate consecutive duplicates.
  // Multi-word phrases (>= 2 words or > 6 chars) should never repeat identically immediately after.
  // Short single words ("Yes", "No") are allowed at most 2 consecutive repeats.
  const pass1: SrtCue[] = []
  let prevNorm = ''
  let consecutiveCount = 0

  for (const c of cues) {
    const norm = normalize(c.text)
    if (!norm) continue

    if (norm === prevNorm) {
      consecutiveCount++
      const words = c.text.trim().split(/\s+/).length
      const maxAllowed = words >= 2 || norm.length > 6 ? 1 : 2
      if (consecutiveCount <= maxAllowed) {
        pass1.push(c)
      }
    } else {
      prevNorm = norm
      consecutiveCount = 1
      pass1.push(c)
    }
  }

  // Pass 2: Remove 30-second window periodic hallucination loops
  // (e.g. "Door to door", "Stand up", "I'm happy", "Thank you" repeating every ~25-35 seconds
  // across an ambient scene even when separated by another minor sound or line).
  const pass2: SrtCue[] = []
  const recentHistory = new Map<string, number[]>()

  for (const c of pass1) {
    const norm = normalize(c.text)
    const history = recentHistory.get(norm) || []

    let isPeriodicLoop = false
    if (history.length > 0) {
      const lastSeen = history[history.length - 1]
      const deltaSec = (c.startMs - lastSeen) / 1000

      // If identical phrase repeats within typical Whisper 30s chunk window (10-45s)
      // and has already occurred 2+ times in the scene:
      if (deltaSec >= 10 && deltaSec <= 45 && history.length >= 2) {
        isPeriodicLoop = true
      } else if (deltaSec < 10 && history.length >= 1) {
        // Repeated within less than 10 seconds
        isPeriodicLoop = true
      }
    }

    if (!isPeriodicLoop) {
      pass2.push(c)
      history.push(c.startMs)
      // Only keep timestamps within a 5-minute sliding window
      const cutoff = c.startMs - 300000
      recentHistory.set(
        norm,
        history.filter((t) => t >= cutoff)
      )
    }
  }

  return pass2
    .filter((c) => {
      const t = c.text.trim()
      return t.length > 0 && t !== '-'
    })
    .map((c, i) => ({
      ...c,
      index: i + 1
    }))
}

/**
 * Generates an available unique file path by adding " (1)", " (2)", etc. before the extension
 * if a file already exists at targetPath.
 * Example: "movie.sinhala.translated.srt" -> "movie.sinhala.translated (1).srt"
 */
export function getUniqueFilePath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) {
    return targetPath
  }
  const ext = path.extname(targetPath)
  const dir = path.dirname(targetPath)
  const base = path.basename(targetPath, ext)

  let counter = 1
  let candidate = path.join(dir, `${base} (${counter})${ext}`)
  while (fs.existsSync(candidate)) {
    counter++
    candidate = path.join(dir, `${base} (${counter})${ext}`)
  }
  return candidate
}
