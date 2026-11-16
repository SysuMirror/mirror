#!/usr/bin/env python3
"""发布者补充说明：持久化 + 与 HTTP 无关的语义层。

只有一份实现，被两处复用：
- 生产后端 server.py → /mirror-api/notes/*（会话鉴权 + 主站帖子归属核实）
- 本地试玩包 server.py → 同一路径（演示账号 + 本地假数据）

dev 网关不实现任何批注逻辑：/mirror-api/* 会被反代到真正的后端。
身份与帖子归属由各端注入，本模块只负责「谁能写、写什么、存哪里」。
"""

import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

try:  # 作为 contracts 包导入（生产后端）
    from .note_rules import (
        MAX_LENGTH, MAX_PER_POST, message, normalize_post_id, validate_note,
    )
except ImportError:  # 试玩包里是平铺的同目录副本
    from note_rules import (
        MAX_LENGTH, MAX_PER_POST, message, normalize_post_id, validate_note,
    )

SCHEMA = """
CREATE TABLE IF NOT EXISTS post_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     TEXT NOT NULL,
    author_id   TEXT NOT NULL,
    author_name TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_post_notes_post ON post_notes(post_id, id);
"""


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _json(row):
    return {
        "id": row["id"],
        "postID": row["post_id"],
        "authorID": row["author_id"],
        "authorName": row["author_name"],
        "content": row["content"],
        "createdAt": row["created_at"],
    }


class NoteStore:
    """独立 SQLite 文件：与订单库分开，试玩包可直接删除重建，不影响业务数据。"""

    def __init__(self, db_path):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._db = sqlite3.connect(str(db_path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock, self._db:
            self._db.executescript(SCHEMA)

    def list(self, post_id):
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM post_notes WHERE post_id = ? ORDER BY id", (post_id,)
            ).fetchall()
        return [_json(row) for row in rows]

    def close(self):
        """热重载 / 测试 / 进程退出时释放文件句柄，Windows 上尤其必要。"""
        with self._lock:
            self._db.close()

    def add(self, post_id, actor, raw_content):
        """返回 (note, error)。校验与条数上限在同一把锁内，避免并发绕过。"""
        content, err = validate_note(raw_content)
        if err:
            return None, err
        with self._lock, self._db:
            count = self._db.execute(
                "SELECT COUNT(*) FROM post_notes WHERE post_id = ?", (post_id,)
            ).fetchone()[0]
            if count >= MAX_PER_POST:
                return None, message("tooMany", count=MAX_PER_POST)
            cur = self._db.execute(
                "INSERT INTO post_notes (post_id, author_id, author_name, content, created_at)"
                " VALUES (?, ?, ?, ?, ?)",
                (post_id, str(actor["id"]), str(actor.get("name") or ""), content, _now()),
            )
            row = self._db.execute(
                "SELECT * FROM post_notes WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
        return _json(row), ""


def _query_value(query, key):
    value = (query or {}).get(key, "")
    if isinstance(value, (list, tuple)):
        return value[0] if value else ""
    return value


def _result(status, msg, data=None):
    return status, {"code": status, "msg": msg, "data": data or {}}


def handle_notes(path, *, method="GET", query=None, body=None,
                 actor=None, resolve_post=None, store=None):
    """返回 (HTTP 状态, 响应体)。

    读：公开，任何人都能看到发布者补充的细节，不需要核实帖子归属。
    写：必须登录、必须是帖子作者、必须能核实帖子存在；任何一步失败都明确拒绝。
    """
    if store is None:
        return _result(503, message("unavailable"))

    method = (method or "GET").upper()
    if method == "GET" and path == "/mirror-api/notes/list":
        post_id = normalize_post_id(_query_value(query, "postID"))
        if not post_id:
            return _result(400, message("postID"))
        notes = store.list(post_id)
        return _result(200, "ok", {
            "notes": notes,
            "total": len(notes),
            "maxPerPost": MAX_PER_POST,
            "maxLength": MAX_LENGTH,
        })

    if method == "POST" and path == "/mirror-api/notes/add":
        if not actor or not actor.get("id"):
            return _result(401, message("login"))
        post_id = normalize_post_id((body or {}).get("postID"))
        if not post_id:
            return _result(400, message("postID"))
        if resolve_post is None:
            return _result(503, message("unavailable"))
        try:
            post = resolve_post(post_id)
        except Exception:
            # 查不到归属时绝不静默放行：宁可提示稍后重试，也不能让陌生人往别人帖子里写
            return _result(503, message("unavailable"))
        if not post:
            return _result(404, message("notFound"))
        if str(post.get("authorID") or "") != str(actor["id"]):
            return _result(403, message("forbidden"))
        note, err = store.add(post_id, actor, (body or {}).get("content"))
        if err:
            return _result(400, err)
        return _result(200, message("saved"), {"note": note})

    if method not in ("GET", "POST"):
        return _result(405, "请求方式不支持")
    return _result(404, "接口不存在")
