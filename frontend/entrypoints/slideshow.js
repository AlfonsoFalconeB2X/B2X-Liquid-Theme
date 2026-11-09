/*
 * slideshow.js — <slide-show>: slide a tutta larghezza con scroll-snap, frecce, punti e scorrimento automatico
 * facoltativo (attributi data-autoplay e data-interval, in millisecondi).
 *
 * Giro continuo: prima della prima slide c'è una copia dell'ultima e dopo l'ultima una copia della prima.
 * Frecce, autoplay, tastiera e trascinamento proseguono sempre nella direzione scelta: dall'ultima si scorre in
 * avanti fino alla copia della prima e, appena lo scorrimento si ferma, si salta (senza animazione) alla prima vera;
 * lo stesso all'indietro. Le copie sono inert e nascoste ai lettori di schermo.
 *
 * - La slide attiva si ricava dalla posizione di scorrimento: punti e slide attiva restano allineati a ogni gesto.
 * - Le slide non visibili sono inert: fuori dall'ordine di tabulazione e nascoste ai lettori di schermo.
 * - Scorrimento automatico: con movimento ridotto o nel theme editor parte in pausa. Si sospende con il mouse
 *   sopra, con la pagina nascosta e quando il merchant seleziona una slide nell'editor; si ferma quando il cliente
 *   entra con la tastiera (riparte solo con il pulsante). Mentre scorre, i cambi di slide non vengono annunciati.
 * Senza JS le slide scorrono a mano (senza giro continuo) e i controlli restano nascosti.
 */

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const designMode = Boolean(window.Shopify?.designMode);
const supportsScrollEnd = 'onscrollend' in window;

class SlideShow extends HTMLElement {
  connectedCallback() {
    if (!this.initialized) this.init();
    if (!this.initialized) return;
    // Anche quando il theme editor sposta la section (disconnessione e nuova connessione)
    this.jump(this.position);
    if (this.autoplay) document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.schedule();
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    clearTimeout(this.settleTimer);
    if (this.onVisibilityChange) document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  init() {
    this.track = this.querySelector('[data-slideshow-track]');
    this.slides = this.track ? [...this.track.children] : [];
    if (this.slides.length < 2) return;
    this.initialized = true;

    this.dots = [...this.querySelectorAll('[data-slideshow-dot]')];
    this.toggle = this.querySelector('[data-slideshow-toggle]');
    this.index = -1;
    this.position = 1; // posizione nella riga: 0 = copia dell'ultima, 1…n = slide vere, n + 1 = copia della prima
    this.target = null;
    this.holds = new Set();
    this.paused = false;
    this.autoplay = this.hasAttribute('data-autoplay');
    this.interval = Number(this.dataset.interval) || 6000;

    this.track.prepend(this.cloneSlide(this.slides.at(-1)));
    this.track.append(this.cloneSlide(this.slides[0]));
    // Subito sulla prima slide vera, prima che il browser disegni la copia dell'ultima
    this.jump(1);

    this.querySelector('[data-slideshow-prev]')?.addEventListener('click', () => this.step(-1));
    this.querySelector('[data-slideshow-next]')?.addEventListener('click', () => this.step(1));
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.goTo(i)));

    this.track.addEventListener(
      'scroll',
      () => {
        if (!supportsScrollEnd) this.queueSettle();
        if (this.frame) return;
        this.frame = requestAnimationFrame(() => {
          this.frame = null;
          this.sync();
        });
      },
      { passive: true },
    );
    if (supportsScrollEnd) this.track.addEventListener('scrollend', () => this.settle());
    // Durante il trascinamento non si salta mai: lo si fa quando il dito si stacca e lo scorrimento finisce
    this.track.addEventListener('touchstart', () => (this.touching = true), { passive: true });
    this.track.addEventListener(
      'touchend',
      () => {
        this.touching = false;
        this.queueSettle();
      },
      { passive: true },
    );
    // Se cambia la larghezza (rotazione, finestra) si resta sulla stessa slide
    this.width = this.track.clientWidth;
    new ResizeObserver(() => {
      if (this.track.clientWidth === this.width) return;
      this.width = this.track.clientWidth;
      this.jump(this.position);
    }).observe(this.track);

