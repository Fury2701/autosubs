from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.jobs import router as jobs_router

app = FastAPI(title="AutoSubs API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router)


@app.get("/healthz")
def health():
    return {"status": "ok"}
