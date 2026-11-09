import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist');

// Generate the complete site at the deployment root, without a preview token.
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(join(root, 'public'), out, { recursive: true });
// Losslessly compressed source models restore to their original deployed bytes.
const compressedModels = JSON.parse(await readFile(join(root, 'compressed-models.json'), 'utf8'));
for (const model of compressedModels) {
  const path = join(out, 'assets', model.file);
  const bytes = gunzipSync(await readFile(path + '.gz'));
  if (createHash('sha256').update(bytes).digest('hex') !== model.sha256) {
    throw new Error(`Integrity check failed for ${model.file}.`);
  }
  await writeFile(path, bytes);
  await rm(path + '.gz');
}
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/boot.js'],
  outdir: out,
  bundle: true,
  minify: true,
  splitting: true,
  format: 'esm',
  target: 'es2020',
  entryNames: '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  logLevel: 'info',
});
const entry = Object.entries(result.metafile.outputs).find(([, value]) => value.entryPoint === 'src/boot.js');
if (!entry) throw new Error('The main browser bundle was not generated.');
let html = (await readFile(join(root, 'src/template.html'), 'utf8'))
  .replace('LAYOUT_CSS', await readFile(join(root, 'src/layout.css'), 'utf8'));
for (const [name, file] of Object.entries({
  head: 'barber_head_filled_curls.glb',
  clipper: 'hair_clipper_web.glb',
  density: 'runtime_hair_coverage.glb',
})) {
  html = html.replace(new RegExp(`<script id="${name}-data"[^>]*>[\\s\\S]*?</script>`),
    `<script id="${name}-data" type="application/octet-stream" data-src="./assets/${file}"></script>`);
}
html = html.replace('<script>APP_JS</script>', `<script type="module" src="./${basename(entry[0])}"></script>`);
if (/LAYOUT_CSS|APP_JS|HEAD_BASE64|CLIPPER_BASE64|DENSITY_BASE64/.test(html)) {
  throw new Error('An unresolved build placeholder remains in index.html.');
}
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('Built L’Atelier 1674 at dist/index.html. No preview token or environment variables required.');
