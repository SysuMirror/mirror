import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { refresh, requireLogin, openPublish, goTab } from './actions.js'
import { app } from './state.svelte.js'

const instance = mount(App, { target: document.getElementById('app') })

refresh()
  .then(() => {
    app.loading = false
    const go = new URLSearchParams(location.search).get('go') || ''
    if (go === 'login') requireLogin(null)
    else if (go === 'publish') openPublish()
    else if (go === 'me' || go === 'chat') goTab(go)
  })
  .catch(() => { app.loading = false })

export default instance