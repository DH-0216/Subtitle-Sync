"""FFmpeg / ffprobe detection, audio track probing, and command builder."""
import json
import os
import re
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

def get_video_fps(video):
    """Returns the frame rate of the primary video stream as a float (e.g. 23.976, 25.0, 24.0), or None."""
    probe = find_ffprobe()
    if not probe:
        return None
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        result = subprocess.run(
            [probe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate,avg_frame_rate",
             "-of", "json", video],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=15, creationflags=flags,
        )
        streams = json.loads(result.stdout or "{}").get("streams", [])
        if not streams:
            return None
        st = streams[0]
        for key in ("avg_frame_rate", "r_frame_rate"):
            val = st.get(key, "")
            if val and "/" in val:
                num, den = val.split("/", 1)
                num, den = float(num), float(den)
                if den != 0 and num > 0:
                    fps = round(num / den, 3)
                    if 10.0 <= fps <= 120.0:
                        return fps
    except Exception:
        return None
    return None

def get_video_sync_details(video):
    """Probes video synchronization metadata: fps, duration_str, resolution_str, audio_count, sub_count.
    Returns dict."""
    probe = find_ffprobe()
    if not probe:
        return {}
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        cmd = [
            probe, "-v", "error",
            "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,channels,r_frame_rate,avg_frame_rate",
            "-of", "json", video
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15, creationflags=flags)
        data = json.loads(res.stdout or "{}")

        dur = float(data.get("format", {}).get("duration", 0))
        dur_str = ""
        if dur > 0:
            m, s = divmod(int(dur), 60)
            h, m = divmod(m, 60)
            dur_str = f"{h}h {m}m" if h else f"{m}m {s}s"

        streams = data.get("streams", [])
        v_streams = [s for s in streams if s.get("codec_type") == "video"]
        a_streams = [s for s in streams if s.get("codec_type") == "audio"]
        s_streams = [s for s in streams if s.get("codec_type") == "subtitle"]

        fps = None
        res_str = ""
        if v_streams:
            st = v_streams[0]
            for key in ("avg_frame_rate", "r_frame_rate"):
                val = st.get(key, "")
                if val and "/" in val:
                    num, den = val.split("/", 1)
                    num, den = float(num), float(den)
                    if den != 0 and num > 0:
                        calc = round(num / den, 3)
                        if 10.0 <= calc <= 120.0:
                            fps = calc
                            break
            w = st.get("width")
            h = st.get("height")
            if w and h:
                res_str = f"{w} x {h}"
            elif h:
                res_str = f"{h}p"

        return {
            "fps": fps,
            "duration": dur_str,
            "resolution": res_str,
            "audio_count": len(a_streams),
            "sub_count": len(s_streams),
        }
    except Exception:
        return {}

def detect_subtitle_fps(sub_path):
    """Detects target frame rate from subtitle filename, metadata, or standard release format.
    Returns float (e.g. 23.976, 25.0, 24.0)."""
    name = os.path.basename(sub_path).lower()

    if "23.976" in name or "23.98" in name:
        return 23.976
    if "29.97" in name:
        return 29.970
    if "24fps" in name or "24.0fps" in name:
        return 24.000
    if "25fps" in name or "25.0fps" in name or "25.000" in name:
        return 25.000
    if "pal" in name:
        return 25.000
    if "ntsc" in name:
        return 23.976
    if any(tag in name for tag in ["hdtv", "bluray", "bdrip", "web-dl", "webrip", "dvdrip", "x264", "x265", "hevc"]):
        return 23.976

    try:
        from src.srt_tools import read_text_guess
        text = read_text_guess(sub_path)
        first_lines = "\n".join(text.splitlines()[:50]).lower()
        # Match explicit frame rate mentions like "23.976 fps", "fps: 25.000", "Frame rate: 23.976"
        m = re.search(r'(?:fps|framerate|frame rate)\s*[:=]?\s*(23\.976|23\.98|24(?:\.0+)?|25(?:\.0+)?|29\.97|30|50|60)\b', first_lines)
        if m:
            val = float(m.group(1))
            return 23.976 if val == 23.98 else val
        m = re.search(r'\b(23\.976|23\.98|29\.97)\s*(?:fps|frame rate)?\b', first_lines)
        if m:
            val = float(m.group(1))
            return 23.976 if val == 23.98 else val
        m = re.search(r'\b(24(?:\.0+)?|25(?:\.0+)?)\s*(?:fps|frame\s*rate)\b', first_lines)
        if m:
            return float(m.group(1))
    except Exception:
        pass

    # Default to 23.976 fps (standard digital cinema / TV baseline)
    return 23.976

def get_release_type_and_cut(path):
    """Extracts source release type (BluRay, HDTV, WEB, DVD) and cut tags (Extended, Director's Cut, etc.)."""
    if not path:
        return "", [], ""
    name = os.path.basename(path).lower()
    source = ""
    if any(k in name for k in ["bluray", "bdrip", "brrip", "blu-ray"]):
        source = "BluRay"
    elif "hdtv" in name:
        source = "HDTV"
    elif any(k in name for k in ["web-dl", "webrip", "web"]):
        source = "WEB"
    elif any(k in name for k in ["dvdrip", "dvd"]):
        source = "DVD"

    cuts = []
    if "extended" in name:
        cuts.append("Extended")
    if "director" in name:
        cuts.append("Director's Cut")
    if "unrated" in name:
        cuts.append("Unrated")
    if "theatrical" in name:
        cuts.append("Theatrical")
    if "repack" in name:
        cuts.append("Repack")

    label_parts = []
    if source:
        label_parts.append(source)
    if cuts:
        label_parts.extend(cuts)

    tag_str = " ".join(label_parts)
    return source, cuts, tag_str

def get_subtitle_sync_details(sub_path):
    """Returns detected target fps, release tag, line count, and time span for a subtitle file."""
    fps = detect_subtitle_fps(sub_path)
    source, cuts, tag_str = get_release_type_and_cut(sub_path)

    lines = 0
    span_str = ""
    try:
        from src.srt_tools import parse_srt, read_text_guess, hms
        cues = parse_srt(read_text_guess(sub_path))
        if cues:
            lines = len(cues)
            span_str = f"{hms(cues[0][0])} - {hms(cues[-1][1])}"
    except Exception:
        pass

    return {
        "fps": fps,
        "source": source,
        "cuts": cuts,
        "tag": tag_str,
        "lines": lines,
        "span": span_str
    }

def build_command(video, sub, out, extra=None):
    exe = shutil.which("ffs") or shutil.which("ffsubsync")
    base = [exe] if exe else [sys.executable, "-m", "ffsubsync"]
    return base + [video, "-i", sub, "-o", out] + list(extra or [])
