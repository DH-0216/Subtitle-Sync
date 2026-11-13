/**
 * Subtitle Extractor Engine
 * Extracts embedded / encoded subtitle streams from video files (MKV, MP4, MOV, WEBM, etc.)
 * and converts them directly to SubRip (.srt) format using FFmpeg.
 */
import { spawn, ChildProcess } from 'child_process'
import { join, dirname, basename, extname, resolve } from 'path'
import * as fs from 'fs'
import { getFfmpegPath, SubtitleTrackInfo } from './media'
import { parseSrt, formatHms } from './srtTools'

let activeExtractProcess: ChildProcess | null = null
let isExtractionCancelled = false

export interface ExtractSingleParams {
  videoPath: string
  track: SubtitleTrackInfo
  outputPath?: string
  outputDir?: string
  cleanTags?: boolean
}

export interface ExtractSingleResult {
  success: boolean
  outputPath?: string
  trackIndex: number
  streamIndex: number
  language: string
  title: string
  cuesCount?: number
  durationStr?: string
  error?: string
  cancelled?: boolean
}

export interface ExtractMultipleParams {
  videoPath: string
  tracks: SubtitleTrackInfo[]
  outputDir?: string
  cleanTags?: boolean
}

export interface ExtractMultipleResult {
  success: boolean
  extracted: ExtractSingleResult[]
  failed: ExtractSingleResult[]
  totalProcessed: number
  cancelled?: boolean
}

/**
 * Remove residual ASS override tags (e.g. {\an8}, {\pos(100,200)}, {\c&H00FFFF&})
 * that FFmpeg might preserve during ASS/SSA to SRT conversion.
 */
export function cleanSrtResidualTags(rawContent: string): string {
  // Strip BOM
  let text = rawContent.replace(/^\uFEFF/, '')

  // Remove ASS style override blocks like {\an8}, {\pos(x,y)}, {\fad(100,100)}, etc.
  text = text.replace(/\{[\\/][^}]*\}/g, '')

  // Normalize ASS line-break overrides \N or \n into actual newline
  text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ')

  return text
}

/**
 * Sanitize a string so it can safely be part of a filename on Windows / POSIX.
 */
function sanitizeFileNamePart(part: string): string {
  return part.replace(/[/\\?%*:|"<>]/g, '_').trim()
}

/**
 * Build default .srt output path based on video filename, track language, and track title.
 */
export function buildDefaultSrtOutputPath(
  videoPath: string,
  track: SubtitleTrackInfo,
  customOutputDir?: string
): string {
  const targetDir = customOutputDir && fs.existsSync(customOutputDir) ? customOutputDir : dirname(videoPath)
  const videoExt = extname(videoPath)
  const videoBaseName = basename(videoPath, videoExt)

  const parts: string[] = [videoBaseName, 'extracted']

  // Add language tag (e.g. 'eng', 'spa', 'und')
  const cleanLang = (track.language || '').toLowerCase().trim()
  if (cleanLang && cleanLang !== 'und') {
    parts.push(cleanLang)
  } else {
    parts.push(`track${track.index + 1}`)
  }

  // Add title if informative (e.g. 'SDH', 'Commentary', 'Forced')
  if (track.title) {
    const cleanTitle = sanitizeFileNamePart(track.title)
    if (cleanTitle && !parts.includes(cleanTitle.toLowerCase())) {
      parts.push(cleanTitle)
    }
  } else if (track.isForced) {
    parts.push('forced')
  }

  let fileName = `${parts.join('.')}.srt`
  let fullPath = join(targetDir, fileName)

  // Avoid unintended overwrite if file exists with identical name
  let counter = 1
  while (fs.existsSync(fullPath)) {
    fileName = `${parts.join('.')} (${counter}).srt`
    fullPath = join(targetDir, fileName)
    counter++
  }

  return fullPath
}

/**
 * Extract a single embedded subtitle track from a video and convert to .srt
 */
export async function extractSingleSubtitleTrack(
  params: ExtractSingleParams,
  onLog?: (line: string) => void
): Promise<ExtractSingleResult> {
  const { videoPath, track, outputDir, cleanTags = true } = params

  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      trackIndex: track.index,
      streamIndex: track.streamIndex,
      language: track.language,
      title: track.title,
      error: `Video file not found: ${videoPath}`
    }
  }

  const outPath = params.outputPath || buildDefaultSrtOutputPath(videoPath, track, outputDir)
  const ffmpegRaw = getFfmpegPath()
  const ffmpeg = resolve(ffmpegRaw)

  onLog?.(`[EXTRACT] Preparing extraction for Track #${track.index} (Stream #${track.streamIndex}) [${track.language.toUpperCase()}]`)
  onLog?.(`[EXTRACT] Target output: ${outPath}`)

  const ffmpegArgs = [
    '-y',
    '-i', videoPath,
    '-map', `0:${track.streamIndex}`,
    '-c:s', 'srt',
    outPath
  ]

  isExtractionCancelled = false

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      const binDir = dirname(ffmpeg)
      const augmentedPath = [binDir, process.env.PATH || ''].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

      const proc = spawn(ffmpeg, ffmpegArgs, {
        windowsHide: true,
        cwd: binDir,
        env: {
          ...process.env,
          PATH: augmentedPath
        }
      })

      activeExtractProcess = proc

      let stderr = ''
      proc.stderr?.on('data', (d) => {
        const str = d.toString('utf-8')
        stderr += str
        onLog?.(`[FFmpeg] ${str.trim()}`)
      })

      proc.on('close', (code) => {
        activeExtractProcess = null
        if (isExtractionCancelled) {
          resolve(-1)
        } else {
          resolve(code ?? 0)
        }
      })

      proc.on('error', (err) => {
        activeExtractProcess = null
        reject(err)
      })
    })

    if (isExtractionCancelled) {
      if (fs.existsSync(outPath)) {
        try { fs.unlinkSync(outPath) } catch {}
      }
      return {
        success: false,
        trackIndex: track.index,
        streamIndex: track.streamIndex,
        language: track.language,
        title: track.title,
        cancelled: true,
        error: 'Extraction cancelled by user.'
      }
    }

    if (exitCode !== 0 || !fs.existsSync(outPath)) {
      return {
        success: false,
        trackIndex: track.index,
        streamIndex: track.streamIndex,
        language: track.language,
        title: track.title,
        error: `FFmpeg failed with exit code ${exitCode}. Ensure the subtitle track contains text subtitles.`
      }
    }

    // Read extracted file and optional tag cleanup
    let content = fs.readFileSync(outPath, 'utf-8')
    if (cleanTags) {
      const cleaned = cleanSrtResidualTags(content)
      if (cleaned !== content) {
        fs.writeFileSync(outPath, cleaned, 'utf-8')
        content = cleaned
      }
    }

    const cues = parseSrt(content)
    let durationStr = ''
    if (cues.length > 0) {
      const maxMs = Math.max(...cues.map((c) => c.endMs))
      durationStr = formatHms(maxMs)
    }

    onLog?.(`[EXTRACT] Successfully extracted ${cues.length} cues to ${basename(outPath)}!`)

    return {
      success: true,
      outputPath: outPath,
      trackIndex: track.index,
      streamIndex: track.streamIndex,
      language: track.language,
      title: track.title,
      cuesCount: cues.length,
      durationStr
    }
  } catch (err: any) {
    return {
      success: false,
      trackIndex: track.index,
      streamIndex: track.streamIndex,
      language: track.language,
      title: track.title,
      error: err.message || 'Unknown extraction error'
    }
  }
}

