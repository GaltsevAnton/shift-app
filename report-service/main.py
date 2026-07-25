from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import shift, attendance

app = FastAPI(title="HannoSHIFT Report Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  # только Spring Boot
    allow_methods=["POST"],
    allow_headers=["*"],
)

app.include_router(shift.router, prefix="/generate")
app.include_router(attendance.router, prefix="/generate/attendance")


@app.get("/health")
def health():
    return {"status": "ok"}