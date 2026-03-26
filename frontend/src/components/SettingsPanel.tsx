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
  Switch,
  FormControlLabel,
  Slider,
} from "@mui/material";
import { JobSettings, SubtitleData, SubtitleChunk } from "../api/client";

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

export const ANIMATIONS = [
  { value: "pop",        label: "POP",        emoji: "🎯", desc: "Пружний стрибок" },
  { value: "word_pop",   label: "WORDS",      emoji: "🅦",  desc: "Слово за словом з кольорами" },
  { value: "karaoke",    label: "KARAOKE",    emoji: "🎤", desc: "Підсвічування слів" },
  { value: "fade",       label: "FADE",       emoji: "✨", desc: "Плавне з'явлення" },
  { value: "typewriter", label: "TYPE",       emoji: "⌨️", desc: "Друкарська машинка" },
  { value: "slide_up",   label: "SLIDE",      emoji: "⬆️", desc: "Виїзд знизу" },
  { value: "bounce",     label: "BOUNCE",     emoji: "🏀", desc: "Гумовий відскок" },
  { value: "glow",       label: "GLOW",       emoji: "💡", desc: "Неоновий розмив" },
  { value: "zoom_in",    label: "ZOOM",       emoji: "🔍", desc: "Zoom від великого" },
  { value: "spin",       label: "SPIN",       emoji: "🌀", desc: "Обертання" },
  { value: "drop_in",    label: "DROP",       emoji: "⬇️", desc: "Падіння зверху" },
  { value: "cinema",     label: "CINEMA",     emoji: "🎬", desc: "Кіно-розтяжка" },
  { value: "flip",       label: "FLIP",       emoji: "🔄", desc: "Розкриття" },
  { value: "glitch",     label: "GLITCH",     emoji: "⚡", desc: "Цифровий глітч" },
];

export const EFFECTS = [
  { value: "glow",    label: "GLOW",    emoji: "💡", desc: "Неонове сяяння" },
  { value: "shake",   label: "SHAKE",   emoji: "📳", desc: "Тремтіння" },
  { value: "shadow",  label: "SHADOW",  emoji: "🌑", desc: "Велика тінь" },
  { value: "outline", label: "OUTLINE", emoji: "◻️", desc: "Контур, що пульсує" },
];

// ── Animation presets ─────────────────────────────────────────────────────────
const PRESET_ANIMS_ENERGY   = ["pop","bounce","zoom_in","flip","glitch","spin"] as const;
const PRESET_ANIMS_CHILL    = ["fade","slide_up","cinema","fade","drop_in"] as const;
const PRESET_ANIMS_CINEMATIC = ["cinema","fade"] as const;
const PRESET_ANIMS_PARTY    = ["pop","bounce","spin","flip","glitch","zoom_in","drop_in"] as const;
const PRESET_EFFECTS_PARTY  = ["glow", null, "shake", null, "outline", null, "glow"] as const;
const PRESET_COLORS_ENERGY  = ["#F5E642","#E8593C","#42B883","#4287F5","#C084FC","#F472B6"];
const PRESET_COLORS_PARTY   = ["#F5E642","#F542B3","#42B883","#4287F5","#FFB347","#C084FC","#E8593C"];

export interface Preset {
  name: string; emoji: string; desc: string;
  apply: (d: SubtitleData) => SubtitleData;
}

