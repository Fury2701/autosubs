"""
File-based job store — persists job state as JSON on the PVC.
Each job lives at  {STORAGE_DIR}/{job_id}/job.json
Survives pod restarts.
"""
import json
from pathlib import Path
from app.models import Job
from app.config import STORAGE_DIR


def _path(job_id: str) -> Path:
    return STORAGE_DIR / job_id / "job.json"


def save(job: Job) -> None:
    _path(job.id).write_text(job.model_dump_json(), encoding="utf-8")


def load(job_id: str) -> Job | None:
    p = _path(job_id)
    if not p.exists():
        return None
    try:
        return Job.model_validate_json(p.read_text(encoding="utf-8"))
    except Exception:
        return None
