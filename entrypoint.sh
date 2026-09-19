#!/usr/bin/env bash
set -e

if [ "$APP_MODE" = "api" ]; then
    echo "[entrypoint] Iniciando FastAPI en modo REST..."
    exec uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT:-8000}"
else
    echo "[entrypoint] Iniciando interfaz Streamlit..."
    exec streamlit run app/ui/streamlit_app.py \
        --server.port="${STREAMLIT_PORT:-8501}" \
        --server.address=0.0.0.0 \
        --server.headless=true
fi
