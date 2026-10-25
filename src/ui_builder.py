"""UI Layout Builder for Subtitle Sync Studio."""
import customtkinter as ctk

from src.constants import (
    APP_VERSION, ACCENT, ACCENT_HOVER, DANGER, DANGER_HOVER,
    SUCCESS, WARNING, CARD_BG, CARD_BORDER, INSET_BG, SUB_ITEM_BG,
    BADGE_BG, BADGE_FG, MUTED_TEXT, MAX_SUBTITLES,
    MODES, MODE_STANDARD, MODE_HINTS, LOCKED_HINT
)
from src.media import get_subtitle_sync_details
from src.utils import get_gear_icon, short


def create_step_card(container, step_num: str, title: str, subtitle: str) -> ctk.CTkFrame:
    """Creates a standardized card frame with a 'STEP X' badge, title, and subtitle."""
    frame = ctk.CTkFrame(
        container,
        corner_radius=14,
        fg_color=CARD_BG,
        border_width=1,
        border_color=CARD_BORDER
    )

    header_frame = ctk.CTkFrame(frame, fg_color="transparent")
    header_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=14, pady=(10, 8))
    header_frame.grid_columnconfigure(1, weight=1)

    # Step Badge (Pill)
    badge = ctk.CTkLabel(
        header_frame,
        text=f"  {step_num}  ",
        font=ctk.CTkFont(size=10, weight="bold"),
        fg_color=BADGE_BG,
        text_color=BADGE_FG,
        corner_radius=6,
        height=20
    )
    badge.grid(row=0, column=0, rowspan=2, padx=(0, 10), sticky="n")

    # Title
    ctk.CTkLabel(
        header_frame,
        text=title,
        font=ctk.CTkFont(size=13, weight="bold"),
        anchor="w"
    ).grid(row=0, column=1, sticky="w")

    # Subtitle
    ctk.CTkLabel(
        header_frame,
        text=subtitle,
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT,
        anchor="w"
    ).grid(row=1, column=1, sticky="w")

    return frame