export const PRESETS: Preset[] = [
  {
    name: "VIRAL", emoji: "🔥", desc: "Слово за словом · барвисто · по центру",
    apply: (d) => ({
      ...d,
      global_animation: "word_pop", color: "#F5E642", color2: null,
      global_effect: null, font_size: 88, sub_y: 50,
      chunks: d.chunks.map(c => ({ ...c, animation: null as SubtitleChunk["animation"], color: null, color2: null, effect: null, font_size: null })),
    }),
  },
  {
    name: "ENERGY", emoji: "⚡", desc: "Різні анімації · яскраві кольори",
    apply: (d) => ({
      ...d,
      global_animation: "pop", color: "#FFFFFF", color2: null,
      global_effect: null, font_size: 82, sub_y: 87.5,
      chunks: d.chunks.map((c, i) => ({
        ...c,
        animation: PRESET_ANIMS_ENERGY[i % PRESET_ANIMS_ENERGY.length] as SubtitleChunk["animation"],
        color: PRESET_COLORS_ENERGY[i % PRESET_COLORS_ENERGY.length],
        color2: null, effect: null, font_size: null,
      })),
    }),
  },
  {
    name: "NEON", emoji: "💡", desc: "Неоновий градієнт · glow ефект",
    apply: (d) => ({
      ...d,
      global_animation: "glow", color: "#00FFFF", color2: "#F542B3",
      global_effect: "glow", font_size: 80, sub_y: 87.5,
      chunks: d.chunks.map(c => ({ ...c, animation: null as SubtitleChunk["animation"], color: null, color2: null, effect: null, font_size: null })),
    }),
  },
  {
    name: "CHILL", emoji: "🌊", desc: "Плавні переходи · синій градієнт",
    apply: (d) => ({
      ...d,
      global_animation: "fade", color: "#FFFFFF", color2: "#00C9FF",
      global_effect: null, font_size: 76, sub_y: 87.5,
      chunks: d.chunks.map((c, i) => ({
        ...c,
        animation: PRESET_ANIMS_CHILL[i % PRESET_ANIMS_CHILL.length] as SubtitleChunk["animation"],
        color: null, color2: null, effect: null, font_size: null,
      })),
    }),
  },
  {
    name: "CINEMA", emoji: "🎬", desc: "Кіношний стиль · велика тінь",
    apply: (d) => ({
      ...d,
      global_animation: "cinema", color: "#FFFFFF", color2: null,
      global_effect: "shadow", font_size: 92, sub_y: 87.5,
      chunks: d.chunks.map((c, i) => ({
        ...c,
        animation: PRESET_ANIMS_CINEMATIC[i % PRESET_ANIMS_CINEMATIC.length] as SubtitleChunk["animation"],
        color: null, color2: null, effect: null, font_size: null,
      })),
    }),
  },
  {
    name: "PARTY", emoji: "🎉", desc: "Всі анімації по черзі · мікс кольорів",
    apply: (d) => ({
      ...d,
      global_animation: "pop", color: "#FFFFFF", color2: null,
      global_effect: null, font_size: 82, sub_y: 87.5,
      chunks: d.chunks.map((c, i) => ({
        ...c,
        animation: PRESET_ANIMS_PARTY[i % PRESET_ANIMS_PARTY.length] as SubtitleChunk["animation"],
        color: PRESET_COLORS_PARTY[i % PRESET_COLORS_PARTY.length],
        color2: null,
        effect: PRESET_EFFECTS_PARTY[i % PRESET_EFFECTS_PARTY.length] ?? null,
        font_size: null,
      })),
    }),
  },
];

const COLOR_PRESETS = [
  "#FFFFFF", "#FFFF00", "#00FFFF", "#FF6B6B",
  "#69FF94", "#FFB347", "#C084FC", "#F472B6",
];

function ColorSwatch({
  color,
  selected,
  onClick,
  tooltip,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip title={tooltip} arrow>
      <Box
        onClick={onClick}
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: color,
          cursor: "pointer",
          border: selected ? "3px solid #7C5CFC" : "3px solid transparent",
          outline: selected ? "2px solid #7C5CFC44" : "none",
          transition: "transform 0.15s",
          flexShrink: 0,
          "&:hover": { transform: "scale(1.2)" },
        }}
      />
    </Tooltip>
  );
}

function ColorPickerRaw({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Tooltip title="Свій колір" arrow>
      <Box
        component="label"
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "transform 0.15s",
          "&:hover": { transform: "scale(1.2)" },
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
        />
      </Box>
    </Tooltip>
  );
}

