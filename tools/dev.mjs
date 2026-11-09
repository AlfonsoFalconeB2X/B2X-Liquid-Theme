/**
 * Sviluppo: `vite build --watch`, poi `shopify theme dev` dopo la prima build.
 *
 * - Ordine di avvio: all'avvio theme dev carica sul tema di sviluppo i file locali così come sono in quel
 *   momento. Se Vite sta ancora rigenerando assets/ e snippets/vite-tag.liquid, sul tema remoto restano asset
 *   vecchi o mancanti. Per questo theme dev parte solo dopo la prima build; le build successive le carica
 *   normalmente, perché è già in ascolto.
 * - Entrypoint nuovi: vite-plugin-shopify legge l'elenco di frontend/entrypoints/ all'avvio. Un file aggiunto
 *   dopo non verrebbe compilato né inserito in vite-tag.liquid (la section che lo richiama resterebbe senza
 *   JS/CSS, in silenzio). Se l'elenco cambia, Vite viene riavviato.
 *
 * Uso:
 *   npm run dev                 → watch + shopify theme dev (ambiente `local` di shopify.theme.toml)
 *   npm run watch               → solo watch (--watch-only)
 *   npm run dev -- -- --theme-editor-sync
 *                               → gli argomenti dopo il secondo `--` vanno a theme dev
 */

import { spawn } from 'node:child_process';
import { readdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrypointsDir = join(root, 'frontend', 'entrypoints');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const args = process.argv.slice(2);
const separator = args.indexOf('--');
const options = separator === -1 ? args : args.slice(0, separator);
const themeDevArgs = separator === -1 ? [] : args.slice(separator + 1);
const watchOnly = options.includes('--watch-only');

// Segnale di fine build nell'output di Vite
const BUILT = /built in/;

let vite;
let themeDev;
let stopping = false;

function startVite() {
  vite = spawn(process.execPath, [viteBin, 'build', '--watch', '--mode', 'development'], {
    cwd: root,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  const forward = (stream, target) =>
    stream.on('data', (chunk) => {
      target.write(chunk);
      if (!watchOnly && !themeDev && BUILT.test(chunk.toString())) startThemeDev();
    });
  forward(vite.stdout, process.stdout);
  forward(vite.stderr, process.stderr);
  vite.on('exit', (code) => {
    if (!stopping && !vite.restarting) shutdown(code ?? 0);
  });
}

function restartVite() {
  console.log('\n[dev] Entrypoint aggiunto o rimosso: riavvio di Vite…\n');
  const previous = vite;
  previous.restarting = true;
  previous.once('exit', startVite);
  previous.kill();
}

function startThemeDev() {
  console.log('\n[dev] Prima build completata: avvio shopify theme dev…\n');
  // Sempre sull'ambiente `local` (tema di sviluppo personale), mai su un tema condiviso
  const command = ['shopify theme dev', '--environment local', ...themeDevArgs].join(' ');
  themeDev = spawn(command, { cwd: root, stdio: 'inherit', shell: true });
  themeDev.on('exit', (code) => shutdown(code ?? 0));
}

function shutdown(code = 0) {
  stopping = true;
  vite?.kill();
  themeDev?.kill();
  process.exit(code);
}

const listEntries = () => readdirSync(entrypointsDir).sort().join('|');
let entries = listEntries();
let restartTimer;
watch(entrypointsDir, () => {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    const current = listEntries();
    if (current === entries) return; // modifica a un file esistente: la gestisce già Vite
    entries = current;
    restartVite();
  }, 300);
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(0));

startVite();
