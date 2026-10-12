// MapLibre GL 6 runs its tile parsing in a module worker loaded from a separate file
// (maplibre-gl-worker.mjs, which imports maplibre-gl-shared.mjs). The bundler does not
// emit those files, so copy them to public/ and point setWorkerUrl() at them (MapView).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/dist/maplibre-gl.css'));
const out = join(process.cwd(), 'public', 'maplibre');
mkdirSync(out, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dist, f), join(out, f));
}
console.log(`copied MapLibre worker to ${out}`);
