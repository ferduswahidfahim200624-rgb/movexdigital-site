(function () {
  var api = String(window.MOVEX_INBOX_API || '').trim().replace(/\/$/, '');
  var tokenKey = 'movex_admin_session';
  var loginView = document.getElementById('login-view');
  var dashboard = document.getElementById('dashboard-view');
  var loginForm = document.getElementById('login-form');
  var loginMessage = document.getElementById('login-message');
  var logoutButton = document.getElementById('logout');
  var leads = [];
  var subscribers = [];
  var articles = [];
  var slugWasEdited = false;
  var articlesLoaded = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function token() { return sessionStorage.getItem(tokenKey) || ''; }
  function say(message, error) {
    var node = document.getElementById('dashboard-message');
    if (node) { node.textContent = message; node.style.color = error ? '#a23d2e' : ''; }
  }
  function date(value) {
    if (!value) return '—';
    var parsed = new Date(value.endsWith('Z') ? value : value + 'Z');
    return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  async function request(path, options) {
    if (!api) throw new Error('Set MOVEX_INBOX_API in assets/movex-inbox-config.js first.');
    var config = Object.assign({ headers: {} }, options || {});
    config.headers = Object.assign({ 'content-type': 'application/json' }, config.headers);
    if (token()) config.headers.Authorization = 'Bearer ' + token();
    var response = await fetch(api + path, config);
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      if (response.status === 401) signOut(false);
      throw new Error(body.error || 'Request failed');
    }
    return body;
  }
  function signOut(showLogin) {
    sessionStorage.removeItem(tokenKey);
    dashboard.hidden = true;
    loginView.hidden = false;
    logoutButton.hidden = true;
    if (showLogin !== false) { loginForm.reset(); loginMessage.textContent = 'You have signed out.'; }
  }
  function showDashboard() {
    loginView.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
    loadAll();
  }
  function renderLeads() {
    var query = document.getElementById('lead-search').value.trim().toLowerCase();
    var filtered = leads.filter(function (row) { return JSON.stringify(row).toLowerCase().includes(query); });
    var tbody = document.getElementById('lead-rows');
    tbody.innerHTML = filtered.length ? filtered.map(function (row) {
      var fullName = [row.first_name, row.last_name].filter(Boolean).join(' ');
      var statuses = [['new','New'],['in_progress','In progress'],['qualified','Qualified'],['closed','Closed'],['spam','Spam']];
      return '<tr><td><strong>' + escapeHtml(fullName) + '</strong><small><a href="mailto:' + encodeURIComponent(row.email) + '">' + escapeHtml(row.email) + '</a></small></td><td><strong>' + escapeHtml(row.service || 'Not selected') + '</strong><small class="project-text">' + escapeHtml(row.project || 'No project details provided') + '</small></td><td>' + escapeHtml(date(row.created_at)) + '<small>' + escapeHtml(row.source_page || '') + '</small></td><td><select class="status-select" data-lead-id="' + Number(row.id) + '" aria-label="Update status for ' + escapeHtml(fullName) + '">' + statuses.map(function (item) { return '<option value="' + item[0] + '"' + (row.status === item[0] ? ' selected' : '') + '>' + item[1] + '</option>'; }).join('') + '</select></td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty">No matching enquiries yet.</td></tr>';
    document.getElementById('new-count').textContent = leads.filter(function (item) { return item.status === 'new'; }).length;
    document.getElementById('lead-count').textContent = leads.length;
  }
  function renderSubscribers() {
    var query = document.getElementById('subscriber-search').value.trim().toLowerCase();
    var filtered = subscribers.filter(function (row) { return JSON.stringify(row).toLowerCase().includes(query); });
    var tbody = document.getElementById('subscriber-rows');
    tbody.innerHTML = filtered.length ? filtered.map(function (row) {
      return '<tr><td><strong><a href="mailto:' + encodeURIComponent(row.email) + '">' + escapeHtml(row.email) + '</a></strong></td><td>' + escapeHtml(row.source_page || '—') + '</td><td>' + escapeHtml(date(row.consented_at)) + '</td><td>' + (row.status === 'subscribed' ? '<span class="subscriber-status">Subscribed</span>' : '<span class="subscriber-unsubscribed">Unsubscribed</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="4" class="empty">No matching subscribers yet.</td></tr>';
    document.getElementById('subscriber-count').textContent = subscribers.filter(function (item) { return item.status === 'subscribed'; }).length;
  }
  async function loadAll() {
    say('Loading inbox data…');
    try {
      var results = await Promise.all([request('/api/admin/leads?limit=500'), request('/api/admin/newsletter?limit=1000')]);
      leads = results[0].items || [];
      subscribers = results[1].items || [];
      renderLeads(); renderSubscribers(); say('Inbox updated just now.');
    } catch (error) { say(error.message, true); }
  }
  function articleValues() {
    return {
      title: document.getElementById('article-title').value.trim(),
      slug: document.getElementById('article-slug').value.trim(),
      date: document.getElementById('article-date').value,
      description: document.getElementById('article-description').value.trim(),
      excerpt: document.getElementById('article-excerpt').value.trim(),
      category: document.getElementById('article-category').value.trim(),
      topic: document.getElementById('article-topic').value,
      read_minutes: Number(document.getElementById('article-read-minutes').value) || 6,
      image: document.getElementById('article-image').value.trim(),
      image_alt: document.getElementById('article-image-alt').value.trim(),
      tags: document.getElementById('article-tags').value.split(',').map(function (item) { return item.trim(); }).filter(Boolean),
      body_md: document.getElementById('article-body').value
    };
  }
  function setArticleMessage(message, error) {
    var node = document.getElementById('article-message');
    node.textContent = message || '';
    node.style.color = error ? '#a23d2e' : '';
  }
  function renderArticleList() {
    var node = document.getElementById('article-list');
    node.innerHTML = articles.length ? articles.map(function (item) {
      var selected = String(item.id) === document.getElementById('article-id').value;
      var stateClass = item.status === 'published' ? 'article-card-live' : 'article-card-draft';
      var stateText = item.status === 'published' ? 'Published' : 'Draft';
      return '<button type="button" class="article-list-item' + (selected ? ' is-selected' : '') + '" data-article-id="' + Number(item.id) + '"><strong>' + escapeHtml(item.title) + '</strong><small class="' + stateClass + '">' + stateText + ' · ' + escapeHtml(item.date) + '</small></button>';
    }).join('') : '<p class="empty">No articles saved yet. Start a new article to build the library.</p>';
  }
  function showArticle(item) {
    var form = document.getElementById('article-form');
    form.reset();
    document.getElementById('article-id').value = item ? item.id : '';
    document.getElementById('article-title').value = item ? item.title : '';
    document.getElementById('article-slug').value = item ? item.slug : '';
    document.getElementById('article-date').value = item ? item.date : new Date().toISOString().slice(0, 10);
    document.getElementById('article-description').value = item ? item.description : '';
    document.getElementById('article-excerpt').value = item ? item.excerpt : '';
    document.getElementById('article-category').value = item ? item.category : '';
    document.getElementById('article-topic').value = item ? item.topic : 'strategy';
    document.getElementById('article-read-minutes').value = item ? item.read_minutes : 6;
    document.getElementById('article-image').value = item ? item.image : '';
    document.getElementById('article-image-alt').value = item ? item.image_alt : '';
    var tags = [];
    try { tags = item ? JSON.parse(item.tags_json || '[]') : []; } catch (_) { tags = []; }
    document.getElementById('article-tags').value = tags.join(', ');
    document.getElementById('article-body').value = item ? item.body_md : '';
    document.getElementById('article-form-title').textContent = item ? 'Edit article' : 'Create an article';
    document.getElementById('article-state-label').textContent = item ? 'MOVEX MEDIA · EDITOR' : 'MOVEX MEDIA · NEW DRAFT';
    var status = document.getElementById('article-status');
    status.textContent = item ? item.status.toUpperCase() : 'DRAFT';
    status.classList.toggle('is-published', !!item && item.status === 'published');
    document.getElementById('delete-article').hidden = !item || item.status !== 'draft';
    document.getElementById('publish-article').textContent = item && item.status === 'published' ? 'Publish update ↗' : 'Publish article ↗';
    document.getElementById('article-slug').readOnly = !!item && item.status === 'published';
    slugWasEdited = !!item;
    setArticleMessage('');
    renderArticleList();
    updateArticlePreview();
  }
  function loadArticles() {
    setArticleMessage('Loading article library…');
    request('/api/admin/articles').then(function (result) {
      articles = result.items || [];
      renderArticleList();
      if (!document.getElementById('article-id').value) showArticle(null);
      setArticleMessage('Article library updated.');
    }).catch(function (error) { setArticleMessage(error.message, true); });
  }
  function previewInline(value) {
    var safe = escapeHtml(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    return safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, target) {
      var href = target.replace(/&amp;/g, '&');
      if (!/^(https:\/\/|\/|#)/i.test(href)) return label;
      return '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
  }
  function previewMarkdown(value) {
    var out = [], paragraph = [], list = '';
    function flushParagraph() { if (paragraph.length) out.push('<p>' + previewInline(paragraph.join(' ')) + '</p>'); paragraph = []; }
    function flushList() { if (list) { out.push('</' + list + '>'); list = ''; } }
    value.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim(), heading = /^(#{1,3})\s+(.+)$/.exec(line), item = /^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/.exec(line);
      if (!line) { flushParagraph(); flushList(); return; }
      if (heading) { flushParagraph(); flushList(); var level = heading[1].length; out.push('<h' + level + '>' + previewInline(heading[2]) + '</h' + level + '>'); return; }
      if (item) { flushParagraph(); var kind = /^\d/.test(line) ? 'ol' : 'ul'; if (list !== kind) { flushList(); out.push('<' + kind + '>'); list = kind; } out.push('<li>' + previewInline(item[1]) + '</li>'); return; }
      flushList(); paragraph.push(line);
    });
    flushParagraph(); flushList();
    return out.join('') || '<p class="preview-placeholder">Your article preview will appear here.</p>';
  }
  function updateArticlePreview() {
    var title = document.getElementById('article-title').value.trim();
    var body = document.getElementById('article-body').value;
    document.getElementById('article-preview-content').innerHTML = (title ? '<h1>' + escapeHtml(title) + '</h1>' : '') + previewMarkdown(body);
  }
  async function persistArticle() {
    var form = document.getElementById('article-form');
    if (!form.reportValidity()) throw new Error('Please complete the required article fields first.');
    var payload = articleValues();
    var id = document.getElementById('article-id').value;
    var result = await request(id ? '/api/admin/articles/' + Number(id) : '/api/admin/articles', {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
    });
    showArticle(result.item);
    articles = articles.filter(function (item) { return Number(item.id) !== Number(result.item.id); });
    articles.unshift({ id: result.item.id, slug: result.item.slug, title: result.item.title, date: result.item.date, category: result.item.category, status: result.item.status, updated_at: result.item.updated_at });
    renderArticleList();
    return result.item;
  }
  function csvCell(value) { return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"'; }
  function downloadCsv(name, rows, fields) {
    var content = [fields.map(function (field) { return csvCell(field[1]); }).join(',')]
      .concat(rows.map(function (row) { return fields.map(function (field) { return csvCell(row[field[0]]); }).join(','); })).join('\r\n');
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' }));
    link.download = name; link.click(); URL.revokeObjectURL(link.href);
  }

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    loginMessage.textContent = 'Checking your account…';
    var button = loginForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
      var form = new FormData(loginForm);
      var result = await request('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      sessionStorage.setItem(tokenKey, result.token);
      loginMessage.textContent = '';
      showDashboard();
    } catch (error) { loginMessage.textContent = error.message === 'invalid_credentials' ? 'Email or password is incorrect.' : (error.message === 'login_rate_limited' ? 'Too many attempts. Please wait an hour, then try again.' : error.message); }
    finally { button.disabled = false; }
  });
  logoutButton.addEventListener('click', function () { signOut(true); });
  document.getElementById('refresh').addEventListener('click', loadAll);
  document.getElementById('lead-search').addEventListener('input', renderLeads);
  document.getElementById('subscriber-search').addEventListener('input', renderSubscribers);
  document.getElementById('export-leads').addEventListener('click', function () { downloadCsv('movex-leads.csv', leads, [['id','ID'],['first_name','First name'],['last_name','Last name'],['email','Email'],['service','Service'],['project','Project'],['status','Status'],['source_page','Source page'],['created_at','Received']]); });
  document.getElementById('export-subscribers').addEventListener('click', function () { downloadCsv('movex-newsletter-subscribers.csv', subscribers, [['id','ID'],['email','Email'],['status','Status'],['source_page','Source page'],['consented_at','Consent recorded']]); });
  document.querySelectorAll('[data-admin-panel]').forEach(function (button) {
    button.addEventListener('click', function () {
      var selected = button.dataset.adminPanel;
      document.querySelectorAll('[data-admin-panel]').forEach(function (item) { item.classList.toggle('is-active', item === button); });
      document.getElementById('overview-panel').hidden = selected !== 'overview';
      document.getElementById('media-panel').hidden = selected !== 'media';
      if (selected === 'media' && !articlesLoaded) {
        showArticle(null);
        loadArticles();
        articlesLoaded = true;
      }
    });
  });
  document.getElementById('new-article').addEventListener('click', function () { showArticle(null); document.getElementById('article-title').focus(); });
  document.getElementById('refresh-articles').addEventListener('click', loadArticles);
  document.getElementById('article-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-article-id]'); if (!button) return;
    request('/api/admin/articles/' + Number(button.dataset.articleId)).then(function (result) { showArticle(result.item); }).catch(function (error) { setArticleMessage(error.message, true); });
  });
  document.getElementById('article-title').addEventListener('input', function () {
    if (!slugWasEdited) document.getElementById('article-slug').value = this.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
    updateArticlePreview();
  });
  document.getElementById('article-slug').addEventListener('input', function () { slugWasEdited = true; });
  document.getElementById('article-body').addEventListener('input', updateArticlePreview);
  document.getElementById('toggle-preview').addEventListener('click', function () {
    var preview = document.getElementById('article-preview');
    preview.hidden = !preview.hidden;
    this.textContent = preview.hidden ? 'Show preview' : 'Hide preview';
    this.setAttribute('aria-pressed', preview.hidden ? 'false' : 'true');
  });
  document.querySelectorAll('[data-insert]').forEach(function (button) {
    button.addEventListener('click', function () {
      var editor = document.getElementById('article-body');
      var start = editor.selectionStart, end = editor.selectionEnd, selected = editor.value.slice(start, end) || 'your text';
      var before = '', after = '', replacement = selected;
      if (button.dataset.insert === 'heading') { before = '## '; after = '\n'; }
      if (button.dataset.insert === 'bold') { before = '**'; after = '**'; }
      if (button.dataset.insert === 'italic') { before = '*'; after = '*'; }
      if (button.dataset.insert === 'bullets') { before = '- '; after = '\n'; }
      if (button.dataset.insert === 'numbered') { before = '1. '; after = '\n'; }
      if (button.dataset.insert === 'link') { before = '['; after = '](https://example.com)'; }
      replacement = before + selected + after;
      editor.setRangeText(replacement, start, end, 'select');
      editor.focus(); updateArticlePreview();
    });
  });
  document.getElementById('article-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var save = document.getElementById('save-article'); save.disabled = true; setArticleMessage('Saving draft…');
    try { await persistArticle(); setArticleMessage('Draft saved securely. It is not public until you publish it.'); }
    catch (error) { setArticleMessage(error.message, true); }
    finally { save.disabled = false; }
  });
  document.getElementById('publish-article').addEventListener('click', async function () {
    var button = this; button.disabled = true; setArticleMessage('Saving your article…');
    try {
      var article = await persistArticle();
      setArticleMessage('Publishing to GitHub and rebuilding the SEO article page…');
      var result = await request('/api/admin/articles/' + Number(article.id) + '/publish', { method: 'POST', body: '{}' });
      articles = articles.map(function (item) { return Number(item.id) === Number(article.id) ? Object.assign({}, item, { status: 'published' }) : item; });
      article.status = 'published'; showArticle(article); renderArticleList();
      setArticleMessage('Published. GitHub Actions is rebuilding the article, media listing, sitemap and feed. ' + result.url);
    } catch (error) {
      var message = error.message === 'github_publisher_not_configured' ? 'GitHub publishing is not configured on the Worker yet. Save this as a private draft for now.' : error.message;
      setArticleMessage(message, true);
    } finally { button.disabled = false; }
  });
  document.getElementById('delete-article').addEventListener('click', async function () {
    var id = Number(document.getElementById('article-id').value); if (!id || !window.confirm('Delete this unpublished draft?')) return;
    this.disabled = true;
    try { await request('/api/admin/articles/' + id, { method: 'DELETE' }); articles = articles.filter(function (item) { return Number(item.id) !== id; }); showArticle(null); renderArticleList(); setArticleMessage('Draft deleted.'); }
    catch (error) { setArticleMessage(error.message, true); }
    finally { this.disabled = false; }
  });
  document.addEventListener('change', async function (event) {
    var select = event.target.closest('.status-select'); if (!select) return;
    var row = leads.find(function (item) { return Number(item.id) === Number(select.dataset.leadId); });
    if (!row) return;
    var oldStatus = row.status; row.status = select.value; renderLeads();
    try { await request('/api/admin/leads/' + Number(row.id), { method: 'PATCH', body: JSON.stringify({ status: row.status }) }); say('Lead status saved.'); }
    catch (error) { row.status = oldStatus; renderLeads(); say(error.message, true); }
  });
  if (token()) showDashboard();
})();
