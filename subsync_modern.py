"""Subtitle Sync (modern UI) - a desktop app that wraps ffsubsync.

Install once:   pip install customtkinter ffsubsync
Run:            python subsync_modern.py
(ffmpeg must also be installed - ffsubsync uses it to read the movie's audio.)
"""
import os
import shutil
import subprocess
import sys
import threading
import webbrowser
from tkinter import filedialog, messagebox

import customtkinter as ctk

# Color palette & themes
ACCENT = "#6366F1"          # Modern Indigo
ACCENT_HOVER = "#4F46E5"
DANGER = "#EF4444"          # Modern Red
DANGER_HOVER = "#DC2626"
SUCCESS = "#10B981"         # Modern Emerald
WARNING = "#F59E0B"

# Theme-aware surface colors (light, dark)
CARD_BG = ("#FFFFFF", "#1E222D")
CARD_BORDER = ("#E2E8F0", "#2E3446")
INSET_BG = ("#F1F5F9", "#14171F")
SUB_ITEM_BG = ("#F8FAFC", "#252B3B")
BADGE_BG = ("#EEF2FF", "#2E3258")
BADGE_FG = ("#4F46E5", "#A5B4FC")
MUTED_TEXT = ("#64748B", "#94A3B8")

VIDEO_TYPES = [("Video files", "*.mkv *.mp4 *.avi *.mov *.m4v *.webm"), ("All files", "*.*")]
SUB_TYPES = [("Subtitle files", "*.srt *.ass *.ssa *.vtt"), ("All files", "*.*")]


