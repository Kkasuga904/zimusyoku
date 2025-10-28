FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        tesseract-ocr-jpn \
        libtesseract-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV PYTHONPATH=/app \
    CELERY_IMPORTS=services.ocr.worker

EXPOSE 8000

CMD ["uvicorn", "services.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
