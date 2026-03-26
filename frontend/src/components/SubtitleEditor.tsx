import React, { useState } from "react";
import {
  Box, Typography, TextField, IconButton, Button, Select,
  MenuItem, Tooltip, Paper, Divider, Alert, CircularProgress,
  Chip, Switch, FormControlLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PaletteIcon from "@mui/icons-material/Palette";
import { SubtitleData, SubtitleChunk, rerender } from "../api/client";
import { ANIMATIONS } from "./SettingsPanel";

interface Props {
  jobId: string;
  initial: SubtitleData;
  onBack: () => void;
  onRerenderStarted: () => void;
}

const COLOR_PRESETS = [
  "#FFFFFF", "#FFFF00", "#00FFFF", "#FF6B6B",
  "#69FF94", "#FFB347", "#C084FC", "#F472B6",
];

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}
function parseTime(v: string) {
  const [m, s] = v.split(":");
  return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0);
}

function MiniColorPicker({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
}) {
  const active = !!value;
  return (
    <Box display="flex" alignItems="center" gap={0.5}>
      <Tooltip title={label} arrow>
        <Box
          component="label"
          sx={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: value || "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
            cursor: "pointer",
            border: active ? "2px solid #7C5CFC" : "2px dashed #555",
            flexShrink: 0,
            transition: "transform 0.15s",
            "&:hover": { transform: "scale(1.15)" },
          }}
        >
          <input
            type="color"
            value={value || "#FFFFFF"}
            onChange={(e) => onChange(e.target.value)}
            style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
          />
        </Box>
      </Tooltip>
      {active && (
        <Tooltip title="Скинути до глобального" arrow>
          <Typography
            variant="caption"
            sx={{ cursor: "pointer", opacity: 0.5, "&:hover": { opacity: 1 } }}
            onClick={() => onChange(null)}
          >
            ✕
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
}

export default function SubtitleEditor({
  jobId, initial, onBack, onRerenderStarted,
}: Props) {
  const [data, setData] = useState<SubtitleData>(() => JSON.parse(JSON.stringify(initial)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);

  const upd = (id: number, patch: Partial<SubtitleChunk>) =>
    setData((d) => ({ ...d, chunks: d.chunks.map((c) => c.id === id ? { ...c, ...patch } : c) }));

  const del = (id: number) =>
    setData((d) => ({ ...d, chunks: d.chunks.filter((c) => c.id !== id) }));

  const addAfter = (afterId: number) => {
    const idx = data.chunks.findIndex((c) => c.id === afterId);
    const prev = data.chunks[idx];
    const next = data.chunks[idx + 1];
    const ns = prev ? prev.end + 0.1 : 0;
    const ne = next ? Math.min(next.start - 0.1, ns + 1) : ns + 1;
    const nc: SubtitleChunk = { id: Date.now(), text: "New subtitle", start: ns, end: ne,
                                animation: null, color: null, color2: null };
    const chunks = [...data.chunks];
    chunks.splice(idx + 1, 0, nc);
    setData((d) => ({ ...d, chunks }));
  };

  const handleRerender = async () => {
    setError(null);
    setLoading(true);
    try {
      await rerender(jobId, data);
      onRerenderStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Re-render failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
        <IconButton onClick={onBack} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>Редактор субтитрів</Typography>
        <Chip label={`${data.chunks.length} рядків`} size="small" variant="outlined" />
      </Box>

      {/* Global settings bar */}
      <Paper elevation={0}
        sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          {/* Global animation */}
          <Select size="small" value={data.global_animation} sx={{ minWidth: 150 }}
            onChange={(e) => setData((d) => ({ ...d, global_animation: e.target.value }))}>
            <MenuItem value=""><em>Без анімації</em></MenuItem>
            {ANIMATIONS.map((a) => (
              <MenuItem key={a.value} value={a.value}>{a.emoji} {a.label}</MenuItem>
            ))}
          </Select>

          {/* Global colors */}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">Колір:</Typography>
            <Box component="label" sx={{ width: 28, height: 28, borderRadius: "50%",
              background: data.color, border: "2px solid #444", cursor: "pointer" }}>
              <input type="color" value={data.color}
                onChange={(e) => setData((d) => ({ ...d, color: e.target.value }))}
                style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
            </Box>
          </Box>

          {/* Gradient toggle */}
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">Градієнт:</Typography>
            <Switch size="small" checked={!!data.color2}
              onChange={(e) => setData((d) => ({ ...d, color2: e.target.checked ? "#FF6B6B" : null }))} />
            {data.color2 && (
              <Box component="label" sx={{ width: 28, height: 28, borderRadius: "50%",
                background: data.color2, border: "2px solid #444", cursor: "pointer" }}>
                <input type="color" value={data.color2}
                  onChange={(e) => setData((d) => ({ ...d, color2: e.target.value }))}
                  style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
              </Box>
            )}
            {data.color2 && (
              <Box sx={{ width: 60, height: 6, borderRadius: 3,
                background: `linear-gradient(90deg, ${data.color}, ${data.color2})` }} />
            )}
          </Box>

          {/* Toggle per-chunk colors */}
          <Tooltip title="Per-chunk кольори" arrow>
            <IconButton size="small"
              color={showColors ? "primary" : "default"}
              onClick={() => setShowColors((v) => !v)}>
              <PaletteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Column headers */}
      <Box display="flex" gap={1} px={1} mb={0.5}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>#</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>Час</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>Текст</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 130 }}>Анімація</Typography>
        {showColors && (
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>Колір</Typography>
        )}
        <Box sx={{ minWidth: 32 }} />
      </Box>

      {/* Chunk list */}
      <Box display="flex" flexDirection="column" gap={0.8} mb={3}>
        {data.chunks.map((chunk, idx) => (
          <React.Fragment key={chunk.id}>
            <Paper elevation={0}
              sx={{ p: 1.2, border: "1px solid", borderColor: "divider", borderRadius: 2,
                    "&:hover": { borderColor: "primary.main" }, transition: "border-color 0.15s" }}>
              <Box display="flex" gap={1} alignItems="flex-start">
                {/* Index */}
                <Typography variant="caption" color="text.secondary"
                  sx={{ mt: 1.2, minWidth: 24, textAlign: "right" }}>
                  {idx + 1}
                </Typography>

                {/* Times */}
                <Box display="flex" flexDirection="column" gap={0.5} sx={{ minWidth: 90 }}>
                  <TextField size="small" label="▶" defaultValue={fmtTime(chunk.start)}
                    onBlur={(e) => upd(chunk.id, { start: parseTime(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace", fontSize: 11 } }} />
                  <TextField size="small" label="■" defaultValue={fmtTime(chunk.end)}
                    onBlur={(e) => upd(chunk.id, { end: parseTime(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace", fontSize: 11 } }} />
                </Box>

                {/* Text */}
                <TextField fullWidth size="small" multiline maxRows={3}
                  value={chunk.text}
                  onChange={(e) => upd(chunk.id, { text: e.target.value })}
                  sx={{ flex: 1 }} />

                {/* Per-chunk animation */}
                <Select size="small" value={chunk.animation ?? ""} displayEmpty
                  sx={{ minWidth: 130 }}
                  onChange={(e) => upd(chunk.id, { animation: e.target.value || null })}
                  renderValue={(v) => {
                    if (!v) return <Typography variant="caption" color="text.secondary">авто</Typography>;
                    const a = ANIMATIONS.find((x) => x.value === v);
                    return a ? `${a.emoji} ${a.label}` : v;
                  }}>
                  <MenuItem value=""><em>авто (глобальна)</em></MenuItem>
                  {ANIMATIONS.map((a) => (
                    <MenuItem key={a.value} value={a.value}>{a.emoji} {a.label} — {a.desc}</MenuItem>
                  ))}
                </Select>

                {/* Per-chunk colors */}
                {showColors && (
                  <Box display="flex" flexDirection="column" gap={0.5} sx={{ minWidth: 70 }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>c1</Typography>
                      <MiniColorPicker value={chunk.color} onChange={(v) => upd(chunk.id, { color: v })} label="Основний колір" />
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>c2</Typography>
                      <MiniColorPicker value={chunk.color2} onChange={(v) => upd(chunk.id, { color2: v })} label="Колір градієнту" />
                    </Box>
                    {chunk.color && chunk.color2 && (
                      <Box sx={{ height: 4, borderRadius: 2,
                        background: `linear-gradient(90deg, ${chunk.color}, ${chunk.color2})` }} />
                    )}
                  </Box>
                )}

                {/* Delete */}
                <Tooltip title="Видалити" arrow>
                  <IconButton size="small" color="error" onClick={() => del(chunk.id)} sx={{ mt: 0.5 }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>

            {/* Add between rows */}
            <Box display="flex" justifyContent="center">
              <Tooltip title="Додати рядок" arrow>
                <IconButton size="small" onClick={() => addAfter(chunk.id)}
                  sx={{ opacity: 0.25, "&:hover": { opacity: 1 }, p: 0.2 }}>
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </React.Fragment>
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Divider sx={{ mb: 2 }} />

      <Button fullWidth variant="contained" size="large"
        disabled={loading || data.chunks.length === 0}
        onClick={handleRerender}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <MovieFilterIcon />}
        sx={{
          py: 1.8, fontWeight: 700,
          background: "linear-gradient(135deg, #7C5CFC 0%, #00C9FF 100%)",
          "&:hover": { background: "linear-gradient(135deg, #9D80FF 0%, #00E5FF 100%)" },
        }}>
        {loading ? "Відправляю..." : "🎬 RE-RENDER"}
      </Button>
    </Box>
  );
}
