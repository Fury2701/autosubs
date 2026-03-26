import React, { useState } from "react";
import {
  ThemeProvider,
  CssBaseline,
  Container,
  Box,
  Typography,
  Button,
  Alert,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BoltIcon from "@mui/icons-material/Bolt";
import theme from "./theme";
import UploadZone from "./components/UploadZone";
import SettingsPanel from "./components/SettingsPanel";
import JobTracker from "./components/JobTracker";
import { createJob, JobSettings } from "./api/client";

const DEFAULT_SETTINGS: JobSettings = {
  language: "auto",
  animation: "pop",
  color: "#FFFFFF",
  color2: null,
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<JobSettings>(DEFAULT_SETTINGS);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { job_id } = await createJob(file, settings);
      setJobId(job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJobId(null);
    setFile(null);
    setError(null);
    setSettings(DEFAULT_SETTINGS);
  };

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
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              gap={1.5}
              mb={1.5}
            >
              <AutoAwesomeIcon sx={{ color: "primary.main", fontSize: 34 }} />
              <Typography
                variant="h3"
                fontWeight={800}
                sx={{
                  background:
                    "linear-gradient(135deg, #9D80FF 0%, #00E5FF 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AutoSubs
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" mb={6}>
              Анімовані субтитри для твого відео за секунди
            </Typography>

            {/* ── Job view ───────────────────────────────────────────────── */}
            {jobId ? (
              <JobTracker jobId={jobId} onReset={handleReset} />
            ) : (
              /* ── Upload + settings view ─────────────────────────────── */
              <Box display="flex" flexDirection="column" gap={2.5}>
                <UploadZone file={file} onFile={setFile} />

                {file && (
                  <>
                    <SettingsPanel settings={settings} onChange={setSettings} />

                    {error && <Alert severity="error">{error}</Alert>}

                    <Button
                      variant="contained"
                      size="large"
                      disabled={loading}
                      onClick={handleGenerate}
                      startIcon={<BoltIcon />}
                      sx={{
                        py: 1.8,
                        fontSize: "1rem",
                        fontWeight: 700,
                        letterSpacing: 1,
                        background:
                          "linear-gradient(135deg, #7C5CFC 0%, #00C9FF 100%)",
                        "&:hover": {
                          background:
                            "linear-gradient(135deg, #9D80FF 0%, #00E5FF 100%)",
                        },
                        boxShadow: "0 4px 24px #7C5CFC44",
                      }}
                    >
                      {loading ? "Завантаження…" : "⚡ ГЕНЕРУВАТИ СУБТИТРИ"}
                    </Button>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
