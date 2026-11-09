/*
 * slideshow.js — <slide-show>: slide a tutta larghezza con scroll-snap, frecce, punti e scorrimento automatico
 * facoltativo (attributi data-autoplay e data-interval, in millisecondi).
 * - La slide attiva si ricava dalla posizione di scorrimento: swipe, frecce, punti e tastiera restano allineati.
 * - Le slide non visibili sono inert: fuori dall'ordine di tabulazione e nascoste ai lettori di schermo.
 * - Scorrimento automatico: con movimento ridotto o nel theme editor parte in pausa. Si sospende con il mouse
 *   sopra, con la pagina nascosta e quando il merchant seleziona una slide nell'editor; si ferma quando il cliente
 *   entra con la tastiera (riparte solo con il pulsante). Mentre scorre, i cambi di slide non vengono annunciati.
 * Senza JS le slide scorrono a mano e i controlli restano nascosti.
 */

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const designMode = Boolean(window.Shopify?.designMode);

class SlideShow extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-slideshow-track]');
    this.slides = this.track ? [...this.track.children] : [];
    if (this.slides.length < 2) return;

    this.dots = [...this.querySelectorAll('[data-slideshow-dot]')];
    this.toggle = this.querySelector('[data-slideshow-toggle]');
    this.index = -1;
    this.holds = new Set();
    this.paused = false;
    this.autoplay = this.hasAttribute('data-autoplay');
    this.interval = Number(this.dataset.interval) || 6000;

    this.querySelector('[data-slideshow-prev]')?.addEventListener('click', () => this.go(this.index - 1));
    this.querySelector('[data-slideshow-next]')?.addEventListener('click', () => this.go(this.index + 1));
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.go(i)));

    this.track.addEventListener(
      'scroll',
      () => {
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = null;
          this.sync();
        });
      },
      { passive: true },
    );

    // Theme editor: la slide selezionata resta visibile finché è selezionata
    this.addEventListener('shopify:block:select', (event) => {
      const index = this.slides.indexOf(event.target);
      if (index === -1) return;
      this.hold('editor', true);
      this.go(index, 'auto');
    });
    this.addEventListener('shopify:block:deselect', () => this.hold('editor', false));

    if (this.autoplay) {
      this.toggle?.addEventListener('click', () => this.setPaused(!this.paused));
      this.addEventListener('pointerenter', () => this.hold('hover', true));
      this.addEventListener('pointerleave', () => this.hold('hover', false));
      this.addEventListener('focusin', (event) => {
        if (event.target !== this.toggle && event.target.matches(':focus-visible')) this.setPaused(true);
      });
      this.onVisibilityChange = () => this.hold('hidden', document.hidden);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.setPaused(reducedMotion.matches || designMode);
    }

    this.sync();
    this.setAttribute('data-ready', '');
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Porta alla slide indicata; oltre l'ultima si torna alla prima e viceversa. */
  go(index, behavior = reducedMotion.matches ? 'auto' : 'smooth') {
    const count = this.slides.length;
    const target = ((index % count) + count) % count;
    this.track.scrollTo({ left: target * this.track.clientWidth, behavior });
  }

  /** Allinea slide attiva, punti e timer alla posizione di scorrimento. */
  sync() {
    const index = Math.min(this.slides.length - 1, Math.max(0, Math.round(this.track.scrollLeft / this.track.clientWidth)));
    if (index === this.index) return;
    this.index = index;
    this.slides.forEach((slide, i) => {
      slide.inert = i !== index;
    });
    this.dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    this.schedule();
  }

  hold(reason, active) {
    if (active) this.holds.add(reason);
    else this.holds.delete(reason);
    this.schedule();
  }

  setPaused(paused) {
    this.paused = paused;
    this.toggleAttribute('data-paused', paused);
    if (this.toggle) {
      this.toggle.setAttribute('aria-label', paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause);
    }
    this.schedule();
  }

  /** Programma il passaggio alla slide successiva, se lo scorrimento automatico è attivo e non sospeso. */
  schedule() {
    clearTimeout(this.timer);
    const playing = this.autoplay && !this.paused && this.holds.size === 0;
    this.track.setAttribute('aria-live', playing ? 'off' : 'polite');
    if (playing) this.timer = setTimeout(() => this.go(this.index + 1), this.interval);
  }
}
define('slide-show', SlideShow);
