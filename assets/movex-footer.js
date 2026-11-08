(function () {
  var year = document.getElementById('mx-footer-year');
  if (year) year.textContent = new Date().getFullYear();

  function insertPrivacyAndTrap(form, kind) {
    if (form.querySelector('[data-mx-consent]')) return;
    var trap = document.createElement('div');
    trap.className = 'mx-form-trap';
    trap.setAttribute('aria-hidden', 'true');
    trap.innerHTML = '<label>Leave this field empty<input name="website" tabindex="-1" autocomplete="off"></label>';
    form.appendChild(trap);

    var consent = document.createElement('label');
    consent.className = 'mx-form-consent';
    consent.dataset.mxConsent = 'true';
    consent.innerHTML = kind === 'newsletter'
      ? '<input type="checkbox" name="consent" required><span>I agree to receive MoveX email updates. I can request removal at any time. See the <a href="privacy-policy.html">Privacy Policy</a>.</span>'
      : '<input type="checkbox" name="consent" required><span>I agree that MoveX may use these details to respond to my enquiry. See the <a href="privacy-policy.html">Privacy Policy</a>.</span>';
    var button = form.querySelector('button[type="submit"]');
    if (button) button.before(consent);
    else form.appendChild(consent);

    var note = form.querySelector('small');
    if (note) {
      note.dataset.mxOriginalNote = note.textContent;
      note.classList.add('mx-form-status');
      note.setAttribute('aria-live', 'polite');
      note.textContent = 'Submitting securely…';
      note.textContent = note.dataset.mxOriginalNote;
    } else {
      note = document.createElement('small');
      note.className = 'mx-form-status';
      note.setAttribute('aria-live', 'polite');
      form.appendChild(note);
    }
  }

  var lead = document.getElementById('homepage-contact-form');
  if (lead) insertPrivacyAndTrap(lead, 'lead');
  document.querySelectorAll('.mx-newsletter, #mx-page-newsletter, #footer-newsletter-form').forEach(function (form) {
    insertPrivacyAndTrap(form, 'newsletter');
  });

  function setStatus(form, message, isError) {
    var note = form.querySelector('.mx-form-status') || form.querySelector('small');
    if (!note) return;
    note.textContent = message;
    note.classList.toggle('is-error', Boolean(isError));
    note.classList.toggle('is-success', !isError);
  }

  function apiUrl(path) {
    var base = String(window.MOVEX_INBOX_API || '').trim().replace(/\/$/, '');
    return base ? base + path : '';
  }

  async function submitForm(form, type) {
    var endpoint = apiUrl(type === 'lead' ? '/api/leads' : '/api/newsletter');
    if (!endpoint) {
      setStatus(form, 'Online form storage is being connected. Please email ferdouswahidfahim24@gmail.com for now.', true);
      return;
    }
    var button = form.querySelector('button[type="submit"]');
    var originalButton = button ? button.textContent : '';
    if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    setStatus(form, 'Sending securely…', false);
    var data = new FormData(form);
    var payload = {
      email: data.get('email'),
      consent: data.get('consent') === 'on',
      website: data.get('website'),
      sourcePage: window.location.pathname
    };
    if (type === 'lead') {
      payload.firstName = data.get('firstName');
      payload.lastName = data.get('lastName');
      payload.service = data.get('service');
      payload.project = data.get('project');
    }
    try {
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.ok) throw new Error(result.error || 'send_failed');
      setStatus(form, result.message || (type === 'lead' ? 'Thanks — your enquiry is in. We’ll be in touch.' : 'Thanks — you’re on the MoveX update list.'), false);
      form.reset();
      if (window.dataLayer) window.dataLayer.push({ event: type === 'lead' ? 'contact_form_submit' : 'newsletter_submit', form_id: form.id || 'newsletter', form_type: type });
    } catch (_) {
      setStatus(form, 'We could not save this just now. Please try again or email ferdouswahidfahim24@gmail.com.', true);
    } finally {
      if (button) { button.disabled = false; button.textContent = originalButton; }
    }
  }

  // Capture phase prevents legacy mailto handlers from opening and handles every shared footer form.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    var isLead = form.id === 'homepage-contact-form';
    var isNewsletter = form.matches('.mx-newsletter, #mx-page-newsletter, #footer-newsletter-form');
    if (!isLead && !isNewsletter) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitForm(form, isLead ? 'lead' : 'newsletter');
  }, true);
})();
