import json
from pathlib import Path
from datetime import datetime, timezone

import aiosqlite

DB_PATH = Path("data/rpg.db")


async def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                level INTEGER NOT NULL DEFAULT 1,
                class_name TEXT NOT NULL DEFAULT '',
                data TEXT NOT NULL,
                archived INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def list_characters() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, level, class_name, created_at, updated_at "
            "FROM characters WHERE archived = 0 ORDER BY updated_at DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


async def get_character(char_id: str) -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT data FROM characters WHERE id = ?", (char_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            return json.loads(row["data"])


async def save_character(char_data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    char_data = dict(char_data)
    char_data["updated_at"] = now
    data_json = json.dumps(char_data, ensure_ascii=False)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO characters (id, name, level, class_name, data, archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                level = excluded.level,
                class_name = excluded.class_name,
                data = excluded.data,
                updated_at = excluded.updated_at
        """, (
            char_data["id"],
            char_data.get("name", "Personagem"),
            int(char_data.get("level", 1)),
            char_data.get("class_name", ""),
            data_json,
            now,
            now,
        ))
        await db.commit()

    return char_data


async def create_character(name: str) -> dict:
    from backend.rules import create_default_character
    char = create_default_character(name)
    return await save_character(char)


async def archive_character(char_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE characters SET archived = 1 WHERE id = ?", (char_id,))
        await db.commit()
