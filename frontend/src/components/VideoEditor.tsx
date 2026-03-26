import React, {
  useCallback, useEffect, useRef, useState, RefObject,
} from "react";
import {
  Box, Typography, IconButton, Button, TextField, Select,
  MenuItem, Tooltip, Paper, Alert, CircularProgress, Chip, Switch,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { SubtitleData, SubtitleChunk, rerender, downloadUrl, previewUrl } from "../api/client";
import { ANIMATIONS, EFFECTS } from "./SettingsPanel";

interface Props {
  jobId: string;
  initial: SubtitleData;
  onBack: () => void;
  onRerenderStarted: () => void;
}

const CHUNK_HUE = [258, 195, 0, 142, 30, 280, 350, 60];
function chunkColor(idx: number) {
  return `hsla(${CHUNK_HUE[idx % CHUNK_HUE.length]}, 80%, 65%, 0.85)`;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}
function parseT(v: string) {
  const [m, s] = v.split(":");
  return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0);
}

const WORD_POP_PALETTE = ["#F5E642","#E8593C","#42B883","#4287F5","#FFFFFF","#F542B3"];

// ── CSS animation keyframes injected once ────────────────────────────────────
const ANIM_STYLE = `
@keyframes sub-pop      { from { transform: scale(1.18); opacity:.6 } to { transform: scale(1); opacity:1 } }
@keyframes sub-fade     { from { opacity: 0 }  to { opacity: 1 } }
@keyframes sub-slide    { from { transform: translateY(18px); opacity:0 } to { transform: translateY(0); opacity:1 } }
@keyframes sub-bounce   { 0%{transform:scaleY(1.35)} 40%{transform:scaleY(.82)} 70%{transform:scaleY(1.12)} 90%{transform:scaleY(.97)} 100%{transform:scaleY(1)} }
@keyframes sub-glow     { from { filter:blur(10px) brightness(2.5); opacity:.4 } to { filter:blur(0) brightness(1); opacity:1 } }
@keyframes sub-zoom     { from { transform: scale(2.4); opacity:0 } to { transform: scale(1); opacity:1 } }
@keyframes sub-type     { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0% 0 0) } }
@keyframes sub-karaoke  { from { opacity: 0 } to { opacity: 1 } }
@keyframes sub-spin    { from { transform: rotate(-360deg) scale(0.6); opacity:0 } to { transform: rotate(0deg) scale(1); opacity:1 } }
@keyframes sub-drop    { from { transform: translateY(-28px) scaleY(0.4); opacity:0 } to { transform: translateY(0) scaleY(1); opacity:1 } }
@keyframes sub-cinema  { from { transform: scaleX(2.2); opacity:0 } to { transform: scaleX(1); opacity:1 } }
@keyframes sub-flip    { from { transform: scaleY(0); opacity:0 } to { transform: scaleY(1); opacity:1 } }
@keyframes sub-glitch  { 0%{transform:scaleX(1.35) skewX(-4deg);opacity:.7} 25%{transform:scaleX(0.75) skewX(4deg)} 50%{transform:scaleX(1.15)} 75%{transform:scaleX(0.93)} 100%{transform:scaleX(1);opacity:1} }
@keyframes sub-word-pop { 0% { transform: translate(-50%,-50%) scale(0.7); opacity:0 } 60% { transform: translate(-50%,-50%) scale(1.05); opacity:1 } 100% { transform: translate(-50%,-50%) scale(1.0); opacity:1 } }
`;

