import React, { useState, useEffect } from 'react'
import {
  Cpu,
  FileText,
  CheckCircle2,
  AlertCircle,
  Music,
  Sliders,
  ChevronDown,
  Languages,
  RefreshCw,
  HardDrive,
  CloudDownload,
  Sparkles,
  FolderOpen,
  Mic,
  Zap,
  Loader2
} from 'lucide-react'
import { AudioTrack, SubtitleTrack } from './Step1Video'
import { ExtractedFileItem } from './Step3Extract'

export interface WhisperModelItem {
  id: string
  filename: string
  name: string
  label: string
  sizeBytes: number
  sizeFormatted: string
  description: string
  category: 'recommended' | 'standard' | 'high_accuracy' | 'quantized' | 'english_only' | 'custom'
  isDownloaded: boolean
  localPath: string | null
  speedHint?: string
  isRecommended?: boolean
}

export interface GenerateConfig {
  sourceType: 'video' | 'subtitle'
  sourceSubPath: string | null
  language: string
  modelQuality: string
  format: 'srt' | 'vtt'
}

interface Step2GenerateProps {
  videoPath: string | null
  selectedTrack: number | null
  audioTracks: AudioTrack[]
  onSelectTrack: (trackIndex: number) => void
  config: GenerateConfig
  onChangeConfig: (newConfig: Partial<GenerateConfig>) => void
  isOnline?: boolean
  availableModels?: WhisperModelItem[]
  isLoadingModels?: boolean
  onRefreshModels?: () => void
  modelsSource?: 'remote' | 'cached' | 'fallback'
  extractedFiles?: ExtractedFileItem[]
  onBrowseSubtitle?: () => void
  subtitleTracks?: SubtitleTrack[]
  onExtractAndUseSubtitle?: (track: SubtitleTrack) => Promise<void> | void
  isExtracting?: boolean
  isGenerating?: boolean
}

