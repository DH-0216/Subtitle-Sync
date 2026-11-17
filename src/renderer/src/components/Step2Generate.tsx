import React, { useState, useEffect } from 'react'
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Music,
  Sliders,
  ChevronDown,
  Languages,
  RefreshCw,
  FileCode
} from 'lucide-react'
import { AudioTrack, SubtitleTrack } from './Step1Video'
import { TipMessage } from './TipMessage'
import { StepCard } from './common/StepCard'

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
  deleteSourceAfter?: boolean
  language: string
  modelQuality: string
  format: 'srt' | 'vtt'
  threads?: number
  temperature?: number
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
  isGenerating?: boolean
  subtitleTracks?: SubtitleTrack[]
  onSwitchToTranslate?: () => void
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
  isGenerating = false,
  subtitleTracks = [],
  onSwitchToTranslate
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isTipDismissed, setIsTipDismissed] = useState(false)

  // Reset tip dismissal if a different movie is loaded
  useEffect(() => {
    setIsTipDismissed(false)
  }, [videoPath])

  const textSubtitleTracks = subtitleTracks.filter((t) => t.isText)

  const currentTrackIndex = selectedTrack !== null ? selectedTrack : (audioTracks[0]?.index ?? 0)
  const currentTrack = audioTracks.find((t) => t.index === currentTrackIndex) || audioTracks[0]
  const currentTrackLang = currentTrack?.language ? currentTrack.language.toUpperCase() : 'Audio'

  const subtitleLanguages = [
    { code: 'original', name: `Movie's Spoken Language (${currentTrackLang})` },
    { code: 'en', name: 'English (Translate Speech to English via Whisper)' },
    { code: 'si', name: 'Sinhala (AI Spoken Sinhala Translation)' }
  ]

  // Model categories for dynamic grouping
  const recommendedModels = availableModels.filter((m) => m.category === 'recommended')
  const standardModels = availableModels.filter((m) => m.category === 'standard' || m.category === 'high_accuracy')
  const englishOnlyModels = availableModels.filter((m) => m.category === 'english_only')
  const quantizedModels = availableModels.filter((m) => m.category === 'quantized')
  const customModels = availableModels.filter((m) => m.category === 'custom')

  const selectedModel = availableModels.find((m) => m.id === config.modelQuality)

  const badge = (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0">
      Whisper AI
    </span>
  )

  const headerRight = videoPath ? (
    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700 whitespace-nowrap shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" /> Video Ready
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 border border-amber-400 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700 whitespace-nowrap shrink-0">
      <AlertCircle className="w-3.5 h-3.5" /> Video Required in Step 1
    </span>
  )

  return (
    <StepCard
      step={2}
      title="Subtitle Generation Settings"
      badge={badge}
      headerRight={headerRight}
    >

      {/* Reusable Tip Banner when movie has embedded subtitles */}
      {!isTipDismissed && textSubtitleTracks.length > 0 && (
        <div className="mb-4">
          <TipMessage
            variant="blue"
            title="Tip:"
            message={
              <>
                Selected movie already has {textSubtitleTracks.length} embedded subtitle track
                {textSubtitleTracks.length === 1 ? '' : 's'}. You can select the{' '}
                <span className="font-bold text-blue-900 dark:text-blue-300">
                  Translate Subtitle
                </span>{' '}
                option to translate existing dialogue directly with AI in seconds instead of
                generating from speech.
              </>
            }
            actionLabel="Switch to Translate Subtitle"
            onAction={onSwitchToTranslate}
            onDismiss={() => setIsTipDismissed(true)}
          />
        </div>
      )}

      {/* Row 1: Video Audio Track & Target Subtitle Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Audio Track Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
            <span>Select Audio Track</span>
          </label>
          <select
            value={currentTrackIndex}
            onChange={(e) => onSelectTrack(Number(e.target.value))}
            disabled={!videoPath || audioTracks.length === 0}
            className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
          >
            {subtitleLanguages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Generated 100% offline using local Whisper AI model on your computer.
          </p>
        </div>
      </div>

      {/* Row 2: Output Format */}
      <div className="mb-4">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
          <FileCode className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>Output Format</span>
        </label>
        <select
          value={config.format}
          onChange={(e) => onChangeConfig({ format: e.target.value as 'srt' | 'vtt' })}
          className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
        >
          <option value="srt">SubRip (.srt) — Universal standard format for media players</option>
          <option value="vtt">WebVTT (.vtt) — Modern web-based video player format</option>
        </select>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Standard SubRip (.srt) is universally supported by all media players and TV devices.
        </p>
      </div>

      {/* Row 3: Advanced Whisper Settings */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-bold text-slate-700 hover:text-blue-700 dark:text-slate-300 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
          <span>
            Advanced Whisper Settings (Model:{' '}
            <span className="uppercase text-blue-700 dark:text-blue-400">
              {config.modelQuality}
            </span>
            )
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              showAdvanced ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAdvanced && (
          <div className="mt-3.5 space-y-4 p-4 rounded-xl border border-app-card-inner-border bg-app-card-inner">
            {/* Model Quality Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                  <span>Whisper AI Model</span>
                </label>
                {onRefreshModels && (
                  <button
                    type="button"
                    onClick={onRefreshModels}
                    disabled={isLoadingModels}
                    className="text-[11px] text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                    <span>Check Models</span>
                  </button>
                )}
              </div>

              <select
                value={config.modelQuality}
                onChange={(e) => onChangeConfig({ modelQuality: e.target.value })}
                className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 cursor-pointer"
              >
                {recommendedModels.length > 0 && (
                  <optgroup label="⭐ Recommended Models">
                    {recommendedModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'} {m.speedHint ? `• ${m.speedHint}` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}

                {standardModels.length > 0 && (
                  <optgroup label="📦 Standard Multi-lingual Models">
                    {standardModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
                      </option>
                    ))}
                  </optgroup>
                )}

                {englishOnlyModels.length > 0 && (
                  <optgroup label="🇬🇧 English-Only Optimized (.en)">
                    {englishOnlyModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
                      </option>
                    ))}
                  </optgroup>
                )}

                {quantizedModels.length > 0 && (
                  <optgroup label="⚡ Quantized Fast (Q5/Q8)">
                    {quantizedModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.sizeFormatted}) — {m.isDownloaded ? '✓ Downloaded' : '☁ Needs Download'}
                      </option>
                    ))}
                  </optgroup>
                )}

                {customModels.length > 0 && (
                  <optgroup label="📁 Custom Local Models">
                    {customModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.sizeFormatted}) — Local
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Selected Model Status Card */}
              {selectedModel && (
                <div className="p-3 rounded-lg border border-app-card-inner-border bg-app-input text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedModel.isDownloaded
                          ? 'bg-emerald-500'
                          : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedModel.isDownloaded ? 'Model Ready Locally' : 'Model will auto-download on first use'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Size: {selectedModel.sizeFormatted}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </StepCard>
  )
}
