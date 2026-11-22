<script>
  import { app, SKILLS } from '../state.svelte.js'
  import { back, submitPost, toggleSkill, goTab } from '../actions.js'
  import { ICONS } from '../lib/icons.js'
  const cats = ['前端', '后端', '设计', '文案', '答疑']
</script>

<div class="layout">
  <div class="layout__main">
    <div class="card form">
      <div class="backbar" role="button" tabindex="0" onclick={back} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); back() } }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">{@html ICONS.back}</svg>返回列表
      </div>
      <h2>发布需求</h2>
      <p class="lead">写清预算、截止时间和需要的技能，别人一眼就能看懂要不要接。</p>

      <div class="field">
        <label for="f-title">需求标题</label>
        <input id="f-title" placeholder="一句话说清要做什么" bind:value={app.draft.title} />
      </div>

      <div class="field">
        <label for="f-price">悬赏金额</label>
        <div class="price-toggle">
          <button type="button" class:on={!app.draft.negotiable} onclick={() => { app.draft.negotiable = false }}>设金额</button>
          <button type="button" class:on={app.draft.negotiable} onclick={() => { app.draft.negotiable = true }}>面议 / 互助</button>
        </div>
        {#if app.draft.negotiable}
          <div class="nego-note">不标具体金额，双方私聊商量或纯互助。发布后可正常收到报名。</div>
        {:else}
          <input id="f-price" inputmode="decimal" placeholder="1 – 1000，最多两位小数" bind:value={app.draft.price} />
          <div class="hint">金额需在 1 到 1000 之间，最多两位小数</div>
        {/if}
      </div>

      <div class="field">
        <label for="f-cat">类型</label>
        <select id="f-cat" bind:value={app.draft.cat}>
          {#each cats as c}<option value={c}>{c}</option>{/each}
        </select>
      </div>

      <div class="field">
        <span class="flabel">需要的技能</span>
        <div class="chips">
          {#each SKILLS as s}
            <button type="button" class="chip skill" class:on={app.draftSkills.includes(s)} onclick={() => toggleSkill(s)}>{s}</button>
          {/each}
        </div>
      </div>

      <div class="field">
        <label for="f-deadline">截止时间</label>
        <input id="f-deadline" type="date" bind:value={app.draft.deadline} />
      </div>

      <div class="field">
        <label for="f-desc">需求描述</label>
        <textarea id="f-desc" placeholder="背景、具体要求、交付物…" bind:value={app.draft.desc}></textarea>
      </div>

      <div class="acts">
        <button class="primary" onclick={submitPost}>发布</button>
        <button class="ghost" onclick={() => goTab('manage')}>取消</button>
      </div>
    </div>
  </div>
</div>