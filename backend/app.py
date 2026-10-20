import os
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

load_dotenv()

from auth import get_current_user

# Import routers
from routes import upload, analyze, preprocess, train, predict, visualize, pipeline
from routes import runs, code, admin, account
from utils.logger import stream_logs, log_event

app = FastAPI(title="FlowML Backend")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "https://flowml-host.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(upload.router,     prefix="/api", tags=["Upload"])
app.include_router(analyze.router,    prefix="/api", tags=["Analyze"])
app.include_router(preprocess.router, prefix="/api", tags=["Preprocess"])
app.include_router(train.router,      prefix="/api", tags=["Train"])
app.include_router(predict.router,    prefix="/api", tags=["Predict"])
app.include_router(visualize.router,  prefix="/api", tags=["Visualize"])
app.include_router(pipeline.router,   prefix="/api", tags=["Pipeline"])
app.include_router(runs.router,       prefix="/api", tags=["Runs"])
app.include_router(code.router,       prefix="/api", tags=["Code Execution"])
app.include_router(admin.router,      prefix="/api", tags=["Admin Governance"])
app.include_router(account.router,    prefix="/api", tags=["Account Governance"])


@app.exception_handler(Exception)
async def secure_exception_handler(request: Request, exc: Exception):
    """
    Prevents leaking internal stack traces and server paths to clients.
    Logs full exception on server; returns sanitized message to client.
    """
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
    log_event(f"Internal error on {request.method} {request.url.path}: {str(exc)}", level="ERROR")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again later or contact support."},
    )


@app.get("/api/health")
async def health_check():
    return {"status": "running"}


@app.get("/api/logs")
async def get_logs(uid: str = Depends(get_current_user)):
    """Real-time console logs streaming via Server-Sent Events."""
    return EventSourceResponse(stream_logs(uid))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
