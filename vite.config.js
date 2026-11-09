/*
 * Build del tema con Vite e vite-plugin-shopify (Volt).
 * Sorgenti in frontend/ (ogni file di frontend/entrypoints/ è un entrypoint), output in assets/ e
 * snippets/vite-tag.liquid: entrambi generati e fuori da git.
 *
 * Modalità:
 * - production (npm run build): minificata, senza sourcemap; assets/ viene svuotata a ogni build.
 * - development (npm run watch, npm run dev): non minificata, sourcemap inline (funzionano anche dal CDN di
 *   Shopify, dove i file .map separati non verrebbero caricati). assets/ non viene svuotata, altrimenti
 *   theme dev cancellerebbe e ricaricherebbe tutti gli asset a ogni salvataggio: i file con hash non più
 *   prodotti li toglie pruneStaleAssets.
 */

import { defineConfig } from 'vite';
import shopify from 'vite-plugin-shopify';
import pruneStaleAssets from './tools/prune-stale-assets.mjs';

const PUBLIC_DIR = 'frontend/public';

export default defineConfig(({ mode }) => {
  const isWatch = mode === 'development';

  return {
    // File copiati così come sono in assets/ (immagini o font richiamati con asset_url dal Liquid).
    // Il plugin lo disattiva di default: lo riattiviamo, perché assets/ è interamente generata.
    publicDir: PUBLIC_DIR,

    plugins: [shopify(), isWatch && pruneStaleAssets({ publicDir: PUBLIC_DIR })],

    build: {
      emptyOutDir: !isWatch,
      sourcemap: isWatch ? 'inline' : false,
      minify: !isWatch,
      // Nessun file convertito in data: URL: tutto resta in assets/ e passa dal CDN.
      assetsInlineLimit: 0,
    },
  };
});
