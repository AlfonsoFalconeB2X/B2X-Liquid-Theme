/*
 * theme.js — JavaScript globale (modulo ES, caricato in differita dal layout).
 * Componenti come custom elements: si inizializzano da soli anche quando il theme editor ricarica una section.
 * Configurazione da window.theme (routes, asset, tipo di carrello, testi), definita in layout/theme.liquid.
 */

const config = window.theme || { routes: {}, strings: {}, assets: {} };
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const designMode = Boolean(window.Shopify?.designMode);

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

const debounce = (fn, wait = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');

/* ---------- Notifiche brevi (toast) ---------- */

/**
 * Mostra un messaggio breve per gli esiti senza un posto vicino in pagina (es. codice sconto applicato).
 * Dentro un <dialog> modale il contenitore va nel dialog: fuori sarebbe inerte e nascosto dal velo.
 */
export function showToast(message, { tone = 'info' } = {}) {
  if (!message) return;
  const host = document.querySelector('dialog[open]') || document.body;
  let region = host.querySelector(':scope > .toasts');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    host.append(region);
  }
  const toast = document.createElement('p');
  toast.className = `toast toast--${tone}`;
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

window.themeToast = showToast;

/* ---------- Carrello ---------- */

/** Section da riaggiornare dopo ogni modifica al carrello: tutte quelle marcate con data-cart-section. */
function cartSections() {
  const ids = new Set(['cart-icon-bubble']);
  document.querySelectorAll('[data-cart-section]').forEach((el) => ids.add(el.dataset.cartSection));
  return [...ids];
}

const cartCount = () => Number(document.querySelector('.cart-count')?.textContent || 0);

/** Sostituisce il contenuto degli elementi data-cart-section con l'HTML restituito dalla Section Rendering API. */
function renderCartSections(sections) {
  if (!sections) return;
  const activeId = document.activeElement?.id;
  const previousCount = cartCount();
  const previousProgress = document.querySelector('[data-free-shipping]')?.style.getPropertyValue('--progress');

  Object.entries(sections).forEach(([id, html]) => {
    if (!html) return;
    const source = parseHTML(html).querySelector(`[data-cart-section="${id}"]`);
    if (!source) return;
    document.querySelectorAll(`[data-cart-section="${id}"]`).forEach((target) => {
      target.innerHTML = source.innerHTML;
    });
  });

  // La barra della spedizione gratuita riparte dal valore precedente, così l'avanzamento si vede.
  if (previousProgress) {
    document.querySelectorAll('[data-free-shipping]').forEach((bar) => {
      const next = bar.style.getPropertyValue('--progress');
      bar.style.setProperty('--progress', previousProgress);
      requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty('--progress', next)));
    });
  }

  // Il contatore del carrello "pulsa" quando aumenta.
  if (cartCount() > previousCount && !reducedMotion.matches) {
    document.querySelectorAll('.cart-count').forEach((badge) => badge.classList.add('is-bumped'));
  }

  // Se l'elemento con il focus non esiste più (es. riga rimossa) il focus va su un punto stabile.
  if (activeId && !document.getElementById(activeId)) {
    const fallback =
      document.querySelector('dialog[open] [data-cart-focus-fallback]') ||
      document.querySelector('[data-cart-focus-fallback]');
    fallback?.focus();
  } else if (activeId) {
    document.getElementById(activeId)?.focus();
  }
}

