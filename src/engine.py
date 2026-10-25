"""Core synchronization engines: Standard, Smart, and Split sync."""
import os
import re
import shutil
import subprocess
import tempfile

from src.constants import ACCENT
from src.media import find_ffmpeg, build_command
from src.srt_tools import (
    parse_srt, write_srt, read_text_guess, clean_and_sort_cues
)
from src.utils import short

SCORE_RE = re.compile(r"score\D{0,6}(-?\d+(?:\.\d+)?)", re.IGNORECASE)

def parse_track_index(track):
    """Safely extracts integer audio track stream index or returns None."""
    if track is None:
        return None
    try:
        m = re.search(r'\d+', str(track))
        return int(m.group()) if m else None
    except Exception:
        return None

class SyncEngine:
    def __init__(self, log_cb=None, status_cb=None, is_cancelled_cb=None, set_proc_cb=None):
        self.log_cb = log_cb or (lambda msg: None)
        self.status_cb = status_cb or (lambda msg, color=None: None)
        self.is_cancelled_cb = is_cancelled_cb or (lambda: False)
        self.set_proc_cb = set_proc_cb or (lambda proc: None)

    def is_cancelled(self):
        return self.is_cancelled_cb()

    def run_ffs(self, reference, sub, out, extra=None, quiet=False):
        """Run ffsubsync once. Returns (exit_code, score or None)."""
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        proc = subprocess.Popen(
            build_command(reference, sub, out, extra),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace",
            env=env, creationflags=flags,
        )
        self.set_proc_cb(proc)
        score = None
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            if not quiet:
                self.log_cb(line + "\n")
            m = SCORE_RE.search(line)
            if m:
                try:
                    score = float(m.group(1))
                except ValueError:
                    pass
        code = proc.wait()
        return code, score

    def _sanitize_output_srt(self, out):
        """Ensure resulting SRT has valid, sorted timestamps and no overlaps."""
        if not os.path.isfile(out) or os.path.splitext(out)[1].lower() != ".srt":
            return
        try:
            raw_cues = parse_srt(read_text_guess(out))
            if raw_cues:
                valid_cues = [c for c in raw_cues if c[0] >= 0.0]
                cleaned = clean_and_sort_cues(valid_cues)
                write_srt(out, cleaned)
        except Exception:
            pass

    def extract_audio(self, video, wav_path, track=None):
        """Extract movie's speech audio once (16 kHz mono WAV). Returns True on success."""
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        cmd = [find_ffmpeg() or "ffmpeg", "-y", "-nostdin", "-loglevel", "error", "-i", video]
        t_idx = parse_track_index(track)
        if t_idx is not None:
            cmd += ["-map", f"0:a:{t_idx}"]
        cmd += ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path]
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding="utf-8", errors="replace", creationflags=flags,
        )
        self.set_proc_cb(proc)
        output = proc.communicate()[0]
        if self.is_cancelled():
            return False
        if proc.returncode != 0 or not os.path.isfile(wav_path):
            tail = (output or "").strip()[-400:]
            self.log_cb(f"Could not read the audio track.\n{tail}\n")
            return False
        return True

    def sync_standard(self, video, sub, out, track=None):
        """Standard 1-pass synchronization."""
        t_idx = parse_track_index(track)
        extra = ["--reference-stream", f"a:{t_idx}"] if t_idx is not None else []
        code, _ = self.run_ffs(video, sub, out, extra)
        if code == 0 and os.path.isfile(out):
            self._sanitize_output_srt(out)
            return True
        if not self.is_cancelled():
            self.log_cb(f"Failed (exit code {code}). Try 'Smart' or 'Split sync' mode.\n")
        return False

    def sync_smart(self, video, sub, out, track=None):
        """Multi-pass strategy trying standard, wide search, frame-rate fix, and piecewise split search."""
        t_idx = parse_track_index(track)
        track_arg = ["--reference-stream", f"a:{t_idx}"] if t_idx is not None else []
        attempts = [
            ("Standard", [] + track_arg, False),
            ("Wide search (+/- 15 min)", ["--max-offset-seconds", "900"] + track_arg, False),
            ("Frame-rate search", ["--max-offset-seconds", "900", "--gss"] + track_arg, False),
            ("Piecewise split search", ["--split-penalty", "8", "--max-offset-seconds", "300"] + track_arg, False),
            ("Other speech detector", ["--max-offset-seconds", "900", "--gss", "--vad", "auditok"] + track_arg, True),
        ]
        ext = os.path.splitext(sub)[1] or ".srt"
        tmp = tempfile.mkdtemp(prefix="subsync_")
        try:
            best_path, best_score, best_label = None, None, ""
            for i, (label, extra, fallback_only) in enumerate(attempts, 1):
                if self.is_cancelled():
                    return False
                if fallback_only and best_path:
                    break
                self.status_cb(f"Smart sync {i}/{len(attempts)}: {label}", ACCENT)
                self.log_cb(f"\n-- Attempt {i}/{len(attempts)}: {label} --\n")
                cand = os.path.join(tmp, f"try{i}{ext}")
                code, score = self.run_ffs(video, sub, cand, extra)
                if code != 0 or not os.path.isfile(cand):
                    if not self.is_cancelled():
                        self.log_cb("This attempt failed, moving on.\n")
                    continue
                better = (
                    best_path is None
                    or (score is not None and (best_score is None or score > best_score + abs(best_score) * 0.03))
                )
                if better:
                    best_path, best_score, best_label = cand, score, label
                    if score is not None and score > 20000:
                        break

            if not best_path:
                if not self.is_cancelled():
                    self.log_cb("No attempt worked. If the subtitle is for a different cut, try 'Split sync'.\n")
                return False
            shutil.copyfile(best_path, out)
            self._sanitize_output_srt(out)
            self.log_cb(f"\nBest result: {best_label}\n")
            return True
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def sync_split(self, video, sub, out, track=None, max_offset=300):
        """Piecewise synchronization for TV episodes with commercial cuts or extended/deleted scenes (alass algorithm)."""
        t_idx = parse_track_index(track)
        track_arg = ["--reference-stream", f"a:{t_idx}"] if t_idx is not None else []

        self.status_cb(f"Split sync: analyzing timeline and scene cuts - {short(sub, 30)}", ACCENT)
        self.log_cb("Running piecewise split synchronization (alass algorithm)...\n")

        # Pass 1: optimal split penalty 8 with max_offset search window
        extra = ["--split-penalty", "8", "--max-offset-seconds", str(max_offset)] + track_arg
        code, score = self.run_ffs(video, sub, out, extra)
        if code == 0 and os.path.isfile(out):
            self._sanitize_output_srt(out)
            self.log_cb("Piecewise split synchronization completed successfully.\n")
            return True

        if self.is_cancelled():
            return False

        # Pass 2: conservative split penalty 14
        self.log_cb("Retrying split sync with conservative penalty...\n")
        extra_fallback = ["--split-penalty", "14", "--max-offset-seconds", str(max_offset)] + track_arg
        code, score = self.run_ffs(video, sub, out, extra_fallback)
        if code == 0 and os.path.isfile(out):
            self._sanitize_output_srt(out)
            self.log_cb("Piecewise split synchronization completed successfully.\n")
            return True

        if not self.is_cancelled():
            self.log_cb(f"Split sync failed (exit code {code}). You may try 'Smart' mode.\n")
        return False
