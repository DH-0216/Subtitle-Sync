import React from "react";
import { Sliders, Sparkles } from "lucide-react";
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
  const {
    isOpen,
    theme,
    checkUpdates,
    autoDownloadUpdates = false,
    notificationsEnabled = true
  } = props;

  const state = useSettingsModalState(props);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-4xl bg-app-modal-bg border border-app-modal-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Unified Modal Header */}
        <ModalHeader
          title="Settings & Preferences"
          subtitle="Configure application options and AI subtitle translation"
          onClose={state.handleClose}
        />

        {/* Modal Body: Left Sidebar Tabs + Right Scrollable Content */}
        <div className="flex-1 flex overflow-hidden min-h-[460px]">
          {/* Navigation Sidebar */}
          <aside className="w-52 border-r border-app-card-border p-3 flex flex-col gap-1.5 shrink-0 bg-app-sidebar/40">
            <SidebarNav<"general" | "ai">
              items={navItems}
              activeId={state.activeTab}
              onSelect={(id) => state.setActiveTab(id)}
              className="space-y-1"
            />
          </aside>

          {/* Tab Content Panels */}
          <main className="flex-1 p-6 overflow-y-auto space-y-5 bg-transparent">
            {state.activeTab === "general" && (
              <SettingsGeneralTab
                theme={theme}
                onSelectTheme={state.handleSelectTheme}
                checkUpdates={checkUpdates}
                onToggleAutoUpdate={state.handleToggleAutoUpdate}
                autoDownloadUpdates={autoDownloadUpdates}
                onToggleAutoDownload={state.handleToggleAutoDownload}
                notificationsEnabled={notificationsEnabled}
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
