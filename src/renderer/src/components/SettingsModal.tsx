import React, { useState, useEffect } from "react";
import {
  X,
  Settings as SettingsIcon,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  Sliders,
  RotateCcw,
  Save,
  Check,
  ClipboardPaste,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Bell,
  Languages,
} from "lucide-react";
import toast from "react-hot-toast";
import { ThemeSelector, ThemeMode } from "./common";
import { EXTERNAL_LINKS, getGeminiVerifyUrl } from "@shared/links";
import { formatUserFriendlyError } from "@shared/errorUtils";
import { APP_VERSION, compareVersions } from "@shared/version";
import {
  AiProviderId,
  AI_PROVIDER_LIST,
  getAiProvider,
} from "@shared/aiModels";
import {
  DEFAULT_AI_PROMPT,
  TRANSLATION_LANGUAGES,
  getLanguageConfig,
} from "@shared/translationPrompts";

export { DEFAULT_AI_PROMPT, TRANSLATION_LANGUAGES };

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "general" | "ai";
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  checkUpdates: boolean;
  setCheckUpdates: (c: boolean) => void;
  autoDownloadUpdates?: boolean;
  setAutoDownloadUpdates?: (a: boolean) => void;
  notificationsEnabled?: boolean;
  setNotificationsEnabled?: (n: boolean) => void;
  aiApiKey: string;
  setAiApiKey: (k: string) => void;
  aiProvider: AiProviderId;
  setAiProvider: (p: AiProviderId) => void;
  aiModel?: string;
  setAiModel?: (m: string) => void;
  aiPrompt: string;
  setAiPrompt: (p: string) => void;
  onSave?: () => void;
  onOpenUpdateModal?: (info: any) => void;
}

