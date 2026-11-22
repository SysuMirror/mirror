<script>
  import { app, CATS } from '../state.svelte.js'
  import { setCat, filterCount } from '../actions.js'
  import PostCard from '../lib/PostCard.svelte'
  import SideBar from '../lib/SideBar.svelte'

  const list = $derived(app.posts.filter((p) => {
    if (app.cat !== '全部' && p.cat !== app.cat) return false
    if (app.skill && !p.skills.includes(app.skill)) return false
    if (app.hallQ && !p.title.toLowerCase().includes(app.hallQ.toLowerCase())) return false
    return true
  }))
</script>

<div class="layout">
  <div class="layout__main">
    <div class="hallcats">
      {#each CATS as c}
        <button type="button" class:on={app.cat === c} onclick={() => setCat(c)}>{c}</button>
      {/each}
    </div>
    <div class="filters">
      <div class="fbar">
        <div class="f-search">
          <span class="label">搜索需求</span>
          <input class="search" placeholder="搜标题关键词" bind:value={app.hallQ} />
        </div>
        <button type="button" class="fbtn" onclick={() => { app.filterOpen = true }}>
          技能筛选 <span class="fn" hidden={filterCount() === 0}>{filterCount()}</span>
        </button>
      </div>
    </div>
    <div class="card">
      <div class="card__h"><strong>需求大厅</strong><small>共 {list.length} 条 · 按发布时间排序</small></div>
      <div style="padding:0">
        <div class="cards">
          {#if list.length}
            {#each list as p (p.id)}<PostCard post={p} />{/each}
          {:else}
            <div class="empty"><b>没有匹配的需求</b>换个技能标签试试</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
  <SideBar kind="list" />
</div>