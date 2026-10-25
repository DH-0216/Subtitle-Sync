"""Dialog windows for FFmpeg setup, software updates, and user settings."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import urllib.request
import webbrowser
from tkinter import messagebox
import customtkinter as ctk

from src.constants import (
    APP_VERSION, GITHUB_REPO, ACCENT, ACCENT_HOVER, DANGER,
    SUCCESS, CARD_BG, CARD_BORDER, INSET_BG, MUTED_TEXT
)
from src.settings import load_settings, save_settings
from src.utils import set_windows_titlebar_color, get_gear_icon, resource_path
from src.media import find_ffmpeg, refresh_environment_path

class FFmpegSetupDialog(ctk.CTkToplevel):
    def __init__(self, parent, on_complete=None):
        super().__init__(parent)
        self.parent = parent
        self.on_complete = on_complete

        self._deactivate_windows_window_header_manipulation = True
        self.title("FFmpeg Setup Required")
        self.geometry("560x420")
        self.minsize(520, 390)
        self.resizable(False, False)
        self.transient(parent)
        self.lift()
        self.focus()

        # Center on parent window
        parent.update_idletasks()
        px = parent.winfo_x()
        py = parent.winfo_y()
        pw = parent.winfo_width()
        ph = parent.winfo_height()
        x = px + max(0, (pw - 560) // 2)
        y = py + max(0, (ph - 420) // 2)
        self.geometry(f"+{x}+{y}")

        is_dark = (self.parent.settings.get("theme", "dark") == "dark") if hasattr(self.parent, "settings") else (ctk.get_appearance_mode() == "Dark")
        self.after(20, lambda: set_windows_titlebar_color(self, is_dark))
        self.after(100, lambda: set_windows_titlebar_color(self, is_dark))
        icon_file = resource_path("app_icon.ico")
        if os.path.isfile(icon_file):
            try:
                self.iconbitmap(icon_file)
            except Exception:
                pass
        self.is_running = False
        self.build_ui()

    def build_ui(self):
        container = ctk.CTkFrame(self, fg_color="transparent")
        container.pack(fill="both", expand=True, padx=28, pady=24)

        # Header with icon and title
        header_row = ctk.CTkFrame(container, fg_color="transparent")
        header_row.pack(fill="x", pady=(0, 10))

        icon_lbl = ctk.CTkLabel(header_row, text="⚡", font=ctk.CTkFont(size=28), text_color=ACCENT)
        icon_lbl.pack(side="left", padx=(0, 10))

        title_lbl = ctk.CTkLabel(
            header_row,
            text="FFmpeg Required",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold")
        )
        title_lbl.pack(side="left")

        # Explanatory text
        desc_lbl = ctk.CTkLabel(
            container,
            text=(
                "To synchronize subtitles with your movie, Subtitle Sync requires FFmpeg to "
                "extract and analyze the speech audio track from your video.\n\n"
                "Would you like to automatically download and set up FFmpeg now?"
            ),
            font=ctk.CTkFont(size=13),
            text_color=MUTED_TEXT,
            justify="left",
            wraplength=500
        )
        desc_lbl.pack(fill="x", pady=(0, 14))

        # Card describing what winget will do
        card = ctk.CTkFrame(container, fg_color=CARD_BG, border_color=CARD_BORDER, border_width=1, corner_radius=12)
        card.pack(fill="x", pady=(0, 16), ipady=8)

        info_lbl = ctk.CTkLabel(
            card,
            text=(
                "💡 Automatic Setup will run Windows Package Manager (winget) to install the "
                "official FFmpeg package globally and configure your system PATH."
            ),
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT,
            justify="left",
            wraplength=480
        )
        info_lbl.pack(padx=16, pady=4, anchor="w")

        # Progress / Status Section
        self.status_lbl = ctk.CTkLabel(
            container,
            text="Status: Ready to install",
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT,
            anchor="w"
        )
        self.status_lbl.pack(fill="x", pady=(0, 6))

        self.progress_bar = ctk.CTkProgressBar(container, height=6, progress_color=ACCENT)
        self.progress_bar.set(0)
        self.progress_bar.pack(fill="x", pady=(0, 18))

        # Buttons Row
        self.actions_row = ctk.CTkFrame(container, fg_color="transparent")
        self.actions_row.pack(fill="x", side="bottom")

        self.install_btn = ctk.CTkButton(
            self.actions_row,
            text="⚡ Setup FFmpeg Automatically",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            height=38,
            command=self.start_install
        )
        self.install_btn.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.manual_btn = ctk.CTkButton(
            self.actions_row,
            text="Manual Setup",
            font=ctk.CTkFont(size=12),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=MUTED_TEXT,
            height=38,
            width=110,
            command=self.open_manual_site
        )
        self.manual_btn.pack(side="left", padx=(0, 8))

        self.cancel_btn = ctk.CTkButton(
            self.actions_row,
            text="Skip / Cancel",
            font=ctk.CTkFont(size=12),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=MUTED_TEXT,
            height=38,
            width=90,
            command=self.destroy
        )
        self.cancel_btn.pack(side="right")

    def open_manual_site(self):
        webbrowser.open("https://ffmpeg.org/download.html")

    def start_install(self):
        if self.is_running:
            return
        self.is_running = True
        self.install_btn.configure(state="disabled", text="Installing FFmpeg...")
        self.manual_btn.configure(state="disabled")
        self.cancel_btn.configure(state="disabled")
        self.progress_bar.configure(mode="indeterminate")
        self.progress_bar.start()
        self.status_lbl.configure(text="Status: Installing official FFmpeg via Windows Package Manager...", text_color=ACCENT)

        threading.Thread(target=self._worker, daemon=True).start()

    def _worker(self):
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        cmd = ["winget", "install", "Gyan.FFmpeg", "--accept-source-agreements", "--accept-package-agreements"]
        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=flags
            )
            for line in proc.stdout:
                line = line.strip()
                if line:
                    clean_line = line[:65]
                    self.after(0, self._set_status_text, clean_line)
            proc.wait()
        except Exception:
            pass

        self.after(0, self._set_status_text, "Configuring environment...")
        refresh_environment_path()
        found = find_ffmpeg()
        if found:
            self.after(0, self._finish_success, found)
        else:
            self.after(0, self._finish_failure)

    def _set_status_text(self, text):
        self.status_lbl.configure(text=f"Status: {text}")

    def _finish_success(self, path):
        self.progress_bar.stop()
        self.progress_bar.set(1.0)
        self.status_lbl.configure(text="Status: FFmpeg ready!", text_color=SUCCESS)
        self.install_btn.configure(text="Completed", fg_color=SUCCESS)
        if hasattr(self.parent, "write"):
            self.parent.write(f"\n[FFmpeg Setup] FFmpeg detected at: {path}\n")
        if hasattr(self.parent, "update_ffmpeg_status"):
            self.parent.update_ffmpeg_status()
        if self.on_complete:
            try:
                self.on_complete()
            except Exception:
                pass
        self.after(1400, self.destroy)

    def _finish_failure(self):
        self.progress_bar.stop()
        self.progress_bar.set(0)
        self.is_running = False
        self.status_lbl.configure(
            text="Status: Automatic setup did not complete. Try 'Manual Setup' button.",
            text_color=DANGER
        )
        self.install_btn.configure(state="normal", text="Retry Setup")
        self.manual_btn.configure(state="normal")
        self.cancel_btn.configure(state="normal")


def parse_version(v_str):
    """Extract semantic version tuple (e.g., 'v1.0.1' -> (1, 0, 1))."""
    clean = re.sub(r'^[vV]', '', str(v_str).strip())
    parts = []
    for part in clean.split('.'):
        digits = re.findall(r'\d+', part)
        parts.append(int(digits[0]) if digits else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


class UpdateDialog(ctk.CTkToplevel):
    def __init__(self, parent, release_data):
        super().__init__(parent)
        self.parent = parent
        self.release_data = release_data
        self.is_downloading = False

        self.new_version = release_data.get("tag_name", "Latest")
        self.release_notes = release_data.get("body", "Bug fixes and performance improvements.").strip()
        self.html_url = release_data.get("html_url", f"https://github.com/{GITHUB_REPO}/releases/latest")

        self._deactivate_windows_window_header_manipulation = True
        self.title("Software Update Available")
        self.geometry("580x480")
        self.minsize(520, 430)
        self.resizable(False, False)
        self.transient(parent)
        self.lift()
        self.focus()

        parent.update_idletasks()
        px = parent.winfo_x()
        py = parent.winfo_y()
        pw = parent.winfo_width()
        ph = parent.winfo_height()
        x = px + max(0, (pw - 580) // 2)
        y = py + max(0, (ph - 480) // 2)
        self.geometry(f"+{x}+{y}")

        is_dark = (self.parent.settings.get("theme", "dark") == "dark") if hasattr(self.parent, "settings") else (ctk.get_appearance_mode() == "Dark")
        self.after(20, lambda: set_windows_titlebar_color(self, is_dark))
        self.after(100, lambda: set_windows_titlebar_color(self, is_dark))
        icon_file = resource_path("app_icon.ico")
        if os.path.isfile(icon_file):
            try:
                self.iconbitmap(icon_file)
            except Exception:
                pass
        self.build_ui()

    def build_ui(self):
        container = ctk.CTkFrame(self, fg_color="transparent")
        container.pack(fill="both", expand=True, padx=26, pady=22)

        # Header with icon and version info
        header_row = ctk.CTkFrame(container, fg_color="transparent")
        header_row.pack(fill="x", pady=(0, 6))

        icon_lbl = ctk.CTkLabel(header_row, text="⚡", font=ctk.CTkFont(size=26), text_color=ACCENT)
        icon_lbl.pack(side="left", padx=(0, 8))

        title_lbl = ctk.CTkLabel(
            header_row,
            text=f"Update Available: {self.new_version}",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold")
        )
        title_lbl.pack(side="left")

        ver_badge = ctk.CTkLabel(
            header_row,
            text=f"v{APP_VERSION} → {self.new_version}",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=SUCCESS,
            fg_color=BADGE_BG,
            corner_radius=6,
            padx=8,
            pady=2
        )
        ver_badge.pack(side="right")

        notes_title = ctk.CTkLabel(
            container,
            text="What's New in this update:",
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w"
        )
        notes_title.pack(fill="x", pady=(10, 4))

        # Release notes box
        self.textbox = ctk.CTkTextbox(
            container,
            height=170,
            corner_radius=10,
            fg_color=CARD_BG,
            border_color=CARD_BORDER,
            border_width=1,
            font=ctk.CTkFont(size=12)
        )
        self.textbox.pack(fill="x", pady=(0, 14))
        self.textbox.insert("1.0", self.release_notes if self.release_notes else "Bug fixes and performance improvements.")
        self.textbox.configure(state="disabled")

        # Progress & Status
        self.status_lbl = ctk.CTkLabel(
            container,
            text="Ready to download and install update.",
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT,
            anchor="w"
        )
        self.status_lbl.pack(fill="x", pady=(0, 6))

        self.progress_bar = ctk.CTkProgressBar(container, height=6, progress_color=ACCENT)
        self.progress_bar.set(0)
        self.progress_bar.pack(fill="x", pady=(0, 18))

        # Action buttons
        self.actions_row = ctk.CTkFrame(container, fg_color="transparent")
        self.actions_row.pack(fill="x", side="bottom")

        self.install_btn = ctk.CTkButton(
            self.actions_row,
            text="⚡ Download & Install Update",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            height=38,
            command=self.start_download
        )
        self.install_btn.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.view_btn = ctk.CTkButton(
            self.actions_row,
            text="View on GitHub",
            font=ctk.CTkFont(size=12),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=MUTED_TEXT,
            height=38,
            width=110,
            command=self.open_github_release
        )
        self.view_btn.pack(side="left", padx=(0, 8))

        self.cancel_btn = ctk.CTkButton(
            self.actions_row,
            text="Later",
            font=ctk.CTkFont(size=12),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=MUTED_TEXT,
            height=38,
            width=70,
            command=self.destroy
        )
        self.cancel_btn.pack(side="right")

    def open_github_release(self):
        webbrowser.open(self.html_url)

    def start_download(self):
        if self.is_downloading:
            return
        self.is_downloading = True
        self.install_btn.configure(state="disabled", text="Downloading...")
        self.view_btn.configure(state="disabled")
        self.cancel_btn.configure(state="disabled")
        self.progress_bar.set(0)
        self.status_lbl.configure(text="Connecting to GitHub Releases...", text_color=ACCENT)

        assets = self.release_data.get("assets", [])
        download_url = None
        filename = "SubtitleSync-Update.exe"

        # Prefer Setup installer, fallback to standalone exe
        for a in assets:
            name = a.get("name", "")
            if "setup" in name.lower() and name.endswith(".exe"):
                download_url = a.get("browser_download_url")
                filename = name
                break
        if not download_url:
            for a in assets:
                name = a.get("name", "")
                if name.endswith(".exe"):
                    download_url = a.get("browser_download_url")
                    filename = name
                    break

        if not download_url:
            webbrowser.open(self.html_url)
            self.destroy()
            return

        threading.Thread(target=self._download_worker, args=(download_url, filename), daemon=True).start()

    def _download_worker(self, download_url, filename):
        try:
            dest_path = os.path.join(tempfile.gettempdir(), filename)
            req = urllib.request.Request(download_url, headers={"User-Agent": "SubtitleSync-App"})
            with urllib.request.urlopen(req, timeout=40) as resp:
                total_size = int(resp.headers.get("Content-Length", 0))
                downloaded = 0
                chunk_size = 64 * 1024
                with open(dest_path, "wb") as f:
                    while True:
                        chunk = resp.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            pct = downloaded / total_size
                            mb_down = downloaded / (1024 * 1024)
                            mb_tot = total_size / (1024 * 1024)
                            self.after(0, self._update_progress, pct, f"Downloading update: {mb_down:.1f} MB / {mb_tot:.1f} MB ({int(pct*100)}%)")

            self.after(0, self._install_and_restart, dest_path)
        except Exception as e:
            self.after(0, self._on_download_error, str(e))

    def _update_progress(self, pct, text):
        self.progress_bar.set(pct)
        self.status_lbl.configure(text=text)

    def _install_and_restart(self, dest_path):
        self.progress_bar.set(1.0)
        self.status_lbl.configure(text="✅ Update downloaded! Launching installer...", text_color=SUCCESS)
        self.install_btn.configure(text="Restarting...")
        self.after(1200, lambda: self._launch_and_exit(dest_path))

    def _launch_and_exit(self, dest_path):
        try:
            subprocess.Popen([dest_path])
        except Exception:
            pass
        self.parent.destroy()
        sys.exit(0)

    def _on_download_error(self, err_msg):
        self.is_downloading = False
        self.progress_bar.set(0)
        self.status_lbl.configure(text=f"⚠️ Download failed. Try 'View on GitHub'.", text_color=DANGER)
        self.install_btn.configure(state="normal", text="Retry Download")
        self.view_btn.configure(state="normal")
        self.cancel_btn.configure(state="normal")


class SettingsDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.parent = parent
        self._deactivate_windows_window_header_manipulation = True
        self.title("Settings")
        self.geometry("520x460")
        self.minsize(480, 420)
        self.resizable(False, False)
        self.transient(parent)
        self.lift()
        self.focus()

        parent.update_idletasks()
        px = parent.winfo_x()
        py = parent.winfo_y()
        pw = parent.winfo_width()
        ph = parent.winfo_height()
        x = px + max(0, (pw - 520) // 2)
        y = py + max(0, (ph - 460) // 2)
        self.geometry(f"+{x}+{y}")

        is_dark = (self.parent.settings.get("theme", "dark") == "dark") if hasattr(self.parent, "settings") else (ctk.get_appearance_mode() == "Dark")
        self.after(20, lambda: set_windows_titlebar_color(self, is_dark))
        self.after(100, lambda: set_windows_titlebar_color(self, is_dark))
        icon_file = resource_path("app_icon.ico")
        if os.path.isfile(icon_file):
            try:
                self.iconbitmap(icon_file)
            except Exception:
                pass
        self.build_ui()

    def build_ui(self):
        container = ctk.CTkFrame(self, fg_color="transparent")
        container.pack(fill="both", expand=True, padx=26, pady=22)

        # Header
        header_row = ctk.CTkFrame(container, fg_color="transparent")
        header_row.pack(fill="x", pady=(0, 16))

        icon_lbl = ctk.CTkLabel(header_row, text="", image=get_gear_icon(26))
        icon_lbl.pack(side="left", padx=(0, 10))

        title_lbl = ctk.CTkLabel(
            header_row,
            text="Settings & Preferences",
            font=ctk.CTkFont(family="Segoe UI", size=20, weight="bold")
        )
        title_lbl.pack(side="left")

        # Card 1: Appearance
        card_theme = ctk.CTkFrame(container, fg_color=CARD_BG, border_color=CARD_BORDER, border_width=1, corner_radius=12)
        card_theme.pack(fill="x", pady=(0, 12), ipady=6)

        theme_row = ctk.CTkFrame(card_theme, fg_color="transparent")
        theme_row.pack(fill="x", padx=16, pady=8)
        theme_row.grid_columnconfigure(0, weight=1)

        theme_text = ctk.CTkFrame(theme_row, fg_color="transparent")
        theme_text.grid(row=0, column=0, sticky="w")

        ctk.CTkLabel(theme_text, text="Appearance Mode", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(theme_text, text="Toggle between Dark and Light interface themes", font=ctk.CTkFont(size=11), text_color=MUTED_TEXT).pack(anchor="w")

        current_mode = self.parent.settings.get("theme", "dark")
        self.theme_switch = ctk.CTkSwitch(
            theme_row,
            text="Dark mode",
            font=ctk.CTkFont(size=12),
            command=self.on_toggle_theme,
            progress_color=ACCENT
        )
        if current_mode == "dark":
            self.theme_switch.select()
        else:
            self.theme_switch.deselect()
        self.theme_switch.grid(row=0, column=1, sticky="e")

        # Card 2: Software Updates
        card_updates = ctk.CTkFrame(container, fg_color=CARD_BG, border_color=CARD_BORDER, border_width=1, corner_radius=12)
        card_updates.pack(fill="x", pady=(0, 12), ipady=6)

        up_row = ctk.CTkFrame(card_updates, fg_color="transparent")
        up_row.pack(fill="x", padx=16, pady=(8, 4))
        up_row.grid_columnconfigure(0, weight=1)

        up_text = ctk.CTkFrame(up_row, fg_color="transparent")
        up_text.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(up_text, text="Automatic Updates", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(up_text, text="Check for newer versions automatically on startup", font=ctk.CTkFont(size=11), text_color=MUTED_TEXT).pack(anchor="w")

        self.up_switch = ctk.CTkSwitch(
            up_row,
            text="Enabled",
            font=ctk.CTkFont(size=12),
            command=self.on_toggle_auto_update,
            progress_color=ACCENT
        )
        if self.parent.settings.get("check_updates_startup", True):
            self.up_switch.select()
        else:
            self.up_switch.deselect()
        self.up_switch.grid(row=0, column=1, sticky="e")

        # Manual check row
        manual_row = ctk.CTkFrame(card_updates, fg_color="transparent")
        manual_row.pack(fill="x", padx=16, pady=(4, 8))
        manual_row.grid_columnconfigure(0, weight=1)

        self.check_status_lbl = ctk.CTkLabel(
            manual_row,
            text=f"Current Version: v{APP_VERSION}",
            font=ctk.CTkFont(size=11),
            text_color=MUTED_TEXT
        )
        self.check_status_lbl.grid(row=0, column=0, sticky="w")

        self.check_now_btn = ctk.CTkButton(
            manual_row,
            text="🔍 Check Now",
            font=ctk.CTkFont(size=11),
            height=26,
            width=100,
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=("gray20", "gray85"),
            hover_color=("gray90", "gray25"),
            command=self.manual_check_update
        )
        self.check_now_btn.grid(row=0, column=1, sticky="e")

        # Card 3: About
        card_about = ctk.CTkFrame(container, fg_color=CARD_BG, border_color=CARD_BORDER, border_width=1, corner_radius=12)
        card_about.pack(fill="x", pady=(0, 16), ipady=6)

        about_row = ctk.CTkFrame(card_about, fg_color="transparent")
        about_row.pack(fill="x", padx=16, pady=8)
        about_row.grid_columnconfigure(0, weight=1)

        about_info = ctk.CTkFrame(about_row, fg_color="transparent")
        about_info.grid(row=0, column=0, sticky="w")
        ctk.CTkLabel(about_info, text="Subtitle Sync Studio", font=ctk.CTkFont(size=13, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(about_info, text="Developed by DH-0216", font=ctk.CTkFont(size=11), text_color=MUTED_TEXT).pack(anchor="w")

        repo_btn = ctk.CTkButton(
            about_row,
            text="GitHub ↗",
            font=ctk.CTkFont(size=11),
            height=26,
            width=75,
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=("gray20", "gray85"),
            hover_color=("gray90", "gray25"),
            command=lambda: webbrowser.open(f"https://github.com/{GITHUB_REPO}")
        )
        repo_btn.grid(row=0, column=1, sticky="e")

        # Close button
        close_btn = ctk.CTkButton(
            container,
            text="Done",
            font=ctk.CTkFont(size=13, weight="bold"),
            height=36,
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            command=self.destroy
        )
        close_btn.pack(fill="x", side="bottom")

    def destroy(self):
        super().destroy()
        try:
            self.parent.focus_force()
        except Exception:
            pass

    def on_toggle_theme(self):
        new_theme = "dark" if self.theme_switch.get() else "light"
        self.parent.settings["theme"] = new_theme
        save_settings(self.parent.settings)
        ctk.set_appearance_mode(new_theme)
        set_windows_titlebar_color(self.parent, new_theme == "dark")
        set_windows_titlebar_color(self, new_theme == "dark")
        try:
            self.focus_force()
        except Exception:
            pass

    def on_toggle_auto_update(self):
        val = bool(self.up_switch.get())
        self.parent.settings["check_updates_startup"] = val
        save_settings(self.parent.settings)

    def manual_check_update(self):
        self.check_now_btn.configure(state="disabled", text="Checking...")
        self.check_status_lbl.configure(text="Checking GitHub Releases...")
        threading.Thread(target=self._manual_worker, daemon=True).start()

    def _manual_worker(self):
        try:
            url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"
            req = urllib.request.Request(url, headers={"User-Agent": "SubtitleSync-App"})
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    tag = data.get("tag_name", "")
                    if parse_version(tag) > parse_version(APP_VERSION):
                        self.after(0, self._on_manual_found, data)
                        return
                    else:
                        self.after(0, self._on_manual_up_to_date)
                        return
        except Exception:
            pass
        self.after(0, self._on_manual_error)

    def _on_manual_found(self, data):
        self.check_now_btn.configure(state="normal", text="🔍 Check Now")
        self.check_status_lbl.configure(text=f"Update available: {data.get('tag_name')}", text_color=SUCCESS)
        self.parent.on_update_found(data)
        self.destroy()
        self.parent.show_update_dialog()

    def _on_manual_up_to_date(self):
        self.check_now_btn.configure(state="normal", text="🔍 Check Now")
        self.check_status_lbl.configure(text=f"✅ You're on the latest version (v{APP_VERSION})", text_color=SUCCESS)

    def _on_manual_error(self):
        self.check_now_btn.configure(state="normal", text="🔍 Check Now")
        self.check_status_lbl.configure(text="Could not connect to GitHub.", text_color=DANGER)


