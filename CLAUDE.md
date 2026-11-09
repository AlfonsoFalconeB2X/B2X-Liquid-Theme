# B2X — istruzioni per Claude

Tema Shopify Online Store 2.0 leggero: Liquid, CSS e JS vanilla, **nessuna build** (le sorgenti sono direttamente in `assets/`). Rispondi all'utente in italiano. Convenzioni complete in [README.md](README.md).

## Verifica

- `shopify theme check` deve terminare con 0 offese.
- Dopo modifiche ai JS: `node --check assets/<file>.js`.
- Non eseguire `shopify theme push`, `publish` o altri comandi che scrivono sullo store senza richiesta esplicita.
- Non modificare `config/settings_data.json` salvo richiesta: contiene le personalizzazioni del merchant.
- Su Windows non modificare file con `Get-Content`/`Set-Content` di PowerShell 5.1 (corrompono le lettere accentate): usa gli strumenti di edit.

## Regole

- Mai una `}` dentro un output `{{ … }}`, nemmeno in una stringa (es. `'?q={search_term_string}'`): il tokenizer di Shopify chiude l'output lì e **rifiuta l'intero file al caricamento**, mentre Theme Check non segnala nulla. Calcola il valore con `{% assign %}` e stampa la variabile.

- Ogni chiave `| t` va aggiunta in `locales/it.default.json` e `locales/en.json`.
- Section di contenuto: `section-attributes` + `.section__inner page-width`, setting `color_scheme`, `section_style`, `padding_top`, `padding_bottom`, `presets` con `disabled_on` per i gruppi header/footer.
- Colori solo dalle variabili degli schemi (`snippets/theme-styles.liquid`).
- Movimento solo CSS, breve e con `prefers-reduced-motion`; niente librerie di animazione.
- Carrello: sempre tramite `cart.add` / `cart.change` di `assets/theme.js` e marcatori `data-cart-section`.
- Varianti prodotto: Section Rendering API con `option_values`, parti marcate `data-product-part` (`assets/product.js`). Le parti stanno negli snippet `product-price`, `product-variant-picker`, `product-quantity`, `product-buy-buttons`, `product-pickup`, condivisi tra `main-product` e `quick-view`: una modifica vale per entrambi.
- Animazioni: classe `.reveal` sugli elementi sotto la piega (mai nella prima section né sull'immagine LCP); tutto il resto è CSS breve con `prefers-reduced-motion`.
- Filtri: parti marcate `data-facets-part` (`assets/collection.js`).
