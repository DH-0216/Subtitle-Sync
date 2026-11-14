import React, { useState } from 'react'
import {
  Sparkles,
  Bug,
  Zap,
  Tag,
  GitPullRequest,
  ExternalLink,
  CheckCircle2,
  FileText,
  Info,
  Rocket,
  ShieldAlert,
  ChevronRight,
  Code2
} from 'lucide-react'

interface UserFriendlyReleaseNotesProps {
  releaseNotes?: string
  releaseUrl?: string
  latestVersion?: string
}

interface TagBadgeConfig {
  label: string
  className: string
}

const TAG_CONFIG: Record<string, TagBadgeConfig> = {
  feat: {
    label: 'Feature',
    className:
      'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  feature: {
    label: 'Feature',
    className:
      'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  add: {
    label: 'New',
    className:
      'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  new: {
    label: 'New',
    className:
      'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
  },
  fix: {
    label: 'Fix',
    className:
      'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  },
  bug: {
    label: 'Fix',
    className:
      'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  },
  fixbug: {
    label: 'Fix',
    className:
      'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
  },
  perf: {
    label: 'Performance',
    className:
      'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
  },
  speed: {
    label: 'Performance',
    className:
      'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800'
  },
  ui: {
    label: 'UI',
    className:
      'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
  },
  ux: {
    label: 'UX',
    className:
      'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
  },
  style: {
    label: 'UI',
    className:
      'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800'
  },
  improve: {
    label: 'Improved',
    className:
      'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  improved: {
    label: 'Improved',
    className:
      'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  update: {
    label: 'Update',
    className:
      'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  enhance: {
    label: 'Improved',
    className:
      'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
  },
  docs: {
    label: 'Docs',
    className:
      'bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800'
  },
  refactor: {
    label: 'Internal',
    className:
      'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  },
  chore: {
    label: 'Maintenance',
    className:
      'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
  },
  security: {
    label: 'Security',
    className:
      'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
  }
}

function handleOpenExternal(url?: string): void {
  if (!url) return
  if (window.api?.shell?.openExternal) {
    window.api.shell.openExternal(url)
  } else {
    window.open(url, '_blank')
  }
}

/**
 * Format inline markdown tokens (code, bold, italic, links, URLs) into React nodes.
 */
function renderInlineFormatting(text: string): React.ReactNode[] {
  if (!text) return []

  // Token regex for:
  // 1. inline code `...`
  // 2. bold **...** or __...__
  // 3. italic *...* or _..._
  // 4. markdown link [label](url)
  // 5. bare URL https?://...
  const tokenRegex =
    /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<)]+)/g

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index))
    }

    const token = match[0]
    const key = `token-${match.index}`

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-blue-700 dark:text-blue-300 font-mono text-[11px] border border-slate-300/40 dark:border-slate-700/60"
        >
          {token.slice(1, -1)}
        </code>
      )
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      nodes.push(
        <strong key={key} className="font-semibold text-slate-900 dark:text-slate-100">
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
      if (linkMatch) {
        const [, label, url] = linkMatch
        nodes.push(
          <button
            key={key}
            type="button"
            onClick={() => handleOpenExternal(url)}
            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 font-medium cursor-pointer align-baseline"
          >
            <span>{label}</span>
            <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
          </button>
        )
      } else {
        nodes.push(token)
      }
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      const displayUrl = token.length > 40 ? `${token.substring(0, 37)}...` : token
      nodes.push(
        <button
          key={key}
          type="button"
          onClick={() => handleOpenExternal(token)}
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 font-medium cursor-pointer align-baseline"
          title={token}
        >
          <span>{displayUrl}</span>
          <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
        </button>
      )
    } else {
      nodes.push(token)
    }

    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex))
  }

  return nodes
}

interface ParsedItem {
  id: string
  type: 'header' | 'bullet' | 'paragraph' | 'quote' | 'code_block' | 'divider'
  level?: number
  text?: string
  code?: string
  isNumbered?: boolean
  tag?: string | null
  scope?: string | null
  author?: string | null
  prUrl?: string | null
  prNumber?: string | null
}

