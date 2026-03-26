import asyncio
from typing import List, Dict, Optional
import assemblyai as aai
from app.config import ASSEMBLYAI_API_KEY


def _transcribe_sync(file_path: str, language: Optional[str]) -> List[Dict]:
    aai.settings.api_key = ASSEMBLYAI_API_KEY

    if language and language != "auto":
        config = aai.TranscriptionConfig(
            language_code=language,
            punctuate=True,
            format_text=True,
        )
    else:
        config = aai.TranscriptionConfig(
            language_detection=True,
            punctuate=True,
            format_text=True,
        )

    transcriber = aai.Transcriber()
    transcript = transcriber.transcribe(file_path, config=config)

    if transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"AssemblyAI error: {transcript.error}")

    return [
        {"text": w.text, "start": w.start / 1000.0, "end": w.end / 1000.0}
        for w in transcript.words
    ]


async def transcribe(file_path: str, language: Optional[str] = None) -> List[Dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, file_path, language)
