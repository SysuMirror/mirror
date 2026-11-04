#!/usr/bin/env python3
"""沕鉴·Mirror 站点服务：静态资源 + UniSSO 密码校验登录 + 需求订单系统。

身份模型：
- 登录 = 镜像自有邮箱+密码表单，后端调 UniSSO POST /api/oauth/password/verify 校验，
  按 sub upsert 用户（存量邮箱精确相等才合并到同一订单归属），本地签发 sid。不跳转。
- 所有登录用户默认为甲方（普通用户），只能看到和处理自己的需求。
- 管理员 = UniSSO internal 为真 且 sub 在本地 admins 白名单中，注册不可能获得该身份。
- 转发集市：官方账号(env 配置)或管理员本地会话中的集市令牌。
"""
import json
import os
import secrets
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import build_opener, ProxyHandler, Request

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "web" / "dist"
DB_PATH = ROOT / "mirror.db"
PORT = int(os.environ.get("PORT", "8080"))
UNISSO_ISSUER = os.environ.get("UNISSO_ISSUER", "https://sso.ssemarket.cn").rstrip("/")
UNISSO_CLIENT_ID = os.environ.get("UNISSO_CLIENT_ID", "")
UNISSO_CLIENT_SECRET = os.environ.get("UNISSO_CLIENT_SECRET", "")
MARKET_BASE = os.environ.get("MARKET_BASE", "https://ssemarket.cn").rstrip("/")
MARKET_TRUST_SECRET = os.environ.get("MARKET_TRUST_SECRET", "")
MARKET_OFFICIAL_EMAIL = os.environ.get("MARKET_OFFICIAL_EMAIL", "").strip()
MARKET_OFFICIAL_PASSWORD = os.environ.get("MARKET_OFFICIAL_PASSWORD", "")
MARKET_OFFICIAL_NAME = os.environ.get("MARKET_OFFICIAL_NAME", "软工集市官方")
SESSION_TTL = 30 * 86400
MAX_BODY = 256 * 1024

ORDER_STATUSES = ("pending", "accepted", "in_progress", "done", "closed")
STATUS_LABELS = {
    "pending": "待受理",
    "accepted": "已受理",
    "in_progress": "处理中",
    "done": "已完成",
    "closed": "已关闭",
}

rate_lock = threading.Lock()
rate_events = {}
db_lock = threading.RLock()


def env():
    path = ROOT / ".env"
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


env()
UNISSO_ISSUER = os.environ.get("UNISSO_ISSUER", UNISSO_ISSUER).rstrip("/")
UNISSO_CLIENT_ID = os.environ.get("UNISSO_CLIENT_ID", "")
UNISSO_CLIENT_SECRET = os.environ.get("UNISSO_CLIENT_SECRET", "")
MARKET_BASE = os.environ.get("MARKET_BASE", MARKET_BASE).rstrip("/")
MARKET_TRUST_SECRET = os.environ.get("MARKET_TRUST_SECRET", "")
MARKET_OFFICIAL_EMAIL = os.environ.get("MARKET_OFFICIAL_EMAIL", "").strip()
MARKET_OFFICIAL_PASSWORD = os.environ.get("MARKET_OFFICIAL_PASSWORD", "")


# ---------------------------------------------------------------- 数据库

def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


DB = db()


