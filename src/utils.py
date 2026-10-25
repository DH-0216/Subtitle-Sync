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
