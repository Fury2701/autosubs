"""
Generates an ASS (Advanced SubStation Alpha) subtitle file with
karaoke-style word-by-word animation using FFmpeg \kf fill tags.

Each word sweeps from the base colour (white) to highlight colour (cyan)
as it is spoken. Lines fade in/out at chunk boundaries.
"""
from typing import List, Dict


# ──────────────────────────────────────────────────────────────────────────────
# ASS time helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fmt_time(seconds: float) -> str:
    """Convert seconds to ASS timestamp  H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


# ──────────────────────────────────────────────────────────────────────────────
# Word grouping
# ──────────────────────────────────────────────────────────────────────────────

def _group_into_chunks(
    words: List[Dict],
    max_words: int = 6,
    max_duration: float = 3.5,
    gap_threshold: float = 0.8,
) -> List[List[Dict]]:
    """Split flat word list into subtitle chunks."""
    chunks: List[List[Dict]] = []
    current: List[Dict] = []

    for word in words:
        if current:
            gap = word["start"] - current[-1]["end"]
            duration = word["end"] - current[0]["start"]
            if len(current) >= max_words or duration >= max_duration or gap >= gap_threshold:
                chunks.append(current)
                current = []
        current.append(word)

    if current:
        chunks.append(current)

    return chunks


# ──────────────────────────────────────────────────────────────────────────────
# ASS generation
# ──────────────────────────────────────────────────────────────────────────────

_ASS_HEADER = """\
[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Rounded MT Bold,76,&H00FFFFFF,&H0000FFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,1,5,2,2,80,80,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def _build_dialogue(chunk: List[Dict]) -> str:
    """
    Build one ASS Dialogue line for a chunk.
    Each word gets a \\kf<cs> tag so it sweeps to SecondaryColour while spoken.
    The whole line fades in 120 ms and fades out 120 ms.
    """
    start = chunk[0]["start"]
    end = chunk[-1]["end"]

    parts: List[str] = ["{\\fad(120,120)}"]
    prev_end = start

    for i, word in enumerate(chunk):
        # Gap before this word (silence / pre-roll)
        gap_cs = max(0, round((word["start"] - prev_end) * 100))
        if gap_cs:
            parts.append(f"{{\\k{gap_cs}}}")   # silent fill advance

        # Duration of the word itself
        dur_cs = max(1, round((word["end"] - word["start"]) * 100))
        parts.append(f"{{\\kf{dur_cs}}}{word['text']}")

        prev_end = word["end"]

        if i < len(chunk) - 1:
            parts.append(" ")

    text = "".join(parts)
    return (
        f"Dialogue: 0,{_fmt_time(start)},{_fmt_time(end)},"
        f"Default,,0,0,0,,{text}\n"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def create_ass(words: List[Dict], output_path: str) -> None:
    """Generate an animated .ass subtitle file from word timestamps."""
    if not words:
        raise ValueError("No words to subtitle")

    chunks = _group_into_chunks(words)

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(_ASS_HEADER)
        for chunk in chunks:
            fh.write(_build_dialogue(chunk))