export const Step2Generate: React.FC<Step2GenerateProps> = ({
  videoPath,
  selectedTrack,
  audioTracks,
  onSelectTrack,
  config,
  onChangeConfig,
  isOnline = true,
  availableModels = [],
  isLoadingModels = false,
  onRefreshModels,
  modelsSource = 'fallback',
  extractedFiles = [],
  onBrowseSubtitle,
  subtitleTracks = [],
  onExtractAndUseSubtitle,
  isExtracting = false,
  isGenerating = false
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const textSubtitleTracks = subtitleTracks.filter((t) => t.isText)
  const [selectedEmbeddedTrackIndex, setSelectedEmbeddedTrackIndex] = useState<number>(
    textSubtitleTracks[0]?.index ?? 0
  )

  // Keep selected embedded track updated if tracks change
  useEffect(() => {
    if (textSubtitleTracks.length > 0 && !textSubtitleTracks.some((t) => t.index === selectedEmbeddedTrackIndex)) {
      setSelectedEmbeddedTrackIndex(textSubtitleTracks[0].index)
    }
  }, [subtitleTracks])

  const isSubtitleSource = config.sourceType === 'subtitle'
  const currentTrackIndex = selectedTrack !== null ? selectedTrack : (audioTracks[0]?.index ?? 0)
  const currentTrack = audioTracks.find((t) => t.index === currentTrackIndex) || audioTracks[0]
  const currentTrackLang = currentTrack?.language ? currentTrack.language.toUpperCase() : 'Audio'

  const subtitleLanguages = isSubtitleSource
    ? [
        { code: 'si', name: 'Spoken Sinhala (කථන සිංහල) — AI Translation' },
        { code: 'en', name: 'English (Original Text formatting)' }
      ]
    : [
        { code: 'original', name: `Movie's Language (${currentTrackLang})` },
        { code: 'en', name: 'English' },
        { code: 'si', name: 'Spoken Sinhala (කථන සිංහල)' }
      ]

  // Model categories for dynamic grouping
  const recommendedModels = availableModels.filter((m) => m.category === 'recommended')
  const standardModels = availableModels.filter((m) => m.category === 'standard' || m.category === 'high_accuracy')
  const englishOnlyModels = availableModels.filter((m) => m.category === 'english_only')
  const quantizedModels = availableModels.filter((m) => m.category === 'quantized')
  const customModels = availableModels.filter((m) => m.category === 'custom')

  const selectedModel = availableModels.find((m) => m.id === config.modelQuality)
  const sourceFileName = config.sourceSubPath ? config.sourceSubPath.split(/[\/\\]/).pop() : null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-800 dark:bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            2
          </span>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-xs tracking-wider uppercase">
            {isSubtitleSource ? 'Subtitle Translation Settings' : 'Subtitle Generation Settings'}
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
            {isSubtitleSource ? 'AI Fast Translation' : 'Speech-to-Text Whisper AI'}
          </span>
        </div>

        {isSubtitleSource ? (
          config.sourceSubPath ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Subtitle Selected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 border border-amber-400 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700">
              <AlertCircle className="w-3.5 h-3.5" /> Choose Subtitle Below
            </span>
          )
        ) : videoPath ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Video Ready
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 border border-amber-400 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700">
            <AlertCircle className="w-3.5 h-3.5" /> Video required in Step 1
          </span>
        )}
      </div>

      {/* Generation Source Toggle: Video Audio vs Subtitle File */}
      <div className="mb-4">
        <label className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-1.5">
          Generation &amp; Translation Source:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1 bg-slate-200/70 dark:bg-slate-800/60 rounded-xl border border-slate-300 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onChangeConfig({ sourceType: 'video' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              !isSubtitleSource
                ? 'bg-blue-800 text-white dark:bg-blue-600 shadow-xs'
                : 'text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Generate from Speech (Speech to Text)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeConfig({ sourceType: 'subtitle', language: 'si' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isSubtitleSource
                ? 'bg-blue-800 text-white dark:bg-blue-600 shadow-xs'
                : 'text-slate-800 dark:text-slate-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Translate Existing Subtitle (.SRT)</span>
          </button>
        </div>
      </div>

      {/* Row 1: Source Specific Input */}
      {isSubtitleSource ? (
        /* Subtitle File Source Controls */
        <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] mb-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>Select Subtitle File to Translate</span>
            </span>

            {sourceFileName && (
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Translation
              </span>
            )}
          </div>

          {/* Option A: Embedded Subtitle Detected in Selected Movie */}
          {textSubtitleTracks.length > 0 ? (
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/30 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-blue-950 dark:text-blue-100">
                    Embedded Subtitles Detected in Movie ({textSubtitleTracks.length})
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                  No external .SRT required
                </span>
              </div>

              <p className="text-[11px] text-blue-900/80 dark:text-blue-300/80 leading-relaxed">
                This movie already contains embedded text subtitles. Extract and use it directly for AI translation:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-0.5">
                <select
                  value={selectedEmbeddedTrackIndex}
                  onChange={(e) => setSelectedEmbeddedTrackIndex(Number(e.target.value))}
                  disabled={isExtracting}
                  className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 cursor-pointer disabled:opacity-60"
                >
                  {textSubtitleTracks.map((t) => (
                    <option key={t.index} value={t.index}>
                      Track #{t.index + 1}: {t.language.toUpperCase()} ({t.codec}){t.title ? ` - ${t.title}` : ''}{t.isDefault ? ' [Default]' : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    const trk = textSubtitleTracks.find((t) => t.index === selectedEmbeddedTrackIndex) || textSubtitleTracks[0]
                    if (trk && onExtractAndUseSubtitle) {
                      onExtractAndUseSubtitle(trk)
                    }
                  }}
                  disabled={isExtracting || isGenerating}
                  className="px-4 py-2 rounded-xl bg-blue-800 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
                  title="Extract this embedded subtitle track and start AI translation immediately"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting Track...</span>
                    </>
                  ) : isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Translating with AI...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Extract &amp; Translate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : videoPath ? (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
              <span>No embedded text subtitles found in this movie. Please choose or browse an external .SRT file below.</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
              <span>Tip: If you select a movie in Step 1, its embedded subtitles will be detected automatically here.</span>
            </div>
          )}

          {/* Divider if embedded tracks exist */}
          {textSubtitleTracks.length > 0 && (
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Or Use Existing .SRT File
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
          )}

          {/* Option B: Quick select from previously extracted files if any exist */}
          {extractedFiles.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Choose from previously extracted tracks:
              </label>
              <select
                value={config.sourceSubPath || ''}
                onChange={(e) => onChangeConfig({ sourceSubPath: e.target.value || null })}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 cursor-pointer"
              >
                <option value="">-- Choose an extracted subtitle track --</option>
                {extractedFiles.map((f, idx) => (
                  <option key={idx} value={f.outputPath}>
                    Subtitle Track #{f.trackIndex}: {f.fileName} ({f.language?.toUpperCase() || 'SRT'}{f.cuesCount ? ` • ${f.cuesCount} cues` : ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Option C: Selected file display & Browse custom .SRT */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
              <div className="min-w-0 flex-1">
                {sourceFileName ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={config.sourceSubPath || ''}>
                      {sourceFileName}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded shrink-0">
                      Active
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                    No subtitle file selected yet. Extract an embedded track above or browse below.
                  </p>
                )}
              </div>
            </div>

            {onBrowseSubtitle && (
              <button
                type="button"
                onClick={onBrowseSubtitle}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-blue-700 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-2xs"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Browse .SRT...</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Directly translates dialogues into spoken Sinhala in ~10–20 seconds without re-processing video audio.
          </p>
        </div>
      ) : (
        /* Video Audio Track Selector */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Select Audio Track</span>
            </label>
            <select
              value={currentTrackIndex}
              onChange={(e) => onSelectTrack(Number(e.target.value))}
              disabled={!videoPath || audioTracks.length === 0}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {audioTracks.length > 0 ? (
                audioTracks.map((t) => (
                  <option key={t.index} value={t.index}>
                    Track #{t.index}: {t.language ? t.language.toUpperCase() : 'UNKNOWN'} {t.title ? `- ${t.title} ` : ''}({t.codec?.toUpperCase() || 'AUDIO'}{t.channels ? `, ${t.channels}ch` : ''})
                  </option>
                ))
              ) : (
                <option value={0}>Track #0: Default Audio Track</option>
              )}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Choose the speech audio stream to transcribe.
            </p>
          </div>

          {/* Subtitle Target Language for Video */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Target Subtitle Language</span>
            </label>
            <select
              value={config.language}
              onChange={(e) => onChangeConfig({ language: e.target.value })}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
            >
              {subtitleLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            {config.language === 'si' && !isOnline ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5 pt-0.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                <span>Requires internet &amp; AI API Key (configured in Settings).</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {config.language === 'si'
                  ? 'Translates speech dialogue into natural spoken Sinhala using your configured AI model.'
                  : 'Generated 100% offline using local Whisper AI model on your computer.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Target Language when in Subtitle File mode */}
      {isSubtitleSource && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Target Subtitle Language</span>
            </label>
            <select
              value={config.language}
              onChange={(e) => onChangeConfig({ language: e.target.value })}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
            >
              {subtitleLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Output Format</span>
            </label>
            <select
              value={config.format}
              onChange={(e) => onChangeConfig({ format: e.target.value as 'srt' | 'vtt' })}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
            >
              <option value="srt">SubRip (.srt) — Universal standard format for media players</option>
              <option value="vtt">WebVTT (.vtt) — Web & HTML5 video standard format</option>
            </select>
          </div>
        </div>
      )}

      {/* Row 2: Output Format (for video source) */}
      {!isSubtitleSource && (
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Output Format</span>
          </label>
          <select
            value={config.format}
            onChange={(e) => onChangeConfig({ format: e.target.value as 'srt' | 'vtt' })}
            className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
          >
            <option value="srt">SubRip (.srt) — Universal standard format for media players</option>
            <option value="vtt">WebVTT (.vtt) — Web & HTML5 video standard format</option>
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Standard SubRip (.srt) is universally supported by all media players and TV devices.
          </p>
        </div>
      )}

      {/* Row 3: Advanced Settings (Whisper Model Quality) - shown when Video Source */}
      {!isSubtitleSource && (
        <div className="pt-3.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-800 dark:text-slate-300 dark:hover:text-blue-400 transition-colors cursor-pointer select-none"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Advanced Whisper Settings</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
              (Model: {config.modelQuality.toUpperCase()})
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                showAdvanced ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                    <span>Whisper AI Model</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          modelsSource === 'remote' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {modelsSource === 'remote' ? 'Hugging Face Live' : 'Hugging Face Catalog'}
                    </span>
                    {onRefreshModels && (
                      <button
                        type="button"
                        onClick={onRefreshModels}
                        disabled={isLoadingModels}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Fetch latest models from Hugging Face"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isLoadingModels ? 'animate-spin text-blue-700' : ''}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                <select
                  value={config.modelQuality}
                  onChange={(e) => onChangeConfig({ modelQuality: e.target.value })}
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
                >
                  {availableModels.length > 0 ? (
                    <>
                      {recommendedModels.length > 0 && (
                        <optgroup label="Recommended (Fast & High Accuracy)">
                          {recommendedModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.isDownloaded ? '✓ [Ready] ' : '☁ [Download] '}
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {standardModels.length > 0 && (
                        <optgroup label="Standard Multilingual Models">
                          {standardModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.isDownloaded ? '✓ [Ready] ' : '☁ [Download] '}
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {quantizedModels.length > 0 && (
                        <optgroup label="Quantized Models (Low RAM & Small Size)">
                          {quantizedModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.isDownloaded ? '✓ [Ready] ' : '☁ [Download] '}
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {englishOnlyModels.length > 0 && (
                        <optgroup label="English Only Models (Optimized)">
                          {englishOnlyModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.isDownloaded ? '✓ [Ready] ' : '☁ [Download] '}
                              {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {customModels.length > 0 && (
                        <optgroup label="Custom / Local Models">
                          {customModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              ✓ [Local] {m.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      <option value="base">Base (Recommended — Fast &amp; Balanced, ~142 MB)</option>
                      <option value="large-v3-turbo">Large v3 Turbo (State-of-the-art Accuracy, ~1.5 GB)</option>
                      <option value="small">Small (High Precision for Accents, ~466 MB)</option>
                      <option value="tiny">Tiny (Blazing Fast, Lowest RAM, ~75 MB)</option>
                      <option value="medium">Medium (Maximum Accuracy, Heavy ~1.5 GB)</option>
                    </>
                  )}
                </select>

                {/* Dynamic Model Status Card */}
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/70 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {selectedModel?.isDownloaded ? (
                        <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <HardDrive className="w-3.5 h-3.5 shrink-0" />
                          <span>Model downloaded &amp; ready offline</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-blue-800 dark:text-blue-400">
                          <CloudDownload className="w-3.5 h-3.5 shrink-0" />
                          <span>Requires one-time download on first use</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                      {selectedModel?.sizeFormatted || 'AI Model'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedModel?.description ||
                      'Tip: Selecting Base is 3x to 4x faster on your CPU while maintaining high speech accuracy for movie dialogue.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
