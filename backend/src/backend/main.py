from os import getenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="WinDesktop Webskin API", version="0.1.0")

frontend_origins = [
    origin.strip()
    for origin in getenv("FRONTEND_ORIGINS", "http://localhost:4321,http://127.0.0.1:4321").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "backend"}


@app.get("/api/status")
def status() -> dict[str, str]:
    return {"message": "Frontend and backend are connected."}
