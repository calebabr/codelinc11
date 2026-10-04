# Backend container for the Dental Benefits API (FastAPI).
# Builds the demo SQLite database on first start, then serves the API.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies first (better layer caching).
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the backend app and the database seeds/migrations it reads at runtime.
COPY backend ./backend
COPY database ./database

# Persistent data (SQLite file) lives here; mount a volume at this path in prod
# so the demo database and any saved data survive restarts.
ENV BENEFITS_DB_PATH=/data/benefits.db

WORKDIR /app/backend

# Seed the database if missing, then start the API on the platform's $PORT.
# (Render/Railway/Fly all inject $PORT; default to 8000 for local docker runs.)
CMD ["sh", "-c", "mkdir -p /data && python -m app.db && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