function parseMarkdownReleaseNotes(notes?: string): {
  isEmpty: boolean
  items: ParsedItem[]
  fullChangelogUrl: string | null
} {
  if (
    !notes ||
    !notes.trim() ||
    notes.trim().toLowerCase() === 'no release notes provided for this version.' ||
    notes.trim().toLowerCase() === 'no release notes'
  ) {
    return { isEmpty: true, items: [], fullChangelogUrl: null }
  }

  const lines = notes.split(/\r?\n/)
  const items: ParsedItem[] = []
  let fullChangelogUrl: string | null = null
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let itemCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // Code block toggle
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        items.push({
          id: `item-${itemCounter++}`,
          type: 'code_block',
          code: codeBuffer.join('\n')
        })
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine)
      continue
    }

    if (!trimmed) continue

    // Detect GitHub Full Changelog footer line
    const changelogMatch = trimmed.match(
      /(?:\*\*Full Changelog\*\*|Full Changelog):\s*(https?:\/\/[^\s]+)/i
    )
    if (changelogMatch) {
      fullChangelogUrl = changelogMatch[1]
      continue
    }

    // Horizontal divider
    if (/^[-*_]{3,}$/.test(trimmed)) {
      items.push({ id: `item-${itemCounter++}`, type: 'divider' })
      continue
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      items.push({
        id: `item-${itemCounter++}`,
        type: 'quote',
        text: trimmed.replace(/^>\s*/, '')
      })
      continue
    }

    // Header
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      items.push({
        id: `item-${itemCounter++}`,
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2].trim()
      })
      continue
    }

    // Bullet or Numbered item
    const bulletMatch = trimmed.match(/^([-*+•]|\d+\.)\s+(.+)$/)
    if (bulletMatch) {
      let content = bulletMatch[2].trim()

      // Extract PR and author trailer added by GitHub
      // e.g. "by @username in https://github.com/.../pull/123"
      let prUrl: string | null = null
      let prNumber: string | null = null
      let author: string | null = null

      const prMatch = content.match(/\s+in\s+(https?:\/\/[^\s]+)$/i)
      if (prMatch) {
        prUrl = prMatch[1]
        const numMatch = prUrl.match(/\/pull\/(\d+)/i)
        if (numMatch) prNumber = numMatch[1]
        content = content.slice(0, prMatch.index).trim()
      }

      const authorMatch = content.match(/\s+by\s+(@[\w-]+)$/i)
      if (authorMatch) {
        author = authorMatch[1]
        content = content.slice(0, authorMatch.index).trim()
      }

      // Detect Conventional Commit tag prefix (e.g. feat:, fix(sync):, perf:)
      const prefixRegex =
        /^(feat(?:ure)?|fix(?:bug)?|perf|speed|add(?:ed)?|improve(?:d)?|enhance(?:d)?|update(?:d)?|ui|ux|style|refactor|chore|docs|security)(?:\(([^)]+)\))?:\s*(.*)/i
      const tagMatch = content.match(prefixRegex)

      let tag: string | null = null
      let scope: string | null = null
      if (tagMatch) {
        tag = tagMatch[1].toLowerCase()
        scope = tagMatch[2] || null
        content = tagMatch[3].trim()
      }

      items.push({
        id: `item-${itemCounter++}`,
        type: 'bullet',
        isNumbered: /^\d+\./.test(bulletMatch[1]),
        tag,
        scope,
        text: content,
        author,
        prUrl,
        prNumber
      })
      continue
    }

    // Regular paragraph
    items.push({
      id: `item-${itemCounter++}`,
      type: 'paragraph',
      text: trimmed
    })
  }

  if (codeBuffer.length > 0) {
    items.push({
      id: `item-${itemCounter++}`,
      type: 'code_block',
      code: codeBuffer.join('\n')
    })
  }

  return { isEmpty: items.length === 0, items, fullChangelogUrl }
}

function getHeaderIcon(headerText: string) {
  const lower = headerText.toLowerCase()
  if (lower.includes('feature') || lower.includes('new') || lower.includes('highlight')) {
    return <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
  }
  if (lower.includes('fix') || lower.includes('bug') || lower.includes('patch')) {
    return <Bug className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
  }
  if (lower.includes('perf') || lower.includes('speed') || lower.includes('faster')) {
    return <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
  }
  if (lower.includes('doc') || lower.includes('readme')) {
    return <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
  }
  if (lower.includes('break') || lower.includes('warn') || lower.includes('important')) {
    return <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
  }
  if (lower.includes('note') || lower.includes('info')) {
    return <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
  }
  return <Rocket className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
}

