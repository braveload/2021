/* Keep both desktop rails below the hero, then follow the viewport. */
(() => {
  const hero = document.querySelector('.masthead');
  if (!hero) return;
  let pending = false;
  const update = () => {
    pending = false;
    document.documentElement.style.setProperty('--home-rail-top', Math.max(120, Math.ceil(hero.getBoundingClientRect().bottom) + 16) + 'px');
  };
  const schedule = () => { if (!pending) { pending = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  new ResizeObserver(schedule).observe(hero);
  update();
})();
