function setupNavigation() {
  const header = document.querySelector('.header-inner');
  const toggle = document.querySelector('#navToggle');
  const menu = document.querySelector('#navMenu');
  const mobile = window.matchMedia('(max-width: 780px)');
  const anchors = [...menu.querySelectorAll('.nav-sections a')];
  const sections = anchors.map((anchor) => document.getElementById(anchor.hash.slice(1)));

  function setMenu(open) {
    menu.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }

  function syncMenu() {
    const focus = document.activeElement;
    toggle.hidden = !mobile.matches;
    setMenu(false);
    if (mobile.matches && menu.contains(focus)) toggle.focus();
    if (!mobile.matches && focus === toggle) anchors[0].focus();
  }

  function updateCurrentSection() {
    const boundary = header.offsetHeight + Math.min(220, innerHeight * .24);
    const bottomReached = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    const selected = bottomReached ? sections.at(-1) : sections.findLast(
      (section) => section.getBoundingClientRect().top <= boundary
    );
    anchors.forEach((anchor, index) => {
      if (sections[index] === selected) anchor.setAttribute('aria-current', 'location');
      else anchor.removeAttribute('aria-current');
    });
  }

  let frame = 0;
  function scheduleUpdate() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateCurrentSection();
    });
  }

  header.classList.add('is-enhanced');
  syncMenu();
  mobile.addEventListener('change', syncMenu);
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('.nav-sections a');
    if (!mobile.matches || !link) return;
    setMenu(false);
    document.getElementById(link.hash.slice(1)).focus({ preventScroll: true });
  });
  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !mobile.matches || menu.hidden) return;
    setMenu(false);
    toggle.focus();
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  new ResizeObserver(scheduleUpdate).observe(document.querySelector('main'));
  updateCurrentSection();
}

function setupShowcase() {
  const showcase = document.querySelector('#ecosystemShowcase');
  const list = showcase.querySelector('[role="tablist"]');
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));

  const horizontal = window.matchMedia('(max-width: 780px)');

  function syncOrientation() {
    list.setAttribute('aria-orientation', horizontal.matches ? 'horizontal' : 'vertical');
  }

  function activate(selected) {
    tabs.forEach((tab, index) => {
      const active = index === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[index].hidden = !active;
    });
  }

  panels.forEach((panel, index) => {
    panel.setAttribute('role', 'tabpanel');
    panel.tabIndex = 0;
    panel.setAttribute('aria-labelledby', tabs[index].id);
  });
  tabs.forEach((tab, index) => tab.addEventListener('click', () => activate(index)));
  list.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(event.target);
    if (current < 0) return;
    const last = tabs.length - 1;
    const next = {
      [horizontal.matches ? 'ArrowLeft' : 'ArrowUp']: (current + last) % tabs.length,
      [horizontal.matches ? 'ArrowRight' : 'ArrowDown']: (current + 1) % tabs.length,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    activate(next);
    tabs[next].focus();
  });

  syncOrientation();
  horizontal.addEventListener('change', syncOrientation);
  activate(0);
  showcase.classList.add('is-enhanced');
  list.hidden = false;
}

setupNavigation();
setupShowcase();
