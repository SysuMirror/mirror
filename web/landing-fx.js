function setupNavigation() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('#navToggle');
  const menu = document.querySelector('#navMenu');
  const mobile = window.matchMedia('(max-width: 720px)');
  const anchors = [...menu.querySelectorAll('a[href^="#"]')];
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

  function updateHeader() {
    const height = header.offsetHeight;
    header.classList.toggle('is-docked', scrollY > 12);
    const boundary = height + Math.min(185, innerHeight * .2);
    const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    const selected = atBottom ? sections.at(-1) : sections.findLast(
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
      updateHeader();
    });
  }

  header.classList.add('is-enhanced');
  syncMenu();
  mobile.addEventListener('change', syncMenu);
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
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
  updateHeader();
}

function setupInquiry() {
  const form = document.querySelector('#inquiryForm');
  const button = form.querySelector('button[type="submit"]');
  const status = document.querySelector('#inquiryStatus');
  let previousData = '';
  let requestKey = '';

  function setStatus(message, state) {
    status.dataset.state = state;
    status.textContent = message;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const data = Object.fromEntries(new FormData(form));
    const snapshot = JSON.stringify(data);
    if (snapshot !== previousData) {
      requestKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      previousData = snapshot;
    }

    button.disabled = true;
    setStatus('正在提交…', 'pending');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, requestKey }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok || !/^q[0-9a-f]{32}$/.test(result.orderId)) {
        const message = response.status < 500 ? result?.error : '';
        setStatus(message || '暂时无法提交，请稍后重试。', 'error');
        return;
      }

      form.reset();
      previousData = '';
      setStatus(`项目需求已提交。工单编号：${result.orderId}。沕鉴团队会通过你留下的联系方式对接。`, 'ok');
    } catch {
      setStatus('连接中断，请重试。重复提交同一份需求只会登记一次。', 'error');
    } finally {
      button.disabled = false;
    }
  });

  button.disabled = false;
  button.hidden = false;
}

setupNavigation();
setupInquiry();
