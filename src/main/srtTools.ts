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
