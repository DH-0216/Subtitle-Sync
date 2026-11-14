/**
 * Binary detection and media stream probing using ffmpeg / ffprobe.
 */
import { app } from 'electron'
import { join, dirname, resolve } from 'path'
import * as fs from 'fs'
import { spawn, ChildProcess, execSync } from 'child_process'
import { formatHms, SrtCue } from './srtTools'

export interface AudioTrackInfo {
  index: number
  codec: string
  language: string
  title: string
  channels: number
}

export interface SubtitleTrackInfo {
  index: number
  streamIndex: number
  codec: string
  language: string
  title: string
  isDefault: boolean
  isForced: boolean
  isText: boolean
}

export interface VideoSyncDetails {
  fps: number | null
  duration: string
  durationSec: number | null
  resolution: string
  audioCount: number
  subtitleCount: number
}

export function findBinary(name: string): string | null {
  const exeName = process.platform === 'win32' ? `${name}.exe` : name

  const searchLocations: string[] = []

  // 1. Packaged resources path & execution directories (Installer, Unpacked, Portable)
  if (process.resourcesPath) {
    searchLocations.push(join(process.resourcesPath, 'bin', exeName))
    searchLocations.push(join(process.resourcesPath, exeName))
  }

  try {
    const exeDir = dirname(app.getPath('exe'))
    searchLocations.push(join(exeDir, 'bin', exeName))
    searchLocations.push(join(exeDir, 'resources', 'bin', exeName))
    searchLocations.push(join(exeDir, exeName))
  } catch {}

  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (portableDir) {
    searchLocations.push(join(portableDir, 'bin', exeName))
    searchLocations.push(join(portableDir, 'resources', 'bin', exeName))
    searchLocations.push(join(portableDir, exeName))
  }

  // 2. Local workspace / dev mode bin folder
  try {
    searchLocations.push(join(app.getAppPath(), 'bin', exeName))
  } catch {}
  searchLocations.push(join(__dirname, '../../bin', exeName))
  searchLocations.push(join(process.cwd(), 'bin', exeName))

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
      return resolve(loc)
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
  subtitleTracks: SubtitleTrackInfo[]
  details: VideoSyncDetails
}> {
  let probeRes: {
    tracks: AudioTrackInfo[]
    subtitleTracks: SubtitleTrackInfo[]
    details: VideoSyncDetails
  } | null = null

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
      probeRes = parseProbeJson(data)
    } catch (e) {
      console.warn('ffprobe JSON parse failed, falling back to ffmpeg -i:', e)
    }
  }

  // Fallback / Supplementary: If ffprobe wasn't available or found 0 subtitle tracks, probe with ffmpeg -i
  if (!probeRes || probeRes.subtitleTracks.length === 0) {
    try {
      const ffmpeg = getFfmpegPath()
      const stderrOutput = await runProcessCapture(ffmpeg, ['-i', videoPath], true)
      const stderrRes = parseFfmpegStderr(stderrOutput)

      if (!probeRes) {
        probeRes = stderrRes
      } else if (stderrRes.subtitleTracks.length > 0) {
        // Merge subtitle tracks found by ffmpeg stderr into probeRes
        probeRes.subtitleTracks = stderrRes.subtitleTracks
        probeRes.details.subtitleCount = stderrRes.subtitleTracks.length
      }
    } catch (e) {
      console.warn('ffmpeg -i fallback probe failed:', e)
    }
  }

  return (
    probeRes || {
      tracks: [],
      subtitleTracks: [],
      details: {
        fps: null,
        duration: '',
        durationSec: null,
        resolution: '',
        audioCount: 0,
        subtitleCount: 0
      }
    }
  )
}

function parseProbeJson(data: any): {
  tracks: AudioTrackInfo[]
  subtitleTracks: SubtitleTrackInfo[]
  details: VideoSyncDetails
} {
  const streams = data.streams || []
  const format = data.format || {}

  let fps: number | null = null
  let resolution = ''
  let durationSec = parseFloat(format.duration || '0') || null
  const tracks: AudioTrackInfo[] = []
  const subtitleTracks: SubtitleTrackInfo[] = []

  let audioIdx = 0
  let subIdx = 0
  for (const s of streams) {
    const codecType = (s.codec_type || '').toLowerCase()
    if (codecType === 'video' && !resolution) {
      if (s.width && s.height) {
        resolution = `${s.width}x${s.height}`
      }
      if (s.r_frame_rate) {
        const [num, den] = s.r_frame_rate.split('/').map(Number)
        if (num && den && den !== 0) {
          fps = Math.round((num / den) * 1000) / 1000
        }
      }
    } else if (codecType === 'audio') {
      const tags = s.tags || {}
      tracks.push({
        index: audioIdx++,
        codec: (s.codec_name || 'unknown').toUpperCase(),
        language: tags.language || tags.LANGUAGE || 'und',
        title: tags.title || tags.TITLE || '',
        channels: s.channels || 2
      })
    } else if (codecType === 'subtitle' || codecType === 'text' || codecType === 'timed_text') {
      const tags = s.tags || {}
      const disposition = s.disposition || {}
      const codec = (s.codec_name || 'unknown').toLowerCase()
      const isBitmap = ['hdmv_pgs_subtitle', 'pgssub', 'dvd_subtitle', 'dvdsub', 'xsub', 'dvb_subtitle', 'dvbsub'].includes(codec)
      subtitleTracks.push({
        index: subIdx++,
        streamIndex: typeof s.index === 'number' ? s.index : subIdx - 1,
        codec,
        language: tags.language || tags.LANGUAGE || 'und',
        title: tags.title || tags.TITLE || '',
        isDefault: Boolean(disposition.default),
        isForced: Boolean(disposition.forced),
        isText: !isBitmap
      })
    }
  }

  const durationStr = durationSec ? formatDuration(durationSec) : ''

  return {
    tracks,
    subtitleTracks,
    details: {
      fps,
      duration: durationStr,
      durationSec,
      resolution,
      audioCount: tracks.length,
      subtitleCount: subtitleTracks.length
    }
  }
}

