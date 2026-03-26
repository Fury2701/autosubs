"""
ASS subtitle generator.

Animations:
  pop        — elastic scale bounce
  karaoke    — word-by-word colour sweep (\kf)
  fade       — smooth fade in/out
  typewriter — characters appear one by one
  slide_up   — line slides in from below
  bounce     — vertical rubber-band bounce
  glow       — neon glow dissolve
  zoom_in    — shrink from large to normal

Colour:
  color       — primary hex  (#RRGGBB)
  color2      — optional second hex for left→right gradient
  Per-chunk   — SubtitleChunk.color / .color2 override globals
"""
from typing import List, Dict, Optional, Tuple
from app.models import SubtitleChunk, SubtitleData


# ──────────────────────────────────────────────────────────────────────────────
# Colour helpers
# ──────────────────────────────────────────────────────────────────────────────

def _parse_hex(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) != 6:
        return (255, 255, 255)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def hex_to_ass(hex_color: str) -> str:
    """#RRGGBB → &H00BBGGRR"""
    r, g, b = _parse_hex(hex_color)
    return f"&H00{b:02X}{g:02X}{r:02X}"


def _lerp_color(c1: str, c2: str, t: float) -> str:
    r1, g1, b1 = _parse_hex(c1)
    r2, g2, b2 = _parse_hex(c2)
    return _to_hex(
        round(r1 + (r2 - r1) * t),
        round(g1 + (g2 - g1) * t),
        round(b1 + (b2 - b1) * t),
    )


def _gradient_text(text: str, c1: str, c2: str) -> str:
    """Wrap each visible character with an interpolated colour tag."""
    chars = list(text)
    visible = [i for i, ch in enumerate(chars) if ch != " "]
    n = len(visible)
    if n <= 1 or c1.upper() == c2.upper():
        return f"{{\\c{hex_to_ass(c1)}&}}{text}"

    out = list(chars)
    for j, idx in enumerate(visible):
        t = j / (n - 1)
        col = hex_to_ass(_lerp_color(c1, c2, t))
        out[idx] = f"{{\\c{col}&}}{chars[idx]}"
    return "".join(out)


# ──────────────────────────────────────────────────────────────────────────────
# Time helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fmt(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{int(s % 60):02d}.{cs:02d}"


def _dlg(start: float, end: float, text: str) -> str:
    return f"Dialogue: 0,{_fmt(start)},{_fmt(end)},Default,,0,0,0,,{text}\n"


# ──────────────────────────────────────────────────────────────────────────────
# Word grouping — sentence-aware
# ──────────────────────────────────────────────────────────────────────────────

_SENTENCE_END = {".", "!", "?", "…", "..."}
_CLAUSE_END   = {",", ";", ":"}

def _group(
    words: List[Dict],
    max_words: int = 7,
    max_dur: float = 3.5,
    gap_thresh: float = 0.55,
) -> List[List[Dict]]:
    chunks: List[List[Dict]] = []
    cur: List[Dict] = []

    for word in words:
        if cur:
            gap = word["start"] - cur[-1]["end"]
            dur = word["end"] - cur[0]["start"]
            prev = cur[-1]["text"].rstrip()
            ends_sent  = any(prev.endswith(p) for p in _SENTENCE_END)
            ends_clause = any(prev.endswith(p) for p in _CLAUSE_END)

            should_break = (
                len(cur) >= max_words
                or dur >= max_dur
                or gap >= gap_thresh
                or (ends_sent and len(cur) >= 2)
                or (ends_clause and len(cur) >= 4)
            )
            if should_break:
                chunks.append(cur)
                cur = []
        cur.append(word)

    if cur:
        chunks.append(cur)
    return chunks


def words_to_subtitle_data(
    words: List[Dict], animation: str, color: str, color2: Optional[str]
) -> SubtitleData:
    raw = _group(words)
    chunks = [
        SubtitleChunk(
            id=i,
            text=" ".join(w["text"] for w in chunk),
            start=chunk[0]["start"],
            end=chunk[-1]["end"],
            animation=None,
            color=None,
            color2=None,
        )
        for i, chunk in enumerate(raw)
    ]
    return SubtitleData(
        chunks=chunks,
        color=color,
        color2=color2,
        global_animation=animation,
    )


# ──────────────────────────────────────────────────────────────────────────────
# ASS header
# ──────────────────────────────────────────────────────────────────────────────

def _header(primary: str, secondary: str) -> str:
    return (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial Rounded MT Bold,76,{primary},{secondary},"
        "&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,1,5,2,2,80,80,90,1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Animation builders  (all return one or more Dialogue lines as a string)
# ──────────────────────────────────────────────────────────────────────────────

def _pop(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,150)\\t(0,100,\\fscx115\\fscy115)\\t(100,220,\\fscx100\\fscy100)}" + body)


