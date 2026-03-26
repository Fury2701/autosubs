import asyncio
from typing import List, Dict
import assemblyai as aai
from app.config import ASSEMBLYAI_API_KEY


def _transcribe_sync(file_path: str) -> List[Dict]:
    aai.settings.api_key = ASSEMBLYAI_API_KEY

    transcriber = aai.Transcriber()
    config = aai.TranscriptionConfig(
        speech_model=aai.SpeechModel.best,
        language_detection=True,
        punctuate=True,
        format_text=True,
    )

    transcript = transcriber.transcribe(file_path, config=config)

    if transcript.status == aai.TranscriptStatus.error:
        raise RuntimeError(f"AssemblyAI error: {transcript.error}")

    words = []
    for w in transcript.words:
        words.append({
            "text": w.text,
            "start": w.start / 1000.0,   # ms → seconds
            "end": w.end / 1000.0,
        })

    return words


async def transcribe(file_path: str) -> List[Dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _transcribe_sync, file_path)
