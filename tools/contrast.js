// Checks every skin in styles.css against the contrast promises in DESIGN.md.
//   node tools/contrast.js
// Text tokens (--ink, --muted, --faint) and every rarity colour need 4.5:1 on --bg, --surface and
// --surface-2; the Roll button text needs 4.5:1 on --accent; the accent and the focus ring need 3:1
// on --bg and --surface; reel digits need 4.5:1 on --cell (dimmed leading zeros 3:1, large text).
// Dark skins use the dark rarity scale, light skins (data-tone="light") the darkened one, and the
// reels keep the dark scale on every skin, so that one is also checked on --cell.
'use strict';
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

const props = body => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), vars: props(m[2]) }));
// Only blocks that set tokens on :root itself count, not ones scoped to an element inside it.
const selectors = sel => sel.split(/,(?![^(]*\))/).map(s => s.trim()); // commas inside :is() do not split
const rootBlocks = blocks.filter(b => selectors(b.sel).some(s => /^:root(\[data-theme="[\w-]+"\]|:is\([^)]*\))?$/.test(s)));
const themesOf = sel => [...sel.matchAll(/data-theme="([\w-]+)"/g)].map(m => m[1]);

const base = Object.assign({}, ...rootBlocks.filter(b => /^:root\s*(,|$)/.test(b.sel)).map(b => b.vars));
const darkScale = Object.fromEntries(Object.entries(base).filter(([k]) => k.startsWith('--r-')));
const lightBlock = blocks.find(b => b.sel === ':root[data-tone="light"]');
const lightScale = Object.fromEntries(Object.entries(lightBlock.vars).filter(([k]) => k.startsWith('--r-')));

// Skins from app.js: id, light flag, and whether the skin replaces the page with its own fixed colours.
const skinSrc = app.slice(app.indexOf('const SKINS = ['), app.indexOf('];', app.indexOf('const SKINS = [')));
const skins = [...skinSrc.matchAll(/\{ id: '([\w-]+)'[^}]*\}/g)].map(m => ({ id: m[1], light: /light: true/.test(m[0]), full: /full: true/.test(m[0]) }));
const fullSrc = app.match(/const FULL_SKINS = \[([^\]]*)\]/);
const FULL = fullSrc ? [...fullSrc[1].matchAll(/'([\w-]+)'/g)].map(m => m[1]) : [];

function rgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) / 255);
}
const lum = c => { const [r, g, b] = c.map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let failed = 0, checked = 0;
for (const skin of skins) {
  if (FULL.includes(skin.id)) continue; // full-screen skins draw their own page with fixed colours
  const own = Object.assign({}, ...rootBlocks.filter(b => themesOf(b.sel).includes(skin.id)).map(b => b.vars));
  if (!Object.keys(own).length && skin.id !== 'midnight') { failed++; console.log(`FAIL ${skin.id}: no tokens in styles.css`); continue; }
  const t = { ...base, ...own };
  const col = k => { const c = rgb(t[k] || ''); if (!c) throw new Error(`${skin.id}: ${k} is ${t[k]}, not a hex colour`); return c; };
  const scale = skin.light ? lightScale : darkScale;
  const bad = [];
  const need = (fg, fgName, bg, bgName, min) => { checked++; const r = ratio(fg, bg); if (r < min) bad.push(`${fgName} on ${bgName} ${r.toFixed(2)} < ${min}`); };
  for (const bg of ['--bg', '--surface', '--surface-2']) {
    for (const fg of ['--ink', '--muted', '--faint']) need(col(fg), fg, col(bg), bg, 4.5);
    for (const [k, v] of Object.entries(scale)) need(rgb(v), k, col(bg), bg, 4.5);
  }
  for (const bg of ['--bg', '--surface']) { need(col('--accent'), '--accent', col(bg), bg, 3); need(col('--focus'), '--focus', col(bg), bg, 3); }
  need(col('--accent-ink'), '--accent-ink', col('--accent'), '--accent', 4.5);
  need(col('--cell-ink'), '--cell-ink', col('--cell'), '--cell', 4.5);
  need(col('--cell-lead'), '--cell-lead', col('--cell'), '--cell', 3);
  for (const [k, v] of Object.entries(darkScale)) need(rgb(v), `${k} (reel)`, col('--cell'), '--cell', 4.5);
  if ((skin.light ? 1 : 0) !== (lum(col('--bg')) > 0.4 ? 1 : 0)) bad.push(`marked ${skin.light ? 'light' : 'dark'} but --bg is ${t['--bg']}`);
  if (bad.length) { failed++; console.log(`FAIL ${skin.id}:\n  ${bad.join('\n  ')}`); }
}
console.log(`${skins.length} skins (${FULL.length} full-screen), ${checked} pairs checked`);
console.log(failed ? `\n${failed} skin(s) failed` : '\nall skins pass');
process.exit(failed ? 1 : 0);
