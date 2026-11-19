import React from 'react'
import {
  Eye,
  EyeOff,
  ClipboardPaste,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Languages,
  RotateCcw,
  Check,
  Save,
  FileCheck
} from 'lucide-react'
import { AiProviderId, AI_PROVIDER_LIST, getAiProvider } from '@shared/aiModels'
import { TRANSLATION_LANGUAGES, getLanguageConfig } from '@shared/translationPrompts'
import { AiModelSelector, LanguageSelector, ToggleSwitch } from '../common'

export interface SettingsAiTabProps {
  draftProvider: AiProviderId
  onChangeProvider: (p: AiProviderId) => void
  draftApiKey: string
  onChangeApiKey: (k: string) => void
  showKey: boolean
  onToggleShowKey: () => void
  onPasteApiKey: () => void
  onVerifyKey: () => void
  isVerifyingKey: boolean
  verifyStatus: { valid: boolean; message: string } | null
  draftModel: string
  onChangeModel: (m: string) => void
  availableModels: Array<{ id: string; name: string }>
  isLoadingModels: boolean
  onFetchModels: () => void
  draftPrompt: string
  onChangePrompt: (p: string) => void
  selectedPromptLang: string
  onChangePromptLang: (code: string) => void
  onResetPrompt: () => void
  saveBridgeFile?: boolean
  onToggleSaveBridgeFile?: (s: boolean) => void
  onSaveAiSettings: () => void
  savedSuccess: boolean
  onOpenKeyPortal: (url: string) => void
}

