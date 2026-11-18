import React, { useState, useEffect } from 'react'
import {
  CheckCircle2,
  AlertCircle,
  Music,
  Sliders,
  ChevronDown,
  FileCode
} from 'lucide-react'
import { AudioTrack, SubtitleTrack } from './Step1Video'
import { TipMessage } from './TipMessage'
import { StepCard, LanguageSelector, WhisperModelSelector } from './common'

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

  const selectedModel = availableModels.find((m) => m.id === config.modelQuality)

  const badge = (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-app-card-inner-hover text-app-text border-app-card-inner-border whitespace-nowrap shrink-0">
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
          <label className="text-xs font-bold text-app-text flex items-center gap-1.5">
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
          <p className="text-[11px] text-app-text-muted">
            Choose the speech audio stream to transcribe.
          </p>
        </div>

        {/* Subtitle Target Language for Video */}
        <div className="space-y-1.5">
          <LanguageSelector
            mode="generate"
            value={config.language}
            onChange={(language) => onChangeConfig({ language })}
            currentAudioTrackLang={currentTrackLang}
            showLabel={true}
            size="md"
          />
          <p className="text-[11px] text-app-text-muted">
            Generated 100% offline using local Whisper AI model on your computer.
          </p>
        </div>
      </div>

      {/* Row 2: Output Format */}
      <div className="mb-4">
        <label className="text-xs font-bold text-app-text flex items-center gap-1.5 mb-1.5">
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
        <p className="text-[11px] text-app-text-muted mt-1">
          Standard SubRip (.srt) is universally supported by all media players and TV devices.
        </p>
      </div>

      {/* Row 3: Advanced Whisper Settings */}
      <div className="pt-2 border-t border-app-card-inner-border">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-bold text-app-text hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <WhisperModelSelector
                value={config.modelQuality}
                onChange={(modelQuality) => onChangeConfig({ modelQuality })}
                availableModels={availableModels}
                isLoading={isLoadingModels}
                onRefresh={onRefreshModels}
                showLabel={true}
                disabled={isGenerating}
                size="md"
              />

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
                    <span className="font-semibold text-app-text">
                      {selectedModel.isDownloaded ? 'Model Ready Locally' : 'Model will auto-download on first use'}
                    </span>
                  </div>
                  <span className="text-[11px] text-app-text-muted font-mono">
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
