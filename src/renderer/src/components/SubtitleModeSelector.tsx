import React from "react";
import { RefreshCw, Sparkles, FileUp, Languages } from "lucide-react";

export type SubtitleAction = "sync" | "extract" | "generate" | "translate";

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
      badge: null,
    },
    {
      id: "generate" as SubtitleAction,
      title: "Generate Subtitle",
      desc: "Transcribe speech to text offline using Whisper AI",
      icon: Sparkles,
      badge: "BETA",
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
                  : "bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400 group-hover:scale-105"
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-slate-900 dark:text-slate-100"}`}
                >
                  {f.title}
                </span>
                {f.badge && (
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      isActive
                        ? "bg-blue-700/80 text-white"
                        : "bg-amber-100 text-amber-900 border border-amber-300/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/30"
                    }`}
                  >
                    {f.badge}
                  </span>
                )}
              </div>
              <p
                className={`text-xs mt-0.5 leading-snug line-clamp-1 ${
                  isActive
                    ? "text-blue-100"
                    : "text-slate-600 dark:text-slate-400"
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
