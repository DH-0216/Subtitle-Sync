import React from "react";
import { RefreshCw, Sparkles, FileUp, Languages, Layers } from "lucide-react";
import { Badge } from "./common/Badge";

export type SubtitleAction = "sync" | "extract" | "generate" | "translate" | "batch";

interface SubtitleModeSelectorProps {
  action: SubtitleAction;
  hasVideo?: boolean;
  onSelectAction: (action: SubtitleAction) => void;
}

export const SubtitleModeSelector: React.FC<SubtitleModeSelectorProps> = ({
  action,
  onSelectAction,
}) => {
  const features = [
    {
      id: "sync" as SubtitleAction,
      title: "Synchronize Subtitle",
      desc: "Align existing subtitle file (.srt) with movie audio",
      icon: RefreshCw,
      badge: null,
    },
    {
      id: "extract" as SubtitleAction,
      title: "Extract Subtitle",
      desc: "Extract embedded tracks from MKV / MP4 containers",
      icon: FileUp,
      badge: null,
    },
    {
      id: "translate" as SubtitleAction,
      title: "Translate Subtitle",
      desc: "Translate subtitle dialogue into other languages with AI",
      icon: Languages,
      badge: "BETA",
    },
    {
      id: "generate" as SubtitleAction,
      title: "Generate Subtitle",
      desc: "Transcribe speech to text offline using Whisper AI",
      icon: Sparkles,
      badge: "BETA",
    },
    {
      id: "batch" as SubtitleAction,
      title: "Batch Process",
      desc: "Queue multiple movies or TV series to sync, generate, or translate",
      icon: Layers,
      badge: "NEW",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {features.map((f) => {
        const Icon = f.icon;
        const isActive = action === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelectAction(f.id)}
            className={`text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3.5 relative overflow-hidden group ${
              isActive
                ? "bg-app-primary text-app-primary-fg shadow-md border-blue-500 ring-2 ring-blue-500/30"
                : "bg-app-card-inner border-app-card-inner-border hover:border-app-primary text-app-text hover:bg-app-card-inner-hover shadow-2xs"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 group-hover:scale-105"
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-app-text"}`}
                >
                  {f.title}
                </span>
                {f.badge && (
                  <Badge
                    text={f.badge}
                    size="xs"
                    variant={isActive ? 'glass' : 'auto'}
                  />
                )}
              </div>
              <p
                className={`text-xs mt-0.5 leading-snug line-clamp-1 ${
                  isActive
                    ? "text-blue-100"
                    : "text-app-text-muted"
                }`}
              >
                {f.desc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