/**
 * Extract multiple embedded subtitle tracks in sequence with progress reporting.
 */
export async function extractMultipleSubtitleTracks(
  params: ExtractMultipleParams,
  onProgress?: (progress: { percent: number; message: string; currentTrack?: string }) => void,
  onLog?: (line: string) => void
): Promise<ExtractMultipleResult> {
  const { videoPath, tracks, outputDir, cleanTags = true } = params
  const extracted: ExtractSingleResult[] = []
  const failed: ExtractSingleResult[] = []

  const total = tracks.length
  isExtractionCancelled = false

  onLog?.(`=== Starting Subtitle Extraction ===`)
  onLog?.(`Video file: ${videoPath}`)
  onLog?.(`Tracks to extract: ${total}`)

  for (let i = 0; i < total; i++) {
    if (isExtractionCancelled) {
      break
    }

    const track = tracks[i]
    const trackLabel = `Track #${track.index} (${track.language.toUpperCase()}${track.title ? ' - ' + track.title : ''})`
    const percent = Math.round(((i) / total) * 100)

    onProgress?.({
      percent,
      message: `Extracting ${trackLabel} (${i + 1}/${total})...`,
      currentTrack: trackLabel
    })

    const res = await extractSingleSubtitleTrack(
      {
        videoPath,
        track,
        outputDir,
        cleanTags
      },
      onLog
    )

    if (res.cancelled) {
      break
    }

    if (res.success) {
      extracted.push(res)
    } else {
      failed.push(res)
    }
  }

  const cancelled = isExtractionCancelled
  const finalPercent = cancelled ? 0 : 100

  onProgress?.({
    percent: finalPercent,
    message: cancelled
      ? 'Extraction cancelled'
      : `Extracted ${extracted.length} of ${total} subtitle track(s) successfully.`
  })

  onLog?.(
    cancelled
      ? `[EXTRACT] Extraction cancelled by user.`
      : `[EXTRACT] Completed! Extracted: ${extracted.length}, Failed: ${failed.length}`
  )

  return {
    success: extracted.length > 0,
    extracted,
    failed,
    totalProcessed: extracted.length + failed.length,
    cancelled
  }
}

/**
 * Cancel any ongoing extraction process
 */
export function cancelExtraction(): void {
  isExtractionCancelled = true
  if (activeExtractProcess) {
    try {
      activeExtractProcess.kill('SIGTERM')
      setTimeout(() => {
        if (activeExtractProcess) {
          activeExtractProcess.kill('SIGKILL')
        }
      }, 500)
    } catch (e) {
      console.warn('Failed to kill extraction process:', e)
    }
  }
}
