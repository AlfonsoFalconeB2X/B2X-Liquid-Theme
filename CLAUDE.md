# B2X — istruzioni per Claude

Tema Shopify Online Store 2.0 leggero: Liquid, CSS e JS vanilla senza dipendenze a runtime. Sorgenti in `frontend/`, compilate con Vite + vite-plugin-shopify (Volt) in `assets/`. Rispondi all'utente in italiano. Convenzioni complete in [README.md](README.md).

## Verifica

- `npm run build` deve terminare senza errori dopo ogni modifica a `frontend/`.
- `npm run lint` (Theme Check) deve terminare con 0 offese.
- Dopo modifiche ai JS: `node --check frontend/<percorso>.js`.
- Non avviare `npm run dev` o `npm run watch` per verificare: sono processi che non terminano.
- Non eseguire `npm run push`, `shopify theme push`, `publish` o altri comandi che scrivono sullo store senza richiesta esplicita.
- `assets/` e `snippets/vite-tag.liquid` sono generati dalla build: non modificarli mai, si modificano i sorgenti in `frontend/`. Sono in git (l'integrazione GitHub di Shopify li carica così come sono): se un commit tocca `frontend/`, prima `npm run build:stage`; i conflitti su questi file si risolvono rifacendo la build, mai a mano.
- Non modificare `config/settings_data.json` salvo richiesta: contiene le personalizzazioni del merchant.
- Su Windows non modificare file con `Get-Content`/`Set-Content` di PowerShell 5.1 (corrompono le lettere accentate): usa gli strumenti di edit.

## Regole

- Mai una `}` dentro un output `{{ … }}`, nemmeno in una stringa (es. `'?q={search_term_string}'`): il tokenizer di Shopify chiude l'output lì e **rifiuta l'intero file al caricamento**, mentre Theme Check non segnala nulla. Calcola il valore con `{% assign %}` e stampa la variabile.

- Ogni chiave `| t` va aggiunta in `locales/it.default.json` e `locales/en.json`.
- Section di contenuto: `section-attributes` + `.section__inner page-width`, setting `color_scheme`, `section_style`, `padding_top`, `padding_bottom`, `presets` con `disabled_on` per i gruppi header/footer.
- Asset del tema solo con `{% render 'vite-tag', entry: 'nome.css' %}` (o `.js`), mai `asset_url` su file di `assets/`.
- CSS: in `base.css` (parziali in `frontend/styles/base/`, l'ordine degli `@import` è la cascata) solo ciò che serve in ogni pagina o a più section; gli stili di una sola section vanno in un entrypoint `frontend/entrypoints/<section>.css` caricato in cima alla section.
- Colori solo dalle variabili degli schemi (`snippets/theme-styles.liquid`).
- Movimento solo CSS, breve e con `prefers-reduced-motion`; niente librerie di animazione.
- Carrello: sempre tramite `cart.add` / `cart.change` di `frontend/entrypoints/theme.js` e marcatori `data-cart-section`.
- Varianti prodotto: Section Rendering API con `option_values`, parti marcate `data-product-part` (`frontend/entrypoints/product.js`). Le parti stanno negli snippet `product-price`, `product-variant-picker`, `product-quantity`, `product-buy-buttons`, `product-pickup`, condivisi tra `main-product` e `quick-view`: una modifica vale per entrambi.
- Animazioni: classe `.reveal` sugli elementi sotto la piega (mai nella prima section né sull'immagine LCP); tutto il resto è CSS breve con `prefers-reduced-motion`.
- Filtri: parti marcate `data-facets-part` (`frontend/entrypoints/collection.js`).
- Righe a scorrimento: sempre lo snippet `carousel-track` (`<carousel-slider>`, `carousel.css/js` caricati con `vite-tag` solo se la section usa il carosello), mai un secondo componente. Le section a griglia offrono il carosello con il setting `layout` (`grid` | `carousel`); gli elementi vanno catturati una volta (`capture items`) e passati alla griglia o allo snippet.
- Slideshow (`<slide-show>`, `frontend/entrypoints/slideshow.js`): scorrimento automatico solo su richiesta del merchant, sempre con pulsante di pausa, fermo con movimento ridotto e nel theme editor.
