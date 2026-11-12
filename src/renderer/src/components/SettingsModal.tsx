import React, { useState, useEffect } from 'react'
import {
  X,
  Settings as SettingsIcon,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Sliders,
  RotateCcw,
  Save,
  Check,
  ClipboardPaste,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { EXTERNAL_LINKS, getGeminiVerifyUrl } from '@shared/links'
import { formatUserFriendlyError } from '@shared/errorUtils'

export const DEFAULT_AI_PROMPT = `You are an expert subtitle translator specializing in natural, authentic spoken colloquial Sinhala (ස්වාභාවික කථාබහ සිංහල) for cinema and movies.
Translate the following movie subtitle lines into natural, spoken Sinhala as people actually speak in day-to-day life.
RULES:
1. Use colloquial spoken Sinhala (කථාබහ කරන බස), NOT formal/bookish written Sinhala (e.g. use "කරනවා", "යනවා", "නෑ/නැහැ", "මොකක්ද", NEVER use "කරන්නේය", "ගියේය", "නැත", "කුමක්ද").
2. Contextual Idioms & Slang: Never translate idioms literally word-for-word (e.g., "give me a hand" -> "මට උදව් කරන්න", "break a leg" -> "වැඩේ හොඳට කරන්න / සුබ පැතුම්", "chill out" -> "කූල් එකේ ඉන්න"). Translate the emotion, intent, and colloquial nuance.
3. Homonym & Context Awareness: Resolve mistranslated homonyms and ambiguous words based on surrounding movie dialogue (e.g., distinguish "fair", "bark", "right", "bear").
4. Character Names & Modern Words: Keep character names, locations, and commonly spoken modern loan words natural.
5. Maintain the exact format "[index] Translated line".
6. Return exactly the same number of numbered lines without dropping any lines.
7. Do not include introductory, markdown formatting or explanatory text.`

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'general' | 'ai'
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  checkUpdates: boolean
  setCheckUpdates: (c: boolean) => void
  aiApiKey: string
  setAiApiKey: (k: string) => void
  aiProvider: 'gemini' | 'openai'
  setAiProvider: (p: 'gemini' | 'openai') => void
  aiModel?: string
  setAiModel?: (m: string) => void
  aiPrompt: string
  setAiPrompt: (p: string) => void
  onSave?: () => void
}

