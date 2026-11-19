import React, { useState, useRef } from 'react'
import {
  RefreshCw,
  FileDown,
  Sparkles,
  Languages,
  FolderPlus,
  FilePlus,
  Play,
  Square,
  Trash2,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Video,
  FileText,
  Layers,
  Sliders,
  Settings
} from 'lucide-react'
import { ProgressBar } from '../components/common/ProgressBar'
import { StepCard } from '../components/common/StepCard'
import { WhisperModelSelector, LanguageSelector } from '../components/common'
import { SyncMode } from '../components/Step3Sync'
import { BatchOperationType, BatchItem, BatchSyncMode } from '../hooks/useBatchWorkflow'
import { cleanPathString } from '@shared/fileSanitizer'
import { WhisperModelItem } from '../components/Step2Generate'
import { useBatchWorkflow } from '../hooks/useBatchWorkflow'
import { useMediaStore, useSettingsStore, useUIStore, useWhisperStore } from '../store'

export interface BatchViewProps {
  workflow?: ReturnType<typeof useBatchWorkflow>

  batchMode?: BatchOperationType
  setBatchMode?: (mode: BatchOperationType) => void
  items?: BatchItem[]
  isProcessing?: boolean
  overallProgress?: number
  activeItemId?: string | null
  syncMode?: BatchSyncMode
  setSyncMode?: (mode: BatchSyncMode) => void
  whisperModelQuality?: string
  setWhisperModelQuality?: (quality: string) => void
  generateLanguage?: string
  setGenerateLanguage?: (lang: string) => void
  generateFormat?: 'srt' | 'vtt'
  setGenerateFormat?: (fmt: 'srt' | 'vtt') => void
  translateLanguage?: string
  setTranslateLanguage?: (lang: string) => void
  translateFormat?: 'srt' | 'vtt' | 'txt'
  setTranslateFormat?: (fmt: 'srt' | 'vtt' | 'txt') => void
  translateSource?: 'subtitles' | 'embedded'
  setTranslateSource?: (source: 'subtitles' | 'embedded') => void
  preferredTrackLang?: string
  setPreferredTrackLang?: (lang: string) => void
  extractTrackOption?: string
  setExtractTrackOption?: (track: string) => void
  extractCleanTags?: boolean
  setExtractCleanTags?: (clean: boolean) => void
  availableWhisperModels?: WhisperModelItem[]
  aiApiKey?: string
  aiProvider?: string
  aiModel?: string
  onOpenSettingsAiTab?: () => void
  lastBatchOutputDir?: string | null
  onAddFiles?: () => void
  onAddFolder?: () => void
  onDropFiles?: (paths: string[]) => void
  onAssignSubtitle?: (itemId: string) => void
  onRemoveItem?: (id: string) => void
  onClearCompleted?: () => void
  onClearAll?: () => void
  onRetryItem?: (id: string) => void
  onStartBatch?: () => void
  onStopBatch?: () => void
  onOpenFolder?: (folder?: string) => void
}

