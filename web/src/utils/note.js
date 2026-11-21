import rules from '../../../contracts/note-rules.json'

/**
 * 发布者补充说明的规则唯一真源是 contracts/note-rules.json。
 * 前端只做即时提示与字数统计，是否允许写入由服务端按同一份契约裁决；
 * 净化规则必须与 contracts/note_rules.py 的 clean_note 保持一致，
 * scripts/verify.mjs 会用同一组边界用例比对两端结果。
 */
export const NOTE_MAX_LENGTH = rules.maxLength
export const NOTE_MAX_PER_POST = rules.maxPerPost

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function noteMessage(key, params = {}) {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    String(rules.messages[key] || key),
  )
}

/** 码点长度：与 Python len(str) 一致，emoji 不会被算成两个字。 */
export function noteLength(text) {
  return [...String(text ?? '')].length
}

export function cleanNote(raw) {
  if (typeof raw !== 'string')
    return { text: '', error: noteMessage('format') }
  const text = String(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text, error: '' }
}

export function validateNote(raw) {
  const { text, error } = cleanNote(raw)
  if (error)
    return { text, error }
  if ([...text].length < rules.minLength)
    return { text, error: noteMessage('required') }
  if ([...text].length > rules.maxLength)
    return { text, error: noteMessage('tooLong', { max: rules.maxLength }) }
  return { text, error: '' }
}

/** 返回空串表示可以提交，否则是可直接展示给用户的中文原因。 */
export function noteError(raw) {
  return validateNote(raw).error
}