    // Theme editor: la slide selezionata resta visibile finché è selezionata
    this.addEventListener('shopify:block:select', (event) => {
      const index = this.slides.indexOf(event.target);
      if (index === -1) return;
      this.hold('editor', true);
      this.goTo(index, 'instant');
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
      this.setPaused(reducedMotion.matches || designMode);
    }

    this.sync();
    this.setAttribute('data-ready', '');
  }

  /** Copia di una slide per il giro continuo: senza id, inert, nascosta ai lettori di schermo e all'editor. */
  cloneSlide(slide) {
    const clone = slide.cloneNode(true);
    clone.removeAttribute('id');
    clone.removeAttribute('data-shopify-editor-block');
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('data-slideshow-clone', '');
    clone.inert = true;
    clone.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy';
      img.removeAttribute('fetchpriority');
    });
    return clone;
  }

  get behavior() {
    return reducedMotion.matches ? 'instant' : 'smooth';
  }

  /** Avanza (1) o torna indietro (-1) di una slide, sempre in quella direzione. */
  step(direction) {
    const count = this.slides.length;
    let from = this.target ?? this.currentPosition();
    // Già diretti verso una copia (es. clic rapidi sull'ultima): ci si sposta senza animazione sul tratto identico
    // delle slide vere (la copia della prima è uguale alla prima, quella dell'ultima all'ultima) e si prosegue.
    // Lo snap resta sospeso fino alla fine dello scorrimento (settle): altrimenti il browser riallineerebbe lo
    // spostamento alla slide più vicina, con un piccolo scatto.
    if ((from === count + 1 && direction > 0) || (from === 0 && direction < 0)) {
      const shift = from === 0 ? count : -count;
      this.track.style.scrollSnapType = 'none';
      this.track.scrollTo({ left: this.track.scrollLeft + shift * this.track.clientWidth, behavior: 'instant' });
      from += shift;
    }
    this.scrollToPosition(Math.min(count + 1, Math.max(0, from + direction)), this.behavior);
  }

  /** Porta alla slide vera indicata (punti, theme editor). */
  goTo(index, behavior = this.behavior) {
    this.scrollToPosition(index + 1, behavior);
  }

  scrollToPosition(position, behavior) {
    this.target = behavior === 'instant' ? null : position;
    this.track.scrollTo({ left: position * this.track.clientWidth, behavior });
  }

  /** Salto senza animazione, per tornare dalle copie alle slide vere. */
  jump(position) {
    this.track.scrollTo({ left: position * this.track.clientWidth, behavior: 'instant' });
  }

  currentPosition() {
    return Math.min(this.slides.length + 1, Math.max(0, Math.round(this.track.scrollLeft / this.track.clientWidth)));
  }

  queueSettle() {
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.settle(), 150);
  }

  /** A scorrimento fermo: se si è su una copia, salta alla slide vera corrispondente. */
  settle() {
    if (this.touching) return;
    this.target = null;
    this.track.style.scrollSnapType = '';
    const position = this.currentPosition();
    if (position === 0) this.jump(this.slides.length);
    else if (position === this.slides.length + 1) this.jump(1);
  }

  /** Allinea slide attiva, punti e timer alla posizione di scorrimento. */
  sync() {
    const count = this.slides.length;
    this.position = this.currentPosition();
    if (this.position === this.target) this.target = null;
    const index = (this.position - 1 + count) % count;
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
    if (!this.initialized) return;
    const playing = this.autoplay && !this.paused && this.holds.size === 0;
    this.track.setAttribute('aria-live', playing ? 'off' : 'polite');
    if (playing) this.timer = setTimeout(() => this.step(1), this.interval);
  }
}
define('slide-show', SlideShow);
