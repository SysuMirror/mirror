(() => {
  const nav = document.querySelector('#hmNav');
  const hero = document.querySelector('#hm-top');
  const toggle = document.querySelector('#navToggle');
  const menu = document.querySelector('#navMenu');
  const mobile = window.matchMedia('(max-width: 760px)');

  function setMenu(open) {
    menu.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单');
  }

  toggle.hidden = !mobile.matches;
  setMenu(false);

  mobile.addEventListener('change', () => {
    const focusInMenu = menu.contains(document.activeElement);
    toggle.hidden = !mobile.matches;
    setMenu(false);
    if (mobile.matches && focusInMenu) toggle.focus();
  });

  toggle.addEventListener('click', () => setMenu(menu.hidden));

  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!mobile.matches || !link) return;
    setMenu(false);
    document.getElementById(link.hash.slice(1))?.focus({ preventScroll: true });
  });

  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !mobile.matches || menu.hidden) return;
    setMenu(false);
    toggle.focus();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      nav.classList.toggle('is-solid', !entry.isIntersecting);
      nav.classList.add('is-ready');
    }, { rootMargin: '-65px 0px 0px' });
    observer.observe(hero);
  }
})();
