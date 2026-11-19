import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { EXTERNAL_LINKS, getGeminiVerifyUrl } from "@shared/links";
import { formatUserFriendlyError } from "@shared/errorUtils";
import { APP_VERSION, compareVersions } from "@shared/version";
import { AiProviderId, getAiProvider } from "@shared/aiModels";
import { getLanguageConfig } from "@shared/translationPrompts";
import { ThemeMode } from "../common";
import { useSettingsStore, useUIStore, useUpdaterStore } from "../../store";

export interface SettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: "general" | "ai";
  theme?: ThemeMode;
  setTheme?: (t: ThemeMode) => void;
  checkUpdates?: boolean;
  setCheckUpdates?: (c: boolean) => void;
  autoDownloadUpdates?: boolean;
  setAutoDownloadUpdates?: (a: boolean) => void;
  notificationsEnabled?: boolean;
  setNotificationsEnabled?: (n: boolean) => void;
  defaultSubtitleFormat?: 'srt' | 'vtt' | 'txt';
  setDefaultSubtitleFormat?: (fmt: 'srt' | 'vtt' | 'txt') => void;
  aiApiKey?: string;
  setAiApiKey?: (k: string) => void;
  aiProvider?: AiProviderId;
  setAiProvider?: (p: AiProviderId) => void;
  aiModel?: string;
  setAiModel?: (m: string) => void;
  aiPrompt?: string;
  setAiPrompt?: (p: string) => void;
  aiPromptsByLang?: Record<string, string>;
  setAiPromptsByLang?: (p: Record<string, string>) => void;
  onSave?: () => void;
  onOpenUpdateModal?: (info: any) => void;
}

