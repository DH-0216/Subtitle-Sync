"""Constants, color palettes, and global configuration."""
import customtkinter as ctk

# Prevent CustomTkinter from manipulating Windows titlebars with withdraw(),
# which causes window flashing, Aero snap breakage, and frozen mouse click focus.
ctk.CTk._deactivate_windows_window_header_manipulation = True
ctk.CTkToplevel._deactivate_windows_window_header_manipulation = True

APP_VERSION = "1.2.0"
GITHUB_REPO = "DH-0216/Subtitle-Sync"

# Color palette & themes
ACCENT = "#6366F1"          # Modern Indigo
ACCENT_HOVER = "#4F46E5"
DANGER = "#EF4444"          # Modern Red
DANGER_HOVER = "#DC2626"
SUCCESS = "#10B981"         # Modern Emerald
WARNING = "#F59E0B"

# Theme-aware surface colors (light, dark)
CARD_BG = ("#FFFFFF", "#1E222D")
CARD_BORDER = ("#CBD5E1", "#2E3446")
INSET_BG = ("#F1F5F9", "#14171F")
SUB_ITEM_BG = ("#F8FAFC", "#252B3B")
BADGE_BG = ("#EEF2FF", "#2E3258")
BADGE_FG = ("#4F46E5", "#A5B4FC")
MUTED_TEXT = ("#334155", "#94A3B8")

VIDEO_TYPES = [("Video files", "*.mkv *.mp4 *.avi *.mov *.m4v *.webm"), ("All files", "*.*")]
SUB_TYPES = [("Subtitle files", "*.srt *.ass *.ssa *.vtt"), ("All files", "*.*")]
MAX_SUBTITLES = 10          # Maximum subtitle files allowed in a single batch session

# ---------------------------------------------------------------------------
# Sync modes & hints
# ---------------------------------------------------------------------------
MODE_STANDARD = "Standard"
MODE_SMART = "Smart"
MODE_SPLIT = "Split sync"
MODES = [MODE_STANDARD, MODE_SMART, MODE_SPLIT]
MODE_HINTS = {
    MODE_STANDARD: "⚡ Standard: Fast 1-pass alignment. Best for normal movies and episodes that only need a fixed time shift.",
    MODE_SMART: "🔍 Smart: Multi-pass search with speed drift correction. Best when subtitles slowly drift out of sync over time.",
    MODE_SPLIT: "✂️ Split sync: Piecewise alignment. Best for TV episodes or movies with different cuts (HDTV vs BluRay, commercials, or extended scenes).",
}
LOCKED_HINT = "Step 3 unlocks after you choose a movie (Step 1) and at least one subtitle (Step 2)."

FIRST_MARGIN = 900        # seconds searched around the first part (+/- 15 min)
TRACK_MARGIN = 300        # seconds searched around later parts (+/- 5 min)
MIN_CUES_PER_PART = 5     # parts with fewer subtitle lines reuse the previous offset
PART_MINUTES = 2          # Split sync part size: small = precise around ad breaks/cuts
