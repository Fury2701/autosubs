import glob
import json
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Form, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.config import STORAGE_DIR, MAX_UPLOAD_MB
from app.models import Job, JobStatus, STATUS_LABELS, SubtitleData
from app.services.assemblyai import transcribe
from app.services.subtitle import create_ass, create_ass_from_data
import app.store as store

router = APIRouter(prefix="/api/jobs")

VALID_ANIMATIONS = {"pop", "karaoke", "fade", "typewriter", "slide_up", "bounce", "glow", "zoom_in", "spin", "drop_in", "cinema", "flip", "glitch"}
VALID_EFFECTS = {"glow", "shake", "shadow", "outline"}


def _set(job: Job, status: JobStatus, progress: int) -> None:
    job.status = status
    job.progress = progress
    job.label = STATUS_LABELS[status]
    store.save(job)


def _get_or_404(job_id: str) -> Job:
    job = store.load(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


def _chunks_path(job_id: str) -> Path:
    return STORAGE_DIR / job_id / "chunks.json"


def _wordmap_path(job_id: str) -> Path:
    return STORAGE_DIR / job_id / "wordmap.json"


def _input_path(job_id: str) -> Optional[Path]:
    matches = glob.glob(str(STORAGE_DIR / job_id / "input.*"))
    return Path(matches[0]) if matches else None


def _run_ffmpeg(
    inp: Path, ass: Path, out: Path,
    trim_start: float = 0.0,
    trim_end: Optional[float] = None,
) -> None:
    ass_esc = str(ass).replace("\\", "/").replace(":", "\\:")
    cmd = ["ffmpeg", "-y"]
    if trim_start > 0:
        cmd += ["-ss", str(trim_start)]
    cmd += ["-i", str(inp)]
    if trim_end is not None:
        cmd += ["-t", str(trim_end - trim_start)]
    cmd += [
        "-vf", f"ass={ass_esc}",
        "-c:v", "libx264", "-preset", "fast", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        str(out),
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.decode(errors="replace")[-2000:])


# ──────────────────────────────────────────────────────────────────────────────
# Background worker
# ──────────────────────────────────────────────────────────────────────────────

async def _process(
    job_id: str, inp: Path, job_dir: Path,
    language: Optional[str], animation: str,
    color: str, color2: Optional[str],
    effect: Optional[str] = None,
) -> None:
    job = _get_or_404(job_id)
    try:
        _set(job, JobStatus.TRANSCRIBING, 20)
        words = await transcribe(str(inp), language)

        _set(job, JobStatus.RENDERING, 55)
        ass = job_dir / "subtitles.ass"
        subtitle_data, word_map = create_ass(
            words, str(ass), animation=animation, color=color, color2=color2
        )

        if effect:
            subtitle_data.global_effect = effect

        _chunks_path(job_id).write_text(
            subtitle_data.model_dump_json(indent=2), encoding="utf-8"
        )
        _wordmap_path(job_id).write_text(
            json.dumps(word_map, ensure_ascii=False), encoding="utf-8"
        )

        _run_ffmpeg(inp, ass, job_dir / "output.mp4")
        _set(job, JobStatus.DONE, 100)

    except Exception as exc:
        job = _get_or_404(job_id)
        job.status = JobStatus.FAILED
        job.label  = STATUS_LABELS[JobStatus.FAILED]
        job.error  = str(exc)
        store.save(job)


async def _do_rerender(job_id: str, inp: Path, data: SubtitleData) -> None:
    job = _get_or_404(job_id)
    job_dir = STORAGE_DIR / job_id
    try:
        _set(job, JobStatus.RENDERING, 55)

        wmap: Dict[int, List] = {}
        wp = _wordmap_path(job_id)
        if wp.exists():
            raw = json.loads(wp.read_text(encoding="utf-8"))
            wmap = {int(k): v for k, v in raw.items()}

        # Shift subtitle timestamps when trimming
        import copy
        render_data = copy.deepcopy(data)
        if render_data.trim_start > 0:
            for chunk in render_data.chunks:
                chunk.start = max(0.0, chunk.start - render_data.trim_start)
                chunk.end   = max(0.0, chunk.end   - render_data.trim_start)
            render_data.chunks = [c for c in render_data.chunks if c.end > 0]

        ass = job_dir / "subtitles.ass"
        create_ass_from_data(render_data, str(ass), word_map=wmap)

        _chunks_path(job_id).write_text(data.model_dump_json(indent=2), encoding="utf-8")

        _run_ffmpeg(inp, ass, job_dir / "output.mp4",
                    trim_start=data.trim_start, trim_end=data.trim_end)
        _set(job, JobStatus.DONE, 100)

    except Exception as exc:
        job = _get_or_404(job_id)
        job.status = JobStatus.FAILED
        job.label  = STATUS_LABELS[JobStatus.FAILED]
        job.error  = str(exc)
        store.save(job)


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=202)
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    animation: str = Form("pop"),
    color: str = Form("#FFFFFF"),
    color2: Optional[str] = Form(None),
    effect: Optional[str] = Form(None),
):
    suffix = Path(file.filename).suffix.lower() if file.filename else ".mp4"
    if suffix not in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}:
        raise HTTPException(400, "Unsupported video format")
    if animation not in VALID_ANIMATIONS:
        animation = "pop"
    if not color.startswith("#") or len(color) != 7:
        color = "#FFFFFF"
    if color2 and (not color2.startswith("#") or len(color2) != 7):
        color2 = None
    if effect and effect not in VALID_EFFECTS:
        effect = None

    job_id  = str(uuid.uuid4())
    job_dir = STORAGE_DIR / job_id
    job_dir.mkdir(parents=True)

    inp   = job_dir / f"input{suffix}"
    limit = MAX_UPLOAD_MB * 1024 * 1024
    total = 0
    with open(inp, "wb") as fh:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > limit:
                shutil.rmtree(job_dir, ignore_errors=True)
                raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB")
            fh.write(chunk)

    job = Job(id=job_id, filename=file.filename)
    _set(job, JobStatus.PENDING, 5)
    background_tasks.add_task(_process, job_id, inp, job_dir, language, animation, color, color2, effect)
    return {"job_id": job_id}


