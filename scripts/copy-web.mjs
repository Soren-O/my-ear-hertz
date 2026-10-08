// Copies the web app into www/ for Capacitor. The repo root stays the source of truth
// (GitHub Pages serves it directly), so www/ is generated and git-ignored.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of ['index.html', 'icon-180.png', 'sounds', 'fonts']) cpSync(f, `www/${f}`, { recursive: true });
console.log('www/ ready');
