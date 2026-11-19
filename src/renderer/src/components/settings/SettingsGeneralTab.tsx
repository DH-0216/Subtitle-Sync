import React from 'react'
import { RefreshCw, Bell, ExternalLink, FileCode } from 'lucide-react'
import { ThemeSelector, ThemeMode, ToggleSwitch } from '../common'

export interface SettingsGeneralTabProps {
  theme: ThemeMode
  onSelectTheme: (t: ThemeMode) => void
  defaultSubtitleFormat?: 'srt' | 'vtt' | 'txt'
  onSelectDefaultSubtitleFormat?: (fmt: 'srt' | 'vtt' | 'txt') => void
  checkUpdates: boolean
  onToggleAutoUpdate: (c: boolean) => void
  autoDownloadUpdates: boolean
  onToggleAutoDownload: (a: boolean) => void
  notificationsEnabled: boolean
  onToggleNotifications: (n: boolean) => void
  updateStatus: string
  updateStatusType: 'normal' | 'success' | 'warning' | 'error'
  checkingUpdate: boolean
  onCheckNow: () => void
  latestUpdateInfo?: any
  updateUrl?: string | null
  onOpenUpdate: () => void
  onOpenGitHub: () => void
}

export const SettingsGeneralTab: React.FC<SettingsGeneralTabProps> = ({
  theme,
  onSelectTheme,
  defaultSubtitleFormat = 'srt',
  onSelectDefaultSubtitleFormat,
  checkUpdates,
  onToggleAutoUpdate,
  autoDownloadUpdates,
  onToggleAutoDownload,
  notificationsEnabled,
  onToggleNotifications,
  updateStatus,
  updateStatusType,
  checkingUpdate,
  onCheckNow,
  latestUpdateInfo,
  updateUrl,
  onOpenUpdate,
  onOpenGitHub
}) => {
  return (
    <>
      {/* Card 1: Theme Selector */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card transition-colors">
        <ThemeSelector theme={theme} onSelectTheme={onSelectTheme} />
      </div>

      {/* Card 2: Subtitle Output Format */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-2.5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h3 className="font-bold text-sm text-app-text flex items-center gap-2">
              <FileCode className="w-4 h-4 text-app-accent" />
              Default Subtitle Format
            </h3>
            <p className="text-xs text-app-text-muted mt-0.5">
              Global output format for subtitle generation, translation, and batch processing
            </p>
          </div>

          <div className="flex rounded-lg border border-app-card-inner-border overflow-hidden bg-app-card-inner p-0.5 shrink-0 self-start sm:self-auto">
            {(
              [
                { id: 'srt', label: 'SRT (Standard)' },
                { id: 'vtt', label: 'VTT (Web)' },
                { id: 'txt', label: 'TXT (Plain)' }
              ] as const
            ).map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => onSelectDefaultSubtitleFormat?.(fmt.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  defaultSubtitleFormat === fmt.id
                    ? 'bg-app-primary text-app-primary-fg shadow-xs font-bold'
                    : 'text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-app-text-muted">
          SubRip (.srt) is universally supported by VLC, television sets, home theaters, and all media players.
        </p>
      </div>

      {/* Card 2: Software Updates */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-app-text">Automatic Updates</h3>
            <p className="text-xs text-app-text-muted mt-0.5">
              Check for newer versions automatically on startup
            </p>
          </div>

          <ToggleSwitch
            checked={checkUpdates}
            onChange={onToggleAutoUpdate}
            title="Toggle auto update"
          />
        </div>

        {/* Row 2: Automatically Download Updates */}
        <div className="pt-3 border-t border-app-card-inner-border flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-app-text">
              Automatically Download Updates
            </h4>
            <p className="text-[11px] text-app-text-muted mt-0.5">
              Download delta updates silently in background and notify when ready (never auto-restarts)
            </p>
          </div>

          <ToggleSwitch
            checked={autoDownloadUpdates}
            onChange={onToggleAutoDownload}
            title="Toggle auto download"
          />
        </div>

        <div className="pt-3 border-t border-app-card-inner-border flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs font-medium truncate ${
                updateStatusType === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : updateStatusType === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-app-text-muted'
              }`}
            >
              {updateStatus}
            </p>
            {(latestUpdateInfo || updateUrl) && (
              <button
                type="button"
                onClick={onOpenUpdate}
                className="text-[11px] text-app-accent underline font-medium hover:text-app-accent-hover mt-0.5 block cursor-pointer"
              >
                Click to download update
              </button>
            )}
          </div>

          <button
            onClick={onCheckNow}
            disabled={checkingUpdate}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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

      {/* Card 3: Desktop Notifications */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card flex items-center justify-between transition-colors">
        <div>
          <h3 className="font-bold text-sm text-app-text flex items-center gap-2">
            <Bell className="w-4 h-4 text-app-accent" />
            Desktop Notifications
          </h3>
          <p className="text-xs text-app-text-muted mt-0.5">
            Notify me when jobs finish (synchronization, translation, extraction)
          </p>
        </div>

        <ToggleSwitch
          checked={notificationsEnabled}
          onChange={onToggleNotifications}
          title="Toggle desktop notifications"
        />
      </div>

      {/* Card 4: About & Developer */}
      <div className="p-4 rounded-xl border border-app-card-border bg-app-card flex items-center justify-between transition-colors">
        <div>
          <h3 className="font-bold text-sm text-app-text">Subtitle Sync Studio</h3>
          <p className="text-xs text-app-text-muted mt-0.5">Developed by DH-0216</p>
        </div>

        <button
          onClick={onOpenGitHub}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors flex items-center gap-1.5 cursor-pointer"
          title="Open GitHub Repository"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  )
}
