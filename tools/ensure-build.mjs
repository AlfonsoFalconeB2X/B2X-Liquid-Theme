/**
 * Eseguito prima di `npm run lint` (script prelint).
 *
 * 1. Se snippets/vite-tag.liquid manca (es. clone appena fatto) esegue `npm run build`, così Theme Check
 *    trova lo snippet. Se esiste non tocca assets/: una build la svuoterebbe e, con `npm run dev` attivo,
 *    theme dev cancellerebbe e ricaricherebbe gli asset sul tema di sviluppo.
 * 2. Controlla che ogni file di frontend/entrypoints/ sia in vite-tag.liquid. Se ne manca uno, la section che
 *    lo richiama resta senza JS/CSS. Causa tipica: build non rieseguita dopo aver aggiunto il file.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteTag = join(root, 'snippets', 'vite-tag.liquid');

if (!existsSync(viteTag)) {
  console.log('snippets/vite-tag.liquid mancante: eseguo la build.');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

const snippet = readFileSync(viteTag, 'utf8');
const missing = readdirSync(join(root, 'frontend', 'entrypoints')).filter(
  (file) => !snippet.includes(`"/frontend/entrypoints/${file}"`),
);

if (missing.length) {
  console.warn(
    `\nEntrypoint non presenti in snippets/vite-tag.liquid: ${missing.join(', ')}\n` +
      'Le section che li usano restano senza JS/CSS: esegui `npm run build` (o riavvia `npm run dev`).\n',
  );
  process.exitCode = 1;
}
