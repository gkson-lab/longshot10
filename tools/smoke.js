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
  // v3.5
  ['Log: luck rating, odds calculator, records, milestones, filters and CSV', async ({ page, click, overflow, shot }) => {
    await click('[data-tab="log"]');
    if (!/players after as many rolls/.test(await page.textContent('#luckRating'))) throw new Error('no luck rating after rolling');
    await page.fill('#ocRolls', '5000');
    await page.selectOption('#ocTier', 'epic');
    if (!/chance/.test(await page.textContent('#ocOut'))) throw new Error('odds calculator gave no answer');
    await page.fill('#ocRolls', 'lots');
    if (!/Enter a number/.test(await page.textContent('#ocOut'))) throw new Error('odds calculator took a bad number');
    await page.fill('#ocRolls', '1000');
    if (!/Most rolls/.test(await page.textContent('#records'))) throw new Error('no records');
    if (!/First roll/.test(await page.textContent('#milestones'))) throw new Error('no milestones');
    await page.selectOption('#logTier', { index: 12 });
    const empty = await page.textContent('#log');
    await page.selectOption('#logTier', '0');
    if (empty === (await page.textContent('#log'))) throw new Error('the tier filter changed nothing');
    const [dl] = await Promise.all([page.waitForEvent('download'), click('#csvBtn')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    if (!/^time,number,mode,tier/.test(csv) || csv.split('\n').length < 3) throw new Error('CSV is empty');
    await overflow('log tab');
    await shot('log-v35');
    await click('[data-tab="roll"]');
  }],
  // v3.6
  ['coin shop, token workshop, pins and auto-fuse', async ({ page, click, overflow, shot }) => {
    await click('[data-tab="inventory"]');
    const coins = async () => +(await page.textContent('#coinsInHand')).replace(/,/g, '');
    const before = await coins();
    if (before < 8) throw new Error(`only ${before} coins after the batches`);
    await click('#shopFold summary');
    await click('[data-buy="luck100"]');
    if ((await coins()) !== before - 8) throw new Error('buying a Charm of a Hundred did not cost 8 coins');
    if (!/Bought/.test(await page.textContent('#shopMsg'))) throw new Error('no purchase message');
    await click('[data-ws="tokenSense"]');
    if (!/level 1 of/.test(await page.textContent('#workshop'))) throw new Error('workshop level did not go up');
    await click('[data-pin="luck10"]');
    await click('#autoFuseBox');
    await overflow('inventory');
    await shot('inventory-v36');
    await click('[data-tab="roll"]');
    if (await page.isHidden('#quickbar')) throw new Error('quick use bar is hidden after pinning');
    const label = await page.textContent('#quickbar [data-quick="luck10"]');
    await click('#quickbar [data-quick="luck10"]');
    if (label === (await page.textContent('#quickbar [data-quick="luck10"]'))) throw new Error('quick use did not use the item');
    await click('[data-tab="inventory"]');
    await click('[data-pin="luck10"]');
    await click('#autoFuseBox');
    await click('[data-tab="roll"]');
    if (!(await page.isHidden('#quickbar'))) throw new Error('quick use bar still shows with nothing pinned');
  }],
  // v3.7
  ['quests reroll, weekly quests show, and the streak panel fills', async ({ page, click, overflow, shot }) => {
    await click('[data-tab="trophies"]');
    if ((await page.$$('#weekly li')).length !== 4) throw new Error('weekly quests are not three plus a note');
    if (!/in a row/.test(await page.textContent('#streakPanel'))) throw new Error('no streak shown');
    const reroll = page.locator('#quests [data-reroll]:not([disabled])').first();
    if (await reroll.count()) {
      const before = await page.textContent('#quests');
      await reroll.click();
      if (before === (await page.textContent('#quests'))) throw new Error('reroll changed nothing');
      if (!/no rerolls left|Quest Ticket/.test(await page.textContent('#rerollNote'))) throw new Error('the free reroll was not used up');
    }
    await overflow('trophies');
    await shot('trophies-v37');
    await click('[data-tab="roll"]');
  }],
  ['a Streak Freeze covers a missed day', async ({ page, click }) => {
    await page.reload(); // writes the save on the way out
    await page.waitForFunction(() => document.getElementById('rollBtn').textContent === 'Roll', null, { timeout: 60000 });
    await page.waitForTimeout(1500); // let the page's own pending save land first, or it would overwrite this edit
    await page.evaluate(() => {
      const ago = d => { const t = new Date(Date.now() - d * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
      const ix = JSON.parse(localStorage.getItem('rngdle10:slots')), key = !ix || ix.active === 'main' ? 'rngdle10:v3' : 'rngdle10:slot:' + ix.active;
      const s = JSON.parse(localStorage.getItem(key));
      s.streak = { days: 5, last: ago(2), best: 5 };
      s.inv.freeze = 1;
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.reload();
    await page.waitForFunction(() => document.getElementById('rollBtn').textContent === 'Roll', null, { timeout: 60000 });
    await click('#rollBtn');
    await click('[data-tab="trophies"]');
    const text = await page.textContent('#streakPanel');
    if (!/^6\s*days/.test(text.trim())) throw new Error(`streak reads "${text.trim().slice(0, 40)}", expected 6 days`);
    if (!/You have 0\./.test(text)) throw new Error('the Streak Freeze was not used');
    await click('[data-tab="roll"]');
  }],
  // v3.8
  ['bingo card, bounty hunt, also hunt and an Endless limit', async ({ page, click, overflow, shot }) => {
    await click('[data-tab="collection"]');
    if ((await page.$$('#bingo .cell')).length !== 25) throw new Error('bingo card is not 5 × 5');
    await click('#bingo [data-bingo]');
    if (!(await page.isVisible('#badgeDialog'))) throw new Error('a bingo cell did not open its badge');
    await page.keyboard.press('Escape');
    if ((await page.$$('#bounties li')).length !== 3) throw new Error('bounty board is not three bounties');
    await overflow('collection with bingo');
    await shot('collection-v38');
    await click('#bounties [data-bounty]');
    if (await page.isHidden('#tab-roll')) throw new Error('Hunt on a bounty did not go to the Roll tab');
    if (!/Hunting/.test(await page.textContent('#status'))) throw new Error('the bounty is not being hunted');
    await click('[data-tab="collection"]');
    await click('#collection .card');
    await click('#bdAlso');
    if (!/Also hunting/.test(await page.textContent('#status'))) throw new Error('Also hunt added nothing');
    await click('#alsoHunt [data-unhunt]');
    await page.selectOption('#hunt', '');
    if (/Hunting/.test(await page.textContent('#status'))) throw new Error('the hunt did not clear');
    await page.selectOption('#endlessLimit', 'r1000');
    await click('[data-speed="3"]');
    await click('#endlessBtn');
    await page.waitForFunction(() => document.getElementById('endlessBtn').getAttribute('aria-pressed') === 'false', null, { timeout: 20000 });
    await page.selectOption('#endlessLimit', '');
    await click('#stopNewBox');
    await click('#stopNewBox');
    await click('[data-speed="1"]');
    await click('#optsBtn');
  }],
  ['command line unlocks Terminal, Console and Chat, and each plays', async ({ page, click }) => {
    const visible = async sel => { if (!(await page.isVisible(sel))) throw new Error(`${sel} is not showing`); };
    const type = async (sel, text) => { await page.fill(sel, text); await page.press(sel, 'Enter'); };
    await click('#settingsBtn');
    await click('#termToggle');
    for (const cmd of ['HELP', 'M@D3W1THL0V3', 'hello', 'ROLL 5', 'STATS', 'RECORDS', 'CHANCE epic 500', 'WORKSHOP', 'SHOP', 'SHOP BUY lens 2', 'QUESTS', 'QUESTS REROLL 2', 'BINGO', 'BOUNTIES', 'SKIN console']) await type('#termInput', cmd);
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
