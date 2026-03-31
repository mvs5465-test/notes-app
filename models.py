import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("NOTES_DB_PATH", BASE_DIR / "notes.db"))


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def note_title(body):
    first_line = body.splitlines()[0].strip() if body.strip() else ""
    return first_line or "Untitled"


def serialize_note(row):
    body = row["body"] or ""
    return {
        "id": row["id"],
        "title": row["title"] or note_title(body),
        "body": body,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def init_db():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT GENERATED ALWAYS AS (
                    CASE
                        WHEN trim(body) = '' THEN 'Untitled'
                        WHEN instr(body, char(10)) = 0 THEN trim(body)
                        ELSE trim(substr(body, 1, instr(body, char(10)) - 1))
                    END
                ) VIRTUAL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def list_notes():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, body, created_at, updated_at
            FROM notes
            ORDER BY updated_at DESC, id DESC
            """
        ).fetchall()
    return [serialize_note(row) for row in rows]


def get_note(note_id):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, body, created_at, updated_at
            FROM notes
            WHERE id = ?
            """,
            (note_id,),
        ).fetchone()
    return serialize_note(row) if row else None


def create_note(body):
    timestamp = current_timestamp()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO notes (body, created_at, updated_at)
            VALUES (?, ?, ?)
            """,
            (body, timestamp, timestamp),
        )
        note_id = cursor.lastrowid
    return get_note(note_id)


def update_note(note_id, body):
    timestamp = current_timestamp()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notes
            SET body = ?, updated_at = ?
            WHERE id = ?
            """,
            (body, timestamp, note_id),
        )
    if cursor.rowcount == 0:
        return None
    return get_note(note_id)


def delete_note(note_id):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            DELETE FROM notes
            WHERE id = ?
            """,
            (note_id,),
        )
    return cursor.rowcount > 0


def current_timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