async function cartRequest(url, body, { render = true } = {}) {
  const isForm = body instanceof FormData;
  if (isForm && render) {
    body.append('sections', cartSections().join(','));
    body.append('sections_url', window.location.pathname);
  }
  const payload = isForm
    ? body
    : JSON.stringify(render ? { ...body, sections: cartSections(), sections_url: window.location.pathname } : body);

  const response = await fetch(url, {
    method: 'POST',
    headers: isForm
      ? { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: payload,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // risposta non JSON: gestita sotto come errore
  }
  if (!response.ok) {
    throw new Error(data.description || data.message || config.strings.cartError);
  }
  return data;
}

const announce = (detail) => document.dispatchEvent(new CustomEvent('cart:updated', { detail }));

export const cart = {
  async add(formData) {
    const data = await cartRequest(`${config.routes.cartAdd}.js`, formData);
    renderCartSections(data.sections);
    announce({ source: 'add', item: data });
    return data;
  },

  async change(line, quantity) {
    const data = await cartRequest(`${config.routes.cartChange}.js`, { line, quantity });
    renderCartSections(data.sections);
    announce({ source: 'change', cart: data });
    return data;
  },

  /** Nota, attributi, codici sconto. Con render: false non ridisegna nulla (es. mentre il cliente scrive). */
  async update(body, { render = true } = {}) {
    const data = await cartRequest(`${config.routes.cartUpdate}.js`, body, { render });
    if (render) renderCartSections(data.sections);
    announce({ source: 'update', cart: data });
    return data;
  },
};

window.themeCart = cart;

/** Cassetto del carrello: <dialog> modale (focus intrappolato e resto della pagina inerte in modo nativo). */
class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog || event.target.closest('[data-cart-close]')) this.close();
    });
    this.dialog.addEventListener('close', () => this.opener?.focus?.());
  }

  open(opener) {
    if (this.dialog.open) return;
    this.opener = opener || document.activeElement;
    this.dialog.showModal();
  }

  close() {
    this.dialog.close();
  }
}
define('cart-drawer', CartDrawer);

const getCartDrawer = () => document.querySelector('cart-drawer');

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-cart-toggle]');
  const drawer = getCartDrawer();
  if (!toggle || !drawer) return;
  event.preventDefault();
  drawer.open(toggle);
});

document.addEventListener('animationend', (event) => {
  if (event.target.classList?.contains('is-bumped')) event.target.classList.remove('is-bumped');
});

/* Righe del carrello: quantità e rimozione (cassetto e pagina) */
const updateLine = async (lineEl, quantity) => {
  const line = Number(lineEl.dataset.line);
  const error = lineEl.querySelector('[data-line-error]');
  lineEl.setAttribute('aria-busy', 'true');
  try {
    await cart.change(line, quantity);
  } catch (err) {
    lineEl.removeAttribute('aria-busy');
    if (error) {
      error.textContent = err.message;
      error.hidden = false;
    }
  }
};

// Un'attesa per riga: modifiche ravvicinate su righe diverse non si annullano a vicenda.
const lineTimers = new Map();

document.addEventListener('change', (event) => {
  const input = event.target.closest('.cart-line .quantity__input');
  if (!input) return;
  const lineEl = input.closest('.cart-line');
  const key = lineEl.id;
  clearTimeout(lineTimers.get(key));
  lineTimers.set(
    key,
    setTimeout(() => {
      lineTimers.delete(key);
      // La riga potrebbe essere stata sostituita nel frattempo: si riprende quella attuale.
      const current = document.getElementById(key) || lineEl;
      updateLine(current, Math.max(0, Number(input.value) || 0));
    }, 350),
  );
});

document.addEventListener('click', (event) => {
  const remove = event.target.closest('[data-line-remove]');
  if (!remove) return;
  event.preventDefault();
  updateLine(remove.closest('.cart-line'), 0);
});