const GITHUB_REPO = EXTERNAL_LINKS.REPO_SLUG;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = "general",
  theme,
  setTheme,
  checkUpdates,
  setCheckUpdates,
  autoDownloadUpdates = false,
  setAutoDownloadUpdates,
  notificationsEnabled = true,
  setNotificationsEnabled,
  aiApiKey,
  setAiApiKey,
  aiProvider,
  setAiProvider,
  aiModel = "auto",
  setAiModel,
  aiPrompt,
  setAiPrompt,
  onSave,
  onOpenUpdateModal,
}) => {
  const [activeTab, setActiveTab] = useState<"general" | "ai">(initialTab);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>(
    `Current Version: v${APP_VERSION}`,
  );
  const [updateStatusType, setUpdateStatusType] = useState<
    "normal" | "success" | "warning" | "error"
  >("normal");
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [latestUpdateInfo, setLatestUpdateInfo] = useState<any>(null);
  const [showKey, setShowKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Local draft state for AI settings (only committed when user clicks "Save Changes")
  const [draftApiKey, setDraftApiKey] = useState(aiApiKey);
  const [draftProvider, setDraftProvider] = useState<AiProviderId>(aiProvider);
  const [draftModel, setDraftModel] = useState(aiModel);
  const [draftPrompt, setDraftPrompt] = useState(aiPrompt);
  const [selectedPromptLang, setSelectedPromptLang] = useState<string>("si");
  const currentLangConfig = getLanguageConfig(selectedPromptLang);
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const handleFetchModels = async (
    provider: AiProviderId,
    key: string,
    silent: boolean = false,
  ) => {
    if (!key.trim()) return;
    if (!navigator.onLine) {
      if (!silent) {
        toast.error(
          "You are offline. Connect to the internet to fetch latest models.",
          { icon: "📡" },
        );
      }
      return;
    }
    setIsLoadingModels(true);
    try {
      if (window.api?.ai?.fetchModels) {
        const res = await window.api.ai.fetchModels(provider, key.trim());
        if (res.success && res.models && res.models.length > 0) {
          setAvailableModels(res.models);
          if (!silent) {
            toast.success(`Loaded ${res.models.length} live models!`, {
              duration: 2500,
            });
          }
          // If current draftModel is a specific model that is no longer in fetched models, revert to auto
          if (draftModel && draftModel !== "auto") {
            const exists = res.models.some((m) => m.id === draftModel);
            if (!exists) {
              setDraftModel("auto");
            }
          }
          return;
        }
      }
    } catch (err: any) {
      if (!silent) {
        toast.error("Failed to fetch models: " + formatUserFriendlyError(err));
      }
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch live models if API key exists whenever modal opens
  useEffect(() => {
    if (isOpen && aiApiKey.trim()) {
      handleFetchModels(aiProvider, aiApiKey.trim(), true);
    }
  }, [isOpen]);

  // Reset drafts and tab whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setDraftApiKey(aiApiKey);
      setDraftProvider(aiProvider);
      setDraftModel(aiModel || "auto");
      setDraftPrompt(aiPrompt);
      setSavedSuccess(false);
      setVerifyStatus(null);
    }
  }, [isOpen, initialTab, aiApiKey, aiProvider, aiModel, aiPrompt]);

  const handleSaveAiSettings = () => {
    const keyChanged = draftApiKey !== aiApiKey;
    const promptChanged = draftPrompt !== aiPrompt;
    const providerChanged = draftProvider !== aiProvider;
    const modelChanged = draftModel !== aiModel;

    // 1. Commit to parent state
    setAiApiKey(draftApiKey);
    setAiProvider(draftProvider);
    if (setAiModel) setAiModel(draftModel);
    setAiPrompt(draftPrompt);

    // 2. Persist to encrypted local settings
    window.api?.settings?.save({
      theme,
      check_updates_startup: checkUpdates,
      aiApiKey: draftApiKey,
      aiProvider: draftProvider,
      aiModel: draftModel,
      aiPrompt: draftPrompt,
    });

    // 3. User feedback
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);

    if (keyChanged && promptChanged) {
      toast.success("API key updated successfully!");
      toast.success(`${currentLangConfig.name} prompt updated successfully!`);
    } else if (keyChanged) {
      toast.success("API key updated successfully!");
    } else if (modelChanged) {
      toast.success(`AI Model set to ${draftModel}!`);
    } else if (promptChanged) {
      toast.success(`${currentLangConfig.name} prompt updated successfully!`);
    } else if (providerChanged) {
      toast.success("AI provider updated successfully!");
    } else {
      toast.success("AI Translation settings saved!");
    }
  };

  const handlePasteApiKey = async () => {
    try {
      let text = "";
      if (window.api?.clipboard?.readText) {
        text = await window.api.clipboard.readText();
      } else if (navigator?.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }

      if (text && text.trim().length > 0) {
        setDraftApiKey(text.trim());
        setVerifyStatus(null);
        toast.success("API Key pasted from clipboard!", { duration: 2000 });
      } else {
        toast.error("Clipboard is empty!");
      }
    } catch (err) {
      toast.error("Could not read from clipboard");
    }
  };

  const handleVerifyApiKey = async () => {
    if (!draftApiKey.trim()) {
      toast.error("Please enter an API Key to verify.");
      return;
    }

    if (!navigator.onLine) {
      toast.error(
        "You are offline. Connect to the internet to verify your API key.",
        { icon: "📡" },
      );
      setVerifyStatus({
        valid: false,
        message: "Offline: Internet connection required to verify API key.",
      });
      return;
    }

    const cleanKey = draftApiKey.trim();
    setIsVerifyingKey(true);
    setVerifyStatus(null);

    try {
      let res: {
        valid: boolean;
        message: string;
        models?: Array<{ id: string; name: string }>;
      };

      if (window.api?.ai?.verifyKey) {
        res = await window.api.ai.verifyKey(draftProvider, cleanKey);
        if (res.valid && res.models && res.models.length > 0) {
          setAvailableModels(res.models);
          if (draftModel && draftModel !== "auto") {
            const exists = res.models.some((m) => m.id === draftModel);
            if (!exists) {
              setDraftModel("auto");
            }
          }
        }
      } else {
        // Direct browser fetch fallback (works even if Electron process hasn't been restarted yet)
        const providerMeta = getAiProvider(draftProvider);
        if (draftProvider === "gemini") {
          const response = await fetch(getGeminiVerifyUrl(cleanKey));
          if (response.ok) {
            const data = await response.json().catch(() => null);
            const rawModels = (data?.models || [])
              .filter((m: any) =>
                m.supportedGenerationMethods?.includes("generateContent"),
              )
              .map((m: any) => (m.name || "").replace(/^models\//, ""));
            const ordered = providerMeta.buildDynamicChain(rawModels);
            const models = ordered.map((id) => ({ id, name: id }));
            if (models.length > 0) {
              setAvailableModels(models);
            }
            res = {
              valid: true,
              message: `${providerMeta.name} API Key is valid and active!`,
              models,
            };
          } else {
            const data = await response.json().catch(() => null);
            const errMsg = data?.error?.message || `HTTP ${response.status}`;
            res = {
              valid: false,
              message: `Invalid ${providerMeta.name} Key: ${errMsg}`,
            };
          }
        } else {
          const response = await fetch(EXTERNAL_LINKS.OPENAI_MODELS_API, {
            headers: { Authorization: `Bearer ${cleanKey}` },
          });
          if (response.ok) {
            const data = await response.json().catch(() => null);
            const rawIds = (data?.data || []).map((m: any) => m.id || "");
            const ordered = providerMeta.buildDynamicChain(rawIds);
            const models = ordered.map((id) => ({ id, name: id }));
            if (models.length > 0) {
              setAvailableModels(models);
            }
            res = {
              valid: true,
              message: `${providerMeta.name} API Key is valid and active!`,
              models,
            };
          } else {
            const data = await response.json().catch(() => null);
            const errMsg = data?.error?.message || `HTTP ${response.status}`;
            res = {
              valid: false,
              message: `Invalid ${providerMeta.name} Key: ${errMsg}`,
            };
          }
        }
      }

      setVerifyStatus(res);
      if (res.valid) {
        toast.success(res.message, { duration: 3500 });
      } else {
        const friendly = formatUserFriendlyError(res.message);
        toast.error(friendly, { duration: 4500 });
      }
    } catch (err: any) {
      const msg = err.message || "Verification failed";
      const friendly = formatUserFriendlyError(msg);
      setVerifyStatus({ valid: false, message: friendly });
      toast.error("Verification failed: " + friendly);
    } finally {
      setIsVerifyingKey(false);
    }
  };

  const handleClose = () => {
    if (onSave) onSave();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, onSave]);

  if (!isOpen) return null;

  const handleSelectTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    window.api?.settings?.save({
      theme: newTheme,
      check_updates_startup: checkUpdates,
      aiApiKey,
      aiProvider,
      aiPrompt,
    });
  };

  const handleToggleAutoUpdate = (enabled: boolean) => {
    setCheckUpdates(enabled);
    window.api?.settings?.save({
      theme,
      check_updates_startup: enabled,
      autoDownloadUpdates,
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiPrompt,
    });
  };

  const handleToggleAutoDownload = (enabled: boolean) => {
    if (setAutoDownloadUpdates) {
      setAutoDownloadUpdates(enabled);
    }
    window.api?.settings?.save({
      theme,
      check_updates_startup: checkUpdates,
      autoDownloadUpdates: enabled,
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiPrompt,
    });
    toast.success(
      enabled
        ? "Automatic update downloads enabled (will notify when ready)"
        : "Automatic update downloads disabled",
    );
  };

  const handleToggleNotifications = (enabled: boolean) => {
    if (setNotificationsEnabled) {
      setNotificationsEnabled(enabled);
    }
    window.api?.settings?.save({
      theme,
      check_updates_startup: checkUpdates,
      autoDownloadUpdates,
      notificationsEnabled: enabled,
      aiApiKey,
      aiProvider,
      aiPrompt,
    });
    toast.success(
      enabled
        ? "Desktop notifications enabled"
        : "Desktop notifications disabled",
    );
  };

  const handleCheckNow = async () => {
    if (!navigator.onLine) {
      setUpdateStatus(
        "⚠️ Could not check for updates. No internet connection.",
      );
      setUpdateStatusType("error");
      toast.error("Could not check for updates. No internet connection.", {
        icon: "📡",
      });
      return;
    }

    setCheckingUpdate(true);
    setUpdateStatus("Checking GitHub Releases...");
    setUpdateStatusType("normal");

    try {
      if (window.api?.updater?.check) {
        const info = await window.api.updater.check();
        if (info.error) {
          setUpdateStatus(
            "⚠️ Could not check for updates. No internet connection.",
          );
          setUpdateStatusType("error");
          toast.error("Could not check for updates. No internet connection.", {
            icon: "📡",
          });
        } else if (
          info.updateAvailable &&
          info.latestVersion &&
          compareVersions(info.latestVersion, APP_VERSION) > 0
        ) {
          setUpdateStatus(`Update available: v${info.latestVersion}`);
          setUpdateStatusType("success");
          setUpdateUrl(info.releaseUrl || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE);
          setLatestUpdateInfo(info);

          if (onOpenUpdateModal) {
            onClose();
            onOpenUpdateModal(info);
          }
        } else {
          setUpdateStatus(`✅ You're on the latest version (v${APP_VERSION})`);
          setUpdateStatusType("success");
          setUpdateUrl(null);
          toast.success(`You're on the latest version (v${APP_VERSION})!`, {
            duration: 3000,
            icon: "✅",
          });
        }
      } else {
        const res = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_API, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        const latestTag = data.tag_name || "";
        const cleanLatest = latestTag.replace(/^v/, "");
        const cleanCurrent = APP_VERSION.replace(/^v/, "");

        if (cleanLatest && compareVersions(cleanLatest, cleanCurrent) > 0) {
          const assets = Array.isArray(data.assets) ? data.assets : [];
          const setupAsset =
            assets.find(
              (a: any) =>
                (a.name || "").toLowerCase() === "subtitlesync-setup.exe",
            ) ||
            assets.find(
              (a: any) =>
                (a.name || "").toLowerCase().includes("setup") &&
                (a.name || "").endsWith(".exe"),
            ) ||
            assets.find((a: any) => (a.name || "").endsWith(".exe"));

          const modalInfo = {
            updateAvailable: true,
            currentVersion: cleanCurrent,
            latestVersion: cleanLatest,
            releaseName: data.name || latestTag,
            releaseNotes:
              data.body || "No release notes provided for this version.",
            publishedAt: data.published_at,
            downloadUrl: setupAsset?.browser_download_url,
            assetName: setupAsset?.name || "SubtitleSync-Setup.exe",
            assetSize: setupAsset?.size,
            deltaSize: Math.round((setupAsset?.size || 151000000) * 0.14),
            isDeltaAvailable: true,
            releaseUrl: data.html_url || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE,
          };

          setUpdateStatus(`Update available: ${latestTag}`);
          setUpdateStatusType("success");
          setUpdateUrl(data.html_url || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE);
          setLatestUpdateInfo(modalInfo);

          if (onOpenUpdateModal) {
            onClose();
            onOpenUpdateModal(modalInfo);
          }
        } else {
          setUpdateStatus(`✅ You're on the latest version (v${APP_VERSION})`);
          setUpdateStatusType("success");
          setUpdateUrl(null);
          toast.success(`You're on the latest version (v${APP_VERSION})!`, {
            duration: 3000,
            icon: "✅",
          });
        }
      }
    } catch (e: any) {
      setUpdateStatus(
        "⚠️ Could not check for updates. No internet connection.",
      );
      setUpdateStatusType("error");
      toast.error("Could not check for updates. No internet connection.", {
        icon: "📡",
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleOpenGitHub = () => {
    const url = EXTERNAL_LINKS.GITHUB_REPO;
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleOpenKeyPortal = (url?: string) => {
    if (!url) return;
    if (window.api?.shell?.openExternal) {
      window.api.shell.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleOpenUpdate = async () => {
    if (latestUpdateInfo && onOpenUpdateModal) {
      onClose();
      onOpenUpdateModal(latestUpdateInfo);
      return;
    }

    if (window.api?.updater?.check && onOpenUpdateModal) {
      try {
        const info = await window.api.updater.check();
        if (info.updateAvailable) {
          onClose();
          onOpenUpdateModal(info);
          return;
        }
      } catch {}
    }

    if (updateUrl && window.api?.shell?.openExternal) {
      window.api.shell.openExternal(updateUrl);
    } else if (updateUrl) {
      window.open(updateUrl, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overscroll-contain animate-fade-in"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-app-modal border border-app-modal-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[560px] max-h-[90vh]">
        {/* Header Row */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-modal-header-border bg-app-modal-header shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-app-accent-bg border border-app-accent-border flex items-center justify-center text-app-accent">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-app-text text-base leading-tight">
                Settings & Preferences
              </h2>
              <p className="text-[11px] text-app-text-muted">
                Configure application options and AI subtitle translation
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-card-inner-hover transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Tabs */}
          <aside className="w-48 sm:w-52 bg-app-modal-sidebar border-r border-app-modal-sidebar-border p-3 shrink-0 flex flex-col justify-between">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "general"
                    ? "bg-app-primary text-app-primary-fg shadow-2xs font-bold"
                    : "text-app-text hover:bg-app-sidebar-hover hover:text-app-accent"
                }`}
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "ai"
                    ? "bg-app-primary text-app-primary-fg shadow-2xs font-bold"
                    : "text-app-text hover:bg-app-sidebar-hover hover:text-app-accent"
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>AI Translation</span>
              </button>
            </div>

            {/* Bottom-left of setting window: Version */}
            <div className="pt-3 px-1 text-left">
              <span className="text-[11px] font-medium text-app-text-muted tracking-wide select-none">
                v{APP_VERSION}
              </span>
            </div>
          </aside>

          {/* Right Tab Content Panel */}
          <main className="flex-1 p-5 overflow-y-auto space-y-4 bg-app-canvas">
            {activeTab === "general" && (
              <>
                {/* Card 1: Theme Selector */}
                <div className="p-4 rounded-xl border border-app-card-border bg-app-card transition-colors">
                  <ThemeSelector
                    theme={theme}
                    onSelectTheme={handleSelectTheme}
                  />
                </div>

                {/* Card 2: Software Updates */}
                <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-app-text">
                        Automatic Updates
                      </h3>
                      <p className="text-xs text-app-text-muted mt-0.5">
                        Check for newer versions automatically on startup
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleAutoUpdate(!checkUpdates)}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      title="Toggle auto update"
                    >
                      <span className="text-xs font-semibold text-app-text">
                        Enabled
                      </span>
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                          checkUpdates
                            ? "bg-app-primary"
                            : "bg-app-card-inner-border"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            checkUpdates ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {/* Row 2: Automatically Download Updates */}
                  <div className="pt-3 border-t border-app-card-inner-border flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-app-text">
                        Automatically Download Updates
                      </h4>
                      <p className="text-[11px] text-app-text-muted mt-0.5">
                        Download delta updates silently in background and notify
                        when ready (never auto-restarts)
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleToggleAutoDownload(!autoDownloadUpdates)
                      }
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                      title="Toggle auto download"
                    >
                      <span className="text-xs font-semibold text-app-text">
                        {autoDownloadUpdates ? "Enabled" : "Disabled"}
                      </span>
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                          autoDownloadUpdates
                            ? "bg-app-primary"
                            : "bg-app-card-inner-border"
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                            autoDownloadUpdates
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-app-card-inner-border flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium truncate ${
                          updateStatusType === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : updateStatusType === "error"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-app-text-muted"
                        }`}
                      >
                        {updateStatus}
                      </p>
                      {(latestUpdateInfo || updateUrl) && (
                        <button
                          type="button"
                          onClick={handleOpenUpdate}
                          className="text-[11px] text-app-accent underline font-medium hover:text-app-accent-hover mt-0.5 block cursor-pointer"
                        >
                          Click to download update
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleCheckNow}
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
                      Notify me when jobs finish (synchronization, translation,
                      extraction)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleToggleNotifications(!notificationsEnabled)
                    }
                    className="flex items-center gap-2.5 cursor-pointer select-none group"
                    title="Toggle desktop notifications"
                  >
                    <span className="text-xs font-semibold text-app-text">
                      {notificationsEnabled ? "Enabled" : "Disabled"}
                    </span>
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ${
                        notificationsEnabled
                          ? "bg-app-primary"
                          : "bg-app-card-inner-border"
                      }`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                          notificationsEnabled
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                </div>

                {/* Card 4: About & Developer */}
                <div className="p-4 rounded-xl border border-app-card-border bg-app-card flex items-center justify-between transition-colors">
                  <div>
                    <h3 className="font-bold text-sm text-app-text">
                      Subtitle Sync Studio
                    </h3>
                    <p className="text-xs text-app-text-muted mt-0.5">
                      Developed by DH-0216
                    </p>
                  </div>

                  <button
                    onClick={handleOpenGitHub}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Open GitHub Repository"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            )}

            {activeTab === "ai" && (
              <>
                {/* AI API Provider & Key Card - Exact same style as others */}
                <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3.5 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-app-text">
                        AI Subtitle Translation API
                      </h3>
                      <p className="text-xs text-app-text-muted mt-0.5">
                        Used for translating generated subtitles into languages
                        like Spoken Sinhala
                      </p>
                    </div>

                    <select
                      value={draftProvider}
                      onChange={(e) => {
                        const newProvider = e.target.value as AiProviderId;
                        setDraftProvider(newProvider);
                        setVerifyStatus(null);
                        setAvailableModels([]);
                        setDraftModel("auto");
                        if (draftApiKey.trim()) {
                          handleFetchModels(
                            newProvider,
                            draftApiKey.trim(),
                            true,
                          );
                        }
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-app-input-border bg-app-input text-app-input-text cursor-pointer"
                    >
                      {AI_PROVIDER_LIST.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-app-text">
                      <label>{getAiProvider(draftProvider).label}</label>

                      {getAiProvider(draftProvider).portalUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenKeyPortal(
                              getAiProvider(draftProvider).portalUrl,
                            )
                          }
                          className="text-[11px] text-app-accent hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>
                            {getAiProvider(draftProvider).portalLabel ||
                              "Get API key"}{" "}
                            ↗
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? "text" : "password"}
                          placeholder={
                            getAiProvider(draftProvider).keyPlaceholder
                          }
                          value={draftApiKey}
                          onChange={(e) => {
                            setDraftApiKey(e.target.value);
                            if (verifyStatus) setVerifyStatus(null);
                          }}
                          className="w-full pl-3 pr-9 py-2 text-xs rounded-xl border border-app-input-border bg-app-input text-app-input-text font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text cursor-pointer p-1"
                          title={showKey ? "Hide Key" : "Show Key"}
                        >
                          {showKey ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handlePasteApiKey}
                        className="px-3 py-2 text-xs font-semibold rounded-xl border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Paste from clipboard"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5 text-app-accent" />
                        <span>Paste</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleVerifyApiKey}
                        disabled={isVerifyingKey || !draftApiKey.trim()}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 ${
                          verifyStatus?.valid
                            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                            : verifyStatus?.valid === false
                              ? "border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                              : "border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text"
                        }`}
                        title="Verify API key with provider"
                      >
                        {isVerifyingKey ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-app-accent" />
                            <span>Verifying...</span>
                          </>
                        ) : verifyStatus?.valid ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Valid</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-app-accent" />
                            <span>Verify</span>
                          </>
                        )}
                      </button>
                    </div>

                    {verifyStatus && (
                      <div
                        className={`text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
                          verifyStatus.valid
                            ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                            : "border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {verifyStatus.valid ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{verifyStatus.message}</span>
                      </div>
                    )}

                    {/* Choose AI Model */}
                    <div className="space-y-1.5 pt-2 border-t border-app-card-inner-border">
                      <div className="flex items-center justify-between text-xs font-semibold text-app-text">
                        <div className="flex items-center gap-1.5">
                          <label>AI Model</label>
                          {availableModels.length > 0 && (
                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Live ({availableModels.length})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleFetchModels(
                                draftProvider,
                                draftApiKey,
                                false,
                              )
                            }
                            disabled={isLoadingModels || !draftApiKey.trim()}
                            className="text-[11px] text-app-accent hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:no-underline"
                            title="Fetch latest available models directly from provider API"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${isLoadingModels ? "animate-spin" : ""}`}
                            />
                            <span>
                              {isLoadingModels ? "Fetching..." : "Fetch Models"}
                            </span>
                          </button>
                          <span className="text-[11px] text-app-text-muted font-normal">
                            {availableModels.length > 0
                              ? `${availableModels[0]?.id || ""} recommended`
                              : draftModel && draftModel !== "auto"
                                ? `${draftModel} selected`
                                : "Auto-detected from provider"}
                          </span>
                        </div>
                      </div>

                      <select
                        value={draftModel}
                        onChange={(e) => setDraftModel(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-app-input-border bg-app-input text-app-input-text cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 font-medium"
                      >
                        <option value="auto">
                          Auto-detect latest active model from provider
                          (Recommended)
                        </option>
                        {availableModels.length > 0 ? (
                          <>
                            {draftModel &&
                              draftModel !== "auto" &&
                              !availableModels.some(
                                (m) => m.id === draftModel,
                              ) && (
                                <option value={draftModel}>
                                  {draftModel} (Current selection)
                                </option>
                              )}
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name || m.id}
                              </option>
                            ))}
                          </>
                        ) : (
                          draftModel &&
                          draftModel !== "auto" && (
                            <option value={draftModel}>
                              {draftModel} (Current selection)
                            </option>
                          )
                        )}
                      </select>
                      {availableModels.length === 0 && (
                        <p className="text-[10px] text-app-text-muted">
                          Tip: Click &quot;Fetch Models&quot; or
                          &quot;Verify&quot; to auto-load all current models
                          from {getAiProvider(draftProvider).company}.
                        </p>
                      )}
                    </div>

                    {getAiProvider(draftProvider).notice && (
                      <p className="text-[10px] text-app-text-muted">
                        {getAiProvider(draftProvider).notice}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Translation Prompt & Rules Card */}
                <div className="p-4 rounded-xl border border-app-card-border bg-app-card space-y-3.5 transition-colors">
                  {/* Language Selector Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-app-card-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Languages className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-app-text flex items-center gap-1.5">
                          <span>Target Language</span>
                        </h3>
                        <p className="text-[11px] text-app-text-muted">
                          Configure prompt instructions and colloquial rules per language
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedPromptLang}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setSelectedPromptLang(newCode);
                          const cfg = getLanguageConfig(newCode);
                          if (newCode === "si") {
                            setDraftPrompt(aiPrompt || cfg.defaultPrompt);
                          } else {
                            setDraftPrompt(cfg.defaultPrompt);
                          }
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-app-input-border bg-app-input text-app-input-text focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 cursor-pointer transition-colors"
                      >
                        {TRANSLATION_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.name} — {l.nativeName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Active Language Prompt Header */}
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-app-text flex items-center gap-1.5">
                        <span>{currentLangConfig.name} ({currentLangConfig.nativeName}) Prompt & Rules</span>
                      </h4>
                      <p className="text-xs text-app-text-muted mt-0.5">
                        {currentLangConfig.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDraftPrompt(currentLangConfig.defaultPrompt)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-app-btn-border bg-app-btn hover:bg-app-btn-hover text-app-btn-text transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                      title={`Reset ${currentLangConfig.name} prompt to default`}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={7}
                      value={draftPrompt}
                      onChange={(e) => setDraftPrompt(e.target.value)}
                      placeholder={`Enter custom AI translation instructions and rules for ${currentLangConfig.name}...`}
                      className="w-full p-3 text-xs rounded-xl border border-app-input-border bg-app-input text-app-input-text font-sans leading-relaxed resize-y focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {currentLangConfig.badges.map((badge, idx) => {
                      const badgeStyles = [
                        "bg-app-accent-bg text-app-accent border-app-accent-border",
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
                        "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20",
                        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
                      ];
                      const styleClass = badgeStyles[idx % badgeStyles.length];
                      return (
                        <span
                          key={badge}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${styleClass}`}
                        >
                          {badge}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Save Button for AI Translation Section */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveAiSettings}
                    className="px-5 py-2 rounded-xl bg-app-primary hover:bg-app-primary-hover text-app-primary-fg font-semibold text-xs transition-all shadow-2xs active:scale-[0.99] flex items-center gap-1.5 cursor-pointer"
                  >
                    {savedSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Saved!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
