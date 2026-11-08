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
