"""System, path, and UI helper functions."""
import math
import os
import sys
from PIL import Image, ImageDraw
import customtkinter as ctk

_gear_cache = {}

def set_windows_titlebar_color(window, dark: bool):
    """Sets immersive dark/light mode for Windows 10/11 titlebars."""
    if os.name != "nt":
        return
    try:
        import ctypes
        window.update_idletasks()
        wid = window.winfo_id()
        hwnd = ctypes.windll.user32.GetParent(wid)
        if not hwnd:
            hwnd = wid
        DWMWA_USE_IMMERSIVE_DARK_MODE = 20
        DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19
        value = ctypes.c_int(1 if dark else 0)
        res = ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ctypes.byref(value), ctypes.sizeof(value)
        )
        if res != 0:
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1, ctypes.byref(value), ctypes.sizeof(value)
            )
    except Exception:
        pass

def get_gear_icon(size=24, color=(99, 102, 241)):
    """Generate a clean mechanical cogwheel icon (not the floral Windows emoji)."""
    cache_key = (size, color)
    if cache_key in _gear_cache:
        return _gear_cache[cache_key]

    render_size = size * 4
    img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = render_size / 2.0, render_size / 2.0
    r_tip = render_size * 0.46
    r_root = render_size * 0.33
    r_hole = render_size * 0.16
    n_teeth = 6

    pts = []
    step = 360.0 / n_teeth
    for i in range(n_teeth):
        base = i * step
        a1 = math.radians(base)
        pts.append((cx + r_root * math.cos(a1), cy + r_root * math.sin(a1)))
        a2 = math.radians(base + step * 0.20)
        pts.append((cx + r_root * math.cos(a2), cy + r_root * math.sin(a2)))
        a3 = math.radians(base + step * 0.28)
        pts.append((cx + r_tip * math.cos(a3), cy + r_tip * math.sin(a3)))
        a4 = math.radians(base + step * 0.72)
        pts.append((cx + r_tip * math.cos(a4), cy + r_tip * math.sin(a4)))
        a5 = math.radians(base + step * 0.80)
        pts.append((cx + r_root * math.cos(a5), cy + r_root * math.sin(a5)))

    draw.polygon(pts, fill=(*color, 255))

    mask = Image.new("L", (render_size, render_size), 255)
    m_draw = ImageDraw.Draw(mask)
    m_draw.ellipse([cx - r_hole, cy - r_hole, cx + r_hole, cy + r_hole], fill=0)

    final_img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    final_img.paste(img, mask=mask)
    final_img = final_img.resize((size, size), Image.Resampling.LANCZOS)

    ctk_img = ctk.CTkImage(light_image=final_img, dark_image=final_img, size=(size, size))
    _gear_cache[cache_key] = ctk_img
    return ctk_img

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller."""
    try:
        base_path = sys._MEIPASS
    except Exception:
        curr_dir = os.path.abspath(os.path.dirname(__file__))
        if os.path.basename(curr_dir) == "src":
            base_path = os.path.dirname(curr_dir)
        else:
            base_path = curr_dir
    return os.path.join(base_path, relative_path)

def short(path, n=58):
    name = os.path.basename(path)
    return name if len(name) <= n else name[: n - 3] + "..."

def fetch_github_release(repo, timeout=10):
    """Fetches the latest release info from GitHub API with SSL resilience and fallback."""
    import json
    import ssl
    import socket
    import urllib.request
    import urllib.error
    from src.constants import APP_VERSION

    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) SubtitleSync/{APP_VERSION}",
            "Accept": "application/vnd.github.v3+json",
        }
    )

    ctx = None
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            ctx = ssl.create_default_context()
        except Exception:
            pass

    def _resolve_error_message(err):
        reason = getattr(err, "reason", None)
        sub_err = reason if reason is not None else err

        if isinstance(sub_err, (socket.gaierror, socket.herror)):
            return "No internet connection. Please check your network and try again."
        if isinstance(sub_err, (socket.timeout, TimeoutError)):
            return "Connection timed out. Please check your internet connection."
        if isinstance(sub_err, (ConnectionRefusedError, ConnectionResetError)):
            return "Connection failed. Please check your internet connection."
        if isinstance(sub_err, ssl.SSLError):
            return "SSL secure connection failed. Please check your network."

        err_str = f"{err} {sub_err}".lower()
        if any(term in err_str for term in ("getaddrinfo", "11001", "unreachable", "no route", "not connected", "offline", "network is down")):
            return "No internet connection. Please check your network and try again."
        if "timed out" in err_str:
            return "Connection timed out. Please check your internet connection."

        return "Could not connect to GitHub. Please check your internet connection."

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8")), None
    except urllib.error.HTTPError as e:
        if e.code == 403:
            return None, "GitHub API rate limit exceeded. Please try again later."
        if e.code == 404:
            return None, "No releases published yet on GitHub."
        return None, f"GitHub server returned error (HTTP {e.code})."
    except Exception as primary_err:
        # If the primary error is an offline/network failure, do not waste time retrying SSL
        reason = getattr(primary_err, "reason", None)
        is_net_error = isinstance(reason or primary_err, (socket.gaierror, socket.herror, socket.timeout, TimeoutError, ConnectionRefusedError, ConnectionResetError))
        err_str = f"{primary_err} {reason}".lower()
        if not is_net_error and not any(t in err_str for t in ("getaddrinfo", "11001", "unreachable", "timed out")):
            try:
                unverified_ctx = ssl._create_unverified_context()
                with urllib.request.urlopen(req, timeout=timeout, context=unverified_ctx) as resp:
                    if resp.status == 200:
                        return json.loads(resp.read().decode("utf-8")), None
            except urllib.error.HTTPError as e:
                if e.code == 403:
                    return None, "GitHub API rate limit exceeded. Please try again later."
                if e.code == 404:
                    return None, "No releases published yet on GitHub."
                return None, f"GitHub server returned error (HTTP {e.code})."
            except Exception:
                pass

        return None, _resolve_error_message(primary_err)

    return None, "Could not connect to GitHub. Please check your internet connection."


def format_release_notes(text: str) -> str:
    """Cleans raw GitHub Markdown release notes into readable, elegant plain text for the updater dialog."""
    import re

    if not text or not text.strip():
        return "Bug fixes and performance improvements."

    lines = text.replace("\r\n", "\n").split("\n")
    cleaned = []

    for line in lines:
        s = line.strip()

        # Omit redundant main release title (e.g. ## Subtitle Sync Studio v1.2.1)
        if re.match(r"^#+\s*(Subtitle\s*Sync.*|v?\d+\.\d+.*)$", s, re.IGNORECASE):
            continue

        # Drop markdown horizontal dividers (---, ***, ___)
        if re.match(r"^-{3,}$|^\*{3,}$|^_{3,}$", s):
            continue

        # Drop markdown table divider rows (e.g. | :--- | :--- |)
        if re.match(r"^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$", s):
            continue

        # Parse and format markdown table content rows (e.g. | File | Type | Description |)
        if s.startswith("|") and s.endswith("|"):
            cells = [c.strip() for c in s.strip("|").split("|")]
            if any(h in cells[0].lower() for h in ["file", "asset", "package", "name"]):
                continue
            cells_clean = [re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", c) for c in cells]
            cells_clean = [re.sub(r"[*`_]", "", c).strip() for c in cells_clean]
            if len(cells_clean) >= 3:
                line = f"• {cells_clean[0]} ({cells_clean[1]}): {cells_clean[2]}"
            elif len(cells_clean) == 2:
                line = f"• {cells_clean[0]}: {cells_clean[1]}"
            else:
                line = f"• {cells_clean[0]}"
            cleaned.append(line)
            continue

        # Section headers (### Header -> Header)
        m_head = re.match(r"^(#{1,6})\s+(.*)$", s)
        if m_head:
            header_text = m_head.group(2).strip()
            header_text = re.sub(r"[*`_]", "", header_text)
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            cleaned.append(header_text)
            continue

        # Top-level list item (- **Item**: -> • Item:)
        m_top_item = re.match(r"^\s*[-*+]\s+\*\*(.*?)\*\*:(.*)$", line)
        if m_top_item:
            title = m_top_item.group(1).strip()
            rest = m_top_item.group(2).strip()
            cleaned.append(f"• {title}:{(' ' + rest) if rest else ''}")
            continue

        # Top-level list item (- Item)
        m_top_bullet = re.match(r"^[-*+]\s+(.*)$", line)
        if m_top_bullet:
            cleaned.append(f"• {m_top_bullet.group(1).strip()}")
            continue

        # Nested list item (  - Sub item)
        m_nest_bullet = re.match(r"^(\s+)[-*+]\s+(.*)$", line)
        if m_nest_bullet:
            cleaned.append(f"{m_nest_bullet.group(1)}- {m_nest_bullet.group(2).strip()}")
            continue

        cleaned.append(line)

    result = "\n".join(cleaned)
    # Strip markdown links: [text](url) -> text
    result = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", result)
    # Strip bold and italic markdown tags
    result = re.sub(r"\*\*(.*?)\*\*", r"\1", result)
    result = re.sub(r"\*(.*?)\*", r"\1", result)
    result = re.sub(r"__(.*?)__", r"\1", result)
    # Strip backticks
    result = re.sub(r"`(.*?)`", r"\1", result)
    # Collapse multiple blank lines
    result = re.sub(r"\n{3,}", "\n\n", result).strip()
    return result