export const UserFriendlyReleaseNotes: React.FC<UserFriendlyReleaseNotesProps> = ({
  releaseNotes,
  releaseUrl,
  latestVersion
}) => {
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted')

  const { isEmpty, items, fullChangelogUrl } = parseMarkdownReleaseNotes(releaseNotes)

  return (
    <div className="space-y-2">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>What&apos;s New in v{latestVersion || 'this Version'}:</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle between Formatted (User-Friendly) and Raw Markdown */}
          {!isEmpty && (
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setViewMode('formatted')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'formatted'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="User-Friendly Styled View"
              >
                Formatted
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="Raw Markdown"
              >
                Raw
              </button>
            </div>
          )}

          {releaseUrl && (
            <button
              type="button"
              onClick={() => handleOpenExternal(releaseUrl)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="Open Release on GitHub"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main Release Notes Content Box */}
      <div className="max-h-60 overflow-y-auto p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 font-sans text-xs text-slate-700 dark:text-slate-300 select-text leading-relaxed">
        {isEmpty ? (
          /* Friendly Empty / Generic Fallback Card */
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-center space-y-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Stability &amp; Performance Update
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              This release brings overall performance optimizations, bug fixes, and reliability
              improvements to Subtitle Sync Studio.
            </p>
            {releaseUrl && (
              <button
                type="button"
                onClick={() => handleOpenExternal(releaseUrl)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1 cursor-pointer"
              >
                <span>View commits on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : viewMode === 'raw' ? (
          /* Raw Markdown View */
          <div className="font-mono text-[11px] whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-100/60 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            {releaseNotes}
          </div>
        ) : (
          /* User-Friendly Formatted View */
          <div className="space-y-2.5">
            {items.map((item, index) => {
              if (item.type === 'header') {
                const isFirst = index === 0
                // Don't render redundant "What's Changed" or "vX.X.X" if it repeats the top banner
                const isGenericTop =
                  isFirst &&
                  /^(what's changed|what's new|changelog|release notes|v?\d+\.\d+)/i.test(
                    item.text || ''
                  )

                if (isGenericTop) {
                  return (
                    <div
                      key={item.id}
                      className="pb-2 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {getHeaderIcon(item.text || '')}
                        <span>{item.text}</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={item.id}
                    className={`pt-2.5 first:pt-0 pb-1 flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 ${
                      item.level && item.level <= 2 ? 'border-b border-slate-200 dark:border-slate-800 pb-1.5' : ''
                    }`}
                  >
                    {getHeaderIcon(item.text || '')}
                    <span>{item.text}</span>
                  </div>
                )
              }

              if (item.type === 'bullet') {
                const tagBadge = item.tag ? TAG_CONFIG[item.tag] : null

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 group py-0.5"
                  >
                    {/* Bullet indicator or Tag badge */}
                    {tagBadge ? (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 mt-0.5 leading-none ${tagBadge.className}`}
                      >
                        {tagBadge.label}
                      </span>
                    ) : item.isNumbered ? (
                      <span className="w-4 h-4 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold">
                        •
                      </span>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80 dark:bg-blue-400 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                    )}

                    {/* Scope badge if present (e.g. [sync]) */}
                    {item.scope && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60 shrink-0 mt-0.5">
                        {item.scope}
                      </span>
                    )}

                    {/* Content text */}
                    <div className="flex-1 min-w-0 leading-relaxed">
                      {renderInlineFormatting(item.text || '')}
                    </div>

                    {/* Pull Request Badge */}
                    {item.prUrl && (
                      <button
                        type="button"
                        onClick={() => handleOpenExternal(item.prUrl!)}
                        title="View Pull Request on GitHub"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 bg-slate-200/50 hover:bg-blue-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-300/60 dark:border-slate-700 transition-colors cursor-pointer shrink-0 ml-1.5"
                      >
                        <GitPullRequest className="w-2.5 h-2.5" />
                        <span>#{item.prNumber || 'PR'}</span>
                      </button>
                    )}

                    {/* Contributor Mention */}
                    {item.author && !item.prUrl && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium shrink-0 ml-1.5">
                        {item.author}
                      </span>
                    )}
                  </div>
                )
              }

              if (item.type === 'quote') {
                return (
                  <div
                    key={item.id}
                    className="border-l-2 border-blue-500/60 pl-3 py-1 my-1.5 text-xs text-slate-600 dark:text-slate-400 italic bg-blue-50/40 dark:bg-blue-950/20 rounded-r-lg"
                  >
                    {renderInlineFormatting(item.text || '')}
                  </div>
                )
              }

              if (item.type === 'code_block') {
                return (
                  <pre
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto my-1.5 select-text leading-relaxed"
                  >
                    <code>{item.code}</code>
                  </pre>
                )
              }

              if (item.type === 'divider') {
                return (
                  <hr
                    key={item.id}
                    className="border-t border-slate-200 dark:border-slate-800/80 my-2"
                  />
                )
              }

              // Paragraph
              return (
                <p key={item.id} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {renderInlineFormatting(item.text || '')}
                </p>
              )
            })}

            {/* Bottom Full Changelog Link */}
            {fullChangelogUrl && (
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Full commit changes on GitHub</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenExternal(fullChangelogUrl)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Compare full changelog</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
