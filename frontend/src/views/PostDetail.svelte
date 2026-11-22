<script>
  import { app, postById, anyPeer, money, isGuest } from '../state.svelte.js'
  import { back, applyPost, toggleFav, chatWith } from '../actions.js'
  import SideBar from '../lib/SideBar.svelte'
  import { ICONS } from '../lib/icons.js'
  let { id } = $props()
  const post = $derived(postById(id))
  const author = $derived(post ? anyPeer(post.whoId) : null)
</script>

<div class="detail-wrap">
  <div class="backbar" role="button" tabindex="0" onclick={back} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back() } }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{@html ICONS.back}</svg>返回列表
  </div>
  {#if post}
    <div class="layout">
      <div class="layout__main">
        <div class="card detail-card">
          <h2>{post.title}</h2>
          <div class="sub">
            <span class="price">{money(post)}</span>
            <span class="needtag gray">{post.cat}</span>
            <span class="needtag">需要 {post.skills.slice(0, 2).join(' / ')}</span>
            {#if post.status === '已完成'}<span class="needtag ok">已完成</span>
            {:else if post.status === '求助中'}<span class="needtag hot">互助</span>
            {:else}<span class="needtag gray">可接</span>{/if}
          </div>
          <div class="authorbox">
            <div class="av">{post.who[0]}</div>
            <div><b>{post.who}</b><small>{post.when} 发布 · {post.views} 浏览</small></div>
            <div class="credit"><b>{author.credit}</b><small style="display:block;color:var(--muted);font-size:11px">信用分</small></div>
          </div>
          <div class="sect" style="margin-top:0">对方写明需要</div>
          <div class="chips">{#each post.skills as s}<span class="chip skill">{s}</span>{/each}</div>
          <div class="desc">{post.desc}</div>
          <div class="kvgrid">
            <div><span>截止时间</span><b>{post.deadline || '不限'}</b></div>
            <div><span>当前状态</span><b>{post.status}</b></div>
            <div><span>已报名</span><b>{post.applicants} 人</b></div>
            <div><span>浏览</span><b>{post.views} 次</b></div>
          </div>
          <div class="acts">
            {#if isGuest()}
              <button class="primary" onclick={() => applyPost(post.id)}>立即报名（需登录）</button>
              <button class="ghost acc" onclick={() => chatWith(post.whoId)}>私聊发布者</button>
              <button class="ghost" onclick={() => toggleFav(post.id)}>收藏 ☆</button>
            {:else}
              {#if post.mine}
                <button class="ghost">这是你发布的需求</button>
              {:else}
                <button class="primary" onclick={() => applyPost(post.id)}>{app.applied.includes(post.id) ? '已报名 ✓' : '立即报名'}</button>
                <button class="ghost acc" onclick={() => chatWith(post.whoId)}>私聊发布者</button>
              {/if}
              <button class="ghost" onclick={() => toggleFav(post.id)}>{app.favorites.includes(post.id) ? '已收藏 ★' : '收藏 ☆'}</button>
            {/if}
          </div>
        </div>
      </div>
      <SideBar kind="post" ctx={post} />
    </div>
  {:else}
    <div class="empty"><b>需求不存在</b>可能已被删除</div>
  {/if}
</div>