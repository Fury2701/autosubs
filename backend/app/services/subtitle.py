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


WORD_POP_PALETTE = [
    "#F5E642",  # yellow
    "#E8593C",  # orange-red
    "#42B883",  # green
    "#4287F5",  # blue
    "#FFFFFF",  # white
    "#F542B3",  # pink/magenta
]


# ──────────────────────────────────────────────────────────────────────────────
# Time helpers
# ──────────────────────────────────────────────────────────────────────────────

def _fmt(s: float) -> str:
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    cs = int((s % 1) * 100)
    return f"{h}:{m:02d}:{int(s % 60):02d}.{cs:02d}"


def _dlg(start: float, end: float, text: str, style: str = "Default") -> str:
    return f"Dialogue: 0,{_fmt(start)},{_fmt(end)},{style},,0,0,0,,{text}\n"


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
    # DejaVu Sans Bold ships with fonts-dejavu-extra (Debian) and supports
    # Cyrillic, Latin, Greek and many other scripts out of the box.
    return (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,DejaVu Sans Bold,76,{primary},{secondary},"
        "&H00000000,&HAA000000,-1,0,0,0,100,100,2,0,1,5,2,2,80,80,90,1\n"
        "Style: Word,Barlow Condensed,88,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,3,0,1,3,2,5,10,10,30,1\n\n"
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
    """Each step reveals one more character as a separate Dialogue event.
    No inline \\t/\\alpha tags → no libass parsing issues with Cyrillic.

    body may start with an ASS tag block like {\\c&H...&} — we preserve it
    as a prefix and only slice the visible text portion.
    """
    # Split leading ASS tag block from visible text
    prefix = ""
    text = body
    if body.startswith("{"):
        close = body.find("}")
        if close != -1:
            prefix = body[: close + 1]
            text = body[close + 1 :]

    chars = list(text)
    n = max(len(chars), 1)
    char_dur = (e - s) / n
    lines = []
    for i in range(n):
        t_start = s + i * char_dur
        t_end = t_start + char_dur if i < n - 1 else e
        lines.append(_dlg(t_start, t_end, prefix + "".join(chars[: i + 1])))
    return "".join(lines)


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


def _spin(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,150)\\frz-360\\t(0,350,\\frz5)\\t(350,430,\\frz0)}" + body)


def _drop_in(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\move(960,880,960,990,0,300)\\fad(0,150)}" + body)


def _cinema(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(200,200)\\fscx220\\t(0,300,\\fscx100)}" + body)


def _flip(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,150)\\fscy0\\t(0,180,\\fscy118)\\t(180,260,\\fscy94)\\t(260,300,\\fscy100)}" + body)


def _glitch(body: str, s: float, e: float) -> str:
    return _dlg(s, e,
        "{\\fad(0,80)"
        "\\t(0,45,\\fscx135\\blur3)"
        "\\t(45,90,\\fscx72\\blur0)"
        "\\t(90,130,\\fscx118\\blur2)"
        "\\t(130,170,\\fscx88)"
        "\\t(170,210,\\fscx100)}" + body)


def _word_pop(
    words: List[Dict],
    s: float, e: float,
    pos_x: int = 960, pos_y: int = 540,
    color_start: int = 0,
) -> str:
    """Word-by-word karaoke with cyclic color palette and pop animation.
    Each word appears individually, previous word vanishes immediately.
    Uses 'Word' style (Barlow Condensed ExtraBold 88px, uppercase).
    """
    if not words:
        # fallback: show whole text as one event
        col = hex_to_ass(WORD_POP_PALETTE[color_start % len(WORD_POP_PALETTE)])
        text_body = (
            f"{{\\an5\\pos({pos_x},{pos_y})\\c{col}&\\fad(80,0)"
            f"\\t(0,80,\\fscx70\\fscy70)\\t(80,180,\\fscx105\\fscy105)"
            f"\\t(180,250,\\fscx100\\fscy100)}}"
        )
        return _dlg(s, e, text_body, style="Word")

    lines = []
    for i, w in enumerate(words):
        col = hex_to_ass(WORD_POP_PALETTE[(color_start + i) % len(WORD_POP_PALETTE)])
        text = w["text"].upper()
        text_body = (
            f"{{\\an5\\pos({pos_x},{pos_y})\\c{col}&\\fad(80,0)"
            f"\\t(0,80,\\fscx70\\fscy70)\\t(80,180,\\fscx105\\fscy105)"
            f"\\t(180,250,\\fscx100\\fscy100)}}{text}"
        )
        lines.append(_dlg(w["start"], w["end"], text_body, style="Word"))
    return "".join(lines)


