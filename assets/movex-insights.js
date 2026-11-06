(function () {
  var filters = Array.prototype.slice.call(document.querySelectorAll('.topic-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.media-article-grid .article-card'));
  var search = document.getElementById('media-search');
  var count = document.getElementById('media-result-count');
  var empty = document.getElementById('media-empty-state');
  var activeFilter = 'all';

  function updateLibrary() {
    var query = search ? search.value.trim().toLowerCase() : '';
    var visible = 0;
    cards.forEach(function (card) {
      var matchesTopic = activeFilter === 'all' || card.dataset.topic === activeFilter;
      var haystack = ((card.dataset.search || '') + ' ' + card.textContent).toLowerCase();
      var matchesSearch = !query || haystack.indexOf(query) !== -1;
      var show = matchesTopic && matchesSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (count) count.textContent = 'Showing ' + visible + ' ' + (visible === 1 ? 'practical guide' : 'practical guides');
    if (empty) empty.hidden = visible !== 0;
  }

  filters.forEach(function (button) {
    button.addEventListener('click', function () {
      activeFilter = button.dataset.filter || 'all';
      filters.forEach(function (item) {
        var selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
      });
      updateLibrary();
    });
  });
  if (search) search.addEventListener('input', updateLibrary);
  updateLibrary();

  var form = document.getElementById('mx-page-newsletter');
  if (form) form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = form.querySelector('input[type="email"]');
    if (!email || !email.checkValidity()) {
      if (email) email.reportValidity();
      return;
    }
    var subject = encodeURIComponent('Request to join the MoveX Brief');
    var body = encodeURIComponent('Please add me to MoveX Media updates.\n\nEmail: ' + email.value + '\n\nI understand that this request is sent by email.');
    window.location.href = 'mailto:ferdouswahidfahim24@gmail.com?subject=' + subject + '&body=' + body;
  });
})();