/* Codici sconto (cassetto e pagina carrello) */
class CartDiscount extends HTMLElement {
  connectedCallback() {
    this.addEventListener('submit', (event) => {
      if (!event.target.matches('[data-discount-form]')) return;
      event.preventDefault();
      const input = event.target.querySelector('input[name="discount"]');
      const code = input.value.trim();
      if (code) this.apply([...this.codes(), code], code);
    });
    this.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-discount-remove]');
      if (!remove) return;
      const code = remove.dataset.discountRemove;
      this.apply(
        this.codes().filter((existing) => existing !== code),
        null,
      );
    });
  }

  codes() {
    return [...this.querySelectorAll('[data-discount-remove]')].map((el) => el.dataset.discountRemove);
  }

  async apply(codes, added) {
    const button = this.querySelector('[data-discount-form] button');
    const error = this.querySelector('[data-discount-error]');
    button?.setAttribute('aria-busy', 'true');
    if (error) error.hidden = true;
    try {
      await cart.update({ discount: [...new Set(codes)].join(',') });
      if (added) {
        // Il carrello è stato ridisegnato: l'esito si legge dal chip del codice nel nuovo HTML.
        const scope = document.querySelector('dialog[open] cart-discount') || document.querySelector('cart-discount');
        const chip = scope?.querySelector(`[data-discount-remove="${CSS.escape(added)}" i]`);
        if (!chip || chip.dataset.applicable === 'false') {
          const message = (config.strings.discountInvalid || '').replace('[code]', added);
          const target = scope?.querySelector('[data-discount-error]');
          if (target) {
            target.textContent = message;
            target.hidden = false;
          } else {
            showToast(message, { tone: 'error' });
          }
          return;
        }
        showToast((config.strings.discountApplied || '').replace('[code]', added), { tone: 'success' });
      }
    } catch (err) {
      if (error) {
        error.textContent = err.message;
        error.hidden = false;
      }
    } finally {
      button?.removeAttribute('aria-busy');
    }
  }
}
define('cart-discount', CartDiscount);

/* Nota e attributi dell'ordine: salvati mentre il cliente scrive, senza ridisegnare il carrello */
class CartNote extends HTMLElement {
  connectedCallback() {
    this.save = debounce((field) => this.persist(field), 500);
    this.addEventListener('input', (event) => {
      if (event.target.matches('textarea, input[type="text"]')) this.save(event.target);
    });
    this.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"]')) this.persist(event.target);
    });
  }

  async persist(field) {
    const status = this.querySelector('[data-note-status]');
    let body;
    if (field.name === 'note') {
      body = { note: field.value };
    } else {
      const key = field.dataset.attribute;
      const value = field.type === 'checkbox' ? (field.checked ? field.value : '') : field.value;
      body = { attributes: { [key]: value } };
    }
    try {
      await cart.update(body, { render: false });
      if (status) {
        status.textContent = config.strings.saved || '';
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => {
          status.textContent = '';
        }, 2000);
      }
    } catch (err) {
      showToast(err.message, { tone: 'error' });
    }
  }
}
define('cart-note', CartNote);

/* ---------- Quantità ---------- */
class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quantity]');
      if (!button) return;
      const step = Number(this.input.step) || 1;
      const min = Number(this.input.min) || 0;
      const max = this.input.max ? Number(this.input.max) : Infinity;
      const current = Number(this.input.value) || 0;
      const next = button.dataset.quantity === 'plus' ? current + step : current - step;
      const value = Math.min(max, Math.max(min, next));
      if (value === current) return;
      this.input.value = value;
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
}
define('quantity-input', QuantityInput);

/* ---------- Aggiunta al carrello ---------- */
class ProductForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.form?.addEventListener('submit', (event) => this.onSubmit(event));
  }

  async onSubmit(event) {
    const drawer = getCartDrawer();
    // Carrello come pagina: invio nativo del form (porta al carrello).
    if (config.cartType !== 'drawer' || !drawer) return;

    event.preventDefault();
    const button = event.submitter || this.form.querySelector('[type="submit"]');
    const error = this.querySelector('[data-form-error]');
    if (button?.getAttribute('aria-busy') === 'true') return;

    button?.setAttribute('aria-busy', 'true');
    if (error) error.hidden = true;

    try {
      await cart.add(new FormData(this.form));
      // Dall'anteprima rapida: si chiude e il cassetto restituirà il focus alla card di partenza.
      const dialog = this.closest('dialog');
      const opener = dialog?.returnFocusTo || button;
      if (dialog) {
        dialog.returnFocusTo = null;
        dialog.close();
      }
      drawer.open(opener);
    } catch (err) {
      if (error) {
        error.textContent = err.message;
        error.hidden = false;
      }
    } finally {
      button?.removeAttribute('aria-busy');
    }
  }
}
define('product-form', ProductForm);

