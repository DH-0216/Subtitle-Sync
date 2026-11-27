import React from "react";
import { RefreshCw, FileUp, Sparkles, Languages, WifiOff, Layers } from "lucide-react";
import { SubtitleAction } from "./SubtitleModeSelector";
import { SidebarNav, SidebarNavItem } from "./common";
import { useUIStore } from "../store";

interface SidebarProps {
  currentAction?: SubtitleAction;
  onSelectAction?: (action: SubtitleAction) => void;
  engineReady?: boolean;
  isOnline?: boolean;
}

const NAV_ITEMS: readonly SidebarNavItem<SubtitleAction>[] = [
  {
    id: "sync",
    label: "Synchronize Subtitle",
    icon: RefreshCw,
    badge: null,
  },
  {
    id: "extract",
    label: "Extract Subtitle",
    icon: FileUp,
    badge: null,
  },
  {
    id: "translate",
    label: "Translate Subtitle",
    icon: Languages,
    badge: null,
  },
  {
    id: "generate",
    label: "Generate Subtitle",
    icon: Sparkles,
    badge: "BETA",
  },
  {
    id: "batch",
    label: "Batch Process",
    icon: Layers,
    badge: null,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentAction: propAction,
  onSelectAction: propSelectAction,
  engineReady: propEngineReady,
  isOnline: propIsOnline,
}) => {
  const storeAction = useUIStore((s) => s.subtitleAction)
  const storeSetAction = useUIStore((s) => s.setSubtitleAction)
  const storeEngineReady = useUIStore((s) => s.engineReady)
  const storeIsOnline = useUIStore((s) => s.isOnline)

  const currentAction = propAction ?? storeAction
  const onSelectAction = propSelectAction ?? storeSetAction
  const engineReady = propEngineReady ?? storeEngineReady
  const isOnline = propIsOnline ?? storeIsOnline
  return (
    <aside className="w-56 xl:w-60 bg-app-sidebar border-r border-app-sidebar-border flex flex-col justify-between shrink-0 select-none z-10 transition-colors">
      {/* Navigation List */}
      <div className="p-2.5">
        <SidebarNav
          items={NAV_ITEMS}
          activeId={currentAction}
          onSelect={onSelectAction}
          sectionTitle="Features"
        />
      </div>

      {/* Bottom Status Section */}
      <div className="p-2.5 shrink-0">
        {/* Engine & Network Status */}
        <div className="w-full px-2.5 py-1.5 rounded-lg bg-app-sidebar-status border border-app-sidebar-status-border space-y-1">
          <div
            className="flex items-center justify-between text-xs cursor-default"
            title="Core Engines: FFmpeg (Extraction), ffsubsync (Synchronization), Whisper AI (Speech-to-Text)"
          >
            <span className="text-app-text-muted text-[10.5px]">
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
            <div className="flex items-center justify-between text-xs pt-1 border-t border-app-sidebar-status-border">
              <span className="text-app-text-muted text-[10.5px]">
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
