# B2X — tema Shopify

Tema Online Store 2.0 leggero, scritto in Liquid, CSS e JavaScript vanilla, senza dipendenze a runtime. Le sorgenti CSS/JS stanno in `frontend/` e vengono compilate con [Vite](https://vite.dev) e [vite-plugin-shopify](https://shopify-vite.barrelny.com) (Volt) in `assets/`.

## Requisiti

- Node.js 22.12 o successivo
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.x
- Accesso allo store di sviluppo

## Comandi

```bash
npm install         # una volta, dopo il clone
npm run dev         # build in watch, poi shopify theme dev (ambiente `local`) dopo la prima build
npm run watch       # solo build in watch (non minificata, sourcemap inline)
npm run build       # build di produzione (minificata) in assets/
npm run build:stage # build di produzione + git add dei file compilati: da eseguire prima di ogni commit
npm run lint        # Theme Check (deve restare a 0 offese); esegue la build se manca vite-tag.liquid
npm run push        # build di produzione, poi shopify theme push --unpublished
```

L'ambiente `local` è definito in `shopify.theme.toml`. Gli argomenti dopo il secondo `--` vanno a theme dev, es. `npm run dev -- -- --theme-editor-sync`.

### File generati

`assets/` e `snippets/vite-tag.liquid` sono prodotti dalla build: non vanno modificati a mano, né dall'editor di codice dell'admin Shopify (la build successiva li sovrascrive). Sono **in git** perché l'integrazione GitHub di Shopify carica sul tema i file del branch così come sono; resta fuori solo il manifest di Vite (`assets/.vite/`).

Quindi ogni commit che tocca `frontend/` deve contenere anche la build di produzione:

```bash
npm run build:stage   # build di produzione + git add di assets/ e vite-tag.liquid
git commit
```

`build:stage` si rifiuta di partire se in `assets/` c'è la build di sviluppo (`npm run dev` o `npm run watch` attivi o appena fermati): va fermato il watch prima. In caso di conflitti su `assets/` o `vite-tag.liquid` (merge, rebase) non si risolvono a mano: si sistemano i sorgenti e si ripete `npm run build:stage`. Nelle diff i file di `assets/` compaiono come generati (`.gitattributes`).

Gli URL degli asset hanno l'hash nel nome (`theme-DounEuqo.js`) e `vite-tag` li stampa senza `?v=`: così un modulo importato da più punti ha sempre lo stesso URL e viene eseguito una volta sola.

Browser supportati: il target predefinito di Vite (Chrome/Edge 111+, Firefox 114+, Safari 16.4+), lo stesso che il tema richiedeva già per `color-mix()`.

## Struttura

```
frontend/
  entrypoints/        un file = un entrypoint, caricato con {% render 'vite-tag', entry: 'nome.css' %}
    base.css          stili globali: importa i parziali di styles/base/ (l'ordine degli @import è la cascata)
    theme.js          JS globale: carrello (API, cassetto, sconti, nota), form prodotto, swatch, menu, header,
                      ricerca predittiva, ticker, comparsa allo scroll, toast
    product.js        pagina prodotto e anteprima rapida (varianti, galleria, zoom, buono regalo); importa product.css
    collection.css/js filtri e ordinamento — caricati da main-collection e main-search
    cart.css          pagina carrello
    carousel.css/js, collection-tabs.css/js, ticker.css, shop-the-look.css, content.css, multicolumn.css,
    testimonials.css, contact-form.css, rich-text.css
                      stili (e JS) di una sola section, caricati da quella section
    gift-card.css, password.css
                      buono regalo e pagina password, caricati dal template/layout
  scripts/
    quick-view.js     anteprima rapida, importata da theme.js al primo clic
  styles/
    base/             parziali di base.css (reset, variabili, tipografia, layout, pulsanti, form, card, header,
                      pannelli, ricerca, footer, carrello, section condivise, pagine, toast, movimento…)
    product.css       importato da product.js
  public/             (facoltativa) file copiati così come sono in assets/, es. immagini richiamate con asset_url
tools/              dev.mjs (watch + theme dev), ensure-build.mjs (prima del lint), stage-build.mjs (prima del commit),
                    prune-stale-assets.mjs
assets/             generata dalla build (in git, tranne .vite/)
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
- CSS e JS del tema si caricano solo con `{% render 'vite-tag', entry: 'nome.css' %}` (o `.js`), mai con `asset_url` sui file di `assets/`: i nomi compilati cambiano a ogni build.

### CSS

- Classi semplici in stile BEM (`.card`, `.card__title`, `.card--surface`), mobile-first, breakpoint 750px e 990px.
- Solo variabili degli schemi per i colori (`--color-bg`, `--color-fg`, `--color-surface`, `--color-border`, `--color-button`, `--color-muted`, `--color-tint`…): niente esadecimali nei componenti, salvo il testo sopra le immagini (`.on-media`).
- In `base.css` (cioè nei parziali di `frontend/styles/base/`) solo ciò che serve in ogni pagina o è condiviso da più section. Gli stili di una sola section o pagina vanno in un entrypoint dedicato in `frontend/entrypoints/`, caricato in cima alla section con `vite-tag`. Un parziale nuovo va aggiunto agli `@import` di `base.css` nel punto giusto della cascata.
- Con `npm run dev` attivo, un entrypoint aggiunto o rimosso fa ripartire Vite da solo; altrimenti serve `npm run build`. `npm run lint` si ferma se un entrypoint manca in `vite-tag.liquid`.

### JavaScript

- Moduli ES, nessuna dipendenza a runtime. Componenti come custom elements (si reinizializzano da soli nel theme editor).
- I moduli caricati al bisogno si importano con un percorso relativo (`import('../scripts/quick-view.js')`): Vite risolve il nome con l'hash e carica prima il CSS che il modulo importa.
- Ogni modifica al carrello passa da `cart.add` / `cart.change` in `theme.js`: aggiornano tutte le parti marcate con `data-cart-section` tramite la Section Rendering API.
- Pannelli nativi: `popover` (menu mobile, ricerca, filtri) e `<dialog>` (carrello). Lo scorrimento della pagina si blocca da CSS quando sono aperti.
- Funzionalità di base anche senza JS: filtri, ordinamento, carrello (pagina), localizzazione.

## Accessibilità e performance

- Un solo `h1` per pagina (sulla home è il nome del negozio nell'header).
- Focus visibile su tutti i controlli, nomi accessibili sui pulsanti solo icona, `aria-live` per i risultati che si aggiornano.
- CSS e JS globali piccoli; il resto si carica solo dove serve.
