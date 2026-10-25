"""Intelligent sync mode recommendation engine based on video and subtitle media analysis."""
from collections import Counter
from dataclasses import dataclass
from typing import Optional, List

from src.constants import (
    MODE_STANDARD, MODE_SMART, MODE_SPLIT,
    SUCCESS, WARNING, MUTED_TEXT
)
from src.media import get_release_type_and_cut, get_subtitle_sync_details

# Physical cut editions that add/remove/rearrange scenes
REAL_CUTS = {"Extended", "Director's Cut", "Unrated", "Theatrical"}

# Broadcast sources (HDTV / TVRip) have commercial interruptions removed
BROADCAST_SOURCES = {"hdtv", "pdtv", "dsrip", "tvrip"}

# Continuous home and streaming release sources
CONTINUOUS_SOURCES = {"bluray", "web", "dvd"}


@dataclass
class Recommendation:
    mode: str
    title: str
    hint: str
    color: str


def analyze_recommendation(
    video_path: str,
    video_fps: Optional[float],
    subs: List[str]
) -> Optional[Recommendation]:
    """Analyzes reference video and subtitle files to recommend the optimal sync mode.

    Returns Recommendation or None if inputs are insufficient.
    """
    if not video_path or not subs:
        return None

    # 1. Video release source and cut
    v_source, v_cuts, v_tag = get_release_type_and_cut(video_path)

    # 2. Subtitle(s) release sources and cuts
    sub_metas = [get_subtitle_sync_details(p) for p in subs]
    sub_fps_list = [m["fps"] for m in sub_metas if m.get("fps")]
    unique_sub_fps = sorted(list(set(sub_fps_list)))

    v_scene_cuts = set(v_cuts) & REAL_CUTS
    is_v_broadcast = v_source.lower() in BROADCAST_SOURCES if v_source else False

    has_broadcast_cut = False
    has_cut_mismatch = False
    diff_sub_tag = ""
    diff_reason = ""

    for m in sub_metas:
        s_source = m.get("source", "")
        s_scene_cuts = set(m.get("cuts", [])) & REAL_CUTS
        is_s_broadcast = s_source.lower() in BROADCAST_SOURCES if s_source else False

        # Check for broadcast TV vs retail/streaming mismatch (commercial gaps)
        if (is_v_broadcast != is_s_broadcast) and bool(v_source and s_source):
            has_broadcast_cut = True
            diff_sub_tag = m.get("tag") or s_source
            diff_reason = f"Broadcast commercial cuts ({v_source} vs {s_source})"
            break

        # Check for alternate scene editions (e.g. Extended vs Theatrical)
        if v_scene_cuts != s_scene_cuts:
            has_cut_mismatch = True
            diff_sub_tag = m.get("tag") or "Alternate edition"
            v_cut_name = " ".join(v_scene_cuts) if v_scene_cuts else "Standard cut"
            s_cut_name = " ".join(s_scene_cuts) if s_scene_cuts else "Standard cut"
            diff_reason = f"Different edition cuts ({v_cut_name} vs {s_cut_name})"
            break

    # Case A: Commercial cuts or alternate edition cuts detected!
    if has_broadcast_cut or has_cut_mismatch:
        v_label = v_tag if v_tag else "Movie reference"
        s_label = diff_sub_tag if diff_sub_tag else "Different release"
        title = f"⚡ {diff_reason} (Video: {v_label} vs Subtitle: {s_label}) — Recommended: 'Split sync' mode."
        if has_broadcast_cut:
            hint = (
                "💡 Broadcast HDTV releases have TV commercial breaks removed, which physically "
                "alters timeline intervals. Piecewise Split sync aligns subtitles around commercial cuts."
            )
        else:
            hint = (
                "💡 Extended, Unrated, or Director's Cuts contain added or rearranged scenes. "
                "'Split sync' aligns subtitles piecewise around scene changes."
            )
        return Recommendation(mode=MODE_SPLIT, title=title, hint=hint, color=WARNING)

    # Case B: Frame rates differ (Speed drift)
    if video_fps and len(unique_sub_fps) == 1 and abs(video_fps - unique_sub_fps[0]) >= 0.05:
        title = (
            f"⚡ Frame rate mismatch: Video ({video_fps} fps) vs Subtitle "
            f"({unique_sub_fps[0]} fps) — Recommended: 'Smart' mode."
        )
        hint = (
            "💡 Frame rate differences (e.g. 23.976 vs 25.0 fps) cause subtitles to slowly drift "
            "out of sync over time. 'Smart' mode stretches or compresses timing to keep pace across the whole movie."
        )
        return Recommendation(mode=MODE_SMART, title=title, hint=hint, color=WARNING)

    if len(unique_sub_fps) > 1:
        counts = Counter(sub_fps_list)
        fps_summary = ", ".join(f"{f} fps ({c})" for f, c in counts.items())
        title = (
            f"⚡ Mixed subtitle frame rates ({fps_summary}) vs Video "
            f"({video_fps or 'Unknown'} fps) — Recommended: 'Smart' mode."
        )
        hint = (
            "💡 Subtitles have different speed bases. 'Smart' mode will align each file "
            "independently with drift correction."
        )
        return Recommendation(mode=MODE_SMART, title=title, hint=hint, color=WARNING)

    # Case C: Both Frame Rates AND Continuous Releases match!
    if video_fps and len(unique_sub_fps) == 1 and abs(video_fps - unique_sub_fps[0]) < 0.05:
        sub_count_str = f"All {len(subs)} subtitles" if len(subs) > 1 else "Subtitle"
        all_sub_sources = {m.get("source", "").lower() for m in sub_metas if m.get("source")}

        if (
            v_source
            and all_sub_sources
            and v_source.lower() in CONTINUOUS_SOURCES
            and all_sub_sources.issubset(CONTINUOUS_SOURCES)
            and {v_source.lower()} != all_sub_sources
        ):
            sub_types_str = "/".join(sorted({m.get("source", "") for m in sub_metas if m.get("source")}))
            title = (
                f"✅ Uncut continuous releases (Video: {v_source} vs Subtitle: {sub_types_str}, "
                f"{video_fps} fps) — Recommended: 'Standard' mode."
            )
            hint = (
                f"💡 Both {v_source} and {sub_types_str} share unbroken, continuous timelines without "
                "commercials. Fast 1-pass Standard mode aligns all dialogue globally with maximum accuracy "
                "and zero false splits."
            )
            return Recommendation(mode=MODE_STANDARD, title=title, hint=hint, color=SUCCESS)

        title = f"✅ Frame rates & release types match ({video_fps} fps) — Recommended: 'Standard' mode."
        hint = (
            f"💡 {sub_count_str} and video share the same release cut. Fast 1-pass alignment "
            "will quickly shift subtitles into place."
        )
        return Recommendation(mode=MODE_STANDARD, title=title, hint=hint, color=SUCCESS)

    # Fallback Case
    return Recommendation(
        mode="",
        title="🎬 Ready to synchronize subtitles with reference movie.",
        hint="💡 Tip: Choose 'Standard' for same-cut sync, 'Smart' for drift, or 'Split sync' for different releases.",
        color=("gray10", "gray90")
    )
