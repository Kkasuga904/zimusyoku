<<<<<<< HEAD
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV API_DATA_DIR=/app/data

EXPOSE 9000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
=======
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

ENV PYTHONPATH=/app \
    CELERY_IMPORTS=services.ocr.worker

EXPOSE 8000

CMD ["uvicorn", "services.api.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
>>>>>>> 5501a9a (feat(auth): improve local dev login defaults)