def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller."""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(base_path, relative_path)


def refresh_environment_path():
    """Reload User and System PATH from Windows Registry so winget installations are recognized immediately."""
    if os.name != "nt":
        return
    paths = []
    try:
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Environment", 0, winreg.KEY_READ) as k:
                val, _ = winreg.QueryValueEx(k, "Path")
                if val:
                    paths.extend(val.split(";"))
        except Exception:
            pass
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", 0, winreg.KEY_READ) as k:
                val, _ = winreg.QueryValueEx(k, "Path")
                if val:
                    paths.extend(val.split(";"))
        except Exception:
            pass
    except Exception:
        pass

    current = os.environ.get("PATH", "").split(";")
    for p in paths:
        p = p.strip()
        if p and p not in current and os.path.isdir(p):
            current.insert(0, p)
    os.environ["PATH"] = ";".join(current)


def find_ffmpeg():
    """Locate ffmpeg executable from PATH, local directories, or standard locations."""
    refresh_environment_path()
    found = shutil.which("ffmpeg")
    if found:
        return found

    # Check next to executable or script
    app_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    candidates = [
        os.path.join(app_dir, "ffmpeg.exe"),
        os.path.join(app_dir, "bin", "ffmpeg.exe"),
        r"C:\Program Files\FFmpeg\bin\ffmpeg.exe",
        r"C:\ffmpeg\bin\ffmpeg.exe",
    ]
    for c in candidates:
        if os.path.isfile(c):
            parent = os.path.dirname(c)
            os.environ["PATH"] = parent + os.pathsep + os.environ.get("PATH", "")
            return c

    # Check WinGet package location
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        winget_dir = os.path.join(local_app_data, "Microsoft", "WinGet", "Packages")
        if os.path.isdir(winget_dir):
            for root, dirs, files in os.walk(winget_dir):
                if "ffmpeg.exe" in files:
                    full_p = os.path.join(root, "ffmpeg.exe")
                    os.environ["PATH"] = root + os.pathsep + os.environ.get("PATH", "")
                    return full_p
    return None


def build_command(video, sub, out):
    exe = shutil.which("ffs") or shutil.which("ffsubsync")
    base = [exe] if exe else [sys.executable, "-m", "ffsubsync"]
    return base + [video, "-i", sub, "-o", out]


class FFmpegSetupDialog(ctk.CTkToplevel):
    def __init__(self, parent, on_complete=None):
        super().__init__(parent)
        self.parent = parent
        self.on_complete = on_complete

        self.title("FFmpeg Setup Required")
        self.geometry("560x420")
        self.minsize(520, 390)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()

        # Center on parent window
        parent.update_idletasks()
        px = parent.winfo_x()
        py = parent.winfo_y()
        pw = parent.winfo_width()
        ph = parent.winfo_height()
        x = px + max(0, (pw - 560) // 2)
        y = py + max(0, (ph - 420) // 2)
        self.geometry(f"+{x}+{y}")

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


def short(path, n=58):
    name = os.path.basename(path)
    return name if len(name) <= n else name[: n - 3] + "..."


class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")
        self.title("Subtitle Sync Studio")
        self.geometry("820x780")
        self.minsize(720, 680)

        icon_file = resource_path("app_icon.ico")
        if os.path.isfile(icon_file):
            try:
                self.iconbitmap(icon_file)
            except Exception:
                pass

        self.video_path = ""
        self.subs = []
        self.running = False
        self.cancelled = False
        self.proc = None
        self.last_output_dir = None

        self.build_ui()
        self.after(600, self.check_ffmpeg_initial)

    # ---------- UI ----------
    def build_ui(self):
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        # Header Section
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.grid(row=0, column=0, sticky="ew", padx=28, pady=(20, 14))
        header.grid_columnconfigure(0, weight=1)

        title_box = ctk.CTkFrame(header, fg_color="transparent")
        title_box.grid(row=0, column=0, sticky="w")

        title_row = ctk.CTkFrame(title_box, fg_color="transparent")
        title_row.pack(anchor="w")

        title_icon = ctk.CTkLabel(
            title_row,
            text="⚡",
            font=ctk.CTkFont(size=24),
            text_color=ACCENT
        )
        title_icon.pack(side="left", padx=(0, 8))

        ctk.CTkLabel(
            title_row,
            text="Subtitle Sync",
            font=ctk.CTkFont(family="Segoe UI", size=24, weight="bold")
        ).pack(side="left")

        ctk.CTkLabel(
            title_box,
            text="Automatically synchronize out-of-sync subtitles with your movie's reference audio",
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT
        ).pack(anchor="w", pady=(3, 0))

        # Right side header actions: theme toggle
        header_actions = ctk.CTkFrame(header, fg_color="transparent")
        header_actions.grid(row=0, column=1, sticky="e")

        self.theme_switch = ctk.CTkSwitch(
            header_actions,
            text="Dark mode",
            font=ctk.CTkFont(size=12),
            command=self.toggle_theme,
            progress_color=ACCENT
        )
        self.theme_switch.select()
        self.theme_switch.pack(side="right")

        self.ffmpeg_btn = ctk.CTkButton(
            header_actions,
            text="Checking FFmpeg...",
            font=ctk.CTkFont(size=11),
            height=26,
            corner_radius=13,
            command=self.show_ffmpeg_dialog
        )
        self.ffmpeg_btn.pack(side="right", padx=(0, 14))

        # Container for Steps
        self.cards_container = ctk.CTkFrame(self, fg_color="transparent")
        self.cards_container.grid(row=1, column=0, sticky="ew", padx=28, pady=0)
        self.cards_container.grid_columnconfigure(0, weight=1)

        # ---------------- STEP 1: Movie File ----------------
        card1 = self.create_step_card(
            step_num="STEP 1",
            title="Movie Reference",
            subtitle="Select the video file containing the source audio track"
        )
        card1.grid(row=0, column=0, sticky="ew", pady=(0, 12))
        card1.grid_columnconfigure(0, weight=1)

        # Step 1 Content: sleek file slot
        v_slot = ctk.CTkFrame(
            card1,
            fg_color=INSET_BG,
            corner_radius=10,
            border_width=1,
            border_color=CARD_BORDER
        )
        v_slot.grid(row=1, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))
        v_slot.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            v_slot,
            text="🎬",
            font=ctk.CTkFont(size=16)
        ).grid(row=0, column=0, padx=(12, 6), pady=10)

        self.video_label = ctk.CTkLabel(
            v_slot,
            text="No movie selected yet (select .mp4, .mkv, .avi, etc.)",
            anchor="w",
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT
        )
        self.video_label.grid(row=0, column=1, sticky="ew", padx=(0, 10), pady=10)

        ctk.CTkButton(
            v_slot,
            text="Browse Video",
            width=120,
            height=32,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            corner_radius=8,
            command=self.pick_video
        ).grid(row=0, column=2, padx=(0, 10), pady=8)

        # ---------------- STEP 2: Subtitle Files ----------------
        card2 = self.create_step_card(
            step_num="STEP 2",
            title="Subtitle Files",
            subtitle="Add one or multiple subtitles that need synchronization"
        )
        card2.grid(row=1, column=0, sticky="ew", pady=(0, 12))
        card2.grid_columnconfigure(0, weight=1)

        # Subtitle Action Bar (Add & Clear Buttons + Counter)
        sub_toolbar = ctk.CTkFrame(card2, fg_color="transparent")
        sub_toolbar.grid(row=1, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 10))
        sub_toolbar.grid_columnconfigure(1, weight=1)

        ctk.CTkButton(
            sub_toolbar,
            text="+ Add Subtitle(s)",
            width=140,
            height=30,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            corner_radius=8,
            command=self.add_subs
        ).grid(row=0, column=0, padx=(0, 8))

        self.sub_count_label = ctk.CTkLabel(
            sub_toolbar,
            text="0 files added",
            font=ctk.CTkFont(size=11),
            text_color=MUTED_TEXT
        )
        self.sub_count_label.grid(row=0, column=1, sticky="w", padx=6)

        ctk.CTkButton(
            sub_toolbar,
            text="Clear all",
            width=80,
            height=30,
            font=ctk.CTkFont(size=11),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=("gray20", "gray80"),
            hover_color=("gray90", "gray25"),
            corner_radius=8,
            command=self.clear_subs
        ).grid(row=0, column=2, sticky="e")

        # Scrollable subtitle list
        self.sub_list = ctk.CTkScrollableFrame(
            card2,
            height=125,
            corner_radius=10,
            fg_color=INSET_BG,
            border_width=1,
            border_color=CARD_BORDER
        )
        self.sub_list.grid(row=2, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))
        self.sub_list.grid_columnconfigure(0, weight=1)

        self.refresh_sub_list()

        # ---------------- STEP 3: Sync Actions ----------------
        card3 = self.create_step_card(
            step_num="STEP 3",
            title="Synchronize",
            subtitle="Start speech alignment and output synced subtitle files"
        )
        card3.grid(row=2, column=0, sticky="ew", pady=(0, 12))
        card3.grid_columnconfigure(1, weight=1)

        action_row = ctk.CTkFrame(card3, fg_color="transparent")
        action_row.grid(row=1, column=0, columnspan=2, sticky="ew", padx=16, pady=(0, 16))
        action_row.grid_columnconfigure(1, weight=1)

        self.start_btn = ctk.CTkButton(
            action_row,
            text="⚡ Start Syncing",
            height=38,
            width=160,
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=ACCENT,
            hover_color=ACCENT_HOVER,
            corner_radius=8,
            command=self.start
        )
        self.start_btn.grid(row=0, column=0)

        # Modern progress bar
        self.progress = ctk.CTkProgressBar(
            action_row,
            mode="indeterminate",
            progress_color=ACCENT,
            height=10,
            corner_radius=5
        )
        self.progress.grid(row=0, column=1, sticky="ew", padx=16)
        self.progress.set(0)

        self.cancel_btn = ctk.CTkButton(
            action_row,
            text="Cancel",
            width=90,
            height=38,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=DANGER,
            hover_color=DANGER_HOVER,
            corner_radius=8,
            state="disabled",
            command=self.cancel
        )
        self.cancel_btn.grid(row=0, column=2)

        # ---------------- ACTIVITY LOG ----------------
        logcard = ctk.CTkFrame(
            self,
            corner_radius=14,
            fg_color=CARD_BG,
            border_width=1,
            border_color=CARD_BORDER
        )
        logcard.grid(row=3, column=0, sticky="nsew", padx=28, pady=(0, 12))
        logcard.grid_columnconfigure(0, weight=1)
        logcard.grid_rowconfigure(1, weight=1)

        log_header = ctk.CTkFrame(logcard, fg_color="transparent")
        log_header.grid(row=0, column=0, sticky="ew", padx=16, pady=(12, 6))
        log_header.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            log_header,
            text="CONSOLE ACTIVITY",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=MUTED_TEXT
        ).grid(row=0, column=0, sticky="w")

        self.log = ctk.CTkTextbox(
            logcard,
            font=ctk.CTkFont(family="Consolas", size=11),
            fg_color=INSET_BG,
            corner_radius=10,
            wrap="word",
            border_width=1,
            border_color=CARD_BORDER
        )
        self.log.grid(row=1, column=0, sticky="nsew", padx=14, pady=(0, 14))
        self.log.configure(state="disabled")

        # ---------------- FOOTER ----------------
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.grid(row=4, column=0, sticky="ew", padx=28, pady=(0, 18))
        footer.grid_columnconfigure(0, weight=1)

        status_container = ctk.CTkFrame(footer, fg_color="transparent")
        status_container.grid(row=0, column=0, sticky="w")

        self.status_dot = ctk.CTkLabel(
            status_container,
            text="●",
            font=ctk.CTkFont(size=14),
            text_color=MUTED_TEXT
        )
        self.status_dot.pack(side="left", padx=(0, 6))

        self.status = ctk.CTkLabel(
            status_container,
            text="Ready to sync",
            anchor="w",
            font=ctk.CTkFont(size=12),
            text_color=MUTED_TEXT
        )
        self.status.pack(side="left")

        self.open_btn = ctk.CTkButton(
            footer,
            text="📂 Open Output Folder",
            width=165,
            height=32,
            font=ctk.CTkFont(size=12),
            fg_color="transparent",
            border_width=1,
            border_color=CARD_BORDER,
            text_color=("gray20", "gray85"),
            hover_color=("gray90", "gray25"),
            corner_radius=8,
            state="disabled",
            command=self.open_folder
        )
        self.open_btn.grid(row=0, column=1, sticky="e")

        self.write("Pick your movie and subtitle file(s), then press 'Start Syncing'.\n"
                   "Fixed files will be saved next to originals as NAME.synced.srt\n")

    def create_step_card(self, step_num, title, subtitle):
        """Creates a standardized, modern card header with 'STEP X' badge and subtitle."""
        frame = ctk.CTkFrame(
            self.cards_container,
            corner_radius=14,
            fg_color=CARD_BG,
            border_width=1,
            border_color=CARD_BORDER
        )

        header_frame = ctk.CTkFrame(frame, fg_color="transparent")
        header_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=16, pady=(14, 10))
        header_frame.grid_columnconfigure(1, weight=1)

        # Step Badge (Pill)
        badge = ctk.CTkLabel(
            header_frame,
            text=f"  {step_num}  ",
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=BADGE_BG,
            text_color=BADGE_FG,
            corner_radius=6,
            height=22
        )
        badge.grid(row=0, column=0, rowspan=2, padx=(0, 10), sticky="n")

        # Title
        ctk.CTkLabel(
            header_frame,
            text=title,
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w"
        ).grid(row=0, column=1, sticky="w")

        # Subtitle
        ctk.CTkLabel(
            header_frame,
            text=subtitle,
            font=ctk.CTkFont(size=11),
            text_color=MUTED_TEXT,
            anchor="w"
        ).grid(row=1, column=1, sticky="w")

        return frame

    # ---------- helpers ----------
    def toggle_theme(self):
        ctk.set_appearance_mode("dark" if self.theme_switch.get() else "light")

    def write(self, text):
        self.log.configure(state="normal")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def set_status(self, text, color=None):
        status_color = color or MUTED_TEXT
        self.status.configure(text=text, text_color=status_color)
        if hasattr(self, "status_dot"):
            self.status_dot.configure(text_color=status_color)

    def refresh_sub_list(self):
        for w in self.sub_list.winfo_children():
            w.destroy()

        count = len(self.subs)
        if hasattr(self, "sub_count_label"):
            self.sub_count_label.configure(
                text=f"{count} {'file' if count == 1 else 'files'} added"
            )

        if not self.subs:
            empty_box = ctk.CTkFrame(self.sub_list, fg_color="transparent")
            empty_box.grid(row=0, column=0, pady=24)
            ctk.CTkLabel(
                empty_box,
                text="📑",
                font=ctk.CTkFont(size=20),
                text_color=MUTED_TEXT
            ).pack()
            ctk.CTkLabel(
                empty_box,
                text="No subtitle files added yet",
                font=ctk.CTkFont(size=12, weight="bold"),
                text_color=MUTED_TEXT
            ).pack(pady=(2, 2))
            ctk.CTkLabel(
                empty_box,
                text="Click '+ Add Subtitle(s)' to choose .srt, .ass, or .vtt files",
                font=ctk.CTkFont(size=11),
                text_color=MUTED_TEXT
            ).pack()
            return

        for i, path in enumerate(self.subs):
            item = ctk.CTkFrame(
                self.sub_list,
                corner_radius=8,
                fg_color=SUB_ITEM_BG,
                border_width=1,
                border_color=CARD_BORDER
            )
            item.grid(row=i, column=0, sticky="ew", pady=2, padx=4)
            item.grid_columnconfigure(1, weight=1)

            ctk.CTkLabel(
                item,
                text="📄",
                font=ctk.CTkFont(size=13),
                text_color=ACCENT
            ).grid(row=0, column=0, padx=(10, 6), pady=6)

            ctk.CTkLabel(
                item,
                text=short(path, 65),
                anchor="w",
                font=ctk.CTkFont(size=12)
            ).grid(row=0, column=1, sticky="ew", padx=(0, 6), pady=6)

            ctk.CTkButton(
                item,
                text="✕",
                width=26,
                height=26,
                font=ctk.CTkFont(size=11, weight="bold"),
                fg_color="transparent",
                text_color=DANGER,
                hover_color=("gray85", "gray30"),
                corner_radius=6,
                command=lambda p=path: self.remove_sub(p)
            ).grid(row=0, column=2, padx=6, pady=4)

    # ---------- actions ----------
    def pick_video(self):
        path = filedialog.askopenfilename(title="Choose the movie", filetypes=VIDEO_TYPES)
        if path:
            self.video_path = path
            self.video_label.configure(
                text=short(path, 70),
                text_color=("gray10", "gray90")
            )

    def add_subs(self):
        for p in filedialog.askopenfilenames(title="Choose subtitle file(s)", filetypes=SUB_TYPES):
            if p not in self.subs:
                self.subs.append(p)
        self.refresh_sub_list()

    def remove_sub(self, path):
        if path in self.subs:
            self.subs.remove(path)
        self.refresh_sub_list()

    def clear_subs(self):
        self.subs.clear()
        self.refresh_sub_list()

    def set_running(self, running):
        self.running = running
        self.start_btn.configure(state="disabled" if running else "normal")
        self.cancel_btn.configure(state="normal" if running else "disabled")
        if running:
            self.progress.start()
        else:
            self.progress.stop()
            self.progress.set(0)

    def update_ffmpeg_status(self):
        found = find_ffmpeg()
        if found:
            self.ffmpeg_btn.configure(
                text="● FFmpeg Ready",
                fg_color=BADGE_BG,
                text_color=SUCCESS,
                hover=False
            )
        else:
            self.ffmpeg_btn.configure(
                text="⚠️ Setup FFmpeg",
                fg_color=WARNING,
                hover_color="#D97706",
                text_color="#1E222D",
                hover=True
            )

    def show_ffmpeg_dialog(self, on_complete=None):
        FFmpegSetupDialog(self, on_complete=on_complete)

    def check_ffmpeg_initial(self):
        self.update_ffmpeg_status()
        if not find_ffmpeg():
            self.show_ffmpeg_dialog()

    def start(self):
        if not find_ffmpeg():
            self.show_ffmpeg_dialog(on_complete=self.start)
            return
        if not os.path.isfile(self.video_path):
            messagebox.showerror("Missing movie", "Please choose a valid movie file.")
            return
        if not self.subs:
            messagebox.showerror("Missing subtitles", "Please add at least one subtitle file.")
            return
        self.cancelled = False
        self.open_btn.configure(state="disabled")
        self.set_running(True)
        threading.Thread(target=self.worker, args=(self.video_path, list(self.subs)),
                         daemon=True).start()

    def cancel(self):
        self.cancelled = True
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
        self.set_status("Cancelling...", DANGER)

    def worker(self, video, subs):
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        ok = 0
        for n, sub in enumerate(subs, 1):
            if self.cancelled:
                break
            base, ext = os.path.splitext(sub)
            out = f"{base}.synced{ext or '.srt'}"
            self.after(0, self.set_status, f"Syncing {n} of {len(subs)}: {short(sub, 40)}", ACCENT)
            self.after(0, self.write, f"\n=== [{n}/{len(subs)}] {os.path.basename(sub)} ===\n")
            try:
                self.proc = subprocess.Popen(
                    build_command(video, sub, out),
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, encoding="utf-8", errors="replace",
                    env=env, creationflags=flags,
                )
                for line in self.proc.stdout:
                    line = line.rstrip()
                    if line:
                        self.after(0, self.write, line + "\n")
                code = self.proc.wait()
            except FileNotFoundError:
                self.after(0, self.write, "ffsubsync not found. Run: pip install ffsubsync\n")
                break
            if code == 0 and os.path.isfile(out):
                ok += 1
                self.last_output_dir = os.path.dirname(out)
                self.after(0, self.write, f"Saved: {out}\n")
            elif not self.cancelled:
                self.after(0, self.write, f"Failed (exit code {code}).\n")
        self.after(0, self.finish, ok, len(subs))

    def finish(self, ok, total):
        self.set_running(False)
        if self.cancelled:
            self.set_status("Cancelled", DANGER)
            messagebox.showinfo("Sync Cancelled", "Subtitle synchronization was cancelled.")
        elif ok == total:
            self.set_status(f"Done - {ok} of {total} synced successfully", SUCCESS)
            messagebox.showinfo(
                "Sync Finished",
                f"Successfully synced all {ok} of {total} subtitle file(s)!\n\n"
                f"Fixed files have been saved next to originals as '.synced'."
            )
        else:
            self.set_status(f"Finished - {ok} of {total} synced (check activity log)", DANGER)
            messagebox.showwarning(
                "Sync Finished with Warnings",
                f"Completed: {ok} of {total} file(s) synced.\n\n"
                f"Some files could not be synced. Check the Activity Log for details."
            )
        self.write(f"\nDone: {ok} of {total} file(s) synced.\n")
        if ok and self.last_output_dir:
            self.open_btn.configure(state="normal")

    def open_folder(self):
        if self.last_output_dir and os.path.isdir(self.last_output_dir):
            if os.name == "nt":
                os.startfile(self.last_output_dir)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", self.last_output_dir])
            else:
                subprocess.Popen(["xdg-open", self.last_output_dir])


if __name__ == "__main__":
    App().mainloop()