function parseFfmpegStderr(stderr: string): {
  tracks: AudioTrackInfo[]
  subtitleTracks: SubtitleTrackInfo[]
  details: VideoSyncDetails
} {
  let fps: number | null = null
  let resolution = ''
  let durationStr = ''
  let durationSec: number | null = null
  const tracks: AudioTrackInfo[] = []
  const subtitleTracks: SubtitleTrackInfo[] = []

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
  const audioRegex = /Stream\s*#\d+:(\d+)(.*?):\s*Audio:\s*([a-zA-Z0-9_]+).*?(?:,\s*(\d+)\s*channels|,\s*(stereo|mono|5\.1|7\.1))/g
  let match
  let audioIdx = 0
  while ((match = audioRegex.exec(stderr)) !== null) {
    const preColon = match[2] || ''
    const langMatch = preColon.match(/\(([^)]+)\)/)
    const rawLang = langMatch ? langMatch[1].split(/[,/]/)[0].trim() : 'und'
    const lang = ['default', 'forced', 'hearing'].includes(rawLang.toLowerCase()) ? 'und' : rawLang
    const codec = (match[3] || 'AAC').toUpperCase()
    let channels = 2
    if (match[4]) channels = parseInt(match[4], 10)
    else if (match[5] === 'mono') channels = 1
    else if (match[5] === 'stereo') channels = 2
    else if (match[5] === '5.1') channels = 6
    else if (match[5] === '7.1') channels = 8

    // Extract title if present in metadata
    const matchPos = match.index + match[0].length
    const nextStreamPos = stderr.indexOf('Stream #', matchPos)
    const block = stderr.slice(matchPos, nextStreamPos !== -1 ? nextStreamPos : matchPos + 500)
    const titleMatch = block.match(/(?:title|\bTITLE)\s*:\s*(.+?)(?:\r?\n|$)/)
    const title = titleMatch ? titleMatch[1].trim() : ''

    tracks.push({
      index: audioIdx++,
      codec,
      language: lang,
      title,
      channels
    })
  }

  // Extract subtitle streams: "Stream #0:2(eng): Subtitle: subrip (srt) (default)"
  const subRegex = /Stream\s*#\d+:(\d+)(.*?):\s*(?:Subtitle|Text):\s*([^\r\n]+)/g
  let subMatch
  let subIdx = 0
  while ((subMatch = subRegex.exec(stderr)) !== null) {
    const streamIndex = parseInt(subMatch[1], 10)
    const preColon = subMatch[2] || ''
    const rest = subMatch[3] || ''

    // Extract language from parenthesis in preColon or rest
    const langMatch = preColon.match(/\(([^)]+)\)/) || rest.match(/\(([^)]+)\)/)
    const rawLang = langMatch ? langMatch[1].split(/[,/]/)[0].trim() : 'und'
    const lang = ['default', 'forced', 'hearing'].includes(rawLang.toLowerCase()) ? 'und' : rawLang

    // Extract codec: first alphanumeric word from rest
    const codecMatch = rest.trim().match(/^([a-zA-Z0-9_-]+)/)
    const codec = (codecMatch ? codecMatch[1] : 'unknown').toLowerCase()

    const flags = (preColon + ' ' + rest).toLowerCase()
    const isDefault = flags.includes('default')
    const isForced = flags.includes('forced')

    // Find any "title : <text>" in metadata right after this stream before the next Stream line
    const matchPos = subMatch.index + subMatch[0].length
    const nextStreamPos = stderr.indexOf('Stream #', matchPos)
    const block = stderr.slice(matchPos, nextStreamPos !== -1 ? nextStreamPos : matchPos + 500)
    const titleMatch = block.match(/(?:title|\bTITLE)\s*:\s*(.+?)(?:\r?\n|$)/)
    const title = titleMatch ? titleMatch[1].trim() : ''

    const isBitmap = ['hdmv_pgs_subtitle', 'pgssub', 'dvd_subtitle', 'dvdsub', 'xsub', 'dvb_subtitle', 'dvbsub'].includes(codec)

    subtitleTracks.push({
      index: subIdx++,
      streamIndex,
      codec,
      language: lang,
      title,
      isDefault,
      isForced,
      isText: !isBitmap
    })
  }

  return {
    tracks,
    subtitleTracks,
    details: {
      fps,
      duration: durationStr,
      durationSec,
      resolution,
      audioCount: tracks.length,
      subtitleCount: subtitleTracks.length
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
    const binDir = dirname(bin)
    const augmentedPath = [
      binDir,
      process.env.PATH || ''
    ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

    const proc = spawn(bin, args, {
      windowsHide: true,
      cwd: binDir,
      env: {
        ...process.env,
        PATH: augmentedPath
      }
    })
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

/**
 * Forcibly kill a process and its entire child process tree (on Windows using taskkill /T /F).
 * Ensures that spawned tools like ffmpeg, ffsubsync, whisper, and their child processes
 * terminate immediately and release all file / pipe handles.
 */
export function killProcessTree(proc: ChildProcess | null | undefined): void {
  if (!proc) return
  const pid = proc.pid
  if (pid) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { windowsHide: true, stdio: 'ignore' })
      } catch {}
    } else {
      try {
        process.kill(-pid, 'SIGKILL')
      } catch {
        try {
          proc.kill('SIGKILL')
        } catch {}
      }
    }
  }
  try {
    proc.kill()
  } catch {}
}
