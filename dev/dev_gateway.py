#!/usr/bin/env python3
"""mirror-dev 专用开发网关（仅独立 dev Pod 使用，严禁用于生产）。

设计：前端 dev 构建把 VITE_API_BASE 设为同源 /api，本进程同时托管静态产物、
      /api/* 演示接口与 /mirror-api/* 契约接口，不依赖 UniSSO、不依赖主站、
      不需要第二个后端进程。演示数据与演示库都落在 MIRROR_DEV_DATA 目录。

启用：只能由仓库根 deploy.sh 在 MIRROR_DEV_MODE=1 时 exec 启动；
      生产路径不设置该变量，本文件永远不会被加载。

契约：直接复用仓库 contracts/ 包（金额 / 批注 / 统计 / 作者展示），
      不在 dev/ 下保留任何副本，避免规则漂移。
"""
import base64
import hashlib
import json
import os
import secrets
import struct
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DIST = Path(os.environ.get("MIRROR_STATIC_DIR", str(ROOT / "web" / "dist")))
DATA_DIR = Path(os.environ.get("MIRROR_DEV_DATA", str(ROOT / "dev" / "_state")))
PORT = int(os.environ.get("PORT", "8080"))
DEV_MODE = os.environ.get("MIRROR_DEV_MODE", "") == "1"
DEV_NO_LOGIN = os.environ.get("MIRROR_DEV_NO_LOGIN", "1") != "0"
# 留空即完全自给自足；配置后可把非演示接口转发给真后端（可选）
UPSTREAM = os.environ.get("MIRROR_DEV_UPSTREAM", "").rstrip("/")
STATE_FILE = Path(os.environ.get("MIRROR_DEV_STATE", str(DATA_DIR / "mock_state.json")))
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
LOCK = threading.RLock()

# 与生产后端共用 contracts/ 下同一份实现，dev/ 内不保留副本。
sys.path.insert(0, str(ROOT))
from contracts.author_display import with_current_author
from contracts.money_rules import validate_quest_price as validate_price
from contracts.notes import NoteStore, handle_notes
from contracts.post_stats import PostStatStore, handle_stats

# 演示库落在独立数据目录，绝不写生产库、也不写进仓库。
NOTES = NoteStore(DATA_DIR / "dev_notes.db")
STATS = PostStatStore(DATA_DIR / "dev_stats.db")


def now_iso(offset_minutes=0):
    return (datetime.now() - timedelta(minutes=offset_minutes)).isoformat(timespec="seconds")


