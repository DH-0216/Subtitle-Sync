"""System, path, and UI helper functions."""
import os
import sys

def set_windows_titlebar_color(window, dark: bool):
    if os.name != "nt":
        return
    try:
        import ctypes
        hwnd = ctypes.windll.user32.GetParent(window.winfo_id())
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
