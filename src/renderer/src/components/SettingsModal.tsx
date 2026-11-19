import React from "react";
import { Sliders, Sparkles } from "lucide-react";
import { APP_VERSION } from "@shared/version";
import { ModalHeader, SidebarNav, SidebarNavItem, ThemeMode } from "./common";
import {
  SettingsGeneralTab,
  SettingsAiTab,
  useSettingsModalState,
  SettingsModalProps
} from "./settings";
import { DEFAULT_AI_PROMPT, TRANSLATION_LANGUAGES } from "@shared/translationPrompts";

export { DEFAULT_AI_PROMPT, TRANSLATION_LANGUAGES };
export type { SettingsModalProps };

export const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const state = useSettingsModalState(props);

  if (!state.isOpen) return null;

  const navItems: SidebarNavItem<"general" | "ai">[] = [
    {
      id: "general",
      label: "General",
      icon: Sliders
    },
    {
      id: "ai",
      label: "AI Translation",
      icon: Sparkles
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) state.handleClose();
      }}
    >
      <div
        className="bg-app-modal border border-app-modal-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[560px] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified Modal Header */}
        <ModalHeader
          title="Settings & Preferences"
          subtitle="Configure application options and AI subtitle translation"
          icon={<Sliders className="w-4 h-4" />}
          onClose={state.handleClose}
        />

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Tabs */}
          <aside className="w-48 sm:w-52 bg-app-modal-sidebar border-r border-app-modal-sidebar-border p-3 shrink-0 flex flex-col justify-between">
            <SidebarNav<"general" | "ai">
              items={navItems}
              activeId={state.activeTab}
              onSelect={(id) => state.setActiveTab(id)}
              className="space-y-1.5"
              itemClassName="px-3 py-2.5"
            />

            {/* Bottom-left of setting window: Version */}
            <div className="pt-3 px-1 text-left">
              <span className="text-[11px] font-medium text-app-text-muted tracking-wide select-none">
                v{APP_VERSION}
              </span>
            </div>
          </aside>

          {/* Right Tab Content Panel */}
          <main className="flex-1 p-5 overflow-y-auto space-y-4 bg-app-canvas">
            {state.activeTab === "general" && (
              <SettingsGeneralTab
                theme={state.theme}
                onSelectTheme={state.handleSelectTheme}
                defaultSubtitleFormat={state.defaultSubtitleFormat}
                onSelectDefaultSubtitleFormat={state.handleSelectDefaultSubtitleFormat}
                checkUpdates={state.checkUpdates}
                onToggleAutoUpdate={state.handleToggleAutoUpdate}
                autoDownloadUpdates={state.autoDownloadUpdates}
                onToggleAutoDownload={state.handleToggleAutoDownload}
                notificationsEnabled={state.notificationsEnabled}
                onToggleNotifications={state.handleToggleNotifications}
                updateStatus={state.updateStatus}
                updateStatusType={state.updateStatusType}
                checkingUpdate={state.checkingUpdate}
                updateUrl={state.updateUrl}
                onCheckNow={state.handleCheckNow}
                onOpenUpdate={state.handleOpenUpdate}
                onOpenGitHub={state.handleOpenGitHub}
              />
            )}

            {state.activeTab === "ai" && (
              <SettingsAiTab
                draftProvider={state.draftProvider}
                onChangeProvider={(newProvider) => {
                  state.setDraftProvider(newProvider);
                  state.setVerifyStatus(null);
                  state.setAvailableModels([]);
                  state.setDraftModel("auto");
                  if (state.draftApiKey.trim()) {
                    state.handleFetchModels(newProvider, state.draftApiKey.trim(), true);
                  }
                }}
                draftApiKey={state.draftApiKey}
                onChangeApiKey={(k) => {
                  state.setDraftApiKey(k);
                  if (state.verifyStatus) state.setVerifyStatus(null);
                }}
                showKey={state.showKey}
                onToggleShowKey={() => state.setShowKey(!state.showKey)}
                onPasteApiKey={state.handlePasteApiKey}
                onVerifyKey={state.handleVerifyApiKey}
                isVerifyingKey={state.isVerifyingKey}
                verifyStatus={state.verifyStatus}
                draftModel={state.draftModel}
                onChangeModel={(m) => state.setDraftModel(m)}
                availableModels={state.availableModels}
                isLoadingModels={state.isLoadingModels}
                onFetchModels={() =>
                  state.handleFetchModels(state.draftProvider, state.draftApiKey, false)
                }
                draftPrompt={state.activePromptValue}
                onChangePrompt={(val) => {
                  state.setDraftPromptsByLang((prev) => ({
                    ...prev,
                    [state.selectedPromptLang]: val
                  }));
                }}
                selectedPromptLang={state.selectedPromptLang}
                onChangePromptLang={(newCode) => {
                  state.setSelectedPromptLang(newCode);
                }}
                onResetPrompt={() => {
                  state.setDraftPromptsByLang((prev) => ({
                    ...prev,
                    [state.selectedPromptLang]: state.currentLangConfig.defaultPrompt
                  }));
                }}
                onSaveAiSettings={state.handleSaveAiSettings}
                savedSuccess={state.savedSuccess}
                onOpenKeyPortal={state.handleOpenKeyPortal}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
