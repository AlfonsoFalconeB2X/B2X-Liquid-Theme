/*
 * product.js — pagina prodotto (caricato da sections/main-product.liquid e da quick-view.js).
 * Importa product.css: vite-tag aggiunge il foglio di stile accanto allo script e l'import dinamico
 * dell'anteprima rapida lo carica prima di eseguire il modulo.
 * - <product-page>: al cambio di variante chiede la section con ?option_values=… (Section Rendering API)
 *   e sostituisce solo le parti marcate con data-product-part.
 * - <variant-picker>: legge i valori scelti; per i combined listings porta all'URL del prodotto collegato.
 * - <media-gallery>: carosello a scorrimento su mobile, griglia su desktop; mostra il media della variante.
 */

import '../styles/product.css';

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

/**
 * Le scelte del cliente sopravvivono alla sostituzione di una parte: campi con data-preserve (per id:
 * quantità, destinatario del buono regalo) e piano di abbonamento selezionato.
 */
function preserveFields(part, next) {
  part.querySelectorAll('[data-preserve]').forEach((field) => {
    if (!field.id) return;
    const twin = next.querySelector(`#${CSS.escape(field.id)}`);
    if (!twin) return;
    if (field.type === 'checkbox') {
      twin.checked = field.checked;
      return;
    }
    if (field.type === 'number') {
      const value = Number(field.value);
      const withinMax = !twin.max || value <= Number(twin.max);
      const withinMin = !twin.min || value >= Number(twin.min);
      if (withinMax && withinMin) twin.value = field.value;
      return;
    }
    twin.value = field.value;
  });

  const plan = part.querySelector('input[name="selling_plan"]:checked');
  if (plan) {
    const twinPlan = next.querySelector(`input[name="selling_plan"][value="${CSS.escape(plan.value)}"]`);
    if (twinPlan) twinPlan.checked = true;
  }
}

class ProductPage extends HTMLElement {
  async update(optionValueIds) {
    this.controller?.abort();
    this.controller = new AbortController();

    const params = new URLSearchParams({
      option_values: optionValueIds.join(','),
      section_id: this.dataset.section,
    });
    const activeId = document.activeElement?.id;
    this.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(`${this.dataset.url}?${params}`, { signal: this.controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = doc.querySelector('product-page');
      if (!source) throw new Error('missing section');

      this.querySelectorAll('[data-product-part]').forEach((part) => {
        const next = source.querySelector(`[data-product-part="${part.dataset.productPart}"]`);
        if (!next) return;
        preserveFields(part, next);
        part.replaceWith(next);
      });

      if (activeId) document.getElementById(activeId)?.focus();

      const variant = this.selectedVariant();
      if (variant && this.hasAttribute('data-update-url')) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
      if (variant?.featured_media) this.querySelector('media-gallery')?.goTo(variant.featured_media.id);

      window.Shopify?.PaymentButton?.init?.();
      this.dispatchEvent(new CustomEvent('variant:change', { bubbles: true, detail: { variant } }));
    } catch (err) {
      if (err.name === 'AbortError') return;
      // Ripiego: navigazione completa con le stesse opzioni.
      window.location.href = `${this.dataset.url}?option_values=${optionValueIds.join(',')}`;
    } finally {
      this.removeAttribute('aria-busy');
    }
  }

  selectedVariant() {
    const script = this.querySelector('[data-selected-variant]');
    try {
      return script ? JSON.parse(script.textContent) : null;
    } catch {
      return null;
    }
  }
}
define('product-page', ProductPage);

class VariantPicker extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', (event) => this.onChange(event));
  }

  onChange(event) {
    const control = event.target;
    const chosen = control.tagName === 'SELECT' ? control.selectedOptions[0] : control;
    const ids = this.selectedValueIds();
    const page = this.closest('product-page');
    const productUrl = chosen?.dataset.productUrl;

    // Combined listing: il valore appartiene a un altro prodotto.
    if (productUrl && page && productUrl !== page.dataset.url) {
      window.location.href = `${productUrl}?option_values=${ids.join(',')}`;
      return;
    }
    page?.update(ids);
  }

  selectedValueIds() {
    // Nell'ordine delle opzioni del prodotto (ordine del DOM).
    return [...this.querySelectorAll('select, input[type="radio"]:checked')]
      .map((control) => (control.tagName === 'SELECT' ? control.selectedOptions[0] : control)?.dataset.optionValueId)
      .filter(Boolean);
  }
}
define('variant-picker', VariantPicker);