/* ---------- Anteprima rapida (modulo caricato al primo clic) ---------- */
document.addEventListener('click', async (event) => {
  const trigger = event.target.closest('[data-quick-view]');
  if (!trigger || !config.assets.quickView) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
  event.preventDefault();
  const { openQuickView } = await import(config.assets.quickView);
  openQuickView(trigger.getAttribute('href') || trigger.dataset.quickView, trigger);
});

/* ---------- Swatch colore sulle card ---------- */
const selectSwatch = (swatch) => {
  const card = swatch.closest('.card');
  if (!card) return;
  const image = card.querySelector('.card__image:not(.card__image--secondary)');
  if (image && swatch.dataset.src) {
    image.srcset = swatch.dataset.srcset || '';
    image.src = swatch.dataset.src;
    card.classList.add('card--swatch-selected');
  }
  if (swatch.dataset.url) {
    card.querySelectorAll('.card__link, [data-quick-view]').forEach((link) => link.setAttribute('href', swatch.dataset.url));
  }
  card.querySelectorAll('[data-card-swatch]').forEach((el) => el.setAttribute('aria-pressed', String(el === swatch)));
};

document.addEventListener('click', (event) => {
  const swatch = event.target.closest('[data-card-swatch]');
  if (swatch) selectSwatch(swatch);
});

document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const swatch = event.target.closest?.('[data-card-swatch]');
  if (swatch) selectSwatch(swatch);
});

/* ---------- Menu a tendina dell'header ---------- */
const dropdowns = () => document.querySelectorAll('details[data-menu-dropdown]');
const hoverQuery = window.matchMedia('(hover: hover) and (min-width: 990px)');

document.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.matches('[data-menu-dropdown]') || !details.open) return;
    dropdowns().forEach((other) => {
      if (other !== details) other.open = false;
    });
  },
  true,
);

