# notes-app

Minimal Flask notes app with:

- server-rendered UI plus a small REST API
- SQLite storage via `sqlite3`
- no ORM
- a Helm chart for local cluster deployment

## Run locally

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/gunicorn --bind 127.0.0.1:8000 app:app
```

## Docker

The container stores SQLite data at `/data/notes.db`.

## Chart

The Helm chart lives in `chart/` and defaults to:

- `notes.lan`
- `local-path` storage
- `1Gi` PVC mounted at `/data`
