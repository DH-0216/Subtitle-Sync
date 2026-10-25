"""FFmpeg detection, PATH environment reloading, and command builder."""
import os
import shutil
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

def build_command(video, sub, out):
    exe = shutil.which("ffs") or shutil.which("ffsubsync")
    base = [exe] if exe else [sys.executable, "-m", "ffsubsync"]
    return base + [video, "-i", sub, "-o", out]
