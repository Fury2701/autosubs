import React, { useState } from "react";
import {
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import theme from "./theme";
import UploadZone from "./components/UploadZone";
import JobTracker from "./components/JobTracker";

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        minHeight="100vh"
        sx={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, #7C5CFC22 0%, transparent 70%)",
        }}
      >
        <Container maxWidth="sm">
          <Box py={10} textAlign="center">
            {/* Header */}
            <Box display="flex" justifyContent="center" alignItems="center" gap={1.5} mb={2}>
              <AutoAwesomeIcon sx={{ color: "primary.main", fontSize: 36 }} />
              <Typography
                variant="h3"
                fontWeight={800}
                sx={{
                  background: "linear-gradient(135deg, #9D80FF 0%, #00E5FF 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AutoSubs
              </Typography>
            </Box>

            <Typography variant="body1" color="text.secondary" mb={1}>
              Drop a video — get animated karaoke subtitles in seconds.
            </Typography>

            <Box display="flex" justifyContent="center" gap={1} mb={6}>
              {["AssemblyAI", "FFmpeg", "ASS karaoke"].map((t) => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ opacity: 0.6 }} />
              ))}
            </Box>

            {/* Main panel */}
            {jobId ? (
              <JobTracker jobId={jobId} onReset={() => setJobId(null)} />
            ) : (
              <UploadZone onJobCreated={setJobId} />
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