document.addEventListener('click', (event) => {
  // Un pannello appena aperto dal passaggio del mouse resta aperto al primo clic sul titolo.
  const summary = event.target.closest('details[data-menu-dropdown] > summary');
  if (summary && summary.parentElement.open && summary.parentElement._hoverOpened) {
    event.preventDefault();
    summary.parentElement._hoverOpened = false;
  }
  dropdowns().forEach((details) => {
    if (details.open && !details.contains(event.target)) details.open = false;
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  dropdowns().forEach((details) => {
    if (!details.open) return;
    details.open = false;
    details.querySelector('summary')?.focus();
  });
});

document.addEventListener('focusout', (event) => {
  const details = event.target.closest?.('details[data-menu-dropdown]');
  if (details && event.relatedTarget && !details.contains(event.relatedTarget)) details.open = false;
});

// Con il mouse i pannelli si aprono al passaggio (con un piccolo ritardo in chiusura).
document.addEventListener('pointerover', (event) => {
  if (!hoverQuery.matches || event.pointerType !== 'mouse') return;
  const details = event.target.closest?.('details[data-menu-dropdown]');
  if (!details) return;
  clearTimeout(details._closeTimer);
  if (!details.open) {
    details.open = true;
    details._hoverOpened = true;
  }
});

document.addEventListener('pointerout', (event) => {
  if (!hoverQuery.matches || event.pointerType !== 'mouse') return;
  const details = event.target.closest?.('details[data-menu-dropdown]');
  if (!details || details.contains(event.relatedTarget)) return;
  details._closeTimer = setTimeout(() => {
    details.open = false;
    details._hoverOpened = false;
  }, 180);
});

/* ---------- Header: ombra dopo lo scorrimento, a scomparsa scendendo (se attivo) ---------- */
function initHeaderScroll() {
  const header = document.querySelector('.header-wrapper--sticky');
  const section = header?.closest('.shopify-section');
  if (!section || section.dataset.scrollReady) return;
  section.dataset.scrollReady = 'true';
  const hides = header.classList.contains('header-wrapper--hide-on-scroll');
  let lastY = window.scrollY;
  let ticking = false;

  const isBusy = () =>
    header.querySelector('details[open]') || document.querySelector('[popover]:popover-open, dialog[open]');

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    section.toggleAttribute('data-header-scrolled', y > 4);
    if (hides) {
      const goingDown = y > lastY && y > section.offsetHeight * 2;
      if (goingDown && !isBusy()) section.setAttribute('data-header-hidden', '');
      else if (y < lastY - 4 || y <= section.offsetHeight) section.removeAttribute('data-header-hidden');
    }
    lastY = y;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  // Se il focus entra nell'header nascosto (tastiera) l'header ricompare.
  section.addEventListener('focusin', () => section.removeAttribute('data-header-hidden'));
  update();
}

/* ---------- Comparsa durante lo scorrimento ---------- */
let revealObserver;

function initReveal(root = document) {
  if (!document.body.classList.contains('reveal-on') || reducedMotion.matches || designMode) return;
  if (!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('reveal-ready');

  // Nelle righe che scorrono in orizzontale (caroselli, griglie a scorrimento su mobile) gli elementi fuori schermo
  // non entrerebbero mai nella vista: si osserva il contenitore e compaiono tutti insieme, sfalsati.
  const scrollerSelector = '.grid--slider, .carousel__track, .ticker__group';

  revealObserver ||= new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const targets = entry.target.matches(scrollerSelector)
          ? entry.target.querySelectorAll(':scope > .reveal')
          : [entry.target];
        targets.forEach((el) => el.classList.add('is-visible'));
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
  );

  root.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
    // Sfalsamento tra elementi fratelli (griglie), al massimo 6 passi.
    const siblings = [...el.parentElement.children].filter((child) => child.classList.contains('reveal'));
    el.style.setProperty('--reveal-index', String(Math.min(siblings.indexOf(el), 6)));
    const scroller = el.parentElement.closest(scrollerSelector);
    revealObserver.observe(scroller && scroller === el.parentElement ? scroller : el);
  });
}

/* ---------- Ricerca predittiva ---------- */
class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-predictive-results]');
    this.status = this.querySelector('[data-predictive-status]');
    this.controller = null;

    const popover = this.closest('[popover]');
    popover?.addEventListener('toggle', (event) => {
      if (event.newState === 'open') this.input.focus();
    });

    if (!this.hasAttribute('data-enabled')) return;
    this.input.addEventListener(
      'input',
      debounce(() => this.search(this.input.value.trim()), 250),
    );
  }

  async search(term) {
    this.controller?.abort();
    if (!term) {
      this.results.innerHTML = '';
      this.status.textContent = '';
      return;
    }

    this.controller = new AbortController();
    const params = new URLSearchParams({
      q: term,
      section_id: 'predictive-search',
      'resources[limit]': '6',
      'resources[limit_scope]': 'each',
    });
    this.results.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(`${config.routes.predictiveSearch}?${params}`, {
        signal: this.controller.signal,
      });
      if (!response.ok) throw new Error(response.status);
      const doc = parseHTML(await response.text());
      const content = doc.querySelector('[data-predictive-content]');
      this.results.innerHTML = content ? content.innerHTML : '';
      const count = content?.dataset.count || '0';
      this.status.textContent = (config.strings.searchResults || '').replace('[count]', count);
    } catch (err) {
      if (err.name !== 'AbortError') this.results.innerHTML = '';
    } finally {
      this.results.removeAttribute('aria-busy');
    }
  }
}
define('predictive-search', PredictiveSearch);

