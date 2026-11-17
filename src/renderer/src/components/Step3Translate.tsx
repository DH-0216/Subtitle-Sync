import React from 'react'
import { Sparkles } from 'lucide-react'
import { translationLanguages } from './Step2Translate'
import { StepCard } from './common/StepCard'
import { Step3ActionFooter } from './common/Step3ActionFooter'

interface Step3TranslateProps {
  unlocked: boolean
  isTranslating: boolean
  sourceSubPath: string | null
  language: string
  aiProvider: string
  aiModel: string
  format: string
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  onStartTranslate: () => void
  onCancelTranslate: () => void
  onOpenFolder: () => void
}

export const Step3Translate: React.FC<Step3TranslateProps> = ({
  unlocked,
  isTranslating,
  sourceSubPath,
  language,
  aiProvider,
  aiModel,
  format,
  progress,
  statusMessage,
  lastOutputDir,
  onStartTranslate,
  onCancelTranslate,
  onOpenFolder
}) => {
  const sourceFileName = sourceSubPath ? sourceSubPath.split(/[\/\\]/).pop() : null
  const targetLangObj = translationLanguages.find((l) => l.code === language)
  const targetLangName = targetLangObj ? targetLangObj.name : language.toUpperCase()

  return (
    <StepCard
      step={3}
      title="Translate Subtitle with AI"
      unlocked={unlocked}
      lockedMessage="Select subtitle file in Step 1 first"
    >
      {/* Summary Banner */}
      <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F19]/60 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-800 dark:bg-blue-600 text-white shadow-2xs shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100">
            Ready to translate dialogues via {aiProvider.toUpperCase()} AI
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            The AI engine will parse cues from{' '}
            <span className="font-mono font-bold text-blue-900 dark:text-blue-300">
              {sourceFileName || 'chosen subtitle'}
            </span>{' '}
            and translate them into{' '}
            <span className="font-bold text-blue-800 dark:text-blue-400">
              {targetLangName}
            </span>{' '}
            into a{' '}
            <span className="font-bold uppercase text-blue-800 dark:text-blue-400">
              .{format}
            </span>{' '}
            file preserving all cue timings and formatting.
          </p>
        </div>
      </div>

      {/* Reusable Execution, Progress & Output Action Footer */}
      <Step3ActionFooter
        isRunning={isTranslating}
        unlocked={unlocked}
        progress={progress}
        statusMessage={statusMessage}
        onStart={onStartTranslate}
        onCancel={onCancelTranslate}
        startIcon={<Sparkles className="w-4 h-4" />}
        startLabel="Start AI Translation"
        runningLabel="Cancel Translation"
        lastOutputDir={lastOutputDir}
        onOpenFolder={onOpenFolder}
      />
    </StepCard>
  )
}
