FROM python:3.12-slim

# Install FFmpeg + libass (needed to burn ASS subtitles)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libass9 \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fontconfig \
    wget \
    && mkdir -p /usr/local/share/fonts/barlow \
    && wget -q "https://github.com/google/fonts/raw/main/ofl/barlowcondensed/BarlowCondensed-ExtraBold.ttf" \
       -O /usr/local/share/fonts/barlow/BarlowCondensed-ExtraBold.ttf \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
