from enum import Enum
from typing import Optional, List
from pydantic import BaseModel


class JobStatus(str, Enum):
    PENDING      = "pending"
    UPLOADING    = "uploading"
    TRANSCRIBING = "transcribing"
    RENDERING    = "rendering"
    DONE         = "done"
    FAILED       = "failed"


STATUS_LABELS = {
    JobStatus.PENDING:      "Waiting in queue...",
    JobStatus.UPLOADING:    "Uploading video...",
    JobStatus.TRANSCRIBING: "Transcribing speech with AssemblyAI...",
    JobStatus.RENDERING:    "Rendering animated subtitles with FFmpeg...",
    JobStatus.DONE:         "Done!",
    JobStatus.FAILED:       "Failed",
}


class Job(BaseModel):
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    label: str = STATUS_LABELS[JobStatus.PENDING]
    error: Optional[str] = None
    filename: Optional[str] = None


class SubtitleChunk(BaseModel):
    id: int
    text: str
    start: float
    end: float
    animation: Optional[str] = None   # None → global
    color: Optional[str] = None       # None → global
    color2: Optional[str] = None      # None → global (gradient end)
    effect: Optional[str] = None      # None → global


class SubtitleData(BaseModel):
    chunks: List[SubtitleChunk]
    color: str = "#FFFFFF"
    color2: Optional[str] = None
    global_animation: str = "pop"
    global_effect: Optional[str] = None
    trim_start: float = 0.0           # seconds; 0 = no trim
    trim_end: Optional[float] = None  # None = no trim
    sub_x: float = 50.0   # % of PlayResX (horizontal center)
    sub_y: float = 87.5   # % of PlayResY (default: near bottom)
