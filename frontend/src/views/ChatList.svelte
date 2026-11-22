<script>
  import { app, unreadOf, unreadTotal } from '../state.svelte.js'
  import { openThread, markAllRead } from '../actions.js'
  import SideBar from '../lib/SideBar.svelte'

  const list = $derived(app.peers.filter((p) => {
    if (app.unreadOnly && unreadOf(p) === 0) return false
    if (app.chatQ) {
      const q = app.chatQ.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !p.skills.join(' ').toLowerCase().includes(q)) return false
    }
    return true
  }))
</script>

<div class="layout">
  <div class="layout__main">
    <div class="card">
      <div class="convhead">
        <span class="convhead__title">我的消息 <span style="color:var(--muted);font-size:12px;font-weight:400">{app.peers.length}</span></span>
        <input class="search" placeholder="搜联系人或技能" bind:value={app.chatQ} />
        <div class="tabs">
          <button type="button" class:on={!app.unreadOnly} onclick={() => { app.unreadOnly = false }}>全部</button>
          <button type="button" class:on={app.unreadOnly} onclick={() => { app.unreadOnly = true }}>未读 {unreadTotal()}</button>
        </div>
        <button type="button" class="markall" onclick={markAllRead}>全部标为已读</button>
      </div>
      {#if list.length}
        {#each list as p (p.id)}
          {@const n = unreadOf(p)}
          <div class="peer" role="button" tabindex="0" onclick={() => openThread(p.id)}
                   onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThread(p.id) } }}>
            <div class="av">{p.name[0]}</div>
            <div class="peer__b">
              <div class="row"><b>{p.name}</b><time>{p.time}</time></div>
              <p>
                {#if n}<span style="color:var(--red)">[未读] </span>{:else}<span style="color:var(--muted)">[已读] </span>{/if}{p.last}
              </p>
              <div class="sk">{#each p.skills.slice(0, 3) as s}<span>{s}</span>{/each}</div>
            </div>
            {#if n}<span class="badge">{n > 99 ? '99+' : n}</span>{/if}
          </div>
        {/each}
      {:else}
        <div class="empty"><b>还没有会话</b>在需求详情里点「私聊发布者」开始沟通</div>
      {/if}
    </div>
  </div>
  <SideBar kind="list" />
</div>