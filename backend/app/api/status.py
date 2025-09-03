from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import time

from db.database import SessionLocal

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/status", tags=["Status"], summary="Backend + Database status")
def status(db: Session = Depends(get_db)):
    """
    Returns a simple status object describing backend and DB health.

    Response JSON structure:
    {
      "backend": "ok",
      "uptime_seconds": 12345,
      "database": {
        "status": "ok" | "failed",
        "details": "optional string (db version or error)"
      }
    }
    """
    # backend is running if this handler executes
    backend_state = "ok"
    uptime_seconds: Optional[float] = None

    # optional simple uptime (you can replace with app start time if available)
    try:
        uptime_seconds = time.time()  # placeholder (client doesn't need exact uptime)
    except Exception:
        uptime_seconds = None

    # test DB connectivity with a very small query
    db_ok = False
    db_details: Optional[str] = None
    try:
        # simple SELECT 1 to check connectivity
        db.execute(text("SELECT 1"))
        # try to get a version string (Postgres)
        try:
            row = db.execute(text("SELECT version()")).fetchone()
            if row:
                db_details = str(row[0])
        except Exception:
            # if version() fails for any reason, ignore — connectivity is the main check
            db_details = None
        db_ok = True
    except Exception as e:
        db_ok = False
        db_details = str(e)

    return {
        "backend": backend_state,
        "uptime_seconds": uptime_seconds,
        "database": {
            "status": "ok" if db_ok else "failed",
            "details": db_details,
        },
    }
