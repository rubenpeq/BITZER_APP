# BITZER Internship Project

Design and implementation of a production logging and data analysis system.

---

## Overview

This repository contains a full-stack application developed during an internship at BITZER (Portugal). It provides a web interface for managing production records and performing runtime analysis.

* **Frontend:** React + Vite + TypeScript (production build served by Nginx)
* **Backend:** FastAPI (Uvicorn)
* **Database:** PostgreSQL
* **Container orchestration:** Docker Compose

---

## Architecture (high level)

```mermaid
flowchart LR


  Tablet["Web Browser"] --> Frontend["React + Vite (Nginx)"]


  Frontend --> Backend["FastAPI (Uvicorn)"]


  Backend --> Database["PostgreSQL"]


```

---

## Repo layout

* `backend/` — FastAPI application

  * `app/` — application code (routers, models, etc.)
  * `requirements.txt`
* `frontend/` — React + Vite app

  * `src/`, `package.json`, `vite.config.ts`
* `nginx/` — nginx configuration used to serve the frontend build
* `docker-compose.yml` — Compose file for running the full stack

---

## Prerequisites

* Node.js (v16+ recommended)
* Python (3.8+ recommended)
* Docker & Docker Compose (v2+ recommended)
* Git

---

## Quick start (developer)

1. **Clone**

```bash
git clone https://github.com/rubenpeq/BITZER_APP.git
cd BITZER_APP
```

2. **Start Postgres (via Docker Compose)**

If you only want to start the database service:

```bash
# start only the postgres service in detached mode
docker compose up -d postgres
```

3. **Run backend (development)**

```bash
cd backend/app
# create & activate virtualenv
python -m venv .venv
# on Linux/macOS:
source .venv/bin/activate
# on Windows PowerShell:
# .\.venv\Scripts\Activate.ps1

pip install -r ../requirements.txt

# run backend dev server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

* API (dev): `http://localhost:8000`

4. **Run frontend (development)**

```bash
cd frontend
npm install
npm run dev
```

* Vite dev server: `http://localhost:5173`

5. **Build frontend for production**

```bash
cd frontend
npm run build
# produced static files are in frontend/dist/
```

---

## Environment variables

Set these environment variables either in a `.env` file or in your docker-compose `environment:` section.

Create `.env` at the project root:

```
# Full connection URL used by the backend to connect to Postgres.
# Format: postgresql://<user>:<password>@<host>:<port>/<database>
DATABASE_URL=postgresql://bitzer:bitzer123@postgres:5432/orders_db


# ---------------- Backend runtime configuration ----------------
# ENV: environment mode ("production" | "development").
ENV=production


# DOCS_USER / DOCS_PASSWORD: Basic auth credentials used to protect auto-generated
# documentation (if your app conditionally enables docs behind auth).
DOCS_USER= <user>
DOCS_PASSWORD= <password>


# ALLOWED_ORIGINS: CORS allow list. Use `*` for all origins;
# prefer a JSON array or comma-separated list of allowed origins.
ALLOWED_ORIGINS=*


# ENABLE_DOCS: enable/disable serving interactive API docs (true/false).
# In production you may want this set to false.
ENABLE_DOCS=false


# ---------------- Frontend (Vite) variables ----------------
# VITE_FASTAPI_URL: base path or URL the frontend uses to call the backend API.
# In your Docker setup this is set to `/api` because nginx proxies /api to the backend.
# For local development it can be set to `http://localhost:8000`.
VITE_FASTAPI_URL=/api
```

## Deploying (Docker Compose - full stack)

From project root build & start the whole stack:

### Generate certs (`bitzer.crt` and `bitzer.key`)

Run these commands **from the project root**.

1. Create certs directory:
```bash
mkdir -p nginx/certs

After setting up `.env` and certs:
```

2. Generate cert and key:
```bash
mkcert -cert-file nginx/certs/bitzer.crt -key-file nginx/certs/bitzer.key localhost 127.0.0.1 ::1
```

3. Set permissions so nginx can read them:
```
chmod 644 nginx/certs/bitzer.crt nginx/certs/bitzer.key
```

```bash
# build images and start containers (foreground)
docker compose up --build

# or detached
docker compose up --build -d
```

Stop & remove:

```bash
docker compose down
```
