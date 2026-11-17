import React from 'react'
import { FileUp } from 'lucide-react'
import { StepCard } from './common/StepCard'
import { Step3ActionFooter } from './common/Step3ActionFooter'

interface Step3ExtractProps {
  unlocked: boolean
  isExtracting: boolean
  selectedCount: number
  progress: number
  statusMessage: string
  lastOutputDir: string | null
  cleanTags: boolean
  setCleanTags: (val: boolean) => void
  onStartExtract: () => void
  onCancelExtract: () => void
  onOpenFolder: (targetPath?: string) => void
  videoPath?: string | null
  outputDir?: string | null
  onChangeOutputDir?: () => void
}

export const Step3Extract: React.FC<Step3ExtractProps> = ({
  unlocked,
  isExtracting,
  selectedCount,
  progress,
  statusMessage,
  lastOutputDir,
  cleanTags,
  setCleanTags,
  onStartExtract,
  onCancelExtract,
  onOpenFolder,
  videoPath,
  outputDir,
  onChangeOutputDir
}) => {
  const videoDir = videoPath
    ? videoPath.substring(0, Math.max(videoPath.lastIndexOf('/'), videoPath.lastIndexOf('\\')))
    : ''
  const displayDir = outputDir || videoDir || 'Same as movie folder'

  return (
    <StepCard
      step={3}
      title="Extract & Export .SRT"
      unlocked={unlocked}
      lockedMessage="Select movie & tracks in Steps 1 & 2 first"
    >
      <div className="space-y-3.5">
        {/* Clean tags checkbox */}
        <div className="flex items-center justify-between bg-app-card-inner border border-app-card-inner-border rounded-xl px-4 py-2.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-app-text">
            <input
              type="checkbox"
              checked={cleanTags}
              onChange={(e) => setCleanTags(e.target.checked)}
              disabled={isExtracting}
              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Clean formatting override tags (removes residual ASS curly brace tags like {"{\\pos}"}, {"{\\an8}"})</span>
          </label>
        </div>

        {/* Reusable Execution, Progress & Output Action Footer */}
        <Step3ActionFooter
          isRunning={isExtracting}
          unlocked={unlocked}
          disabled={selectedCount === 0}
          disabledReason="Select at least 1 track in Step 2"
          progress={progress}
          statusMessage={statusMessage}
          onStart={onStartExtract}
          onCancel={onCancelExtract}
          startIcon={<FileUp className="w-4 h-4" />}
          startLabel={`Extract ${selectedCount} Subtitle ${selectedCount === 1 ? 'Track' : 'Tracks'} to .SRT`}
          runningLabel="Cancel Extraction"
          outputDir={displayDir}
          onChangeOutputDir={onChangeOutputDir}
          lastOutputDir={lastOutputDir}
          onOpenFolder={onOpenFolder}
        />
      </div>
    </StepCard>
  )
}