def seed():
    return {
        "me": {
            "userID": 1,
            "name": "开发体验账号",
            "avatarURL": "",
            "score": 320,
            "phone": "13800000000",
            "email": "dev@mirror.local",
        },
        "nextPostID": 105,
        "posts": [
            {
                "postID": 101, "title": "课程设计前端页面改成响应式",
                "content": "用 Vue 写的课程设计，手机上排版全乱了。希望有人帮我调一下断点、表格和导航，能讲一下思路就更好了。预算可谈，本周内完成。",
                "postKind": "bounty", "questStatus": "open", "priceType": "fixed",
                "quotePrice": 300, "quotePriceMin": None, "quotePriceMax": None,
                "questDeadline": now_iso(-60 * 24 * 5),
                "authorID": 101, "authorName": "林同学", "authorAvatar": "", "authorScore": 460,
                "postTime": now_iso(35), "commentNum": 2, "attachments": [],
                "isSaved": False, "order": None,
            },
            {
                "postID": 102, "title": "数据结构作业：图的最短路径看不懂",
                "content": "Dijkstra 和 Floyd 的区别总是搞混，有没有同学愿意用一道例题讲一遍？纯求助，不需要写代码，线上语音半小时就行。",
                "postKind": "inquiry", "questStatus": "open", "priceType": "negotiable",
                "quotePrice": None, "quotePriceMin": None, "quotePriceMax": None,
                "questDeadline": "",
                "authorID": 102, "authorName": "陈同学", "authorAvatar": "", "authorScore": 120,
                "postTime": now_iso(140), "commentNum": 1, "attachments": [],
                "isSaved": True, "order": None,
            },
            {
                "postID": 103, "title": "小程序登录接口联调（UniSSO）",
                "content": "小程序端拿不到会话，怀疑是回调域名和 cookie 作用域的问题。需要熟悉 OAuth 的同学帮忙一起看一小时，能远程最好。",
                "postKind": "bounty", "questStatus": "open", "priceType": "range",
                "quotePrice": None, "quotePriceMin": 100, "quotePriceMax": 200,
                "questDeadline": now_iso(-60 * 24 * 3),
                "authorID": 103, "authorName": "计算机系助教", "authorAvatar": "", "authorScore": 2100,
                "postTime": now_iso(60 * 20), "commentNum": 0, "attachments": [],
                "isSaved": False, "order": None,
            },
            {
                "postID": 104, "title": "毕业设计论文排版与查重前检查",
                "content": "已完成，感谢帮忙的同学。留个记录给后面的人参考：模板用学校最新一版，图表题注一定用交叉引用。",
                "postKind": "bounty", "questStatus": "completed", "priceType": "fixed",
                "quotePrice": 500, "quotePriceMin": None, "quotePriceMax": None,
                "questDeadline": "",
                "authorID": 1, "authorName": "开发体验账号", "authorAvatar": "", "authorScore": 320,
                "postTime": now_iso(60 * 24 * 9), "commentNum": 1, "attachments": [],
                "isSaved": False, "order": None,
            },
        ],
        "comments": {
            "101": [
                {"PcommentID": 1, "Author": "王同学", "Content": "我做过类似的，可以帮你看看断点。", "CommentTime": now_iso(20)},
                {"PcommentID": 2, "Author": "林同学", "Content": "太好了，晚上方便吗？", "CommentTime": now_iso(12)},
            ],
            "102": [
                {"PcommentID": 3, "Author": "赵同学", "Content": "可以先从边权为负的情况理解两者的差别。", "CommentTime": now_iso(90)},
            ],
            "104": [
                {"PcommentID": 4, "Author": "计算机系助教", "Content": "排版已交付，注意页眉页码。", "CommentTime": now_iso(60 * 24 * 8)},
            ],
        },
        "peers": [
            {"userID": 101, "name": "林同学", "avatarURL": "", "lastMessagePreview": "晚上八点可以吗？"},
            {"userID": 102, "name": "陈同学", "avatarURL": "", "lastMessagePreview": "谢谢讲解，懂了！"},
        ],
        "chats": {
            "101": [
                {"chatMsgID": 1, "senderUserID": 101, "targetUserID": 1, "content": "你好，看到你的响应式需求了", "createdAt": now_iso(30)},
                {"chatMsgID": 2, "senderUserID": 1, "targetUserID": 101, "content": "你好！方便晚上一起看吗？", "createdAt": now_iso(28)},
                {"chatMsgID": 3, "senderUserID": 101, "targetUserID": 1, "content": "晚上八点可以吗？", "createdAt": now_iso(25)},
            ],
            "102": [
                {"chatMsgID": 4, "senderUserID": 1, "targetUserID": 102, "content": "我给你讲了下 Dijkstra", "createdAt": now_iso(80)},
                {"chatMsgID": 5, "senderUserID": 102, "targetUserID": 1, "content": "谢谢讲解，懂了！", "createdAt": now_iso(78)},
            ],
        },
        "feedback": [],
        "reports": [],
    }


def load_state():
    with LOCK:
        if STATE_FILE.exists():
            try:
                return json.loads(STATE_FILE.read_text(encoding="utf-8"))
            except Exception:
                pass
        data = seed()
        save_state(data)
        return data


def save_state(data):
    with LOCK:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = STATE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(STATE_FILE)


# 金额校验统一由 contracts/money_rules.py 提供（见文件顶部导入），此处不重复实现规则。


def peer_unread_map(st):
    """未读数落盘：点开会话清零后，刷新页面也不会再冒出来。"""
    m = st.get("peerUnread")
    if not isinstance(m, dict) or not m:
        demo = [2, 1, 0, 2, 1, 1, 0]
        m = {str(p["userID"]): demo[i % len(demo)] for i, p in enumerate(st.get("peers") or [])}
        st["peerUnread"] = m
        save_state(st)
    return m


def peer_unread_total(st):
    return sum(int(v or 0) for v in peer_unread_map(st).values())


def find_post(state, post_id):
    try:
        pid = int(post_id)
    except (TypeError, ValueError):
        return None
    return next((p for p in state["posts"] if p["postID"] == pid), None)


