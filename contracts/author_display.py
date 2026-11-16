#!/usr/bin/env python3
"""发布者展示信息：与 HTTP 无关的语义层，前后端共用 author-display.json。

帖子 / 批注里存的 authorName 等只是「发布当时」的快照；账号改名后，
展示前按 authorID 关联当前账号资料，避免出现同一个人显示两个名字。
不回写历史数据：批量改库既容易漏，也会抹掉发布当时的原始记录。

调用方：
- 生产后端 server.py：不返回帖子内容，帖子由主站 API 直出，前端兜底解析；
- dev 演示网关 / 本地试玩包：列表、详情统一出口调用 with_current_author。
"""
import json
from pathlib import Path

RULES_PATH = Path(__file__).with_name("author-display.json")


def load_rules(path=RULES_PATH):
    with Path(path).open(encoding="utf-8") as handle:
        rules = json.load(handle)
    for key in ("identityField", "accountIdField", "fields"):
        if not rules.get(key):
            raise ValueError("author-display.json 缺少或非法的 %s" % key)
    return rules


RULES = load_rules()


def with_current_author(record, me, rules=RULES):
    """返回一份新的 dict，绝不修改入参；只有身份匹配时才覆盖展示字段。

    别人的资料调用方拿不到，保持后端返回的快照不变。
    宽松比较兼容真后端返回字符串 ID、演示数据使用数字 ID 的情况。
    """
    if not isinstance(record, dict) or not isinstance(me, dict):
        return record
    record_id = record.get(rules["identityField"])
    account_id = me.get(rules["accountIdField"])
    if record_id in (None, "") or account_id in (None, ""):
        return record
    if str(record_id) != str(account_id):
        return record
    resolved = dict(record)
    for target, source in rules["fields"].items():
        value = me.get(source)
        if value is not None:
            resolved[target] = value
    return resolved
