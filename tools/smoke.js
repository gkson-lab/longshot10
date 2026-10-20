// Plays the game in a real browser and fails on any console error, dead control or page overflow.
//   node tools/smoke.js [--shots dir]
// Needs Playwright (npm i -g playwright, or set PLAYWRIGHT_CHROMIUM to a Chromium binary).
// It serves this folder on a free port, opens a fresh save, and clicks through every tab, the roll
// controls, the inventory, the settings and every skin, at a phone width and a desktop width.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  try { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); } catch {
    console.log('Playwright is not installed: npm i -g playwright');
    process.exit(1);
  }
}

const root = path.join(__dirname, '..');
const shotsAt = process.argv.indexOf('--shots');
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

let failed = 0;
const fail = msg => { failed++; console.log('FAIL', msg); };
const ok = msg => console.log('ok  ', msg);

async function session(browser, url, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/serviceWorker|favicon/i.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('dialog', d => d.accept()); // confirm() and prompt() answer yes
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('rollBtn').textContent === 'Roll', null, { timeout: 60000 });
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, `${width}-${name}.png`), fullPage: true }); };
  const overflow = async where => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    if (w[0] <= w[1] + 1) return;
    // Name the outermost elements that stick out, so the culprit is plain.
    const culprits = await page.evaluate(() => [...document.querySelectorAll('body *')]
      .filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !(e.parentElement && e.parentElement.getBoundingClientRect().right > innerWidth + 1))
      .slice(0, 4).map(e => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').join('.') : ''}`));
    fail(`${width}px ${where}: page is ${w[0]}px wide, wider than the ${w[1]}px screen (${culprits.join(', ')})`);
  };
  const click = async (sel, what) => {
    const el = page.locator(sel).first();
    if (!(await el.count())) { fail(`${width}px: ${what || sel} is missing`); return false; }
    await el.click();
    return true;
  };
  return { page, errors, shot, overflow, click };
}

