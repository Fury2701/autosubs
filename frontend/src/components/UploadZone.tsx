import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MovieIcon from "@mui/icons-material/Movie";
import { createJob } from "../api/client";

interface Props {
  onJobCreated: (jobId: string) => void;
}

const ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/x-matroska": [".mkv"],
  "video/avi": [".avi"],
  "video/webm": [".webm"],
  "video/x-m4v": [".m4v"],
};

export default function UploadZone({ onJobCreated }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setError(null);
      setLoading(true);
      try {
        const { job_id } = await createJob(accepted[0]);
        onJobCreated(job_id);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onJobCreated]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED,
      maxFiles: 1,
      disabled: loading,
    });

  const borderColor = isDragReject
    ? theme.palette.error.main
    : isDragActive
    ? theme.palette.primary.light
    : theme.palette.divider;

  return (
    <Box>
      <Box
        {...getRootProps()}
        sx={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 4,
          p: 8,
          cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          background: isDragActive
            ? `${theme.palette.primary.main}18`
            : "transparent",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            background: `${theme.palette.primary.main}10`,
          },
        }}
      >
        <input {...getInputProps()} />

        {loading ? (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <CircularProgress color="primary" size={52} />
            <Typography color="text.secondary">Uploading…</Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            {isDragActive ? (
              <MovieIcon sx={{ fontSize: 64, color: "primary.main" }} />
            ) : (
              <CloudUploadIcon
                sx={{ fontSize: 64, color: "text.secondary", opacity: 0.6 }}
              />
            )}
            <Typography variant="h6" fontWeight={600}>
              {isDragActive
                ? "Drop your video here"
                : "Drag & drop a video, or click to browse"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MP4 · MOV · MKV · AVI · WebM — up to 500 MB
            </Typography>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