export default function SettingsPanel({ settings, onChange }: Props) {
  const set = (patch: Partial<JobSettings>) => onChange({ ...settings, ...patch });
  const hasGradient = !!settings.color2;
  const toggleEffect = (val: string) => set({ effect: settings.effect === val ? null : val });

  return (
    <Paper
      elevation={0}
      sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3,
            display: "flex", flexDirection: "column", gap: 3 }}
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
            <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Animation */}
      <Box>
        <Typography variant="caption" color="text.secondary" mb={1} display="block">
          ✨ Анімація
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={0.8}>
          {ANIMATIONS.map((a) => (
            <Tooltip key={a.value} title={a.desc} arrow>
              <ToggleButton
                value={a.value}
                selected={settings.animation === a.value}
                onChange={() => set({ animation: a.value })}
                size="small"
                sx={{
                  flexDirection: "column",
                  px: 1.5, py: 1,
                  gap: 0.3,
                  fontWeight: 600,
                  fontSize: "0.65rem",
                  lineHeight: 1.2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "10px !important",
                  "&.Mui-selected": {
                    background: "linear-gradient(135deg, #7C5CFC33, #00E5FF22)",
                    borderColor: "primary.main",
                    color: "primary.light",
                  },
                }}
              >
                <span style={{ fontSize: 18 }}>{a.emoji}</span>
                {a.label}
              </ToggleButton>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Font size */}
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
          <Typography variant="caption" color="text.secondary">🔡 Розмір шрифту</Typography>
          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
            {settings.font_size}pt
          </Typography>
        </Box>
        <Slider
          size="small"
          min={28}
          max={160}
          step={4}
          value={settings.font_size}
          onChange={(_, v) => set({ font_size: v as number })}
          marks={[
            { value: 48, label: "S" },
            { value: 76, label: "M" },
            { value: 112, label: "L" },
            { value: 148, label: "XL" },
          ]}
          sx={{ mx: 0.5 }}
        />
      </Box>

      {/* Effects */}
      <Box>
        <Typography variant="caption" color="text.secondary" mb={1} display="block">
          🔮 Ефект (поверх анімації)
        </Typography>
        <Box display="flex" flexWrap="wrap" gap={0.8}>
          {EFFECTS.map((ef) => (
            <Tooltip key={ef.value} title={ef.desc} arrow>
              <ToggleButton
                value={ef.value}
                selected={settings.effect === ef.value}
                onChange={() => toggleEffect(ef.value)}
                size="small"
                sx={{
                  flexDirection: "column",
                  px: 1.5, py: 1,
                  gap: 0.3,
                  fontWeight: 600,
                  fontSize: "0.65rem",
                  lineHeight: 1.2,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "10px !important",
                  "&.Mui-selected": {
                    background: "linear-gradient(135deg, #7C5CFC33, #00E5FF22)",
                    borderColor: "primary.main",
                    color: "primary.light",
                  },
                }}
              >
                <span style={{ fontSize: 18 }}>{ef.emoji}</span>
                {ef.label}
              </ToggleButton>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Color */}
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="caption" color="text.secondary">🎨 Колір тексту</Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={hasGradient}
                onChange={(e) => set({ color2: e.target.checked ? "#FF6B6B" : null })}
              />
            }
            label={<Typography variant="caption" color="text.secondary">Градієнт</Typography>}
            sx={{ m: 0 }}
          />
        </Box>

        <Box display="flex" gap={2} alignItems="flex-start">
          {/* Color 1 */}
          <Box>
            {hasGradient && (
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Від
              </Typography>
            )}
            <Box display="flex" gap={0.8} flexWrap="wrap" alignItems="center">
              {COLOR_PRESETS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  selected={settings.color === c}
                  onClick={() => set({ color: c })}
                  tooltip={c}
                />
              ))}
              <ColorPickerRaw value={settings.color} onChange={(c) => set({ color: c })} />
              <Box
                sx={{
                  px: 1, py: 0.3, borderRadius: 1,
                  background: settings.color,
                  fontFamily: "monospace", fontSize: "0.7rem",
                  fontWeight: 700, color: "#000",
                  userSelect: "none",
                }}
              >
                {settings.color.toUpperCase()}
              </Box>
            </Box>
          </Box>

          {/* Color 2 — gradient end */}
          {hasGradient && settings.color2 && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                До
              </Typography>
              <Box display="flex" gap={0.8} flexWrap="wrap" alignItems="center">
                {COLOR_PRESETS.map((c) => (
                  <ColorSwatch
                    key={c}
                    color={c}
                    selected={settings.color2 === c}
                    onClick={() => set({ color2: c })}
                    tooltip={c}
                  />
                ))}
                <ColorPickerRaw value={settings.color2} onChange={(c) => set({ color2: c })} />
                <Box
                  sx={{
                    background: `linear-gradient(90deg, ${settings.color}, ${settings.color2})`,
                    px: 1, py: 0.3, borderRadius: 1,
                    fontFamily: "monospace", fontSize: "0.7rem",
                    fontWeight: 700, color: "#000",
                    userSelect: "none",
                  }}
                >
                  {settings.color2.toUpperCase()}
                </Box>
              </Box>
            </Box>
          )}
        </Box>

        {/* Gradient preview */}
        {hasGradient && settings.color2 && (
          <Box
            mt={1.5}
            sx={{
              height: 6,
              borderRadius: 3,
              background: `linear-gradient(90deg, ${settings.color}, ${settings.color2})`,
            }}
          />
        )}
      </Box>
    </Paper>
  );
}
