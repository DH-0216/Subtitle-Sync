/**
 * Shared file path sanitization and validation utilities for Subtitle Sync Studio.
 * Used across Main Process, Preload, and Renderer.
 */

export const SUPPORTED_VIDEO_EXTENSIONS = [
  'mkv',
  'mp4',
  'avi',
  'mov',
  'm4v',
  'webm',
  'flv',
  'wmv',
  'ts',
  'mts',
  'm2ts',
  '3gp',
  'ogv',
  'vob',
  'mpg',
  'mpeg'
] as const

export const SUPPORTED_SUBTITLE_EXTENSIONS = [
  'srt',
  'ass',
  'ssa',
  'vtt',
  'sub'
] as const

export type FileCategory = 'video' | 'subtitle' | 'other'

/**
 * Safely check if running on Windows across Node.js main process, preload, and renderer browser.
 */
function isWindowsEnvironment(): boolean {
  try {
    if (typeof process !== 'undefined' && process?.platform) {
      return process.platform === 'win32'
    }
  } catch {}
  try {
    if (typeof navigator !== 'undefined' && navigator?.userAgent) {
      return /windows|win32/i.test(navigator.userAgent)
    }
  } catch {}
  return true
}

/**
 * Clean and sanitize a raw file path string:
 * - Trims leading/trailing whitespace and zero-width spaces
 * - Strips enclosing double ("...") or single ('...') or curly quotes (“...”)
 * - Handles file:// and file:/// URL schemes
 * - Strips null bytes (\0), linebreaks, and control characters
 * - Fixes leading slash before drive letters on Windows (e.g. /C:/path -> C:/path)
 */
export function cleanPathString(rawPath: unknown): string {
  try {
    if (typeof rawPath !== 'string') return ''

    let p = rawPath.trim()
    if (!p) return ''

    // Remove zero-width spaces, null bytes, linebreaks, and control characters
    p = p.replace(/[\u200B-\u200D\uFEFF\0\r\n\t]/g, '')

    // Remove leading and trailing quotes (including curly, smart, backticks)
    p = p.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim()

    // Handle file:// and file:/// URI schemes (common in drag & drop from some browsers/apps)
    if (/^file:\/\/\/?/i.test(p)) {
      try {
        p = decodeURIComponent(p.replace(/^file:\/\/\/?/i, ''))
      } catch {
        p = p.replace(/^file:\/\/\/?/i, '')
      }
    }

    // On Windows, fix leading slash before drive letter from file URLs e.g. /C:/path/to/file -> C:/path/to/file
    if (isWindowsEnvironment() && /^\/[a-zA-Z]:/.test(p)) {
      p = p.substring(1)
    }

    return p.trim()
  } catch {
    return typeof rawPath === 'string' ? rawPath.trim() : ''
  }
}

/**
 * Sanitize an array of file path strings:
 * Cleans each path, strips empty paths, and deduplicates the list preserving order.
 */
export function sanitizeFilePaths(rawPaths: unknown[]): string[] {
  if (!Array.isArray(rawPaths)) return []
  const unique = new Set<string>()
  const result: string[] = []
  for (const raw of rawPaths) {
    const clean = cleanPathString(raw)
    if (clean && !unique.has(clean)) {
      unique.add(clean)
      result.push(clean)
    }
  }
  return result
}

/**
 * Extract clean file extension without leading dot (lowercase).
 */
export function getFileExtension(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return ''
  const clean = cleanPathString(filePath)
  if (!clean) return ''
  const base = clean.split(/[/\\]/).pop() || clean
  const lastDot = base.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === base.length - 1) return ''
  return base.substring(lastDot + 1).toLowerCase()
}

/**
 * Extract file name from path.
 */
export function getFileName(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return ''
  const clean = cleanPathString(filePath)
  if (!clean) return ''
  return clean.split(/[/\\]/).pop() || clean
}

/**
 * Check if the given path or extension represents a recognized video format.
 */
export function isVideoFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Check if the given path or extension represents a recognized subtitle format.
 */
