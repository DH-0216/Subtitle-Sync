"""Main Application Window for Subtitle Sync Studio."""
import os
import subprocess
import sys
import threading
import webbrowser
from tkinter import filedialog, messagebox
import customtkinter as ctk

from src.constants import (
    APP_VERSION, GITHUB_REPO, ACCENT, ACCENT_HOVER, DANGER, SUCCESS, WARNING,
    BADGE_BG, BADGE_FG, MUTED_TEXT, VIDEO_TYPES, SUB_TYPES,
    MODE_SMART, MODE_SPLIT, MODE_HINTS, MAX_SUBTITLES
)
from src.settings import load_settings, save_settings
from src.utils import set_windows_titlebar_color, resource_path, short, fetch_github_release
from src.media import (
    find_ffmpeg, list_audio_tracks, get_video_sync_details, detect_subtitle_fps,
    get_subtitle_sync_details
)
from src.dialogs import FFmpegSetupDialog, UpdateDialog, SettingsDialog, parse_version
from src.engine import SyncEngine
from src.ui_builder import build_main_ui, create_step_card, render_subtitle_list
from src.recommender import analyze_recommendation

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self._deactivate_windows_window_header_manipulation = True
        self.settings = load_settings()
        ctk.set_appearance_mode(self.settings.get("theme", "dark"))
        self.after(50, lambda: set_windows_titlebar_color(self, self.settings.get("theme", "dark") == "dark"))
        ctk.set_default_color_theme("blue")
        self.title("Subtitle Sync Studio")

        # Smart sizing to fit comfortably on both laptops and desktop monitors
        screen_w = self.winfo_screenwidth()
        screen_h = self.winfo_screenheight()
        default_w = min(820, max(720, screen_w - 40))
        default_h = min(770, max(560, screen_h - 80))
        self.geometry(f"{default_w}x{default_h}")
        self.minsize(680, 520)

        icon_file = resource_path("app_icon.ico")
        if os.path.isfile(icon_file):
            try:
                self.iconbitmap(icon_file)
            except Exception:
                pass

        self.video_path = ""
        self.subs = []
        self.audio_tracks = []
        self.video_fps = None
        self.sub_fps = None
        self.running = False
        self.cancelled = False
        self.proc = None
        self.last_output_dir = None
        self.last_output_file = None
        self.user_selected_mode = False

        self.latest_release_data = None
        self.build_ui()
        self.after(100, self.check_ffmpeg_initial)
        if self.settings.get("check_updates_startup", True):
            self.after(2500, self.start_update_check)

    # ---------- UI ----------
    def build_ui(self):
        build_main_ui(self)
        self.update_sync_state()
        self.write("Pick your movie and subtitle file(s), then press 'Start Syncing'.\n"
                   "Fixed files will be saved next to originals as NAME.synced.srt\n"
                   "Subtitle does not match the video? Try 'Smart' (drift) or 'Split sync' (different cut).\n")

        # Global mouse wheel & precision trackpad bindings (Tk 8.6 & Tk 9.0 TIP 684 support)
        self.cards_container._mouse_wheel_all = self._on_master_mousewheel
        self.sub_list._mouse_wheel_all = self._on_master_mousewheel
        for evt in ("<MouseWheel>", "<TouchpadScroll>", "<Button-4>", "<Button-5>"):
            try:
                self.unbind_all(evt)
            except Exception:
                pass
            self.bind_all(evt, self._on_master_mousewheel)

        self.bind("<Enter>", lambda e: self.focus_set(), add="+")
        if hasattr(self, "cards_container"):
            self.cards_container.bind("<Enter>", lambda e: self.focus_set(), add="+")

    def create_step_card(self, step_num, title, subtitle):
        """Creates a standardized, modern card header with 'STEP X' badge and subtitle."""
        return create_step_card(self.cards_container, step_num, title, subtitle)

    # ---------- helpers ----------
    def _on_master_mousewheel(self, event):
        """Universal mouse wheel and precision trackpad scrolling handler across the entire window."""
        if not hasattr(self, "cards_container"):
            return

        delta = getattr(event, "delta", 0)
        # Handle Linux / X11 Button-4 (up) and Button-5 (down)
        if not delta and hasattr(event, "num"):
            if event.num == 4:
                delta = 120
            elif event.num == 5:
                delta = -120
        if not delta:
            return

        # Decode delta across Tk 8.6, Tk 9.0 (TIP 684 TouchpadScroll), and high-precision trackpads
        dy = delta
        try:
            dx, unpacked_dy = self.tk.call("tk::PreciseScrollDeltas", delta)
            dy = unpacked_dy
        except Exception:
            # Fallback if delta is an unsigned 16-bit negative integer
            if delta > 32767:
                dy = delta - 65536

        if dy == 0:
            return

        # Check widget under cursor
        widget_under = None
        try:
            if hasattr(event, "x_root") and hasattr(event, "y_root"):
                widget_under = self.winfo_containing(event.x_root, event.y_root)
        except Exception:
            pass
        if widget_under is None:
            widget_under = getattr(event, "widget", None)

        # Allow native scrolling inside console activity log when expanded
        if hasattr(self, "log") and getattr(self, "log_visible", False):
            curr = widget_under
            while curr is not None:
                if curr == self.log or curr == getattr(self.log, "_textbox", None):
                    return
                curr = getattr(curr, "master", None)

        # Check if pointer is over sub_list when it has more than 2 subtitles
        target_canvas = self.cards_container._parent_canvas
        if hasattr(self, "sub_list") and len(self.subs) > 2:
            curr = widget_under
            while curr is not None:
                if curr == self.sub_list or curr == getattr(self.sub_list, "_parent_canvas", None) or curr == getattr(self.sub_list, "_parent_frame", None):
                    target_canvas = self.sub_list._parent_canvas
                    break
                curr = getattr(curr, "master", None)

        # In CTkScrollableFrame on Windows, canvas yscrollincrement is 1px per unit.
        # Standard mouse wheel: 120 units -> 55 pixels per notch.
        # Precision trackpad: ~2.5px per micro-delta unit for fluid, responsive scrolling.
        if abs(dy) >= 120:
            units = -int((dy / 120.0) * 55)
            self._wheel_accum = 0.0
        else:
            self._wheel_accum = getattr(self, "_wheel_accum", 0.0) - (dy * 2.5)
            if abs(self._wheel_accum) >= 1.0:
                units = int(self._wheel_accum)
                self._wheel_accum -= units
            else:
                units = -1 if dy > 0 else (1 if dy < 0 else 0)

        if units != 0:
            try:
                target_canvas.yview("scroll", units, "units")
            except Exception:
                pass

        return "break"

    def toggle_log(self, force_show=None):
        """Toggles visibility of the console activity log or forces state."""
        if force_show is not None:
            should_show = bool(force_show)
        else:
            should_show = not getattr(self, "log_visible", False)

        if should_show:
            self.log.grid()
            if hasattr(self, "log_toggle_btn"):
                self.log_toggle_btn.configure(text="Hide Log ▲")
            self.log_visible = True
        else:
            self.log.grid_remove()
            if hasattr(self, "log_toggle_btn"):
                self.log_toggle_btn.configure(text="Show Log ▼")
            self.log_visible = False
    def open_github_repo(self):
        webbrowser.open(f"https://github.com/{GITHUB_REPO}")

    def write(self, text):
        self.log.configure(state="normal")
        self.log.insert("end", text)
        self.log.see("end")
        self.log.configure(state="disabled")

    def set_status(self, text, color=None):
        if text.strip().lower() == "ready to sync":
            dot_color = SUCCESS
            status_color = MUTED_TEXT
        else:
            status_color = color or MUTED_TEXT
            dot_color = status_color
        self.status.configure(text=text, text_color=status_color)
        if hasattr(self, "status_dot"):
            self.status_dot.configure(text_color=dot_color)

    def refresh_sub_list(self):
        count = len(self.subs)
        if hasattr(self, "sub_count_label"):
            if count >= MAX_SUBTITLES:
                self.sub_count_label.configure(
                    text=f"{count} / {MAX_SUBTITLES} (Max limit reached)",
                    text_color=WARNING
                )
            else:
                self.sub_count_label.configure(
                    text=f"{count} / {MAX_SUBTITLES} {'file' if count == 1 else 'files'} added",
                    text_color=MUTED_TEXT
                )
        render_subtitle_list(self.sub_list, self.subs, self.remove_sub)

    # ---------- actions ----------
    def pick_video(self):
        path = filedialog.askopenfilename(title="Choose the movie", filetypes=VIDEO_TYPES)
        if path:
            self.video_path = path
            self.user_selected_mode = False
            self.video_label.configure(
                text=short(path, 70),
                text_color=("gray10", "gray90")
            )
            self.audio_tracks = []
            self.video_fps = None
            self.extra_row.grid_remove()
            threading.Thread(target=self._probe_worker, args=(path,), daemon=True).start()
            self.update_sync_state()

    def _probe_worker(self, path):
        labels = list_audio_tracks(path)
        meta = get_video_sync_details(path)
        try:
            self.after(0, self.on_tracks_found, path, labels, meta)
        except Exception:
            pass

    def on_tracks_found(self, path, labels, meta=None):
        if path != self.video_path:
            return
        self.audio_tracks = labels
        meta = meta or {}
        fps = meta.get("fps")
        self.video_fps = fps
        if fps:
            self.write(f"Movie analyzed: Video frame rate is {fps} fps.\n")

        details = []
        if fps:
            details.append(f"🎬 {fps} fps")
        if meta.get("duration"):
            details.append(f"⏱️ {meta['duration']}")
        if meta.get("resolution"):
            details.append(f"📐 {meta['resolution']}")
        a_cnt = meta.get("audio_count", len(labels))
        if a_cnt:
            details.append(f"🔊 {a_cnt} Audio {'track' if a_cnt == 1 else 'tracks'}")
        s_cnt = meta.get("sub_count", 0)
        if s_cnt:
            details.append(f"💬 {s_cnt} Embedded {'sub' if s_cnt == 1 else 'subs'}")

        if hasattr(self, "video_meta_label"):
            if details:
                self.video_meta_label.configure(text=" • ".join(details))
                self.video_meta_label.grid()
            else:
                self.video_meta_label.grid_remove()

        if len(labels) > 1:
            self.audio_menu.configure(values=labels)
            self.audio_menu.set(labels[0])
            self.extra_row.grid()
            self.write(f"This movie has {len(labels)} audio tracks. Pick the one that matches "
                       f"your subtitle (see 'Audio track' in Step 3).\n")
        else:
            self.extra_row.grid_remove()
        self.update_sync_state()

    def add_subs(self, files=None):
        current_count = len(self.subs)
        if current_count >= MAX_SUBTITLES:
            messagebox.showwarning(
                "Subtitle Limit Reached",
                f"You have reached the maximum limit of {MAX_SUBTITLES} subtitle files.\n\n"
                f"Please remove some files or process the current batch first."
            )
            return

        chosen = files if files is not None else filedialog.askopenfilenames(title="Choose subtitle file(s)", filetypes=SUB_TYPES)
        if not chosen:
            return

        available_slots = MAX_SUBTITLES - current_count
        new_files = [p for p in chosen if p not in self.subs]
        if not new_files:
            return

        if len(new_files) > available_slots:
            added = new_files[:available_slots]
            self.subs.extend(added)
            messagebox.showinfo(
                "Maximum Limit Applied",
                f"Added {len(added)} subtitle(s).\n\n"
                f"{len(new_files) - len(added)} file(s) were omitted because the maximum limit is {MAX_SUBTITLES} subtitles per session."
            )
            files_to_log = added
        else:
            self.subs.extend(new_files)
            files_to_log = new_files

        self.user_selected_mode = False
        self.refresh_sub_list()
        self.update_sub_meta()
        for p in files_to_log:
            meta = get_subtitle_sync_details(p)
            tag_str = f" ({meta['tag']})" if meta.get("tag") else ""
            self.write(f"Subtitle added: '{os.path.basename(p)}' (target {meta['fps']} fps{tag_str}).\n")
        self.update_sync_state()

    def remove_sub(self, path):
        if path in self.subs:
            self.subs.remove(path)
        self.user_selected_mode = False
        self.refresh_sub_list()
        self.update_sub_meta()
        self.update_sync_state()

    def update_sub_meta(self):
        if not self.subs:
            self.sub_fps = None
            return

        if len(self.subs) == 1:
            self.sub_fps = detect_subtitle_fps(self.subs[0])
        else:
            fps_list = [detect_subtitle_fps(p) for p in self.subs]
            unique_fps = sorted(list(set(fps_list)))
            self.sub_fps = unique_fps[0] if len(unique_fps) == 1 else None

    def clear_subs(self):
        self.subs.clear()
        self.sub_fps = None
        self.user_selected_mode = False
        self.refresh_sub_list()
        self.update_sync_state()

    def on_mode_change(self, value=None, save=True):
        self.user_selected_mode = True
        mode = value or (self.mode_btn.get() if hasattr(self, "mode_btn") else None)
        if mode and hasattr(self, "mode_hint"):
            self.mode_hint.configure(text=MODE_HINTS.get(mode, ""), text_color=MUTED_TEXT)
        if save and mode:
            self.settings["sync_mode"] = mode
            save_settings(self.settings)

    def update_sync_state(self):
        """Step 3 stays grayed out until a movie and at least one subtitle are chosen."""
        if not hasattr(self, "start_btn"):
            return
        ready = bool(self.video_path) and os.path.isfile(self.video_path) and bool(self.subs)
        state = "normal" if (ready and not self.running) else "disabled"
        if hasattr(self, "mode_btn"):
            self.mode_btn.configure(state=state)
        if hasattr(self, "audio_menu"):
            self.audio_menu.configure(state=state)
        self.start_btn.configure(state=state)
        if hasattr(self, "lock_hint"):
            if ready:
                self.lock_hint.grid_remove()
            else:
                self.lock_hint.grid()
        if hasattr(self, "mode_hint"):
            cur_mode = self.mode_btn.get()
            self.mode_hint.configure(text=MODE_HINTS.get(cur_mode, ""), text_color=MUTED_TEXT)

        if hasattr(self, "fps_box"):
            if ready and (self.video_fps or self.sub_fps or self.subs):
                rec = analyze_recommendation(self.video_path, self.video_fps, self.subs)
                if rec:
                    self.fps_label.configure(text=rec.title, text_color=rec.color)
                    self.fps_rec_label.configure(text=rec.hint)

                    # Select recommended mode on the segmented button (unless user manually chose another mode)
                    if rec.mode and hasattr(self, "mode_btn") and not getattr(self, "user_selected_mode", False):
                        self.mode_btn.set(rec.mode)
                        if hasattr(self, "mode_hint"):
                            self.mode_hint.configure(text=MODE_HINTS.get(rec.mode, ""), text_color=MUTED_TEXT)

                    self.fps_box.grid()
                else:
                    self.fps_box.grid_remove()
            else:
                self.fps_box.grid_remove()

    def get_track(self):
        """0-based audio track chosen by the person, or None when the movie has just one."""
        if len(self.audio_tracks) < 2:
            return None
        try:
            return self.audio_tracks.index(self.audio_menu.get())
        except ValueError:
            return None

    def set_running(self, running):
        self.running = running
        self.cancel_btn.configure(state="normal" if running else "disabled")
        if running:
            self.progress.start()
        else:
            self.progress.stop()
            self.progress.set(0)
        self.update_sync_state()

    def update_ffmpeg_status(self):
        found = find_ffmpeg()
        if found:
            self.ffmpeg_btn.configure(
                text="● FFmpeg Ready",
                fg_color=BADGE_BG,
                text_color=SUCCESS,
                hover=False,
                cursor="arrow"
            )
        else:
            self.ffmpeg_btn.configure(
                text="⚠️ Setup FFmpeg",
                fg_color=WARNING,
                hover_color="#D97706",
                text_color="#1E222D",
                hover=True,
                cursor="hand2"
            )

    def show_ffmpeg_dialog(self, on_complete=None):
        if find_ffmpeg():
            if on_complete:
                on_complete()
            return
        FFmpegSetupDialog(self, on_complete=on_complete)

    def start_update_check(self):
        threading.Thread(target=self._check_update_worker, daemon=True).start()

    def _check_update_worker(self):
        data, _ = fetch_github_release(GITHUB_REPO, timeout=8)
        if data:
            tag = data.get("tag_name", "")
            if parse_version(tag) > parse_version(APP_VERSION):
                self.after(0, self.on_update_found, data)

    def on_update_found(self, data):
        self.latest_release_data = data
        tag = data.get("tag_name", "new")
        if not self.update_btn and hasattr(self, "header_actions"):
            self.update_btn = ctk.CTkButton(
                self.header_actions,
                text=f"⚡ Update Available ({tag})",
                font=ctk.CTkFont(size=11, weight="bold"),
                height=26,
                corner_radius=13,
                fg_color=ACCENT,
                hover_color=ACCENT_HOVER,
                command=self.show_update_dialog
            )
            self.update_btn.pack(side="right", padx=(0, 10))

    def show_settings_dialog(self):
        SettingsDialog(self)

    def show_update_dialog(self):
        if self.latest_release_data:
            UpdateDialog(self, self.latest_release_data)

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
        self.set_running(True)
        mode = self.mode_btn.get()
        track = self.get_track()
        threading.Thread(target=self.worker,
                         args=(self.video_path, list(self.subs), mode, track),
                         daemon=True).start()

    def cancel(self):
        self.cancelled = True
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()
        self.set_status("Cancelling...", DANGER)
        if hasattr(self, "open_btn"):
            self.open_btn.configure(state="normal")

    def worker(self, video, subs, mode, track=None):
        engine = SyncEngine(
            log_cb=lambda msg: self.after(0, self.write, msg),
            status_cb=lambda msg, color=None: self.after(0, self.set_status, msg, color),
            is_cancelled_cb=lambda: self.cancelled,
            set_proc_cb=lambda proc: setattr(self, "proc", proc)
        )
        ok = 0
        for n, sub in enumerate(subs, 1):
            if self.cancelled:
                break
            base, ext = os.path.splitext(sub)
            out = f"{base}.synced{ext or '.srt'}"
            self.after(0, self.set_status, f"Syncing {n} of {len(subs)}: {short(sub, 40)}", ACCENT)
            self.after(0, self.write, f"\n=== [{n}/{len(subs)}] {os.path.basename(sub)} ({mode}) ===\n")
            success = False
            try:
                if mode == MODE_SPLIT:
                    success = engine.sync_split(video, sub, out, track)
                elif mode == MODE_SMART:
                    success = engine.sync_smart(video, sub, out, track)
                else:
                    success = engine.sync_standard(video, sub, out, track)
            except FileNotFoundError:
                self.after(0, self.write,
                           "A required program was not found (ffsubsync or ffmpeg). Run: pip install ffsubsync\n")
                break
            except Exception as e:
                self.after(0, self.write, f"Error: {e}\n")
            if success and not self.cancelled:
                ok += 1
                abs_out = os.path.abspath(out)
                self.last_output_dir = os.path.dirname(abs_out)
                self.last_output_file = abs_out
                self.after(0, self.write, f"Saved: {out}\n")
        self.after(0, self.finish, ok, len(subs))

    def finish(self, ok, total):
        self.set_running(False)
        if hasattr(self, "open_btn"):
            self.open_btn.configure(state="normal")
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

    def open_folder(self):
        target_dir = None
        target_file = getattr(self, "last_output_file", None)

        if target_file and os.path.exists(target_file):
            target_dir = os.path.dirname(target_file)
        elif self.last_output_dir and os.path.isdir(self.last_output_dir):
            target_dir = self.last_output_dir
        elif self.subs and os.path.exists(self.subs[0]):
            target_dir = os.path.dirname(os.path.abspath(self.subs[0]))
        elif self.video_path and os.path.exists(self.video_path):
            target_dir = os.path.dirname(os.path.abspath(self.video_path))
        else:
            for d in [
                os.path.join(os.path.expanduser("~"), "Downloads"),
                os.path.join(os.path.expanduser("~"), "Videos"),
                os.path.expanduser("~")
            ]:
                if os.path.isdir(d):
                    target_dir = d
                    break

        if not target_dir or not os.path.exists(target_dir):
            return

        target_dir = os.path.normpath(target_dir)

        try:
            if sys.platform == "win32" or os.name == "nt":
                if target_file and os.path.exists(target_file):
                    norm_file = os.path.normpath(target_file)
                    subprocess.Popen(f'explorer /select,"{norm_file}"')
                else:
                    os.startfile(target_dir)
            elif sys.platform == "darwin":
                if target_file and os.path.exists(target_file):
                    subprocess.Popen(["open", "-R", target_file])
                else:
                    subprocess.Popen(["open", target_dir])
            else:
                subprocess.Popen(["xdg-open", target_dir])
        except Exception:
            try:
                if sys.platform == "win32" or os.name == "nt":
                    subprocess.Popen(["explorer", target_dir])
            except Exception:
                pass
