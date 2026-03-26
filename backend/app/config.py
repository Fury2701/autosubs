import os
from pathlib import Path

ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")
STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", "/data/autosubs"))
MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "500"))

STORAGE_DIR.mkdir(parents=True, exist_ok=True)
