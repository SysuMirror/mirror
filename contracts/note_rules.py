#!/usr/bin/env python3
"""发布者补充说明（批注）的规则真源。

与 contracts/money_rules.py 同样遵守「单一真源」：
- 数值与文案只在 note-rules.json 定义，前端直接 import 这份 JSON；
- 生产后端 server.py、本地试玩包各自持有一份本文件的副本，
  由 scripts/verify.mjs 强制比对一致，契约缺失时启动即报错，不静默降级。
"""

import json
import re
from pathlib import Path

RULES_PATH = Path(__file__).with_name("note-rules.json")
if not RULES_PATH.is_file():
    raise RuntimeError("缺少 contracts/note-rules.json，补充说明契约不可用")

RULES = json.loads(RULES_PATH.read_text(encoding="utf-8"))
MIN_LENGTH = int(RULES["minLength"])
MAX_LENGTH = int(RULES["maxLength"])
MAX_PER_POST = int(RULES["maxPerPost"])
MESSAGES = RULES["messages"]

# 控制字符会破坏排版、也可能被当成隐藏内容；换行与制表符保留。
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_BLANK_RUN = re.compile(r"\n{3,}")


def message(key, **params):
    text = str(MESSAGES.get(key, key))
    for name, value in params.items():
        text = text.replace("{" + name + "}", str(value))
    return text


def normalize_post_id(value):
    """只接受纯数字 ID；杜绝把任意字符串当作存储键写进库。"""
    if isinstance(value, bool):
        return ""
    if isinstance(value, int):
        raw = str(value)
    elif isinstance(value, str):
        raw = value.strip()
    else:
        return ""
    if not raw.isdigit() or len(raw) > 20 or int(raw) <= 0:
        return ""
    return str(int(raw))


def clean_note(raw):
    """返回 (净化后的文本, 格式错误)。长度按 Unicode 码点计，与 JS [...s].length 一致。"""
    if not isinstance(raw, str):
        return "", message("format")
    text = _CONTROL.sub("", raw.replace("\r\n", "\n").replace("\r", "\n"))
    text = _BLANK_RUN.sub("\n\n", text)
    return text.strip(), ""


def validate_note(raw):
    """返回 (可入库文本, 可直接展示给用户的错误)；错误为空串表示合法。"""
    text, err = clean_note(raw)
    if err:
        return "", err
    if len(text) < MIN_LENGTH:
        return text, message("required")
    if len(text) > MAX_LENGTH:
        return text, message("tooLong", max=MAX_LENGTH)
    return text, ""