export function useSettingsModalState(props: SettingsModalProps = {}) {
  const storeSettings = useSettingsStore();
  const storeUI = useUIStore();

  const isOpen = props.isOpen ?? storeUI.settingsModalOpen;
  const onClose = props.onClose ?? (() => storeUI.setSettingsModalOpen(false));
  const initialTab = props.initialTab ?? storeUI.settingsInitialTab;
  const theme = props.theme ?? storeSettings.theme;
  const setTheme = props.setTheme ?? storeSettings.setTheme;
  const checkUpdates = props.checkUpdates ?? storeSettings.checkUpdates;
  const setCheckUpdates = props.setCheckUpdates ?? storeSettings.setCheckUpdates;
  const autoDownloadUpdates = props.autoDownloadUpdates ?? storeSettings.autoDownloadUpdates;
  const setAutoDownloadUpdates = props.setAutoDownloadUpdates ?? storeSettings.setAutoDownloadUpdates;
  const notificationsEnabled = props.notificationsEnabled ?? storeSettings.notificationsEnabled;
  const setNotificationsEnabled = props.setNotificationsEnabled ?? storeSettings.setNotificationsEnabled;
  const defaultSubtitleFormat = props.defaultSubtitleFormat ?? storeSettings.defaultSubtitleFormat;
  const setDefaultSubtitleFormat = props.setDefaultSubtitleFormat ?? storeSettings.setDefaultSubtitleFormat;
  const aiApiKey = props.aiApiKey ?? storeSettings.aiApiKey;
  const setAiApiKey = props.setAiApiKey ?? storeSettings.setAiApiKey;
  const aiProvider = props.aiProvider ?? storeSettings.aiProvider;
  const setAiProvider = props.setAiProvider ?? storeSettings.setAiProvider;
  const aiModel = props.aiModel ?? storeSettings.aiModel;
  const setAiModel = props.setAiModel ?? storeSettings.setAiModel;
  const aiPrompt = props.aiPrompt ?? storeSettings.aiPrompt;
  const setAiPrompt = props.setAiPrompt ?? storeSettings.setAiPrompt;
  const aiPromptsByLang = props.aiPromptsByLang ?? storeSettings.aiPromptsByLang;
  const setAiPromptsByLang = props.setAiPromptsByLang ?? storeSettings.setAiPromptsByLang;
  const onSave = props.onSave;
  const onOpenUpdateModal =
    props.onOpenUpdateModal ??
    ((info: any) => {
      useUpdaterStore.getState().setAppUpdateInfo(info);
      useUpdaterStore.getState().setUpdateModalOpen(true);
    });

  const [activeTab, setActiveTab] = useState<"general" | "ai">(initialTab);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>(
    `Current Version: v${APP_VERSION}`
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
  const [selectedPromptLang, setSelectedPromptLang] = useState<string>("si");
  const [draftPromptsByLang, setDraftPromptsByLang] = useState<Record<string, string>>({
    si: aiPrompt || getLanguageConfig("si").defaultPrompt
  });
  const currentLangConfig = getLanguageConfig(selectedPromptLang);
  const activePromptValue =
    draftPromptsByLang[selectedPromptLang] ?? currentLangConfig.defaultPrompt;
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
    silent: boolean = false
  ) => {
    if (!key.trim()) return;
    if (!navigator.onLine) {
      if (!silent) {
        toast.error(
          "You are offline. Connect to the internet to fetch latest models.",
          { icon: "📡" }
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
              duration: 2500
            });
          }
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

  useEffect(() => {
    if (isOpen && aiApiKey.trim()) {
      handleFetchModels(aiProvider, aiApiKey.trim(), true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setDraftApiKey(aiApiKey);
      setDraftProvider(aiProvider);
      setDraftModel(aiModel || "auto");
      setDraftPromptsByLang({
        si: aiPrompt || getLanguageConfig("si").defaultPrompt,
        ...aiPromptsByLang
      });
      setSavedSuccess(false);
      setVerifyStatus(null);
    }
  }, [isOpen, initialTab, aiApiKey, aiProvider, aiModel, aiPrompt, aiPromptsByLang]);

  const handleSaveAiSettings = () => {
    const finalSiPrompt = draftPromptsByLang["si"] || aiPrompt;
    const keyChanged = draftApiKey !== aiApiKey;
    const promptChanged = finalSiPrompt !== aiPrompt;
    const providerChanged = draftProvider !== aiProvider;
    const modelChanged = draftModel !== aiModel;

    setAiApiKey(draftApiKey);
    setAiProvider(draftProvider);
    if (setAiModel) setAiModel(draftModel);
    setAiPrompt(finalSiPrompt);
    if (setAiPromptsByLang) setAiPromptsByLang(draftPromptsByLang);

    window.api?.settings?.save({
      theme,
      checkUpdates,
      autoDownloadUpdates,
      notificationsEnabled,
      aiApiKey: draftApiKey,
      aiProvider: draftProvider,
      aiModel: draftModel,
      aiPrompt: finalSiPrompt,
      aiPromptsByLang: draftPromptsByLang
    });

    if (onSave) {
      onSave();
    }

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
        { icon: "📡" }
      );
      setVerifyStatus({
        valid: false,
        message: "Offline: Internet connection required to verify API key."
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
        const providerMeta = getAiProvider(draftProvider);
        if (draftProvider === "gemini") {
          const response = await fetch(getGeminiVerifyUrl(cleanKey));
          if (response.ok) {
            const data = await response.json().catch(() => null);
            const rawModels = (data?.models || [])
              .filter((m: any) =>
                m.supportedGenerationMethods?.includes("generateContent")
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
              models
            };
          } else {
            const data = await response.json().catch(() => null);
            const errMsg = data?.error?.message || `HTTP ${response.status}`;
            res = {
              valid: false,
              message: `Invalid ${providerMeta.name} Key: ${errMsg}`
            };
          }
        } else {
          const response = await fetch(EXTERNAL_LINKS.OPENAI_MODELS_API, {
            headers: { Authorization: `Bearer ${cleanKey}` }
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
              models
            };
          } else {
            const data = await response.json().catch(() => null);
            const errMsg = data?.error?.message || `HTTP ${response.status}`;
            res = {
              valid: false,
              message: `Invalid ${providerMeta.name} Key: ${errMsg}`
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

  const handleSelectTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  const handleToggleAutoUpdate = (enabled: boolean) => {
    setCheckUpdates(enabled);
    window.api?.settings?.save({
      theme,
      checkUpdates: enabled,
      autoDownloadUpdates,
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    });
  };

  const handleToggleAutoDownload = (enabled: boolean) => {
    if (setAutoDownloadUpdates) {
      setAutoDownloadUpdates(enabled);
    }
    window.api?.settings?.save({
      theme,
      checkUpdates,
      autoDownloadUpdates: enabled,
      notificationsEnabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    });
    toast.success(
      enabled
        ? "Automatic update downloads enabled (will notify when ready)"
        : "Automatic update downloads disabled"
    );
  };

  const handleToggleNotifications = (enabled: boolean) => {
    if (setNotificationsEnabled) {
      setNotificationsEnabled(enabled);
    }
    window.api?.settings?.save({
      theme,
      checkUpdates,
      autoDownloadUpdates,
      notificationsEnabled: enabled,
      aiApiKey,
      aiProvider,
      aiModel,
      aiPrompt
    });
    toast.success(
      enabled
        ? "Desktop notifications enabled"
        : "Desktop notifications disabled"
    );
  };

  const handleSelectDefaultSubtitleFormat = (format: 'srt' | 'vtt' | 'txt') => {
    if (setDefaultSubtitleFormat) {
      setDefaultSubtitleFormat(format);
    }
    window.api?.settings?.save({
      defaultSubtitleFormat: format
    });
    toast.success(`Default subtitle format set to .${format.toUpperCase()}`);
  };

  const handleCheckNow = async () => {
    if (!navigator.onLine) {
      setUpdateStatus(
        "⚠️ Could not check for updates. No internet connection."
      );
      setUpdateStatusType("error");
      toast.error("Could not check for updates. No internet connection.", {
        icon: "📡"
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
            "⚠️ Could not check for updates. No internet connection."
          );
          setUpdateStatusType("error");
          toast.error("Could not check for updates. No internet connection.", {
            icon: "📡"
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
            icon: "✅"
          });
        }
      } else {
        const res = await fetch(EXTERNAL_LINKS.GITHUB_LATEST_RELEASE_API, {
          headers: { Accept: "application/vnd.github.v3+json" }
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
                (a.name || "").toLowerCase() === "subtitlesync-setup.exe"
            ) ||
            assets.find(
              (a: any) =>
                (a.name || "").toLowerCase().includes("setup") &&
                (a.name || "").endsWith(".exe")
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
            releaseUrl: data.html_url || EXTERNAL_LINKS.GITHUB_RELEASES_PAGE
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
            icon: "✅"
          });
        }
      }
    } catch (e: any) {
      setUpdateStatus(
        "⚠️ Could not check for updates. No internet connection."
      );
      setUpdateStatusType("error");
      toast.error("Could not check for updates. No internet connection.", {
        icon: "📡"
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

  return {
    isOpen,
    theme,
    checkUpdates,
    autoDownloadUpdates,
    notificationsEnabled,
    activeTab,
    setActiveTab,
    currentLangConfig,
    activePromptValue,
    selectedPromptLang,
    setSelectedPromptLang,
    draftApiKey,
    setDraftApiKey,
    draftProvider,
    setDraftProvider,
    draftModel,
    setDraftModel,
    setDraftPromptsByLang,
    showKey,
    setShowKey,
    savedSuccess,
    isVerifyingKey,
    verifyStatus,
    setVerifyStatus,
    availableModels,
    setAvailableModels,
    isLoadingModels,
    checkingUpdate,
    updateStatus,
    updateStatusType,
    updateUrl,
    handleFetchModels,
    handleVerifyApiKey,
    handlePasteApiKey,
    handleSaveAiSettings,
    handleSelectTheme,
    handleToggleAutoUpdate,
    handleToggleAutoDownload,
    handleToggleNotifications,
    defaultSubtitleFormat,
    handleSelectDefaultSubtitleFormat,
    handleCheckNow,
    handleOpenGitHub,
    handleOpenKeyPortal,
    handleOpenUpdate,
    handleClose
  };
}
