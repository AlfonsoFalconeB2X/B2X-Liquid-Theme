/*
 * quick-view.js — anteprima rapida dalle card prodotto (importato da theme.js solo al primo utilizzo).
 * Il contenuto è la section `quick-view` richiesta con la Section Rendering API: stessi snippet e stesso
 * product.js della pagina prodotto (varianti, quantità, aggiunta al carrello).
 */

const config = window.theme || { assets: {}, strings: {} };
let dialog;
let content;
let controller;

function loadStylesheet(href) {
  if (!href || document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  });
}

function ensureDialog() {
  if (dialog) return;
  dialog = document.createElement('dialog');
  dialog.className = `quick-view color-${config.drawerScheme || 'scheme-1'}`;
  dialog.setAttribute('aria-labelledby', 'QuickViewTitle');
  dialog.innerHTML = `
    <button type="button" class="icon-button quick-view__close" data-quick-view-close aria-label="${config.strings.close || ''}">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>
    <div class="quick-view__body" data-quick-view-body></div>`;
  content = dialog.querySelector('[data-quick-view-body]');
  document.body.append(dialog);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('[data-quick-view-close]')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    controller?.abort();
    dialog.returnFocusTo?.focus?.();
  });
}

export async function openQuickView(url, trigger) {
  ensureDialog();
  controller?.abort();
  controller = new AbortController();

  dialog.returnFocusTo = trigger;
  content.innerHTML = `<div class="quick-view__loading" role="status"><span class="spinner" aria-hidden="true"></span><span class="visually-hidden">${config.strings.loading || ''}</span></div>`;
  if (!dialog.open) dialog.showModal();

  const productUrl = new URL(url, window.location.origin);
  productUrl.searchParams.set('section_id', 'quick-view');

  try {
    const [response] = await Promise.all([
      fetch(productUrl, { signal: controller.signal }),
      import(config.assets.productJs),
      loadStylesheet(config.assets.productCss),
    ]);
    if (!response.ok) throw new Error(String(response.status));
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const section = doc.querySelector('.quick-view__content');
    if (!section) throw new Error('missing section');
    content.replaceChildren(section);
    window.Shopify?.PaymentButton?.init?.();
    dialog.querySelector('#QuickViewTitle a')?.focus();
  } catch (err) {
    if (err.name === 'AbortError') return;
    // Ripiego: la pagina prodotto completa.
    window.location.href = url;
  }
}
