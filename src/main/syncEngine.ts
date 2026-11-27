/**
 * Pure TypeScript Synchronization Engines: Standard, Smart (4-Pass), and Split Sync.
 * Executes bin/ffsubsync.exe directly as a child process and streams progress.
 */
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import { join, dirname } from 'path'
import { getFfsubsyncPath, getFfmpegPath, killProcessTree } from './media'
import { sanitizeOutputSrt } from './srtTools'

export interface SyncOptions {
  video: string
  sub: string
  out: string
  mode: 'Standard' | 'Smart' | 'Split sync'
  trackIndex?: number | null
  subFps?: number | null
}

export type LogCallback = (line: string) => void
export type StatusCallback = (status: string) => void
export type ProgressCallback = (percent: number, message?: string) => void

const SCORE_REGEX = /score\D{0,6}(-?\d+(?:\.\d+)?)/i
const PERCENT_REGEX = /(?:^|\D)(\d{1,3})%(?:\D|$)/

export class SyncEngine {
  private currentProc: ChildProcess | null = null
  private cancelled = false
  private currentOut: string | null = null
  private pendingPassResolve: ((val: { code: number; score: number | null }) => void) | null = null

  constructor(
    private onLog: LogCallback,
    private onStatus: StatusCallback,
    private onProgress: ProgressCallback = () => {}
  ) {}

  public cancel(): void {
    this.cancelled = true
    const proc = this.currentProc
    this.currentProc = null
    if (proc) {
      killProcessTree(proc)
    }
    if (this.pendingPassResolve) {
      const res = this.pendingPassResolve
      this.pendingPassResolve = null
      res({ code: -1, score: null })
    }
    // Delete any partial output file if it was created on disk
    if (this.currentOut && fs.existsSync(this.currentOut)) {
      try {
        fs.unlinkSync(this.currentOut)
      } catch (e) {}
    }
  }

  public isCancelled(): boolean {
    return this.cancelled
  }

  private buildArgs(video: string, sub: string, out: string, extra: string[] = []): string[] {
    const args = [video, '-i', sub, '-o', out]
    return args.concat(extra)
  }

  /**
   * Run a single pass of ffsubsync.exe
   */
  public runSinglePass(
    video: string,
    sub: string,
    out: string,
    extra: string[] = [],
    onPassProgress?: (pct: number) => void
  ): Promise<{ code: number; score: number | null }> {
    return new Promise((resolve) => {
      if (this.cancelled) {
        resolve({ code: -1, score: null })
        return
      }

      this.pendingPassResolve = resolve

      const ffsubsync = getFfsubsyncPath()
      const ffmpeg = getFfmpegPath()
      const binDir = dirname(ffsubsync)
      const ffmpegDir = dirname(ffmpeg)
      const augmentedPath = [
        binDir,
        ffmpegDir,
        process.env.PATH || ''
      ].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')

      const args = this.buildArgs(video, sub, out, extra)

      const proc = spawn(ffsubsync, args, {
        windowsHide: true,
        cwd: binDir,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PATH: augmentedPath
        }
      })
      this.currentProc = proc

      let score: number | null = null
      let estimatedProgress = 10

      proc.stdout?.on('data', (d) => {
        if (this.cancelled) return
        const text = d.toString('utf-8')
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          this.onLog(trimmed)

          // Parse explicit percentage if present (monotonic only)
          const pctMatch = trimmed.match(PERCENT_REGEX)
          if (pctMatch) {
            const p = parseInt(pctMatch[1], 10)
            if (p >= estimatedProgress && p <= 100) {
              estimatedProgress = p
              onPassProgress?.(estimatedProgress)
            }
          } else {
            // Heuristic progress updates from stage text
            const lower = trimmed.toLowerCase()
            if (lower.includes('extracting') || lower.includes('audio')) {
              estimatedProgress = Math.max(estimatedProgress, 20)
              onPassProgress?.(estimatedProgress)
            } else if (lower.includes('speech') || lower.includes('vad')) {
              estimatedProgress = Math.max(estimatedProgress, 45)
              onPassProgress?.(estimatedProgress)
            } else if (lower.includes('correlat') || lower.includes('fft') || lower.includes('matrix')) {
              estimatedProgress = Math.max(estimatedProgress, 70)
              onPassProgress?.(estimatedProgress)
            } else if (lower.includes('align') || lower.includes('search') || lower.includes('offset')) {
              estimatedProgress = Math.max(estimatedProgress, 88)
              onPassProgress?.(estimatedProgress)
            }
          }

          const m = trimmed.match(SCORE_REGEX)
          if (m) {
            const parsed = parseFloat(m[1])
            if (!isNaN(parsed)) score = parsed
            estimatedProgress = Math.max(estimatedProgress, 95)
            onPassProgress?.(estimatedProgress)
          }
        }
      })

      proc.stderr?.on('data', (d) => {
        if (this.cancelled) return
        const text = d.toString('utf-8')
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          this.onLog(trimmed)

          const pctMatch = trimmed.match(PERCENT_REGEX)
          if (pctMatch) {
            const p = parseInt(pctMatch[1], 10)
            if (p >= estimatedProgress && p <= 100) {
              estimatedProgress = p
              onPassProgress?.(estimatedProgress)
            }
          }
        }
      })

