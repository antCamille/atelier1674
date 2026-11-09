import { experience } from './layout.js';

// The navigation and business content must never wait for a GPU or 3D download.
// This small entry is independent of Three.js and the embedded skin textures.
clearTimeout(window.previewBootTimer);
experience.pending();
let expired = false;
const started = performance.now();
const timeout = setTimeout(() => {
  expired = true;
  experience.error('La 3D met trop de temps à charger. Toutes les rubriques sont accessibles ; vous pouvez réessayer.');
}, 45000);
import('./app.js').then(({ startScene }) => {
  if (expired) return;
  clearTimeout(timeout);
  startScene(Math.max(1, 45000 - (performance.now() - started)));
}).catch(error => {
  clearTimeout(timeout);
  if (expired) return;
  console.error(error);
  window.previewError = String(error);
  experience.error('La 3D n’a pas pu démarrer. Vous pouvez consulter toutes les rubriques ou réessayer.');
});
