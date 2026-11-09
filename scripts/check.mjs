import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = await readFile(join(root, 'dist/index.html'), 'utf8');
const files = await readdir(join(root, 'src'));
const source = (await Promise.all(files.map(file => readFile(join(root, 'src', file), 'utf8')))).join('\n');
const refs = new Set([...source.matchAll(/\.\/assets\/[\w./-]+/g)].map(match => match[0]));
for (const match of html.matchAll(/(?:src|href|data-src)="(\.\/[^"?#]+)"/g)) refs.add(match[1]);
for (const ref of refs) await access(join(root, 'dist', ref));
assert(!/LAYOUT_CSS|APP_JS|HEAD_BASE64|CLIPPER_BASE64|DENSITY_BASE64/.test(html));
assert(!html.includes('/preview/'));
assert(html.includes('L’Atelier 1674'));
assert(html.includes('ADopustim (Artem D.)'));
assert(html.includes('https://creativecommons.org/licenses/by/4.0/'));
for (const file of [
  'barber_head_filled_curls.glb', 'barber_head_filled_curls_mobile.glb',
  'hair_clipper_web.glb', 'hair_clipper_web_mobile.glb',
  'runtime_hair_coverage.glb', 'runtime_hair_coverage_mobile.glb',
]) {
  const bytes = await readFile(join(root, 'dist/assets', file));
  assert.equal(bytes.toString('utf8', 0, 4), 'glTF', file);
  assert.equal(bytes.readUInt32LE(4), 2, file);
  assert.equal(bytes.readUInt32LE(8), bytes.length, file);
}
const { barbers } = await import('../src/business-data.js');
assert.equal(barbers.length, 5);
const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
assert.equal(vercel.outputDirectory, 'dist');
assert.equal(vercel.buildCommand, 'npm run build');
console.log(`Package checks passed: ${refs.size} local references, six GLB headers, five barbers, attribution, root entry and Vercel config.`);
console.log('These checks do not measure live WebGL performance or test a physical phone.');
