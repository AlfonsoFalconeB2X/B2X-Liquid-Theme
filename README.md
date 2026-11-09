# B2X — tema Shopify

Tema Online Store 2.0 leggero, scritto in Liquid, CSS e JavaScript vanilla. **Nessuna build**: i file in `assets/` sono le sorgenti e si caricano così come sono.

## Requisiti

- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.x
- Accesso allo store di sviluppo

## Comandi

```bash
shopify theme dev --environment local   # anteprima locale con ricarica automatica
shopify theme check                     # lint (deve restare a 0 errori)
shopify theme push --unpublished        # carica come nuovo tema non pubblicato
```

L'ambiente `local` è definito in `shopify.theme.toml`.

## Struttura

```
assets/
  base.css            stili globali (token, layout, componenti, section di contenuto, movimento)
  theme.js            JS globale: carrello (API, cassetto, sconti, nota), form prodotto, swatch, menu, header,
                      ricerca predittiva, ticker, comparsa allo scroll, toast
  product.css/js      pagina prodotto e anteprima rapida (varianti, galleria, zoom, buono regalo)
  quick-view.js       anteprima rapida, importato da theme.js al primo clic
  carousel.js         carosello (section carousel)
  collection-tabs.js  tab di collezioni
  collection.css/js   filtri e ordinamento — caricati da main-collection e main-search
  cart.css            pagina carrello
blocks/             theme blocks pubblici (titolo, testo, pulsante, immagine, gruppo) per la section "Contenuto"
config/             impostazioni del tema e schemi di colore
layout/             theme.liquid, password.liquid
locales/            it.default.json (default), en.json
sections/           section di contenuto, main-*, gruppi header/footer
snippets/           componenti condivisi (product-card, price, icon, facets, cart-*, product-*…)
templates/          template JSON + gift_card.liquid
```

## Funzionalità

- **Section di contenuto**: hero, collezione in evidenza, carosello (prodotti, collezioni, immagini), tab di collezioni, elenco collezioni, immagine con testo, testo, colonne, recensioni, ticker di testi o loghi, shop the look, "Contenuto" componibile con i theme blocks, video, FAQ, newsletter, modulo di contatto, Liquid personalizzato, app.
- **Prodotto**: varianti con swatch e combined listings, galleria con zoom a tutto schermo, disponibilità, ritiro in negozio, abbonamenti, invio del buono regalo a un destinatario, prodotti consigliati. Anteprima rapida e swatch colore anche sulle card.
- **Carrello**: cassetto o pagina, codici sconto, barra della spedizione gratuita (soglie per valuta), nota e due attributi dell'ordine configurabili.
- **Movimento** (Impostazioni tema → Animazioni): comparsa allo scorrimento con sfalsamento, ingresso del testo della hero, dissolvenza tra le pagine (View Transitions native), header che si nasconde scendendo, ticker con pausa.

La section header si chiama `site-header`.

## Design

- **Schemi di colore** (Impostazioni tema → Colori): cinque schemi predefiniti (Base, Salvia, Sabbia, Cielo, Bosco). Ogni schema fornisce sfondo, testo, superfici, filetti e colori dei pulsanti; gli altri toni (testo attenuato, hover, bordi dei campi) sono ricavati con `color-mix` in `snippets/theme-styles.liquid`.
- **Stile delle section**: ogni section di contenuto può essere *a tutta larghezza* o *riquadro* (pannello arrotondato dentro la larghezza della pagina).
- **Tipografia**: Outfit per i titoli, Figtree per il testo (modificabili dal theme editor).
- **Forme**: arrotondamento di pulsanti, campi e card regolabile in Impostazioni tema → Layout.
- **Movimento**: breve e senza librerie. Transizioni CSS su hover e pannelli; comparsa allo scorrimento con un `IntersectionObserver` (classe `.reveal`, mai sulla prima section); tutto spento con `prefers-reduced-motion`.

## Convenzioni

### Liquid

- `{% render %}` con parametri espliciti, mai `include`.
- Testi visibili: setting della section (testi del merchant) o `{{ 'chiave' | t }}`. Ogni chiave va aggiunta **sia** in `it.default.json` **sia** in `en.json`.
- Schema delle section scritto in italiano.
- Ogni section di contenuto apre con `<div {% render 'section-attributes', section: section %}>` e un `<div class="section__inner page-width">`, e ha nello schema `color_scheme`, `section_style`, `padding_top`, `padding_bottom`.
- Immagini sempre con `image_url` + `image_tag` e `widths`/`sizes` realistici; `loading: 'eager'` + `fetchpriority: 'high'` solo per la prima section (`section.index == 1`).
- I filtri non vanno concatenati dentro i parametri di un altro filtro (`t: x: a | default: b` non funziona): calcolare prima il valore con `assign`.

### CSS

- Classi semplici in stile BEM (`.card`, `.card__title`, `.card--surface`), mobile-first, breakpoint 750px e 990px.
- Solo variabili degli schemi per i colori (`--color-bg`, `--color-fg`, `--color-surface`, `--color-border`, `--color-button`, `--color-muted`, `--color-tint`…): niente esadecimali nei componenti, salvo il testo sopra le immagini (`.on-media`).
- CSS specifico di una pagina in un file dedicato caricato dalla section, non in `base.css`.

### JavaScript

- Moduli ES, nessuna dipendenza. Componenti come custom elements (si reinizializzano da soli nel theme editor).
- Ogni modifica al carrello passa da `cart.add` / `cart.change` in `theme.js`: aggiornano tutte le parti marcate con `data-cart-section` tramite la Section Rendering API.
- Pannelli nativi: `popover` (menu mobile, ricerca, filtri) e `<dialog>` (carrello). Lo scorrimento della pagina si blocca da CSS quando sono aperti.
- Funzionalità di base anche senza JS: filtri, ordinamento, carrello (pagina), localizzazione.

## Accessibilità e performance

- Un solo `h1` per pagina (sulla home è il nome del negozio nell'header).
- Focus visibile su tutti i controlli, nomi accessibili sui pulsanti solo icona, `aria-live` per i risultati che si aggiornano.
- CSS e JS globali piccoli; il resto si carica solo dove serve.