const APP_VERSION = '2.0.0'
const GITHUB_REPO = EXTERNAL_LINKS.REPO_SLUG

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'general',
  theme,
  setTheme,
  checkUpdates,
  setCheckUpdates,
  aiApiKey,
  setAiApiKey,
  aiProvider,
  setAiProvider,
  aiModel = 'gemini-3.8-flash',
  setAiModel,
  aiPrompt,
  setAiPrompt,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>(initialTab)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string>(`Current Version: v${APP_VERSION}`)
  const [updateStatusType, setUpdateStatusType] = useState<'normal' | 'success' | 'warning' | 'error'>('normal')
  const [updateUrl, setUpdateUrl] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Local draft state for AI settings (only committed when user clicks "Save Changes")
  const [draftApiKey, setDraftApiKey] = useState(aiApiKey)
  const [draftProvider, setDraftProvider] = useState<'gemini' | 'openai'>(aiProvider)
  const [draftModel, setDraftModel] = useState(aiModel)
  const [draftPrompt, setDraftPrompt] = useState(aiPrompt)
  const [isVerifyingKey, setIsVerifyingKey] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<{ valid: boolean; message: string } | null>(null)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string }>>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)

  const handleFetchModels = async (provider: 'gemini' | 'openai', key: string, silent: boolean = false) => {
    if (!key.trim()) return
    if (!navigator.onLine) {
      if (!silent) {
        toast.error('You are offline. Connect to the internet to fetch latest models.', { icon: '📡' })
      }
      return
    }
    setIsLoadingModels(true)
    try {
      if (window.api?.ai?.fetchModels) {
        const res = await window.api.ai.fetchModels(provider, key.trim())
        if (res.success && res.models && res.models.length > 0) {
          setAvailableModels(res.models)
          if (!silent) {
            toast.success(`Loaded ${res.models.length} live models!`, { duration: 2500 })
          }
          // If current draftModel isn't in fetched models, select the top one
          const exists = res.models.some((m) => m.id === draftModel)
          if (!exists && res.models[0]) {
            setDraftModel(res.models[0].id)
          }
          return
        }
      }
    } catch (err: any) {
      if (!silent) {
        toast.error('Failed to fetch models: ' + formatUserFriendlyError(err))
      }
    } finally {
      setIsLoadingModels(false)
    }
  }

  // Fetch live models if API key exists whenever modal opens
  useEffect(() => {
    if (isOpen && aiApiKey.trim()) {
      handleFetchModels(aiProvider, aiApiKey.trim(), true)
    }
  }, [isOpen])

  // Reset drafts and tab whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab)
      }
      setDraftApiKey(aiApiKey)
      setDraftProvider(aiProvider)
      setDraftModel(aiModel || (aiProvider === 'openai' ? 'gpt-4o-mini' : 'gemini-3.8-flash'))
      setDraftPrompt(aiPrompt)
      setSavedSuccess(false)
      setVerifyStatus(null)
    }
  }, [isOpen, initialTab, aiApiKey, aiProvider, aiModel, aiPrompt])

  const handleSaveAiSettings = () => {
    const keyChanged = draftApiKey !== aiApiKey
    const promptChanged = draftPrompt !== aiPrompt
    const providerChanged = draftProvider !== aiProvider
    const modelChanged = draftModel !== aiModel

    // 1. Commit to parent state
    setAiApiKey(draftApiKey)
    setAiProvider(draftProvider)
    if (setAiModel) setAiModel(draftModel)
    setAiPrompt(draftPrompt)

    // 2. Persist to encrypted local settings
    window.api?.settings?.save({
      theme,
      check_updates_startup: checkUpdates,
      aiApiKey: draftApiKey,
      aiProvider: draftProvider,
      aiModel: draftModel,
      aiPrompt: draftPrompt
    })

    // 3. User feedback
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2000)

    if (keyChanged && promptChanged) {
      toast.success('API key updated successfully!')
      toast.success('Translation prompt updated successfully!')
    } else if (keyChanged) {
      toast.success('API key updated successfully!')
    } else if (modelChanged) {
      toast.success(`AI Model set to ${draftModel}!`)
    } else if (promptChanged) {
      toast.success('Translation prompt updated successfully!')
    } else if (providerChanged) {
      toast.success('AI provider updated successfully!')
    } else {
      toast.success('AI Translation settings saved!')
    }
  }

  const handlePasteApiKey = async () => {
    try {
      let text = ''
      if (window.api?.clipboard?.readText) {
        text = await window.api.clipboard.readText()
      } else if (navigator?.clipboard?.readText) {
        text = await navigator.clipboard.readText()
      }

      if (text && text.trim().length > 0) {
        setDraftApiKey(text.trim())
        setVerifyStatus(null)
        toast.success('API Key pasted from clipboard!', { duration: 2000 })
      } else {
        toast.error('Clipboard is empty!')
      }
    } catch (err) {
      toast.error('Could not read from clipboard')
    }
  }

  const handleVerifyApiKey = async () => {
    if (!draftApiKey.trim()) {
      toast.error('Please enter an API Key to verify.')
      return
    }

    if (!navigator.onLine) {
      toast.error('You are offline. Connect to the internet to verify your API key.', { icon: '📡' })
      setVerifyStatus({ valid: false, message: 'Offline: Internet connection required to verify API key.' })
      return
    }

    const cleanKey = draftApiKey.trim()
    setIsVerifyingKey(true)
    setVerifyStatus(null)

    try {
      let res: { valid: boolean; message: string; models?: Array<{ id: string; name: string }> }

      if (window.api?.ai?.verifyKey) {
        res = await window.api.ai.verifyKey(draftProvider, cleanKey)
        if (res.valid && res.models && res.models.length > 0) {
          setAvailableModels(res.models)
          const exists = res.models.some((m) => m.id === draftModel)
          if (!exists && res.models[0]) {
            setDraftModel(res.models[0].id)
          }
        }
      } else {
        // Direct browser fetch fallback (works even if Electron process hasn't been restarted yet)
        if (draftProvider === 'gemini') {
          const response = await fetch(getGeminiVerifyUrl(cleanKey))
          if (response.ok) {
            const data = await response.json().catch(() => null)
            const models = (data?.models || [])
              .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m: any) => ({
                id: (m.name || '').replace(/^models\//, ''),
                name: m.displayName ? `${m.displayName} (${(m.name || '').replace(/^models\//, '')})` : (m.name || '').replace(/^models\//, '')
              }))
            if (models.length > 0) {
              setAvailableModels(models)
            }
            res = { valid: true, message: 'Gemini API Key is valid and active!', models }
          } else {
            const data = await response.json().catch(() => null)
            const errMsg = data?.error?.message || `HTTP ${response.status}`
            res = { valid: false, message: `Invalid Gemini Key: ${errMsg}` }
          }
        } else {
          const response = await fetch(EXTERNAL_LINKS.OPENAI_MODELS_API, {
            headers: { Authorization: `Bearer ${cleanKey}` }
          })
          if (response.ok) {
            const data = await response.json().catch(() => null)
            const models = (data?.data || [])
              .filter((m: any) => {
                const id = m.id || ''
                return (id.startsWith('gpt-') || id.startsWith('o1-') || id.startsWith('o3-') || id.startsWith('chatgpt-')) &&
                  !id.includes('instruct') &&
                  !id.includes('realtime') &&
                  !id.includes('audio')
              })
              .map((m: any) => ({ id: m.id, name: m.id }))
            if (models.length > 0) {
              setAvailableModels(models)
            }
            res = { valid: true, message: 'OpenAI API Key is valid and active!', models }
          } else {
            const data = await response.json().catch(() => null)
            const errMsg = data?.error?.message || `HTTP ${response.status}`
            res = { valid: false, message: `Invalid OpenAI Key: ${errMsg}` }
          }
        }
      }

      setVerifyStatus(res)
      if (res.valid) {
        toast.success(res.message, { duration: 3500 })
      } else {
        const friendly = formatUserFriendlyError(res.message)
        toast.error(friendly, { duration: 4500 })
      }
    } catch (err: any) {
      const msg = err.message || 'Verification failed'
      const friendly = formatUserFriendlyError(msg)
      setVerifyStatus({ valid: false, message: friendly })
      toast.error('Verification failed: ' + friendly)
    } finally {
      setIsVerifyingKey(false)
    }
  }

  const handleClose = () => {
    if (onSave) onSave()
    onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onSave])

  if (!isOpen) return null

  const handleToggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    window.api?.settings?.save({
      theme: newTheme,
      check_updates_startup: checkUpdates,
      aiApiKey,
      aiProvider,
      aiPrompt
    })
  }

  const handleToggleAutoUpdate = (enabled: boolean) => {
    setCheckUpdates(enabled)
    window.api?.settings?.save({
      theme,
      check_updates_startup: enabled,
      aiApiKey,
      aiProvider,
      aiPrompt
    })
  }


  const handleCheckNow = async () => {
    if (!navigator.onLine) {
      setUpdateStatus('⚠️ You are offline. Connect to the internet to check for updates.')
      setUpdateStatusType('error')
      toast.error('You are offline. Cannot check for updates.', { icon: '📡' })
      return
    }

    setCheckingUpdate(true)
    setUpdateStatus('Checking GitHub Releases...')
    setUpdateStatusType('normal')

    try {
      const res = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github.v3+json' }
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const latestTag = data.tag_name || ''
      const cleanLatest = latestTag.replace(/^v/, '')
      const cleanCurrent = APP_VERSION.replace(/^v/, '')

      if (cleanLatest && cleanLatest !== cleanCurrent) {
        setUpdateStatus(`Update available: ${latestTag}`)
        setUpdateStatusType('success')
        setUpdateUrl(data.html_url || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE)
      } else {
        setUpdateStatus(`✅ You're on the latest version (v${APP_VERSION})`)
        setUpdateStatusType('success')
        setUpdateUrl(null)
      }
    } catch (e: any) {
      setUpdateStatus('⚠️ No internet connection. Please check your network and try again.')
      setUpdateStatusType('error')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleOpenGitHub = () => {
    const url = EXTERNAL_LINKS.GITHUB_REPO
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleOpenGeminiKey = () => {
    const url = EXTERNAL_LINKS.GEMINI_API_KEY_PORTAL
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url)
    } else {
      window.open(url, '_blank')
    }
  }

  const handleOpenRelease = () => {
    if (!updateUrl) return
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(updateUrl)
    } else {
      window.open(updateUrl, '_blank')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="bg-white dark:bg-[#0B0F19] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[560px] max-h-[90vh] transition-colors">
        {/* Header Row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-[#0B0F19] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                Settings & Preferences
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure application options and AI subtitle translation
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Tabs */}
          <aside className="w-48 sm:w-52 bg-slate-50/70 dark:bg-slate-950/40 border-r border-slate-100 dark:border-slate-800/80 p-3 shrink-0 flex flex-col justify-between">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'general'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ai')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'ai'
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>AI Translation</span>
              </button>
            </div>

            {/* Bottom-left of setting window: Version */}
            <div className="pt-3 px-1 text-left">
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tracking-wide select-none">
                v{APP_VERSION}
              </span>
            </div>
          </aside>

          {/* Right Tab Content Panel */}
          <main className="flex-1 p-5 overflow-y-auto space-y-4">
            {activeTab === 'general' && (
              <>
                {/* Card 1: Appearance Mode */}
                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 flex items-center justify-between transition-colors">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Appearance Mode
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Toggle between Dark and Light interface themes
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    title="Toggle theme"
                  >
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Dark mode
                    </span>
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                        theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>
                </div>

                {/* Card 2: Software Updates */}
                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 space-y-3 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Automatic Updates
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Check for newer versions automatically on startup
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleAutoUpdate(!checkUpdates)}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      title="Toggle auto update"
                    >
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Enabled
                      </span>
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                          checkUpdates ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            checkUpdates ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium truncate ${
                          updateStatusType === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : updateStatusType === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {updateStatus}
                      </p>
                      {updateUrl && (
                        <button
                          onClick={handleOpenRelease}
                          className="text-[11px] text-blue-600 dark:text-blue-400 underline font-medium hover:text-blue-500 mt-0.5 block cursor-pointer"
                        >
                          Click to view and download release
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleCheckNow}
                      disabled={checkingUpdate}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {checkingUpdate ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <span>🔍 Check Now</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Card 3: About & Developer */}
                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 flex items-center justify-between transition-colors">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Subtitle Sync Studio
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Developed by DH-0216
                    </p>
                  </div>

                  <button
                    onClick={handleOpenGitHub}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Open GitHub Repository"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {activeTab === 'ai' && (
              <>
                {/* AI API Provider & Key Card - Exact same style as others */}
                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 space-y-3.5 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        AI Subtitle Translation API
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Used for translating generated subtitles into languages like Spoken Sinhala
                      </p>
                    </div>

                    <select
                      value={draftProvider}
                      onChange={(e) => {
                        const newProvider = e.target.value as 'gemini' | 'openai'
                        setDraftProvider(newProvider)
                        setVerifyStatus(null)
                        setAvailableModels([])
                        if (newProvider === 'gemini') {
                          setDraftModel('gemini-2.5-flash')
                        } else {
                          setDraftModel('gpt-4o-mini')
                        }
                        if (draftApiKey.trim()) {
                          handleFetchModels(newProvider, draftApiKey.trim(), true)
                        }
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {/* Removed Key icon in front of Gemini API Key */}
                      <label>
                        {draftProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                      </label>

                      {draftProvider === 'gemini' && (
                        <button
                          type="button"
                          onClick={handleOpenGeminiKey}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Get free key ↗</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          placeholder={draftProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                          value={draftApiKey}
                          onChange={(e) => {
                            setDraftApiKey(e.target.value)
                            if (verifyStatus) setVerifyStatus(null)
                          }}
                          className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                          title={showKey ? 'Hide Key' : 'Show Key'}
                        >
                          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handlePasteApiKey}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Paste</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleVerifyApiKey}
                        disabled={isVerifyingKey || !draftApiKey.trim()}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 ${
                          verifyStatus?.valid
                            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : verifyStatus?.valid === false
                            ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                            : 'border-slate-300 dark:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                        }`}
                        title="Verify API key with provider"
                      >
                        {isVerifyingKey ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                            <span>Verifying...</span>
                          </>
                        ) : verifyStatus?.valid ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Valid</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <label>AI Model</label>
                          {availableModels.length > 0 && (
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Live ({availableModels.length})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleFetchModels(draftProvider, draftApiKey, false)}
                            disabled={isLoadingModels || !draftApiKey.trim()}
                            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:no-underline"
                            title="Fetch latest available models directly from provider API"
                          >
                            <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                            <span>{isLoadingModels ? 'Fetching...' : 'Fetch Models'}</span>
                          </button>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {draftProvider === 'gemini' ? 'Gemini 2.5 Flash recommended' : 'GPT-4o mini recommended'}
                          </span>
                        </div>
                      </div>

                      <select
                        value={draftModel}
                        onChange={(e) => setDraftModel(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-medium"
                      >
                        {availableModels.length > 0 ? (
                          <>
                            {draftModel && !availableModels.some((m) => m.id === draftModel) && (
                              <option value={draftModel}>{draftModel} (Current selection)</option>
                            )}
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name || m.id}
                              </option>
                            ))}
                          </>
                        ) : draftProvider === 'gemini' ? (
                          <>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended — High Capacity & Reliable)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast & Stable)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                            <option value="gemini-3.8-flash">Gemini 3.8 Flash (High demand preview)</option>
                            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                            <option value="auto">Auto-detect best available model</option>
                          </>
                        ) : (
                          <>
                            <option value="gpt-4o-mini">GPT-4o mini (Recommended — Fast & Cost-effective)</option>
                            <option value="gpt-4o">GPT-4o (High precision)</option>
                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          </>
                        )}
                      </select>
                      {availableModels.length === 0 && (
                        <p className="text-[10px] text-slate-400">
                          Tip: Click &quot;Fetch Models&quot; or &quot;Verify&quot; to auto-load all current models from {draftProvider === 'gemini' ? 'Google' : 'OpenAI'}.
                        </p>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Stored securely on your local device only. Google Gemini offers a free daily quota.
                    </p>
                  </div>
                </div>

                {/* Custom Translation Prompt & Rules Card */}
                <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#111625]/80 space-y-3 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        Translation Prompt & Rules
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Fixes mistranslated homonyms, literal idioms, and controls colloquial spoken tone
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDraftPrompt(DEFAULT_AI_PROMPT)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Reset to default prompt"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={7}
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder="Enter custom AI translation instructions and idiom rules..."
                      className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans leading-relaxed resize-y focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                      Colloquial Sinhala (කථාබහ බස)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      Idiom Adaptation
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300">
                      Homonym Resolution
                    </span>
                  </div>
                </div>

                {/* Save Button for AI Translation Section */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAiSettings}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-600/25 active:scale-[0.99] flex items-center gap-1.5 cursor-pointer"
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
            )}
          </main>
        </div>

      </div>
    </div>
  )
}