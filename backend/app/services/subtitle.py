"""
Generates ASS subtitle files.

Two entry points:
  create_ass()             — from raw word timestamps (first render)
  create_ass_from_chunks() — from edited SubtitleChunk list (re-render)
"""
from typing import List, Dict, Optional
from app.models import SubtitleChunk, SubtitleData


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fmt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


def hex_to_ass(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


# ──────────────────────────────────────────────────────────────────────────────
# Word grouping (used only on first render)
# ──────────────────────────────────────────────────────────────────────────────

def _group(
    words: List[Dict],
    max_words: int = 6,
    max_duration: float = 3.5,
    gap_threshold: float = 0.8,
) -> List[List[Dict]]:
    chunks: List[List[Dict]] = []
    current: List[Dict] = []
    for word in words:
        if current:
            gap = word["start"] - current[-1]["end"]
            dur = word["end"] - current[0]["start"]
            if len(current) >= max_words or dur >= max_duration or gap >= gap_threshold:
                chunks.append(current)
                current = []
        current.append(word)
    if current:
        chunks.append(current)
    return chunks


def words_to_subtitle_data(
    words: List[Dict],
    animation: str,
    color: str,
) -> SubtitleData:
    """Convert flat word list → SubtitleData (saved to disk for editing)."""
    raw_chunks = _group(words)
    chunks = [
        SubtitleChunk(
            id=i,
            text=" ".join(w["text"] for w in chunk),
            start=chunk[0]["start"],
            end=chunk[-1]["end"],
            animation=None,  # uses global
        )
        for i, chunk in enumerate(raw_chunks)
    ]
    return SubtitleData(chunks=chunks, color=color, global_animation=animation)


# ──────────────────────────────────────────────────────────────────────────────
# ASS header
# ──────────────────────────────────────────────────────────────────────────────

def _header(primary: str, secondary: str) -> str:
    return f"""\
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Rounded MT Bold,76,{primary},{secondary},&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,1,5,2,2,80,80,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


# ──────────────────────────────────────────────────────────────────────────────
# Dialogue builders
# ──────────────────────────────────────────────────────────────────────────────

def _pop(text: str, start: float, end: float) -> str:
    anim = "{\\fad(0,150)\\t(0,100,\\fscx115\\fscy115)\\t(100,220,\\fscx100\\fscy100)}"
    return f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},Default,,0,0,0,,{anim}{text}\n"


def _fade(text: str, start: float, end: float) -> str:
    return f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},Default,,0,0,0,,{{\\fad(250,250)}}{text}\n"


def _karaoke(text: str, start: float, end: float) -> str:
    """Simple karaoke on a plain-text chunk (no per-word timing after edit)."""
    dur_cs = max(1, round((end - start) * 100))
    return (
        f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},"
        f"Default,,0,0,0,,{{\\fad(120,120)}}{{\\kf{dur_cs}}}{text}\n"
    )


_BUILDERS = {
    "pop": _pop,
    "fade": _fade,
    "karaoke": _karaoke,
}


def _build_line(chunk: SubtitleChunk, global_animation: str) -> str:
    anim = chunk.animation or global_animation
    builder = _BUILDERS.get(anim, _karaoke)
    return builder(chunk.text, chunk.start, chunk.end)


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def create_ass_from_data(data: SubtitleData, output_path: str) -> None:
    primary = hex_to_ass(data.color)
    secondary = "&H00FFFF00" if data.color.upper() in ("#FFFFFF", "#FFFF00") else "&H0000FFFF"

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(_header(primary, secondary))
        for chunk in sorted(data.chunks, key=lambda c: c.start):
            fh.write(_build_line(chunk, data.global_animation))


def create_ass(
    words: List[Dict],
    output_path: str,
    animation: str = "karaoke",
    color: str = "#FFFFFF",
) -> SubtitleData:
    """First render: words → SubtitleData → ASS file. Returns data for saving."""
    data = words_to_subtitle_data(words, animation, color)
    create_ass_from_data(data, output_path)
    return data
