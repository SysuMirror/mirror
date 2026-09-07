import { reactive } from 'vue'
import { fetchQuestMe } from '../api/auth'
import { getToken, setToken } from '../api/client'

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
      setToken('')
    },
    setToken(t) {
      state.token = t
      setToken(t)
    },
    async refreshMe() {
      if (!state.token)
        return null
      state.me = await fetchQuestMe()
      return state.me
    },
  }
}
