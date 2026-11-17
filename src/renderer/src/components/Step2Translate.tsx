import React from 'react'
import { Languages, Key, Settings, CheckCircle2, FileCode } from 'lucide-react'
import { StepCard } from './common/StepCard'

interface Step2TranslateProps {
  language: string
  onChangeLanguage: (lang: string) => void
  format: 'srt' | 'vtt' | 'txt'
  onChangeFormat: (fmt: 'srt' | 'vtt' | 'txt') => void
  aiApiKey: string
  aiProvider: string
  aiModel: string
  onOpenSettings: () => void
  isOnline?: boolean
}

export const translationLanguages = [
  { code: 'si', name: 'Sinhala (Spoken Sinhala dialogue - AI Optimized)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'zh', name: 'Chinese (中文)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)' },
  { code: 'th', name: 'Thai (ไทย)' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
  { code: 'sv', name: 'Swedish (Svenska)' }
]

export const Step2Translate: React.FC<Step2TranslateProps> = ({
  language,
  onChangeLanguage,
  format,
  onChangeFormat,
  aiApiKey,
  aiProvider,
  aiModel,
  onOpenSettings
}) => {
  const isKeyConfigured = Boolean(aiApiKey && aiApiKey.trim().length > 0)

  const badge = (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-app-card-inner-hover text-app-text border-app-card-inner-border whitespace-nowrap shrink-0">
      Cloud AI
    </span>
  )

  const headerRight = isKeyConfigured ? (
    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-400 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full dark:border-emerald-700 whitespace-nowrap shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" /> AI Ready
    </span>
  ) : (
    <button
      type="button"
      onClick={onOpenSettings}
      className="flex items-center gap-1.5 text-xs font-bold text-amber-950 bg-amber-100 border border-amber-400 dark:text-amber-300 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full dark:border-amber-700 whitespace-nowrap shrink-0 hover:bg-amber-200 transition-colors cursor-pointer"
      title="Click to enter your AI API key in Settings"
    >
      <Key className="w-3.5 h-3.5" /> API Key Required
    </button>
  )

  return (
    <StepCard
      step={2}
      title="AI Translation Settings"
      badge={badge}
      headerRight={headerRight}
    >
      <div className="space-y-4">
        {/* Row 1: Target Language & Output Format */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-app-text flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Target Subtitle Language</span>
            </label>
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value)}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
            >
              {translationLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-app-text-muted">
              {language === 'si'
                ? 'Translates into natural Sinhala dialogue while preserving formatting and cue timestamps.'
                : 'Directly translates dialogues into your target language using your configured AI model.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-app-text flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>Output Format</span>
            </label>
            <select
              value={format}
              onChange={(e) => onChangeFormat(e.target.value as 'srt' | 'vtt' | 'txt')}
              className="w-full text-xs font-medium px-3 py-2.5 rounded-xl border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-700/30 transition-all cursor-pointer"
            >
              <option value="srt">SubRip (.srt) — Universal standard for media players</option>
              <option value="vtt">WebVTT (.vtt) — Web video standard</option>
              <option value="txt">Plain Text (.txt) — Dialogue script without timestamps</option>
            </select>
            <p className="text-[11px] text-app-text-muted">
              Standard SubRip (.srt) is universally supported by VLC, TV devices, and media centers.
            </p>
          </div>
        </div>

        {/* Prompt to configure API Key if not yet configured */}
        {!isKeyConfigured && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 flex items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2.5 text-xs">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 flex items-center justify-center font-bold text-[10px] uppercase">
                {aiProvider.substring(0, 3)}
              </div>
              <div>
                <p className="font-bold text-app-text flex items-center gap-2">
                  <span>AI Provider: {aiProvider.toUpperCase()}</span>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.2 rounded-full bg-app-card-inner-hover text-app-text-muted">
                    {aiModel || 'default model'}
                  </span>
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                  API Key missing. Enter your key to start translation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-app-btn-text" />
              <span>Configure AI Settings</span>
            </button>
          </div>
        )}
      </div>
    </StepCard>
  )
}
