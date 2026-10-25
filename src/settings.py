"""Persistent user settings for theme and update preferences."""
import json
import os

def get_settings_path():
    local = os.path.join(os.environ.get("LOCALAPPDATA", ""), "SubtitleSync")
    os.makedirs(local, exist_ok=True)
    return os.path.join(local, "settings.json")

def load_settings():
    try:
        p = get_settings_path()
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {"theme": "dark", "check_updates_startup": True}

def save_settings(data):
    try:
        p = get_settings_path()
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass
