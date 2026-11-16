import rules from '../../../contracts/author-display.json'

/**
 * 发布者展示信息的唯一真源是当前账号资料（author-display.json）。
 *
 * 帖子 / 补充说明里返回的 authorName / authorAvatar / authorScore 只是发布
 * 那一刻的快照，账号改名后会变旧。展示前按 authorID 重新解析，不改后端数据，
 * 也不把「是谁」的判断散落到各个组件里。
 *
 * 后端只认识 authorID，前端拿不到别人的最新资料，因此别人的帖子保持原样。
 * 宽松比较兼容真后端返回字符串 ID、演示数据用数字 ID 的情况。
 *
 * 同一套身份比较也供「我发布的」「是不是本人」等判断复用，避免各处各写一个 ===。
 *
 * @returns {boolean} 两个 ID 是否指向同一个账号（宽松字符串比较）
 */
export function sameAccountId(a, b) {
  if (a === undefined || a === null || a === ''
    || b === undefined || b === null || b === '')
    return false
  return String(a) === String(b)
}

export function isSameAccount(record, me) {
  if (!record || typeof record !== 'object' || !me || typeof me !== 'object')
    return false
  return sameAccountId(record[rules.identityField], me[rules.accountIdField])
}

/**
 * @returns {object} 新的对象（身份不匹配时原样返回），绝不修改入参
 */
export function withCurrentAuthor(record, me) {
  if (!isSameAccount(record, me))
    return record
  const resolved = { ...record }
  for (const [target, source] of Object.entries(rules.fields)) {
    const value = me[source]
    if (value !== undefined && value !== null)
      resolved[target] = value
  }
  return resolved
}
