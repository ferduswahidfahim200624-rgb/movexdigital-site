(() => {
  const rail = document.querySelector('#services .service-options');
  if (!rail) return;
  const cards = [...rail.querySelectorAll('.service-option')];
  if (!cards.length || !('onscroll' in rail)) return;

  let frame = 0;
  rail.addEventListener('scroll', () => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let nearest = null;
      let nearestDistance = Infinity;
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const distance = Math.abs(rect.left + rect.width / 2 - center);
        if (distance < nearestDistance) {
          nearest = card;
          nearestDistance = distance;
        }
      });
      if (nearest && !nearest.classList.contains('active')) {
        nearest.dispatchEvent(new Event('mouseenter'));
      }
    });
  }, { passive: true });
})();