export function isSubtitleFile(filePath: string): boolean {
  const ext = getFileExtension(filePath)
  return (SUPPORTED_SUBTITLE_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Categorize file based on extension.
 */
export function classifyFileType(filePath: string): FileCategory {
  if (isVideoFile(filePath)) return 'video'
  if (isSubtitleFile(filePath)) return 'subtitle'
  return 'other'
}

/**
 * Generate human-friendly, contextual error messages when an unsupported file is chosen.
 */
export function getUnsupportedFileMessage(
  filePath: string,
  expectedType: 'video' | 'subtitle',
  details?: { isDirectory?: boolean; isEmpty?: boolean; exists?: boolean }
): string {
  const fileName = getFileName(filePath) || 'Selected file'
  const ext = getFileExtension(filePath).toLowerCase()

  if (details?.exists === false) {
    return `File not found: "${fileName}". Please check the path and try again.`
  }

  if (details?.isDirectory) {
    if (expectedType === 'video') {
      return `"${fileName}" is a folder, not a video file. Please select a video file (.mp4, .mkv, .avi, etc.).`
    } else {
      return `Folder "${fileName}" does not contain any supported subtitle files (.srt, .ass, .vtt).`
    }
  }

  if (details?.isEmpty) {
    return `The selected file "${fileName}" is empty (0 bytes) and cannot be processed.`
  }

  // Cross-type: Subtitle file selected when video expected
  if (expectedType === 'video' && isSubtitleFile(filePath)) {
    return `"${fileName}" is a subtitle file (.${ext}), not a movie. Subtitles belong in Step 2: Out-of-Sync Subtitles.`
  }

  // Cross-type: Video file selected when subtitle expected
  if (expectedType === 'subtitle' && isVideoFile(filePath)) {
    return `"${fileName}" is a video file (.${ext}), not a subtitle. Please choose your subtitle file (.srt, .ass, .vtt) here.`
  }

  // Audio-only formats
  const audioExts = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'wma', 'opus', 'alac', 'aiff']
  if (audioExts.includes(ext)) {
    if (expectedType === 'video') {
      return `"${fileName}" is an audio-only file (.${ext}). Subtitle Sync Studio requires a movie/video file with video streams (.mp4, .mkv, .avi) to synchronize.`
    } else {
      return `"${fileName}" is an audio file (.${ext}), not a subtitle. Please select a .SRT, .ASS, or .VTT file.`
    }
  }

  // Image formats
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff']
  if (imageExts.includes(ext)) {
    const target = expectedType === 'video' ? 'video file (.mp4, .mkv, .avi)' : 'subtitle file (.srt, .ass, .vtt)'
    return `"${fileName}" is an image file (.${ext}). Please select a supported ${target}.`
  }

  // Compressed archives
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
  if (archiveExts.includes(ext)) {
    const target = expectedType === 'video' ? 'video' : 'subtitle'
    return `"${fileName}" is a compressed archive (.${ext}). Please extract it first and select the ${target} file directly.`
  }

  // Document formats
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
  if (docExts.includes(ext)) {
    const target = expectedType === 'video' ? 'video file (.mp4, .mkv, .avi)' : 'subtitle file (.srt, .ass, .vtt)'
    return `"${fileName}" is a document file (.${ext}). Please select a supported ${target}.`
  }

  // Plain text (.txt)
  if (ext === 'txt') {
    if (expectedType === 'video') {
      return `"${fileName}" is a plain text file (.txt). Please select a movie/video file (.mp4, .mkv, .avi, etc.).`
    } else {
      return `"${fileName}" is a plain text file (.txt). Subtitles must be in .SRT, .ASS, or .VTT format with timecodes.`
    }
  }

  // Bitmap subtitle formats (.sup, .idx)
  if (['sup', 'idx'].includes(ext)) {
    return `"${fileName}" is an image-based bitmap subtitle (.${ext}) which cannot be text-synchronized directly. Please use text-based subtitles (.srt, .ass, .vtt).`
  }

  // Executables and system binaries
  const binExts = ['exe', 'dll', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'iso', 'bin', 'apk', 'dmg']
  if (binExts.includes(ext)) {
    return `"${fileName}" is an executable or system file (.${ext}). Please select a supported media file.`
  }

  // Fallback for any other unsupported extension
  if (expectedType === 'video') {
    const extHint = ext ? ` (.${ext})` : ''
    return `Unsupported video format${extHint}. Supported video formats: ${SUPPORTED_VIDEO_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')}.`
  } else {
    const extHint = ext ? ` (.${ext})` : ''
    return `Unsupported subtitle format${extHint}. Supported subtitle formats: ${SUPPORTED_SUBTITLE_EXTENSIONS.map((e) => '.' + e.toUpperCase()).join(', ')}.`
  }
}

export interface FileValidationItem {
  rawPath: string
  cleanPath: string
  fileName: string
  extension: string
  exists: boolean
  isFile: boolean
  isDirectory: boolean
  sizeBytes: number
  isEmpty: boolean
  category: FileCategory
  isValid: boolean
  errorMessage?: string
  directorySubtitles?: string[]
}

/**
 * Shared byte size formatter across modals and file displays.
 */
export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return `${mb.toFixed(1)} MB`
}
