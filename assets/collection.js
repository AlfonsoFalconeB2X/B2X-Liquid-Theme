/*
 * collection.js — filtri e ordinamento di collezione e ricerca (caricato solo da main-collection e main-search).
 * Il form dei filtri è nativo (funziona senza JS); qui le modifiche vengono applicate senza ricaricare la pagina:
 * si richiede la section con gli stessi parametri e si sostituiscono le parti marcate data-facets-part.
 * I filtri non creano voci nella cronologia (replaceState).
 */

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

const debounce = (fn, wait) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

class FacetsForm extends HTMLElement {
  connectedCallback() {
    this.section = this.dataset.section;
    this.renderDebounced = debounce((url) => this.render(url), 350);
    this.renderPriceDebounced = debounce((url) => this.render(url), 800);

    this.addEventListener('change', (event) => {
      if (!event.target.form?.matches('[data-facets-form]')) return;
      if (event.target.matches('[data-price-input]')) return;
      this.renderDebounced(this.formUrl());
    });

    this.addEventListener('input', (event) => {
      if (event.target.matches('[data-price-input]')) this.renderPriceDebounced(this.formUrl());
    });

    this.addEventListener('submit', (event) => {
      if (!event.target.matches('[data-facets-form]')) return;
      event.preventDefault();
      this.render(this.formUrl());
    });

    this.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-facets-link]');
      if (!link) return;
      event.preventDefault();
      this.render(link.href);
    });
  }

  formUrl() {
    const form = this.querySelector('form[data-facets-form]');
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (value !== '') params.append(key, value);
    });
    return `${form.getAttribute('action') || window.location.pathname}?${params}`;
  }

  async render(href) {
    this.controller?.abort();
    this.controller = new AbortController();

    const url = new URL(href, window.location.origin);
    url.searchParams.delete('page');
    const requestUrl = new URL(url);
    requestUrl.searchParams.set('section_id', this.section);

    const results = this.querySelector('[data-facets-part="results"]');
    results?.setAttribute('aria-busy', 'true');
    const activeId = document.activeElement?.id;
    const facetState = new Map([...this.querySelectorAll('details.facet')].map((d) => [d.dataset.facet, d.open]));

    try {
      const response = await fetch(requestUrl, { signal: this.controller.signal });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = doc.querySelector('facets-form');
      if (!source) throw new Error('missing section');

      this.querySelectorAll('[data-facets-part]').forEach((part) => {
        const next = source.querySelector(`[data-facets-part="${part.dataset.facetsPart}"]`);
        if (next) part.replaceWith(next);
      });

      // I gruppi restano aperti o chiusi come li aveva lasciati il cliente.
      this.querySelectorAll('details.facet').forEach((details) => {
        if (facetState.has(details.dataset.facet)) details.open = facetState.get(details.dataset.facet);
      });

      // Anche il select dell'ordinamento è fuori dalle parti sostituite: lo allineiamo all'URL.
      const sort = this.querySelector('select[name="sort_by"]');
      if (sort && url.searchParams.get('sort_by')) sort.value = url.searchParams.get('sort_by');

      if (activeId) document.getElementById(activeId)?.focus();
      window.history.replaceState({}, '', url);
    } catch (err) {
      if (err.name === 'AbortError') return;
      window.location.href = url.toString();
    } finally {
      this.querySelector('[data-facets-part="results"]')?.removeAttribute('aria-busy');
    }
  }
}
define('facets-form', FacetsForm);
