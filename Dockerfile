FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV NOTES_DB_PATH=/data/notes.db

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py models.py ./
COPY templates ./templates
COPY static ./static

RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4", "--timeout", "60", "app:app"]
