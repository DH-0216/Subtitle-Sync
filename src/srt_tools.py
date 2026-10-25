"""SRT parsing, formatting, timestamp math, and audio cropping utilities."""
import os
import re
import statistics
import wave

SRT_TIME_RE = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")

def _to_seconds(h, m, s, frac):
    return int(h) * 3600 + int(m) * 60 + int(s) + int(frac.ljust(3, "0")[:3]) / 1000.0

def format_srt_time(t):
    """Format seconds into SRT timestamp string (HH:MM:SS,mmm)."""
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def hms(t):
    """Format seconds into human-readable H:MM:SS."""
    t = int(max(0, t))
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}"

def read_text_guess(path):
    """Read a text file, guessing the encoding (UTF-16 BOM, UTF-8, then Windows-1252)."""
    with open(path, "rb") as f:
        raw = f.read()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16", errors="replace")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace")

def parse_srt(text):
    """Return a list of [start_seconds, end_seconds, text], sorted by start time."""
    cues = []
    for block in re.split(r"\r?\n\s*\r?\n", text.strip()):
        lines = block.splitlines()
        for i, line in enumerate(lines):
            m = SRT_TIME_RE.search(line)
            if m:
                g = m.groups()
                cues.append([
                    _to_seconds(*g[0:4]),
                    _to_seconds(*g[4:8]),
                    "\n".join(lines[i + 1:]).strip()
                ])
                break
    cues.sort(key=lambda c: c[0])
    return cues

def write_srt(path, cues):
    """Write cues list to an SRT file with 1-based indexing."""
    entries = []
    for i, (start, end, text) in enumerate(sorted(cues, key=lambda c: c[0]), 1):
        entries.append(f"{i}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{text}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(entries))

def group_cues(cues, chunk_len=210, min_cues=15):
    """Split subtitle cues into adaptive consecutive parts of about chunk_len seconds,
    ensuring each part has at least min_cues to give ffsubsync enough speech signal."""
    if not cues:
        return []
    
    parts = []
    current_part = []
    part_start_time = cues[0][0]
    
    for c in cues:
        current_part.append(c)
        if (c[1] - part_start_time >= chunk_len) and len(current_part) >= min_cues:
            parts.append(current_part)
            current_part = []
            part_start_time = c[0]
            
    if current_part:
        if parts and len(current_part) < min_cues:
            parts[-1].extend(current_part)
        else:
            parts.append(current_part)
            
    return parts

def clean_and_sort_cues(cues):
    """Sort cues and ensure no two subtitles overlap after shift adjustments."""
    if not cues:
        return []
    sorted_cues = sorted(cues, key=lambda c: c[0])
    cleaned = []
    prev_end = -1.0
    for start, end, text in sorted_cues:
        if end <= start:
            end = start + 1.5
        if start < prev_end:
            start = prev_end + 0.05
            if end <= start:
                end = start + 1.0
        cleaned.append([start, end, text])
        prev_end = end
    return cleaned

def estimate_shift(before, after):
    """How far ffsubsync moved a group of lines (median shift in seconds)."""
    if not before or not after:
        return None
    if len(before) == len(after):
        return statistics.median(a[0] - b[0] for a, b in zip(after, before))
    return after[0][0] - before[0][0]

def crop_wav(src_wav, dst_wav, start_s, dur_s):
    """Copy a time window out of a WAV file without re-decoding the video."""
    with wave.open(src_wav, "rb") as r:
        rate = r.getframerate()
        r.setpos(min(int(start_s * rate), r.getnframes()))
        frames = r.readframes(int(dur_s * rate))
        with wave.open(dst_wav, "wb") as w:
            w.setnchannels(r.getnchannels())
            w.setsampwidth(r.getsampwidth())
            w.setframerate(rate)
            w.writeframes(frames)
