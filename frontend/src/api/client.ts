const BASE = "/api";

export interface JobSettings {
  language: string;   // "auto" | "en" | "uk" | ...
  animation: string;  // "karaoke" | "pop" | "fade"
  color: string;      // "#RRGGBB"
}

export interface JobResponse {
  id: string;
  status: "pending" | "uploading" | "transcribing" | "rendering" | "done" | "failed";
  progress: number;
  label: string;
  error?: string;
  filename?: string;
}

export async function createJob(
  file: File,
  settings: JobSettings,
): Promise<{ job_id: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", settings.language === "auto" ? "" : settings.language);
  form.append("animation", settings.animation);
  form.append("color", settings.color);

  const res = await fetch(`${BASE}/jobs`, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function pollJob(jobId: string): Promise<JobResponse> {
  const res = await fetch(`${BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Poll failed (${res.status})`);
  return res.json();
}

export function downloadUrl(jobId: string): string {
  return `${BASE}/jobs/${jobId}/download`;
}
