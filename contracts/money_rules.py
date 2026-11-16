"""金额规则的服务端唯一实现，前端读同一份 money-rules.json。

调用方：
- server.py 的 /mirror-api/orders/create -> validate_budget(value)
- dev 演示网关 /api/auth/quest/create   -> validate_quest_price(body)

契约文件缺失时直接启动失败：宁可报错，也不能静默退回旧规则把脏金额写进库。
"""
import json
import re
from decimal import Decimal
from pathlib import Path

RULES_PATH = Path(__file__).with_name("money-rules.json")


def load_rules(path=RULES_PATH):
    with Path(path).open(encoding="utf-8") as handle:
        rules = json.load(handle)
    for key in ("min", "max", "maxDecimalPlaces"):
        if not isinstance(rules.get(key), int):
            raise ValueError("money-rules.json 缺少或非法的 %s" % key)
    if rules["min"] > rules["max"] or rules["min"] <= 0:
        raise ValueError("money-rules.json 的金额区间非法")
    return rules


RULES = load_rules()
_AMOUNT_RE = re.compile(r"^\d+(?:\.\d{1,%d})?$" % RULES["maxDecimalPlaces"])


def message(key, label=""):
    text = RULES["messages"][key]
    return (text.replace("{label}", label)
                .replace("{min}", str(RULES["min"]))
                .replace("{max}", str(RULES["max"]))
                .replace("{decimals}", str(RULES["maxDecimalPlaces"])))


def parse_amount(raw, label):
    """返回 (Decimal, '') 或 (None, 中文错误)。

    先转字符串再校验：既挡住科学计数法（1e9）、布尔值、多余小数位，
    也避免 float 精度问题让 99.999 被四舍五入成合法值。
    """
    text = "" if raw is None else str(raw).strip()
    if not text:
        return None, message("required", label)
    if not _AMOUNT_RE.fullmatch(text):
        return None, message("format", label)
    amount = Decimal(text)
    if amount < Decimal(RULES["min"]):
        return None, message("belowMin", label)
    if amount > Decimal(RULES["max"]):
        return None, message("aboveMax", label)
    return amount, ""


def validate_quest_price(body):
    """集市发帖接口：返回空串表示通过，否则是可直接展示的中文原因。"""
    if (body.get("postKind") or "inquiry") != "bounty":
        return ""
    price_type = body.get("priceType") or "negotiable"
    labels = RULES["labels"]
    if price_type == "fixed":
        return parse_amount(body.get("quotePrice"), labels["fixed"])[1]
    if price_type == "range":
        low, err = parse_amount(body.get("quotePriceMin"), labels["min"])
        if err:
            return err
        high, err = parse_amount(body.get("quotePriceMax"), labels["max"])
        if err:
            return err
        if low > high:
            return RULES["messages"]["rangeOrder"]
    return ""


def validate_budget(value):
    """镜像站订单接口：返回 (类型, 下限|None, 上限|None, 错误文案)。"""
    budget_type = value.get("budgetType")
    if budget_type not in ("fixed", "range", "negotiable"):
        budget_type = "negotiable"
    if budget_type == "negotiable":
        return budget_type, None, None, ""

    labels = RULES["labels"]
    if budget_type == "fixed":
        amount, err = parse_amount(value.get("budgetMin"), labels["fixed"])
        return budget_type, amount if not err else None, None, err

    low, err = parse_amount(value.get("budgetMin"), labels["min"])
    if err:
        return budget_type, None, None, err
    high, err = parse_amount(value.get("budgetMax"), labels["max"])
    if err:
        return budget_type, None, None, err
    if low > high:
        return budget_type, None, None, RULES["messages"]["rangeOrder"]
    return budget_type, low, high, ""