def build_main_ui(app):
    """Constructs all main window frames, cards, buttons, and status elements on the app instance."""
    app.grid_columnconfigure(0, weight=1)
    app.grid_rowconfigure(0, weight=0)
    app.grid_rowconfigure(1, weight=1)
    app.grid_rowconfigure(2, weight=0)
    app.grid_rowconfigure(3, weight=0)

    # ---------------- HEADER ----------------
    header = ctk.CTkFrame(app, fg_color="transparent")
    header.grid(row=0, column=0, sticky="ew", padx=24, pady=(14, 8))
    header.grid_columnconfigure(0, weight=1)

    title_box = ctk.CTkFrame(header, fg_color="transparent")
    title_box.grid(row=0, column=0, sticky="w")

    title_row = ctk.CTkFrame(title_box, fg_color="transparent")
    title_row.pack(anchor="w")

    title_icon = ctk.CTkLabel(
        title_row,
        text="⚡",
        font=ctk.CTkFont(size=24),
        text_color=ACCENT
    )
    title_icon.pack(side="left", padx=(0, 8))

    ctk.CTkLabel(
        title_row,
        text="Subtitle Sync",
        font=ctk.CTkFont(family="Segoe UI", size=24, weight="bold")
    ).pack(side="left")

    version_badge = ctk.CTkFrame(
        title_row,
        fg_color=BADGE_BG,
        corner_radius=10,
        height=20
    )
    version_badge.pack(side="left", padx=(10, 0), pady=(4, 0))
    ctk.CTkLabel(
        version_badge,
        text=f"v{APP_VERSION}",
        font=ctk.CTkFont(size=11, weight="bold"),
        text_color=BADGE_FG,
        height=20
    ).pack(padx=8, pady=1)

    ctk.CTkLabel(
        title_box,
        text="Automatically synchronize out-of-sync subtitles with your movie's reference audio",
        font=ctk.CTkFont(size=12),
        text_color=MUTED_TEXT
    ).pack(anchor="w", pady=(3, 0))

    header_actions = ctk.CTkFrame(header, fg_color="transparent")
    app.header_actions = header_actions
    app.update_btn = None
    header_actions.grid(row=0, column=1, sticky="e")

    app.settings_btn = ctk.CTkButton(
        header_actions,
        text=" Settings",
        image=get_gear_icon(14),
        compound="left",
        font=ctk.CTkFont(size=12),
        height=28,
        corner_radius=14,
        fg_color="transparent",
        border_width=1,
        border_color=CARD_BORDER,
        text_color=("gray20", "gray85"),
        hover_color=("gray90", "gray25"),
        command=app.show_settings_dialog
    )
    app.settings_btn.pack(side="right")

    app.ffmpeg_btn = ctk.CTkButton(
        header_actions,
        text="Checking FFmpeg...",
        font=ctk.CTkFont(size=11),
        height=26,
        corner_radius=13,
        command=app.show_ffmpeg_dialog
    )
    app.ffmpeg_btn.pack(side="right", padx=(0, 14))

    # ---------------- MAIN SCROLLABLE CONTAINER ----------------
    app.cards_container = ctk.CTkScrollableFrame(app, fg_color="transparent")
    app.cards_container.grid(row=1, column=0, sticky="nsew", padx=20, pady=0)
    app.cards_container.grid_columnconfigure(0, weight=1)

    # ---------------- STEP 1: Movie File ----------------
    card1 = create_step_card(
        app.cards_container,
        step_num="STEP 1",
        title="Movie Reference",
        subtitle="Select the video file containing the source audio track"
    )
    card1.grid(row=0, column=0, sticky="ew", pady=(0, 8))
    card1.grid_columnconfigure(0, weight=1)

    v_slot = ctk.CTkFrame(
        card1,
        fg_color=INSET_BG,
        corner_radius=10,
        border_width=1,
        border_color=CARD_BORDER
    )
    v_slot.grid(row=1, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 10))
    v_slot.grid_columnconfigure(1, weight=1)

    ctk.CTkLabel(
        v_slot,
        text="🎬",
        font=ctk.CTkFont(size=16)
    ).grid(row=0, column=0, padx=(12, 6), pady=10)

    app.video_label = ctk.CTkLabel(
        v_slot,
        text="No movie selected yet (select .mp4, .mkv, .avi, etc.)",
        anchor="w",
        font=ctk.CTkFont(size=12),
        text_color=MUTED_TEXT
    )
    app.video_label.grid(row=0, column=1, sticky="ew", padx=(0, 10), pady=10)

    ctk.CTkButton(
        v_slot,
        text="Browse Video",
        width=120,
        height=32,
        font=ctk.CTkFont(size=12, weight="bold"),
        fg_color=ACCENT,
        hover_color=ACCENT_HOVER,
        corner_radius=8,
        command=app.pick_video
    ).grid(row=0, column=2, padx=(0, 10), pady=8)

    app.video_meta_label = ctk.CTkLabel(
        v_slot,
        text="",
        anchor="w",
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT,
        justify="left"
    )
    app.video_meta_label.grid(row=1, column=1, columnspan=2, sticky="w", padx=(0, 10), pady=(0, 8))
    app.video_meta_label.grid_remove()

    # ---------------- STEP 2: Subtitle Files ----------------
    card2 = create_step_card(
        app.cards_container,
        step_num="STEP 2",
        title="Subtitle Files",
        subtitle="Add one or multiple subtitles that need synchronization"
    )
    card2.grid(row=1, column=0, sticky="ew", pady=(0, 8))
    card2.grid_columnconfigure(0, weight=1)

    sub_toolbar = ctk.CTkFrame(card2, fg_color="transparent")
    sub_toolbar.grid(row=1, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 6))
    sub_toolbar.grid_columnconfigure(1, weight=1)

    ctk.CTkButton(
        sub_toolbar,
        text="+ Add Subtitle(s)",
        width=140,
        height=30,
        font=ctk.CTkFont(size=12, weight="bold"),
        fg_color=ACCENT,
        hover_color=ACCENT_HOVER,
        corner_radius=8,
        command=app.add_subs
    ).grid(row=0, column=0, padx=(0, 8))

    app.sub_count_label = ctk.CTkLabel(
        sub_toolbar,
        text=f"0 / {MAX_SUBTITLES} files added",
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT
    )
    app.sub_count_label.grid(row=0, column=1, sticky="w", padx=6)

    ctk.CTkButton(
        sub_toolbar,
        text="Clear all",
        width=80,
        height=30,
        font=ctk.CTkFont(size=11),
        fg_color="transparent",
        border_width=1,
        border_color=CARD_BORDER,
        text_color=("gray20", "gray80"),
        hover_color=("gray90", "gray25"),
        corner_radius=8,
        command=app.clear_subs
    ).grid(row=0, column=2, sticky="e")

    app.sub_list = ctk.CTkScrollableFrame(
        card2,
        height=85,
        corner_radius=10,
        fg_color=INSET_BG,
        border_width=1,
        border_color=CARD_BORDER
    )
    app.sub_list.grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 10))
    app.sub_list.grid_columnconfigure(0, weight=1)

    app.refresh_sub_list()

    # Notice banner above Step 3 (collapses when unlocked)
    app.lock_hint = ctk.CTkLabel(
        app.cards_container,
        text=f"🔒 {LOCKED_HINT}",
        font=ctk.CTkFont(size=12, weight="bold"),
        text_color=WARNING,
        anchor="w"
    )
    app.lock_hint.grid(row=2, column=0, sticky="w", padx=6, pady=(0, 6))

    # Dedicated Analysis & Mode Recommendation box above Step 3
    app.fps_box = ctk.CTkFrame(
        app.cards_container,
        fg_color=INSET_BG,
        corner_radius=8,
        border_width=1,
        border_color=CARD_BORDER
    )
    app.fps_box.grid(row=2, column=0, sticky="ew", padx=2, pady=(0, 8))
    app.fps_box.grid_columnconfigure(0, weight=1)

    app.fps_label = ctk.CTkLabel(
        app.fps_box,
        text="",
        font=ctk.CTkFont(size=11, weight="bold"),
        justify="left",
        anchor="w"
    )
    app.fps_label.grid(row=0, column=0, sticky="w", padx=12, pady=(5, 2))

    app.fps_rec_label = ctk.CTkLabel(
        app.fps_box,
        text="",
        font=ctk.CTkFont(size=11),
        justify="left",
        anchor="w",
        wraplength=660
    )
    app.fps_rec_label.grid(row=1, column=0, sticky="w", padx=12, pady=(0, 5))
    app.fps_box.grid_remove()

    # ---------------- STEP 3: Sync Actions ----------------
    card3 = create_step_card(
        app.cards_container,
        step_num="STEP 3",
        title="Synchronize",
        subtitle="Pick a mode, then start speech alignment and output synced subtitle files"
    )
    card3.grid(row=3, column=0, sticky="ew", pady=(0, 8))
    card3.grid_columnconfigure(1, weight=1)

    opts = ctk.CTkFrame(card3, fg_color="transparent")
    opts.grid(row=1, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 6))
    opts.grid_columnconfigure(0, weight=1)

    mode_row = ctk.CTkFrame(opts, fg_color="transparent")
    mode_row.grid(row=0, column=0, sticky="w")

    ctk.CTkLabel(
        mode_row,
        text="Mode",
        font=ctk.CTkFont(size=12, weight="bold")
    ).pack(side="left", padx=(0, 10))

    app.mode_btn = ctk.CTkSegmentedButton(
        mode_row,
        values=MODES,
        command=app.on_mode_change,
        selected_color=ACCENT,
        selected_hover_color=ACCENT_HOVER,
        font=ctk.CTkFont(size=12, weight="bold")
    )
    app.mode_btn.set(MODE_STANDARD)
    app.mode_btn.pack(side="left")

    app.mode_hint = ctk.CTkLabel(
        opts,
        text=MODE_HINTS[MODE_STANDARD],
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT,
        justify="left",
        anchor="w",
        wraplength=660
    )
    app.mode_hint.grid(row=1, column=0, sticky="w", pady=(2, 4))

    # Audio track picker
    app.extra_row = ctk.CTkFrame(opts, fg_color="transparent")
    app.extra_row.grid(row=2, column=0, sticky="w")

    ctk.CTkLabel(
        app.extra_row,
        text="Audio track",
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT
    ).pack(side="left", padx=(0, 6))

    app.audio_menu = ctk.CTkOptionMenu(
        app.extra_row,
        values=["Track 1"],
        width=430,
        height=26,
        dynamic_resizing=False,
        font=ctk.CTkFont(size=11),
        dropdown_font=ctk.CTkFont(size=11),
        fg_color=INSET_BG,
        button_color=BADGE_BG,
        button_hover_color=CARD_BORDER,
        text_color=("gray10", "gray90")
    )
    app.audio_menu.pack(side="left")
    app.extra_row.grid_remove()

    action_row = ctk.CTkFrame(card3, fg_color="transparent")
    action_row.grid(row=2, column=0, columnspan=2, sticky="ew", padx=14, pady=(0, 10))
    action_row.grid_columnconfigure(1, weight=1)

    app.start_btn = ctk.CTkButton(
        action_row,
        text="⚡ Start Syncing",
        height=38,
        width=160,
        font=ctk.CTkFont(size=13, weight="bold"),
        fg_color=ACCENT,
        hover_color=ACCENT_HOVER,
        corner_radius=8,
        command=app.start
    )
    app.start_btn.grid(row=0, column=0)

    app.progress = ctk.CTkProgressBar(
        action_row,
        mode="indeterminate",
        progress_color=ACCENT,
        height=10,
        corner_radius=5
    )
    app.progress.grid(row=0, column=1, sticky="ew", padx=16)
    app.progress.set(0)

    app.cancel_btn = ctk.CTkButton(
        action_row,
        text="Cancel",
        width=90,
        height=38,
        font=ctk.CTkFont(size=12, weight="bold"),
        fg_color=DANGER,
        hover_color=DANGER_HOVER,
        corner_radius=8,
        state="disabled",
        command=app.cancel
    )
    app.cancel_btn.grid(row=0, column=2)

    # ---------------- ACTIVITY LOG (COLLAPSIBLE) ----------------
    app.logcard = ctk.CTkFrame(
        app.cards_container,
        corner_radius=14,
        fg_color=CARD_BG,
        border_width=1,
        border_color=CARD_BORDER
    )
    app.logcard.grid(row=4, column=0, sticky="ew", pady=(0, 10))
    app.logcard.grid_columnconfigure(0, weight=1)

    log_header = ctk.CTkFrame(app.logcard, fg_color="transparent")
    log_header.grid(row=0, column=0, sticky="ew", padx=14, pady=(8, 4))
    log_header.grid_columnconfigure(0, weight=1)

    ctk.CTkLabel(
        log_header,
        text="CONSOLE ACTIVITY",
        font=ctk.CTkFont(size=11, weight="bold"),
        text_color=MUTED_TEXT
    ).grid(row=0, column=0, sticky="w")

    app.log_toggle_btn = ctk.CTkButton(
        log_header,
        text="Show Log ▼",
        width=80,
        height=22,
        font=ctk.CTkFont(size=10, weight="bold"),
        fg_color="transparent",
        border_width=1,
        border_color=CARD_BORDER,
        text_color=("gray20", "gray85"),
        hover_color=("gray90", "gray25"),
        corner_radius=6,
        command=app.toggle_log
    )
    app.log_toggle_btn.grid(row=0, column=1, sticky="e")

    app.log = ctk.CTkTextbox(
        app.logcard,
        height=115,
        font=ctk.CTkFont(family="Consolas", size=11),
        fg_color=INSET_BG,
        corner_radius=10,
        wrap="word",
        border_width=1,
        border_color=CARD_BORDER
    )
    app.log.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 10))
    app.log.configure(state="disabled")
    app.log_visible = False
    app.log.grid_remove()

    # ---------------- FOOTER ----------------
    footer = ctk.CTkFrame(app, fg_color="transparent")
    footer.grid(row=2, column=0, sticky="ew", padx=24, pady=(6, 4))
    footer.grid_columnconfigure(0, weight=1)

    status_container = ctk.CTkFrame(footer, fg_color="transparent")
    status_container.grid(row=0, column=0, sticky="w")

    app.status_dot = ctk.CTkLabel(
        status_container,
        text="●",
        font=ctk.CTkFont(size=14),
        text_color=SUCCESS
    )
    app.status_dot.pack(side="left", padx=(0, 6))

    app.status = ctk.CTkLabel(
        status_container,
        text="Ready to sync",
        anchor="w",
        font=ctk.CTkFont(size=12),
        text_color=MUTED_TEXT
    )
    app.status.pack(side="left")

    app.open_btn = ctk.CTkButton(
        footer,
        text="📂 Open Output Folder",
        width=165,
        height=32,
        font=ctk.CTkFont(size=12),
        fg_color="transparent",
        border_width=1,
        border_color=CARD_BORDER,
        text_color=("gray20", "gray85"),
        hover_color=("gray90", "gray25"),
        corner_radius=8,
        state="normal",
        command=app.open_folder
    )
    app.open_btn.grid(row=0, column=1, sticky="e")

    # ---------------- DEVELOPER ATTRIBUTION & GITHUB ----------------
    bottom_credit_bar = ctk.CTkFrame(app, fg_color="transparent")
    bottom_credit_bar.grid(row=3, column=0, sticky="ew", padx=24, pady=(0, 8))
    bottom_credit_bar.grid_columnconfigure(0, weight=1)

    credit_lbl = ctk.CTkLabel(
        bottom_credit_bar,
        text="Developed by DH-0216",
        font=ctk.CTkFont(size=11),
        text_color=MUTED_TEXT
    )
    credit_lbl.grid(row=0, column=0, sticky="w")

    github_link = ctk.CTkButton(
        bottom_credit_bar,
        text="GitHub Repository ↗",
        font=ctk.CTkFont(size=11),
        fg_color="transparent",
        hover_color=("gray90", "gray25"),
        text_color=ACCENT,
        height=22,
        cursor="hand2",
        command=app.open_github_repo
    )
    github_link.grid(row=0, column=1, sticky="e")


