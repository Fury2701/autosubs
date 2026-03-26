import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Box, Typography, useTheme, Chip, IconButton } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import MovieIcon from "@mui/icons-material/Movie";
import CloseIcon from "@mui/icons-material/Close";

interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
}

const ACCEPTED = {
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/x-matroska": [".mkv"],
  "video/avi": [".avi"],
  "video/webm": [".webm"],
  "video/x-m4v": [".m4v"],
};

function formatSize(bytes: number) {
  if (bytes > 1024 * 1024 * 1024)
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + " GB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function UploadZone({ file, onFile }: Props) {
  const theme = useTheme();

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
  });

  const borderColor = isDragReject
    ? theme.palette.error.main
    : isDragActive
    ? theme.palette.primary.light
    : file
    ? theme.palette.primary.main
    : theme.palette.divider;

  return (
    <Box>
      <Box
        {...getRootProps()}
        sx={{
          border: `2px dashed ${borderColor}`,
          borderRadius: 3,
          p: file ? 3 : 6,
          cursor: "pointer",
          transition: "all 0.2s ease",
          background: isDragActive
            ? `${theme.palette.primary.main}18`
            : file
            ? `${theme.palette.primary.main}10`
            : "transparent",
          "&:hover": {
            borderColor: theme.palette.primary.main,
            background: `${theme.palette.primary.main}10`,
          },
        }}
      >
        <input {...getInputProps()} />

        {file ? (
          <Box display="flex" alignItems="center" gap={2}>
            <MovieIcon sx={{ color: "primary.main", fontSize: 36 }} />
            <Box flex={1} textAlign="left">
              <Typography fontWeight={600} noWrap>
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSize(file.size)}
              </Typography>
            </Box>
            <Chip label="змінити" size="small" variant="outlined" />
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            {isDragActive ? (
              <MovieIcon sx={{ fontSize: 56, color: "primary.main" }} />
            ) : (
              <Box sx={{ fontSize: 56 }}>🎬</Box>
            )}
            <Typography variant="h6" fontWeight={600}>
              {isDragActive
                ? "Кидай відео сюди"
                : "Кинь відео сюди"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              або натисни щоб вибрати файл — MP4, MOV, AVI, MKV до 500MB
            </Typography>
          </Box>
        )}
      </Box>

      {/* Clear button outside drop zone */}
      {file && (
        <Box display="flex" justifyContent="flex-end" mt={0.5}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onFile(null); }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
