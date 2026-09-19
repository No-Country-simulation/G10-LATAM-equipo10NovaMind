# Imagen liviana, compatible con VM Ampere A1 (ARM) y x86 (build multi-arch con buildx)
FROM python:3.11-slim

# Dependencias de sistema necesarias para pypdf / sentence-transformers / chromadb
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero para aprovechar cache de capas de Docker
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copiar el código de la aplicación
COPY app ./app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Directorios de datos persistentes (montados como volumen en docker-compose)
RUN mkdir -p /app/data/chroma /app/data/documents

EXPOSE 8501 8000

# APP_MODE controla si se levanta Streamlit (default) o la API FastAPI
ENV APP_MODE=streamlit \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:${STREAMLIT_PORT:-8501}/_stcore/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