def with_comments(state, post):
    """列表 / 详情统一出口：评论数 + 浏览与沟通增量。

    基线仍留在演示快照里，增量只叠加在返回值上，避免每次读列表都写脏数据。
    """
    if not post:
        return None
    # 作者展示信息按 authorID 关联当前账号资料，历史快照不回写（契约 author-display.json）。
    item = with_current_author(dict(post), state["me"])
    item["commentNum"] = len(state["comments"].get(str(item["postID"]), []))
    delta = STATS.deltas(str(item["postID"]))
    item["viewCount"] = int(item.get("viewCount") or 0) + delta["view"]
    item["chatCount"] = int(item.get("chatCount") or 0) + delta["chat"]
    return item


def mock_dispatch(path, body, query, method="GET"):
    """返回 (status, payload)。payload 为 dict 或 list，由调用方序列化。"""
    st = load_state()
    me = st["me"]
    ok = {"code": 200, "msg": "ok", "data": {}}

    # ---- 发布者补充说明：同一套语义实现，身份与帖子归属由演示数据注入 ----
    if path.startswith("/mirror-api/notes/"):
        def resolve_post(post_id):
            post = find_post(st, post_id)
            return {"authorID": str(post["authorID"])} if post else None

        return handle_notes(
            path, method=method, query=query, body=body,
            actor={"id": str(me["userID"]), "name": me["name"]},
            resolve_post=resolve_post, store=NOTES,
        )

    # ---- 浏览 / 沟通计数：与生产后端共用 contracts/post_stats.py ----
    if path.startswith("/mirror-api/stats/"):
        def resolve_post(post_id):
            post = find_post(st, post_id)
            return {"authorID": str(post["authorID"])} if post else None

        def base_stats(post_id):
            post = find_post(st, post_id)
            if not post:
                return {}
            # 基线取演示快照里的原始值；增量另存 SQLite，不重复写快照
            return {"viewCount": int(post.get("viewCount") or 0),
                    "chatCount": int(post.get("chatCount") or 0)}

        return handle_stats(
            path, method=method, query=query, body=body,
            actor={"id": str(me["userID"]), "name": me["name"]},
            resolve_post=resolve_post, store=STATS, base=base_stats,
        )

    # ---- 账号 / 会话 ----
    if path in ("/api/auth/login", "/mirror-api/auth/login"):
        return 200, {"code": 200, "msg": "ok", "data": {"token": "dev-token"}, "token": "dev-token"}
    if path == "/mirror-api/auth/register/start":
        return 200, {"pendingId": "dev-pending", "ok": True}
    if path == "/mirror-api/auth/register/resend":
        return 200, {"ok": True}
    if path == "/mirror-api/auth/register/verify":
        return 200, {"token": "dev-token", "user": {"userID": 1}}
    if path in ("/mirror-api/auth/logout", "/mirror-api/auth/sso/try"):
        return 200, {"ok": True}
    if path == "/api/auth/quest/me":
        return 200, {"code": 200, "msg": "ok", "data": {"me": me}}

    # ---- 需求大厅 ----
    if path == "/api/auth/quest/list":
        items = [with_comments(st, p) for p in st["posts"]]
        kind = body.get("kind") or "all"
        if kind in ("bounty", "inquiry"):
            items = [p for p in items if p["postKind"] == kind]
        if body.get("status") and body["status"] != "all":
            items = [p for p in items if p.get("questStatus") == body["status"]]
        kw = (body.get("keyword") or "").strip()
        if kw:
            items = [p for p in items if kw in p["title"] or kw in p["content"]]
        if body.get("myPosts"):
            items = [p for p in items if p["authorID"] == me["userID"]]
        if body.get("saved"):
            items = [p for p in items if p["isSaved"]]
        if body.get("sort") == "price_desc":
            items.sort(key=lambda p: float(p.get("quotePrice") or p.get("quotePriceMax") or 0), reverse=True)
        elif body.get("sort") == "price_asc":
            items.sort(key=lambda p: float(p.get("quotePrice") or p.get("quotePriceMin") or 0))
        else:
            items.sort(key=lambda p: p["postTime"], reverse=True)
        return 200, {"code": 200, "msg": "ok", "data": {"items": items, "total": len(items)}}

    if path == "/api/auth/quest/detail":
        post = find_post(st, body.get("postID"))
        return (200, {"code": 200, "msg": "ok", "data": {"post": with_comments(st, post)}}) if post \
            else (404, {"code": 404, "msg": "帖子不存在"})

    if path == "/api/auth/quest/create":
        err = validate_price(body)
        if err:
            return 400, {"code": 400, "msg": err}
        pid = st["nextPostID"]
        st["nextPostID"] += 1
        post = {
            "postID": pid,
            "title": body.get("title") or "未命名需求",
            "content": body.get("content") or "",
            "postKind": body.get("postKind") or "inquiry",
            "questStatus": "open",
            "priceType": body.get("priceType") or "negotiable",
            "quotePrice": body.get("quotePrice"),
            "quotePriceMin": body.get("quotePriceMin"),
            "quotePriceMax": body.get("quotePriceMax"),
            "questDeadline": body.get("deadline") or "",
            "authorID": me["userID"], "authorName": me["name"],
            "authorAvatar": me.get("avatarURL", ""), "authorScore": me["score"],
            "postTime": now_iso(), "commentNum": 0,
            "attachments": [], "isSaved": False, "order": None,
        }
        st["posts"].insert(0, post)
        st["comments"][str(pid)] = []
        save_state(st)
        return 200, {"code": 200, "msg": "ok", "data": {"post": post}}

    if path == "/api/auth/quest/updateStatus":
        post = find_post(st, body.get("postID"))
        if post:
            post["questStatus"] = body.get("status") or post["questStatus"]
            save_state(st)
        return 200, ok

    if path == "/api/auth/deletePost":
        post = find_post(st, body.get("postID"))
        if post:
            st["posts"].remove(post)
            st["comments"].pop(str(post["postID"]), None)
            save_state(st)
        return 200, ok

    if path == "/api/auth/quest/levelRules":
        return 200, {"code": 200, "msg": "ok", "data": {"level": []}}

    if path == "/api/auth/quest/order/accept":
        post = find_post(st, body.get("postID"))
        if not post:
            return 404, {"code": 404, "msg": "帖子不存在"}
        order = {
            "workerID": me["userID"], "workerName": me["name"],
            "status": "in_progress", "submitNote": "",
        }
        post["order"] = order
        post["questStatus"] = "in_progress"
        save_state(st)
        return 200, {"code": 200, "msg": "ok", "data": {"order": order}}

    if path == "/api/auth/quest/order/submitComplete":
        post = find_post(st, body.get("postID"))
        if post:
            post["questStatus"] = "pending_confirm"
            if post.get("order"):
                post["order"]["submitNote"] = body.get("submitNote") or ""
            save_state(st)
        return 200, ok

    if path == "/api/auth/quest/order/confirmComplete":
        post = find_post(st, body.get("postID"))
        if post:
            post["questStatus"] = "completed"
            save_state(st)
        return 200, ok

    # ---- 评论 / 收藏 / 举报 / 反馈 ----
    if path == "/api/auth/showPcomments":
        return 200, st["comments"].get(str(body.get("postID")), [])

    if path == "/api/auth/postPcomment":
        key = str(body.get("postID"))
        bucket = st["comments"].setdefault(key, [])
        bucket.append({
            "PcommentID": int(time.time() * 1000),
            "Author": me["name"],
            "Content": body.get("content") or "",
            "CommentTime": now_iso(),
        })
        save_state(st)
        return 200, ok

    if path == "/api/auth/updateSave":
        post = find_post(st, body.get("postID"))
        if post:
            post["isSaved"] = not post["isSaved"]
            save_state(st)
            return 200, {"code": 200, "msg": "ok", "data": {"isSaved": post["isSaved"]}}
        return 200, {"code": 200, "msg": "ok", "data": {"isSaved": False}}

    if path == "/api/auth/submitReport":
        st["reports"].append({"postID": body.get("targetID"), "reason": body.get("reason")})
        save_state(st)
        return 200, ok

    if path == "/api/auth/submitFeedback":
        st["feedback"].append(body.get("ftext") or "")
        save_state(st)
        return 200, ok

    # ---- 个人资料 / 上传 ----
    if path == "/api/auth/getInfo":
        uid = body.get("userID") or query.get("userID", [""])[0]
        peer = next((p for p in st["peers"] if str(p["userID"]) == str(uid)), None)
        info = peer or {"userID": uid, "name": "用户", "avatarURL": ""}
        return 200, {"code": 200, "msg": "ok", "data": info, **info}

    if path == "/api/auth/updateUserInfo":
        if body.get("name"):
            me["name"] = body["name"]
        if body.get("avatarURL") is not None:
            me["avatarURL"] = body["avatarURL"]
        save_state(st)
        return 200, ok

    if path == "/api/auth/uploadAvatar":
        return 200, {"code": 200, "msg": "ok", "data": {"avatar_url": ""}, "avatar_url": ""}

    if path == "/api/auth/uploadPhotos":
        return 200, {"code": 200, "msg": "ok", "fileURL": ""}

    # ---- 私信 ----
    if path == "/api/auth/quest/chatPeers":
        m = peer_unread_map(st)
        peers = []
        for p in st["peers"]:
            item = dict(p, unread=int(m.get(str(p["userID"]), 0)))
            # 会话时间取真实记录：优先聊天最后一条，没有聊天就用该作者帖子的发布时间
            history = st["chats"].get(str(p["userID"]), [])
            if history:
                item["lastMessageTime"] = str(history[-1].get("createdAt") or "")
            else:
                authored = next((q for q in st["posts"] if q.get("authorID") == p["userID"]), None)
                item["lastMessageTime"] = str(authored.get("postTime") or "") if authored else ""
            peers.append(item)
        return 200, {"code": 200, "msg": "ok", "data": {"peers": peers}}
    if path == "/api/auth/quest/readChat":
        uid = body.get("targetUserID") or body.get("userID") or body.get("peerID")
        peer_unread_map(st)[str(uid)] = 0
        save_state(st)
        return 200, {"code": 200, "msg": "ok", "data": {"noticeNum": peer_unread_total(st)}}


    if path == "/api/auth/getChatHistory":
        key = str(query.get("targetUserID", [""])[0])
        return 200, {"code": 200, "msg": "ok", "data": {"chatHistoryList": st["chats"].get(key, [])}}

    if path == "/api/auth/getNoticeNum":
        return 200, {"code": 200, "msg": "ok", "unreadTotalNum": 0}

    if path == "/api/auth/getChatNotice":
        return 200, {"code": 200, "msg": "ok", "data": {"noticeNum": peer_unread_total(st)}}

    return 404, {"code": 404, "msg": f"dev mock 未实现: {path}"}


