(() => {
  window.dataLayer = window.dataLayer || [];

  const pagePath = `${window.location.pathname}${window.location.hash || ''}`;
  const pageName = document.title || 'MoveX Digital';
  const pageType = window.location.pathname.split('/').pop().replace(/\.html?$/i, '') || 'home';

  window.dataLayer.push({
    event: 'page_view',
    page_title: pageName,
    page_path: pagePath,
    page_type: pageType,
    page_location: `${window.location.origin}${pagePath}`
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const label = (link.innerText || link.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100);

    if (/^https?:/i.test(href) && !href.includes(window.location.hostname)) {
      window.dataLayer.push({ event: 'outbound_click', link_url: href, link_text: label });
    }
    if (/^mailto:/i.test(href)) {
      window.dataLayer.push({ event: 'email_click', link_text: label });
    }
    if (/wa\.me|whatsapp/i.test(href)) {
      window.dataLayer.push({ event: 'whatsapp_click', link_text: label });
    }
    if (link.closest('#services')) {
      window.dataLayer.push({ event: 'select_service', service_name: label, service_url: href });
    }
    if (link.matches('.button, .pill, [data-track="cta"]')) {
      window.dataLayer.push({ event: 'cta_click', cta_text: label, cta_url: href, page_type: pageType });
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const formId = form.id || form.getAttribute('name') || 'unnamed_form';
    const isNewsletter = form.matches('.mx-newsletter, #footer-newsletter-form, #mx-footer-newsletter');
    const service = form.querySelector('[name="service"]');

    // Never include names, email addresses, phone numbers, or free-text fields in analytics.
    window.dataLayer.push({
      event: isNewsletter ? 'newsletter_submit' : 'contact_form_submit',
      form_id: formId,
      form_type: isNewsletter ? 'newsletter' : 'contact',
      service_name: service ? service.value || 'not_selected' : undefined,
      page_type: pageType
    });
  }, true);
})();
