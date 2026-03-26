"""
Generates ASS subtitle files with multiple animation styles.

Styles:
  karaoke — word-by-word colour sweep (\kf fill tag)
  pop     — chunk bounces in with elastic scale, then fades out
  fade    — simple fade-in / fade-out, no word highlight
"""
from typing import List, Dict


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
    """#RRGGBB → &H00BBGGRR  (ASS stores colours in ABGR order)"""
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return "&H00FFFFFF"
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


# ──────────────────────────────────────────────────────────────────────────────
# Word grouping
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


# ──────────────────────────────────────────────────────────────────────────────
# ASS header builder
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
# Dialogue builders per style
# ──────────────────────────────────────────────────────────────────────────────

def _dialogue_karaoke(chunk: List[Dict]) -> str:
    """Word-by-word colour sweep with \kf tags."""
    start, end = chunk[0]["start"], chunk[-1]["end"]
    parts = ["{\\fad(120,120)}"]
    prev_end = start
    for i, w in enumerate(chunk):
        gap_cs = max(0, round((w["start"] - prev_end) * 100))
        if gap_cs:
            parts.append(f"{{\\k{gap_cs}}}")
        dur_cs = max(1, round((w["end"] - w["start"]) * 100))
        parts.append(f"{{\\kf{dur_cs}}}{w['text']}")
        prev_end = w["end"]
        if i < len(chunk) - 1:
            parts.append(" ")
    return (
        f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},"
        f"Default,,0,0,0,,{''.join(parts)}\n"
    )


def _dialogue_pop(chunk: List[Dict]) -> str:
    """Elastic scale pop-in, fade out."""
    start, end = chunk[0]["start"], chunk[-1]["end"]
    text = " ".join(w["text"] for w in chunk)
    # bounce: grow to 115% in 100ms → shrink to 100% in next 120ms, then fade out
    anim = "{\\fad(0,150)\\t(0,100,\\fscx115\\fscy115)\\t(100,220,\\fscx100\\fscy100)}"
    return (
        f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},"
        f"Default,,0,0,0,,{anim}{text}\n"
    )


def _dialogue_fade(chunk: List[Dict]) -> str:
    """Simple smooth fade-in / fade-out."""
    start, end = chunk[0]["start"], chunk[-1]["end"]
    text = " ".join(w["text"] for w in chunk)
    return (
        f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},"
        f"Default,,0,0,0,,{{\\fad(250,250)}}{text}\n"
    )


_BUILDERS = {
    "karaoke": _dialogue_karaoke,
    "pop": _dialogue_pop,
    "fade": _dialogue_fade,
}

# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def create_ass(
    words: List[Dict],
    output_path: str,
    animation: str = "karaoke",
    color: str = "#FFFFFF",
) -> None:
    if not words:
        raise ValueError("No words to subtitle")

    primary = hex_to_ass(color)
    # secondary (karaoke highlight) is always cyan-ish unless colour is already cyan
    secondary = "&H00FFFF00" if color.upper() in ("#FFFFFF", "#FFFF00") else "&H0000FFFF"

    builder = _BUILDERS.get(animation, _dialogue_karaoke)
    chunks = _group(words)

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(_header(primary, secondary))
        for chunk in chunks:
            fh.write(builder(chunk))
