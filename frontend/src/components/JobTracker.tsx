import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  LinearProgress,
  Button,
  Alert,
  Chip,
  Paper,
  Fade,
  CircularProgress,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ReplayIcon from "@mui/icons-material/Replay";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { pollJob, getSubtitles, JobResponse, SubtitleData } from "../api/client";
import SubtitleEditor from "./SubtitleEditor";

interface Props {
  jobId: string;
  onReset: () => void;
}

const STEP_ICONS: Record<string, string> = {
  pending: "⏳",
  uploading: "📤",
  transcribing: "🎙️",
  rendering: "🎬",
  done: "✅",
  failed: "❌",
};

const POLL_INTERVAL = 2500;

export default function JobTracker({ jobId, onReset }: Props) {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [subtitles, setSubtitles] = useState<SubtitleData | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPolling = () => {
    let cancelled = false;

    const poll = async () => {
      try {
        const data = await pollJob(jobId);
        if (!cancelled) {
          setJob(data);
          if (data.status !== "done" && data.status !== "failed") {
            timerRef.current = setTimeout(poll, POLL_INTERVAL);
          }
        }
      } catch {
        if (!cancelled) timerRef.current = setTimeout(poll, POLL_INTERVAL * 2);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  };

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [jobId]);

  const handleEditClick = async () => {
    setEditError(null);
    setLoadingEdit(true);
    try {
      const data = await getSubtitles(jobId);
      setSubtitles(data);
      setEditing(true);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to load subtitles");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleRerenderStarted = () => {
    setEditing(false);
    setSubtitles(null);
    // restart polling
    if (timerRef.current) clearTimeout(timerRef.current);
    startPolling();
  };

  if (!job) {
    return (
      <Box mt={4}>
        <LinearProgress />
        <Typography mt={2} color="text.secondary">Connecting…</Typography>
      </Box>
    );
  }

  if (editing && subtitles) {
    return (
      <SubtitleEditor
        jobId={jobId}
        initial={subtitles}
        onBack={() => setEditing(false)}
        onRerenderStarted={handleRerenderStarted}
      />
    );
  }

  const isDone = job.status === "done";
  const isFailed = job.status === "failed";
  const isRunning = !isDone && !isFailed;

  return (
    <Fade in>
      <Paper
        elevation={0}
        sx={{
          p: 5,
          border: "1px solid",
          borderColor: isDone ? "success.main" : isFailed ? "error.main" : "divider",
          borderRadius: 4,
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5} mb={3}>
          <Typography fontSize={28}>{STEP_ICONS[job.status] ?? "⏳"}</Typography>
          <Chip
            label={job.status.toUpperCase()}
            color={isDone ? "success" : isFailed ? "error" : "primary"}
            size="small"
            sx={{ fontWeight: 700, letterSpacing: 1 }}
          />
          {job.filename && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {job.filename}
            </Typography>
          )}
        </Box>

        <Typography variant="h6" fontWeight={600} mb={2}>{job.label}</Typography>

        <LinearProgress
          variant="determinate"
          value={job.progress}
          color={isDone ? "success" : isFailed ? "error" : "primary"}
          sx={{ height: 8, borderRadius: 4, mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">{job.progress}%</Typography>

        {isRunning && (
          <Box mt={3} display="flex" gap={1} flexWrap="wrap">
            {(["transcribing", "rendering"] as const).map((s) => (
              <Chip
                key={s}
                label={s}
                size="small"
                variant={job.status === s ? "filled" : "outlined"}
                color={job.status === s ? "secondary" : "default"}
                sx={{ opacity: job.status === s ? 1 : 0.4 }}
              />
            ))}
          </Box>
        )}

        {isFailed && job.error && (
          <Alert severity="error" sx={{ mt: 3 }}>{job.error}</Alert>
        )}

        {editError && (
          <Alert severity="error" sx={{ mt: 2 }}>{editError}</Alert>
        )}

        <Box display="flex" gap={2} mt={4} flexWrap="wrap">
          {isDone && (
            <>
              <Button
                variant="contained"
                size="large"
                startIcon={<DownloadIcon />}
                href={`/api/jobs/${jobId}/download`}
                download
              >
                Завантажити
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={loadingEdit ? <CircularProgress size={16} /> : <EditIcon />}
                onClick={handleEditClick}
                disabled={loadingEdit}
              >
                Редагувати субтитри
              </Button>
            </>
          )}
          <Button
            variant={isDone ? "text" : "outlined"}
            size="large"
            startIcon={<ReplayIcon />}
            onClick={onReset}
            color={isFailed ? "error" : "inherit"}
          >
            {isFailed ? "Спробувати знову" : "Нове відео"}
          </Button>
        </Box>

        {isDone && (
          <Box display="flex" alignItems="center" gap={1} mt={3}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main">
              Субтитри готові — можна завантажити або відредагувати перед завантаженням.
            </Typography>
          </Box>
        )}
      </Paper>
    </Fade>
  );
}