export const BatchView: React.FC<BatchViewProps> = (props) => {
  const { workflow } = props
  const settingsStore = useSettingsStore()
  const mediaStore = useMediaStore()
  const uiStore = useUIStore()

  const batchMode = props.batchMode ?? workflow?.batchMode ?? 'sync'
  const setBatchMode = props.setBatchMode ?? workflow?.setBatchMode ?? (() => {})
  const items = props.items ?? workflow?.items ?? []
  const isProcessing = props.isProcessing ?? workflow?.isProcessing ?? false
  const overallProgress = props.overallProgress ?? workflow?.overallProgress ?? 0
  const activeItemId = props.activeItemId ?? workflow?.activeItemId ?? null
  const syncMode = props.syncMode ?? workflow?.syncMode ?? 'Best Match'
  const setSyncMode = props.setSyncMode ?? workflow?.setSyncMode ?? (() => {})
  const whisperModelQuality = props.whisperModelQuality ?? workflow?.whisperModelQuality ?? 'base'
  const setWhisperModelQuality = props.setWhisperModelQuality ?? workflow?.setWhisperModelQuality ?? (() => {})
  const generateLanguage = props.generateLanguage ?? workflow?.generateLanguage ?? 'original'
  const setGenerateLanguage = props.setGenerateLanguage ?? workflow?.setGenerateLanguage ?? (() => {})
  const generateFormat = props.generateFormat ?? workflow?.generateFormat ?? 'srt'
  const setGenerateFormat = props.setGenerateFormat ?? workflow?.setGenerateFormat ?? (() => {})
  const translateLanguage = props.translateLanguage ?? workflow?.translateLanguage ?? 'si'
  const setTranslateLanguage = props.setTranslateLanguage ?? workflow?.setTranslateLanguage ?? (() => {})
  const translateFormat = props.translateFormat ?? workflow?.translateFormat ?? 'srt'
  const setTranslateFormat = props.setTranslateFormat ?? workflow?.setTranslateFormat ?? (() => {})
  const translateSource = props.translateSource ?? workflow?.translateSource ?? 'subtitles'
  const setTranslateSource = props.setTranslateSource ?? workflow?.setTranslateSource ?? (() => {})
  const preferredTrackLang = props.preferredTrackLang ?? workflow?.preferredTrackLang ?? 'en'
  const setPreferredTrackLang = props.setPreferredTrackLang ?? workflow?.setPreferredTrackLang ?? (() => {})
  const extractTrackOption = props.extractTrackOption ?? workflow?.extractTrackOption ?? 'en'
  const setExtractTrackOption = props.setExtractTrackOption ?? workflow?.setExtractTrackOption ?? (() => {})
  const extractCleanTags = props.extractCleanTags ?? workflow?.extractCleanTags ?? true
  const setExtractCleanTags = props.setExtractCleanTags ?? workflow?.setExtractCleanTags ?? (() => {})
  const availableWhisperModels =
    props.availableWhisperModels ?? useWhisperStore((s) => s.whisperModels) ?? []
  const aiApiKey = props.aiApiKey ?? settingsStore.aiApiKey
  const aiProvider = props.aiProvider ?? settingsStore.aiProvider
  const aiModel = props.aiModel ?? settingsStore.aiModel
  const onOpenSettingsAiTab = props.onOpenSettingsAiTab ?? (() => uiStore.setSettingsModalOpen(true, 'ai'))
  const lastBatchOutputDir = props.lastBatchOutputDir ?? workflow?.lastBatchOutputDir ?? mediaStore.lastOutputDir
  const onAddFiles = props.onAddFiles ?? workflow?.handleAddFiles ?? (() => {})
  const onAddFolder = props.onAddFolder ?? workflow?.handleAddFolder ?? (() => {})
  const onDropFiles = props.onDropFiles ?? workflow?.handleDropFiles ?? (() => {})
  const onAssignSubtitle = props.onAssignSubtitle ?? workflow?.handleAssignSubtitle ?? (() => {})
  const onRemoveItem = props.onRemoveItem ?? workflow?.handleRemoveItem ?? (() => {})
  const onClearCompleted = props.onClearCompleted ?? workflow?.handleClearCompleted ?? (() => {})
  const onClearAll = props.onClearAll ?? workflow?.handleClearAll ?? (() => {})
  const onRetryItem = props.onRetryItem ?? workflow?.handleRetryItem ?? (() => {})
  const onStartBatch = props.onStartBatch ?? workflow?.handleStartBatch ?? (() => {})
  const onStopBatch = props.onStopBatch ?? workflow?.handleStopBatch ?? (() => {})
  const onOpenFolder = props.onOpenFolder ?? mediaStore.openFolder
  const dragCounter = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const completedCount = items.filter((it) => it.status === 'completed').length
  const failedCount = items.filter((it) => it.status === 'failed').length
  const pendingCount = items.filter((it) => it.status === 'pending').length
  const cancelledCount = items.filter((it) => it.status === 'cancelled').length
  const actionableCount = items.filter(
    (it) => it.status === 'pending' || it.status === 'failed' || it.status === 'cancelled'
  ).length
  const isKeyConfigured = Boolean(aiApiKey && aiApiKey.trim().length > 0)

  // Drag and drop handlers with counter to prevent child-element flicker
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragging(false)

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const paths: string[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i]
        const raw = window.api?.getPathForFile ? window.api.getPathForFile(file) : (file as any).path
        const clean = cleanPathString(raw)
        if (clean) paths.push(clean)
      }
      if (paths.length > 0) {
        onDropFiles(paths)
      }
    }
  }

  return (
    <div
      className="space-y-4 relative min-h-[420px]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 1. Operation Mode Switcher Ribbon */}
      <div className="bg-app-card border border-app-card-border rounded-xl p-3 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-0.5 p-0.5 bg-app-card-inner border border-app-card-inner-border rounded-lg shrink-0">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setBatchMode('sync')}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors select-none ${
                batchMode === 'sync'
                  ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
              } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <RefreshCw className="w-3 h-3 shrink-0" />
              <span>Synchronize</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setBatchMode('extract')}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors select-none ${
                batchMode === 'extract'
                  ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
              } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <FileDown className="w-3 h-3 shrink-0" />
              <span>Extract</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setBatchMode('generate')}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors select-none ${
                batchMode === 'generate'
                  ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
              } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>Generate (Whisper)</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setBatchMode('translate')}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors select-none ${
                batchMode === 'translate'
                  ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
              } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Languages className="w-3 h-3 shrink-0" />
              <span>Translate (AI)</span>
            </button>
          </div>

          <div className="text-[11px] text-app-text-muted hidden md:flex items-center gap-1.5 min-w-0 shrink overflow-hidden pr-3 sm:pr-4">
            <Layers className="w-3.5 h-3.5 text-brand-500 shrink-0" />
            <span className="truncate">
              {batchMode === 'sync' && 'Align series episodes with subtitles'}
              {batchMode === 'extract' && 'Extract embedded subtitle tracks from video files'}
              {batchMode === 'generate' && 'Transcribe speech with Whisper AI'}
              {batchMode === 'translate' && 'Translate subtitles with AI'}
            </span>
          </div>
        </div>

        {/* Batch Parameters Bar */}
        <div className="mt-3 pt-3 border-t border-app-card-border flex flex-wrap items-center justify-between gap-3 text-xs">
          {batchMode === 'sync' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-app-text flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-brand-500" /> Sync Engine Mode:
                </span>
                <div className="flex items-center gap-0.5 p-0.5 bg-app-card-inner border border-app-card-inner-border rounded-lg shrink-0">
                  {(['Best Match', 'Standard', 'Smart', 'Split sync'] as BatchSyncMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSyncMode(mode)}
                      className={`h-7 px-3 text-[11px] font-semibold rounded-md whitespace-nowrap flex items-center justify-center transition-colors select-none ${
                        syncMode === mode
                          ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                          : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
                      } ${isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {mode === 'Best Match' ? '✨ Best Match' : mode === 'Split sync' ? 'Split Sync' : mode}
                    </button>
                  ))}
                </div>
                <span className="text-app-text-muted text-[11px] hidden sm:inline">
                  (Best Match: Automatically detects optimal engine per episode • Standard: 1-Pass fast • Smart: 4-Pass)
                </span>
              </div>
            </div>
          )}

          {batchMode === 'extract' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-app-text text-xs shrink-0">Track:</span>
                <select
                  disabled={isProcessing}
                  value={extractTrackOption}
                  onChange={(e) => setExtractTrackOption?.(e.target.value)}
                  className="bg-app-input border border-app-input-border text-app-text text-xs rounded-md px-2 py-1 focus:outline-hidden cursor-pointer"
                >
                  <option value="en">English (Primary / Fallback to Default)</option>
                  <option value="auto">Default / Primary Track</option>
                  <option value="all">All Text Tracks (Extract All)</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                  <option value="hi">Hindi</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-app-text font-medium">
                  <input
                    type="checkbox"
                    disabled={isProcessing}
                    checked={extractCleanTags}
                    onChange={(e) => setExtractCleanTags?.(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Clean ASS formatting tags</span>
                </label>
              </div>
            </div>
          )}

          {batchMode === 'generate' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-app-text text-xs shrink-0">Whisper Model:</span>
                <WhisperModelSelector
                  value={whisperModelQuality}
                  onChange={setWhisperModelQuality}
                  availableModels={availableWhisperModels}
                  disabled={isProcessing}
                  size="sm"
                  className="space-y-0"
                  selectClassName="max-w-[210px] truncate"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-app-text text-xs shrink-0">Language:</span>
                <LanguageSelector
                  mode="generate"
                  value={generateLanguage}
                  onChange={setGenerateLanguage}
                  disabled={isProcessing}
                  size="sm"
                  className="space-y-0"
                  selectClassName="max-w-[190px] truncate"
                />
              </div>
            </div>
          )}

          {batchMode === 'translate' && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
              {setTranslateSource && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-app-text text-xs shrink-0">Source:</span>
                  <div className="flex rounded border border-app-input-border overflow-hidden">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setTranslateSource('subtitles')}
                      className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        translateSource === 'subtitles'
                          ? 'bg-brand-500 text-white'
                          : 'bg-app-input text-app-text-muted hover:text-app-text'
                      }`}
                      title="Translate standalone .srt / .vtt subtitle files"
                    >
                      Subtitle Files
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setTranslateSource('embedded')}
                      className={`px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                        translateSource === 'embedded'
                          ? 'bg-brand-500 text-white'
                          : 'bg-app-input text-app-text-muted hover:text-app-text'
                      }`}
                      title="Extract embedded subtitle tracks from movies (.mkv / .mp4) and translate directly"
                    >
                      Embedded in Movies
                    </button>
                  </div>
                </div>
              )}

              {translateSource === 'embedded' && setPreferredTrackLang && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-app-text text-xs shrink-0">Track:</span>
                  <select
                    disabled={isProcessing}
                    value={preferredTrackLang}
                    onChange={(e) => setPreferredTrackLang(e.target.value)}
                    className="bg-app-input border border-app-input-border text-app-text text-xs rounded-md px-2 py-1 focus:outline-hidden"
                  >
                    <option value="en">English (Primary)</option>
                    <option value="auto">Auto / Default Track</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="font-semibold text-app-text text-xs shrink-0">Target Language:</span>
                <LanguageSelector
                  mode="translate"
                  value={translateLanguage}
                  onChange={setTranslateLanguage}
                  disabled={isProcessing}
                  size="sm"
                  className="space-y-0"
                  selectClassName="max-w-[170px] truncate"
                />
              </div>

              <div className="flex items-center gap-2">
                {isKeyConfigured ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> AI Active: {aiProvider.toUpperCase()} ({aiModel || 'default'})
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenSettingsAiTab}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" /> Set AI API Key in Settings
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Queue Overview Card & Control Bar */}
      <div className="bg-app-card border border-app-card-border rounded-xl p-4 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: Summary Metrics */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-app-card-inner border border-app-card-inner-border text-app-text">
              Total: {items.length}
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Pending: {pendingCount}
            </span>
            {cancelledCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Cancelled: {cancelledCount}
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Completed: {completedCount}
            </span>
            {failedCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                Failed: {failedCount}
              </span>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isProcessing}
              onClick={onAddFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>Add Files</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={onAddFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add Folder / TV Series</span>
            </button>

            {items.some((it) => it.status === 'completed') && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={onClearCompleted}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
                title="Remove completed items from queue"
              >
                Clear Done
              </button>
            )}

            {items.length > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={onClearAll}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Clear all items from queue"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Master Progress Bar (Visible when processing or completed > 0) */}
        {(isProcessing || completedCount > 0) && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-app-text-muted font-medium">
              <span>Overall Batch Progress</span>
              <span className="font-bold text-app-text">
                {completedCount + failedCount} of {items.length} items ({overallProgress}%)
              </span>
            </div>
            <ProgressBar percent={overallProgress} />
          </div>
        )}

        {/* Primary Start / Stop Execution Controls */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            {!isProcessing ? (
              <button
                type="button"
                disabled={items.length === 0 || actionableCount === 0}
                onClick={onStartBatch}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm shadow-xs transition-all ${
                  items.length > 0 && actionableCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98'
                    : 'bg-app-card-inner border border-app-card-inner-border text-app-text-muted opacity-50 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{completedCount > 0 && actionableCount > 0 ? 'Resume Batch Processing' : 'Start Batch Processing'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStopBatch}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer active:scale-98"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Batch Processing</span>
              </button>
            )}

            {lastBatchOutputDir && (
              <button
                type="button"
                onClick={() => onOpenFolder(lastBatchOutputDir)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Open Output Folder</span>
              </button>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <span>Processing Queue Sequentially (One by One)...</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Drag & Drop Full View Overlay - Non-intrusive backdrop with pointer-events-none */}
      {isDragging && (
        <div className="absolute inset-0 z-50 rounded-2xl border-2 border-dashed border-brand-500 bg-app-card/95 backdrop-blur-xs flex flex-col items-center justify-center text-center p-8 shadow-2xl pointer-events-none select-none transition-all">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center mb-3 text-brand-500 shadow-xs">
            <Layers className="w-8 h-8 animate-bounce" />
          </div>
          <h4 className="font-bold text-base text-app-text">
            Drop Files or Folder to Add to Queue
          </h4>
          <p className="text-xs text-app-text-muted mt-1 max-w-sm">
            Files will be automatically categorized and added to the {batchMode.toUpperCase()} batch queue.
          </p>
        </div>
      )}

      {/* 4. Queue Items List */}
      <div className="bg-app-card border border-app-card-border rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="px-4 py-3 border-b border-app-card-border bg-app-card-header flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-app-text-muted flex items-center gap-2">
            <span>Job Queue</span>
            <span className="text-[11px] font-normal lowercase text-app-text-muted">
              ({items.length} item{items.length !== 1 ? 's' : ''})
            </span>
          </h3>

          <div className="text-xs text-app-text-muted">
            Drag files or folders directly into this view at any time
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-app-card-inner border border-app-card-inner-border flex items-center justify-center text-app-text-muted">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-app-text">Your Batch Queue is Empty</h4>
              <p className="text-xs text-app-text-muted mt-1 max-w-md">
                Select your whole TV series season, multiple movies, or subtitle files to batch process them sequentially.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onAddFolder}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-primary text-app-primary-fg text-xs font-bold shadow-xs hover:bg-app-primary-hover transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Select Series Folder</span>
              </button>
              <button
                type="button"
                onClick={onAddFiles}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-app-btn-border bg-app-btn text-app-btn-text text-xs font-semibold hover:bg-app-btn-hover transition-colors cursor-pointer"
              >
                <FilePlus className="w-4 h-4" />
                <span>Select Multiple Files</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-app-card-border">
            {items.map((item, idx) => {
              const isCurrent = activeItemId === item.id
              return (
                <div
                  key={item.id}
                  className={`p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
                    isCurrent
                      ? 'bg-brand-50/60 dark:bg-brand-950/20 border-l-4 border-l-brand-500'
                      : 'hover:bg-app-card-inner-hover/50'
                  }`}
                >
                  {/* Left: Index & Name */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs font-bold text-app-text-muted w-6 shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="p-2 rounded-lg bg-app-card-inner border border-app-card-inner-border shrink-0 text-app-text">
                      {item.jobType === 'extract' ? (
                        <FileDown className="w-4 h-4 text-emerald-500" />
                      ) : item.jobType === 'translate' && !item.videoPath ? (
                        <FileText className="w-4 h-4 text-emerald-500" />
                      ) : item.jobType === 'translate' && item.videoPath ? (
                        <Video className="w-4 h-4 text-purple-500" />
                      ) : (
                        <Video className="w-4 h-4 text-brand-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-bold text-xs text-app-text truncate max-w-md"
                          title={item.videoPath || item.subPath}
                        >
                          {item.name}
                        </span>

                        {item.episodeLabel && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                            {item.episodeLabel}
                          </span>
                        )}

                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-app-card-inner border border-app-card-inner-border text-app-text-muted uppercase">
                          {item.jobType}
                        </span>

                        {item.jobType === 'sync' && item.usedSyncMode && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {item.usedSyncMode}
                          </span>
                        )}

                        {item.jobType === 'translate' && (item.translateSource === 'embedded' || item.videoPath) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            Embedded Sub
                          </span>
                        )}
                      </div>

                      {/* Subtitle pairing details for Sync jobs */}
                      {item.jobType === 'sync' && (
                        <div className="text-[11px] text-app-text-muted mt-0.5 flex items-center gap-1.5 truncate">
                          {item.subPath ? (
                            <span className="truncate flex items-center gap-1">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                Matched Sub:
                              </span>{' '}
                              <span className="truncate" title={item.subPath}>
                                {item.subPath.split(/[\\/]/).pop()}
                              </span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAssignSubtitle(item.id)}
                              className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>Missing subtitle — click to pair</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Embedded Subtitle details for Translate jobs */}
                      {item.jobType === 'translate' && (item.translateSource === 'embedded' || item.videoPath) && (
                        <div className="text-[11px] text-app-text-muted mt-0.5 flex items-center gap-1.5 truncate">
                          <span className="text-purple-600 dark:text-purple-400 font-medium">Source:</span>
                          <span>Extract embedded track from movie & translate</span>
                        </div>
                      )}

                      {/* Embedded Subtitle details for Extract jobs */}
                      {item.jobType === 'extract' && (
                        <div className="text-[11px] text-app-text-muted mt-0.5 flex items-center gap-1.5 truncate">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Extract:</span>
                          <span>Extract embedded subtitle stream into standalone .srt</span>
                        </div>
                      )}

                      {/* Live Status Message */}
                      {item.statusMessage && (
                        <p className="text-[11px] text-app-text-muted mt-0.5 truncate">
                          {item.statusMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Center / Right: Progress & Status Badge */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    {/* Live Progress on active item */}
                    {isCurrent && (
                      <div className="w-28 space-y-1">
                        <div className="flex justify-between text-[10px] text-app-text-muted font-bold">
                          <span>Processing</span>
                          <span>{item.progress}%</span>
                        </div>
                        <ProgressBar percent={item.progress} />
                      </div>
                    )}

                    {/* Status Badge */}
                    <div>
                      {item.status === 'pending' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-app-text-muted bg-app-card-inner px-2.5 py-1 rounded-full border border-app-card-inner-border">
                          <Clock className="w-3 h-3" /> Queued
                        </span>
                      )}

                      {item.status === 'processing' && (
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-full border border-brand-500/20 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Working...
                        </span>
                      )}

                      {item.status === 'completed' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span
                          className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20"
                          title={item.error || 'Failed'}
                        >
                          <AlertCircle className="w-3 h-3" /> Failed
                        </span>
                      )}

                      {item.status === 'cancelled' && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                          Cancelled
                        </span>
                      )}
                    </div>

                    {/* Item Controls */}
                    <div className="flex items-center gap-1">
                      {item.status === 'completed' && (item.outputPath || item.outputDir) && (
                        <button
                          type="button"
                          onClick={() => onOpenFolder(item.outputPath || item.outputDir)}
                          className="p-1.5 rounded-md hover:bg-app-card-inner-hover text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                          title="Show file in folder"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(item.status === 'failed' || item.status === 'cancelled') && !isProcessing && (
                        <button
                          type="button"
                          onClick={() => onRetryItem(item.id)}
                          className="p-1.5 rounded-md hover:bg-app-card-inner-hover text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
                          title="Retry this item"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!isProcessing && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1.5 rounded-md hover:bg-rose-500/10 text-app-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
