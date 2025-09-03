import os
import logging
import secrets
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html

# routers
from api import orders, status

# database imports
from db.database import engine
from db.models import Base as ModelsBase

# Create tables
ModelsBase.metadata.create_all(bind=engine)

# Environment
ENV = os.getenv("ENV", "development").lower()
DOCS_USER = os.getenv("DOCS_USER")
DOCS_PASSWORD = os.getenv("DOCS_PASSWORD")
ENABLE_DOCS_IN_DEV = os.getenv("ENABLE_DOCS", "true").lower() == "true"

# App created with docs disabled by default; we'll mount protected docs routes manually
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

# CORS config: set ALLOWED_ORIGINS comma-separated in env or default to localhost in dev
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    origins = ["http://localhost:3000"] if ENV != "production" else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Docs protection logic ---
security = HTTPBasic()

def docs_protection_enabled() -> bool:
    """Return True if docs should be protected by basic auth (i.e. credentials provided)."""
    return bool(DOCS_USER and DOCS_PASSWORD)

def allow_docs_unprotected() -> bool:
    """Return True if docs should be available without auth (development convenience)."""
    if ENV != "production":
        # in non-production allow docs by default (can be toggled via ENABLE_DOCS env)
        return ENABLE_DOCS_IN_DEV
    # in production we only allow docs when credentials are provided (and then they are protected)
    return False

async def require_docs_auth(credentials: HTTPBasicCredentials = Depends(security)):
    """
    If credentials are configured (DOCS_USER/DOCS_PASSWORD), enforce HTTP Basic auth.
    Otherwise, if in dev and docs allowed, no auth is required.
    """
    # If docs are allowed unprotected (dev), skip auth
    if allow_docs_unprotected() and not docs_protection_enabled():
        return True

    # If doc protection is explicitly enabled (credentials present), validate them
    if docs_protection_enabled():
        correct_user = secrets.compare_digest(credentials.username, DOCS_USER)
        correct_pass = secrets.compare_digest(credentials.password, DOCS_PASSWORD)
        if not (correct_user and correct_pass):
            # Inform browser to prompt for credentials
            raise HTTPException(
                status_code=401,
                detail="Unauthorized",
                headers={"WWW-Authenticate": "Basic"},
            )
        return True

    # Docs are disabled in production (no credentials provided)
    raise HTTPException(status_code=404, detail="Not Found")

# --- Custom docs routes (protected) ---
# note: include_in_schema=False so these routes don't show up in other docs
@app.get("/docs", include_in_schema=False)
async def swagger_ui_secure(_=Depends(require_docs_auth)):
    """
    Serve Swagger UI. Access will be controlled by require_docs_auth.
    """
    # Swagger UI will fetch /openapi.json (we also protect that route)
    return get_swagger_ui_html(openapi_url="/openapi.json", title="API Docs")

@app.get("/openapi.json", include_in_schema=False)
async def openapi_secure(_=Depends(require_docs_auth)):
    """
    Serve the OpenAPI JSON (also protected).
    """
    return JSONResponse(app.openapi())

@app.get("/redoc", include_in_schema=False)
async def redoc_secure(_=Depends(require_docs_auth)):
    """
    Serve ReDoc (also protected).
    """
    return get_redoc_html(openapi_url="/openapi.json", title="ReDoc")

app.include_router(orders.router, prefix="/api")
app.include_router(status.router, prefix="/api")

# Public health endpoint (no auth)
@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "env": ENV}
