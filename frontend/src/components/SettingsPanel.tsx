import React from "react";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Paper,
} from "@mui/material";
import { JobSettings } from "../api/client";

interface Props {
  settings: JobSettings;
  onChange: (s: JobSettings) => void;
}

const LANGUAGES = [
  { code: "auto", label: "🌍 Авто-визначення" },
  { code: "en",   label: "🇺🇸 Англійська" },
  { code: "uk",   label: "🇺🇦 Українська" },
  { code: "ru",   label: "🇷🇺 Російська" },
  { code: "de",   label: "🇩🇪 Німецька" },
  { code: "fr",   label: "🇫🇷 Французька" },
  { code: "es",   label: "🇪🇸 Іспанська" },
  { code: "it",   label: "🇮🇹 Італійська" },
  { code: "pl",   label: "🇵🇱 Польська" },
  { code: "pt",   label: "🇧🇷 Португальська" },
  { code: "ja",   label: "🇯🇵 Японська" },
  { code: "zh",   label: "🇨🇳 Китайська" },
];

const ANIMATIONS = [
  { value: "pop",     label: "POP",     desc: "Пружний стрибок", emoji: "🎯" },
  { value: "karaoke", label: "KARAOKE", desc: "Підсвічування слів", emoji: "🎤" },
  { value: "fade",    label: "FADE",    desc: "Плавне з'явлення", emoji: "✨" },
];

const COLOR_PRESETS = [
  { hex: "#FFFFFF", label: "Білий" },
  { hex: "#FFFF00", label: "Жовтий" },
  { hex: "#00FFFF", label: "Блакитний" },
  { hex: "#FF6B6B", label: "Червоний" },
  { hex: "#69FF94", label: "Зелений" },
  { hex: "#FFB347", label: "Помаранчевий" },
];

export default function SettingsPanel({ settings, onChange }: Props) {
  const set = (patch: Partial<JobSettings>) =>
    onChange({ ...settings, ...patch });

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Language */}
      <FormControl size="small" fullWidth>
        <InputLabel>🌍 Мова відео</InputLabel>
        <Select
          value={settings.language}
          label="🌍 Мова відео"
          onChange={(e) => set({ language: e.target.value })}
        >
          {LANGUAGES.map((l) => (
            <MenuItem key={l.code} value={l.code}>
              {l.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Animation */}
      <Box>
        <Typography variant="caption" color="text.secondary" mb={1} display="block">
          ✨ Анімація
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={settings.animation}
          onChange={(_, v) => v && set({ animation: v })}
          size="small"
        >
          {ANIMATIONS.map((a) => (
            <Tooltip key={a.value} title={a.desc} arrow>
              <ToggleButton
                value={a.value}
                sx={{
                  flexDirection: "column",
                  py: 1.5,
                  gap: 0.5,
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  "&.Mui-selected": {
                    background: "linear-gradient(135deg, #7C5CFC33, #00E5FF22)",
                    borderColor: "primary.main",
                    color: "primary.light",
                  },
                }}
              >
                <span style={{ fontSize: 20 }}>{a.emoji}</span>
                {a.label}
              </ToggleButton>
            </Tooltip>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Color */}
      <Box>
        <Typography variant="caption" color="text.secondary" mb={1} display="block">
          🎨 Колір тексту
        </Typography>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          {COLOR_PRESETS.map((c) => (
            <Tooltip key={c.hex} title={c.label} arrow>
              <Box
                onClick={() => set({ color: c.hex })}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: c.hex,
                  cursor: "pointer",
                  border: settings.color === c.hex
                    ? "3px solid #7C5CFC"
                    : "3px solid transparent",
                  outline: settings.color === c.hex
                    ? "2px solid #7C5CFC44"
                    : "none",
                  transition: "transform 0.15s",
                  "&:hover": { transform: "scale(1.2)" },
                }}
              />
            </Tooltip>
          ))}

          {/* Custom colour picker */}
          <Tooltip title="Свій колір" arrow>
            <Box
              component="label"
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background:
                  "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
                cursor: "pointer",
                border: !COLOR_PRESETS.find((c) => c.hex === settings.color)
                  ? "3px solid #7C5CFC"
                  : "3px solid transparent",
                transition: "transform 0.15s",
                "&:hover": { transform: "scale(1.2)" },
              }}
            >
              <input
                type="color"
                value={settings.color}
                onChange={(e) => set({ color: e.target.value })}
                style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
              />
            </Box>
          </Tooltip>

          <Box
            sx={{
              ml: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              background: settings.color,
              color: "#000",
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontWeight: 700,
              userSelect: "none",
            }}
          >
            {settings.color.toUpperCase()}
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