const ANIM_MAP: Record<string, string> = {
  pop:        "sub-pop 0.22s cubic-bezier(.34,1.56,.64,1) both",
  fade:       "sub-fade 0.28s ease both",
  slide_up:   "sub-slide 0.28s ease both",
  bounce:     "sub-bounce 0.45s ease both",
  glow:       "sub-glow 0.45s ease both",
  zoom_in:    "sub-zoom 0.22s ease both",
  typewriter: "sub-type 0.7s steps(24) both",
  karaoke:    "sub-karaoke 0.15s ease both",
  spin:       "sub-spin 0.45s cubic-bezier(.34,1.3,.64,1) both",
  drop_in:    "sub-drop 0.32s cubic-bezier(.34,1.56,.64,1) both",
  cinema:     "sub-cinema 0.32s cubic-bezier(.25,1,.5,1) both",
  flip:       "sub-flip 0.32s cubic-bezier(.34,1.56,.64,1) both",
  glitch:     "sub-glitch 0.25s ease both",
  word_pop:   "sub-word-pop 0.18s cubic-bezier(0.34,1.56,0.64,1) both",
};

const EFFECT_STYLE: Record<string, React.CSSProperties> = {
  glow:    { filter: "drop-shadow(0 0 10px currentColor) brightness(1.4)" },
  shake:   { filter: "blur(0.3px) brightness(1.1)" },
  shadow:  { textShadow: "4px 6px 0 rgba(0,0,0,0.95),8px 12px 24px rgba(0,0,0,0.8)" },
  outline: { WebkitTextStroke: "1.5px rgba(255,255,255,0.4)" },
};

