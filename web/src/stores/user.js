import { reactive } from 'vue'
import { fetchQuestMe } from '../api/auth'
import { getToken, setToken } from '../api/client'
import { setUnreadScope } from './unread'

const state = reactive({
  token: getToken(),
  me: null,
})

export function useUserStore() {
  return {
    get token() { return state.token },
    get me() { return state.me },
    loadFromStorage() {
      state.token = getToken()
    },
    logout() {
      state.token = ''
      state.me = null
      setUnreadScope(null)
      setToken('')
    },
    setToken(t) {
      state.token = t
      setToken(t)
      if (!t) {
        state.me = null
        setUnreadScope(null)
      }
    },
    async refreshMe() {
      if (!state.token)
        return null
      const me = await fetchQuestMe()
      state.me = me
      // 已读基线按账号隔离，换号登录后不会串到别人的红点
      setUnreadScope(me?.userID || state.token)
      return me
    },
  }
}
