import * as fs from 'fs'
import * as os from 'os'
import { dirname } from 'path'
import { spawn } from 'child_process'
import { parseSrt, writeSrt, removeHallucinationLoops } from '../srtTools'

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function mapTrackLangToWhisper(langCode?: string | null): string {
  if (!langCode) return 'auto'
  const c = langCode.trim().toLowerCase()
  if (c.startsWith('en')) return 'en'
  if (c.startsWith('es') || c === 'spa') return 'es'
  if (c.startsWith('fr') || c === 'fra' || c === 'fre') return 'fr'
  if (c.startsWith('de') || c === 'deu' || c === 'ger') return 'de'
  if (c.startsWith('ru') || c === 'rus') return 'ru'
  if (c.startsWith('it') || c === 'ita') return 'it'
  if (c.startsWith('ja') || c === 'jpn') return 'ja'
  if (c.startsWith('ko') || c === 'kor') return 'ko'
  if (c.startsWith('zh') || c === 'zho' || c === 'chi') return 'zh'
  if (c.startsWith('hi') || c === 'hin') return 'hi'
  if (c.startsWith('ta') || c === 'tam') return 'ta'
  if (c.startsWith('si') || c === 'sin') return 'si'
  if (c.startsWith('pt') || c === 'por') return 'pt'
  if (c.startsWith('ar') || c === 'ara') return 'ar'
  if (c.length === 2) return c
  return 'auto'
}

