import React from "react";
import { RefreshCw, FileUp, Sparkles, Languages, WifiOff } from "lucide-react";
import { SubtitleAction } from "./SubtitleModeSelector";

interface SidebarProps {
  currentAction: SubtitleAction;
  onSelectAction: (action: SubtitleAction) => void;
  engineReady: boolean;
  isOnline?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentAction,
  onSelectAction,
  engineReady,
  isOnline = true,
}) => {
  const navItems = [
    {
      id: "sync" as SubtitleAction,
      label: "Synchronize Subtitle",
      icon: RefreshCw,
      badge: null,
    },
    {
      id: "extract" as SubtitleAction,
      label: "Extract Subtitle",
      icon: FileUp,
      badge: null,
    },
    {
      id: "translate" as SubtitleAction,
      label: "Translate Subtitle",
      icon: Languages,
      badge: null,
    },
    {
      id: "generate" as SubtitleAction,
      label: "Generate Subtitle",
      icon: Sparkles,
      badge: "BETA",
    },
  ];

  return (
    <aside className="w-56 xl:w-60 bg-app-sidebar border-r border-app-sidebar-border flex flex-col justify-between shrink-0 select-none z-10 transition-colors">
      {/* Navigation List */}
      <div className="p-2.5 space-y-1">
        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2.5 py-1">
          Features
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentAction === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectAction(item.id)}
              className={`w-full text-left px-2.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2.5 group ${
                isActive
                  ? "bg-app-primary text-app-primary-fg shadow-xs font-semibold"
                  : "text-app-text hover:bg-app-sidebar-hover hover:text-app-accent"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isActive
                    ? "text-app-primary-fg"
                    : "text-slate-500 dark:text-slate-400 group-hover:text-app-accent group-hover:scale-105"
                }`}
              />
              <span className="text-xs truncate flex-1 font-semibold">
                {item.label}
              </span>
              {item.badge && (
                <span
                  className={`text-[8.5px] font-black uppercase tracking-wider px-1 py-0.2 rounded shrink-0 ${
                    isActive
                      ? "bg-blue-700/80 text-white"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Status Section */}
      <div className="p-2.5 shrink-0">
        {/* Engine & Network Status */}
        <div className="w-full px-2.5 py-1.5 rounded-lg bg-app-sidebar-status border border-app-sidebar-status-border space-y-1">
          <div
            className="flex items-center justify-between text-xs cursor-default"
            title="Core Engines: FFmpeg (Extraction), ffsubsync (Synchronization), Whisper AI (Speech-to-Text)"
          >
            <span className="text-slate-500 dark:text-slate-400 text-[10.5px]">
              Core Engines
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  engineReady ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                }`}
              />
              <span
                className={`text-[10.5px] font-bold ${
                  engineReady
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }`}
              >
                {engineReady ? "Ready" : "Checking..."}
              </span>
            </div>
          </div>

          {!isOnline && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
              <span className="text-slate-500 dark:text-slate-400 text-[10.5px]">
                Network
              </span>
              <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
