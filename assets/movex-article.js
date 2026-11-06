(function () {
  var progress = document.querySelector('.reading-progress span');
  var article = document.querySelector('.post-content');
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.post-toc a[href^="#"]'));
  var headings = tocLinks.map(function (link) {
    return document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
  }).filter(Boolean);

  function updateProgress() {
    if (!progress || !article) return;
    var top = article.getBoundingClientRect().top + window.scrollY;
    var height = article.scrollHeight;
    var span = Math.max(1, height - window.innerHeight * 0.55);
    var pct = Math.max(0, Math.min(100, ((window.scrollY - top + window.innerHeight * 0.45) / span) * 100));
    progress.style.width = pct + '%';
    progress.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  if ('IntersectionObserver' in window && headings.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (link) {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-18% 0px -72% 0px' });
    headings.forEach(function (heading) { observer.observe(heading); });
  }
})();