def _inject_pos(dialogue: str, x: int, y: int) -> str:
    """Inject \\an5\\pos(x,y) into the first {…} block of every Dialogue line."""
    pos = f"\\an5\\pos({x},{y})"
    lines = []
    for line in dialogue.splitlines(keepends=True):
        if line.startswith("Dialogue:") and "{" in line:
            close = line.find("}")
            if close != -1:
                line = line[:close] + pos + line[close:]
        lines.append(line)
    return "".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Effect modifiers  (combinable on top of any animation)
# ──────────────────────────────────────────────────────────────────────────────

_EFFECT_TAGS: Dict[str, str] = {
    "glow":    "\\blur14\\t(0,400,\\blur2)",
    "shake":   "\\t(0,70,\\frz6)\\t(70,140,\\frz-6)\\t(140,200,\\frz3)\\t(200,240,\\frz0)",
    "shadow":  "\\shad12\\t(0,320,\\shad5)",
    "outline": "\\bord10\\t(0,260,\\bord4)",
}


def _apply_effect(dialogue: str, effect: str) -> str:
    """Inject effect tags into the first {…} block of every Dialogue line."""
    tags = _EFFECT_TAGS.get(effect)
    if not tags:
        return dialogue
    lines = []
    for line in dialogue.splitlines(keepends=True):
        if line.startswith("Dialogue:") and "{" in line:
            close = line.find("}")
            if close != -1:
                line = line[:close] + tags + line[close:]
        lines.append(line)
    return "".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Chunk renderer
# ──────────────────────────────────────────────────────────────────────────────

def _render_chunk(
    chunk: SubtitleChunk,
    global_animation: str,
    global_color: str,
    global_color2: Optional[str],
    word_map: Dict[int, List[Dict]],
    global_effect: Optional[str] = None,
    sub_x: float = 50.0,
    sub_y: float = 87.5,
    word_color_start: int = 0,
) -> str:
    anim   = chunk.animation or global_animation
    c1     = chunk.color  or global_color
    c2     = chunk.color2 or global_color2
    s, e   = chunk.start, chunk.end
    words  = word_map.get(chunk.id, [])

    # Build coloured text body
    # Typewriter iterates over individual characters, so gradient (which wraps
    # each char in its own ASS tag) would break the character-slicing logic.
    # Use a single solid colour for typewriter instead.
    if c2 and anim != "typewriter":
        body = _gradient_text(chunk.text, c1, c2)
    else:
        body = f"{{\\c{hex_to_ass(c1)}&}}{chunk.text}"

    if anim == "karaoke":
        if words:
            return _karaoke(words, body, s, e, c1, c2)
        # No word data (after manual edit) → fall back to sweep of whole line
        dur_cs = max(1, round((e - s) * 100))
        return _dlg(s, e, f"{{\\fad(120,120)}}{{\\kf{dur_cs}}}{body}")

    if anim == "word_pop":
        pos_x = round(sub_x / 100 * 1920)
        pos_y = round(sub_y / 100 * 1080)
        words_for_pop = words if words else [{"text": chunk.text, "start": s, "end": e}]
        return _word_pop(words_for_pop, s, e, pos_x, pos_y, color_start=word_color_start)

    builders = {
        "pop":        _pop,
        "fade":       _fade,
        "typewriter": _typewriter,
        "slide_up":   _slide_up,
        "bounce":     _bounce,
        "glow":       _glow,
        "zoom_in":    _zoom_in,
        "spin":       _spin,
        "drop_in":    _drop_in,
        "cinema":     _cinema,
        "flip":       _flip,
        "glitch":     _glitch,
    }
    build = builders.get(anim, _pop)
    result = build(body, s, e)
    # Inject custom position when not at default
    if sub_x != 50.0 or sub_y != 87.5:
        pos_x = round(sub_x / 100 * 1920)
        pos_y = round(sub_y / 100 * 1080)
        result = _inject_pos(result, pos_x, pos_y)
    effect = chunk.effect or global_effect
    if effect:
        result = _apply_effect(result, effect)
    return result


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

    # utf-8-sig writes UTF-8 BOM — libass uses it to auto-detect encoding,
    # which is required for correct Cyrillic / non-Latin rendering.
    with open(output_path, "w", encoding="utf-8-sig") as fh:
        fh.write(_header(primary, secondary))
        word_color_idx = 0
        for chunk in sorted(data.chunks, key=lambda c: c.start):
            fh.write(_render_chunk(
                chunk, data.global_animation, data.color,
                data.color2, wmap, data.global_effect,
                data.sub_x, data.sub_y,
                word_color_idx,
            ))
            # advance word color index for word_pop continuity across chunks
            anim = chunk.animation or data.global_animation
            if anim == "word_pop":
                words = wmap.get(chunk.id, [])
                word_color_idx += len(words) if words else len(chunk.text.split())


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