export const SettingsAiTab: React.FC<SettingsAiTabProps> = ({
  draftProvider,
  onChangeProvider,
  draftApiKey,
  onChangeApiKey,
  showKey,
  onToggleShowKey,
  onPasteApiKey,
  onVerifyKey,
  isVerifyingKey,
  verifyStatus,
  draftModel,
  onChangeModel,
  availableModels,
  isLoadingModels,
  onFetchModels,
  draftPrompt,
  onChangePrompt,
  selectedPromptLang,
  onChangePromptLang,
  onResetPrompt,
  saveBridgeFile = false,
  onToggleSaveBridgeFile,
  onSaveAiSettings,
  savedSuccess,
  onOpenKeyPortal
}) => {
  const currentLangConfig = getLanguageConfig(selectedPromptLang)

  return (
    <>
      {/* AI API Provider & Key Card */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3.5 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-app-text">
              AI Subtitle Translation API
            </h3>
            <p className="text-xs text-app-text-muted mt-0.5">
              Used for translating generated subtitles into languages like Spoken Sinhala
            </p>
          </div>

          <select
            value={draftProvider}
            onChange={(e) => onChangeProvider(e.target.value as AiProviderId)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-app-input-border bg-app-input text-app-input-text cursor-pointer"
          >
            {AI_PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-app-text">
            <label>{getAiProvider(draftProvider).label}</label>

            {getAiProvider(draftProvider).portalUrl && (
              <button
                type="button"
                onClick={() => onOpenKeyPortal(getAiProvider(draftProvider).portalUrl)}
                className="text-[11px] text-app-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{getAiProvider(draftProvider).portalLabel || 'Get API key'} ↗</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={getAiProvider(draftProvider).keyPlaceholder}
                value={draftApiKey}
                onChange={(e) => onChangeApiKey(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-app-input-border bg-app-input text-app-input-text font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
              <button
                type="button"
                onClick={onToggleShowKey}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text cursor-pointer p-1"
                title={showKey ? 'Hide Key' : 'Show Key'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={onPasteApiKey}
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-app-accent" />
              <span>Paste</span>
            </button>

            <button
              type="button"
              onClick={onVerifyKey}
              disabled={isVerifyingKey || !draftApiKey.trim()}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 ${
                verifyStatus?.valid
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : verifyStatus?.valid === false
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    : 'border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text'
              }`}
              title="Verify API key with provider"
            >
              {isVerifyingKey ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-app-accent" />
                  <span>Verifying...</span>
                </>
              ) : verifyStatus?.valid ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Valid</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-app-accent" />
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>

          {verifyStatus && (
            <div
              className={`text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                verifyStatus.valid
                  ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              {verifyStatus.valid ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{verifyStatus.message}</span>
            </div>
          )}

          {/* Choose AI Model */}
          <div className="space-y-1.5 pt-2 border-t border-app-card-inner-border">
            <AiModelSelector
              provider={draftProvider}
              value={draftModel}
              onChange={onChangeModel}
              availableModels={availableModels}
              isLoading={isLoadingModels}
              onRefresh={onFetchModels}
              showLabel={true}
              disabled={!draftApiKey.trim()}
              size="md"
            />
            {availableModels.length === 0 && (
              <p className="text-[10px] text-app-text-muted">
                Tip: Click &quot;Fetch Models&quot; or &quot;Verify&quot; to auto-load all current models
                from {getAiProvider(draftProvider).company}.
              </p>
            )}
          </div>

          {getAiProvider(draftProvider).notice && (
            <p className="text-[10px] text-app-text-muted">
              {getAiProvider(draftProvider).notice}
            </p>
          )}
        </div>
      </div>

      {/* Intermediate English Subtitles (Bridge Files) Card */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-2.5 transition-colors">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-app-text flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-app-accent" />
              Save Intermediate English Subtitle (Bridge File)
            </h3>
            <p className="text-xs text-app-text-muted mt-0.5">
              When translating videos to Sinhala, Tamil, Hindi, or Spanish, keep the intermediate English subtitle file created by Whisper speech recognition instead of deleting it.
            </p>
          </div>

          <ToggleSwitch
            checked={Boolean(saveBridgeFile)}
            onChange={(checked) => onToggleSaveBridgeFile?.(checked)}
            title="Toggle saving intermediate bridge subtitles"
          />
        </div>
        <p className="text-[11px] text-app-text-muted pt-2 border-t border-app-card-inner-border">
          💡 <strong>How it works:</strong> Video speech is first transcribed into English before the AI translates it into your chosen language. When this setting is ON, you get both files side-by-side: the English subtitle (<code className="font-mono text-[10px]">.english.generated.srt</code>) and your translated subtitle.
        </p>
      </div>

      {/* Custom Translation Prompt & Rules Card */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3.5 transition-colors">
        {/* Language Selector Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-app-card-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-app-text flex items-center gap-1.5">
                <span>Target Language</span>
              </h3>
              <p className="text-[11px] text-app-text-muted">
                Configure prompt instructions and colloquial rules per language
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSelector
              mode="translate"
              value={selectedPromptLang}
              onChange={onChangePromptLang}
              size="sm"
            />
          </div>
        </div>

        {/* Active Language Prompt Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-bold text-sm text-app-text flex items-center gap-1.5">
              <span>
                {currentLangConfig.name} ({currentLangConfig.nativeName}) Prompt & Rules
              </span>
            </h4>
            <p className="text-xs text-app-text-muted mt-0.5">
              {currentLangConfig.description}
            </p>
          </div>

          <button
            type="button"
            onClick={onResetPrompt}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            title={`Reset ${currentLangConfig.name} prompt to default`}
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="relative">
          <textarea
            rows={7}
            value={draftPrompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            placeholder={`Enter custom AI translation instructions and rules for ${currentLangConfig.name}...`}
            className="w-full p-3 text-xs rounded-xl border border-app-input-border bg-app-input text-app-input-text font-sans leading-relaxed resize-y focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {currentLangConfig.badges.map((badge, idx) => {
            const badgeStyles = [
              'bg-app-accent-bg text-app-accent border-app-accent-border',
              'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
              'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20',
              'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20'
            ]
            const styleClass = badgeStyles[idx % badgeStyles.length]
            return (
              <span
                key={badge}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${styleClass}`}
              >
                {badge}
              </span>
            )
          })}
        </div>
      </div>

      {/* Save Button for AI Translation Section */}
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onSaveAiSettings}
          className="px-5 py-2 rounded-xl bg-app-primary hover:bg-app-primary-hover text-app-primary-fg font-semibold text-xs transition-all shadow-2xs active:scale-[0.99] flex items-center gap-1.5 cursor-pointer"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-200" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </>
  )
}
