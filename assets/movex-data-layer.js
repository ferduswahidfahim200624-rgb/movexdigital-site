(() => {
  window.dataLayer = window.dataLayer || [];

  const cleanPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const pagePath = `${window.location.pathname}${window.location.hash || ''}`;
  const pageName = document.title || 'MoveX Digital';
  const pageType = cleanPath === '/' ? 'home' : cleanPath.split('/').pop().replace(/\.html?$/i, '') || 'home';

  // Push page context without colliding with GA4 Google Tag's automatic page_view.
  window.dataLayer.push({
    event: 'movex_page_context',
    page_title: pageName,
    page_path: pagePath,
    page_type: pageType,
    page_location: `${window.location.origin}${pagePath}`
  });

  // Fire confirmed, deduplicated conversion events once on /thank-you/
  // (populated by movex-footer.js only after the Cloudflare Worker confirms storage).
  if (cleanPath === '/thank-you') {
    try {
      const raw = window.sessionStorage.getItem('mx_pending_conversion');
      if (raw) {
        window.sessionStorage.removeItem('mx_pending_conversion');
        const conv = JSON.parse(raw);
        if (conv && conv.event_id) {
          const isNewsletter = conv.type === 'newsletter';
          window.dataLayer.push({
            event: isNewsletter ? 'newsletter_signup' : 'generate_lead',
            event_id: String(conv.event_id),
            form_id: String(conv.form_id || (isNewsletter ? 'newsletter_form' : 'lead_form')),
            service_name: isNewsletter ? undefined : String(conv.service_name || 'not_selected'),
            source_page: String(conv.source_page || '/'),
            page_type: pageType
          });
        }
      }
    } catch (_) {
      // Ignore storage parsing errors in restricted privacy contexts.
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href') || '';
    const label = (link.innerText || link.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100);

    if (/wa\.me|whatsapp/i.test(href)) {
      window.dataLayer.push({
        event: 'whatsapp_click',
        link_text: label,
        link_url: href,
        page_type: pageType
      });
      return;
    }
    if (/^mailto:/i.test(href)) {
      window.dataLayer.push({
        event: 'email_click',
        link_text: label,
        page_type: pageType
      });
      return;
    }
    if (/^https?:/i.test(href) && !href.includes(window.location.hostname)) {
      window.dataLayer.push({
        event: 'outbound_click',
        link_url: href,
        link_text: label,
        page_type: pageType
      });
    }
    if (link.closest('#services')) {
      window.dataLayer.push({
        event: 'select_service',
        service_name: label,
        service_url: href,
        page_type: pageType
      });
    }
    if (link.matches('.button, .pill, [data-track="cta"]')) {
      window.dataLayer.push({
        event: 'cta_click',
        cta_text: label,
        cta_url: href,
        page_type: pageType
      });
    }
  });
})();
