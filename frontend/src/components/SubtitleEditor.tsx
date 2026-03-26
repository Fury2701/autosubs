import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { SubtitleData, SubtitleChunk, rerender } from "../api/client";

interface Props {
  jobId: string;
  initial: SubtitleData;
  onBack: () => void;
  onRerenderStarted: () => void;
}

const ANIMATIONS = [
  { value: "pop",     label: "POP 🎯" },
  { value: "karaoke", label: "KARAOKE 🎤" },
  { value: "fade",    label: "FADE ✨" },
];

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${m}:${sec}`;
}

function parseTime(val: string): number {
  const [m, s] = val.split(":");
  return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0);
}

export default function SubtitleEditor({ jobId, initial, onBack, onRerenderStarted }: Props) {
  const [data, setData] = useState<SubtitleData>(() =>
    JSON.parse(JSON.stringify(initial))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateChunk = (id: number, patch: Partial<SubtitleChunk>) => {
    setData((d) => ({
      ...d,
      chunks: d.chunks.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const deleteChunk = (id: number) => {
    setData((d) => ({ ...d, chunks: d.chunks.filter((c) => c.id !== id) }));
  };

  const addChunkAfter = (afterId: number) => {
    const idx = data.chunks.findIndex((c) => c.id === afterId);
    const prev = data.chunks[idx];
    const next = data.chunks[idx + 1];
    const newStart = prev ? prev.end + 0.1 : 0;
    const newEnd = next ? Math.min(next.start - 0.1, newStart + 1) : newStart + 1;
    const newChunk: SubtitleChunk = {
      id: Date.now(),
      text: "New subtitle",
      start: newStart,
      end: newEnd,
      animation: null,
    };
    const chunks = [...data.chunks];
    chunks.splice(idx + 1, 0, newChunk);
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
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          Редактор субтитрів
        </Typography>
        <Chip label={`${data.chunks.length} рядків`} size="small" variant="outlined" />
      </Box>

      {/* Global settings */}
      <Paper
        elevation={0}
        sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
      >
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            Глобальна анімація:
          </Typography>
          <Select
            size="small"
            value={data.global_animation}
            onChange={(e) => setData((d) => ({ ...d, global_animation: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            {ANIMATIONS.map((a) => (
              <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
            ))}
          </Select>

          <Typography variant="caption" color="text.secondary">
            Колір:
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <input
              type="color"
              value={data.color}
              onChange={(e) => setData((d) => ({ ...d, color: e.target.value }))}
              style={{ width: 36, height: 36, border: "none", background: "none", cursor: "pointer" }}
            />
            <Typography variant="caption" fontFamily="monospace">
              {data.color.toUpperCase()}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Chunks list */}
      <Box display="flex" flexDirection="column" gap={1} mb={3}>
        {data.chunks.map((chunk, idx) => (
          <React.Fragment key={chunk.id}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                "&:hover": { borderColor: "primary.main" },
                transition: "border-color 0.15s",
              }}
            >
              <Box display="flex" gap={1} alignItems="flex-start">
                {/* Index */}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1.2, minWidth: 24, textAlign: "right" }}
                >
                  {idx + 1}
                </Typography>

                {/* Timings */}
                <Box display="flex" flexDirection="column" gap={0.5} minWidth={90}>
                  <TextField
                    size="small"
                    label="Початок"
                    defaultValue={fmtTime(chunk.start)}
                    onBlur={(e) => updateChunk(chunk.id, { start: parseTime(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }}
                  />
                  <TextField
                    size="small"
                    label="Кінець"
                    defaultValue={fmtTime(chunk.end)}
                    onBlur={(e) => updateChunk(chunk.id, { end: parseTime(e.target.value) })}
                    inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }}
                  />
                </Box>

                {/* Text */}
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={3}
                  value={chunk.text}
                  onChange={(e) => updateChunk(chunk.id, { text: e.target.value })}
                  sx={{ flex: 1 }}
                />

                {/* Per-chunk animation */}
                <Select
                  size="small"
                  value={chunk.animation ?? ""}
                  displayEmpty
                  onChange={(e) =>
                    updateChunk(chunk.id, { animation: e.target.value || null })
                  }
                  sx={{ minWidth: 120 }}
                  renderValue={(v) =>
                    v ? ANIMATIONS.find((a) => a.value === v)?.label : (
                      <Typography variant="caption" color="text.secondary">авто</Typography>
                    )
                  }
                >
                  <MenuItem value=""><em>авто (глобальна)</em></MenuItem>
                  {ANIMATIONS.map((a) => (
                    <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                  ))}
                </Select>

                {/* Delete */}
                <Tooltip title="Видалити рядок">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => deleteChunk(chunk.id)}
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>

            {/* Add between */}
            <Box display="flex" justifyContent="center">
              <Tooltip title="Додати рядок після">
                <IconButton
                  size="small"
                  onClick={() => addChunkAfter(chunk.id)}
                  sx={{ opacity: 0.3, "&:hover": { opacity: 1 }, p: 0.3 }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </React.Fragment>
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Divider sx={{ mb: 2 }} />

      <Button
        fullWidth
        variant="contained"
        size="large"
        disabled={loading || data.chunks.length === 0}
        onClick={handleRerender}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <MovieFilterIcon />}
        sx={{
          py: 1.8,
          fontWeight: 700,
          background: "linear-gradient(135deg, #7C5CFC 0%, #00C9FF 100%)",
          "&:hover": { background: "linear-gradient(135deg, #9D80FF 0%, #00E5FF 100%)" },
        }}
      >
        {loading ? "Відправляю..." : "🎬 RE-RENDER"}
      </Button>
    </Box>
  );
}
