import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const GF = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,600&family=Inter:wght@400;500;600;700&display=swap';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const css = execSync(`curl -sS -m 30 -A "${UA}" "${GF}"`, { maxBuffer: 1 << 24, encoding: 'utf8' });

// Keep only the latin (non-ext) blocks: those whose unicode-range starts with U+0000-00FF
const blocks = css.split('@font-face').slice(1).map(b => '@font-face' + b.split('}')[0] + '}');
const latin = blocks.filter(b => /unicode-range:\s*U\+0000-00FF/.test(b));

let out = '';
for (const b of latin) {
  const url = b.match(/https:\/\/fonts\.gstatic\.com[^)]*/)[0];
  const buf = execSync(`curl -sS -m 30 "${url}"`, { maxBuffer: 1 << 26, encoding: 'buffer' });
  out += b.replace(/src:\s*url\([^)]*\)\s*format\('woff2'\)/,
    `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')`) + '\n';
}
writeFileSync(new URL('./fonts.css', import.meta.url), out);
console.log(`inlined ${latin.length} faces, ${(out.length / 1024).toFixed(0)} KB`);
