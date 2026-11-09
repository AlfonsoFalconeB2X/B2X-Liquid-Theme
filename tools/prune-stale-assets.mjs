/**
 * Plugin Vite usato solo nella build in watch: dopo ogni build elimina da assets/ i file che la build non
 * ha prodotto.
 *
 * Nel watch assets/ non viene svuotata (emptyOutDir: false), quindi ogni salvataggio lascerebbe i file con
 * l'hash precedente; theme dev li caricherebbe tutti sul tema di sviluppo. Si tengono solo i file del bundle
 * appena scritto e quelli copiati da frontend/public; theme dev, già attivo, toglie gli altri anche dal tema
 * remoto. La build di produzione non usa il plugin: svuota assets/ da sola.
 */

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export default function pruneStaleAssets({ publicDir }) {
  let outDir;
  let publicFiles = new Set();

  return {
    name: 'b2x:prune-stale-assets',
    apply: 'build',

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      const publicPath = resolve(config.root, publicDir);
      publicFiles = new Set(existsSync(publicPath) ? readdirSync(publicPath) : []);
    },

    // Dopo i writeBundle degli altri plugin: i file nuovi sono già scritti
    writeBundle: {
      order: 'post',
      sequential: true,
      handler(_options, bundle) {
        const keep = new Set(Object.keys(bundle));
        let removed = 0;
        for (const entry of readdirSync(outDir, { withFileTypes: true })) {
          // Solo file al primo livello (assets/ su Shopify è piatta); .vite/ contiene il manifest corrente
          if (!entry.isFile() || keep.has(entry.name) || publicFiles.has(entry.name)) continue;
          rmSync(join(outDir, entry.name));
          removed++;
        }
        if (removed) this.info(`${removed} file obsoleti rimossi da assets/`);
      },
    },
  };
}
