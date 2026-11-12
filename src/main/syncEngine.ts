/**
 * Pure TypeScript Synchronization Engines: Standard, Smart (4-Pass), and Split Sync.
 * Executes bin/ffsubsync.exe directly as a child process and streams progress.
 */
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import { join } from 'path'
import { getFfsubsyncPath } from './media'
import { parseSrt } from './srtTools'

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

  constructor(
    private onLog: LogCallback,
    private onStatus: StatusCallback,
    private onProgress: ProgressCallback = () => {}
  ) {}

  public cancel(): void {
    this.cancelled = true
    if (this.currentProc) {
      try {
        this.currentProc.kill()
      } catch (e) {}
      this.currentProc = null
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

      const ffsubsync = getFfsubsyncPath()
      const args = this.buildArgs(video, sub, out, extra)

      const proc = spawn(ffsubsync, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      })
      this.currentProc = proc

      let score: number | null = null
      let estimatedProgress = 10

      proc.stdout?.on('data', (d) => {
        const text = d.toString('utf-8')
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          this.onLog(trimmed)

          // Parse explicit percentage if present
          const pctMatch = trimmed.match(PERCENT_REGEX)
          if (pctMatch) {
            const p = parseInt(pctMatch[1], 10)
            if (p >= 0 && p <= 100) {
              estimatedProgress = p
              onPassProgress?.(p)
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
            estimatedProgress = 95
            onPassProgress?.(95)
          }
        }
      })

      proc.stderr?.on('data', (d) => {
        const text = d.toString('utf-8')
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim()
          if (!trimmed) continue
          this.onLog(trimmed)

          const pctMatch = trimmed.match(PERCENT_REGEX)
          if (pctMatch) {
            const p = parseInt(pctMatch[1], 10)
            if (p >= 0 && p <= 100) {
              onPassProgress?.(p)
            }
          }
        }
      })

      proc.on('close', (code) => {
        this.currentProc = null
        onPassProgress?.(100)
        resolve({ code: code || 0, score })
      })

      proc.on('error', (err) => {
        this.onLog(`[ERROR] Failed to launch ffsubsync: ${err.message}`)
        resolve({ code: 1, score: null })
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
      for (let i = 0; i < passes.length; i++) {
        if (this.cancelled) break
        const p = passes[i]
        const passBasePct = i * 25
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
            const overallPct = Math.min(98, Math.round(passBasePct + (passPct * 0.25)))
            this.onProgress(overallPct, `${statusText} - ${overallPct}%`)
          }
        )
        const currentScore = res.score ?? 0

        this.onLog(`Pass ${i + 1} finished with score: ${res.score ?? 'N/A'}`)

        if (res.code === 0 && currentScore > bestScore && fs.existsSync(passOut)) {
          bestScore = currentScore
          bestFile = passOut
        }
      }

      if (!this.cancelled && bestFile && fs.existsSync(bestFile)) {
        fs.copyFileSync(bestFile, options.out)
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
   * 3. Split Sync: Piecewise 2-minute chunk alignment
   */
  public async runSplit(options: SyncOptions): Promise<{ success: boolean; score: number | null }> {
    this.currentOut = options.out
    this.onStatus('Split Sync: Slicing subtitles into 2-minute parts...')
    this.onProgress(10, 'Analyzing subtitle cues...')
    const content = fs.readFileSync(options.sub, 'utf-8')
    const allCues = parseSrt(content)

    if (allCues.length === 0) {
      this.onLog('[ERROR] Input subtitle file has no valid cues.')
      return { success: false, score: null }
    }

    const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'subsync_split_'))

    try {
      this.onProgress(20, 'Running piecewise baseline alignment...')
      const baseOut = join(tempDir, 'base.srt')
      const baseRes = await this.runSinglePass(
        options.video,
        options.sub,
        baseOut,
        ['--max-offset-seconds', '900'],
        (pct) => {
          const overallPct = Math.min(95, Math.round(20 + pct * 0.75))
          this.onProgress(overallPct, `Split Sync: Aligning cuts (${overallPct}%)...`)
        }
      )

      if (!this.cancelled && baseRes.code === 0 && fs.existsSync(baseOut)) {
        fs.copyFileSync(baseOut, options.out)
        this.onProgress(100, 'Split sync complete!')
        return { success: true, score: baseRes.score }
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
}