class MediaGallery extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-gallery-track]');
    this.current = this.querySelector('[data-gallery-current]');
    if (!this.track) return;

    this.querySelector('[data-gallery-prev]')?.addEventListener('click', () => this.step(-1));
    this.querySelector('[data-gallery-next]')?.addEventListener('click', () => this.step(1));

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = [...this.track.children].indexOf(entry.target);
          this.index = index;
          if (this.current) this.current.textContent = String(index + 1);
        });
      },
      { root: this.track, threshold: 0.6 },
    );
    [...this.track.children].forEach((item) => this.observer.observe(item));
    this.index = 0;

    if (this.dataset.initialMedia) this.goTo(this.dataset.initialMedia, false);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  isCarousel() {
    return this.track.scrollWidth > this.track.clientWidth + 1;
  }

  scrollToItem(item, smooth = true) {
    const padding = parseFloat(getComputedStyle(this.track).paddingLeft) || 0;
    this.track.scrollTo({ left: item.offsetLeft - padding, behavior: smooth ? 'smooth' : 'auto' });
  }

  step(direction) {
    const items = [...this.track.children];
    const next = Math.min(items.length - 1, Math.max(0, (this.index || 0) + direction));
    this.scrollToItem(items[next]);
  }

  goTo(mediaId, smooth = true) {
    const item = this.track.querySelector(`[data-media-id="${mediaId}"]`);
    if (!item) return;
    if (this.isCarousel()) {
      this.scrollToItem(item, smooth);
    } else if (item !== this.track.firstElementChild) {
      // Desktop: il media della variante diventa il primo della griglia.
      this.track.prepend(item);
    }
  }
}
define('media-gallery', MediaGallery);

/* Zoom a tutto schermo: <dialog> con le immagini in fila (scroll-snap); clic sull'immagine = ingrandimento 2x */
class ProductLightbox extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.track = this.querySelector('[data-lightbox-track]');
    this.current = this.querySelector('[data-lightbox-current]');
    if (!this.dialog || !this.track) return;

    const page = this.closest('product-page') || document;
    page.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-lightbox-open]');
      if (opener) this.open(Number(opener.dataset.lightboxOpen), opener);
    });

    this.dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-lightbox-close]')) this.dialog.close();
      else if (event.target.closest('[data-lightbox-prev]')) this.step(-1);
      else if (event.target.closest('[data-lightbox-next]')) this.step(1);
      else if (event.target.matches('.lightbox__image')) this.toggleZoom(event.target, event);
    });
    this.dialog.addEventListener('pointermove', (event) => {
      const image = event.target.closest('.lightbox__image.is-zoomed');
      if (image) this.pan(image, event);
    });
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.step(-1);
      if (event.key === 'ArrowRight') this.step(1);
    });
    this.dialog.addEventListener('close', () => {
      this.track.querySelectorAll('.is-zoomed').forEach((image) => image.classList.remove('is-zoomed'));
      this.opener?.focus();
    });

    this.track.addEventListener(
      'scroll',
      () => {
        const index = Math.round(this.track.scrollLeft / this.track.clientWidth);
        if (this.current) this.current.textContent = String(index + 1);
      },
      { passive: true },
    );
  }

  open(index, opener) {
    this.opener = opener;
    this.dialog.showModal();
    this.track.scrollTo({ left: index * this.track.clientWidth, behavior: 'instant' });
    if (this.current) this.current.textContent = String(index + 1);
  }

  step(direction) {
    this.track.querySelectorAll('.is-zoomed').forEach((image) => image.classList.remove('is-zoomed'));
    this.track.scrollBy({ left: direction * this.track.clientWidth, behavior: 'smooth' });
  }

  toggleZoom(image, event) {
    image.classList.toggle('is-zoomed');
    if (image.classList.contains('is-zoomed')) this.pan(image, event);
  }

  pan(image, event) {
    const rect = image.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    image.style.transformOrigin = `${x}% ${y}%`;
  }
}
define('product-lightbox', ProductLightbox);

/* Destinatario del buono regalo: i campi si inviano solo con la casella spuntata */
class GiftCardRecipient extends HTMLElement {
  connectedCallback() {
    this.toggle = this.querySelector('input[type="checkbox"]');
    this.fields = this.querySelectorAll('[data-recipient-field]');
    const offset = this.querySelector('[data-recipient-offset]');
    if (offset) offset.value = String(new Date().getTimezoneOffset());
    this.toggle?.addEventListener('change', () => this.sync());
    this.sync();
  }

  sync() {
    const enabled = Boolean(this.toggle?.checked);
    this.fields.forEach((field) => {
      field.disabled = !enabled;
    });
    const email = this.querySelector('input[type="email"]');
    if (email) email.required = enabled;
  }
}
define('gift-card-recipient', GiftCardRecipient);