@router.get("/{job_id}")
async def get_job(job_id: str):
    return _get_or_404(job_id)


@router.get("/{job_id}/subtitles")
async def get_subtitles(job_id: str):
    _get_or_404(job_id)
    p = _chunks_path(job_id)
    if not p.exists():
        raise HTTPException(404, "Subtitles not ready")
    return SubtitleData.model_validate_json(p.read_text(encoding="utf-8"))


@router.post("/{job_id}/rerender", status_code=202)
async def rerender(
    job_id: str,
    background_tasks: BackgroundTasks,
    data: SubtitleData = Body(...),
):
    job = _get_or_404(job_id)
    if job.status not in (JobStatus.DONE, JobStatus.FAILED):
        raise HTTPException(400, "Job must be done before re-rendering")
    inp = _input_path(job_id)
    if not inp:
        raise HTTPException(500, "Original video not found")
    background_tasks.add_task(_do_rerender, job_id, inp, data)
    return {"job_id": job_id}


@router.get("/{job_id}/preview")
async def preview_video(job_id: str):
    """Stream the original (unprocessed) video for the editor preview."""
    _get_or_404(job_id)
    inp = _input_path(job_id)
    if not inp:
        raise HTTPException(404, "Original video not found")
    mt = {".mp4": "video/mp4", ".mov": "video/quicktime",
          ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
          ".m4v": "video/mp4", ".webm": "video/webm"}.get(inp.suffix.lower(), "video/mp4")
    return FileResponse(str(inp), media_type=mt)


@router.get("/{job_id}/download")
async def download_result(job_id: str):
    job = _get_or_404(job_id)
    if job.status != JobStatus.DONE:
        raise HTTPException(400, "Job not finished yet")
    out = STORAGE_DIR / job_id / "output.mp4"
    if not out.exists():
        raise HTTPException(500, "Output file missing")
    return FileResponse(
        str(out), media_type="video/mp4",
        filename=f"subtitled_{job.filename or 'video.mp4'}",
    )
