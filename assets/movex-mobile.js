(() => {
  const servicesData = typeof serviceData !== 'undefined' ? serviceData : window.moveXServiceData;
  const serviceExperience = document.querySelector('#services .service-experience');
  const serviceSection = document.querySelector('#services .shell');
  const mobile = window.matchMedia('(max-width: 760px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // On phones, show one complete service card at a time and advance the deck.
  if (servicesData && serviceExperience && serviceSection) {
    const optionKeys = [...serviceExperience.querySelectorAll('.service-option')].map((option) => option.dataset.service);
    const entries = optionKeys.map((key) => [key, servicesData[key]]).filter(([, service]) => Boolean(service));
    const carousel = document.createElement('div');
    carousel.className = 'mobile-service-carousel';
    carousel.setAttribute('role', 'region');
    carousel.setAttribute('aria-roledescription', 'carousel');
    carousel.setAttribute('aria-label', 'MoveX services');
    carousel.innerHTML = `
      <div class="mobile-service-rail" role="list">
        ${entries.map(([key, service], index) => `
          <article class="mobile-service-card" role="listitem" aria-label="${index + 1} of ${entries.length}">
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
      <div class="mobile-service-rail-footer">
        <span class="mobile-service-position" aria-live="polite">01 / ${String(entries.length).padStart(2, '0')}</span>
        <span class="mobile-service-progress" aria-hidden="true"><i></i></span>
        <button class="mobile-service-toggle" type="button" aria-label="Pause automatic service slides" aria-pressed="false">Ⅱ</button>
      </div>`;
    serviceExperience.insertAdjacentElement('afterend', carousel);

    const rail = carousel.querySelector('.mobile-service-rail');
    const cards = [...rail.querySelectorAll('.mobile-service-card')];
    const progress = carousel.querySelector('.mobile-service-progress i');
    const position = carousel.querySelector('.mobile-service-position');
    const toggle = carousel.querySelector('.mobile-service-toggle');
    const stepSize = () => (cards[0]?.getBoundingClientRect().width || rail.clientWidth) + 12;
    let activeIndex = 0;
    let timer = 0;
    let resumeTimer = 0;
    let userPaused = false;

    const setIndex = (index, scroll = false) => {
      activeIndex = (index + cards.length) % cards.length;
      position.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      progress.style.width = `${((activeIndex + 1) / cards.length) * 100}%`;
      if (scroll) rail.scrollTo({ left: activeIndex * stepSize(), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };
    const stop = () => { window.clearInterval(timer); timer = 0; };
    const start = () => {
      stop();
      if (!mobile.matches || reducedMotion.matches || userPaused || document.hidden || cards.length < 2) return;
      timer = window.setInterval(() => setIndex(activeIndex + 1, true), 5000);
    };
    const pauseForInteraction = () => {
      stop();
      window.clearTimeout(resumeTimer);
      if (!userPaused) resumeTimer = window.setTimeout(start, 7000);
    };
    rail.addEventListener('scroll', () => {
      const next = Math.max(0, Math.min(cards.length - 1, Math.round(rail.scrollLeft / stepSize())));
      if (next !== activeIndex) setIndex(next);
    }, { passive: true });
    rail.addEventListener('pointerdown', pauseForInteraction, { passive: true });
    rail.addEventListener('touchstart', pauseForInteraction, { passive: true });
    carousel.addEventListener('mouseenter', stop);
    carousel.addEventListener('mouseleave', start);
    carousel.addEventListener('focusin', stop);
    carousel.addEventListener('focusout', (event) => { if (!carousel.contains(event.relatedTarget)) start(); });
    toggle.addEventListener('click', () => {
      userPaused = !userPaused;
      toggle.setAttribute('aria-pressed', String(userPaused));
      toggle.setAttribute('aria-label', userPaused ? 'Resume automatic service slides' : 'Pause automatic service slides');
      toggle.textContent = userPaused ? '▶' : 'Ⅱ';
      userPaused ? stop() : start();
    });
    document.addEventListener('visibilitychange', start);
    window.addEventListener('resize', () => { setIndex(activeIndex, true); start(); }, { passive: true });
    reducedMotion.addEventListener?.('change', start);
    setIndex(0);
    start();
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