// Each step gets the session helpers. Steps added by a release go at the end of their section.
const STEPS = [
  ['roll once', async ({ page, click }) => {
    await click('#rollBtn');
    await page.waitForFunction(() => !document.getElementById('result').hidden);
    const tier = await page.textContent('#tierWord');
    if (!tier) throw new Error('no tier shown after a roll');
  }],
  ['batch ×1,000', async ({ page, click }) => {
    await click('[data-batch="1000"]');
    await page.waitForFunction(() => /rolls\./.test(document.getElementById('batchResult').textContent));
  }],
  ['auto settings open and close', async ({ page, click }) => {
    await click('#optsBtn');
    if (await page.isHidden('#opts')) throw new Error('Auto settings did not open');
    await click('#optsBtn');
  }],
  ['endless on Turbo for a second', async ({ page, click }) => {
    await click('#optsBtn');
    await click('[data-speed="3"]');
    await click('#endlessBtn');
    await page.waitForTimeout(1200);
    await click('#endlessBtn');
    await click('[data-speed="1"]');
    await click('#optsBtn');
  }],
  ['every tab renders', async ({ page, click, overflow, shot }) => {
    for (const tab of await page.$$eval('.tabs [role="tab"]', bs => bs.map(b => b.dataset.tab))) {
      await click(`[data-tab="${tab}"]`);
      if (await page.isHidden(`#tab-${tab}`)) throw new Error(`tab ${tab} did not open`);
      await overflow(`${tab} tab`);
      await shot(`tab-${tab}`);
    }
    await click('[data-tab="roll"]');
  }],
  ['badge dialog opens and closes with Escape', async ({ page, click }) => {
    await click('[data-tab="collection"]');
    await click('#collection .card');
    if (!(await page.isVisible('#badgeDialog'))) throw new Error('badge dialog did not open');
    await page.keyboard.press('Escape');
    if (await page.isVisible('#badgeDialog')) throw new Error('Escape did not close the badge dialog');
    await click('[data-tab="roll"]');
  }],
  ['settings open, every owned skin applies', async ({ page, click, overflow, shot }) => {
    await click('#settingsBtn');
    await shot('settings');
    const ids = await page.$$eval('#skinList [data-skin]:not([disabled])', bs => bs.map(b => b.dataset.skin));
    for (const id of ids) {
      await click(`#skinList [data-skin="${id}"]`);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      if (theme !== id) throw new Error(`skin ${id} did not apply (theme is ${theme})`);
    }
    await click('#skinList [data-skin="midnight"]');
    await page.keyboard.press('Escape');
    await overflow('after skins');
  }],
  // v3.4
  ['What\'s new lists releases with timestamps', async ({ page, click }) => {
    await click('[data-open="newsDialog"]');
    const text = await page.textContent('#newsList');
    if (!/UTC/.test(text) || !(await page.isVisible('#newsDialog'))) throw new Error('no timestamped releases');
    await page.keyboard.press('Escape');
  }],
  ['? opens the key list, and 1 to 5 switch tabs', async ({ page }) => {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Shift+Slash');
    if (!(await page.isVisible('#keysDialog'))) throw new Error('? did not open the key list');
    await page.keyboard.press('Escape');
    await page.keyboard.press('3');
    if (await page.isHidden('#tab-collection')) throw new Error('3 did not open Collection');
    await page.keyboard.press('1');
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    await page.keyboard.press('t');
    await page.keyboard.press('b');
    await page.waitForFunction(() => /rolls\./.test(document.getElementById('batchResult').textContent));
  }],
  ['batch ×100,000 is counted quickly', async ({ page, click }) => {
    const t = Date.now();
    await click('[data-batch="100000"]');
    await page.waitForFunction(() => /100,000 rolls\./.test(document.getElementById('batchResult').textContent), null, { timeout: 15000 });
    if (Date.now() - t > 5000) throw new Error(`took ${Date.now() - t} ms`);
  }],
  ['Larger text keeps the page inside the screen', async ({ page, click, overflow, shot }) => {
    await click('#settingsBtn');
    await click('#textChoices input[value="larger"]');
    await page.keyboard.press('Escape');
    for (const tab of ['roll', 'inventory', 'trophies']) { await click(`[data-tab="${tab}"]`); await overflow(`larger text, ${tab}`); }
    await shot('larger-text');
    await click('#settingsBtn');
    await click('#textChoices input[value="normal"]');
    await click('#noticeChoices input[value="item"]');
    await click('#noticeChoices input[value="item"]');
    await page.keyboard.press('Escape');
    await click('[data-tab="roll"]');
  }],
  ['Keep boosts going renews a charm', async ({ page, click }) => {
    await click('[data-tab="inventory"]');
    await page.waitForSelector('[data-use="luck10"]:not([disabled])', { timeout: 5000 }).catch(() => {});
    const before = await page.evaluate(() => document.querySelector('#invList').textContent);
    await click('#renewBox');
    if (!(await page.isChecked('#renewBox'))) throw new Error('checkbox did not toggle');
    await click('#renewBox');
    if (!before) throw new Error('inventory is empty');
    await click('[data-tab="roll"]');
  }],
  ['command line unlocks Terminal, Console and Chat, and each plays', async ({ page, click }) => {
    const visible = async sel => { if (!(await page.isVisible(sel))) throw new Error(`${sel} is not showing`); };
    const type = async (sel, text) => { await page.fill(sel, text); await page.press(sel, 'Enter'); };
    await click('#settingsBtn');
    await click('#termToggle');
    for (const cmd of ['HELP', 'M@D3W1THL0V3', 'hello', 'ROLL 5', 'STATS', 'SKIN console']) await type('#termInput', cmd);
    await visible('#console');
    for (const cmd of ['ROLL 20', 'INV', 'QUESTS', 'SKIN chat']) await type('#conInput', cmd);
    await visible('#chat');
    for (const say of ['roll 10', 'stats', 'bye']) await type('#chatInput', say);
    await page.waitForFunction(() => document.getElementById('chat').hidden);
    await page.keyboard.press('Escape');
  }],
  ['the cheat code opens Handheld, and Power off leaves it', async ({ page, click }) => {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
    if (!(await page.isVisible('#handheld'))) throw new Error('Handheld did not open');
    for (const k of ['Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter', 'Escape']) await page.keyboard.press(k);
    await click('#handheld [data-leave]');
    if (await page.isVisible('#handheld')) throw new Error('Power off did not leave Handheld');
  }],
  ['07734 opens Calculator, and OFF leaves it', async ({ page, click }) => {
    await click('[data-tab="collection"]');
    await page.fill('#checkInput', '07734');
    await page.press('#checkInput', 'Enter');
    if (!(await page.isVisible('#calc'))) throw new Error('Calculator did not open');
    for (const k of ['1', '2', '=', '+', '−', 'MR', 'MODE']) await click(`#calc [data-key="${k}"]`);
    await click('#calc [data-key="OFF"]');
    if (await page.isVisible('#calc')) throw new Error('OFF did not leave Calculator');
    await click('[data-tab="roll"]');
  }],
];

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/index.html`;
  const exe = process.env.PLAYWRIGHT_CHROMIUM;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  for (const [w, h] of [[375, 800], [1280, 900]]) {
    const s = await session(browser, url, w, h);
    await s.shot('start');
    for (const [name, step] of STEPS) {
      try { await step(s); ok(`${w}px ${name}`); } catch (e) { fail(`${w}px ${name}: ${e.message.split('\n')[0]}`); }
    }
    await s.overflow('end');
    for (const e of s.errors) fail(`${w}px ${e}`);
    await s.page.close();
  }
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} problem(s)` : '\nsmoke test passed');
  process.exit(failed ? 1 : 0);
})();
