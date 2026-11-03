/* Keep both desktop rails below the hero, then follow the viewport. */
(() => {
  const hero = document.querySelector('.masthead');
  if (!hero) return;
  const glass = document.createElement('div');
  glass.className = 'hero-glass-shine'; glass.setAttribute('aria-hidden', 'true');
  glass.innerHTML = '<span class="glass-sweep"></span><span class="glass-spark"></span>';
  hero.append(glass);
  const positionGlass = () => {
    const width = hero.clientWidth, height = hero.clientHeight;
    const scale = Math.max(width / 2172, height / 724);
    Object.assign(glass.style, { left: (width - 2172 * scale + 1660 * scale) + 'px', top: ((height - 724 * scale) / 2 + 140 * scale) + 'px', width: (420 * scale) + 'px', height: (420 * scale) + 'px' });
  };
  let pending = false;
  const update = () => {
    pending = false;
    positionGlass();
    document.documentElement.style.setProperty('--home-rail-top', Math.max(120, Math.ceil(hero.getBoundingClientRect().bottom) + 16) + 'px');
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  new ResizeObserver(schedule).observe(hero);
  update();
})();
