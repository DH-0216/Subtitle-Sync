import React, { useState } from 'react'
import { Cpu, FileText, CheckCircle2, AlertCircle, Music, Sliders, ChevronDown, Languages } from 'lucide-react'
import { AudioTrack } from './Step1Video'

export interface GenerateConfig {
  language: string
  modelQuality: 'tiny' | 'base' | 'small' | 'medium'
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
}

export const Step2Generate: React.FC<Step2GenerateProps> = ({
  videoPath,
  selectedTrack,
  audioTracks,
  onSelectTrack,
  config,
  onChangeConfig,
  isOnline = true
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const currentTrackIndex = selectedTrack !== null ? selectedTrack : (audioTracks[0]?.index ?? 0)
  const currentTrack = audioTracks.find((t) => t.index === currentTrackIndex) || audioTracks[0]
  const currentTrackLang = currentTrack?.language ? currentTrack.language.toUpperCase() : 'Audio'

  const subtitleLanguages = [
    { code: 'original', name: `Movie's Language (${currentTrackLang})` },
    { code: 'en', name: 'English' },
    { code: 'si', name: 'Spoken Sinhala (කථන සිංහල)' }
  ]

  return (
    <div className="bg-white dark:bg-slate-900/60 border-2 border-blue-200/90 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm shadow-blue-500/10 dark:shadow-md dark:shadow-black/20 hover:border-blue-300 dark:hover:border-slate-700/70 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-blue-100/80 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shadow-blue-600/30">
            2
          </span>
          <h2 className="font-bold text-blue-950 dark:text-slate-100 text-xs tracking-wider uppercase">
            Subtitle Generation Settings
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/20">
            Speech-to-Text
          </span>
        </div>

        {videoPath ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full dark:border-emerald-500/25">
            <CheckCircle2 className="w-3.5 h-3.5" /> Video Ready
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full dark:border-amber-500/25">
            <AlertCircle className="w-3.5 h-3.5" /> Video required in Step 1
          </span>
        )}
      </div>

      {/* Row 1: Select Audio Track & Target Subtitle Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Select Audio Track */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Select Audio Track</span>
          </label>
          <select
            value={currentTrackIndex}
            onChange={(e) => onSelectTrack(Number(e.target.value))}
            disabled={!videoPath || audioTracks.length === 0}
            className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Target Subtitle Language */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Subtitle Language</span>
          </label>
          <select
            value={config.language}
            onChange={(e) => onChangeConfig({ language: e.target.value })}
            className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
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
              <span>Requires an active internet connection &amp; AI API Key (configured in Settings).</span>
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

      {/* Row 2: Output Format */}
      <div className="space-y-1.5 mb-4">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Output Format</span>
        </label>
        <select
          value={config.format}
          onChange={(e) => onChangeConfig({ format: e.target.value as 'srt' | 'vtt' })}
          className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
        >
          <option value="srt">SubRip (.srt) — Universal standard format for media players</option>
          <option value="vtt">WebVTT (.vtt) — Web & HTML5 video standard format</option>
        </select>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Standard SubRip (.srt) is universally supported by all media players and TV devices.
        </p>
      </div>

      {/* Row 3: Advanced Settings Toggle */}
      <div className="pt-3.5 border-t border-blue-100/80 dark:border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors cursor-pointer select-none"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Advanced Settings</span>
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
          <div className="mt-3 p-3.5 rounded-xl bg-blue-50/60 dark:bg-slate-800/50 border border-blue-200/80 dark:border-slate-700/80 space-y-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Whisper AI Model Quality</span>
              </label>
              <select
                value={config.modelQuality}
                onChange={(e) => onChangeConfig({ modelQuality: e.target.value as any })}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-blue-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
              >
                <option value="base">Base (⚡ Recommended — 3x to 4x Faster, ~140 MB)</option>
                <option value="small">Small (High Precision for Complex Accents, ~460 MB)</option>
                <option value="tiny">Tiny (⚡⚡ Blazing Fast, Lowest RAM, ~75 MB)</option>
                <option value="medium">Medium (Maximum Accuracy, Heavy ~1.5 GB)</option>
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ⚡ <strong>Speed Tip:</strong> Selecting <strong>Base</strong> is 3x to 4x faster on your CPU while maintaining high speech accuracy for movie dialogue. Use <strong>Small</strong> for rare dialects or difficult background noise.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
