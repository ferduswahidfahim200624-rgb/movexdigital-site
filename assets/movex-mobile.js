(() => {
  const servicesData = typeof serviceData !== 'undefined' ? serviceData : window.moveXServiceData;
  const serviceExperience = document.querySelector('#services .service-experience');
  const serviceSection = document.querySelector('#services .shell');

  // On phones, present the complete service preview as a swipeable card deck.
  // The original selector and preview remain untouched for tablet/desktop.
  if (servicesData && serviceExperience && serviceSection) {
    const optionKeys = [...serviceExperience.querySelectorAll('.service-option')].map((option) => option.dataset.service);
    const entries = optionKeys.map((key) => [key, servicesData[key]]).filter(([, service]) => Boolean(service));
    const carousel = document.createElement('div');
    carousel.className = 'mobile-service-carousel';
    carousel.setAttribute('aria-label', 'MoveX services. Swipe to explore.');
    carousel.innerHTML = `
      <div class="mobile-service-rail" role="list">
        ${entries.map(([key, service], index) => `
          <article class="mobile-service-card" role="listitem">
            <a class="mobile-service-card-link" href="${service.link}" aria-label="Explore ${service.title}">
              <div class="mobile-service-art">
                <div class="mobile-service-art-card">
                  <small>${service.kicker}</small>
                  <strong>${service.mark}</strong>
                  <span class="mobile-service-colorline"><i></i><i></i><i></i></span>
                </div>
                <span class="mobile-service-index">${String(index + 1).padStart(2, '0')} <i>/ ${String(entries.length).padStart(2, '0')}</i></span>
              </div>
              <div class="mobile-service-content">
                <div class="mobile-service-tags">${service.tags.map(tag => `<span>${tag}</span>`).join('')}</div>
                <h3>${service.title}</h3>
                <p>${service.copy}</p>
                <span class="mobile-service-explore">${service.linkText} <b aria-hidden="true">↗</b></span>
              </div>
            </a>
          </article>`).join('')}
      </div>
      <div class="mobile-service-rail-footer" aria-hidden="true"><span>Swipe to explore services</span><span class="mobile-service-progress"><i></i></span><span class="mobile-service-rail-arrow">← &nbsp; →</span></div>`;
    serviceExperience.insertAdjacentElement('afterend', carousel);

    const rail = carousel.querySelector('.mobile-service-rail');
    const progress = carousel.querySelector('.mobile-service-progress i');
    const updateProgress = () => {
      const range = rail.scrollWidth - rail.clientWidth;
      progress.style.width = `${range > 0 ? Math.max(14, (rail.scrollLeft / range) * 100) : 100}%`;
    };
    rail.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
  }

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