def ensure_column(table, column, ddl):
    columns = [row[1] for row in DB.execute(f"PRAGMA table_info({table})")]
    if column not in columns:
        DB.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db():
    with db_lock, DB:
        DB.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            sso_sub TEXT PRIMARY KEY,
            email TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL DEFAULT '',
            internal INTEGER NOT NULL DEFAULT 0,
            sse_user_id TEXT NOT NULL DEFAULT '',
            created REAL NOT NULL,
            last_seen REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            market_token TEXT NOT NULL DEFAULT '',
            market_user_id TEXT NOT NULL DEFAULT '',
            created REAL NOT NULL,
            last_seen REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_email ON sessions(email);
        CREATE TABLE IF NOT EXISTS admins (
            email TEXT PRIMARY KEY,
            note TEXT NOT NULL DEFAULT '',
            created TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            budget_type TEXT NOT NULL DEFAULT 'negotiable',
            budget_min REAL,
            budget_max REAL,
            contact_name TEXT NOT NULL DEFAULT '',
            contact_method TEXT NOT NULL DEFAULT '',
            expect_date TEXT NOT NULL DEFAULT '',
            owner_email TEXT NOT NULL,
            owner_name TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            market_post_id TEXT NOT NULL DEFAULT '',
            market_post_by TEXT NOT NULL DEFAULT '',
            created TEXT NOT NULL,
            updated TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_orders_owner ON orders(owner_email);
        CREATE TABLE IF NOT EXISTS order_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT '',
            note TEXT NOT NULL DEFAULT '',
            actor_email TEXT NOT NULL DEFAULT '',
            actor_admin INTEGER NOT NULL DEFAULT 0,
            created TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);
        """)
        ensure_column("sessions", "sso_sub", "sso_sub TEXT NOT NULL DEFAULT ''")
        ensure_column("sessions", "internal", "internal INTEGER NOT NULL DEFAULT 0")
        ensure_column("admins", "sso_sub", "sso_sub TEXT NOT NULL DEFAULT ''")
        DB.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_sub ON admins(sso_sub) WHERE sso_sub != ''"
        )


init_db()


def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z", time.gmtime())


def is_admin(sso_sub, internal):
    if not sso_sub or internal != 1:
        return False
    with db_lock, DB:
        row = DB.execute("SELECT 1 FROM admins WHERE sso_sub = ?", (sso_sub,)).fetchone()
    return row is not None


def upsert_user(sso_sub, email, name, internal, sse_user_id):
    now = time.time()
    with db_lock, DB:
        DB.execute(
            "INSERT INTO users (sso_sub, email, name, internal, sse_user_id, created, last_seen)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)"
            " ON CONFLICT(sso_sub) DO UPDATE SET email = excluded.email, name = excluded.name,"
            " internal = excluded.internal, sse_user_id = excluded.sse_user_id, last_seen = excluded.last_seen",
            (sso_sub, email, name, int(bool(internal)), str(sse_user_id or ""), now, now),
        )


def create_session(sso_sub, email, name, internal, market_token="", market_user_id=""):
    sid = "ms-" + secrets.token_hex(24)
    with db_lock, DB:
        DB.execute(
            "INSERT INTO sessions (sid, sso_sub, email, name, internal, market_token, market_user_id, created, last_seen)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (sid, sso_sub, email, name, int(bool(internal)), market_token,
             str(market_user_id or ""), time.time(), time.time()),
        )
    return sid


def resolve_session(sid):
    if not sid or not sid.startswith("ms-"):
        return None
    with db_lock, DB:
        row = DB.execute("SELECT * FROM sessions WHERE sid = ?", (sid,)).fetchone()
        if not row:
            return None
        if time.time() - row["last_seen"] > SESSION_TTL:
            DB.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            return None
        DB.execute("UPDATE sessions SET last_seen = ? WHERE sid = ?", (time.time(), sid))
    return row


def order_row_json(row, events=None):
    data = {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "budgetType": row["budget_type"],
        "budgetMin": row["budget_min"],
        "budgetMax": row["budget_max"],
        "contactName": row["contact_name"],
        "contactMethod": row["contact_method"],
        "expectDate": row["expect_date"],
        "ownerEmail": row["owner_email"],
        "ownerName": row["owner_name"],
        "status": row["status"],
        "statusLabel": STATUS_LABELS.get(row["status"], row["status"]),
        "marketPostId": row["market_post_id"],
        "marketPostBy": row["market_post_by"],
        "createdAt": row["created"],
        "updatedAt": row["updated"],
    }
    if events is not None:
        data["events"] = [
            {
                "type": e["type"],
                "status": e["status"],
                "statusLabel": STATUS_LABELS.get(e["status"], e["status"]) if e["status"] else "",
                "note": e["note"],
                "actorAdmin": bool(e["actor_admin"]),
                "created": e["created"],
            }
            for e in events
        ]
    return data


def get_events(order_id):
    with db_lock, DB:
        return DB.execute(
            "SELECT * FROM order_events WHERE order_id = ? ORDER BY id ASC", (order_id,)
        ).fetchall()


# ---------------------------------------------------------------- UniSSO / 集市

def password_verify(email, password):
    """POST {ISSUER}/api/oauth/password/verify（form：email/password + client 凭据）。

    返回 (status, payload)；payload 为 JSON（HTTP 错误时尽力解析）。
    """
    data = urllib.parse.urlencode({
        "email": email,
        "password": password,
        "client_id": UNISSO_CLIENT_ID,
        "client_secret": UNISSO_CLIENT_SECRET,
    }).encode("utf-8")
    request = Request(
        f"{UNISSO_ISSUER}/api/oauth/password/verify",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Mirror/2.0",
        },
    )
    opener = build_opener(ProxyHandler({}))
    try:
        with opener.open(request, timeout=20) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode("utf-8"))
        except Exception:
            payload = {}
        return error.code, payload


SSO_COOKIE_NAME = "sse_sso"
SSO_COOKIE_DOMAIN = ".ssemarket.cn"


def unisso_session_call(path, session, timeout=10):
    """调 UniSSO session/verify | session/revoke。返回 (status, payload)；网络异常 status=0。"""
    data = urllib.parse.urlencode({
        "session": session,
        "client_id": UNISSO_CLIENT_ID,
        "client_secret": UNISSO_CLIENT_SECRET,
    }).encode("utf-8")
    request = Request(
        f"{UNISSO_ISSUER}{path}",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "Mirror/2.0",
        },
    )
    opener = build_opener(ProxyHandler({}))
    try:
        with opener.open(request, timeout=timeout) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        try:
            payload = json.loads(error.read().decode("utf-8"))
        except Exception:
            payload = {}
        return error.code, payload
    except Exception:
        return 0, {}


def request_cookies(handler):
    cookies = {}
    for part in (handler.headers.get("Cookie", "") or "").split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def sso_cookie_header(value, max_age, name=SSO_COOKIE_NAME, domain=SSO_COOKIE_DOMAIN):
    return (
        f"{name}={value}; Domain={domain}; Path=/; Max-Age={int(max_age)};"
        " HttpOnly; Secure; SameSite=Lax"
    )


def market_json(path, token=None, payload=None):
    headers = {"Content-Type": "application/json", "User-Agent": "Mirror-Auth/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    req = Request(f"{MARKET_BASE}{path}", data=data, headers=headers,
                  method="POST" if payload is not None else "GET")
    opener = build_opener(ProxyHandler({}))
    with opener.open(req, timeout=20) as response:
        body = json.loads(response.read().decode("utf-8"))
    return body


def provision_market(user, password):
    if not MARKET_TRUST_SECRET:
        raise RuntimeError("provisioning is not configured")
    payload = json.dumps({
        "email": user.get("email"),
        "password": password,
        "name": user.get("full_name") or user.get("username") or "",
    }).encode("utf-8")
    request = Request(
        f"{MARKET_BASE}/api/sso/mirror/provision",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Unisso-Trust": MARKET_TRUST_SECRET,
            "User-Agent": "Mirror-Auth/1.0",
        },
    )
    opener = build_opener(ProxyHandler({}))
    with opener.open(request, timeout=15) as response:
        result = json.loads(response.read().decode("utf-8"))
    if response.status != 200 or result.get("code") != 200:
        raise RuntimeError("market provisioning failed")
    data = result.get("data") or {}
    token = data.get("token")
    market_user = data.get("user") or {}
    if not token or not market_user.get("userID"):
        raise RuntimeError("market provisioning response invalid")
    return token, data.get("refresh_token"), market_user


def official_market_token():
    """官方账号 token：经 provision 信任端点换取，凭据只在服务端 env。"""
    if not MARKET_OFFICIAL_EMAIL or not MARKET_OFFICIAL_PASSWORD:
        raise RuntimeError("官方集市账号未配置（MARKET_OFFICIAL_EMAIL / MARKET_OFFICIAL_PASSWORD）")
    token, _, user = provision_market(
        {"email": MARKET_OFFICIAL_EMAIL, "full_name": MARKET_OFFICIAL_NAME},
        MARKET_OFFICIAL_PASSWORD,
    )
    return token, user


def market_create_quest_post(token, order):
    budget = {"budgetType": order["budget_type"], "quotePrice": None,
              "quotePriceMin": None, "quotePriceMax": None}
    if order["budget_type"] == "fixed":
        budget["quotePrice"] = order["budget_min"]
    elif order["budget_type"] == "range":
        budget["quotePriceMin"] = order["budget_min"]
        budget["quotePriceMax"] = order["budget_max"]
    payload = {
        "title": order["title"],
        "content": order["content"],
        "postKind": "bounty",
        "priceType": order["budget_type"] if order["budget_type"] in ("fixed", "range") else "fixed",
        **budget,
    }
    if order["budget_type"] == "negotiable":
        payload["priceType"] = "fixed"
        payload["quotePrice"] = 0
        payload["title"] = f"{order['title']}（预算面议）"
    if order["expect_date"]:
        payload["deadline"] = order["expect_date"]
    body = market_json("/api/auth/quest/create", token=token, payload=payload)
    if body.get("code") not in (200, None):
        raise RuntimeError(body.get("msg") or "集市发帖失败")
    post = (body.get("data") or {}).get("post") or body.get("post") or {}
    post_id = post.get("postID") or post.get("post_id")
    if not post_id:
        raise RuntimeError("集市发帖未返回帖子 ID")
    return str(post_id)


# ---------------------------------------------------------------- 通用工具

def json_bytes(value, status=200):
    body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return status, {"Content-Type": "application/json; charset=utf-8"}, body


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0 or length > MAX_BODY:
        raise ValueError("invalid request size")
    try:
        value = json.loads(handler.rfile.read(length).decode("utf-8"))
    except Exception as exc:
        raise ValueError("invalid JSON") from exc
    if not isinstance(value, dict):
        raise ValueError("JSON object required")
    return value


def require_fields(value, names, lengths):
    clean = {}
    for name in names:
        item = value.get(name)
        if not isinstance(item, str):
            return None
        item = item.strip()
        if not item or len(item) > lengths.get(name, 255):
            return None
        clean[name] = item
    return clean


def client_ip(handler):
    return handler.client_address[0]


def allow_rate(ip, limit=40, seconds=60):
    now = time.time()
    with rate_lock:
        events = [stamp for stamp in rate_events.get(ip, []) if now - stamp < seconds]
        if len(events) >= limit:
            rate_events[ip] = events
            return False
        events.append(now)
        rate_events[ip] = events
        return True


# ---------------------------------------------------------------- HTTP 服务

class MirrorHandler(BaseHTTPRequestHandler):
    server_version = "Mirror/2.0"

    def log_message(self, fmt, *args):
        return

    def send(self, status, headers, body):
        self.send_response(status)
        items = headers.items() if isinstance(headers, dict) else headers
        for key, value in items:
            if isinstance(value, (list, tuple)):
                for item in value:
                    self.send_header(key, item)
            else:
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def static_file(self, relative):
        path = (DIST / relative.lstrip("/")).resolve()
        if not str(path).startswith(str(DIST.resolve())):
            self.send(403, {"Content-Type": "text/plain"}, b"Forbidden")
            return
        if not path.exists() or path.is_dir():
            path = DIST / "index.html"
        suffix = path.suffix.lower()
        types = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
            ".json": "application/json",
            ".webp": "image/webp",
        }
        self.send(200, {"Content-Type": types.get(suffix, "application/octet-stream")}, path.read_bytes())

    def reply(self, value, status=200, extra_headers=None):
        response_status, headers, body = json_bytes(value, status)
        if extra_headers:
            items = list(headers.items()) + list(extra_headers)
            self.send(response_status, items, body)
            return
        self.send(response_status, headers, body)

    # ---------- 会话 ----------

    def current_session(self):
        sid = self.headers.get("X-Mirror-Session", "")
        if not sid:
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer ms-"):
                sid = auth[7:].strip()
        return resolve_session(sid)

    # ---------- 路由 ----------

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        path = parsed.path
        if path.startswith("/mirror-api/"):
            self.api_get(path, urllib.parse.parse_qs(parsed.query))
            return
        self.static_file(path or "/")

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        try:
            if not self.path.startswith("/mirror-api/"):
                self.reply({"error": "not found"}, 404)
                return
            if not allow_rate(client_ip(self)):
                self.reply({"error": "too many requests"}, 429)
                return
            value = read_json(self)
            path = self.path.split("?")[0].removeprefix("/mirror-api")
            if path == "/auth/login":
                self.login(value)
            elif path == "/auth/sso/try":
                self.sso_try()
            elif path == "/auth/logout":
                self.logout(value)
            elif path == "/orders/create":
                self.order_create(value)
            elif path == "/orders/status":
                self.order_status(value)
            elif path == "/orders/forward":
                self.order_forward(value)
            else:
                self.reply({"error": "not found"}, 404)
        except ValueError as exc:
            self.reply({"error": str(exc)}, 400)
        except Exception as exc:
            print(f"mirror api error: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            self.reply({"error": "service unavailable"}, 503)

    def api_get(self, path, query):
        try:
            if not allow_rate(client_ip(self)):
                self.reply({"error": "too many requests"}, 429)
                return
            if path == "/mirror-api/me":
                self.api_me()
            elif path == "/mirror-api/orders/list":
                self.order_list(query)
            elif path == "/mirror-api/orders/detail":
                self.order_detail(query)
            elif path == "/mirror-api/market/chat-history":
                self.market_chat_history(query)
            else:
                self.reply({"error": "not found"}, 404)
        except Exception as exc:
            import traceback
            traceback.print_exc()
            print(f"mirror api get error: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            self.reply({"error": "service unavailable"}, 503)

    # ---------- 账号 ----------

    def login(self, value):
        fields = require_fields(value, ("email", "password"), {"email": 128, "password": 128})
        if not fields:
            self.reply({"error": "email and password are required"}, 400)
            return
        status, payload = password_verify(fields["email"], fields["password"])
        if status == 401 and payload.get("error") == "invalid_client":
            self.reply({"error": "sso client misconfigured"}, 503)
            return
        if status == 401:
            self.reply({"error": "invalid UniSSO credentials"}, 401)
            return
        if status == 403:
            self.reply({"error": "password login is not allowed for this account"}, 403)
            return
        if status == 429:
            self.reply({"error": "too many login attempts, please retry in 15 minutes"}, 429)
            return
        if status == 400:
            self.reply({"error": "email and password are required"}, 400)
            return
        user = (payload or {}).get("user") or {}
        if status != 200 or not (payload or {}).get("ok") or not user.get("sub"):
            self.reply({"error": "service unavailable"}, 503)
            return
        sso_session = str((payload or {}).get("sso_session") or "")
        email = (user.get("email") or fields["email"]).strip().lower()
        result = self.finish_login(user, email)
        headers = None
        if sso_session:
            name = str((payload or {}).get("sso_cookie_name") or SSO_COOKIE_NAME)
            domain = str((payload or {}).get("sso_cookie_domain") or SSO_COOKIE_DOMAIN)
            max_age = int((payload or {}).get("sso_max_age") or 604800)
            headers = [("Set-Cookie", sso_cookie_header(sso_session, max_age, name, domain))]
        self.reply(result, extra_headers=headers)

    def finish_login(self, user, email):
        """按 UniSSO 用户 upsert 并签发本地会话；密码登录与静默 SSO 共用。"""
        sub = user["sub"]
        internal = user.get("internal") is True
        name = (user.get("name") or user.get("preferred_username") or email.split("@")[0])[:128]
        sse_user_id = str(user.get("sse_sub") or "")
        upsert_user(sub, email, name, internal, sse_user_id)
        admin = is_admin(sub, 1 if internal else 0)

        market_token = ""
        market_user_id = sse_user_id
        if admin:
            try:
                market_token, _refresh, market_user = provision_market(
                    {"email": email, "full_name": name, "username": user.get("preferred_username")},
                    secrets.token_urlsafe(24),
                )
                market_user_id = str(market_user.get("userID") or market_user_id)
            except Exception as exc:
                print(f"mirror market provision warning: {type(exc).__name__}: {exc}",
                      file=sys.stderr, flush=True)

        sid = create_session(sub, email, name, internal, market_token, market_user_id)
        return {
            "sid": sid,
            "token": market_token,
            "isAdmin": admin,
            "marketUserID": market_user_id,
        }

    def sso_try(self):
        """静默 SSO：读 sse_sso Cookie → unisso session/verify → 签本地会话。"""
        if not allow_rate("sso:" + client_ip(self), limit=10, seconds=60):
            self.reply({"error": "too many requests"}, 429)
            return
        sso_session = request_cookies(self).get(SSO_COOKIE_NAME, "")
        if not sso_session:
            self.reply({"error": "no_sso"}, 401)
            return
        status, payload = unisso_session_call("/api/oauth/session/verify", sso_session)
        if status == 401:
            self.reply({"error": "invalid_sso"}, 401)
            return
        if status == 429 or status == 0 or status >= 500:
            self.reply({"error": "sso_unavailable"}, 503)
            return
        user = (payload or {}).get("user") or {}
        if status != 200 or not (payload or {}).get("ok") or not user.get("sub"):
            self.reply({"error": "sso_unavailable"}, 503)
            return
        email = (user.get("email") or "").strip().lower()
        self.reply(self.finish_login(user, email))

    def logout(self, value):
        """登出：撤销 UniSSO 会话 + 清父域 Cookie + 删本地 sid。"""
        cookies = request_cookies(self)
        sso_session = cookies.get(SSO_COOKIE_NAME, "")
        if sso_session:
            try:
                unisso_session_call("/api/oauth/session/revoke", sso_session, timeout=5)
            except Exception:
                pass
        sid = self.headers.get("X-Mirror-Session", "") or str(value.get("sid") or "")
        if sid.startswith("ms-"):
            with db_lock, DB:
                DB.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
        self.reply({"ok": True}, extra_headers=[
            ("Set-Cookie", sso_cookie_header("", 0)),
        ])

    # ---------- 订单：甲方 ----------

    def api_me(self):
        session = self.current_session()
        if not session:
            self.reply({"error": "unauthorized"}, 401)
            return
        self.reply({
            "email": session["email"],
            "name": session["name"],
            "sub": session["sso_sub"],
            "internal": bool(session["internal"]),
            "isAdmin": is_admin(session["sso_sub"], session["internal"]),
        })

    def order_create(self, value):
        session = self.current_session()
        if not session:
            self.reply({"error": "unauthorized"}, 401)
            return
        fields = require_fields(value, ("title", "content"), {"title": 60, "content": 4000})
        if not fields:
            self.reply({"error": "请填写需求标题和描述"}, 400)
            return
        contact = require_fields(value, ("contactName", "contactMethod"), {"contactName": 60, "contactMethod": 120})
        if not contact:
            self.reply({"error": "请留下称呼和联系方式"}, 400)
            return
        budget_type = value.get("budgetType") if value.get("budgetType") in ("fixed", "range", "negotiable") else "negotiable"
        budget_min = budget_max = None
        if budget_type == "fixed":
            try:
                budget_min = float(value.get("budgetMin"))
                if budget_min <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                self.reply({"error": "预算金额无效"}, 400)
                return
        elif budget_type == "range":
            try:
                budget_min = float(value.get("budgetMin"))
                budget_max = float(value.get("budgetMax"))
                if not (0 < budget_min <= budget_max):
                    raise ValueError
            except (TypeError, ValueError):
                self.reply({"error": "预算区间无效"}, 400)
                return
        expect_date = (value.get("expectDate") or "").strip()[:32]
        order_id = "o" + secrets.token_hex(8)
        created = now_iso()
        with db_lock, DB:
            DB.execute(
                "INSERT INTO orders (id, title, content, budget_type, budget_min, budget_max,"
                " contact_name, contact_method, expect_date, owner_email, owner_name, status, created, updated)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
                (order_id, fields["title"], fields["content"], budget_type, budget_min, budget_max,
                 contact["contactName"], contact["contactMethod"], expect_date,
                 session["email"], session["name"], created, created),
            )
            DB.execute(
                "INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)"
                " VALUES (?, 'create', 'pending', ?, ?, 0, ?)",
                (order_id, "需求已提交", session["email"], created),
            )
        self.reply({"ok": True, "orderId": order_id}, 201)

    def order_list(self, query):
        session = self.current_session()
        if not session:
            self.reply({"error": "unauthorized"}, 401)
            return
        admin = is_admin(session["sso_sub"], session["internal"])
        status = (query.get("status") or [""])[0]
        sql = "SELECT * FROM orders"
        where, params = [], []
        if admin and (query.get("scope") or ["all"])[0] == "all":
            pass
        else:
            where.append("owner_email = ?")
            params.append(session["email"])
        if status and status in ORDER_STATUSES:
            where.append("status = ?")
            params.append(status)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created DESC LIMIT 200"
        with db_lock, DB:
            rows = DB.execute(sql, params).fetchall()
        self.reply({"items": [order_row_json(r) for r in rows], "total": len(rows)})

    def load_order(self, order_id):
        with db_lock, DB:
            row = DB.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return row

    def order_detail(self, query):
        session = self.current_session()
        if not session:
            self.reply({"error": "unauthorized"}, 401)
            return
        order_id = (query.get("id") or [""])[0]
        row = self.load_order(order_id)
        if not row:
            self.reply({"error": "订单不存在"}, 404)
            return
        admin = is_admin(session["sso_sub"], session["internal"])
        if not admin and row["owner_email"] != session["email"]:
            self.reply({"error": "无权查看"}, 403)
            return
        self.reply({"order": order_row_json(row, get_events(order_id)), "viewerIsAdmin": admin})

    # ---------- 订单：管理员 ----------

    def order_status(self, value):
        session = self.current_session()
        if not session or not is_admin(session["sso_sub"], session["internal"]):
            self.reply({"error": "forbidden"}, 403)
            return
        order_id = value.get("id")
        status = value.get("status")
        note = (value.get("note") or "").strip()[:500]
        row = self.load_order(order_id) if isinstance(order_id, str) else None
        if not row or status not in ORDER_STATUSES:
            self.reply({"error": "订单或状态无效"}, 400)
            return
        updated = now_iso()
        with db_lock, DB:
            DB.execute("UPDATE orders SET status = ?, updated = ? WHERE id = ?", (status, updated, order_id))
            DB.execute(
                "INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)"
                " VALUES (?, 'status', ?, ?, ?, 1, ?)",
                (order_id, status, note or STATUS_LABELS.get(status, status), session["email"], updated),
            )
        self.reply({"ok": True})

    def order_forward(self, value):
        session = self.current_session()
        if not session or not is_admin(session["sso_sub"], session["internal"]):
            self.reply({"error": "forbidden"}, 403)
            return
        order_id = value.get("id")
        as_kind = value.get("as") if value.get("as") in ("official", "self") else "official"
        row = self.load_order(order_id) if isinstance(order_id, str) else None
        if not row:
            self.reply({"error": "订单不存在"}, 404)
            return
        if row["market_post_id"]:
            self.reply({"error": "该需求已转发过集市", "postId": row["market_post_id"]}, 409)
            return
        try:
            if as_kind == "self":
                token = session["market_token"]
                if not token:
                    raise RuntimeError("当前管理员会话缺少集市凭据，请重新登录后再试")
                by = session["email"]
            else:
                token, _user = official_market_token()
                by = MARKET_OFFICIAL_EMAIL
            post_id = market_create_quest_post(token, row)
        except Exception as exc:
            self.reply({"error": f"转发失败：{exc}"}, 502)
            return
        updated = now_iso()
        with db_lock, DB:
            DB.execute(
                "UPDATE orders SET market_post_id = ?, market_post_by = ?, updated = ? WHERE id = ?",
                (post_id, by, updated, order_id),
            )
            DB.execute(
                "INSERT INTO order_events (order_id, type, status, note, actor_email, actor_admin, created)"
                " VALUES (?, 'forward', '', ?, ?, 1, ?)",
                (order_id, f"已转发到软工集市（帖子 {post_id}，由 {by} 发布）", session["email"], updated),
            )
        self.reply({"ok": True, "postId": post_id, "postUrl": f"{MARKET_BASE}/#/post/{post_id}"})

    def market_chat_history(self, query):
        """集市会话记录（管理员，用自己绑定账号）。"""
        session = self.current_session()
        if not session or not is_admin(session["sso_sub"], session["internal"]):
            self.reply({"error": "forbidden"}, 403)
            return
        sender = (query.get("senderUserID") or [""])[0]
        target = (query.get("targetUserID") or [""])[0]
        if not sender or not target:
            self.reply({"error": "senderUserID and targetUserID required"}, 400)
            return
        try:
            headers = {"Authorization": f"Bearer {session['market_token']}", "User-Agent": "Mirror-Auth/1.0"}
            req = Request(
                f"{MARKET_BASE}/api/auth/getChatHistory?senderUserID={urllib.parse.quote(sender)}&targetUserID={urllib.parse.quote(target)}&threadAnonymous=false",
                headers=headers,
            )
            opener = build_opener(ProxyHandler({}))
            with opener.open(req, timeout=15) as response:
                self.reply(json.loads(response.read().decode("utf-8")))
        except Exception as exc:
            self.reply({"error": f"获取集市消息失败：{exc}"}, 502)


if __name__ == "__main__":
    if not UNISSO_CLIENT_ID or not UNISSO_CLIENT_SECRET:
        raise SystemExit("UNISSO_CLIENT_ID and UNISSO_CLIENT_SECRET are required")
    if not MARKET_TRUST_SECRET:
        print("warning: MARKET_TRUST_SECRET is not set; admin market tokens unavailable",
              file=sys.stderr, flush=True)
    if not (DIST / "index.html").exists():
        raise SystemExit("web/dist/index.html is missing")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), MirrorHandler)
    print(f"mirror server (unisso password verify + orders) listening on 0.0.0.0:{PORT}", flush=True)
    server.serve_forever()