export async function extractAudioWithFfmpeg(options: {
  ffmpeg: string
  video: string
  trackIndex?: number | null
  tempWav: string
  onProcessStart: (proc: any) => void
  isCancelled: () => boolean
}): Promise<void> {
  const { ffmpeg, video, trackIndex, tempWav, onProcessStart, isCancelled } = options

  return new Promise<void>((resolve, reject) => {
    if (isCancelled()) {
      reject(new Error('Subtitle generation cancelled by user.'))
      return
    }

    const ffmpegArgs = [
      '-y',
      '-threads', '0',
      '-i', video,
      '-map', `0:a:${trackIndex ?? 0}`,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      tempWav
    ]

    const ffmpegDir = dirname(ffmpeg)
    const augmentedPath = [
      ffmpegDir,
      process.env.PATH || ''
    ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

    const proc = spawn(ffmpeg, ffmpegArgs, {
      windowsHide: true,
      cwd: ffmpegDir,
      env: {
        ...process.env,
        PATH: augmentedPath
      }
    })
    onProcessStart(proc)

    proc.on('close', (code) => {
      if (isCancelled()) {
        reject(new Error('Subtitle generation cancelled by user.'))
        return
      }
      if (code === 0 && fs.existsSync(tempWav)) {
        resolve()
      } else {
        reject(new Error(`FFmpeg audio extraction failed with exit code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

export async function runWhisperTranscription(options: {
  whisper: string
  ffmpeg: string
  modelPath: string
  tempWav: string
  outBase: string
  generatedSrt: string
  language: string
  trackLanguage?: string | null
  totalDurationSec: number
  onEvent: (data: any) => void
  onProcessStart: (proc: any) => void
  isCancelled: () => boolean
}): Promise<void> {
  const {
    whisper,
    ffmpeg,
    modelPath,
    tempWav,
    outBase,
    generatedSrt,
    language,
    trackLanguage,
    totalDurationSec,
    onEvent,
    onProcessStart,
    isCancelled
  } = options

  return new Promise<void>((resolve, reject) => {
    if (isCancelled()) {
      reject(new Error('Subtitle generation cancelled by user.'))
      return
    }

    const cpuThreads = Math.max(1, Math.min(os.cpus().length, 16))
    const whisperArgs = [
      '-m', modelPath,
      '-f', tempWav,
      '-osrt',
      '-of', outBase,
      '-t', String(cpuThreads),
      '-bs', '2',
      '-bo', '2',
      '-fa',
      '-sns',
      '-nf',
      '-et', '2.0',
      '-lpt', '-0.8',
      '-nth', '0.65',
      '-mc', '0',
      '-pp'
    ]

    if (language === 'en') {
      whisperArgs.push('-l', 'en')
    } else if (language === 'original') {
      const resolvedLang = mapTrackLangToWhisper(trackLanguage)
      whisperArgs.push('-l', resolvedLang)
    } else if (language === 'si') {
      whisperArgs.push('-tr')
    } else {
      whisperArgs.push('-l', 'auto')
    }

    onEvent({
      type: 'log',
      message: `[WHISPER] Command (${cpuThreads} threads, fast-beam=2, anti-loop ctx=0, no-fallback): ${whisper} ${whisperArgs.join(' ')}`
    })

    const whisperDir = dirname(whisper)
    const ffmpegDir = dirname(ffmpeg)
    const augmentedPath = [
      whisperDir,
      ffmpegDir,
      process.env.PATH || ''
    ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

    const proc = spawn(whisper, whisperArgs, {
      windowsHide: true,
      cwd: whisperDir,
      env: {
        ...process.env,
        PATH: augmentedPath
      }
    })
    onProcessStart(proc)

    const whisperRange = language === 'si' ? 65 : 85
    let lastReportedPercent = 10
    let lastSpokenText = ''
    let repeatLogCount = 0

    const processWhisperLine = (line: string) => {
      if (isCancelled()) return
      const l = line.trim()
      if (!l) return

      const timeMatch = l.match(
        /\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\](?:\s*(.*))?$/
      )
      let isDuplicateSpoken = false

      if (timeMatch) {
        const spoken = (timeMatch[9] || '').trim().toLowerCase().replace(/['".,!?;:\s\-_()[\]]/g, '')
        if (spoken && spoken === lastSpokenText) {
          repeatLogCount++
          if (repeatLogCount > 1) {
            isDuplicateSpoken = true
          }
        } else if (spoken) {
          lastSpokenText = spoken
          repeatLogCount = 1
        }

        if (totalDurationSec > 0) {
          const h = parseInt(timeMatch[5], 10)
          const m = parseInt(timeMatch[6], 10)
          const s = parseInt(timeMatch[7], 10)
          const currentSec = h * 3600 + m * 60 + s
          const fraction = Math.min(1.0, currentSec / totalDurationSec)
          const calcPercent = Math.min(
            10 + whisperRange,
            Math.max(10, Math.round(10 + fraction * whisperRange))
          )

          if (calcPercent > lastReportedPercent) {
            lastReportedPercent = calcPercent
            const msg = `Transcribing speech: ${formatTime(currentSec)} / ${formatTime(totalDurationSec)} (${Math.round(fraction * 100)}%)`
            onEvent({ type: 'progress', percent: calcPercent, message: msg })
          }
        }
      }

      if (!isDuplicateSpoken) {
        onEvent({ type: 'log', message: `[WHISPER] ${l}` })
      }

      const progMatch = l.match(/progress\s*=\s*(\d+)%/)
      if (progMatch) {
        const p = parseInt(progMatch[1], 10)
        const fraction = Math.min(1.0, p / 100)
        const calcPercent = Math.min(
          10 + whisperRange,
          Math.max(10, Math.round(10 + fraction * whisperRange))
        )
        if (calcPercent > lastReportedPercent) {
          lastReportedPercent = calcPercent
          onEvent({
            type: 'progress',
            percent: calcPercent,
            message: `Transcribing speech (${p}%)...`
          })
        }
      }
    }

    proc.stdout.on('data', (d) => {
      const text = d.toString()
      const lines = text.split('\n')
      for (const l of lines) {
        processWhisperLine(l)
      }
    })

    proc.stderr.on('data', (d) => {
      const text = d.toString()
      const lines = text.split('\n')
      for (const l of lines) {
        processWhisperLine(l)
      }
    })

    proc.on('close', (code) => {
      if (isCancelled()) {
        reject(new Error('Subtitle generation cancelled by user.'))
        return
      }
      if (code === 0 && fs.existsSync(generatedSrt)) {
        try {
          const rawSrt = fs.readFileSync(generatedSrt, 'utf-8')
          const cues = parseSrt(rawSrt)
          const cleaned = removeHallucinationLoops(cues)
          if (cues.length !== cleaned.length) {
            fs.writeFileSync(generatedSrt, writeSrt(cleaned), 'utf-8')
            onEvent({
              type: 'log',
              message: `[WHISPER] Cleaned up ${cues.length - cleaned.length} runaway repetition loop cue(s).`
            })
          }
        } catch (err: any) {
          onEvent({ type: 'log', message: `[WHISPER] Notice: De-hallucination pass: ${err.message}` })
        }
        resolve()
      } else {
        reject(new Error(`Whisper transcription failed with exit code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}
