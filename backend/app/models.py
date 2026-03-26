from enum import Enum
from typing import Optional
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    TRANSCRIBING = "transcribing"
    RENDERING = "rendering"
    DONE = "done"
    FAILED = "failed"


STATUS_LABELS = {
    JobStatus.PENDING: "Waiting in queue...",
    JobStatus.UPLOADING: "Uploading video...",
    JobStatus.TRANSCRIBING: "Transcribing speech with AssemblyAI...",
    JobStatus.RENDERING: "Rendering animated subtitles with FFmpeg...",
    JobStatus.DONE: "Done!",
    JobStatus.FAILED: "Failed",
}


class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0          # 0-100
    label: str = STATUS_LABELS[JobStatus.PENDING]
    error: Optional[str] = None
    filename: Optional[str] = None
