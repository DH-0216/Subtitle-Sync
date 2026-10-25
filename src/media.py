"""FFmpeg / ffprobe detection, audio track probing, and command builder."""
import json
import os
import shutil
import subprocess
import sys

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

def find_ffprobe():
    """ffprobe ships in the same folder as ffmpeg."""
    ff = find_ffmpeg()
    if ff:
        folder = os.path.dirname(ff)
        for name in ("ffprobe.exe", "ffprobe"):
            candidate = os.path.join(folder, name)
            if os.path.isfile(candidate):
                return candidate
    return shutil.which("ffprobe")

LANG_NAMES = {
    "eng": "English", "sin": "Sinhala", "tam": "Tamil", "hin": "Hindi", "jpn": "Japanese",
    "kor": "Korean", "fre": "French", "fra": "French", "ger": "German", "deu": "German",
    "spa": "Spanish", "ita": "Italian", "rus": "Russian", "chi": "Chinese", "zho": "Chinese",
    "ara": "Arabic", "por": "Portuguese", "tur": "Turkish", "tha": "Thai", "ind": "Indonesian",
    "may": "Malay", "msa": "Malay", "dut": "Dutch", "nld": "Dutch", "pol": "Polish",
    "swe": "Swedish", "nor": "Norwegian", "dan": "Danish", "fin": "Finnish", "gre": "Greek",
    "ell": "Greek", "heb": "Hebrew", "vie": "Vietnamese", "ben": "Bengali", "urd": "Urdu",
    "tel": "Telugu", "mal": "Malayalam", "kan": "Kannada", "mar": "Marathi", "pan": "Punjabi",
}
CHANNEL_NAMES = {1: "Mono", 2: "Stereo", 6: "5.1", 8: "7.1"}

def list_audio_tracks(video):
    """Readable label for every audio track in the video, e.g. 'Track 2: English - Commentary (AC3, 5.1)'.
    Returns an empty list when the tracks cannot be read."""
    probe = find_ffprobe()
    if not probe:
        return []
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        result = subprocess.run(
            [probe, "-v", "error", "-select_streams", "a",
             "-show_entries", "stream=codec_name,channels:stream_tags=language,title",
             "-of", "json", video],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=30, creationflags=flags,
        )
        streams = json.loads(result.stdout or "{}").get("streams", [])
    except Exception:
        return []
    labels = []
    for i, s in enumerate(streams, 1):
        tags = {str(k).lower(): str(v) for k, v in (s.get("tags") or {}).items()}
        code = tags.get("language", "").strip().lower()
        lang = "" if code in ("", "und") else LANG_NAMES.get(code, code.upper())
        title = tags.get("title", "").strip()
        if title and lang and title.lower() != lang.lower():
            name = f"{lang} - {title}"
        else:
            name = title or lang or "Unknown language"
        details = []
        if s.get("codec_name"):
            details.append(str(s["codec_name"]).upper())
        ch = s.get("channels")
        if ch:
            details.append(CHANNEL_NAMES.get(ch, f"{ch}ch"))
        labels.append(f"Track {i}: {name}" + (f" ({', '.join(details)})" if details else ""))
    return labels

def build_command(video, sub, out, extra=None):
    exe = shutil.which("ffs") or shutil.which("ffsubsync")
    base = [exe] if exe else [sys.executable, "-m", "ffsubsync"]
    return base + [video, "-i", sub, "-o", out] + list(extra or [])
