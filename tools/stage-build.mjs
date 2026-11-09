/**
 * `npm run build:stage` — da eseguire prima di ogni commit che tocca frontend/.
 *
 * assets/ e snippets/vite-tag.liquid sono in git perché l'integrazione GitHub di Shopify carica sul tema i file
 * del branch così come sono: ogni commit deve contenere la build di produzione dei sorgenti.
 * 1. Se assets/ contiene la build di sviluppo (npm run dev / watch: file non minificati con sourcemap inline)
 *    si ferma: va fermato il watch prima di rifare la build, altrimenti theme dev vedrebbe svuotare assets/.
 * 2. Altrimenti esegue la build di produzione e aggiunge all'area di stage assets/ e vite-tag.liquid, compresi
 *    i file con l'hash vecchio da rimuovere. La build parte dai file su disco: include anche le modifiche ai
 *    sorgenti non ancora aggiunte allo stage.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(viteBin)) {
  console.error('[build:stage] Dipendenze mancanti: esegui `npm install` e riprova.');
  process.exit(1);
}

const devFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter(
      (file) => /\.(js|css)$/.test(file) && readFileSync(join(assetsDir, file), 'utf8').includes('sourceMappingURL=data:'),
    )
  : [];

if (devFiles.length) {
  console.error(
    '[build:stage] assets/ contiene la build di sviluppo (npm run dev / npm run watch).\n' +
      '              Ferma il watch e ripeti `npm run build:stage`.',
  );
  process.exit(1);
}

execFileSync(process.execPath, [viteBin, 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
execFileSync('git', ['add', '--all', '--', 'assets', 'snippets/vite-tag.liquid'], { cwd: root, stdio: 'inherit' });
