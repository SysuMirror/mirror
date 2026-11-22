<script>
  import { app, NAV, BOTTOM, SKILLS, CATS, isGuest, route, unreadTotal, money, postById } from './state.svelte.js'
  import {
    goTab, openPublish, requireLogin, closeAuth, submitAuth, logout, back,
    openPost, openThread, chatWith, setCat, toggleSkillFilter, filterCount, toast,
  } from './actions.js'
  import { ICONS } from './lib/icons.js'
  import Hall from './views/Hall.svelte'
  import PostDetail from './views/PostDetail.svelte'
  import Publish from './views/Publish.svelte'
  import ChatList from './views/ChatList.svelte'
  import Thread from './views/Thread.svelte'
  import Me from './views/Me.svelte'
  import Manage from './views/Manage.svelte'
  import Applied from './views/Applied.svelte'
  import Starfield from './lib/Starfield.svelte'

  let authEmail = $state('')
  let authPass = $state('')
  let authAgree = $state(true)

  const total = $derived(unreadTotal())
  const meName = $derived(app.me ? app.me.name : '同学')

  const searchHits = $derived.by(() => {
    const q = (app.searchQ || '').trim().toLowerCase()
    if (!q) return []
    return app.posts.filter((p) =>
      `${p.title} ${p.desc} ${p.cat} ${p.skills.join(' ')} ${p.who}`.toLowerCase().includes(q)
    ).slice(0, 8)
  })

  $effect(() => {
    document.body.classList.toggle('guest', isGuest())
    document.body.classList.toggle('in-detail', route().name !== 'list')
  })

  function onWindowKey(e) {
    if (e.key === 'Escape') {
      app.searchOpen = false; app.filterOpen = false; app.authOpen = false; app.userMenuOpen = false
    }
  }
  function onWindowClick(e) {
    if (!e.target.closest?.('#userBox')) app.userMenuOpen = false
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  }
  function highlight(text, q) {
    const t = String(text), i = t.toLowerCase().indexOf(q)
    if (i < 0) return esc(t)
    return esc(t.slice(0, i)) + '<em>' + esc(t.slice(i, i + q.length)) + '</em>' + esc(t.slice(i + q.length))
  }
  function doSearch() { app.searchOpen = true; app.searchQ = '' }
  function pickSearch(id) { app.searchOpen = false; openPost(id) }
  function identity() { app.userMenuOpen = !app.userMenuOpen }
</script>

<svelte:window onkeydown={onWindowKey} onclick={onWindowClick} />

<Starfield />