class Gateway(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "mirror-dev-gateway/1.0"

    def log_message(self, fmt, *args):
        print(f"{self.log_date_time_string()} {fmt % args}", flush=True)

    # ---------- 工具 ----------
    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _is_mock(self, path):
        return (path.startswith("/api/")
                or path.startswith("/mirror-api/auth/")
                or path.startswith("/mirror-api/notes/")
                or path.startswith("/mirror-api/stats/"))

    # ---------- 请求分发 ----------
    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/websocket/auth/chat":
            self._websocket()
            return
        if parsed.path == "/mirror-api/healthz":
            self._json(200, {"ok": True, "service": "mirror-dev", "db": "ok"})
            return
        if self._is_mock(parsed.path):
            status, payload = mock_dispatch(parsed.path, {}, parse_qs(parsed.query), "GET")
            self._json(status, payload)
            return
        self._proxy("GET", None)

    def do_HEAD(self):
        self._proxy("HEAD", None)

    def do_POST(self):
        raw = self._read_body()
        parsed = urlsplit(self.path)
        if self._is_mock(parsed.path):
            try:
                body = json.loads(raw.decode("utf-8")) if raw else {}
            except Exception:
                body = {}  # multipart 上传不解析内容，直接给假结果
            status, payload = mock_dispatch(
                parsed.path, body if isinstance(body, dict) else {},
                parse_qs(parsed.query), "POST",
            )
            self._json(status, payload)
            return
        self._proxy("POST", raw)

    def _proxy(self, method, raw):
        """dev 默认自给自足：静态产物由本进程托管。

        只有显式配置 MIRROR_DEV_UPSTREAM 时才转发给真后端；
        /mirror-api/* 未命中的演示接口一律回 JSON 错误，绝不回退成 index.html，
        避免前端把 HTML 当 JSON 解析而刷出一堆控制台错误。
        """
        parsed = urlsplit(self.path)
        if parsed.path.startswith("/mirror-api/"):
            if not UPSTREAM:
                return self._json(502, {"error": "upstream not configured in dev mode"})
        elif not UPSTREAM:
            return self._static(method)
        if UPSTREAM:
            url = UPSTREAM + self.path
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in ("host", "content-length", "connection", "accept-encoding")}
            if raw is not None:
                headers["Content-Length"] = str(len(raw))
            req = urllib.request.Request(url, data=raw if method == "POST" else None,
                                         headers=headers, method=method)
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    body, status = resp.read(), resp.status
                    ctype = resp.headers.get("Content-Type", "application/octet-stream")
            except urllib.error.HTTPError as exc:
                body, status = exc.read(), exc.code
                ctype = exc.headers.get("Content-Type", "application/octet-stream")
            except Exception as exc:
                body = json.dumps({"error": f"upstream unavailable: {exc}"}).encode()
                status, ctype = 502, "application/json"
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if method != "HEAD":
                self.wfile.write(body)
            return
        self._json(404, {"error": "not found"})

    # ---------- 静态产物 ----------
    CONTENT_TYPES = {
        ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
        ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon",
        ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp",
    }

    def _static(self, method):
        parsed = urlsplit(self.path)
        target = (DIST / parsed.path.lstrip("/")).resolve()
        if not str(target).startswith(str(DIST.resolve())):
            return self._json(403, {"error": "forbidden"})
        # 带扩展名的资源找不到就老实 404，别把 index.html 当 js 回给浏览器
        if target.suffix and (not target.exists() or target.is_dir()):
            self.send_response(404)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if not target.exists() or target.is_dir():
            target = DIST / "index.html"
        if not target.is_file():
            return self._json(503, {"error": "web/dist/index.html missing"})
        body = target.read_bytes()
        if target.name == "index.html" and DEV_NO_LOGIN:
            inject = (b'<script>try{localStorage.setItem("quest_token","dev-token")}'
                      b'catch(e){}</script>')
            body = body.replace(b"</head>", inject + b"</head>")
        ctype = self.CONTENT_TYPES.get(target.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if method != "HEAD":
            self.wfile.write(body)

    # ---------- 极简 WebSocket：回声 + 一句演示回复 ----------
    def _websocket(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
        self.wfile.write(
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            + f"Sec-WebSocket-Accept: {accept}\r\n\r\n".encode()
        )
        self.wfile.flush()
        self.close_connection = True
        while True:
            try:
                head = self.rfile.read(2)
                if len(head) < 2:
                    break
                opcode = head[0] & 0x0F
                masked = head[1] & 0x80
                length = head[1] & 0x7F
                if length == 126:
                    length = struct.unpack("!H", self.rfile.read(2))[0]
                elif length == 127:
                    length = struct.unpack("!Q", self.rfile.read(8))[0]
                mask = self.rfile.read(4) if masked else b""
                data = self.rfile.read(length)
                if masked:
                    data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
                if opcode == 8:
                    break
                if opcode != 1:
                    continue
                try:
                    msg = json.loads(data.decode("utf-8"))
                except Exception:
                    continue
                if not msg.get("beat") and msg.get("content"):
                    reply = {
                        "chatMsgID": int(time.time() * 1000),
                        "senderUserID": msg.get("targetUserID"),
                        "targetUserID": msg.get("senderUserID"),
                        "content": "收到啦～（dev 演示自动回复）",
                        "createdAt": datetime.now().isoformat(timespec="seconds"),
                    }
                    self._ws_send(json.dumps(reply, ensure_ascii=False))
            except Exception:
                break

    def _ws_send(self, text):
        payload = text.encode("utf-8")
        n = len(payload)
        if n < 126:
            header = bytes([0x81, n])
        elif n < 65536:
            header = bytes([0x81, 126]) + struct.pack("!H", n)
        else:
            header = bytes([0x81, 127]) + struct.pack("!Q", n)
        self.wfile.write(header + payload)
        self.wfile.flush()


def main():
    if not DEV_MODE:
        raise SystemExit(
            "dev gateway 仅允许在 MIRROR_DEV_MODE=1 的独立 dev Pod 启动；"
            "生产请用 run.sh / deploy.sh 默认路径")
    if not (DIST / "index.html").is_file():
        raise SystemExit(f"缺少静态产物 {DIST}/index.html — 请先执行 npm run build")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    load_state()
    print(f"[mirror-dev] DEV MODE：UniSSO / 主站均不接入，演示数据隔离于 {DATA_DIR}", flush=True)
    print(f"[mirror-dev] 静态 {DIST} | 上游 {UPSTREAM or '(未配置，自给自足)'}", flush=True)
    print(f"[mirror-dev] listening on 0.0.0.0:{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Gateway).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
