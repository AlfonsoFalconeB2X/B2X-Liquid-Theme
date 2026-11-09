/*
 * collection-tabs.js — <collection-tabs>: tab accessibili (ARIA tabs, frecce, Home/Fine).
 * Il pannello attivo ha data-active; gli altri sono nascosti da CSS solo con JS attivo.
 */

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

class CollectionTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = [...this.querySelectorAll('[role="tab"]')];
    if (this.tabs.length < 2) return;

    this.addEventListener('click', (event) => {
      const tab = event.target.closest('[role="tab"]');
      if (tab) this.select(tab);
    });

    this.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
      const index = this.tabs.indexOf(document.activeElement);
      if (index === -1) return;
      let next = null;
      if (event.key === 'ArrowRight') next = this.tabs[(index + 1) % this.tabs.length];
      if (event.key === 'ArrowLeft') next = this.tabs[(index - 1 + this.tabs.length) % this.tabs.length];
      if (event.key === 'Home') next = this.tabs[0];
      if (event.key === 'End') next = this.tabs[this.tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      this.select(next);
      next.focus();
    });

    // Theme editor: selezionando un blocco si mostra la sua tab.
    document.addEventListener('shopify:block:select', (event) => {
      const tab = this.tabs.find((el) => el.contains(event.target) || el === event.target);
      if (tab) this.select(tab);
    });
  }

  select(tab) {
    this.tabs.forEach((el) => {
      const active = el === tab;
      el.setAttribute('aria-selected', String(active));
      el.tabIndex = active ? 0 : -1;
      this.querySelector(`#${CSS.escape(el.getAttribute('aria-controls'))}`)?.toggleAttribute('data-active', active);
    });
    // Gli elementi del pannello appena mostrato vanno resi visibili subito (comparsa allo scroll).
    this.querySelectorAll('[data-active] .reveal').forEach((el) => el.classList.add('is-visible'));
  }
}
define('collection-tabs', CollectionTabs);
