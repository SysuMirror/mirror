#!/usr/bin/env python3
"""帖子浏览 / 沟通计数：唯一实现，生产后端、dev 网关、本地试玩包共用。

避免统计变成屎山的几条约束：
- 增量落独立 SQLite，不改主站订单表、不写演示快照（删库即可复位）。
- 持久去重：同一账号对同一帖只计一次浏览；同一账号在同一帖对同一对象只计一次沟通。
  前端传来的计数一律不读，身份只取自会话 / 演示账号。
- 作者浏览自己的帖子、自己联系自己都不计；帖子归属由 resolve_post 核实，
  核实失败返回 503，绝不静默放行。
- 读接口公开；写接口必须登录。base() 由各端注入历史基线，返回绝对值给前端。
"""

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

try:  # 作为 contracts 包导入（生产后端）
    from .note_rules import normalize_post_id
except ImportError:  # dev 网关 / 试玩包里是平铺的同目录副本
    from note_rules import normalize_post_id

RULES_PATH = Path(__file__).with_name("post-stats.json")
if not RULES_PATH.is_file():
    raise RuntimeError("缺少 contracts/post-stats.json，统计契约不可用")
MESSAGES = json.loads(RULES_PATH.read_text(encoding="utf-8"))["messages"]


def message(key):
    return str(MESSAGES.get(key, key))


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


SCHEMA = """
CREATE TABLE IF NOT EXISTS post_stat_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     TEXT NOT NULL,
    actor_id    TEXT NOT NULL,
    peer_id     TEXT NOT NULL DEFAULT '',
    kind        TEXT NOT NULL CHECK (kind IN ('view', 'chat')),
    created_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stat_view
    ON post_stat_events(post_id, actor_id) WHERE kind = 'view';
CREATE UNIQUE INDEX IF NOT EXISTS uq_stat_chat
    ON post_stat_events(post_id, actor_id, peer_id) WHERE kind = 'chat';
CREATE INDEX IF NOT EXISTS idx_stat_post ON post_stat_events(post_id, kind);
"""


class PostStatStore:
    """独立 SQLite 文件：与订单库、批注库分开，试玩包可直接删除重建。"""

    def __init__(self, db_path):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._db = sqlite3.connect(str(db_path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock, self._db:
            self._db.executescript(SCHEMA)

    def close(self):
        with self._lock:
            self._db.close()

    def _record(self, post_id, actor_id, peer_id, kind):
        # INSERT OR IGNORE + 部分唯一索引：并发重复上报也只记一次
        with self._lock, self._db:
            cur = self._db.execute(
                "INSERT OR IGNORE INTO post_stat_events"
                " (post_id, actor_id, peer_id, kind, created_at) VALUES (?, ?, ?, ?, ?)",
                (post_id, actor_id, peer_id, kind, _now()),
            )
            return cur.rowcount == 1

    def record_view(self, post_id, actor_id):
        return self._record(post_id, actor_id, "", "view")

    def record_chat(self, post_id, actor_id, peer_id):
        return self._record(post_id, actor_id, peer_id, "chat")

    def deltas(self, post_id):
        with self._lock:
            rows = self._db.execute(
                "SELECT kind, COUNT(*) AS n FROM post_stat_events"
                " WHERE post_id = ? GROUP BY kind", (post_id,)
            ).fetchall()
        out = {"view": 0, "chat": 0}
        for row in rows:
            out[row["kind"]] = int(row["n"])
        return out


def _result(status, msg, data=None):
    return status, {"code": status, "msg": msg, "data": data or {}}


def _query_value(query, key):
    value = (query or {}).get(key, "")
    if isinstance(value, (list, tuple)):
        return value[0] if value else ""
    return value


def _absolute(store, post_id, base):
    """历史基线 + 增量。基线读取失败返回 None，由调用方转 503。"""
    counts = {"viewCount": 0, "chatCount": 0}
    if base is not None:
        try:
            raw = base(post_id) or {}
            counts["viewCount"] = int(raw.get("viewCount") or 0)
            counts["chatCount"] = int(raw.get("chatCount") or 0)
        except (TypeError, ValueError):
            return None
    delta = store.deltas(post_id)
    return {
        "viewCount": counts["viewCount"] + delta["view"],
        "chatCount": counts["chatCount"] + delta["chat"],
        "viewDelta": delta["view"],
        "chatDelta": delta["chat"],
    }


def handle_stats(path, *, method="GET", query=None, body=None,
                 actor=None, resolve_post=None, store=None, base=None):
    """返回 (HTTP 状态, 响应体)。身份与帖子归属由各端注入，本模块只管计数语义。"""
    if store is None:
        return _result(503, message("unavailable"))
    method = (method or "GET").upper()

    if method == "GET" and path == "/mirror-api/stats/get":
        post_id = normalize_post_id(_query_value(query, "postID"))
        if not post_id:
            return _result(400, message("postID"))
        data = _absolute(store, post_id, base)
        return (_result(200, "ok", data) if data is not None
                else _result(503, message("unavailable")))

    if method == "POST" and path in ("/mirror-api/stats/view", "/mirror-api/stats/chat"):
        if not actor or not actor.get("id"):
            return _result(401, message("login"))
        post_id = normalize_post_id((body or {}).get("postID"))
        if not post_id:
            return _result(400, message("postID"))
        is_chat = path.endswith("/chat")
        peer_id = ""
        if is_chat:
            peer_id = normalize_post_id((body or {}).get("peerID"))
            if not peer_id:
                return _result(400, message("peerID"))
        if resolve_post is None:
            return _result(503, message("unavailable"))
        try:
            post = resolve_post(post_id)
        except Exception:
            return _result(503, message("unavailable"))
        if not post:
            return _result(404, message("notFound"))

        actor_id = str(actor["id"])
        author_id = str(post.get("authorID") or "")
        # 作者自浏览 / 自己联系自己不计，但仍返回当前值（不让前端误判为失败）
        if actor_id != author_id and peer_id != actor_id:
            if is_chat:
                store.record_chat(post_id, actor_id, peer_id)
            else:
                store.record_view(post_id, actor_id)

        data = _absolute(store, post_id, base)
        return (_result(200, "ok", data) if data is not None
                else _result(503, message("unavailable")))

    if method not in ("GET", "POST"):
        return _result(405, "请求方式不支持")
    return _result(404, "接口不存在")
