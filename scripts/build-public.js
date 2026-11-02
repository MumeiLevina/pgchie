// Publish only public assets; never copy backend, tests, admin pages or environment files.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
// Remove only this script's resolved output directory before rebuilding.
if (out !== path.join(root, 'dist')) throw new Error('Invalid public output');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const file of ['index.html', 'style.css', 'script.js', 'config.js', 'music.js', 'music.css', 'assets']) {
  fs.cpSync(path.join(root, file), path.join(out, file), { recursive: true });
}
console.log('Public allowlist built in dist/');
