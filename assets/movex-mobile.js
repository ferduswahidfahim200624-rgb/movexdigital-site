(() => {
  const rail = document.querySelector('#services .service-options');
  if (!rail) return;
  const cards = [...rail.querySelectorAll('.service-option')];
  if (!cards.length) return;

  let frame = 0;
  const mobile = window.matchMedia('(max-width: 760px)');
  const updateCarousel = () => {
    if (!mobile.matches) {
      cards.forEach((card) => { card.style.removeProperty('transform'); card.style.removeProperty('opacity'); });
      return;
    }

    const center = rail.getBoundingClientRect().left + rail.clientWidth / 2;
    let nearest = null;
    let nearestDistance = Infinity;

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const offset = (rect.left + rect.width / 2 - center) / Math.max(rect.width, 1);
      const side = Math.max(-1, Math.min(1, offset));
      card.style.transform = `perspective(760px) rotateY(${side * -7}deg) scale(${1 - Math.min(Math.abs(offset) * .055, .08)})`;
      card.style.opacity = String(1 - Math.min(Math.abs(offset) * .22, .28));

      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearest = card;
        nearestDistance = distance;
      }
    });

    if (nearest && !nearest.classList.contains('active')) {
      nearest.dispatchEvent(new Event('mouseenter'));
    }
  };

  rail.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateCarousel);
  }, { passive: true });
  window.addEventListener('resize', updateCarousel, { passive: true });
  updateCarousel();
})();
