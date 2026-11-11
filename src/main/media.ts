/**
 * Binary detection and media stream probing using ffmpeg / ffprobe.
 */
import { app } from 'electron'
import { join, dirname } from 'path'
import * as fs from 'fs'
import { spawn } from 'child_process'
import { formatHms, SrtCue } from './srtTools'

export interface AudioTrackInfo {
  index: number
  codec: string
  language: string
  title: string
  channels: number
}

export interface VideoSyncDetails {
  fps: number | null
  duration: string
  durationSec: number | null
  resolution: string
  audioCount: number
}

export function findBinary(name: string): string | null {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name

  const searchLocations: string[] = []

  // 1. Packaged resources path
  if (app.isPackaged) {
    searchLocations.push(join(process.resourcesPath, 'bin', exeName))
    searchLocations.push(join(process.resourcesPath, exeName))
    searchLocations.push(join(dirname(app.getPath('exe')), 'bin', exeName))
    searchLocations.push(join(dirname(app.getPath('exe')), exeName))
  }

  // 2. Local workspace bin folder
  searchLocations.push(join(app.getAppPath(), 'bin', exeName))
  searchLocations.push(join(__dirname, '../../bin', exeName))

  // 3. Common Windows paths
  if (process.platform === 'win32') {
    searchLocations.push(join('C:\\Program Files\\FFmpeg\\bin', exeName))
    searchLocations.push(join('C:\\ffmpeg\\bin', exeName))
    const localAppData = process.env.LOCALAPPDATA
    if (localAppData) {
      searchLocations.push(join(localAppData, 'Microsoft', 'WinGet', 'Links', exeName))
    }
  }

  for (const loc of searchLocations) {
    if (fs.existsSync(loc)) {
      return loc
    }
  }

  // 4. System PATH check
  const pathDirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')
  for (const dir of pathDirs) {
    const candidate = join(dir.trim(), exeName)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function getFfmpegPath(): string {
  return findBinary('ffmpeg') || 'ffmpeg'
}

export function getFfsubsyncPath(): string {
  return findBinary('ffsubsync') || 'ffsubsync'
}

export function getFfprobePath(): string | null {
  const ffmpeg = findBinary('ffmpeg')
  if (ffmpeg) {
    const probeNextToFfmpeg = join(dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
    if (fs.existsSync(probeNextToFfmpeg)) {
      return probeNextToFfmpeg
    }
  }
  return findBinary('ffprobe')
}

export async function probeVideoFile(videoPath: string): Promise<{
  tracks: AudioTrackInfo[]
  details: VideoSyncDetails
}> {
  const ffprobe = getFfprobePath()

  if (ffprobe) {
    try {
      const jsonStr = await runProcessCapture(ffprobe, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ])
      const data = JSON.parse(jsonStr)
      return parseProbeJson(data)
    } catch (e) {
      console.warn('ffprobe JSON parse failed, falling back to ffmpeg -i:', e)
    }
  }

  // Fallback: execute ffmpeg -i and parse stderr
  const ffmpeg = getFfmpegPath()
  const stderrOutput = await runProcessCapture(ffmpeg, ['-i', videoPath], true)
  return parseFfmpegStderr(stderrOutput)
}

function parseProbeJson(data: any): { tracks: AudioTrackInfo[]; details: VideoSyncDetails } {
  const streams = data.streams || []
  const format = data.format || {}

  let fps: number | null = null
  let resolution = ''
  let durationSec = parseFloat(format.duration || '0') || null
  const tracks: AudioTrackInfo[] = []

  let audioIdx = 0
  for (const s of streams) {
    if (s.codec_type === 'video' && !resolution) {
      if (s.width && s.height) {
        resolution = `${s.width}x${s.height}`
      }
      if (s.r_frame_rate) {
        const [num, den] = s.r_frame_rate.split('/').map(Number)
        if (num && den && den !== 0) {
          fps = Math.round((num / den) * 1000) / 1000
        }
      }
    } else if (s.codec_type === 'audio') {
      const tags = s.tags || {}
      tracks.push({
        index: audioIdx++,
        codec: (s.codec_name || 'unknown').toUpperCase(),
        language: tags.language || tags.LANGUAGE || 'und',
        title: tags.title || tags.TITLE || '',
        channels: s.channels || 2
      })
    }
  }

  const durationStr = durationSec ? formatDuration(durationSec) : ''

  return {
    tracks,
    details: {
      fps,
      duration: durationStr,
      durationSec,
      resolution,
      audioCount: tracks.length
    }
  }
}

function parseFfmpegStderr(stderr: string): { tracks: AudioTrackInfo[]; details: VideoSyncDetails } {
  let fps: number | null = null
  let resolution = ''
  let durationStr = ''
  let durationSec: number | null = null
  const tracks: AudioTrackInfo[] = []

  // Extract duration: "Duration: 01:23:45.67"
  const durMatch = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/)
  if (durMatch) {
    const hours = parseInt(durMatch[1], 10)
    const mins = parseInt(durMatch[2], 10)
    const secs = parseFloat(durMatch[3])
    durationSec = hours * 3600 + mins * 60 + secs
    durationStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(Math.floor(secs)).padStart(2, '0')}`
  }

  // Extract video info
  const videoMatch = stderr.match(/Stream #\d+:\d+(?:\((.*?)\))?:\s*Video:.*?,.*?,\s*(\d{3,5}x\d{3,5}).*?,\s*([\d.]+)\s*fps/)
  if (videoMatch) {
    resolution = videoMatch[2]
    fps = parseFloat(videoMatch[3]) || null
  }

  // Extract audio streams: "Stream #0:1(eng): Audio: aac..."
  const audioRegex = /Stream #\d+:(\d+)(?:\((.*?)\))?:\s*Audio:\s*([a-zA-Z0-9_]+).*?(?:,\s*(\d+)\s*channels|,\s*(stereo|mono|5\.1|7\.1))/g
  let match
  let audioIdx = 0
  while ((match = audioRegex.exec(stderr)) !== null) {
    const lang = match[2] || 'und'
    const codec = (match[3] || 'AAC').toUpperCase()
    let channels = 2
    if (match[4]) channels = parseInt(match[4], 10)
    else if (match[5] === 'mono') channels = 1
    else if (match[5] === 'stereo') channels = 2
    else if (match[5] === '5.1') channels = 6
    else if (match[5] === '7.1') channels = 8

    tracks.push({
      index: audioIdx++,
      codec,
      language: lang,
      title: '',
      channels
    })
  }

  return {
    tracks,
    details: {
      fps,
      duration: durationStr,
      durationSec,
      resolution,
      audioCount: tracks.length
    }
  }
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function runProcessCapture(bin: string, args: string[], captureStderr = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (d) => (stdout += d.toString('utf-8')))
    proc.stderr?.on('data', (d) => (stderr += d.toString('utf-8')))

    proc.on('close', (code) => {
      if (captureStderr) {
        resolve(stderr)
      } else if (code === 0) {
        resolve(stdout)
      } else {
        resolve(stdout || stderr)
      }
    })

    proc.on('error', (err) => reject(err))
  })
}

export function detectSubtitleFps(subPath: string, textSample?: string): number {
  const name = (subPath.split(/[/\\]/).pop() || '').toLowerCase()

  if (name.includes('23.976') || name.includes('23.98')) return 23.976
  if (name.includes('29.97')) return 29.97
  if (name.includes('24fps') || name.includes('24.0fps')) return 24.0
  if (name.includes('25fps') || name.includes('25.0fps') || name.includes('25.000')) return 25.0
  if (name.includes('pal')) return 25.0
  if (name.includes('ntsc')) return 23.976
  if (['hdtv', 'bluray', 'bdrip', 'web-dl', 'webrip', 'dvdrip', 'x264', 'x265', 'hevc'].some((t) => name.includes(t))) {
    return 23.976
  }

  if (textSample) {
    const lines = textSample.slice(0, 3000).toLowerCase()
    const m = lines.match(/(?:fps|framerate|frame\s*rate)\s*[:=]?\s*(23\.976|23\.98|24(?:\.0+)?|25(?:\.0+)?|29\.97|30|50|60)\b/)
    if (m) {
      const val = parseFloat(m[1])
      return val === 23.98 ? 23.976 : val
    }
  }

  return 23.976
}

export function getReleaseTypeAndCut(filePath: string): { source: string; cuts: string[]; tag: string } {
  if (!filePath) return { source: '', cuts: [], tag: '' }
  const name = (filePath.split(/[/\\]/).pop() || '').toLowerCase()
  let source = ''

  if (['bluray', 'bdrip', 'brrip', 'blu-ray'].some((k) => name.includes(k))) {
    source = 'BluRay'
  } else if (name.includes('hdtv')) {
    source = 'HDTV'
  } else if (['web-dl', 'webrip', 'web'].some((k) => name.includes(k))) {
    source = 'WEB'
  } else if (['dvdrip', 'dvd'].some((k) => name.includes(k))) {
    source = 'DVD'
  }

  const cuts: string[] = []
  if (name.includes('extended')) cuts.push('Extended')
  if (name.includes('director')) cuts.push("Director's Cut")
  if (name.includes('unrated')) cuts.push('Unrated')
  if (name.includes('theatrical')) cuts.push('Theatrical')
  if (name.includes('repack')) cuts.push('Repack')

  const labelParts: string[] = []
  if (source) labelParts.push(source)
  if (cuts.length > 0) labelParts.push(...cuts)

  return { source, cuts, tag: labelParts.join(' ') }
}

export function getSubtitleSyncDetails(subPath: string, cues: SrtCue[], content: string) {
  const fps = detectSubtitleFps(subPath, content)
  const { source, cuts, tag } = getReleaseTypeAndCut(subPath)
  let span = ''
  if (cues.length > 0) {
    const startStr = formatHms(cues[0].startMs)
    const endStr = formatHms(cues[cues.length - 1].endMs)
    span = `${startStr} - ${endStr}`
  }
  return {
    fps,
    source,
    cuts,
    tag,
    lines: cues.length,
    span
  }
}