      proc.on('close', (code, signal) => {
        if (this.currentProc === proc) {
          this.currentProc = null
        }
        if (this.pendingPassResolve === resolve) {
          this.pendingPassResolve = null
          const exitCode = code !== null ? code : (signal ? -1 : 1)
          if (exitCode === 0) {
            onPassProgress?.(100)
          }
          resolve({ code: exitCode, score })
        }
      })

      proc.on('error', (err) => {
        if (this.currentProc === proc) {
          this.currentProc = null
        }
        if (this.pendingPassResolve === resolve) {
          this.pendingPassResolve = null
          this.onLog(`[ERROR] Failed to launch ffsubsync: ${err.message}`)
          resolve({ code: 1, score: null })
        }
      })
    })
  }

  /**
   * 1. Standard Sync: Fast single pass alignment
   */
  public async runStandard(options: SyncOptions): Promise<{ success: boolean; score: number | null }> {
    this.currentOut = options.out
    this.onStatus('Running Standard 1-pass synchronization...')
    this.onProgress(5, 'Initializing alignment engine...')
    const extra: string[] = []

    if (options.trackIndex !== undefined && options.trackIndex !== null) {
      extra.push('--reference-stream', `0:a:${options.trackIndex}`)
    }
    if (options.subFps) {
      extra.push('--sub-fps', String(options.subFps))
    }

    const { code, score } = await this.runSinglePass(
      options.video,
      options.sub,
      options.out,
      extra,
      (passPct) => {
        const scaled = Math.min(98, Math.max(5, passPct))
        this.onProgress(scaled, `Synchronizing... (${scaled}%)`)
      }
    )

    // If cancelled or failed, remove partial output file
    if (this.cancelled || code !== 0) {
      if (fs.existsSync(options.out)) {
        try {
          fs.unlinkSync(options.out)
        } catch (e) {}
      }
      return { success: false, score: null }
    }

    // Verify output file was successfully generated and contains content
    if (!fs.existsSync(options.out) || fs.statSync(options.out).size === 0) {
      this.onLog(`[ERROR] Alignment engine finished without generating output file: "${options.out}"`)
      if (fs.existsSync(options.out)) {
        try {
          fs.unlinkSync(options.out)
        } catch (e) {}
      }
      return { success: false, score: null }
    }

    sanitizeOutputSrt(options.out)

    this.onProgress(100, 'Synchronization complete!')
    return { success: true, score }
  }

  /**
   * 2. Smart Sync: 4-Pass scoring algorithm
   */
  public async runSmart(options: SyncOptions): Promise<{ success: boolean; score: number | null }> {
    this.currentOut = options.out
    const extraBase: string[] = []
    if (options.trackIndex !== undefined && options.trackIndex !== null) {
      extraBase.push('--reference-stream', `0:a:${options.trackIndex}`)
    }
    if (options.subFps) {
      extraBase.push('--sub-fps', String(options.subFps))
    }

    const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'subsync_smart_'))
    const passes = [
      { name: 'Base search', flags: [] },
      { name: 'Wide search (±15m)', flags: ['--max-offset-seconds', '900'] },
      { name: 'Speed drift correction (--gss)', flags: ['--gss'] },
      { name: 'Auditok speech detector', flags: ['--vad', 'auditok'] }
    ]

    let bestScore = -Infinity
    let bestFile: string | null = null

    try {
      const passWeight = 100 / passes.length
      for (let i = 0; i < passes.length; i++) {
        if (this.cancelled) break
        const p = passes[i]
        const passBasePct = Math.round(i * passWeight)
        const statusText = `Smart Sync: Pass ${i + 1}/${passes.length} (${p.name})`
        this.onStatus(statusText)
        this.onLog(`\n--- Pass ${i + 1}/${passes.length}: ${p.name} ---`)

        const passOut = join(tempDir, `pass_${i}.srt`)
        const flags = [...extraBase, ...p.flags]

        const res = await this.runSinglePass(
          options.video,
          options.sub,
          passOut,
          flags,
          (passPct) => {
            const overallPct = Math.min(98, Math.round(passBasePct + passPct * (passWeight / 100)))
            this.onProgress(overallPct, `${statusText} - ${overallPct}%`)
          }
        )
        const currentScore = res.score ?? 0

        this.onLog(`Pass ${i + 1} finished with score: ${res.score ?? 'N/A'}`)

        if (res.code === 0 && currentScore > bestScore && fs.existsSync(passOut) && fs.statSync(passOut).size > 0) {
          bestScore = currentScore
          bestFile = passOut
        }
      }

      if (!this.cancelled && bestFile && fs.existsSync(bestFile) && fs.statSync(bestFile).size > 0) {
        fs.copyFileSync(bestFile, options.out)
        sanitizeOutputSrt(options.out)
        this.onProgress(100, 'Smart sync complete!')
        return { success: true, score: bestScore > -Infinity ? bestScore : null }
      }
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {}
      if (this.cancelled && fs.existsSync(options.out)) {
        try {
          fs.unlinkSync(options.out)
        } catch (e) {}
      }
    }

    return { success: false, score: null }
  }

  /**
   * 3. Split Sync: Alass-style piecewise alignment for commercial breaks & extended/director's cuts
   */
  public async runSplit(options: SyncOptions): Promise<{ success: boolean; score: number | null }> {
    this.currentOut = options.out
    this.onStatus('Running Split Sync (piecewise cut alignment)...')
    this.onProgress(5, 'Initializing piecewise alignment engine...')

    const extra: string[] = ['--split-penalty', '5', '--max-offset-seconds', '900']

    if (options.trackIndex !== undefined && options.trackIndex !== null) {
      extra.push('--reference-stream', `0:a:${options.trackIndex}`)
    }
    if (options.subFps) {
      extra.push('--sub-fps', String(options.subFps))
    }

    const { code, score } = await this.runSinglePass(
      options.video,
      options.sub,
      options.out,
      extra,
      (passPct) => {
        const scaled = Math.min(98, Math.max(5, passPct))
        this.onProgress(scaled, `Split Sync: Aligning cuts (${scaled}%)...`)
      }
    )

    if (this.cancelled || code !== 0) {
      if (fs.existsSync(options.out)) {
        try {
          fs.unlinkSync(options.out)
        } catch (e) {}
      }
      return { success: false, score: null }
    }

    if (!fs.existsSync(options.out) || fs.statSync(options.out).size === 0) {
      this.onLog(`[ERROR] Split Sync finished without generating output file: "${options.out}"`)
      if (fs.existsSync(options.out)) {
        try {
          fs.unlinkSync(options.out)
        } catch (e) {}
      }
      return { success: false, score: null }
    }

    sanitizeOutputSrt(options.out)

    this.onProgress(100, 'Split sync complete!')
    return { success: true, score }
  }
}
