<script>
  import { app } from '../state.svelte.js'
  import PostCard from '../lib/PostCard.svelte'
  import SideBar from '../lib/SideBar.svelte'
  const mine = $derived(app.posts.filter((p) => app.applied.includes(p.id)))
</script>

<div class="layout">
  <div class="layout__main">
    <div class="card">
      <div class="card__h"><strong>我的报名</strong></div>
      <div class="cards">
        {#if mine.length}
          {#each mine as p (p.id)}<PostCard post={p} />{/each}
        {:else}
          <div class="empty"><b>还没有报名</b>去需求大厅挑一个</div>
        {/if}
      </div>
    </div>
  </div>
  <SideBar kind="list" />
</div>