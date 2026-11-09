/*
 * carousel.js — <carousel-slider>: riga a scorrimento nativo (scroll-snap) con frecce.
 * Le frecce scorrono di una "pagina" (la larghezza visibile) e si disattivano agli estremi.
 * Senza JS resta una riga che scorre a mano.
 */

const define = (name, constructor) => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

class CarouselSlider extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-carousel-track]');
    this.prev = this.querySelector('[data-carousel-prev]');
    this.next = this.querySelector('[data-carousel-next]');
    if (!this.track) return;

    this.prev?.addEventListener('click', () => this.page(-1));
    this.next?.addEventListener('click', () => this.page(1));
    this.onScroll = () => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.updateArrows();
      });
    };
    this.track.addEventListener('scroll', this.onScroll, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.updateArrows());
    this.resizeObserver.observe(this.track);
    this.updateArrows();
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
  }

  page(direction) {
    const slide = this.track.firstElementChild;
    const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
    const slideWidth = slide ? slide.getBoundingClientRect().width + gap : this.track.clientWidth;
    const perPage = Math.max(1, Math.floor((this.track.clientWidth + gap) / slideWidth));
    this.track.scrollBy({ left: direction * perPage * slideWidth, behavior: 'smooth' });
  }

  updateArrows() {
    const max = this.track.scrollWidth - this.track.clientWidth;
    const atStart = this.track.scrollLeft <= 2;
    const atEnd = this.track.scrollLeft >= max - 2;
    if (this.prev) this.prev.disabled = atStart;
    if (this.next) this.next.disabled = atEnd;
    this.toggleAttribute('data-scrollable', max > 2);
  }
}
define('carousel-slider', CarouselSlider);
