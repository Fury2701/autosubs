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
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { pollJob, downloadUrl, JobResponse } from "../api/client";

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
        if (!cancelled) {
          timerRef.current = setTimeout(poll, POLL_INTERVAL * 2);
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId]);

  if (!job) {
    return (
      <Box mt={4}>
        <LinearProgress />
        <Typography mt={2} color="text.secondary">
          Connecting…
        </Typography>
      </Box>
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
          borderColor: isDone
            ? "success.main"
            : isFailed
            ? "error.main"
            : "divider",
          borderRadius: 4,
        }}
      >
        {/* Status badge */}
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

        {/* Label */}
        <Typography variant="h6" fontWeight={600} mb={2}>
          {job.label}
        </Typography>

        {/* Progress bar */}
        <LinearProgress
          variant="determinate"
          value={job.progress}
          color={isDone ? "success" : isFailed ? "error" : "primary"}
          sx={{ height: 8, borderRadius: 4, mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {job.progress}%
        </Typography>

        {/* Steps timeline */}
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

        {/* Error */}
        {isFailed && job.error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {job.error}
          </Alert>
        )}

        {/* Actions */}
        <Box display="flex" gap={2} mt={4}>
          {isDone && (
            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              href={downloadUrl(jobId)}
              download
            >
              Download Video
            </Button>
          )}
          <Button
            variant={isDone ? "outlined" : "text"}
            size="large"
            startIcon={<ReplayIcon />}
            onClick={onReset}
            color={isFailed ? "error" : "inherit"}
          >
            {isFailed ? "Try again" : "New video"}
          </Button>
        </Box>

        {isDone && (
          <Box display="flex" alignItems="center" gap={1} mt={3}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main">
              Subtitles burned in — karaoke-style word highlighting included.
            </Typography>
          </Box>
        )}
      </Paper>
    </Fade>
  );
}
