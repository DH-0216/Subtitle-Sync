import { getFileName, getFileExtension } from '@shared/fileSanitizer'

export interface EpisodeInfo {
  season: number | null
  episode: number | null
  token: string | null
}

/**
 * Extracts season and episode indicators from a file name.
 * Examples:
 * - "Breaking.Bad.S01E04.720p.mkv" -> { season: 1, episode: 4, token: "s01e04" }
 * - "Show.1x04.mkv" -> { season: 1, episode: 4, token: "1x04" }
 * - "Anime_EP04.mp4" -> { season: null, episode: 4, token: "ep04" }
 * - "Drama - 04 - Title.mkv" -> { season: null, episode: 4, token: "04" }
 */
export function extractEpisodeInfo(filePath: string): EpisodeInfo {
  const fileName = getFileName(filePath).toLowerCase()

  // Pattern 1: S01E04 or S1E4
  const seMatch = fileName.match(/[sS](\d{1,2})[eE](\d{1,3})/)
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
      token: `s${parseInt(seMatch[1], 10)}e${parseInt(seMatch[2], 10)}`
    }
  }

  // Pattern 2: 1x04 or 01x04
  const xMatch = fileName.match(/(?:^|\D)(\d{1,2})x(\d{1,3})(?:\D|$)/)
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
      token: `s${parseInt(xMatch[1], 10)}e${parseInt(xMatch[2], 10)}`
    }
  }

  // Pattern 3: EP04, Episode 4, Ep 04, E04, E4
  const epMatch = fileName.match(/(?:^|[._\s-])(?:ep|episode|e)[._\s-]?(\d{1,3})(?:\D|$)/)
  if (epMatch) {
    return {
      season: null,
      episode: parseInt(epMatch[1], 10),
      token: `e${parseInt(epMatch[1], 10)}`
    }
  }

  // Pattern 4: Delimited number: " - 04 - " or " [04] " or " - 04 "
  const numMatch = fileName.match(/(?:[-_\[\(\s])(\d{1,3})(?:[-_\]\)\s])/)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    // Avoid matching resolution like 480, 720, 1080 or years like 1999, 2024
    if (num > 0 && num < 400) {
      return {
        season: null,
        episode: num,
        token: `e${num}`
      }
    }
  }

  return { season: null, episode: null, token: null }
}

/**
 * Natural alphabetical sorting for files (e.g. Ep 1, Ep 2, ..., Ep 10).
 */
export function naturalSortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const nameA = getFileName(a)
    const nameB = getFileName(b)
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Clean a filename for base string comparison by removing extension, quality, and group tags.
 */
function normalizeBaseName(filePath: string): string {
  const fileName = getFileName(filePath).toLowerCase()
  const ext = getFileExtension(filePath).toLowerCase()
  let base = fileName.replace(new RegExp(`\\.${ext}$`), '')
  // Strip common video noise
  base = base
    .replace(/[._\-]/g, ' ')
    .replace(/\b(1080p|720p|480p|2160p|4k|uhd|bluray|webrip|web-dl|x264|x265|hevc|aac|dts)\b/gi, '')
    .trim()
  return base
}

export interface MatchedPair {
  videoPath: string
  subPath: string | null
  confidence: 'high' | 'medium' | 'none'
  episodeLabel?: string
}

/**
 * Automatically pairs video files with corresponding subtitle files.
 */
export function matchVideosWithSubtitles(
  videoPaths: string[],
  subtitlePaths: string[]
): MatchedPair[] {
  const sortedVideos = naturalSortPaths(videoPaths)
  const remainingSubs = new Set(subtitlePaths)
  const results: MatchedPair[] = []

  // Step 1: Match by Season and Episode Token
  for (const video of sortedVideos) {
    const vInfo = extractEpisodeInfo(video)
    let matchedSub: string | null = null
    let confidence: 'high' | 'medium' | 'none' = 'none'

    if (vInfo.token) {
      for (const sub of remainingSubs) {
        const sInfo = extractEpisodeInfo(sub)
        if (sInfo.token && sInfo.token === vInfo.token) {
          // If both have season, must match season
          if (vInfo.season !== null && sInfo.season !== null && vInfo.season !== sInfo.season) {
            continue
          }
          matchedSub = sub
          confidence = 'high'
          break
        }
      }
    }

    // Step 2: Fallback to base name string match if no episode token matched
    if (!matchedSub) {
      const vBase = normalizeBaseName(video)
      for (const sub of remainingSubs) {
        const sBase = normalizeBaseName(sub)
        if (vBase && sBase && (vBase === sBase || vBase.includes(sBase) || sBase.includes(vBase))) {
          matchedSub = sub
          confidence = 'medium'
          break
        }
      }
    }

    if (matchedSub) {
      remainingSubs.delete(matchedSub)
    }

    let epLabel: string | undefined
    if (vInfo.season !== null && vInfo.episode !== null) {
      epLabel = `S${String(vInfo.season).padStart(2, '0')}E${String(vInfo.episode).padStart(2, '0')}`
    } else if (vInfo.episode !== null) {
      epLabel = `EP ${vInfo.episode}`
    }

    results.push({
      videoPath: video,
      subPath: matchedSub,
      confidence,
      episodeLabel: epLabel
    })
  }

  return results
}