// ── Subtitle overlay ─────────────────────────────────────────────────────────
function SubOverlay({ chunks, t, color, color2, globalAnimation, globalEffect, subX, subY, onPositionChange, videoContainerRef }: {
  chunks: SubtitleChunk[]; t: number; color: string; color2: string | null;
  globalAnimation: string; globalEffect: string | null;
  subX: number; subY: number;
  onPositionChange?: (x: number, y: number) => void;
  videoContainerRef?: RefObject<HTMLDivElement>;
}) {
  const activeIdx = chunks.findIndex(c => t >= c.start && t <= c.end);
  const active = activeIdx >= 0 ? chunks[activeIdx] : null;
  if (!active) return null;

  const isWordPop = (active.animation || globalAnimation) === "word_pop";
  let c1 = active.color || color;
  let c2: string | null = active.color2 || color2;

  if (isWordPop) {
    c1 = WORD_POP_PALETTE[activeIdx % WORD_POP_PALETTE.length];
    c2 = null;
  }

  const anim = ANIM_MAP[active.animation || globalAnimation] || ANIM_MAP.pop;
  const effectKey = active.effect || globalEffect || "";
  const effectSx  = EFFECT_STYLE[effectKey] ?? {};

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = videoContainerRef?.current;
    if (!container || !onPositionChange) return;

    const move = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(5, Math.min(95, ((ev.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(5, Math.min(95, ((ev.clientY - rect.top) / rect.height) * 100));
      onPositionChange(x, y);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const colorSx = c2 ? {
    background: `linear-gradient(90deg,${c1},${c2})`,
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: effectSx.filter ?? "drop-shadow(1px 1px 3px rgba(0,0,0,0.95))",
  } : {
    color: c1,
    textShadow: effectSx.textShadow ?? "2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,0 3px 8px rgba(0,0,0,0.85)",
  };

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        position: "absolute",
        left: `${subX}%`, top: `${subY}%`,
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        pointerEvents: onPositionChange ? "auto" : "none",
        maxWidth: "85%", px: 1,
        cursor: onPositionChange ? "move" : "default",
        userSelect: "none",
      }}
    >
      {/* Inner — CSS animation plays here, keyed by chunk id to retrigger */}
      <Box key={active.id} sx={{
        fontFamily: isWordPop
          ? '"Barlow Condensed","Arial Narrow",Arial,sans-serif'
          : '"DejaVu Sans Bold","Arial Black",Arial,sans-serif',
        fontSize: isWordPop ? "clamp(18px,4.5vw,44px)" : "clamp(14px,2.8vw,28px)",
        fontWeight: 900, lineHeight: 1.3,
        letterSpacing: isWordPop ? "0.05em" : "normal",
        textTransform: isWordPop ? "uppercase" : "none",
        animation: anim,
        WebkitTextStroke: isWordPop ? "1.5px rgba(0,0,0,0.8)" : undefined,
        ...effectSx,
        ...colorSx,
      }}>
        {active.text}
      </Box>
    </Box>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────
interface TLProps {
  duration: number; currentTime: number;
  chunks: SubtitleChunk[]; selectedId: number | null;
  trimStart: number; trimEnd: number;
  onSeek(t: number): void;
  onSelect(id: number): void;
  onChunkChange(id: number, patch: Partial<SubtitleChunk>): void;
  onTrim(s: number, e: number): void;
}

function Timeline({ duration, currentTime, chunks, selectedId,
  trimStart, trimEnd, onSeek, onSelect, onChunkChange, onTrim }: TLProps) {
  const ref = useRef<HTMLDivElement>(null);

  const pct = (t: number) => `${(t / duration) * 100}%`;
  const tFromX = useCallback((clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  }, [duration]);

  // Click to seek
  const handleBgClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return;
    onSeek(tFromX(e.clientX));
  };

  // Drag helper
  const startDrag = useCallback((
    onMove: (t: number, dt: number) => void,
    initClientX: number,
  ) => {
    const initT = tFromX(initClientX);
    const move = (e: MouseEvent) => {
      const t = tFromX(e.clientX);
      onMove(t, t - initT);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [tFromX]);

  // Chunk drag handlers
  const onChunkMouseDown = (e: React.MouseEvent, chunk: SubtitleChunk, edge: "l" | "r" | "m") => {
    e.stopPropagation();
    const origStart = chunk.start;
    const origEnd = chunk.end;
    startDrag((t, dt) => {
      if (edge === "m") {
        const dur = origEnd - origStart;
        const ns = Math.max(0, origStart + dt);
        onChunkChange(chunk.id, { start: ns, end: ns + dur });
      } else if (edge === "l") {
        onChunkChange(chunk.id, { start: Math.min(origEnd - 0.1, Math.max(0, origStart + dt)) });
      } else {
        onChunkChange(chunk.id, { end: Math.max(origStart + 0.1, origEnd + dt) });
      }
    }, e.clientX);
  };

  // Trim drag handlers
  const onTrimMouseDown = (e: React.MouseEvent, which: "s" | "e") => {
    e.stopPropagation();
    const origS = trimStart; const origE = trimEnd;
    startDrag((t) => {
      if (which === "s") onTrim(Math.min(t, origE - 0.5), origE);
      else               onTrim(origS, Math.max(t, origS + 0.5));
    }, e.clientX);
  };

  return (
    <Box ref={ref} onClick={handleBgClick}
      sx={{ position: "relative", height: 64, bgcolor: "#1a1a2e",
            borderRadius: 2, cursor: "crosshair", userSelect: "none",
            border: "1px solid #333", overflow: "hidden" }}>

      {/* Trimmed-out overlays */}
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0,
                 width: pct(trimStart), bgcolor: "rgba(0,0,0,0.6)", zIndex: 2 }} />
      <Box sx={{ position: "absolute", right: 0, top: 0, bottom: 0,
                 width: `${((duration - trimEnd) / duration) * 100}%`,
                 bgcolor: "rgba(0,0,0,0.6)", zIndex: 2 }} />

      {/* Chunks */}
      {chunks.map((c, i) => (
        <Box key={c.id} data-handle="chunk"
          onMouseDown={(e) => { onSelect(c.id); onChunkMouseDown(e, c, "m"); }}
          sx={{
            position: "absolute", top: "18%", height: "64%",
            left: pct(c.start), width: pct(c.end - c.start),
            bgcolor: chunkColor(i),
            borderRadius: 1,
            border: selectedId === c.id ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
            cursor: "grab", zIndex: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", minWidth: 4,
          }}>
          <Typography noWrap sx={{ fontSize: 10, color: "#000", fontWeight: 700, px: 0.5 }}>
            {c.text}
          </Typography>
          {/* Left resize */}
          <Box data-handle="l" onMouseDown={(e) => { e.stopPropagation(); onSelect(c.id); onChunkMouseDown(e, c, "l"); }}
            sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6,
                  cursor: "w-resize", bgcolor: "rgba(0,0,0,0.3)", zIndex: 4 }} />
          {/* Right resize */}
          <Box data-handle="r" onMouseDown={(e) => { e.stopPropagation(); onSelect(c.id); onChunkMouseDown(e, c, "r"); }}
            sx={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6,
                  cursor: "e-resize", bgcolor: "rgba(0,0,0,0.3)", zIndex: 4 }} />
        </Box>
      ))}

      {/* Trim handles */}
      <Box data-handle="trim-s" onMouseDown={(e) => onTrimMouseDown(e, "s")}
        sx={{ position: "absolute", left: pct(trimStart), top: 0, bottom: 0,
              width: 10, bgcolor: "#FFB347", cursor: "col-resize", zIndex: 5,
              transform: "translateX(-50%)", borderRadius: 1 }} />
      <Box data-handle="trim-e" onMouseDown={(e) => onTrimMouseDown(e, "e")}
        sx={{ position: "absolute", left: pct(trimEnd), top: 0, bottom: 0,
              width: 10, bgcolor: "#FFB347", cursor: "col-resize", zIndex: 5,
              transform: "translateX(-50%)", borderRadius: 1 }} />

      {/* Playhead */}
      <Box sx={{ position: "absolute", left: pct(currentTime), top: 0, bottom: 0,
                 width: 2, bgcolor: "#fff", zIndex: 6, pointerEvents: "none",
                 transform: "translateX(-50%)" }} />

      {/* Time ticks */}
      {Array.from({ length: Math.floor(duration) + 1 }, (_, i) => i).map(i => (
        i % Math.max(1, Math.round(duration / 10)) === 0 && (
          <Box key={i} sx={{ position: "absolute", left: pct(i), top: 0, height: 6,
                              width: 1, bgcolor: "#555", zIndex: 1 }}>
            <Typography sx={{ position: "absolute", top: 6, fontSize: 8, color: "#555",
                               transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
              {fmt(i)}
            </Typography>
          </Box>
        )
      ))}
    </Box>
  );
}

// ── Main VideoEditor ──────────────────────────────────────────────────────────
export default function VideoEditor({ jobId, initial, onBack, onRerenderStarted }: Props) {
  const [data, setData] = useState<SubtitleData>({
    ...JSON.parse(JSON.stringify(initial)),
    trim_start: initial.trim_start ?? 0,
    trim_end: initial.trim_end ?? null,
    sub_x: initial.sub_x ?? 50,
    sub_y: initial.sub_y ?? 87.5,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const trimStart = data.trim_start;
  const trimEnd   = data.trim_end ?? duration;
  const selected  = data.chunks.find(c => c.id === selectedId) ?? null;

  // Sync video state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => {
      const d = v.duration;
      if (d && isFinite(d) && d > 0) {
        setDuration(d);
        setData(prev => ({ ...prev, trim_end: prev.trim_end ?? d }));
      }
    };
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      v.play().catch((err) => {
        console.warn("play() rejected:", err);
        // Muted autoplay is always allowed — unmute after first play
        v.muted = true;
        v.play().then(() => { v.muted = false; }).catch(console.error);
      });
    }
  };

  const seek = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const updChunk = (id: number, patch: Partial<SubtitleChunk>) =>
    setData(d => ({ ...d, chunks: d.chunks.map(c => c.id === id ? { ...c, ...patch } : c) }));

  const delChunk = (id: number) => {
    setData(d => ({ ...d, chunks: d.chunks.filter(c => c.id !== id) }));
    setSelectedId(null);
  };

  const addChunk = () => {
    const id = Date.now();
    const t = currentTime;
    setData(d => ({
      ...d,
      chunks: [...d.chunks, { id, text: "New subtitle", start: t, end: t + 2, animation: null, color: null, color2: null, effect: null }],
    }));
    setSelectedId(id);
  };

  const handleExport = async () => {
    setError(null);
    setLoading(true);
    try {
      await rerender(jobId, data);
      onRerenderStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100vh",
               width: "100vw", position: "fixed", inset: 0, zIndex: 200,
               overflow: "auto", display: "flex", flexDirection: "column" }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5,
                 px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider",
                 flexShrink: 0 }}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        <Typography fontWeight={700} sx={{ flex: 1 }}>Редактор відео</Typography>
        <Chip label={`${data.chunks.length} субтитрів`} size="small" variant="outlined" />
        <Button size="small" startIcon={<DownloadIcon />}
          href={downloadUrl(jobId)} download variant="outlined">
          Завантажити
        </Button>
        <Button size="small" variant="contained" disabled={loading}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <MovieFilterIcon />}
          onClick={handleExport}
          sx={{ background: "linear-gradient(135deg,#7C5CFC,#00C9FF)",
                "&:hover": { background: "linear-gradient(135deg,#9D80FF,#00E5FF)" } }}>
          {loading ? "Рендер..." : "Export"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flex: 1, gap: 2, p: 2, minHeight: 0 }}>

        {/* Video player */}
        <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "60%" } }}>
          <Box ref={videoContainerRef} sx={{ position: "relative", bgcolor: "#000", borderRadius: 2, overflow: "hidden" }}>
          {/* inject animation keyframes once */}
          <style>{ANIM_STYLE}</style>
            <video
              ref={videoRef}
              src={previewUrl(jobId)}
              preload="auto"
              playsInline
              style={{ width: "100%", display: "block", maxHeight: "50vh" }}
            />
            <SubOverlay chunks={data.chunks} t={currentTime}
              color={data.color} color2={data.color2}
              globalAnimation={data.global_animation}
              globalEffect={data.global_effect ?? null}
              subX={data.sub_x ?? 50} subY={data.sub_y ?? 87.5}
              videoContainerRef={videoContainerRef}
              onPositionChange={(x, y) => setData(d => ({ ...d, sub_x: x, sub_y: y }))}
            />
          </Box>

          {/* Playback controls */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <IconButton onClick={togglePlay} size="small"
              sx={{ bgcolor: "primary.main", color: "#fff",
                    "&:hover": { bgcolor: "primary.dark" } }}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Typography variant="caption" fontFamily="monospace">
              {fmt(currentTime)} / {fmt(duration)}
            </Typography>
            <Box sx={{ flex: 1, height: 4, bgcolor: "#333", borderRadius: 2,
                       cursor: "pointer", position: "relative" }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                seek(((e.clientX - r.left) / r.width) * duration);
              }}>
              <Box sx={{ height: "100%", bgcolor: "primary.main", borderRadius: 2,
                         width: `${(currentTime / duration) * 100}%` }} />
            </Box>
          </Box>

          {/* Trim info */}
          <Box sx={{ display: "flex", gap: 1, mt: 1, alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">
              ✂️ Trim:
            </Typography>
            <Chip label={`▶ ${fmt(trimStart)}`} size="small"
              sx={{ fontFamily: "monospace", fontSize: 11 }} />
            <Typography variant="caption" color="text.secondary">→</Typography>
            <Chip label={`■ ${fmt(trimEnd)}`} size="small"
              sx={{ fontFamily: "monospace", fontSize: 11 }} />
            <Typography variant="caption" color="text.secondary">
              ({fmt(trimEnd - trimStart)} total)
            </Typography>
          </Box>
        </Box>

        {/* Selected chunk editor */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selected ? (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "primary.main",
                                        borderRadius: 2, height: "100%", overflow: "auto" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography fontWeight={700} variant="subtitle2">Редагування рядку</Typography>
                <Tooltip title="Видалити" arrow>
                  <IconButton size="small" color="error" onClick={() => delChunk(selected.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField label="Текст" multiline maxRows={4} fullWidth size="small"
                  value={selected.text}
                  onChange={(e) => updChunk(selected.id, { text: e.target.value })} />

                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField label="▶ Початок" size="small" sx={{ flex: 1 }}
                    defaultValue={fmt(selected.start)} key={`s-${selected.id}`}
                    onBlur={(e) => updChunk(selected.id, { start: parseT(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace" } }} />
                  <TextField label="■ Кінець" size="small" sx={{ flex: 1 }}
                    defaultValue={fmt(selected.end)} key={`e-${selected.id}`}
                    onBlur={(e) => updChunk(selected.id, { end: parseT(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace" } }} />
                </Box>

                <Select size="small" fullWidth value={selected.animation ?? ""}
                  displayEmpty
                  onChange={(e) => updChunk(selected.id, { animation: e.target.value || null })}
                  renderValue={(v) => {
                    if (!v) return <Typography variant="caption" color="text.secondary">авто анімація</Typography>;
                    const a = ANIMATIONS.find(x => x.value === v);
                    return a ? `${a.emoji} ${a.label}` : v;
                  }}>
                  <MenuItem value=""><em>авто (глобальна)</em></MenuItem>
                  {ANIMATIONS.map(a => (
                    <MenuItem key={a.value} value={a.value}>{a.emoji} {a.label} — {a.desc}</MenuItem>
                  ))}
                </Select>

                <Select size="small" fullWidth value={selected.effect ?? ""}
                  displayEmpty
                  onChange={(e) => updChunk(selected.id, { effect: e.target.value || null })}
                  renderValue={(v) => {
                    if (!v) return <Typography variant="caption" color="text.secondary">без ефекту</Typography>;
                    const ef = EFFECTS.find(x => x.value === v);
                    return ef ? `${ef.emoji} ${ef.label}` : v;
                  }}>
                  <MenuItem value=""><em>без ефекту</em></MenuItem>
                  {EFFECTS.map(ef => (
                    <MenuItem key={ef.value} value={ef.value}>{ef.emoji} {ef.label} — {ef.desc}</MenuItem>
                  ))}
                </Select>

                {/* Per-chunk colors */}
                <Box>
                  <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
                    Колір рядку (пусто = глобальний)
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Box component="label" sx={{ width: 32, height: 32, borderRadius: "50%",
                      background: selected.color || data.color, border: "2px solid #555", cursor: "pointer" }}>
                      <input type="color" value={selected.color || data.color}
                        onChange={(e) => updChunk(selected.id, { color: e.target.value })}
                        style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                    </Box>
                    {selected.color && (
                      <Typography variant="caption" sx={{ cursor: "pointer", opacity: 0.5 }}
                        onClick={() => updChunk(selected.id, { color: null })}>
                        ✕ скинути
                      </Typography>
                    )}

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Switch size="small" checked={!!selected.color2}
                        onChange={e => updChunk(selected.id, { color2: e.target.checked ? "#FF6B6B" : null })} />
                      <Typography variant="caption" color="text.secondary">градієнт</Typography>
                    </Box>

                    {selected.color2 && (
                      <Box component="label" sx={{ width: 32, height: 32, borderRadius: "50%",
                        background: selected.color2, border: "2px solid #555", cursor: "pointer" }}>
                        <input type="color" value={selected.color2}
                          onChange={(e) => updChunk(selected.id, { color2: e.target.value })}
                          style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                      </Box>
                    )}
                  </Box>
                  {selected.color && selected.color2 && (
                    <Box sx={{ mt: 0.5, height: 4, borderRadius: 2,
                      background: `linear-gradient(90deg,${selected.color},${selected.color2})` }} />
                  )}
                </Box>

                <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />}
                  onClick={() => seek(selected.start)}>
                  Перемотати до рядку
                </Button>
              </Box>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ p: 3, border: "1px dashed", borderColor: "divider",
                                        borderRadius: 2, textAlign: "center",
                                        display: "flex", flexDirection: "column",
                                        alignItems: "center", gap: 2, height: "100%",
                                        justifyContent: "center" }}>
              <Typography color="text.secondary" variant="body2">
                Клікни на рядок у таймлайні щоб редагувати
              </Typography>

              {/* Global settings */}
              <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="caption" color="text.secondary" textAlign="left">
                  Глобальні налаштування:
                </Typography>
                <Select size="small" fullWidth value={data.global_animation}
                  onChange={(e) => setData(d => ({ ...d, global_animation: e.target.value }))}>
                  {ANIMATIONS.map(a => (
                    <MenuItem key={a.value} value={a.value}>{a.emoji} {a.label}</MenuItem>
                  ))}
                </Select>
                <Select size="small" fullWidth value={data.global_effect ?? ""}
                  displayEmpty
                  onChange={(e) => setData(d => ({ ...d, global_effect: e.target.value || null }))}>
                  <MenuItem value=""><em>Без ефекту</em></MenuItem>
                  {EFFECTS.map(ef => (
                    <MenuItem key={ef.value} value={ef.value}>{ef.emoji} {ef.label}</MenuItem>
                  ))}
                </Select>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Box component="label" sx={{ width: 32, height: 32, borderRadius: "50%",
                    background: data.color, border: "2px solid #555", cursor: "pointer", flexShrink: 0 }}>
                    <input type="color" value={data.color}
                      onChange={(e) => setData(d => ({ ...d, color: e.target.value }))}
                      style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                  </Box>
                  <Switch size="small" checked={!!data.color2}
                    onChange={e => setData(d => ({ ...d, color2: e.target.checked ? "#FF6B6B" : null }))} />
                  <Typography variant="caption" color="text.secondary">градієнт</Typography>
                  {data.color2 && (
                    <Box component="label" sx={{ width: 32, height: 32, borderRadius: "50%",
                      background: data.color2, border: "2px solid #555", cursor: "pointer", flexShrink: 0 }}>
                      <input type="color" value={data.color2}
                        onChange={(e) => setData(d => ({ ...d, color2: e.target.value }))}
                        style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                    </Box>
                  )}
                </Box>

                {/* Position indicator */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary">
                    Позиція: {Math.round(data.sub_x ?? 50)}% × {Math.round(data.sub_y ?? 87.5)}%
                  </Typography>
                  <Button size="small" variant="text" sx={{ fontSize: "0.65rem", minWidth: 0, px: 1 }}
                    onClick={() => setData(d => ({ ...d, sub_x: 50, sub_y: 87.5 }))}>
                    скинути
                  </Button>
                </Box>
              </Box>

              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addChunk}>
                Додати субтитр на {fmt(currentTime)}
              </Button>
            </Paper>
          )}
        </Box>
      </Box>

      {/* ── Timeline ─────────────────────────────────────────────────────── */}
      <Box sx={{ px: 2, pb: 2, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            🎞 Таймлайн — перетягуй рядки, оранжеві ручки = обрізка
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addChunk} sx={{ ml: "auto" }}>
            + субтитр
          </Button>
        </Box>
        <Timeline
          duration={duration} currentTime={currentTime}
          chunks={data.chunks} selectedId={selectedId}
          trimStart={trimStart} trimEnd={trimEnd}
          onSeek={seek} onSelect={setSelectedId}
          onChunkChange={updChunk}
          onTrim={(s, e) => setData(d => ({ ...d, trim_start: s, trim_end: e }))}
        />
      </Box>
    </Box>
  );
}
