import rules from '../../../contracts/money-rules.json'

/**
 * 金额规则的唯一真源是仓库根的 contracts/money-rules.json。
 * 前端（本文件）、生产后端 server.py、两个 dev 演示网关都从它取值；
 * 改上下限或小数位只改那一个文件，scripts/verify.mjs 会检查各端一致并跑边界用例。
 */
export const MONEY_MIN = rules.min
export const MONEY_MAX = rules.max
export const MONEY_DECIMALS = rules.maxDecimalPlaces
export const MONEY_LABELS = rules.labels
export const MONEY_RANGE_ORDER = rules.messages.rangeOrder

const MONEY_PATTERN = new RegExp(`^\\d+(\\.\\d{1,${rules.maxDecimalPlaces}})?$`)

function message(key, label) {
  return String(rules.messages[key])
    .replaceAll('{label}', label)
    .replaceAll('{min}', String(rules.min))
    .replaceAll('{max}', String(rules.max))
    .replaceAll('{decimals}', String(rules.maxDecimalPlaces))
}

export const MONEY_HINT = message('hint', '')

// 输入时只做「格式净化」：去掉非数字、只留一个小数点、限制小数位。
// 不在这里截断大小 —— 超过上限要让用户看见明确的提示，而不是悄悄改掉他输入的数。
export function normalizeMoneyInput(raw) {
  let v = String(raw ?? '').replace(/[^\d.]/g, '')
  const dot = v.indexOf('.')
  if (dot >= 0)
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
  const parts = v.split('.')
  const int = parts[0].replace(/^0+(?=\d)/, '').slice(0, rules.maxInputIntegerDigits)
  return parts.length > 1 ? `${int}.${parts[1].slice(0, rules.maxDecimalPlaces)}` : int
}

export function parseMoney(v) {
  const s = String(v ?? '').trim()
  if (!MONEY_PATTERN.test(s))
    return Number.NaN
  return Number(s)
}

export function moneyError(v, label = rules.labels.default) {
  const s = String(v ?? '').trim()
  if (!s)
    return message('required', label)
  const n = parseMoney(s)
  if (!Number.isFinite(n))
    return message('format', label)
  if (n < MONEY_MIN)
    return message('belowMin', label)
  if (n > MONEY_MAX)
    return message('aboveMax', label)
  return ''
}

// 返回空串表示通过，否则是可直接展示给用户的中文原因
export function priceRangeError(priceType, fixed, min, max) {
  if (priceType === 'fixed')
    return moneyError(fixed, rules.labels.fixed)
  if (priceType === 'range') {
    const low = moneyError(min, rules.labels.min)
    if (low)
      return low
    const high = moneyError(max, rules.labels.max)
    if (high)
      return high
    if (parseMoney(min) > parseMoney(max))
      return rules.messages.rangeOrder
  }
  return ''
}