/* ---------- Barra annunci ---------- */
class AnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('.announcement__track');
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-direction]');
      if (!button) return;
      const direction = Number(button.dataset.direction);
      const width = this.track.clientWidth;
      const max = this.track.scrollWidth - width;
      let next = this.track.scrollLeft + direction * width;
      if (next > max + 1) next = 0;
      if (next < -1) next = max;
      this.track.scrollTo({ left: next, behavior: 'smooth' });
    });
  }
}
define('announcement-bar', AnnouncementBar);

/* ---------- Ticker: copie per uno scorrimento continuo, velocità costante, pausa ---------- */
class TickerStrip extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-ticker-track]');
    this.group = this.querySelector('[data-ticker-group]');
    this.toggle = this.querySelector('[data-ticker-toggle]');
    if (!this.track || !this.group) return;

    this.toggle?.addEventListener('click', () => this.setPaused(!this.hasAttribute('data-paused')));
    if (reducedMotion.matches) return;

    // Il gruppo deve essere più largo del contenitore: si ripetono gli elementi finché serve.
    const originals = [...this.group.children];
    let guard = 0;
    while (this.group.scrollWidth < this.clientWidth && originals.length && guard < 12) {
      originals.forEach((item) => this.group.append(this.hiddenClone(item)));
      guard += 1;
    }
    const copy = this.hiddenClone(this.group);
    copy.removeAttribute('data-ticker-group');
    this.track.append(copy);

    const speed = Number(this.dataset.speed) || 40;
    this.style.setProperty('--ticker-duration', `${(this.group.scrollWidth / speed).toFixed(2)}s`);
    this.setAttribute('data-ready', '');
  }

  hiddenClone(node) {
    const clone = node.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
    if (clone.matches('a, button')) clone.setAttribute('tabindex', '-1');
    return clone;
  }

  setPaused(paused) {
    this.toggleAttribute('data-paused', paused);
    if (!this.toggle) return;
    this.toggle.setAttribute('aria-pressed', String(paused));
    this.toggle.setAttribute('aria-label', paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
  }
}
define('ticker-strip', TickerStrip);

/* ---------- Prodotti consigliati (caricati quando stanno per entrare nello schermo) ---------- */
class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        this.load();
      },
      { rootMargin: '0px 0px 400px 0px' },
    );
    observer.observe(this);
  }

  async load() {
    try {
      const response = await fetch(this.dataset.url);
      const doc = parseHTML(await response.text());
      const content = doc.querySelector('product-recommendations');
      if (content && content.querySelector('[data-recommendations-list]')) {
        this.innerHTML = content.innerHTML;
        initReveal(this);
      } else {
        this.closest('.shopify-section')?.setAttribute('hidden', '');
      }
    } catch {
      this.closest('.shopify-section')?.setAttribute('hidden', '');
    }
  }
}
define('product-recommendations', ProductRecommendations);

/* ---------- Video con anteprima (carica il player solo al clic) ---------- */
class DeferredMedia extends HTMLElement {
  connectedCallback() {
    this.querySelector('[data-deferred-play]')?.addEventListener('click', () => {
      const template = this.querySelector('template');
      if (!template) return;
      const content = template.content.firstElementChild.cloneNode(true);
      this.replaceChildren(content);
      if (content.tagName === 'VIDEO') content.play?.();
      content.focus?.();
    });
  }
}
define('deferred-media', DeferredMedia);

/* ---------- Selettori paese/lingua ---------- */
document.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-autosubmit]');
  if (select) select.form?.submit();
});

/* ---------- Avvio e theme editor ---------- */
initHeaderScroll();
initReveal();

document.addEventListener('shopify:section:load', (event) => {
  document.querySelectorAll('[popover]:popover-open').forEach((el) => el.hidePopover());
  initHeaderScroll();
  initReveal(event.target);
});
