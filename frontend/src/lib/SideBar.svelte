<script>
  import { app, anyPeer, money, isGuest, unreadTotal } from '../state.svelte.js'
  import { openPost, chatWith, setCat } from '../actions.js'
  let { kind, ctx = null } = $props()

  const similar = $derived(kind === 'post' && ctx
    ? app.posts.filter((x) => x.id !== ctx.id && (x.cat === ctx.cat || x.skills.some((k) => ctx.skills.includes(k)))).slice(0, 3)
    : [])
  const stats = $derived(!isGuest()
    ? [['我发布的', app.posts.filter((x) => x.mine).length], ['我的报名', app.applied.length], ['未读消息', unreadTotal()]]
    : [['在招需求', app.posts.filter((x) => x.status === '招募中').length], ['全部需求', app.posts.length], ['已完成', app.posts.filter((x) => x.status === '已完成').length]])
  const hotCats = ['前端', '后端', '设计', '文案', '答疑', '小程序']
</script>

<aside class="layout__side">
  {#if kind === 'post' && ctx}
    {@const author = anyPeer(ctx.whoId)}
    <section class="card side">
      <h4>发布者</h4>
      <div class="side-peer">
        <div class="av">{ctx.who[0]}</div>
        <div><b>{ctx.who}</b><small>{String(author.school || '').split(' · ')[0]}</small></div>
        <div class="credit">{author.credit}</div>
      </div>
      <div class="side-links" style="margin-top:11px">
        <button type="button" onclick={() => chatWith(ctx.whoId)}>私聊发布者 <small>›</small></button>
      </div>
    </section>
    <section class="card side">
      <h4>相似需求</h4>
      {#if similar.length}
        {#each similar as x (x.id)}
          <div class="side-mini" role="button" tabindex="0" onclick={() => openPost(x.id)}
               onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(x.id) } }}>
            <div class="av">{x.who[0]}</div>
            <div><b>{x.title}</b><small>{money(x)}</small></div>
          </div>
        {/each}
      {:else}
        <p style="font-size:12px;color:var(--muted)">暂无相似需求</p>
      {/if}
    </section>
  {:else if kind === 'thread' && ctx}
    <section class="card side">
      <h4>对方资料</h4>
      <div class="side-peer">
        <div class="av">{ctx.name[0]}</div>
        <div><b>{ctx.name}</b><small>{ctx.school}</small></div>
        <div class="credit">{ctx.credit}</div>
      </div>
    </section>
  {:else}
    <section class="card side">
      <h4>{isGuest() ? '社区数据' : '我的进度'}</h4>
      <div class="side-stats">
        {#each stats as s}<div><span>{s[0]}</span><b>{s[1]}</b></div>{/each}
      </div>
    </section>
    <section class="card side">
      <h4>热门分类</h4>
      <div class="side-tags">
        {#each hotCats as c}
          <button type="button" class:on={app.cat === c} onclick={() => setCat(c)}>{c}</button>
        {/each}
      </div>
    </section>
    <section class="card side side-tip">
      <h4>交易提醒</h4>
      <p>需求金额由双方自行约定，平台仅提供信息展示。沟通与交付请在站内完成，注意保护个人信息。</p>
    </section>
  {/if}
</aside>