def render_subtitle_list(sub_list_frame, subs, on_remove):
    """Renders either empty placeholder or the list of added subtitles."""
    for w in sub_list_frame.winfo_children():
        w.destroy()

    if not subs:
        empty_box = ctk.CTkFrame(sub_list_frame, fg_color="transparent")
        empty_box.grid(row=0, column=0, pady=24)
        ctk.CTkLabel(
            empty_box,
            text="📑",
            font=ctk.CTkFont(size=20),
            text_color=MUTED_TEXT
        ).pack()
        ctk.CTkLabel(
            empty_box,
            text="No subtitle files added yet",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color=MUTED_TEXT
        ).pack(pady=(2, 2))
        ctk.CTkLabel(
            empty_box,
            text=f"Click '+ Add Subtitle(s)' to choose up to {MAX_SUBTITLES} files (.srt, .ass, .vtt)",
            font=ctk.CTkFont(size=11),
            text_color=MUTED_TEXT
        ).pack()
        return

    for i, path in enumerate(subs):
        meta = get_subtitle_sync_details(path)
        item = ctk.CTkFrame(
            sub_list_frame,
            corner_radius=8,
            fg_color=SUB_ITEM_BG,
            border_width=1,
            border_color=CARD_BORDER
        )
        item.grid(row=i, column=0, sticky="ew", pady=2, padx=4)
        item.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(
            item,
            text="📄",
            font=ctk.CTkFont(size=14),
            text_color=ACCENT
        ).grid(row=0, column=0, rowspan=2, padx=(10, 6), pady=6)

        text_box = ctk.CTkFrame(item, fg_color="transparent")
        text_box.grid(row=0, column=1, sticky="ew", padx=(0, 6), pady=(4, 4))
        text_box.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(
            text_box,
            text=short(path, 58),
            anchor="w",
            font=ctk.CTkFont(size=12, weight="bold")
        ).grid(row=0, column=0, sticky="w")

        item_details = []
        if meta.get("fps"):
            item_details.append(f"🎬 {meta['fps']} fps")
        if meta.get("tag"):
            item_details.append(f"\U0001f3f7 {meta['tag']}")
        if meta.get("lines"):
            item_details.append(f"📝 {meta['lines']} lines")
        if meta.get("span"):
            item_details.append(f"⏱️ {meta['span']}")

        sub_detail_str = " • ".join(item_details)
        if sub_detail_str:
            ctk.CTkLabel(
                text_box,
                text=sub_detail_str,
                anchor="w",
                font=ctk.CTkFont(size=10),
                text_color=MUTED_TEXT
            ).grid(row=1, column=0, sticky="w", pady=(1, 0))

        ctk.CTkButton(
            item,
            text="✕",
            width=26,
            height=26,
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color="transparent",
            text_color=DANGER,
            hover_color=("gray85", "gray30"),
            corner_radius=6,
            command=lambda p=path: on_remove(p)
        ).grid(row=0, column=2, padx=6, pady=4)
