<script>
  import { app } from '../state.svelte.js'
  import { openPublish } from '../actions.js'
  import PostCard from '../lib/PostCard.svelte'
  import SideBar from '../lib/SideBar.svelte'
  const mine = $derived(app.posts.filter((p) => p.mine))
</script>

<div class="layout">
  <div class="layout__main">
    <div class="card">
      <div class="card__h"><strong>需求管理</strong><button class="primary" onclick={openPublish}>+ 发布需求</button></div>
      <div class="cards">
        {#if mine.length}
          {#each mine as p (p.id)}<PostCard post={p} />{/each}
        {:else}
          <div class="empty"><b>还没有发布需求</b>写清预算和截止时间，别人一眼就能看懂</div>
        {/if}
      </div>
    </div>
  </div>
  <SideBar kind="list" />
</div>