// 全局响应式状态（Svelte 5 runes）。所有业务数据来自服务端 /api/bootstrap。
export const SKILLS = ['C++', 'Vue', 'Python', 'Java', '数据结构', '算法', 'Figma', '响应式', 'UniSSO', '论文排版', '小程序', 'Git']
export const CATS = ['全部', '前端', '后端', '设计', '文案', '答疑']
export const NAV = [
  { k: 'hall', t: '需求广场' },
  { k: 'publish', t: '发布需求' },
  { k: 'chat', t: '消息' },
  { k: 'me', t: '我的' },
]
export const BOTTOM = [
  { k: 'hall', t: '广场', i: 'home' },
  { k: 'publish', t: '发布', i: 'plus' },
  { k: 'chat', t: '消息', i: 'chat' },
  { k: 'me', t: '我的', i: 'user' },
]
export const ALLOWED = ['hall', 'publish', 'chat', 'me', 'manage', 'applied']

export const app = $state({
  loading: true,
  me: null,
  posts: [],
  peers: [],
  applied: [],
  favorites: [],
  tab: 'hall',
  stack: [{ name: 'list' }],
  cat: '全部',
  skill: '',
  hallQ: '',
  chatQ: '',
  searchQ: '',
  unreadOnly: false,
  peer: 0,
  draftMsg: '',
  viewed: {},
  draft: { title: '', price: '', negotiable: false, cat: '前端', deadline: '', desc: '' },
  draftSkills: [],
  toast: '',
  authOpen: false,
  authTitle: '登录进入社区',
  authSub: '使用统一身份认证账号登录后即可发布需求、报名与私聊。',
  authBusy: false,
  pending: null,
  searchOpen: false,
  filterOpen: false,
  userMenuOpen: false,
})

export const isGuest = () => !app.me
export const route = () => app.stack[app.stack.length - 1]
export const postById = (id) => app.posts.find((p) => p.id === Number(id)) || null
export const peerById = (id) => app.peers.find((p) => p.id === Number(id)) || null
export const anyPeer = (id) => peerById(id) || { id, name: '同学', school: '中山大学', credit: 96, skills: [] }
export const unreadOf = (p) => (p.unread > 0 ? p.unread : 0)
export const unreadTotal = () => app.peers.reduce((s, p) => s + unreadOf(p), 0)
export const money = (p) => (p.price === '面议' ? '面议' : p.price > 0 ? '¥' + p.price : '互助')