<header class="shell">
  <div class="shell__in">
    <a class="brand" href="/index.html" title="返回首页"><img class="brand__img" src="/assets/logo.png" alt="沕鉴 Mirror logo">沕鉴<i>·</i>Mirror<small>返回首页</small></a>
    <div class="shell__spacer"></div>
    <div class="shell__right">
      <button type="button" class="iconbtn" onclick={doSearch} aria-label="搜索" title="搜索需求">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">{@html ICONS.search}</svg>
      </button>
      <button type="button" class="bell" onclick={() => goTab('chat')} aria-label="消息">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.bell}</svg>
        <span class="badge" hidden={total === 0}>{total > 99 ? '99+' : total}</span>
      </button>
      <div class="userbox" id="userBox" class:open={app.userMenuOpen}>
        <button type="button" class="identity" id="identityBtn" onclick={identity} title="账号菜单"
                aria-haspopup="true" aria-expanded={app.userMenuOpen}>
          <span class="idname">{meName}</span><span class="idhint">账号</span>
          <div class="av">{meName.slice(0, 1)}</div><span class="caret">▾</span>
        </button>
        <div class="usermenu" id="userMenu">
          <div class="um-head"><b>{meName}</b><span>{app.me?.school || ''}</span></div>
          <button type="button" class="um-item" onclick={() => { app.userMenuOpen = false; goTab('me') }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.user}</svg>个人主页
          </button>
          <button type="button" class="um-item" onclick={() => goTab('manage')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.doc}</svg>我发布的需求
          </button>
          <button type="button" class="um-item" onclick={() => goTab('applied')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.doc}</svg>我的报名
          </button>
          <button type="button" class="um-item" onclick={() => goTab('chat')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.chat}</svg>消息
          </button>
          <div class="um-sep"></div>
          <button type="button" class="um-item danger" onclick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS.out}</svg>退出登录
          </button>
        </div>
      </div>
      <button type="button" class="primary" id="pubBtn" onclick={openPublish}>+ 发布需求</button>
      <button type="button" class="guestlogin" onclick={() => requireLogin(null)}>登录</button>
    </div>
  </div>
  <nav class="subnav">
    <div class="subnav__in" id="subnav">
      {#each NAV as n}
        <button type="button" class:on={app.tab === n.k} onclick={() => goTab(n.k)}>
          {n.t}{#if n.k === 'chat' && total > 0}<span class="badge">{total}</span>{/if}
        </button>
      {/each}
    </div>
  </nav>
</header>

<div class="guestnotice">校园需求互助社区 · <b>游客可自由浏览</b><span class="gn-act">登录后即可发布、报名与私聊</span></div>

<main>
  <div id="view" class="view">
    {#if app.loading}
      <div class="empty"><b>加载中…</b>正在连接社区服务</div>
    {:else if route().name === 'post'}
      <PostDetail id={route().id} />
    {:else if route().name === 'thread'}
      <Thread id={route().id} />
    {:else if app.tab === 'applied'}
      <Applied />
    {:else if app.tab === 'manage'}
      <Manage />
    {:else if app.tab === 'chat'}
      <ChatList />
    {:else if app.tab === 'publish'}
      <Publish />
    {:else if app.tab === 'me'}
      <Me />
    {:else}
      <Hall />
    {/if}
  </div>
</main>

<nav class="bottom" id="bottom" aria-label="底部导航">
  {#each BOTTOM as n}
    <button type="button" class:on={app.tab === n.k} onclick={() => goTab(n.k)}>
      <span style="position:relative;display:inline-flex">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">{@html ICONS[n.i]}</svg>
        {#if n.k === 'chat' && total > 0}<span class="badge">{total}</span>{/if}
      </span>{n.t}
    </button>
  {/each}
</nav>

<div class="toast" class:on={!!app.toast} role="status" aria-live="polite">{app.toast}</div>

<!-- 搜索 -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="searchmask" class:on={app.searchOpen} onclick={(e) => { if (e.target.classList.contains('searchmask')) app.searchOpen = false }}>
  <div class="searchpanel" role="dialog" aria-label="搜索需求">
    <div class="searchpanel__top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">{@html ICONS.search}</svg>
      <input id="searchInput" placeholder="搜索需求标题、技能、发布者或描述" autocomplete="off" bind:value={app.searchQ} />
      <button type="button" class="searchpanel__close" onclick={() => { app.searchOpen = false }}>关闭 ESC</button>
    </div>
    <div id="searchResults">
      {#if !app.searchQ.trim()}
        <div class="sr-hint">输入关键词，可搜标题、技能、发布者或需求描述。<br />游客也可搜索，点结果即可查看详情。</div>
      {:else if searchHits.length}
        {#each searchHits as p (p.id)}
          <div class="sr-item" role="button" tabindex="0" onclick={() => pickSearch(p.id)}
               onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickSearch(p.id) } }}>
            <div class="t">{@html highlight(p.title, app.searchQ.trim().toLowerCase())}</div>
            <div class="m"><span>{p.who}</span><span>{p.skills.join(' / ')}</span><span>{p.cat}</span><span class="p">{money(p)}</span></div>
          </div>
        {/each}
      {:else}
        <div class="sr-hint">没有匹配的需求，换个关键词试试</div>
      {/if}
    </div>
  </div>
</div>

<!-- 筛选 -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="filtermask" class:on={app.filterOpen} onclick={(e) => { if (e.target.classList.contains('filtermask')) app.filterOpen = false }}>
  <div class="filterpanel" role="dialog" aria-label="筛选需求">
    <div class="filterpanel__top"><h3>筛选需求</h3><button type="button" onclick={() => { app.filterOpen = false }}>完成</button></div>
    <div id="filterBody">
      <div class="fgroup">
        <span class="label">类型</span>
        <div class="chips">
          {#each CATS as c}<button type="button" class="chip" class:on={app.cat === c} onclick={() => setCat(c)}>{c}</button>{/each}
        </div>
      </div>
      <div class="fgroup">
        <span class="label">技能标签</span>
        <div class="chips">
          {#each SKILLS as s}<button type="button" class="chip skill" class:on={app.skill === s} onclick={() => toggleSkillFilter(s)}>{s}</button>{/each}
        </div>
      </div>
    </div>
    <div class="filterpanel__acts">
      <button type="button" class="ghost" onclick={() => { app.cat = '全部'; app.skill = '' }}>重置筛选</button>
      <button type="button" class="primary" onclick={() => { app.filterOpen = false }}>查看结果</button>
    </div>
  </div>
</div>

<!-- 登录 -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="authmask" class:on={app.authOpen} onclick={(e) => { if (e.target.classList.contains('authmask')) closeAuth() }}>
  <div class="authbox" role="dialog" aria-label="登录">
    <button type="button" class="authclose" onclick={closeAuth}>关闭</button>
    <div class="authbrand">沕鉴 · 校园技术服务平台<b>Mirror</b></div>
    <h2>{app.authTitle}</h2>
    <div class="sub">{app.authSub}</div>
    <div class="authfield"><input type="email" placeholder="统一身份认证邮箱" autocomplete="username" bind:value={authEmail} /></div>
    <div class="authfield"><input type="password" placeholder="密码" autocomplete="current-password" bind:value={authPass} /></div>
    <button type="button" class="authsubmit" disabled={app.authBusy} onclick={() => submitAuth(authEmail.trim(), authPass, authAgree)}>
      {app.authBusy ? '登录中…' : '登录'}
    </button>
    <label class="authagree">
      <input type="checkbox" bind:checked={authAgree} style="margin-top:3px" />
      <span>已阅读并同意《用户协议》《隐私政策》。登录使用学校 UniSSO 统一身份认证，无需另行注册。</span>
    </label>
    <div class="authdemo">UniSSO 统一身份认证 · 账号密码不会保存在本站</div>
  </div>
</div>