def _fade(body: str, s: float, e: float) -> str:
    return _dlg(s, e, "{\\fad(250,250)}" + body)


def _karaoke(words: List[Dict], body: str, s: float, e: float,
             c1: str, c2: Optional[str]) -> str:
    """Per-word karaoke — uses original word timestamps if available."""
    # body is the plain text; we rebuild from words for accurate \kf timing
    parts = ["{\\fad(120,120)}"]
    prev = s
    for i, w in enumerate(words):
        gap_cs = max(0, round((w["start"] - prev) * 100))
        if gap_cs:
            parts.append(f"{{\\k{gap_cs}}}")
        dur_cs = max(1, round((w["end"] - w["start"]) * 100))
        parts.append(f"{{\\kf{dur_cs}}}{w['text']}")
        prev = w["end"]
        if i < len(words) - 1:
            parts.append(" ")
    return _dlg(s, e, "".join(parts))


def _typewriter(body: str, s: float, e: float) -> str:
    dur_cs = max(10, round((e - s) * 100))
    chars = list(body)
    n = max(len(chars), 1)
    parts = ["{\\fad(0,150)}"]
    for i, ch in enumerate(chars):
        t1 = round(i / n * dur_cs * 0.75)
        t2 = min(t1 + 8, dur_cs)
        parts.append(f"{{\\alpha&HFF&\\t({t1},{t2},\\alpha&H00&)}}{ch}")
    return _dlg(s, e, "".join(parts))


def _slide_up(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\move(960,1055,960,990,0,280)\\fad(0,150)}" + body)


def _bounce(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,150)"
        "\\t(0,70,\\fscx100\\fscy135)"
        "\\t(70,140,\\fscx100\\fscy80)"
        "\\t(140,195,\\fscx100\\fscy110)"
        "\\t(195,240,\\fscx100\\fscy95)"
        "\\t(240,270,\\fscx100\\fscy100)}" + body)


def _glow(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,200)\\blur18\\bord10\\t(0,450,\\blur3\\bord4)}" + body)


def _zoom_in(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,150)\\fscx220\\fscy220\\t(0,220,\\fscx100\\fscy100)}" + body)


# ──────────────────────────────────────────────────────────────────────────────
# Chunk renderer
# ──────────────────────────────────────────────────────────────────────────────

def _render_chunk(
    chunk: SubtitleChunk,
    global_animation: str,
    global_color: str,
    global_color2: Optional[str],
    word_map: Dict[int, List[Dict]],
) -> str:
    anim   = chunk.animation or global_animation
    c1     = chunk.color  or global_color
    c2     = chunk.color2 or global_color2
    s, e   = chunk.start, chunk.end
    words  = word_map.get(chunk.id, [])

    # Build coloured text body
    if c2:
        body = _gradient_text(chunk.text, c1, c2)
    else:
        body = f"{{\\c{hex_to_ass(c1)}&}}{chunk.text}"

    if anim == "karaoke":
        if words:
            return _karaoke(words, body, s, e, c1, c2)
        # No word data (after manual edit) → fall back to sweep of whole line
        dur_cs = max(1, round((e - s) * 100))
        return _dlg(s, e, f"{{\\fad(120,120)}}{{\\kf{dur_cs}}}{body}")

    builders = {
        "pop":        _pop,
        "fade":       _fade,
        "typewriter": _typewriter,
        "slide_up":   _slide_up,
        "bounce":     _bounce,
        "glow":       _glow,
        "zoom_in":    _zoom_in,
    }
    build = builders.get(anim, _pop)
    return build(body, s, e)


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def create_ass_from_data(
    data: SubtitleData,
    output_path: str,
    word_map: Optional[Dict[int, List[Dict]]] = None,
) -> None:
    primary   = hex_to_ass(data.color)
    secondary = "&H00FFFF00" if data.color.upper() in ("#FFFFFF", "#FFFF00") else "&H0000FFFF"
    wmap = word_map or {}

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write(_header(primary, secondary))
        for chunk in sorted(data.chunks, key=lambda c: c.start):
            fh.write(_render_chunk(chunk, data.global_animation, data.color,
                                   data.color2, wmap))


def create_ass(
    words: List[Dict],
    output_path: str,
    animation: str = "pop",
    color: str = "#FFFFFF",
    color2: Optional[str] = None,
) -> Tuple[SubtitleData, Dict[int, List[Dict]]]:
    """
    First render.
    Returns (SubtitleData, word_map) — both saved to disk so re-render
    can use original word timestamps for karaoke.
    """
    data = words_to_subtitle_data(words, animation, color, color2)

    # Build word_map: chunk_id → list of word dicts
    word_map: Dict[int, List[Dict]] = {}
    raw_chunks = _group(words)
    for i, chunk_words in enumerate(raw_chunks):
        word_map[i] = chunk_words

    create_ass_from_data(data, output_path, word_map)
    return data, word_map
