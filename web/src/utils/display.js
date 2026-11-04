export const DEFAULT_AVATAR = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect fill="#f2f3f5" width="64" height="64"/><circle cx="32" cy="26" r="12" fill="#8f959e"/><path d="M12 58c4-14 16-20 20-20s16 6 20 20" fill="#8f959e"/></svg>',
)

export const STATUS_LABEL = {
  open: '可接',
  in_progress: '进行中',
  pending_confirm: '待确认',
  completed: '已完成',
  cancelled: '已取消',
}

/** 与集市 Reward.md / newSSE level.ts 一致 */
export const QUEST_LEVELS = [
  { code: 'lv0', name: 'Lv0 菜鸟', min: 0, max: 99 },
  { code: 'lv1', name: 'Lv1 大虾', min: 100, max: 299 },
  { code: 'lv2', name: 'Lv2 码农', min: 300, max: 599 },
  { code: 'lv3', name: 'Lv3 程序猿', min: 600, max: 999 },
  { code: 'lv4', name: 'Lv4 工程师', min: 1000, max: 1999 },
  { code: 'lv5', name: 'Lv5 大牛', min: 2000, max: 2999 },
  { code: 'lv6', name: 'Lv6 专家', min: 3000, max: 3999 },
  { code: 'lv7', name: 'Lv7 大神', min: 4000, max: 4999 },
  { code: 'lv8', name: '祖师爷', min: 5000, max: 999999 },
]

export function levelLabel(score) {
  const s = Number(score) || 0
  for (const lv of QUEST_LEVELS) {
    if (s >= lv.min && s <= lv.max)
      return lv.name
  }
  return QUEST_LEVELS[0].name
}

export function avatarUrl(url) {
  const u = (url || '').trim()
  return u || DEFAULT_AVATAR
}

/** @returns {{ kind: 'money'|'muted', yen?: string, num?: string, text?: string }} */
export function priceBand(post) {
  if (!post || post.postKind === 'inquiry')
    return { kind: 'muted', text: '求帮' }

  const type = post.priceType || (post.quotePrice != null ? 'fixed' : 'negotiable')
  if (type === 'fixed' && post.quotePrice != null)
    return { kind: 'money', yen: '¥', num: String(post.quotePrice) }
  if (type === 'range' && post.quotePriceMin != null && post.quotePriceMax != null)
    return { kind: 'money', yen: '¥', num: `${post.quotePriceMin}–${post.quotePriceMax}` }
  if (post.quotePrice != null)
    return { kind: 'money', yen: '¥', num: String(post.quotePrice) }
  return { kind: 'muted', text: '面议' }
}

export function formatPrice(post) {
  const band = priceBand(post)
  if (band.kind === 'money')
    return `${band.yen}${band.num}`
  return band.text
}

export function formatDeadline(d) {
  if (!d)
    return ''
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime()))
    return ''
  return dt.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function relativeTime(iso) {
  if (!iso)
    return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t))
    return ''
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1)
    return '刚刚'
  if (m < 60)
    return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24)
    return `${h}小时前`
  const d = Math.floor(h / 24)
  if (d < 7)
    return `${d}天前`
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
