// Gera thomkhali-standalone.html (arquivo único p/ download/offline).
// Uso: node build-standalone.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

let html = read('index.html');
const css = read('styles.css');
const js = read('app.js');

if (js.includes('</script')) throw new Error('app.js contém "</script>" — inline inseguro, aborte.');
if (css.includes('</style')) throw new Error('styles.css contém "</style>" — inline inseguro, aborte.');

html = html.replace(
  '<link rel="stylesheet" href="styles.css" />',
  () => `<style>\n${css}\n</style>`,
);
html = html.replace(
  '<script src="app.js"></script>',
  () => `<script>\n${js}\n</script>`,
);

if (html.includes('styles.css') || html.includes('src="app.js"')) {
  throw new Error('Falha ao embutir todos os arquivos.');
}

writeFileSync(new URL('thomkhali-standalone.html', root), html);
console.log(`standalone OK: ${html.length} bytes`);
