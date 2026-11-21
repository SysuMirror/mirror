import { reactive } from 'vue'

// 静态还原：登录态用一个本地开关模拟。接真实后端时把 token 换成 /mirror-api 签发的会话。
export const session = reactive({
  token: '',
  me: null,
  isAdmin: true,
  get loggedIn() {
    return Boolean(this.token)
  },
  login(token) {
    this.token = token
  },
  logout() {
    this.token = ''
    this.me = null
  },
})
