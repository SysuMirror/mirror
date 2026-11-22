<script>
  import { app } from '../state.svelte.js'
  import { goTab, openPublish, logout } from '../actions.js'
  import SideBar from '../lib/SideBar.svelte'
  const name = $derived(app.me ? app.me.name : '同学')
  const initial = $derived(name ? name.slice(0, 1) : '我')
</script>

<div class="layout">
  <div class="layout__main">
    <div class="card myhead">
      <div class="av lg">{initial}</div>
      <div><h2>{name}</h2><p>{app.me?.school || ''} · {app.me?.email || ''}</p></div>
      <div class="credit"><b>{app.me?.credit ?? 96}</b><small style="color:var(--muted);font-size:11px">信用分</small></div>
    </div>
    <div class="card links">
      <a href="#manage" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); goTab('manage') }} onkeydown={(e) => { if (e.key === 'Enter') goTab('manage') }}><span>我发布的需求</span><span>›</span></a>
      <a href="#applied" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); goTab('applied') }} onkeydown={(e) => { if (e.key === 'Enter') goTab('applied') }}><span>我的报名</span><span>›</span></a>
      <a href="#chat" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); goTab('chat') }} onkeydown={(e) => { if (e.key === 'Enter') goTab('chat') }}><span>消息</span><span>›</span></a>
      <a href="#publish" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); openPublish() }} onkeydown={(e) => { if (e.key === 'Enter') openPublish() }}><span>发布需求</span><span>›</span></a>
    </div>
    <div class="card links">
      <a href="#logout" class="danger" role="button" tabindex="0" onclick={(e) => { e.preventDefault(); logout() }} onkeydown={(e) => { if (e.key === 'Enter') logout() }}><span>退出登录</span><span>›</span></a>
    </div>
  </div>
  <SideBar kind="list" />
</div>