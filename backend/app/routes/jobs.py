import asyncio
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.config import STORAGE_DIR, MAX_UPLOAD_MB
from app.models import Job, JobStatus, STATUS_LABELS
from app.services.assemblyai import transcribe
from app.services.subtitle import create_ass

router = APIRouter(prefix="/api/jobs")

# In-memory job store (single replica; add Redis for horizontal scaling)
_jobs: Dict[str, Job] = {}


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _set(job: Job, status: JobStatus, progress: int) -> None:
    job.status = status
    job.progress = progress
    job.label = STATUS_LABELS[status]


def _get_job_or_404(job_id: str) -> Job:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ──────────────────────────────────────────────────────────────────────────────
# Background worker
# ──────────────────────────────────────────────────────────────────────────────

async def _process(job_id: str, input_path: Path, job_dir: Path) -> None:
    job = _jobs[job_id]
    try:
        # ── 1. Transcribe ─────────────────────────────────────────────────────
        _set(job, JobStatus.TRANSCRIBING, 20)
        words = await transcribe(str(input_path))

        # ── 2. Generate ASS ───────────────────────────────────────────────────
        _set(job, JobStatus.RENDERING, 55)
        ass_path = job_dir / "subtitles.ass"
        create_ass(words, str(ass_path))

        # ── 3. FFmpeg burn-in ─────────────────────────────────────────────────
        output_path = job_dir / "output.mp4"
        # Escape Windows-style backslashes / colons for libass path filter
        ass_escaped = str(ass_path).replace("\\", "/").replace(":", "\\:")
        cmd = [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-vf", f"ass={ass_escaped}",
            "-c:v", "libx264", "-preset", "fast", "-crf", "20",
            "-c:a", "aac", "-b:a", "192k",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.decode(errors="replace")[-2000:])

        _set(job, JobStatus.DONE, 100)

    except Exception as exc:
        job.status = JobStatus.FAILED
        job.label = STATUS_LABELS[JobStatus.FAILED]
        job.error = str(exc)


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=202)
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    suffix = Path(file.filename).suffix.lower() if file.filename else ".mp4"
    if suffix not in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}:
        raise HTTPException(status_code=400, detail="Unsupported video format")

    job_id = str(uuid.uuid4())
    job_dir = STORAGE_DIR / job_id
    job_dir.mkdir(parents=True)

    input_path = job_dir / f"input{suffix}"

    # Stream to disk
    chunk_size = 1024 * 1024  # 1 MB
    total = 0
    limit = MAX_UPLOAD_MB * 1024 * 1024
    with open(input_path, "wb") as fh:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                fh.close()
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit")
            fh.write(chunk)

    job = Job(id=job_id, filename=file.filename)
    _set(job, JobStatus.PENDING, 5)
    _jobs[job_id] = job

    background_tasks.add_task(_process, job_id, input_path, job_dir)

    return {"job_id": job_id}


@router.get("/{job_id}")
async def get_job(job_id: str):
    return _get_job_or_404(job_id)


@router.get("/{job_id}/download")
async def download_result(job_id: str):
    job = _get_job_or_404(job_id)
    if job.status != JobStatus.DONE:
        raise HTTPException(400, "Job not finished yet")

    output_path = STORAGE_DIR / job_id / "output.mp4"
    if not output_path.exists():
        raise HTTPException(500, "Output file missing")

    return FileResponse(
        path=str(output_path),
        media_type="video/mp4",
        filename=f"subtitled_{job.filename or 'video.mp4'}",
    )
