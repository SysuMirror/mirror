<script>
  import { app, peerById, postById, money } from '../state.svelte.js'
  import { back, openPost, sendMessage } from '../actions.js'
  import SideBar from '../lib/SideBar.svelte'
  import { ICONS } from '../lib/icons.js'
  let { id } = $props()
  const peer = $derived(peerById(id))
  const related = $derived(peer ? (postById(peer.postId) || app.posts[0]) : null)
  let logEl = $state(null)
  $effect(() => {
    const n = peer?.messages?.length
    if (logEl) logEl.scrollTop = logEl.scrollHeight
  })
  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage() }
  }
</script>

<div class="detail-wrap">
  <div class="backbar" role="button" tabindex="0" onclick={back} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back() } }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{@html ICONS.back}</svg>返回列表
  </div>
  {#if peer}
    <div class="layout">
      <div class="layout__main">
        <div class="card thread">
          <div class="thread__h">
            <div class="av">{peer.name[0]}</div>
            <div><b>{peer.name}</b><small>{peer.online ? '在线' : '离线'} · 信用 {peer.credit}</small></div>
            <div class="ops">
              {#if related}<button type="button" onclick={() => openPost(related.id)}>查看需求</button>{/if}
            </div>
          </div>
          {#if related}
            <div class="ctx" role="button" tabindex="0" onclick={() => openPost(related.id)}
                 onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(related.id) } }}>
              <div class="ctx__i">
                <small>正在沟通的需求 · 上下文不丢</small>
                <b>{related.title}</b>
                <span class="needtag">需要 {related.skills.slice(0, 2).join(' / ')}</span>
                <span class="price">{money(related)}</span>
              </div>
              <span class="ctx__go">去看看</span>
            </div>
          {/if}
          <div class="thread__log" bind:this={logEl}>
            <div class="day">今天</div>
            {#if related}<div class="sys">以上是会话开始 · 需求 #{related.id}</div>{/if}
            {#each peer.messages as m, i (i)}
              {#if m.type === 'card'}
                {@const cp = postById(m.postId)}
                {#if cp}
                  <div class="msg">
                    <div class="av">{peer.name[0]}</div>
                    <div class="msg__c">
                      <div class="who">{peer.name}</div>
                      <div class="cardmsg" role="button" tabindex="0" onclick={() => openPost(cp.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(cp.id) } }}>
                        <div class="cardmsg__b"><b>{cp.title}</b></div>
                        <div class="cardmsg__f"><span>{money(cp)}</span><span>点击查看 ›</span></div>
                      </div>
                    </div>
                  </div>
                {/if}
              {:else}
                <div class="msg" class:mine={m.t === 'me'}>
                  {#if m.t !== 'me'}<div class="av">{peer.name[0]}</div>{/if}
                  <div class="msg__c">
                    {#if m.t !== 'me'}<div class="who">{peer.name}</div>{/if}
                    {#if m.type === 'file'}
                      <div class="filemsg"><i>PDF</i><div><b>{m.name}</b><small>{m.size}</small></div></div>
                    {:else}
                      <div class="bubble">{m.text}</div>
                    {/if}
                    <div class="stamp">{m.at}</div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>
          <div class="compose">
            <div class="compose__row">
              <input id="msgInput" placeholder="说点什么…" bind:value={app.draftMsg} onkeydown={onKey} />
              <button type="button" class="primary" onclick={sendMessage}>发送</button>
            </div>
          </div>
        </div>
      </div>
      <SideBar kind="thread" ctx={peer} />
    </div>
  {:else}
    <div class="empty"><b>会话不存在</b>可能已被删除</div>
  {/if}
</div>