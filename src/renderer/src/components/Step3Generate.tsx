import React from 'react'
import { Sparkles } from 'lucide-react'
import { GenerateConfig } from './Step2Generate'
import { StepCard } from './common/StepCard'
import { Step3ActionFooter } from './common/Step3ActionFooter'

interface Step3GenerateProps {
  unlocked: boolean
  isGenerating: boolean
  config: GenerateConfig
  selectedTrack?: number | null
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  onStartGenerate: () => void
  onCancelGenerate: () => void
  onOpenFolder: () => void
}

export const Step3Generate: React.FC<Step3GenerateProps> = ({
  unlocked,
  isGenerating,
  config,
  selectedTrack,
  progress,
  statusMessage,
  lastOutputDir,
  onStartGenerate,
  onCancelGenerate,
  onOpenFolder
}) => {
  return (
    <StepCard
      step={3}
      title="Generate Subtitle with Whisper AI"
      unlocked={unlocked}
      lockedMessage="Select reference movie in Step 1 first"
    >
      {/* Summary Banner */}
      <div className="mb-4 p-4 rounded-xl border border-app-card-inner-border bg-app-card-inner flex items-start gap-3">
        <div className="p-2 rounded-lg bg-app-primary text-app-primary-fg shadow-2xs shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="font-bold text-app-text">
            Ready to transcribe speech into subtitles
          </div>
          <p className="text-app-text-muted leading-relaxed">
            The offline Whisper AI engine will extract audio from track #{selectedTrack ?? 0} and transcribe dialogue into a{' '}
            <span className="font-bold uppercase text-blue-600 dark:text-blue-400">
              .{config.format}
            </span>{' '}
            file using the{' '}
            <span className="font-bold uppercase text-blue-600 dark:text-blue-400">
              {config.modelQuality}
            </span>{' '}
            model.
          </p>
        </div>
      </div>

      {/* Reusable Execution, Progress & Output Action Footer */}
      <Step3ActionFooter
        isRunning={isGenerating}
        unlocked={unlocked}
        progress={progress}
        statusMessage={statusMessage}
        onStart={onStartGenerate}
        onCancel={onCancelGenerate}
        startIcon={<Sparkles className="w-4 h-4" />}
        startLabel="Generate Subtitle File (.SRT)"
        runningLabel="Cancel Generation"
        lastOutputDir={lastOutputDir}
        onOpenFolder={onOpenFolder}
      />
    </StepCard>
  )
}
