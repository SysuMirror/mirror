<script>
  import { anyPeer, money } from '../state.svelte.js'
  import { openPost } from '../actions.js'
  let { post } = $props()
  const who = $derived(anyPeer(post.whoId))
  const school = $derived(String(who.school || '').split(' · ')[0])
  const st = $derived(post.status === '招募中' ? '招募中' : post.status === '求助中' ? '互助中' : post.status)
</script>

<div class="pcard" role="button" tabindex="0" onclick={() => openPost(post.id)}
         onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPost(post.id) } }}>
  <div class="pcard__row">
    <div class="pcard__main">
      <div class="pcard__titleline"><h3>{post.title}</h3><span class="price">{money(post)}</span></div>
      <div class="pcard__skills">
        {#each post.skills as s}<span class="chip skill">{s}</span>{/each}
      </div>
      <div class="pcard__meta">
        <span class="pcard__who"><i class="av xs">{post.who[0]}</i>{post.who}</span>
        <span class="pcard__state-mobile st-{post.status}">{st}</span>
        <span>{school}</span>
        <span>信用 {who.credit}</span>
        <span>{post.when}</span>
      </div>
    </div>
    <div class="pcard__side">
      <span class="pcard__state st-{post.status}">{st}</span>
      <span class="pcard__cat">{post.cat}</span>
    </div>
  </div>
  <div class="pcard__foot">
    <span>{post.views} 次浏览 · {post.applicants} 人报名{post.deadline ? ' · 截至 ' + post.deadline : ''}</span>
    <em>查看详情 ›</em>
  </div>
</div>