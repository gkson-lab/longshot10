(function () {
  'use strict';
  const G = window.RNG;
  const { BADGES, RARITIES, ROLL_TIERS, CATEGORIES, MODES, MODE_BY_ID, MULTIPLIERS, MULT_BY_ID } = G;
  const MODE_IDS = MODES.map(m => m.id);
  const $ = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sup = n => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const TIER_INDEX = Object.fromEntries(ROLL_TIERS.map((t, i) => [t.id, i]));
  const T = id => TIER_INDEX[id];
  const tierVar = id => `var(--r-${id})`;
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const MULTS = MULTIPLIERS.filter(m => m.id !== 'unity');

  function dayKey(t = Date.now()) {
    const d = new Date(t), p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  const odds = p => (1 / p < 10 ? `1 in ${(1 / p).toFixed(1)}` : `1 in ${fmt(1 / p)}`);
  const beats = pct => (pct >= 99.999 ? '99.999' : pct >= 99.9 ? pct.toFixed(3) : pct >= 99 ? pct.toFixed(2) : pct.toFixed(1));

  // Scores are kept as log10 so ⁵2-sized results still compare.
  function bigText(log, exact) {
    if (log === -Infinity) return '0';
    if (log < 15 && exact) return fmt(exact());
    if (log < 15) return fmt(10 ** log);
    let ex = Math.floor(log), mant = Number((10 ** (log - ex)).toFixed(2));
    if (mant >= 10) { mant /= 10; ex++; } // 9.999 rounds up to 10.00
    return `${mant.toFixed(2)} × 10${sup(ex)}`;
  }
  const multValue = m => (m.value !== null ? (m.value >= 1e15 ? bigText(m.log) : String(+m.value.toPrecision(8))) : bigText(m.log));
  function factorText(n) {
    if (n < 2) return '';
    const f = G.factorize(n);
    if (f.length === 1 && f[0][1] === 1) return 'Prime';
    return f.map(([p, k]) => fmt(p) + (k > 1 ? sup(k) : '')).join(' × ');
  }

  // A roll entry: { n, t, mode, e?, m?, tg?, x } (tg = target, x = multiplier id).
  const rollOf = x => ({ mode: x.mode, e: x.e, m: x.m, t: x.tg, mult: x.x });
  const scoreOf = x => G.score(x.n, dayKey(x.t), rollOf(x));
  const label = x => fmt(x.n) + (x.e > 1 ? sup(x.e) : '');
  function hashOf(x) {
    const q = new URLSearchParams({ n: x.n });
    if (x.mode !== 'classic') q.set('mode', x.mode);
    if (x.e) q.set('e', x.e);
    if (x.m) q.set('m', x.m);
    if (x.tg !== undefined) q.set('t', x.tg);
    if (x.x && x.x !== 'unity') q.set('x', x.x);
    return '#' + q.toString();
  }

  // Save files: each is one browser-stored save, listed in an index. The first keeps the original
  // key so saves from earlier versions are picked up as it.
  const SLOTS_KEY = 'rngdle10:slots';
  const MAX_SLOTS = 10;
  const slotKey = id => (id === 'main' ? 'rngdle10:v3' : `rngdle10:slot:${id}`);
  function loadSlots() {
    try {
      const s = JSON.parse(localStorage.getItem(SLOTS_KEY));
      if (s && Array.isArray(s.list) && s.list.some(x => x.id === s.active)) return s;
    } catch { /* fall through to a fresh index */ }
    return { active: 'main', list: [{ id: 'main', name: 'Save 1', created: Date.now() }] };
  }
  const slots = loadSlots();
  function saveSlots() { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch { /* storage blocked */ } }
  const KEY = slotKey(slots.active);
  const LOG_LIMIT = 200;
  const perMode = make => Object.fromEntries(MODE_IDS.map(id => [id, make()]));
  const blank = () => ({
    v: 4, log: [], total: 0, totals: perMode(() => 0), counts: {}, first: {}, mults: {}, firstMult: {},
    tiers: perMode(() => ({})), hof: perMode(() => []), favs: [], ach: {}, huntsDone: 0, shares: 0,
    settings: { theme: 'midnight', effects: 'full', sound: true }, mode: 'classic',
    inv: {}, effects: {}, boosted: 0, lastGift: '', coins: 0, spins: 0, pity: {},
    skins: [], book: {}, quests: {}, prestige: 0, prestigeAt: 0, daily: {},
  });
  function upgradeEntry(x) { // v2/v3 entries had no mode or multiplier
    return { ...x, mode: x.mode || (x.e ? 'exp' : 'classic'), x: x.x || 'unity' };
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s) {
        const st = Object.assign(blank(), s);
        const b = blank();
        for (const k of ['totals', 'tiers', 'hof', 'settings']) st[k] = Object.assign(b[k], s[k]);
        st.log = st.log.map(upgradeEntry);
        st.favs = st.favs.map(upgradeEntry);
        for (const id of MODE_IDS) st.hof[id] = st.hof[id].map(upgradeEntry);
        if (!MODE_BY_ID[st.mode]) st.mode = 'classic';
        if (!(s.v >= 4)) rescale(st);
        return st;
      }
      const old = slots.active === 'main' && JSON.parse(localStorage.getItem('rngdle9:v2'));
      const st = blank();
      if (old) {
        Object.assign(st, { total: old.total || 0, counts: old.counts || {}, first: old.first || {} });
        st.totals.classic = st.total;
        st.settings.sound = old.sound !== false;
        st.log = (old.log || []).filter(x => Number.isInteger(x.n)).map(upgradeEntry);
        rescale(st);
      }
      return st;
    } catch { return blank(); }
  }
  // Saves from before v2.1 counted tiers on the old seven-step scale, where Mythic meant the top 1%.
  // Those counts cannot be converted, so tiers and the hall of fame are rebuilt from the saved rolls.
  function rescale(st) {
    st.tiers = perMode(() => ({}));
    st.hof = perMode(() => []);
    for (const x of st.log.concat(st.favs)) {
      const e = entryFor(x);
      if (st.log.includes(x)) st.tiers[x.mode][e.tier] = (st.tiers[x.mode][e.tier] || 0) + 1;
      insertTop(st.hof[x.mode], e);
    }
    st.v = 4;
  }
  const tierTotal = mode => Object.values(state.tiers[mode]).reduce((a, b) => a + b, 0);
  // Saves are throttled, not debounced: a debounce kept resetting during Endless and never fired.
  let saveTimer = 0, storageOk = true;
  function writeSave() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch { storageOk = false; }
    $('storageNotice').hidden = storageOk;
  }
  function save() {
    if (!saveTimer) saveTimer = setTimeout(writeSave, auto ? 1000 : 200);
  }
  addEventListener('pagehide', () => { if (saveTimer) writeSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) writeSave(); });

  function entryFor(x) {
    const r = scoreOf(x);
    const { pct, tier, oneInLog, estimated } = G.rollTier(r.rank, x.mode);
    return { ...x, ep: r.ep, log: r.log, tier: tier.id, pct, oneInLog, estimated };
  }
  // "1/N", with ≈ when N is past what the two-million-roll sample can measure.
  const oneText = e => {
    if (e.oneInLog === undefined) e = entryFor(e); // entries saved before 1/N existed
    return `${e.estimated ? '≈ ' : ''}1/${bigText(e.oneInLog)}`;
  };
  function insertTop(list, entry, size = 10) {
    if (list.length >= size && entry.log <= list[list.length - 1].log) return false;
    list.push(entry);
    list.sort((a, b) => b.log - a.log || a.t - b.t);
    list.length = Math.min(list.length, size);
    return true;
  }

  const state = load();
  const session = { rolls: 0, best: perMode(() => []), start: Date.now() };

  function record(x) {
    const r = scoreOf(x);
    const { pct, tier, oneInLog, estimated } = G.rollTier(r.rank, x.mode);
    const entry = { ...x, ep: r.ep, log: r.log, tier: tier.id, pct, oneInLog, estimated };
    state.log.unshift(x);
    if (state.log.length > LOG_LIMIT) state.log.length = LOG_LIMIT;
    state.total++;
    state.totals[x.mode]++;
    const day = dayKey(x.t);
    state.daily[day] = (state.daily[day] || 0) + 1;
    const fresh = new Set();
    for (const b of r.badges) {
      if (!state.counts[b.id]) { fresh.add(b.id); state.first[b.id] = x; }
      state.counts[b.id] = (state.counts[b.id] || 0) + 1;
    }
    let freshMult = false;
    if (x.x !== 'unity') {
      if (!state.mults[x.x]) { freshMult = true; state.firstMult[x.x] = x; }
      state.mults[x.x] = (state.mults[x.x] || 0) + 1;
    }
    // Boosted rolls are not random draws of the plain game, so they stay out of the luck table.
    if (x.b || x.lens) state.boosted++;
    else state.tiers[x.mode][tier.id] = (state.tiers[x.mode][tier.id] || 0) + 1;
    const madeHof = insertTop(state.hof[x.mode], entry);
    const madeSession = insertTop(session.best[x.mode], entry);
    session.rolls++;
    return { r, pct, tier, fresh, freshMult, entry, madeHof, madeSession };
  }

  // Sound
  let audio = null;
  function tone(freq, dur, { type = 'triangle', gain = 0.05, when = 0 } = {}) {
    if (!state.settings.sound) return;
    try {
      audio = audio || new AudioContext();
      const t0 = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + dur);
    } catch { /* audio unavailable */ }
  }
  const tick = i => tone(380 + i * 45, 0.06, { type: 'square', gain: 0.02 });
  function fanfare(i) {
    const scale = [261.6, 329.6, 392, 523.3, 659.3, 784, 1046.5, 1318.5];
    for (let k = 0; k < Math.min(8, Math.max(1, i - 1)); k++) tone(scale[k], 0.3 + k * 0.05, { when: k * 0.07 });
  }
  function paintSound() {
    const on = state.settings.sound;
    $('soundBtn').setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
    $('soundBtn').innerHTML = on
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  }
  $('soundBtn').addEventListener('click', () => { state.settings.sound = !state.settings.sound; paintSound(); save(); });
  const effects = () => (systemReduced.matches ? 'off' : state.settings.effects);

  // Reels: ten digits, the exponent, and the multiplier window.
  const reels = [];
  for (const size of [1, 3, 3, 3]) { // 1,234,567,890
    const trio = document.createElement('div');
    trio.className = 'trio';
    for (let i = 0; i < size; i++) {
      const reel = document.createElement('div');
      reel.className = 'reel lead';
      reel.innerHTML = '<div class="strip"><div>0</div></div>';
      trio.appendChild(reel);
      reels.push(reel);
    }
    $('reels').appendChild(trio);
  }
  const leadCount = n => G.DIGITS - (n === 0 ? 1 : String(n).length);
  function setReel(reel, digit, lead) {
    const strip = reel.firstChild;
    reel.classList.remove('spinning', 'hit');
    reel.classList.toggle('lead', lead);
    strip.style.transition = 'none';
    strip.style.transform = '';
    strip.innerHTML = `<div>${esc(digit)}</div>`;
  }
  function paintMult(m) {
    const w = $('multWindow');
    w.style.setProperty('--rc', tierVar(RARITIES[m.rarity].id));
    w.classList.toggle('unity', m.id === 'unity');
    setReel($('multReel'), m.symbol, false);
    $('multName').textContent = m.id === 'unity' ? 'No multiplier this time' : m.name;
    $('multMeta').textContent = m.id === 'unity' ? `Unity lands ${(100 * m.p).toFixed(1)}% of the time` : `×${multValue(m)} · ${odds(m.p)} · ${RARITIES[m.rarity].name}`;
  }
  function setReels(x) {
    const s = String(x.n).padStart(G.DIGITS, '0'), lead = leadCount(x.n);
    reels.forEach((r, i) => setReel(r, s[i], i < lead));
    $('expWrap').hidden = !x.e;
    if (x.e) setReel($('expReel'), x.e, false);
    paintMult(MULT_BY_ID[x.x] || MULT_BY_ID.unity);
    $('reels').setAttribute('aria-label', label(x));
  }
  function spinReel(reel, target, ms, spins, lead, faces, onStop) {
    return new Promise(resolve => {
      const strip = reel.firstChild;
      const from = strip.lastChild ? strip.lastChild.textContent : '0';
      let html = `<div>${esc(from)}</div>`;
      for (let j = 1; j < spins; j++) html += `<div>${esc(faces())}</div>`;
      strip.innerHTML = html + `<div>${esc(target)}</div>`;
      reel.classList.remove('lead', 'hit');
      reel.classList.add('spinning');
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.getBoundingClientRect();
      strip.style.transition = `transform ${ms}ms cubic-bezier(.15,.75,.25,1.04)`;
      strip.style.transform = `translateY(-${(spins / (spins + 1)) * 100}%)`;
      let done = false;
      const settle = () => { // transitionend, or the timer when a background tab pauses the animation
        if (done) return;
        done = true;
        setReel(reel, target, lead);
        if (onStop) onStop();
        resolve();
      };
      strip.addEventListener('transitionend', settle, { once: true });
      setTimeout(settle, ms + 150);
    });
  }
  const digitFace = () => Math.floor(Math.random() * 10);
  const multFace = () => MULTS[Math.floor(Math.random() * 40)].symbol; // the common end of the table
  function spinTo(x, speed) {
    if (speed === 3 || effects() === 'off') { setReels(x); return Promise.resolve(); }
    const s = String(x.n).padStart(G.DIGITS, '0'), lead = leadCount(x.n);
    const base = speed === 1 ? 460 : 170, stagger = speed === 1 ? 70 : 20, spins = speed === 1 ? 20 : 8;
    $('expWrap').hidden = !x.e;
    const jobs = reels.map((r, i) => spinReel(r, s[i], base + i * stagger, spins + i * 2, i < lead, digitFace, speed === 1 ? () => tick(i) : null));
    const end = base + reels.length * stagger;
    if (x.e) jobs.push(spinReel($('expReel'), x.e, end + (speed === 1 ? 150 : 40), spins + 16, false, digitFace, null));
    const m = MULT_BY_ID[x.x];
    jobs.push(spinReel($('multReel'), m.symbol, end + (speed === 1 ? 300 : 70), spins + 20, false, multFace, () => paintMult(m)));
    return Promise.all(jobs).then(() => $('reels').setAttribute('aria-label', label(x)));
  }

  // Confetti, shake and flash grow with the tier.
  const canvas = $('fx'), ctx = canvas.getContext('2d');
  let parts = [], raf = 0, lastFlash = 0;
  const sizeCanvas = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
  sizeCanvas();
  addEventListener('resize', sizeCanvas);
  function burst(color, count, power) {
    const r = $('cabinet').getBoundingClientRect(), d = devicePixelRatio;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = (Math.random() * 0.8 + 0.2) * power * d;
      parts.push({ x: (r.left + r.width * (0.1 + Math.random() * 0.8)) * d, y: (r.top + r.height / 2) * d, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4 * d, life: 1, size: (Math.random() * 3 + 1.5) * d, color, spin: Math.random() * 6 });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += 0.22 * devicePixelRatio; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life -= 0.013; p.spin += 0.2;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.spin);
      ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(frame) : 0;
  }
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function celebrate(tierId, speed) {
    const i = T(tierId), color = cssVar(`--r-${tierId}`);
    // Effects are anchored to odds, not tier names: confetti from 1/100 (Epic), glowing reels and
    // the flash from 1/50,000 (Divine), and in Turbo only from 1/1,000,000 (Transcendent).
    for (const r of reels.concat($('expReel'))) { r.style.setProperty('--tc', tierVar(tierId)); r.classList.toggle('hit', i >= T('divine') && !r.classList.contains('lead')); }
    if (speed !== 3) fanfare(Math.max(1, i - 2));
    if (effects() !== 'full' || (speed === 3 && i < T('transcendent'))) return;
    if (i >= T('epic')) burst(color, Math.min(400, 20 * 2 ** (i - T('epic'))), 6 + i - T('epic'));
    // No shake or flash in Turbo, and never more than one flash every 3 seconds.
    if (i >= T('divine') && speed !== 3 && Date.now() - lastFlash > 3000) {
      lastFlash = Date.now();
      const c = $('cabinet');
      c.classList.remove('shake', 'shake-big'); void c.offsetWidth;
      c.classList.add(i >= T('celestial') ? 'shake-big' : 'shake');
      const f = $('flash');
      f.style.setProperty('--tc', color);
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    }
  }

  function toast(html, colorId) {
    if (consoleOn()) { conPrint(plain(html)); return; }
    if (auto && speed === 3 && $('toasts').children.length >= 4) return; // Turbo can earn badges faster than anyone can read
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--tc', tierVar(colorId));
    el.innerHTML = html;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // Badge and multiplier cards, and their detail dialog.
  const modeBadges = () => MODES.flatMap(m => m.badges);
  const allBadges = () => BADGES.concat(modeBadges(), G.datedBadges(dayKey()));
  const findBadge = id => allBadges().find(b => b.id === id);

  function card({ title, desc, rarity, right, odd, locked = false, delay = null, isNew = false, onOpen }) {
    const r = RARITIES[rarity];
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card' + (locked ? ' locked' : '') + (delay !== null ? ' in' : '');
    btn.style.setProperty('--rc', tierVar(r.id));
    if (delay !== null) btn.style.animationDelay = delay + 'ms';
    btn.innerHTML = '<span class="name"></span><span class="desc"></span><span class="right"><span class="rar"></span> <span class="pts num"></span><br><span class="odds"></span></span>';
    btn.querySelector('.name').textContent = title;
    if (isNew) btn.querySelector('.name').insertAdjacentHTML('beforeend', '<span class="new">New</span>');
    btn.querySelector('.desc').textContent = desc;
    btn.querySelector('.rar').textContent = r.name;
    btn.querySelector('.pts').textContent = right;
    btn.querySelector('.odds').textContent = odd;
    btn.addEventListener('click', onOpen);
    li.appendChild(btn);
    return li;
  }
  const badgeCard = (b, o = {}) => card({
    title: b.name, desc: b.desc, rarity: b.rarity, right: (b.factor ? '×' : '+') + fmt(b.ep),
    odd: o.times ? `${odds(b.p)}, earned ${fmt(o.times)}×` : odds(b.p), onOpen: () => openBadge(b), ...o,
  });
  const multCard = (m, o = {}) => card({
    title: `${m.symbol}  ${m.name}`, desc: `×${multValue(m)}`, rarity: m.rarity, right: '',
    odd: o.times ? `${odds(m.p)}, landed ${fmt(o.times)}×` : odds(m.p), onOpen: () => openMult(m), ...o,
  });

  let dialogTarget = null;
  function openDetail({ title, meta, desc, rows, first, huntId }) {
    dialogTarget = huntId;
    $('bdTitle').textContent = title;
    $('bdMeta').innerHTML = meta;
    $('bdDesc').textContent = desc;
    $('bdFacts').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join('');
    if (first) $('bdFacts').insertAdjacentHTML('beforeend', `<dt>First found</dt><dd class="num"><a href="${hashOf(first)}" data-close>${esc(label(first))} (${esc(MODE_BY_ID[first.mode].name)})</a></dd>`);
    $('bdHunt').hidden = !huntId;
    $('badgeDialog').showModal();
  }
  function openBadge(b) {
    const r = RARITIES[b.rarity];
    const rolls = b.mode ? state.totals[b.mode] : state.total;
    const have = state.counts[b.id] || 0;
    const first = state.first[b.id];
    openDetail({
      title: b.name, desc: b.desc, huntId: b.cat === 'Daily' ? null : b.id,
      meta: `<span style="color:${tierVar(r.id)};font-weight:700">${r.name}</span> · ${esc(b.cat)}${b.mode ? ` · ${esc(MODE_BY_ID[b.mode].name)} mode only` : ''}`,
      rows: [
        b.mode ? ['Chance', `${odds(b.p)} per ${MODE_BY_ID[b.mode].name} roll`] : ['Qualifying numbers', `${fmt(b.count)} of ${fmt(G.SPACE)}`],
        ['Worth', b.factor ? `×${fmt(b.ep)}, applied after the exponent` : `${fmt(b.ep)} EP`],
        ['You earned it', `${fmt(have)} ${have === 1 ? 'time' : 'times'}`],
        [`Expected in your ${fmt(rolls)} ${b.mode ? MODE_BY_ID[b.mode].name + ' ' : ''}rolls`, (rolls * b.p).toFixed(rolls * b.p < 10 ? 2 : 0)],
      ],
      first: first && (typeof first === 'object' ? upgradeEntry(first) : { n: first, mode: 'classic', x: 'unity' }),
    });
  }
  function openMult(m) {
    const r = RARITIES[m.rarity];
    const have = state.mults[m.id] || 0;
    openDetail({
      title: `${m.symbol}  ${m.name}`, desc: `Multiplies your score by ${multValue(m)}.`, huntId: 'x:' + m.id,
      meta: `<span style="color:${tierVar(r.id)};font-weight:700">${r.name}</span> · Multiplier`,
      rows: [
        ['Exact chance', `${fmt(m.units)} in 10${sup(15)}`],
        ['Odds', odds(m.p)],
        ['You landed it', `${fmt(have)} ${have === 1 ? 'time' : 'times'}`],
        [`Expected in your ${fmt(state.total)} rolls`, (state.total * m.p).toFixed(state.total * m.p < 10 ? 2 : 0)],
      ],
      first: state.firstMult[m.id],
    });
  }
  $('bdHunt').addEventListener('click', () => {
    const b = !dialogTarget.startsWith('x:') && findBadge(dialogTarget);
    if (b && b.mode && state.mode !== b.mode) setMode(b.mode);
    setHunt(dialogTarget);
    $('badgeDialog').close();
    selectTab('roll');
  });
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  }

  // The result
  let shown = null;
  function modeFacts(x, r) {
    const c = r.c, out = [];
    if (x.mode === 'exp' && x.e > 1 && x.n > 1) {
      const lg = x.e * Math.log10(x.n);
      out.push(`${label(x)} = ${lg < 21 ? fmt(Number(BigInt(x.n) ** BigInt(x.e))) : `${bigText(lg)}, ${fmt(Math.floor(lg) + 1)} digits`}`);
    }
    if (x.mode === 'mod') out.push(`mod ${fmt(x.m)} leaves ${fmt(c.r)}${c.r === 0 ? ', a clean divide' : ''}`);
    if (x.mode === 'target') out.push(`target ${fmt(x.tg)}, ${c.D === 0 ? 'a bullseye' : `${fmt(c.D)} away`}`);
    if (x.mode === 'radar') out.push(c.d === 0 ? 'this number is prime' : `nearest prime is ${fmt(c.d)} away`);
    return out;
  }
  function formula(x, r) {
    let s = `${fmt(r.base)} EP`;
    if (r.mult.id !== 'unity') s += ` × ${r.mult.symbol}`;
    if (x.mode === 'exp' && x.e > 1) s = `(${s})${sup(x.e)}`;
    if (r.factor > 1) s += ` × ${fmt(r.factor)}`;
    if (x.mode === 'mod' && r.c.r === 0) s += ` × ${fmt(x.m)}`;
    if (x.mode === 'target') {
      const b = G.SPACE / (r.c.D + 1);
      s += ` × ${b < 100 ? b.toFixed(2) : bigText(Math.log10(b))}`;
    }
    return s;
  }
  const rollsText = k => `${fmt(k)} ${k === 1 ? 'roll' : 'rolls'}`;
  function showResult(x, { animate = false, speed = 1, preview = false, fresh = null, pre = null } = {}) {
    const r = pre ? pre.r : scoreOf(x);
    const rt = pre ? { pct: pre.pct, tier: pre.tier, oneInLog: pre.entry.oneInLog, estimated: pre.entry.estimated } : G.rollTier(r.rank, x.mode);
    const { pct, tier } = rt;
    shown = { x, r, pct, tier, preview, odds: rt };
    $('firstRun').hidden = true;
    $('result').hidden = false;

    const w = $('tierWord'), i = T(tier.id);
    w.textContent = tier.name;
    w.style.setProperty('--tc', tierVar(tier.id));
    w.className = 'tier-word' + (i >= T('legendary') ? ' glow' : '');
    if (animate && speed !== 3 && effects() !== 'off') { void w.offsetWidth; w.classList.add(i >= T('transcendent') ? 'sheen' : 'pop'); }
    $('oneIn').textContent = oneText(rt);
    $('oneIn').style.setProperty('--tc', tierVar(tier.id));
    $('oneInNote').textContent = (rt.estimated
      ? 'estimated: rarer than any of the two million sampled rolls'
      : `of ${MODE_BY_ID[x.mode].name} rolls do at least this well`)
      + (x.b ? `, rolled with luck ×${fmt(x.b)}` : '') + (x.lens ? `, with the ${x.lens === 10 ? 'Prism' : 'Multiplier'} Lens` : '');

    const f = formula(x, r), plain = f === `${fmt(r.base)} EP`;
    $('scoreLine').innerHTML = (plain ? '' : `<span class="formula num">${esc(f)} =</span> `)
      + `<b class="num">${esc(bigText(r.log))}</b>${plain ? ' EP' : ''}`;
    const facts = [factorText(x.n), ...modeFacts(x, r)].filter(Boolean);
    $('facts').innerHTML = facts.map(f => `<span class="num">${esc(f)}</span>`).join(' · ') + (preview ? ' · preview, not recorded' : '');

    $('badgeHead').textContent = r.badges.length === 1 ? '1 badge' : `${r.badges.length} badges`;
    $('badgeSub').textContent = r.badges.length ? 'select one for its exact odds' : '';
    const list = $('badges');
    list.replaceChildren();
    if (!r.badges.length) list.innerHTML = '<li class="empty-state">No badges on this roll, so it counts as 1 EP before the multiplier. About 1 in 7 rolls earns none.</li>';
    const stagger = animate && speed === 1 && effects() !== 'off';
    r.badges.forEach((b, k) => list.appendChild(badgeCard(b, { delay: stagger ? k * 60 : null, isNew: !!fresh && fresh.has(b.id) })));
    paintStar();
    $('starBtn').hidden = preview;
    return tier;
  }

  const sameRoll = (a, b) => a.n === b.n && a.t === b.t;
  const isFav = x => state.favs.some(f => sameRoll(f, x));
  function paintStar() {
    if (!shown) return;
    const on = isFav(shown.x);
    $('starBtn').setAttribute('aria-pressed', String(on));
    $('starBtn').textContent = on ? 'Starred' : 'Star';
  }
  $('starBtn').addEventListener('click', () => {
    if (!shown || shown.preview) return;
    if (isFav(shown.x)) state.favs = state.favs.filter(f => !sameRoll(f, shown.x));
    else { state.favs.unshift(shown.x); checkAchievements(); }
    paintStar();
    save();
  });

  function shareText() {
    const { x, r, pct, tier } = shown;
    const squares = ['⬜', '🟩', '🟦', '🟪', '🟧', '🟥', '🟨', '⬛', '⬛', '⬛', '⬛', '⬛', '⬛']; // one per badge by rarity, as in Wordle shares; Divine and up share black
    return [
      `RNGdle 10 · ${MODE_BY_ID[x.mode].name}`,
      label(x) + (r.mult.id !== 'unity' ? ` × ${r.mult.symbol}` : ''),
      `${tier.name} · ${oneText(shown.odds)} · ${formula(x, r)} = ${bigText(r.log)}`,
      r.badges.map(b => squares[b.rarity]).join('') || 'no badges',
    ].join('\n');
  }
  $('copyBtn').addEventListener('click', async () => {
    const text = shareText();
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    $('copyBtn').textContent = 'Copied';
    setTimeout(() => { $('copyBtn').textContent = 'Copy text'; }, 1400);
    state.shares++; checkAchievements(); save();
  });

  // Share image: the reel motif on a 1200×630 card.
  $('imageBtn').addEventListener('click', () => {
    const { x, r, pct, tier } = shown;
    const W = 1200, H = 630, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d'), v = cssVar;
    const sans = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const mono = 'ui-monospace, Cascadia Mono, SF Mono, Menlo, Consolas, monospace';
    g.fillStyle = v('--bg'); g.fillRect(0, 0, W, H);
    g.fillStyle = v('--ink'); g.font = `800 34px ${sans}`; g.fillText('RNGdle 10', 60, 80);
    g.fillStyle = v('--muted'); g.font = `500 22px ${sans}`; g.fillText(`${MODE_BY_ID[x.mode].name} mode`, 60, 114);
    const s = String(x.n).padStart(G.DIGITS, '0'), lead = leadCount(x.n);
    const cw = 76, ch = 112, gap = 8, gg = 22;
    let px = 60;
    g.textAlign = 'center';
    for (let k = 0; k < s.length; k++) {
      if (k === 1 || k === 4 || k === 7) px += gg;
      g.fillStyle = v('--cell'); g.beginPath(); g.roundRect(px, 150, cw, ch, 8); g.fill();
      g.fillStyle = k < lead ? v('--cell-lead') : v('--cell-ink'); g.font = `700 66px ${mono}`;
      g.fillText(s[k], px + cw / 2, 150 + ch / 2 + 23);
      px += cw + gap;
    }
    if (x.e) { g.fillStyle = v('--cell'); g.beginPath(); g.roundRect(px + 10, 140, 52, 72, 6); g.fill(); g.fillStyle = v('--cell-ink'); g.font = `700 40px ${mono}`; g.fillText(String(x.e), px + 36, 190); }
    g.textAlign = 'left';
    g.fillStyle = v('--ink'); g.font = `600 26px ${sans}`;
    g.fillText(r.mult.id === 'unity' ? 'No multiplier' : `× ${r.mult.symbol}  ${r.mult.name}`, 60, 306);
    g.fillStyle = v(`--r-${tier.id}`); g.font = `900 76px ${sans}`; g.fillText(tier.name, 60, 400);
    g.fillStyle = v('--ink'); g.font = `600 26px ${sans}`;
    g.fillText(`${bigText(r.log)} · beats ${beats(pct)}% of ${MODE_BY_ID[x.mode].name} rolls`, 60, 444);
    r.badges.slice(0, 6).forEach((b, k) => {
      const bx = 60 + (k % 2) * 540, by = 500 + Math.floor(k / 2) * 38;
      g.fillStyle = v(`--r-${RARITIES[b.rarity].id}`); g.fillRect(bx, by - 20, 5, 26);
      g.fillStyle = v('--ink'); g.font = `600 23px ${sans}`; g.fillText(b.name, bx + 16, by);
    });
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `rngdle10-${x.mode}-${x.n}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    state.shares++; checkAchievements(); save();
  });

  // Side boards: the best rolls of this session and of all time, for the current mode.
  let freshEntry = null;
  function renderBoards(changed = true) {
    const mode = state.mode, name = MODE_BY_ID[mode].name;
    for (const el of document.querySelectorAll('[data-board]')) {
      const all = el.dataset.board === 'all';
      const list = all ? state.hof[mode] : session.best[mode];
      const sub = `${name} · ${rollsText(all ? state.totals[mode] : session.rolls)}`;
      if (!changed && el.querySelector('.sub')) { el.querySelector('.sub').textContent = sub; continue; } // only the counts moved
      const items = list.map((x, k) => `<li${x === freshEntry ? ' class="fresh"' : ''} style="--tc:${tierVar(x.tier)}"><a href="${hashOf(x)}"><span class="rank num">${k + 1}</span><span class="n num">${esc(label(x))}</span><span class="sc num">${esc(oneText(x))}</span><span class="tier">${ROLL_TIERS[T(x.tier)].name}${x.x && x.x !== 'unity' ? ` <span class="x">× ${esc(MULT_BY_ID[x.x].symbol)}</span>` : ''}</span></a></li>`).join('');
      el.innerHTML = `<h2>${all ? 'All time' : 'This session'}</h2><p class="sub num">${sub}</p>`
        + (items ? `<ol>${items}</ol>` : `<p class="empty">${all ? 'Your ten best rolls ever land here.' : 'Your ten best rolls this session land here.'}</p>`);
    }
  }

  // Rolling
  let speed = 1, auto = null, busy = false, hunt = '', huntRolls = 0;
  const run = { start: 0, rolls: 0 }; // the current Auto or Endless run, for its rolls-a-second figure
  const huntName = id => (id.startsWith('x:') ? `× ${MULT_BY_ID[id.slice(2)].symbol} ${MULT_BY_ID[id.slice(2)].name}` : findBadge(id).name);
  const huntP = id => (id.startsWith('x:') ? MULT_BY_ID[id.slice(2)].p : findBadge(id).p);

  // Inventory. Items live in the save file, so they move with exports and shared saves.
  // Luck ×L makes a roll the best of L independent rolls: anything rare becomes roughly L times
  // likelier, and the 1/N shown is still the result's true odds in the plain game.
  // `next` fuses: that many of this item make one of the next.
  const luckItem = (id, name, luck, rolls, rarity, next) => ({ id, name, kind: 'luck', luck, rolls, rarity, next, desc: `Luck ×${fmt(luck)} for ${rollsText(rolls)}: each roll is the best of ${fmt(luck)}.` });
  const dropItem = (id, name, drop, rolls, rarity, next) => ({ id, name, kind: 'drop', drop, rolls, rarity, next, desc: `Items drop ${fmt(drop)} times as often for ${rollsText(rolls)}.` });
  // ×10 is the baseline. Items below it are retired: they no longer drop or come from the slot,
  // but any already owned still work and still fuse upwards.
  const ITEMS = [
    luckItem('luck10', 'Charm of Ten', 10, 25, 1, ['luck100', 5]),
    luckItem('luck100', 'Charm of a Hundred', 100, 10, 3, ['luck1k', 5]),
    luckItem('luck1k', 'Charm of a Thousand', 1000, 10, 4, ['luck10k', 5]),
    luckItem('luck10k', 'Charm of Ten Thousand', 1e4, 5, 5, ['luck100k', 5]),
    luckItem('luck100k', 'Charm of a Hundred Thousand', 1e5, 3, 6, ['luck1m', 5]),
    luckItem('luck1m', 'Charm of a Million', 1e6, 3, 7, ['luck10m', 10]),
    luckItem('luck10m', 'Charm of Ten Million', 1e7, 1, 9),
    dropItem('horn', 'Horn of Plenty', 25, 200, 3, ['goose', 5]),
    dropItem('goose', 'Golden Goose', 100, 100, 5, ['goose2', 5]),
    dropItem('goose2', 'Diamond Goose', 1000, 100, 7),
    { id: 'lens', name: 'Multiplier Lens', kind: 'lens', tries: 2, rolls: 30, rarity: 2, desc: 'For 30 rolls the multiplier reel spins twice and keeps the bigger multiplier.' },
    { id: 'prism', name: 'Prism Lens', kind: 'lens', tries: 10, rolls: 30, rarity: 4, desc: 'For 30 rolls the multiplier reel spins ten times and keeps the biggest multiplier.' },
    { id: 'overclock', name: 'Overclock', kind: 'overclock', speedup: 2, minutes: 3, rarity: 2, desc: 'Turbo rolls twice as fast for 3 minutes.' },
    { id: 'overclock2', name: 'Overclock II', kind: 'overclock', speedup: 4, minutes: 3, rarity: 4, desc: 'Turbo rolls four times as fast for 3 minutes.' },
    { ...luckItem('luck2', 'Charm of Two', 2, 50, 0, ['luck5', 5]), retired: true },
    { ...luckItem('luck5', 'Charm of Five', 5, 50, 0, ['luck10', 4]), retired: true },
    { ...dropItem('magnet', 'Magnet', 2, 500, 0, ['map', 5]), retired: true },
    { ...dropItem('map', 'Treasure Map', 5, 500, 0, ['horn', 5]), retired: true },
  ];
  const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
  // Drop chances after a plain roll, by its tier; each row covers its tier and up to the next row.
  // Keyed by the roll's 1 in N rather than tier names, so the economy stays put when tiers move.
  const DROPS = [
    [100, [['luck10', 0.03]]],
    [1e3, [['luck10', 0.15], ['lens', 0.05], ['overclock', 0.02]]],
    [1e4, [['luck10', 0.3], ['lens', 0.15], ['overclock', 0.05], ['horn', 0.03]]],
    [1e5, [['luck10', 0.4], ['luck100', 0.25], ['overclock', 0.2], ['horn', 0.1]]],
    [1e6, [['luck100', 0.5], ['luck1k', 0.1], ['overclock', 0.4], ['horn', 0.2], ['prism', 0.05]]],
    [1e7, [['luck1k', 0.3], ['goose', 0.1], ['prism', 0.2]]],
    [1e8, [['luck10k', 0.2], ['goose', 0.3], ['overclock2', 0.2]]],
    [1e9, [['luck100k', 0.15], ['luck1m', 0.03], ['goose2', 0.1], ['overclock2', 0.3]]],
  ];
  const COIN_FROM = 100; // coins drop from rolls of 1 in 100 or rarer
  const tierOfN = n => ROLL_TIERS[1 + RARITIES.findIndex(r => 1 / n >= r.min)].id;
  // The coin slot: each spin costs one coin and pays out from this table. Chances are whole parts
  // of a billion and add up to exactly one billion. [item, quantity, parts, reel symbol]
  const COIN_CHANCE = 1 / 3;
  const SLOT_UNITS = 1e9;
  const SLOT_PRIZES = [ // every spin wins something
    ['luck10', 1, 400000000, '×10'], // the base prize; every other prize is 1.5× its v2.8.1 chance
    ['luck10', 3, 150000000, '×10'],
    ['lens', 1, 120000000, 'Lens'],
    ['overclock', 1, 90000000, 'OC'],
    ['luck100', 1, 90000000, '×100'],
    ['horn', 1, 60000000, 'Horn'],
    ['luck100', 3, 30000000, '×100'],
    ['prism', 1, 22500000, 'Prism'],
    ['luck1k', 1, 19500000, '×1k'],
    ['overclock2', 1, 15000000, 'OC II'],
    ['goose', 1, 1200000, 'Goose'],
    ['goose', 2, 225000, 'Goose'],
    ['goose', 5, 75000, 'Goose'],
    ['luck10k', 1, 900000, '×10k'],
    ['goose2', 1, 450000, 'Diamond'],
    ['luck100k', 1, 141750, '×100k'],
    ['luck1m', 1, 7500, '×1M'],
    ['luck10m', 1, 750, '×10M'],
  ];
  if (SLOT_PRIZES.reduce((t, p) => t + p[2], 0) !== SLOT_UNITS) throw new Error('slot prize table does not add up');
  // Hard pity: go this many spins without one of these and the next spin pays it out for sure.
  // A natural win resets the count. If several are due at once, the rarest is paid first.
  const SLOT_PITY = { goose: 2000, luck10k: 3000, goose2: 7000, luck100k: 20000, luck1m: 250000, luck10m: 2500000 };
  const PITY_ORDER = Object.keys(SLOT_PITY).sort((a, b) => SLOT_PITY[b] - SLOT_PITY[a]);
  function randInt(n) { // uniform integer in [0, n) from the CSPRNG, without modulo bias
    const buf = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n;
    do crypto.getRandomValues(buf); while (buf[0] >= lim);
    return buf[0] % n;
  }
  function spinOnce() {
    const pity = state.pity;
    for (const id of PITY_ORDER) pity[id] = (pity[id] || 0) + 1;
    const due = PITY_ORDER.find(id => pity[id] >= SLOT_PITY[id]);
    let prize;
    if (due) prize = Object.assign([...SLOT_PRIZES.find(p => p[0] === due)], { pity: true });
    else {
      let u = randInt(SLOT_UNITS);
      prize = SLOT_PRIZES[0];
      for (const p of SLOT_PRIZES) { if (u < p[2]) { prize = p; break; } u -= p[2]; }
    }
    if (prize[0] in SLOT_PITY) pity[prize[0]] = 0;
    return prize;
  }
  const ACH_REWARD = { uncommon: 'luck10', rare: 'luck10', epic: 'lens', legendary: 'luck100', anomaly: 'horn', mythic: 'luck1k', divine: 'luck10k', cosmic: 'luck100k', transcendent: 'luck1m', ethereal: 'luck1m', celestial: 'luck10m', eternal: 'luck10m', infinite: 'luck10m', omega: 'luck10m', absolute: 'luck10m', primordial: 'luck10m', unfathomable: 'luck10m', c25: 'horn', c60: 'goose', c100: 'goose2', call: 'luck10m', slot100: 'prism' };
  function grant(id, why, count = 1) {
    state.inv[id] = (state.inv[id] || 0) + count;
    const it = ITEM_BY_ID[id];
    toast(`${esc(why)}: <b>${esc(it.name)}</b>${count > 1 ? ` ×${fmt(count)}` : ''}`, RARITIES[it.rarity].id);
    if (!$('tab-inventory').hidden) renderInventory();
  }
  // A drop booster multiplies each chance; past 100% the whole part drops for sure and the rest is a chance at one more.
  function rollDrops(oneInLog) {
    const fx = state.effects, boost = fx.drop && fx.drop.left > 0 ? fx.drop.D : 1;
    if (boost > 1) fx.drop.left--;
    const D = boost * prestigeBonus(), n = 10 ** oneInLog;
    if (n >= COIN_FROM) { // a 1 in 3 chance of a coin for the slot machine, boosted like any other drop
      const c = COIN_CHANCE * D, k = Math.floor(c) + (Math.random() < c % 1 ? 1 : 0);
      if (k) {
        state.coins += k;
        questEvent('coin', k);
        toast(`Coin found${k > 1 ? `: <b>×${fmt(k)}</b>` : ''}, ${fmt(state.coins)} in hand`, 'mythic');
        if (!$('tab-inventory').hidden) renderSlot();
      }
    }
    const row = [...DROPS].reverse().find(([from]) => n >= from);
    if (!row) return;
    for (const [id, chance] of row[1]) {
      const c = chance * D, k = Math.floor(c) + (Math.random() < c % 1 ? 1 : 0);
      if (k) grant(id, 'Item found', k);
    }
  }
  const luckActive = () => (state.effects.luck && state.effects.luck.left > 0 ? state.effects.luck.L : 1);
  const dropActive = () => (state.effects.drop && state.effects.drop.left > 0 ? state.effects.drop.D : 1);
  // Multiplier spins per roll: 10 with the Prism Lens, 2 with the Multiplier Lens, else 1.
  const lensActive = () => ((state.effects.prism || 0) > 0 ? 10 : (state.effects.lens || 0) > 0 ? 2 : 1);
  const overclockLeft = () => Math.max(0, (state.effects.overclock || 0) - Date.now());
  const overclock2Left = () => Math.max(0, (state.effects.overclock2 || 0) - Date.now());
  const turboSpeedup = () => (overclock2Left() ? 4 : overclockLeft() ? 2 : 1);
  function useItem(id) {
    const it = ITEM_BY_ID[id], fx = state.effects;
    if (!(state.inv[id] > 0)) return;
    if (it.kind === 'luck' || it.kind === 'drop') {
      const slot = it.kind, power = it.kind === 'luck' ? it.luck : it.drop, key = it.kind === 'luck' ? 'L' : 'D';
      const word = it.kind === 'luck' ? 'Luck' : 'Drops';
      const cur = fx[slot] && fx[slot].left > 0 ? fx[slot] : null;
      if (cur && cur[key] > power) { $('invMsg').textContent = `${word} ×${fmt(cur[key])} is still active, so ${it.name} would do nothing yet.`; return; }
      if (cur && cur[key] < power && !confirm(`${word} ×${fmt(cur[key])} has ${rollsText(cur.left)} left. Replace it with ×${fmt(power)}?`)) return;
      fx[slot] = cur && cur[key] === power ? { [key]: power, left: cur.left + it.rolls } : { [key]: power, left: it.rolls };
    }
    if (it.kind === 'lens') fx[it.id] = (fx[it.id] || 0) + it.rolls;
    if (it.kind === 'overclock') fx[it.id] = Math.max(Date.now(), fx[it.id] || 0) + it.minutes * 60000;
    state.inv[id]--;
    $('invMsg').textContent = `Used ${it.name}.`;
    save();
    renderInventory();
    paintStatus();
  }
  function effectsText() {
    const out = [];
    if (luckActive() > 1) out.push(`Luck ×${fmt(state.effects.luck.L)}, ${rollsText(state.effects.luck.left)} left`);
    if (dropActive() > 1) out.push(`Drops ×${fmt(state.effects.drop.D)}, ${rollsText(state.effects.drop.left)} left`);
    if ((state.effects.prism || 0) > 0) out.push(`Prism Lens, ${rollsText(state.effects.prism)} left`);
    if ((state.effects.lens || 0) > 0) out.push(`Multiplier Lens, ${rollsText(state.effects.lens)} left`);
    const clock = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
    if (overclock2Left()) out.push(`Overclock II, ${clock(overclock2Left())} left`);
    if (overclockLeft()) out.push(`Overclock, ${clock(overclockLeft())} left`);
    return out;
  }
  function renderInventory() {
    const fx = effectsText();
    $('effects').innerHTML = fx.length ? fx.map(t => `<li>${esc(t)}</li>`).join('') : '<li class="muted">Nothing active. Use an item below.</li>';
    const total = ITEMS.reduce((t, i) => t + (state.inv[i.id] || 0), 0);
    $('invCount').textContent = `${fmt(total)} ${total === 1 ? 'item' : 'items'}`;
    $('invList').innerHTML = ITEMS.filter(it => !it.retired || state.inv[it.id] > 0).map(it => {
      const k = state.inv[it.id] || 0;
      if (it.retired && !it.desc.includes('Retired')) it.desc += ' Retired: it no longer drops or comes from the slot, but it still works and fuses upwards.';
      const fuse = it.next ? `<button class="btn" type="button" data-fuse="${it.id}" ${k >= it.next[1] ? '' : 'disabled'} aria-label="Fuse ${it.next[1]} ${esc(it.name)} into one ${esc(ITEM_BY_ID[it.next[0]].name)}">Fuse ${it.next[1]} → 1</button>` : '';
      return `<li class="item${k ? '' : ' none'}" style="--rc:${tierVar(RARITIES[it.rarity].id)}"><div><b>${esc(it.name)}</b> <span class="muted num">×${fmt(k)}</span><br><span class="muted">${esc(it.desc)}${it.next ? ` Fuse ${it.next[1]} into a ${esc(ITEM_BY_ID[it.next[0]].name)}.` : ''}</span></div>`
        + `<div class="item-actions">${fuse}<button class="btn" type="button" data-use="${it.id}" ${k ? '' : 'disabled'} aria-label="Use ${esc(it.name)}">Use</button></div></li>`;
    }).join('');
    const last = DROPS.length - 1;
    const rowHead = (n, all) => `<td style="color:${tierVar(tierOfN(n))};font-weight:700">1/${fmt(n)}${all ? ' or rarer' : ''}</td>`;
    $('dropTable').innerHTML = `<tr>${rowHead(COIN_FROM, true)}<td>A coin for the slot machine, 1 in ${Math.round(1 / COIN_CHANCE)}</td></tr>`
      + DROPS.map(([from, items], r) => `<tr>${rowHead(from, r === last)}<td>${items.map(([id, c]) => `${esc(ITEM_BY_ID[id].name)} ${+(c * 100).toFixed(1)}%`).join(', ')}</td></tr>`).join('')
      + (prestigeBonus() > 1 ? `<tr><td colspan="2" class="muted">Your prestige multiplies every chance above by ${prestigeBonus()}.</td></tr>` : '');
  }
  // The slot uses the same reels as the game: three matching symbols name the prize.
  const slotReels = [0, 1, 2].map(() => {
    const r = document.createElement('div');
    r.className = 'reel slot-reel lead';
    r.innerHTML = '<div class="strip"><div>?</div></div>';
    $('slotReels').appendChild(r);
    return r;
  });
  const SLOT_FACES = [...new Set(SLOT_PRIZES.filter(p => p[0]).map(p => p[3]))];
  const slotFace = () => SLOT_FACES[randInt(SLOT_FACES.length)];
  let slotBusy = false;
  async function spinSlot(n) {
    if (n === 'all') n = state.coins;
    if (slotBusy || n < 1 || state.coins < n) return;
    slotBusy = true;
    state.coins -= n;
    state.spins += n;
    const results = Array.from({ length: n }, spinOnce);
    questEvent('spin', n);
    for (const [id, qty] of results) if (id) state.inv[id] = (state.inv[id] || 0) + qty;
    checkAchievements();
    save();
    renderSlot();
    // Show the best prize of the batch on the reels as three matching symbols.
    const best = results.reduce((a, b) => (b[2] < a[2] ? b : a));
    const faces = [best[3], best[3], best[3]];
    const color = tierVar(RARITIES[ITEM_BY_ID[best[0]].rarity].id);
    if (effects() === 'off') slotReels.forEach((r, i) => setReel(r, faces[i], false));
    else await Promise.all(slotReels.map((r, i) => spinReel(r, faces[i], 500 + i * 220, 14 + i * 4, false, slotFace, () => tick(i))));
    slotReels.forEach(r => { r.style.setProperty('--tc', color); r.classList.toggle('hit', ITEM_BY_ID[best[0]].rarity >= 5); });
    const won = results;
    const prizeText = p => `${ITEM_BY_ID[p[0]].name}${p[1] > 1 ? ` ×${p[1]}` : ''}${p.pity ? ' (pity)' : ''}`;
    const colored = (id, text) => `<b style="color:${tierVar(RARITIES[ITEM_BY_ID[id].rarity].id)}">${esc(text)}</b>`;
    if (n <= 5) {
      $('slotResult').innerHTML = (n > 1 ? results.map((p, k) => `<li>Spin ${k + 1}: ${colored(p[0], prizeText(p))}</li>`).join('') : '')
        + `<li><b>Won ${won.map(prizeText).map(esc).join(', ')}</b></li>`;
    } else { // bigger batches: totals per item, rarest first
      const totals = new Map(), pityWins = results.filter(p => p.pity).length;
      for (const [id, qty] of results) totals.set(id, (totals.get(id) || 0) + qty);
      const rows = [...totals].sort((a, b) => ITEM_BY_ID[b[0]].rarity - ITEM_BY_ID[a[0]].rarity);
      $('slotResult').innerHTML = `<li><b>${fmt(n)} spins won:</b></li>`
        + `<li>${rows.map(([id, k]) => colored(id, `${ITEM_BY_ID[id].name} ×${fmt(k)}`)).join(', ')}</li>`
        + (pityWins ? `<li class="muted">${pityWins} of them paid out by pity</li>` : '');
    }
    const jackpot = won.filter(p => ITEM_BY_ID[p[0]].rarity >= 5).sort((a, b) => ITEM_BY_ID[b[0]].rarity - ITEM_BY_ID[a[0]].rarity)[0];
    if (jackpot) {
      toast(`Jackpot: <b>${esc(prizeText(jackpot))}</b>`, RARITIES[ITEM_BY_ID[jackpot[0]].rarity].id);
      if (effects() === 'full') burst(cssVar(`--r-${RARITIES[ITEM_BY_ID[jackpot[0]].rarity].id}`), 200, 14);
      fanfare(8);
    } else fanfare(Math.min(6, 2 + won.length));
    slotBusy = false;
    renderSlot();
    if (!$('tab-inventory').hidden) renderInventory();
  }
  const pctText = units => `${+(100 * units / SLOT_UNITS).toPrecision(3)}%`;
  function renderSlot() {
    const coins = `${fmt(state.coins)} ${state.coins === 1 ? 'coin' : 'coins'}`;
    $('coinCount').textContent = coins;
    $('coinsInHand').textContent = fmt(state.coins);
    document.querySelectorAll('[data-spin]').forEach(b => { b.disabled = slotBusy || state.coins < (b.dataset.spin === 'all' ? 1 : +b.dataset.spin); });
    $('spinAll').textContent = state.coins > 0 ? `Spin all (${fmt(state.coins)})` : 'Spin all';
    const seen = new Set();
    $('slotOdds').innerHTML = SLOT_PRIZES.map(([id, qty, units]) => {
      const name = `<span style="color:${tierVar(RARITIES[ITEM_BY_ID[id].rarity].id)};font-weight:700">${esc(ITEM_BY_ID[id].name)}</span>${qty > 1 ? ` ×${qty}` : ''}`;
      let pity = '';
      if (id in SLOT_PITY && !seen.has(id)) {
        seen.add(id);
        const so = state.pity[id] || 0, cap = SLOT_PITY[id];
        pity = `<span class="pity"><span class="pity-bar"><i style="width:${(100 * so / cap).toFixed(2)}%"></i></span><span class="num">${fmt(so)} / ${fmt(cap)}</span></span>`;
      }
      return `<tr><td>${name}</td><td class="num">${pctText(units)}</td><td class="num">${odds(units / SLOT_UNITS)}</td><td>${pity}</td></tr>`;
    }).join('');
  }
  $('slotButtons').addEventListener('click', ev => {
    const b = ev.target.closest('[data-spin]');
    if (b) spinSlot(b.dataset.spin === 'all' ? 'all' : +b.dataset.spin);
  });

  function fuseItem(id) {
    const it = ITEM_BY_ID[id];
    if (!it.next || (state.inv[id] || 0) < it.next[1]) return;
    state.inv[id] -= it.next[1];
    grant(it.next[0], `Fused ${it.next[1]} ${it.name}`);
    save();
    renderInventory();
  }

  // Luck: keep the best of L independent rolls. Up to INLINE_LUCK that runs right here; beyond it
  // the work is shared out to worker threads (a million rolls takes a few seconds), with progress.
  const INLINE_LUCK = 2000;
  function pickInline(mode, L, lens, t) {
    let pick = null;
    for (let k = 0; k < L; k++) {
      const roll = G.randomParams(mode), n = G.randomRoll();
      for (let j = 1; j < lens; j++) { const alt = G.randomParams(mode).mult; if (MULT_BY_ID[alt].log > MULT_BY_ID[roll.mult].log) roll.mult = alt; }
      const rank = L > 1 ? G.score(n, dayKey(t), roll).rank : 0;
      if (!pick || rank > pick.rank) pick = { roll, n, rank };
    }
    return pick;
  }
  let pool = null, jobSeq = 0, heavy = null;
  function workerPool() {
    if (pool) return pool;
    pool = [];
    if (location.protocol.startsWith('http') && 'Worker' in window) {
      const k = Math.min(8, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
      try { for (let i = 0; i < k; i++) pool.push(new Worker('worker.js')); } catch { pool = []; }
    }
    return pool;
  }
  function inWorker(w, msg) {
    return new Promise((resolve, reject) => {
      const onMsg = ({ data }) => {
        if (data.id !== msg.id) return;
        if (data.progress) { heavy.done += data.progress; paintStatus(); }
        if (data.best) { w.removeEventListener('message', onMsg); resolve(data.best); }
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', reject, { once: true });
      w.postMessage(msg);
    });
  }
  async function pickRoll(mode, L, lens, t) {
    if (L <= INLINE_LUCK) return pickInline(mode, L, lens, t);
    heavy = { L, done: 0 };
    paintStatus();
    let best = null;
    try {
      const ws = workerPool();
      if (!ws.length) throw new Error('no workers');
      const per = Math.ceil(L / ws.length), id = ++jobSeq, date = dayKey(t);
      const parts = await Promise.all(ws.map((w, i) => {
        const count = Math.min(per, L - i * per);
        return count > 0 ? inWorker(w, { id, mode, count, date, lens }) : null;
      }));
      for (const p of parts) if (p && (!best || p.rank > best.rank)) best = p;
    } catch {
      // No workers (the game opened as a file): run in slices on the page, still with progress.
      for (let done = 0; done < L;) {
        const k = Math.min(10000, L - done), p = pickInline(mode, k, lens, t);
        if (!best || p.rank > best.rank) best = p;
        done += k;
        heavy.done = done;
        paintStatus();
        await sleep(0);
      }
    }
    heavy = null;
    return best;
  }
  // One roll's bookkeeping, with no drawing, so Turbo can take several per screen frame.
  const takeRoll = () => { const t = Date.now(); return commitRoll(pickInline(state.mode, luckActive(), lensActive(), t), state.mode, luckActive(), lensActive(), t); };
  async function takeRollAsync() {
    const mode = state.mode, L = luckActive(), lens = lensActive(), t = Date.now();
    return commitRoll(await pickRoll(mode, L, lens, t), mode, L, lens, t);
  }
  function commitRoll(pick, mode, L, lens, t) {
    const { roll, n } = pick;
    const x = { n, t, mode, x: roll.mult };
    if (roll.e) x.e = roll.e;
    if (roll.m) x.m = roll.m;
    if (roll.t !== undefined) x.tg = roll.t;
    if (L > 1) { x.b = L; state.effects.luck.left = Math.max(0, state.effects.luck.left - 1); }
    if (lens > 1) {
      x.lens = lens;
      const which = lens === 10 ? 'prism' : 'lens';
      state.effects[which] = Math.max(0, state.effects[which] - 1);
    }
    const rec = record(x);
    if (!x.b && !x.lens) rollDrops(rec.entry.oneInLog); // boosted rolls never drop items, so boosts cannot feed themselves
    save();
    run.rolls++;
    for (const b of rec.r.badges) if (rec.fresh.has(b.id)) toast(`New badge: <b>${esc(b.name)}</b> (${RARITIES[b.rarity].name})`, RARITIES[b.rarity].id);
    if (rec.freshMult) toast(`New multiplier: <b>× ${esc(rec.r.mult.symbol)} ${esc(rec.r.mult.name)}</b>`, RARITIES[rec.r.mult.rarity].id);
    let found = false;
    if (hunt) {
      huntRolls++;
      found = hunt.startsWith('x:') ? rec.r.mult.id === hunt.slice(2) : rec.r.badges.some(b => b.id === hunt);
      if (found) {
        toast(`Found <b>${esc(huntName(hunt))}</b> after ${fmt(huntRolls)} ${huntRolls === 1 ? 'roll' : 'rolls'}`, 'rare');
        state.huntsDone++;
        state.lastHuntP = huntP(hunt);
        huntRolls = 0;
      }
    }
    questEvent('roll');
    questEvent('mode', 1, q => q.mode === x.mode);
    questEvent('tier', 1, q => T(rec.entry.tier) >= T(q.tier));
    if (rec.fresh.size) questEvent('fresh');
    if (rec.r.mult.id !== 'unity' && rec.r.mult.rarity >= 2) questEvent('mult');
    checkAchievements(rec);
    if (consoleOn()) consoleRoll(rec.entry);
    return { x, rec, found };
  }
  // In Turbo the result changes many times a second and its height with it (more or fewer badges),
  // which made everything below it jump. While auto-rolling, the result area may grow but never
  // shrink, so it settles at its tallest and holds still; it relaxes when rolling stops.
  let heldHeight = 0;
  function holdResultHeight() {
    const el = $('result'), h = el.offsetHeight;
    if (h > heldHeight) { heldHeight = h; el.style.minHeight = h + 'px'; }
  }
  function releaseResultHeight() { heldHeight = 0; $('result').style.minHeight = ''; }
  function drawRoll({ x, rec }, sp, boardsChanged) {
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    showResult(x, { animate: true, speed: sp, fresh: rec.fresh, pre: rec });
    if (auto && sp === 3) holdResultHeight();
    celebrate(rec.tier.id, sp);
    renderBoards(boardsChanged);
    paintStatus();
  }
  async function rollOnce() {
    const roll = await takeRollAsync();
    if (speed !== 3) $('result').hidden = true;
    await spinTo(roll.x, consoleOn() ? 3 : speed); // the Console shows no reels, so nothing to wait for
    freshEntry = roll.rec.madeSession || roll.rec.madeHof ? roll.rec.entry : null;
    drawRoll(roll, speed, !!freshEntry);
    return { tier: roll.rec.tier, found: roll.found };
  }

  // Turbo: rolls run on their own steady clock (90 to 1,000 a second, set under Auto settings) in small slices that never block the
  // page for more than a few milliseconds. Drawing happens at most once per screen frame and shows
  // the rarest roll since the last frame, so a Mythic is never skipped over. A hidden tab or a
  // throttled screen slows the drawing, never the rolling.
  const TURBO_RATES = [90, 250, 500, 1000]; // rolls per second
  const turboRate = () => (TURBO_RATES.includes(state.settings.turboRate) ? state.settings.turboRate : 90);
  async function turboLoop(kind) {
    let last = performance.now(), owed = 0, best = null, changed = false, framePending = false, statusAt = 0;
    const draw = () => {
      framePending = false;
      if (best && !document.hidden) { drawRoll(best, 3, changed); best = null; changed = false; }
    };
    while (auto === kind && speed === 3 && ready[state.mode]) {
      if (luckActive() > INLINE_LUCK) { // huge luck: one roll at a time, each shared out to the workers
        const roll = await takeRollAsync();
        freshEntry = roll.rec.madeSession || roll.rec.madeHof ? roll.rec.entry : null;
        drawRoll(roll, 3, !!freshEntry);
        if (kind === 'auto' && (roll.found || T(roll.rec.tier.id) >= +$('stopAt').value)) { setAuto(null); return; }
        last = performance.now();
        continue;
      }
      await sleep(15);
      const now = performance.now();
      const rate = turboRate() * turboSpeedup();
      owed = Math.min(owed + ((now - last) / 1000) * rate, rate); // at most a second of catch-up
      // Small slices keep the page smooth; when the browser throttles timers (a hidden tab), ticks
      // come late, so take a bigger slice, still under the 50 ms that feels like lag.
      // Faster rates get a bigger slice of each tick.
      const budget = now - last > 100 ? 40 : rate > 300 ? 10 : 6;
      last = now;
      let stop = false;
      const start = performance.now();
      while (owed >= 1 && performance.now() - start < budget && auto === kind) {
        owed--;
        const roll = takeRoll();
        if (roll.rec.madeSession || roll.rec.madeHof) { changed = true; freshEntry = roll.rec.entry; }
        if (!best || roll.rec.entry.oneInLog > best.rec.entry.oneInLog) best = roll;
        if (kind === 'auto' && (roll.found || T(roll.rec.tier.id) >= +$('stopAt').value)) { best = roll; stop = true; break; }
      }
      if (stop) { draw(); setAuto(null); return; }
      if (best && !framePending) { framePending = true; requestAnimationFrame(draw); }
      if (now - statusAt > 250 && !document.hidden) { statusAt = now; paintStatus(); } // counters stay current even when frames are slow
    }
  }

  function paintStatus() {
    const parts = [];
    if (heavy) parts.push(`<b>Rolling with luck ×${fmt(heavy.L)}:</b> <span class="num">${Math.min(99, Math.floor((100 * heavy.done) / heavy.L))}%</span>`);
    if (session.rolls) {
      const best = session.best[state.mode][0];
      parts.push(`This session: <b class="num">${fmt(session.rolls)}</b> ${session.rolls === 1 ? 'roll' : 'rolls'}`
        + (best ? `, best <b style="color:${tierVar(best.tier)}">${ROLL_TIERS[T(best.tier)].name}</b>` : ''));
    }
    if (auto === 'endless') {
      const secs = (performance.now() - run.start) / 1000;
      parts.push(`Endless keeps rolling until you press Stop${secs > 3 ? `, about ${fmt(run.rolls / secs)} rolls a second` : ''}`);
    }
    if (hunt) parts.push(`Hunting <b>${esc(huntName(hunt))}</b> (${odds(huntP(hunt))}), <span class="num">${fmt(huntRolls)}</span> rolls so far`);
    const fx = effectsText();
    if (fx.length) parts.push(`<b>Active:</b> ${esc(fx.join(' · '))}`);
    $('status').innerHTML = parts.join('<br>');
  }

  async function rollClicked() {
    if (auto) { setAuto(null); return; }
    if (busy || !ready[state.mode]) return;
    busy = true;
    paintRollButton();
    await rollOnce();
    busy = false;
    paintRollButton();
  }
  $('rollBtn').addEventListener('click', rollClicked);
  function setAuto(kind) {
    if (kind !== auto) { run.start = performance.now(); run.rolls = 0; }
    auto = kind;
    if (!kind) releaseResultHeight();
    if (!kind && saveTimer) writeSave();
    $('autoBtn').setAttribute('aria-pressed', String(kind === 'auto'));
    $('endlessBtn').setAttribute('aria-pressed', String(kind === 'endless'));
    paintRollButton();
    paintStatus();
    if (kind && !busy) autoLoop();
  }
  async function autoLoop() {
    busy = true;
    while (auto) {
      if (!ready[state.mode]) { await warm(state.mode); continue; }
      const kind = auto;
      if (speed === 3) { await turboLoop(kind); continue; }
      const { tier, found } = await rollOnce();
      if (kind === 'auto' && auto === 'auto' && (found || T(tier.id) >= +$('stopAt').value)) { setAuto(null); break; }
      await sleep(speed === 1 ? 300 : 60);
    }
    busy = false;
    paintRollButton();
  }
  $('autoBtn').addEventListener('click', () => setAuto(auto === 'auto' ? null : 'auto'));
  $('endlessBtn').addEventListener('click', () => setAuto(auto === 'endless' ? null : 'endless'));
  $('speed').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    speed = +b.dataset.speed;
    $('speed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  });
  $('optsBtn').addEventListener('click', () => {
    const open = $('opts').hidden;
    $('opts').hidden = !open;
    $('optsBtn').setAttribute('aria-expanded', String(open));
  });
  ROLL_TIERS.slice(3).forEach(t => $('stopAt').appendChild(new Option(`${t.name} or better`, String(T(t.id)))));
  $('stopAt').appendChild(new Option('Never', '99'));
  $('stopAt').value = String(T('legendary'));
  $('turboRate').value = String(turboRate());
  $('turboRate').addEventListener('change', () => { state.settings.turboRate = +$('turboRate').value; save(); });

  function paintRollButton() {
    const btn = $('rollBtn');
    if (auto) { btn.textContent = 'Stop'; btn.disabled = false; return; }
    btn.textContent = ready[state.mode] ? 'Roll' : 'Loading odds…';
    btn.disabled = !ready[state.mode] || busy;
  }

  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || $('tab-roll').hidden || document.querySelector('dialog[open]')) return;
    const t = ev.target.closest ? ev.target : document.body;
    if (t.closest('input, select, textarea')) return;
    if (ev.code === 'Space') {
      if (t.closest('button, a')) return; // the focused control handles Space itself
      ev.preventDefault();
      rollClicked();
    }
    if (ev.code === 'KeyA') setAuto(auto === 'auto' ? null : 'auto');
    if (ev.code === 'KeyE') setAuto(auto === 'endless' ? null : 'endless');
  });

  // Modes
  const ready = perMode(() => false);
  const warming = {};
  function warm(mode) {
    if (!warming[mode]) {
      warming[mode] = G.warmUp(mode).then(() => { ready[mode] = true; paintRollButton(); })
        .catch(err => { $('status').textContent = `The odds could not be prepared (${err.message}). Reload the page to try again.`; });
    }
    return warming[mode];
  }
  for (const m of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = m.id;
    b.textContent = m.name;
    $('modeSeg').appendChild(b);
  }
  function setMode(mode) {
    state.mode = mode;
    $('modeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('modeDesc').textContent = MODE_BY_ID[mode].desc;
    $('expWrap').hidden = mode !== 'exp';
    fillHunt();
    warm(mode);
    paintRollButton();
    renderBoards();
    paintStatus();
    save();
  }
  $('modeSeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) setMode(b.dataset.mode); });

  function fillHunt() {
    const sel = $('hunt'), keep = hunt;
    sel.replaceChildren(new Option('Nothing', ''));
    for (const cat of CATEGORIES) {
      if (cat === 'Daily') continue;
      const list = allBadges().filter(b => b.cat === cat && (!b.mode || b.mode === state.mode));
      if (!list.length) continue;
      const og = document.createElement('optgroup');
      og.label = cat;
      for (const b of list.sort((a, c) => c.p - a.p)) og.appendChild(new Option(`${b.name} (${odds(b.p)})`, b.id));
      sel.appendChild(og);
    }
    const og = document.createElement('optgroup');
    og.label = 'Multipliers';
    for (const m of MULTS) og.appendChild(new Option(`× ${m.symbol} ${m.name} (${odds(m.p)})`, 'x:' + m.id));
    sel.appendChild(og);
    setHunt([...sel.options].some(o => o.value === keep) ? keep : '');
  }
  function setHunt(id) {
    if (id !== hunt) huntRolls = 0;
    hunt = id;
    $('hunt').value = id;
    if (id) { $('opts').hidden = false; $('optsBtn').setAttribute('aria-expanded', 'true'); }
    paintStatus();
  }
  $('hunt').addEventListener('change', () => setHunt($('hunt').value));

  // Previews from the URL: #n=1729&mode=exp&e=3&x=pi (and the older #1729^3).
  function fromHash() {
    const h = location.hash.slice(1);
    if (!h) return;
    let x;
    const old = h.match(/^(\d{1,10})(?:\^(\d{1,2}))?$/);
    if (old) x = { n: +old[1], mode: old[2] ? 'exp' : 'classic', e: old[2] ? +old[2] : undefined, x: 'unity' };
    else {
      const q = new URLSearchParams(h), n = Number(q.get('n'));
      if (!Number.isInteger(n) || n < 0 || n >= G.SPACE) return;
      const mode = MODE_BY_ID[q.get('mode')] ? q.get('mode') : 'classic';
      x = { n, mode, x: MULT_BY_ID[q.get('x')] ? q.get('x') : 'unity' };
      if (mode === 'exp') x.e = Math.min(G.E_MAX, Math.max(1, +q.get('e') || 1));
      if (mode === 'mod') x.m = Math.min(G.M_HI, Math.max(G.M_LO, +q.get('m') || G.M_LO));
      if (mode === 'target') x.tg = Math.min(G.SPACE - 1, Math.max(0, +q.get('t') || 0));
    }
    x.t = Date.now();
    if (state.mode !== x.mode) setMode(x.mode);
    if (!ready[x.mode]) { warm(x.mode).then(fromHash); return; }
    setReels(x);
    const tier = showResult(x, { preview: true });
    celebrate(tier.id, 3);
    selectTab('roll');
  }
  addEventListener('hashchange', fromHash);
  $('checkForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const raw = $('checkInput').value.replace(/[\s,_]/g, '');
    const m = raw.match(/^(\d{1,10})(?:\^(\d{1,2}))?$/);
    if (!m) {
      $('checkInput').setCustomValidity('Enter a whole number from 0 to 9,999,999,999, optionally with ^ and an exponent, like 1729^3');
      $('checkInput').reportValidity();
      return;
    }
    const x = { n: +m[1], mode: m[2] ? 'exp' : state.mode === 'exp' ? 'classic' : state.mode, x: 'unity' };
    if (m[2]) x.e = +m[2];
    if (x.mode === 'mod') x.m = 7;
    if (x.mode === 'target') x.tg = 0;
    const hash = hashOf(x);
    if (location.hash === hash) fromHash(); else location.hash = hash;
  });
  $('checkInput').addEventListener('input', () => $('checkInput').setCustomValidity(''));

  // Achievements
  const collectable = () => BADGES.concat(modeBadges());
  const collected = () => collectable().filter(b => state.counts[b.id]).length;
  const multsFound = () => MULTS.filter(m => state.mults[m.id]).length;
  const reached = id => MODE_IDS.some(mode => ROLL_TIERS.slice(T(id)).some(t => state.tiers[mode][t.id]));
  const ACHIEVEMENTS = [
    { id: 'first', name: 'First roll', desc: 'Roll once', test: () => state.total >= 1 },
    { id: 'r100', name: 'Warming up', desc: 'Roll 100 times', test: () => state.total >= 100 },
    { id: 'r1k', name: 'Thousandaire', desc: 'Roll 1,000 times', test: () => state.total >= 1000 },
    { id: 'r10k', name: 'Ten thousand club', desc: 'Roll 10,000 times', test: () => state.total >= 1e4 },
    { id: 'r100k', name: 'Six figures', desc: 'Roll 100,000 times', test: () => state.total >= 1e5 },
    ...[['uncommon', 'Off the beaten path'], ['rare', 'Shiny'], ['epic', 'Epic moment'], ['legendary', 'The stuff of legend'],
      ['anomaly', 'Anomaly detected'], ['mythic', 'Myth made real'], ['divine', 'Divine intervention'], ['cosmic', 'Cosmic'],
      ['transcendent', 'Beyond'], ['ethereal', 'Ethereal'], ['celestial', 'Written in the stars'], ['eternal', 'Forever'],
      ['infinite', 'To infinity'], ['omega', 'The last letter'], ['absolute', 'Absolute unit'], ['primordial', 'Before time'], ['unfathomable', 'Unfathomable']]
      .map(([id, name]) => {
        const r = RARITIES.find(x => x.id === id);
        return { id, name, desc: `Roll 1/${fmt(r.from)} or rarer (${r.name})`, test: () => reached(id) };
      }),
    { id: 'trash', name: 'Bottom of the barrel', desc: 'Roll Trash, the bottom 1%', test: () => MODE_IDS.some(m => state.tiers[m].trash) },
    { id: 'none', name: 'Just a number', desc: 'Roll a number with no badges', test: rec => rec && rec.r.badges.length === 0 },
    { id: 'pile', name: 'Badge pile', desc: 'Earn 8 or more badges on one roll', test: rec => rec && rec.r.badges.length >= 8 },
    { id: 'c25', name: 'Collector', desc: 'Collect 25 different badges', test: () => collected() >= 25 },
    { id: 'c60', name: 'Curator', desc: 'Collect 60 different badges', test: () => collected() >= 60 },
    { id: 'c100', name: 'Archivist', desc: 'Collect 100 different badges', test: () => collected() >= 100 },
    { id: 'call', name: 'Every last one', desc: 'Collect every badge', test: () => collected() === collectable().length },
    { id: 'm1', name: 'Multiplied', desc: 'Land any multiplier', test: () => multsFound() >= 1 },
    { id: 'm25', name: 'Constant companion', desc: 'Land 25 different multipliers', test: () => multsFound() >= 25 },
    { id: 'm50', name: 'Half the table', desc: 'Land 50 different multipliers', test: () => multsFound() >= 50 },
    { id: 'mEpic', name: 'Big constant', desc: 'Land an Epic or rarer multiplier', test: rec => rec && rec.r.mult.id !== 'unity' && rec.r.mult.rarity >= 3 },
    { id: 'modes', name: 'Mathematician', desc: 'Roll at least once in every mode', test: () => MODE_IDS.every(m => state.totals[m] > 0) },
    { id: 'clean', name: 'Clean break', desc: 'Get a Clean Divide in Modulo mode', test: () => state.counts.modClean || state.counts.modBig },
    { id: 'close', name: 'Close call', desc: 'Land within 1,000,000 of the target', test: () => state.counts.t1m || state.counts.t1k || state.counts.t10 || state.counts.tBull },
    { id: 'desert', name: 'Desert walker', desc: 'Land at least 50 away from every prime', test: () => state.counts.radar50 || state.counts.radar100 },
    { id: 'googol', name: 'Off the charts', desc: 'Earn Googol in Exponent mode', test: () => state.counts.googol || state.counts.bigbang },
    { id: 'hunt', name: 'Found it', desc: 'Finish a hunt', test: () => state.huntsDone >= 1 },
    { id: 'hunthard', name: 'Needle in a haystack', desc: 'Finish a hunt for something rarer than 1 in 10,000', test: () => state.lastHuntP !== undefined && state.lastHuntP < 1e-4 },
    { id: 'star', name: 'Keeper', desc: 'Star a roll', test: () => state.favs.length >= 1 },
    { id: 'share', name: 'Show and tell', desc: 'Copy or save a roll to share', test: () => state.shares >= 1 },
    { id: 'marathon', name: 'Marathon', desc: 'Roll 1,000 times in one session', test: () => session.rolls >= 1000 },
    { id: 'owl', name: 'Night owl', desc: 'Roll between 2 and 4 a.m.', test: rec => rec && [2, 3].includes(new Date(rec.entry.t).getHours()) },
    { id: 'slot', name: 'Pull the lever', desc: 'Spin the coin slot', test: () => state.spins >= 1 },
    { id: 'slot100', name: 'Slot regular', desc: 'Spin the coin slot 100 times', test: () => state.spins >= 100 },
  ];
  function checkAchievements(rec) {
    for (const a of ACHIEVEMENTS) {
      if (state.ach[a.id] || !a.test(rec)) continue;
      state.ach[a.id] = Date.now();
      toast(`Achievement: <b>${esc(a.name)}</b>`, 'rare');
      grant(ACH_REWARD[a.id] || 'luck10', 'Achievement reward');
    }
  }

  // Trophies
  for (const m of MODES) $('hofMode').appendChild(new Option(m.name, m.id));
  function rowHtml(x, removable) {
    const tier = ROLL_TIERS[T(x.tier)];
    const tag = `${MODE_BY_ID[x.mode].name}${x.x && x.x !== 'unity' ? ` × ${MULT_BY_ID[x.x].symbol}` : ''}${x.b ? `, luck ×${fmt(x.b)}` : ''}`;
    return `<li style="--tc:${tierVar(x.tier)}"><a class="num" href="${hashOf(x)}">${esc(label(x))}</a><span class="t">${tier.name} <span class="tag">${esc(tag)}</span></span>`
      + (removable ? `<button class="btn x" type="button" data-unstar="${x.n},${x.t}" aria-label="Unstar ${esc(label(x))}">Unstar</button>`
        : `<span class="e num">${esc(oneText(x))}</span>`) + '</li>';
  }
  function renderTrophies() {
    const got = ACHIEVEMENTS.filter(a => state.ach[a.id]).length;
    $('achCount').textContent = `${got} of ${ACHIEVEMENTS.length}`;
    $('achList').innerHTML = ACHIEVEMENTS.map(a => {
      const when = state.ach[a.id];
      return `<li class="${when ? 'got' : ''}"><span class="tick" aria-hidden="true">${when ? '✓' : ''}</span><b>${esc(a.name)}</b><span>${esc(a.desc)}${when ? ` <span class="when">· ${new Date(when).toLocaleDateString()}</span>` : ''}</span></li>`;
    }).join('');
    const mode = $('hofMode').value;
    const hof = state.hof[mode];
    $('hofList').innerHTML = hof.length ? hof.map(x => rowHtml(x, false)).join('')
      : `<li class="empty-state">No ${esc(MODE_BY_ID[mode].name)} rolls yet. Your ten best stay here even after the log moves on.</li>`;
    $('favCount').textContent = state.favs.length ? `${state.favs.length}` : '';
    $('favList').innerHTML = state.favs.length ? state.favs.map(f => rowHtml(entryFor(f), true)).join('')
      : '<li class="empty-state">Star a roll on the Roll tab to keep it here. Starred rolls never drop off.</li>';
  }
  $('hofMode').addEventListener('change', renderTrophies);
  $('favList').addEventListener('click', ev => {
    const b = ev.target.closest('[data-unstar]');
    if (!b) return;
    const [n, t] = b.dataset.unstar.split(',').map(Number);
    state.favs = state.favs.filter(f => !(f.n === n && f.t === t));
    save();
    renderTrophies();
    paintStar();
  });

  // Collection
  RARITIES.forEach((r, i) => $('collRarity').appendChild(new Option(r.name, String(i))));
  function renderCollection() {
    const all = allBadges();
    const haveB = all.filter(b => state.counts[b.id]).length, haveM = multsFound();
    const total = all.length + MULTS.length;
    $('collCount').textContent = `${haveB + haveM} of ${total} collected`;
    $('collBar').style.width = (100 * (haveB + haveM) / total) + '%';
    const q = $('collSearch').value.trim().toLowerCase();
    const status = $('collStatus').value, rarity = $('collRarity').value;
    const keep = (text, rar, have) => (!q || text.toLowerCase().includes(q))
      && (status === 'all' || (status === 'have') === !!have) && (rarity === '' || String(rar) === rarity);
    const root = $('collection');
    root.replaceChildren();
    let count = 0;
    const section = (title, note, items) => {
      if (!items.length) return;
      count += items.length;
      const sec = document.createElement('div');
      sec.className = 'cat';
      sec.innerHTML = `<div class="section-head"><h2>${esc(title)}</h2><span>${esc(note)}</span></div>`;
      const ul = document.createElement('ul');
      ul.className = 'cards';
      items.forEach(li => ul.appendChild(li));
      sec.appendChild(ul);
      root.appendChild(sec);
    };
    const multItems = MULTS.filter(m => keep(`${m.name} ${m.symbol}`, m.rarity, state.mults[m.id]))
      .sort((a, b) => b.p - a.p).map(m => multCard(m, { locked: !state.mults[m.id], times: state.mults[m.id] || 0 }));
    section('Multipliers', `${haveM} of ${MULTS.length} landed`, multItems);
    for (const cat of CATEGORIES) {
      const inCat = all.filter(b => b.cat === cat);
      const list = inCat.filter(b => keep(`${b.name} ${b.desc}`, b.rarity, state.counts[b.id])).sort((a, b) => b.p - a.p);
      const mode = inCat[0] && inCat[0].mode;
      const note = `${inCat.filter(b => state.counts[b.id]).length} of ${inCat.length}${mode ? `, ${MODE_BY_ID[mode].name} mode only` : cat === 'Daily' ? ', change with the date' : ''}`;
      section(cat, note, list.map(b => badgeCard(b, { locked: !state.counts[b.id], times: state.counts[b.id] || 0 })));
    }
    if (!count) {
      root.innerHTML = '<p class="empty-state">Nothing matches these filters. <button class="btn" type="button" id="clearFilters">Clear filters</button></p>';
      $('clearFilters').addEventListener('click', () => { $('collSearch').value = ''; $('collStatus').value = 'all'; $('collRarity').value = ''; renderCollection(); });
    }
  }
  for (const id of ['collSearch', 'collStatus', 'collRarity']) $(id).addEventListener('input', renderCollection);

  // Log: stats, luck against the tier shares, recent rolls
  function renderLog() {
    const stat = (v, k) => `<div class="stat"><div class="v num">${v}</div><div class="k">${k}</div></div>`;
    const bestAny = MODE_IDS.map(m => state.hof[m][0]).filter(Boolean).sort((a, b) => b.log - a.log)[0];
    $('stats').innerHTML = stat(fmt(state.total), 'Rolls')
      + stat(bestAny ? esc(ROLL_TIERS[T(bestAny.tier)].name) : 'none yet', 'Best tier reached')
      + stat(`${collected()} / ${collectable().length}`, 'Badges collected')
      + stat(`${multsFound()} / ${MULTS.length}`, 'Multipliers landed');
    let html = '';
    for (const mode of MODE_IDS) {
      const total = tierTotal(mode); // after an upgrade this covers only the rolls rescored on the current scale
      if (!total) continue;
      const shares = G.tierShares(mode);
      html += `<thead><tr><th>${esc(MODE_BY_ID[mode].name)}, ${rollsText(total)}</th><th>Rolls</th><th>You</th><th>Expected</th></tr></thead><tbody>`;
      for (const t of ROLL_TIERS) {
        const k = state.tiers[mode][t.id] || 0;
        const pctText = v => (v === 0 ? '0%' : v >= 0.1 ? `${v.toFixed(1)}%` : `${+v.toPrecision(2)}%`);
        html += `<tr><td style="color:${tierVar(t.id)};font-weight:700">${t.name}</td><td class="num">${fmt(k)}</td><td class="num">${pctText(100 * k / total)}</td><td class="num">${pctText(100 * (shares[t.id] || 0))}</td></tr>`;
      }
      const better = ROLL_TIERS.slice(T('rare'));
      const yours = better.reduce((s, t) => s + (state.tiers[mode][t.id] || 0), 0) / total;
      const expected = better.reduce((s, t) => s + (shares[t.id] || 0), 0);
      html += `<tr><td><b>Rare or better</b></td><td></td><td class="num"><b>${(100 * yours).toFixed(1)}%</b></td><td class="num"><b>${(100 * expected).toFixed(1)}%</b></td></tr></tbody>`;
    }
    $('luck').innerHTML = html || '<tbody><tr><td class="empty-state">Roll a few times and this compares your tiers with how often each tier really comes up.</td></tr></tbody>';
    $('luckNote').textContent = state.boosted ? `${rollsText(state.boosted)} made with a luck charm or the Multiplier Lens are left out, since they are not plain rolls.` : '';
    $('log').innerHTML = state.log.length ? state.log.map(x => rowHtml(entryFor(x), false)).join('')
      : '<li class="empty-state">No rolls yet. Your last 200 rolls appear here.</li>';
    renderCharts();
  }

  // Stats charts, drawn as SVG. Bars for rolls per day (one series, so no legend); a dot plot on a
  // log scale for tier shares, where yours is a filled dot and the expected share a ring, so the two
  // differ by shape as well as colour. Hovering any mark shows its exact value.
  for (const m of MODES) $('chartMode').appendChild(new Option(m.name, m.id));
  $('chartMode').addEventListener('change', renderCharts);
  const niceMax = v => { const e = 10 ** Math.floor(Math.log10(v)); return [1, 2, 2.5, 5, 10].map(k => k * e).find(k => k >= v); };
  function renderCharts() {
    const W = 360, H = 170, L = 40, B = 22, top = 8;
    const days = Array.from({ length: 14 }, (_, i) => dayKey(Date.now() - (13 - i) * 864e5));
    const vals = days.map(d => state.daily[d] || 0), max = niceMax(Math.max(10, ...vals));
    const bw = (W - L) / 14, y = v => top + (H - top - B) * (1 - v / max);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Rolls per day for the last 14 days: ${days.map((d, i) => `${d} ${vals[i]}`).join(', ')}">`;
    for (const g of [0, max / 2, max]) svg += `<line class="grid" x1="${L}" x2="${W}" y1="${y(g)}" y2="${y(g)}"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${fmt(g)}</text>`;
    vals.forEach((v, i) => {
      const x = L + i * bw + 1, h = Math.max(0, y(0) - y(v)), d = new Date(days[i] + 'T12:00');
      const tip = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${fmt(v)} ${v === 1 ? 'roll' : 'rolls'}`;
      svg += `<rect class="hit" x="${x - 1}" y="${top}" width="${bw}" height="${H - top - B}" data-tip="${esc(tip)}"/>`;
      // 4px rounded top anchored to the baseline: a rounded rect with its bottom corners squared off by a plain one
      if (h > 0) svg += `<path class="bar" d="M${x} ${y(0)}V${y(v) + Math.min(4, h)}q0 -${Math.min(4, h)} ${Math.min(4, h)} -${Math.min(4, h)}H${x + bw - 6}q${Math.min(4, h)} 0 ${Math.min(4, h)} ${Math.min(4, h)}V${y(0)}Z"/>`;
      if (i % 2 === 1) svg += `<text x="${x + (bw - 2) / 2}" y="${H - 6}" text-anchor="middle">${d.getDate()}</text>`;
    });
    $('dailyChart').innerHTML = svg + '</svg>';

    const mode = $('chartMode').value || state.mode, total = tierTotal(mode), shares = G.tierShares(mode);
    const LO = -10, rows = ROLL_TIERS.filter(t => (shares[t.id] || 0) >= 10 ** LO || state.tiers[mode][t.id]);
    const RH = 18, W2 = 360, L2 = 92, H2 = top + rows.length * RH + 24;
    const x = p => L2 + (W2 - L2 - 8) * (Math.max(LO, Math.log10(p)) - LO) / -LO;
    let s2 = `<svg viewBox="0 0 ${W2} ${H2}" role="img" aria-label="Share of rolls per tier, yours against expected, ${MODE_BY_ID[mode].name} mode. The Luck table below lists the same numbers.">`;
    for (let e = LO; e <= 0; e += 2) s2 += `<line class="grid" x1="${x(10 ** e)}" x2="${x(10 ** e)}" y1="${top}" y2="${H2 - 20}"/><text x="${x(10 ** e)}" y="${H2 - 6}" text-anchor="middle">${e === 0 ? '100%' : `10${sup(e).replace('-', '⁻')}`}</text>`;
    const pctOf = v => (v === 0 ? 'none' : v >= 0.001 ? `${+(100 * v).toPrecision(3)}%` : `1 in ${fmt(1 / v)}`);
    rows.forEach((t, i) => {
      const cy = top + i * RH + RH / 2, exp = shares[t.id] || 0, you = total ? (state.tiers[mode][t.id] || 0) / total : 0;
      const tip = `${t.name}: you ${pctOf(you)}, expected ${pctOf(exp)}`;
      s2 += `<g class="row"><rect class="hit" x="0" y="${cy - RH / 2}" width="${W2}" height="${RH}" data-tip="${esc(tip)}"/>`
        + `<text x="${L2 - 8}" y="${cy + 4}" text-anchor="end" style="fill:${tierVar(t.id)};font-weight:700">${t.name}</text>`
        + (exp > 0 ? `<circle class="expected" cx="${x(exp)}" cy="${cy}" r="5"/>` : '')
        + (you > 0 ? `<circle class="you" cx="${x(you)}" cy="${cy}" r="5"/>` : '') + '</g>';
    });
    $('tierChart').innerHTML = total ? s2 + '</svg><div class="legend"><span><i class="k-you"></i>You</span><span><i class="k-exp"></i>Expected</span></div>'
      : '<p class="muted">No plain rolls in this mode yet.</p>';
  }
  // One tooltip for both charts, placed at the hovered mark.
  const chartTip = document.createElement('div');
  chartTip.className = 'chart-tip';
  chartTip.hidden = true;
  for (const id of ['dailyChart', 'tierChart']) {
    const box = $(id);
    box.addEventListener('pointermove', ev => {
      const hit = ev.target.closest('[data-tip]');
      if (!hit) { chartTip.hidden = true; return; }
      const fig = box.closest('.chart'), r = fig.getBoundingClientRect();
      if (chartTip.parentNode !== fig) fig.appendChild(chartTip);
      chartTip.textContent = hit.dataset.tip;
      chartTip.hidden = false;
      const left = Math.min(r.width - chartTip.offsetWidth - 4, Math.max(4, ev.clientX - r.left + 12));
      chartTip.style.left = left + 'px';
      chartTip.style.top = (ev.clientY - r.top - 34) + 'px';
    });
    box.addEventListener('pointerleave', () => { chartTip.hidden = true; });
  }

  // Tabs, with arrow-key movement between them
  const TABS = ['roll', 'inventory', 'collection', 'trophies', 'log'];
  function selectTab(name) {
    document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    for (const t of TABS) $('tab-' + t).hidden = t !== name;
    if (name === 'collection') { renderBook(); renderCollection(); }
    if (name === 'trophies') { renderQuests(); renderPrestige(); renderTrophies(); }
    if (name === 'log') renderLog();
    if (name === 'inventory') { renderInventory(); renderSlot(); }
  }
  const tabBar = document.querySelector('.tabs');
  tabBar.addEventListener('click', ev => { const b = ev.target.closest('[role="tab"]'); if (b) selectTab(b.dataset.tab); });
  tabBar.addEventListener('keydown', ev => {
    const i = TABS.indexOf(document.activeElement.dataset.tab);
    if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const next = TABS[(i + (ev.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    selectTab(next);
    tabBar.querySelector(`[data-tab="${next}"]`).focus();
  });

  // Settings
  function applySettings() {
    const s = state.settings;
    if (!ownsSkin(s.theme)) s.theme = 'midnight'; // a skin this save file does not own, e.g. after switching saves
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.tone = SKIN_BY_ID[s.theme].light ? 'light' : 'dark';
    paintConsole();
    document.documentElement.dataset.effects = s.effects;
    document.querySelector('meta[name="theme-color"]').content = cssVar('--bg');
    for (const r of document.querySelectorAll('#settingsDialog input[name="effects"]')) r.checked = r.value === s.effects;
  }
  $('settingsBtn').addEventListener('click', () => { $('dataMsg').textContent = ''; paintInstall(); renderSlots(); renderSkins(); $('settingsDialog').showModal(); });
  $('settingsDialog').addEventListener('change', ev => {
    if (ev.target.name !== 'effects') return;
    state.settings.effects = ev.target.value;
    applySettings();
    save();
  });

  let installPrompt = null;
  addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; paintInstall(); });
  function paintInstall() {
    const text = $('installText');
    $('installBtn').hidden = !installPrompt;
    if (matchMedia('(display-mode: standalone)').matches) text.textContent = 'Installed. It runs offline.';
    else if (location.protocol === 'file:') text.innerHTML = 'Installing works from the hosted copy: open <a href="https://gkson-lab.github.io/rngexp10/">gkson-lab.github.io/rngexp10</a>.';
    else if (installPrompt) text.textContent = 'Install it as an app that opens in its own window and works offline.';
    else text.textContent = "Use your browser's Install app or Add to Home Screen option. Once installed, it works offline.";
  }
  $('installBtn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    paintInstall();
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable; the game still works */ });
  }

  // Save files panel
  const readSlot = id => { try { return JSON.parse(localStorage.getItem(slotKey(id))); } catch { return null; } };
  const newSlotId = () => Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const slotName = id => slots.list.find(s => s.id === id).name;
  function download(name, data) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const fileName = name => `rngdle10-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save'}.json`;
  function renderSlots() {
    $('slotList').innerHTML = slots.list.map(s => {
      const data = s.id === slots.active ? state : readSlot(s.id);
      const rolls = data ? data.total || 0 : 0;
      const lastT = data && data.log && data.log[0] && data.log[0].t;
      const playing = s.id === slots.active;
      return `<li class="${playing ? 'playing' : ''}"><div class="slot-info"><b>${esc(s.name)}</b>${playing ? ' <span class="slot-tag">Playing</span>' : ''}`
        + `<span class="muted num">${rollsText(rolls)}${lastT ? ` · last rolled ${new Date(lastT).toLocaleDateString()}` : ''}</span></div>`
        + `<div class="slot-actions">${playing ? '' : `<button class="btn" type="button" data-slot="play" data-id="${s.id}">Play</button>`}`
        + `<button class="btn" type="button" data-slot="rename" data-id="${s.id}" aria-label="Rename ${esc(s.name)}">Rename</button>`
        + `<button class="btn" type="button" data-slot="copy" data-id="${s.id}" aria-label="Duplicate ${esc(s.name)}">Duplicate</button>`
        + `<button class="btn" type="button" data-slot="export" data-id="${s.id}" aria-label="Export ${esc(s.name)} to a file">Export</button>`
        + `${playing ? '' : `<button class="btn danger" type="button" data-slot="delete" data-id="${s.id}" aria-label="Delete ${esc(s.name)}">Delete</button>`}</div></li>`;
    }).join('');
    $('newSlotBtn').disabled = $('importBtn').disabled = slots.list.length >= MAX_SLOTS;
    $('slotCount').textContent = `${slots.list.length} of ${MAX_SLOTS}`;
  }
  function addSlot(name, data) {
    const id = newSlotId();
    try { localStorage.setItem(slotKey(id), JSON.stringify(data)); } catch { $('dataMsg').textContent = 'This browser is blocking storage, so the save file could not be created.'; return null; }
    slots.list.push({ id, name, created: Date.now() });
    saveSlots();
    return id;
  }
  function playSlot(id) {
    setAuto(null);
    writeSave();
    slots.active = id;
    saveSlots();
    location.hash = '';
    location.reload();
  }
  $('slotList').addEventListener('click', ev => {
    const b = ev.target.closest('[data-slot]');
    if (!b) return;
    const id = b.dataset.id, s = slots.list.find(x => x.id === id), action = b.dataset.slot;
    if (action === 'play') playSlot(id);
    if (action === 'rename') {
      const name = (prompt('Name this save file', s.name) || '').trim().slice(0, 40);
      if (name) { s.name = name; saveSlots(); renderSlots(); }
    }
    if (action === 'copy') {
      if (slots.list.length >= MAX_SLOTS) return;
      if (id === slots.active) writeSave();
      if (addSlot(`${s.name} copy`, readSlot(id) || blank())) { renderSlots(); $('dataMsg').textContent = `Made a copy of ${s.name}.`; }
    }
    if (action === 'export') {
      if (id === slots.active) writeSave();
      const data = readSlot(id) || blank();
      download(fileName(s.name), { game: 'rngdle10', version: 4, name: s.name, state: data });
      $('dataMsg').textContent = `Exported ${s.name} (${rollsText(data.total || 0)}) to a file.`;
    }
    if (action === 'delete') {
      if (!confirm(`Delete the save file "${s.name}"? Its rolls, badges and achievements cannot be recovered unless you exported it.`)) return;
      try { localStorage.removeItem(slotKey(id)); } catch { /* already gone */ }
      slots.list = slots.list.filter(x => x.id !== id);
      saveSlots();
      renderSlots();
      $('dataMsg').textContent = `Deleted ${s.name}.`;
    }
  });
  $('newSlotBtn').addEventListener('click', () => {
    const fresh = blank();
    fresh.settings = { ...state.settings };
    const id = addSlot(`Save ${slots.list.length + 1}`, fresh);
    if (id && confirm('New save file created. Switch to it now?')) playSlot(id);
    else renderSlots();
  });
  // Importing always makes a new save file, so a shared save can never overwrite your own.
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch { /* reported below */ }
    const s = data && ['rngdle10', 'rngdle9'].includes(data.game) && data.state;
    if (!s || !Array.isArray(s.log) || typeof s.total !== 'number') {
      $('dataMsg').textContent = 'That file is not an RNGdle save, so nothing was imported.';
      return;
    }
    const st = Object.assign(blank(), s, { settings: { ...state.settings } });
    const b = blank();
    for (const k of ['totals', 'tiers', 'hof']) st[k] = Object.assign(b[k], s[k]);
    if (data.game === 'rngdle9') st.totals.classic = s.total;
    if (data.game === 'rngdle9' || !s.tiers || !s.hof) st.v = 3; // rebuild tiers and hall of fame from the log on first load
    st.log = s.log.filter(x => x && Number.isInteger(x.n) && x.n >= 0 && x.n < G.SPACE).slice(0, LOG_LIMIT);
    const name = String(data.name || file.name.replace(/\.json$/i, '').replace(/^rngdle10-/, '') || 'Imported save').slice(0, 40);
    if (addSlot(name, st)) {
      renderSlots();
      $('dataMsg').textContent = `Imported "${name}" (${rollsText(s.total)}) as a new save file. Press Play to use it.`;
    }
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm(`Erase every roll, badge, multiplier, star and achievement in "${slotName(slots.active)}"? This cannot be undone.`)) return;
    setAuto(null);
    const keep = state.settings;
    Object.assign(state, blank(), { settings: keep });
    session.rolls = 0;
    session.best = perMode(() => []);
    if (slots.active === 'main') { try { localStorage.removeItem('rngdle9:v2'); } catch { /* nothing to remove */ } }
    writeSave();
    renderBoards();
    paintStatus();
    renderSlots();
    $('dataMsg').textContent = `Erased "${slotName(slots.active)}".`;
  });

  $('invList').addEventListener('click', ev => {
    const use = ev.target.closest('[data-use]'), fuse = ev.target.closest('[data-fuse]');
    if (use) useItem(use.dataset.use);
    if (fuse) fuseItem(fuse.dataset.fuse);
  });

  // Skins. Free ones are always owned; the rest are found in the page, bought as one bundle, or
  // earned from the badge book. Owned skins belong to the save file.
  const SKINS = [
    { id: 'midnight', name: 'Midnight', how: 'free' },
    { id: 'felt', name: 'Felt', how: 'free' },
    { id: 'daylight', name: 'Daylight', how: 'free', light: true },
    { id: 'neon', name: 'Neon', how: 'secret', hint: 'The logo hides something.' },
    { id: 'lcd', name: 'LCD', how: 'secret', hint: 'Keep pressing the version number.' },
    { id: 'blueprint', name: 'Blueprint', how: 'secret', hint: 'Search the collection for the plans.' },
    { id: 'terminal', name: 'Terminal', how: 'secret', hint: 'Settings has a command line somewhere.' },
    { id: 'console', name: 'Console', how: 'secret', hint: 'Comes with Terminal.' },
    { id: 'gold', name: 'Gold', how: 'bundle' },
    { id: 'ruby', name: 'Ruby', how: 'bundle' },
    { id: 'aurora', name: 'Aurora', how: 'bundle' },
    { id: 'graph', name: 'Graph Paper', how: 'book', light: true },
    { id: 'spiral', name: 'Golden Spiral', how: 'book' },
    { id: 'odometer', name: 'Odometer', how: 'book' },
    { id: 'vapor', name: 'Vaporwave', how: 'book' },
    { id: 'spectrum', name: 'Spectrum', how: 'book', light: true },
  ];
  const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const BUNDLE_PRICE = 500;
  const ownsSkin = id => SKIN_BY_ID[id] && (SKIN_BY_ID[id].how === 'free' || state.skins.includes(id));
  function unlockSkin(id, why) {
    if (ownsSkin(id)) return false;
    state.skins.push(id);
    toast(`${esc(why)}: <b>${esc(SKIN_BY_ID[id].name)}</b> skin unlocked`, 'legendary');
    save();
    if ($('settingsDialog').open) renderSkins();
    return true;
  }
  function wearSkin(id) {
    if (!ownsSkin(id)) return;
    state.settings.theme = id;
    applySettings();
    save();
  }
  function renderSkins() {
    const groups = [['free', 'Free'], ['secret', 'Secret'], ['bundle', `Bundle, ${BUNDLE_PRICE} coins`], ['book', 'Badge book']];
    $('skinList').innerHTML = groups.map(([how, title]) => `<li class="skin-group"><b>${title}</b></li>` + SKINS.filter(s => s.how === how).map(s => {
      const own = ownsSkin(s.id), on = state.settings.theme === s.id;
      const page = BOOK.find(p => p.skin === s.id);
      const note = own ? '' : how === 'secret' ? s.hint : how === 'book' ? `Complete the ${page.cat} page` : `${BUNDLE_PRICE} coins`;
      return `<li><button class="skin${on ? ' on' : ''}" type="button" data-skin="${s.id}" aria-pressed="${on}" ${own ? '' : 'disabled'}>`
        + `<span class="swatch" data-swatch="${s.id}" aria-hidden="true"></span><span><b>${own || how !== 'secret' ? esc(s.name) : '???'}</b>`
        + `${note ? `<br><span class="muted">${esc(note)}</span>` : ''}</span></button></li>`;
    }).join('')).join('');
    const bundleOwned = SKINS.filter(s => s.how === 'bundle').every(s => ownsSkin(s.id));
    $('buyBundle').hidden = bundleOwned;
    $('buyBundle').disabled = state.coins < BUNDLE_PRICE;
    $('buyBundle').textContent = `Buy Gold, Ruby and Aurora for ${BUNDLE_PRICE} coins (you have ${fmt(state.coins)})`;
  }
  $('skinList').addEventListener('click', ev => {
    const b = ev.target.closest('[data-skin]');
    if (b) { wearSkin(b.dataset.skin); renderSkins(); }
  });
  function buyBundle() {
    if (state.coins < BUNDLE_PRICE || SKINS.filter(s => s.how === 'bundle').every(s => ownsSkin(s.id))) return false;
    state.coins -= BUNDLE_PRICE;
    for (const s of SKINS) if (s.how === 'bundle' && !ownsSkin(s.id)) state.skins.push(s.id);
    toast('Bundle bought: <b>Gold, Ruby and Aurora</b> skins unlocked', 'legendary');
    save();
    if ($('settingsDialog').open) renderSkins();
    return true;
  }
  $('buyBundle').addEventListener('click', buyBundle);

  // Secret skins. Neon: press the 10 in the logo ten times in a row. LCD: press the version seven times.
  // Blueprint: search the collection for "blueprint".
  function presses(el, need, fire) {
    let n = 0, last = 0;
    el.addEventListener('click', () => {
      const now = Date.now();
      n = now - last < 1500 ? n + 1 : 1;
      last = now;
      if (n >= need) { n = 0; fire(); }
    });
  }
  presses(document.querySelector('.mark .cells'), 10, () => { if (unlockSkin('neon', 'Secret found')) wearSkin('neon'); });
  presses($('version'), 7, () => { if (unlockSkin('lcd', 'Secret found')) wearSkin('lcd'); });
  $('collSearch').addEventListener('input', () => {
    if ($('collSearch').value.trim().toLowerCase() === 'blueprint' && unlockSkin('blueprint', 'Secret found')) wearSkin('blueprint');
  });

  // The command line. The same shell runs in the hidden terminal in Settings and, full screen, in the
  // Console skin, where it is the whole game: every screen has a command.
  const TERMINAL_CODE = 'M@D3W1THL0V3';
  const PROMPT = 'PS C:\\RNGdle10> ';
  const plain = html => { const d = document.createElement('div'); d.innerHTML = html; return d.textContent; };
  const pad = (s, n) => String(s).padEnd(n);
  const findItem = q => {
    q = q.toLowerCase();
    return ITEMS.find(i => i.id === q) || ITEMS.find(i => i.name.toLowerCase() === q) || ITEMS.find(i => i.name.toLowerCase().includes(q));
  };
  const rollLine = e => `${pad(label(e), 16)}${pad(ROLL_TIERS[T(e.tier)].name, 14)}${pad(oneText(e), 18)}${MODE_BY_ID[e.mode].name}${e.x && e.x !== 'unity' ? ` × ${MULT_BY_ID[e.x].symbol}` : ''}`;
  const SHELL_HELP = [
    'ROLL [n]               Roll once, or n times (up to 10,000) and show the best.',
    'AUTO [tier]            Roll until a tier or better, e.g. AUTO mythic.',
    'ENDLESS                Roll until you type STOP.',
    'STOP                   Stop Auto or Endless.',
    'SPEED 1|2|TURBO        Auto and Endless speed.',
    'RATE 90|250|500|1000   Turbo rolls per second.',
    'MODE [name]            Show or change the mode.',
    'STATS                  Totals, best roll, collection.',
    'LUCK [mode]            Your tiers against the expected shares.',
    'LOG [n]                Your last n rolls (default 10).',
    'BEST [mode]            Hall of fame.',
    'INV                    Inventory and active effects.',
    'USE item               Use an item, e.g. USE luck100 or USE goose.',
    'FUSE item              Fuse several of an item into the next one up.',
    'SPIN [n|ALL]           Spin the coin slot.',
    'ODDS                   The slot prize table and your pity.',
    'QUESTS [CLAIM n]       Today\'s quests, or claim one.',
    'BOOK [CLAIM page]      Badge book pages, or claim one.',
    'BADGES [word]          Badges by category, or the ones matching a word.',
    'ACH                    Achievements.',
    'PRESTIGE [YES]         Prestige progress, or prestige.',
    'SKINS, SKIN id         Your skins, or wear one.  BUY BUNDLE buys three.',
    'SOUND ON|OFF           Sound.',
    'VER, CLS, GUI          Version, clear the screen, back to the clickable Terminal look.',
  ];
  function shell(line, print) {
    const cmd = line.trim();
    if (!cmd) return;
    if (cmd === TERMINAL_CODE) {
      const fresh = unlockSkin('terminal', 'Code accepted');
      unlockSkin('console', 'Code accepted');
      if (!consoleOn()) wearSkin('terminal');
      print(fresh ? 'Code accepted. Terminal and Console skins unlocked.' : 'You already have the Terminal and Console skins.', 'SKIN console plays the whole game from this command line.', '');
      return;
    }
    const [word, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(' '), w = word.toLowerCase(), a = arg.toLowerCase();
    const modeArg = () => (a ? MODES.find(m => m.id === a || m.name.toLowerCase().startsWith(a)) : MODE_BY_ID[state.mode]);
    switch (w) {
      case 'help': case '?': print(...SHELL_HELP, ''); break;
      case 'ver': print('', `RNGdle 10 [Version ${$('version').textContent.slice(1)}]`, ''); break;
      case 'cls': case 'clear': print.clear(); break;
      case 'exit': if (print.exit) print.exit(); else print('Type GUI to leave the Console skin.'); break;
      case 'gui': wearSkin('terminal'); break;
      case 'roll': {
        if (!ready[state.mode]) { print('The odds are still loading. Try again in a moment.'); break; }
        if (auto) setAuto(null);
        const n = Math.max(1, Math.min(1e4, Math.floor(+arg.replace(/,/g, '') || 1)));
        let best = null;
        for (let i = 0; i < n; i++) {
          const r = takeRoll();
          if (!best || r.rec.entry.oneInLog > best.rec.entry.oneInLog) best = r;
          if (n <= 10) print(rollLine(r.rec.entry));
        }
        if (n > 10) print(`${fmt(n)} rolls. Best:`, rollLine(best.rec.entry));
        drawRoll(best, 3, true);
        break;
      }
      case 'auto': case 'endless': {
        if (w === 'auto' && a) {
          const t = ROLL_TIERS.find(x => x.name.toLowerCase() === a);
          if (!t) { print(`No tier called ${arg}.`); break; }
          $('stopAt').value = String(T(t.id));
        }
        setAuto(w);
        const stopTier = ROLL_TIERS[+$('stopAt').value];
        print(w === 'auto' ? `Auto: rolling until ${stopTier ? `${stopTier.name} or better` : 'you type STOP'}.` : 'Endless: rolling until you type STOP.', 'Epic or rarer rolls print as they come.');
        break;
      }
      case 'stop': { const k = run.rolls; setAuto(null); print(`Stopped after ${rollsText(k)}.`); break; }
      case 'speed': {
        const v = { 1: 1, '1x': 1, 2: 2, '2x': 2, turbo: 3, 3: 3 }[a];
        if (!v) { print(`Speed is ${['', '1×', '2×', 'Turbo'][speed]}. SPEED 1, 2 or TURBO changes it.`); break; }
        $('speed').querySelector(`[data-speed="${v}"]`).click();
        print(`Speed set to ${['', '1×', '2×', 'Turbo'][v]}.`);
        break;
      }
      case 'rate': {
        const v = +a.replace(/,/g, '');
        if (!TURBO_RATES.includes(v)) { print(`Turbo rolls ${fmt(turboRate())} a second. RATE ${TURBO_RATES.join(', ')} changes it.`); break; }
        state.settings.turboRate = v;
        $('turboRate').value = String(v);
        save();
        print(`Turbo rate set to ${fmt(v)} a second.`);
        break;
      }
      case 'mode': {
        const m = modeArg();
        if (!m) { print(`Modes: ${MODES.map(x => x.id).join(', ')}`); break; }
        if (a) setMode(m.id);
        print(`${m.name}: ${m.desc}`);
        break;
      }
      case 'stats': {
        const bestAny = MODE_IDS.map(m => state.hof[m][0]).filter(Boolean).sort((p, q) => q.log - p.log)[0];
        print(`Rolls          ${fmt(state.total)}`, ...MODES.map(m => `  ${pad(m.name, 13)}${fmt(state.totals[m.id])}`),
          `Today          ${rollsText(state.daily[dayKey()] || 0)}`, `Best roll      ${bestAny ? rollLine(bestAny) : 'none yet'}`,
          `Badges         ${collected()} / ${collectable().length}`, `Multipliers    ${multsFound()} / ${MULTS.length}`,
          `Achievements   ${Object.keys(state.ach).length} / ${ACHIEVEMENTS.length}`, `Coins          ${fmt(state.coins)}`,
          `Prestige       ${state.prestige || 0} (drops ×${prestigeBonus()})`, '');
        break;
      }
      case 'luck': {
        const m = modeArg(), total = m ? tierTotal(m.id) : 0;
        if (!total) { print('No plain rolls in that mode yet.'); break; }
        const shares = G.tierShares(m.id), pc = v => (v === 0 ? '0%' : v >= 0.001 ? `${+(100 * v).toPrecision(3)}%` : `1 in ${fmt(1 / v)}`);
        print(`${m.name}, ${rollsText(total)}`, `${pad('Tier', 14)}${pad('Rolls', 10)}${pad('You', 12)}Expected`,
          ...ROLL_TIERS.filter(t => state.tiers[m.id][t.id] || (shares[t.id] || 0) >= 1e-9)
            .map(t => `${pad(t.name, 14)}${pad(fmt(state.tiers[m.id][t.id] || 0), 10)}${pad(pc((state.tiers[m.id][t.id] || 0) / total), 12)}${pc(shares[t.id] || 0)}`), '');
        break;
      }
      case 'log': {
        const n = Math.max(1, Math.min(200, +arg || 10));
        print(...(state.log.length ? state.log.slice(0, n).map(x => rollLine(entryFor(x))) : ['No rolls yet.']), '');
        break;
      }
      case 'best': case 'hof': {
        const m = modeArg() || MODE_BY_ID[state.mode];
        print(`Hall of fame, ${m.name}`, ...(state.hof[m.id].length ? state.hof[m.id].map((e, i) => `${pad(i + 1 + '.', 4)}${rollLine(e)}`) : ['empty']), '');
        break;
      }
      case 'inv': case 'inventory': {
        const have = ITEMS.filter(i => state.inv[i.id] > 0);
        print(`Coins: ${fmt(state.coins)}`, ...(have.length ? have.map(i => `${pad(i.id, 12)}${pad('×' + fmt(state.inv[i.id]), 10)}${i.name}`) : ['No items.']),
          `Active: ${effectsText().join(', ') || 'nothing'}`, '');
        break;
      }
      case 'use': case 'fuse': {
        const it = arg && findItem(arg);
        if (!it) { print(`No item called ${arg || '(nothing)'}. INV lists yours.`); break; }
        const before = state.inv[it.id] || 0;
        $('invMsg').textContent = '';
        if (w === 'use') useItem(it.id); else fuseItem(it.id);
        if ((state.inv[it.id] || 0) !== before) print(w === 'use' ? `Used ${it.name}. Active: ${effectsText().join(', ')}` : `Fused into ${ITEM_BY_ID[it.next[0]].name}.`);
        else if (w === 'use') print($('invMsg').textContent || `You have no ${it.name}.`);
        else print(it.next ? `Fusing needs ${it.next[1]} ${it.name}; you have ${before}.` : `${it.name} is the top of its line.`);
        break;
      }
      case 'spin': {
        const n = a === 'all' ? state.coins : Math.floor(+arg || 1);
        if (n < 1 || state.coins < n || slotBusy) { print(slotBusy ? 'The slot is still spinning.' : `You have ${fmt(state.coins)} coins.`); break; }
        spinSlot(n).then(() => print(...[...$('slotResult').children].map(li => li.textContent), `${fmt(state.coins)} coins left.`, ''));
        break;
      }
      case 'odds': case 'slot':
        print(`${pad('Prize', 32)}${pad('Chance', 10)}Pity`, ...SLOT_PRIZES.map(([id, qty, units]) => `${pad(ITEM_BY_ID[id].name + (qty > 1 ? ` ×${qty}` : ''), 32)}${pad(pctText(units), 10)}${id in SLOT_PITY ? `${fmt(state.pity[id] || 0)} / ${fmt(SLOT_PITY[id])}` : ''}`), '');
        break;
      case 'quests': case 'quest': {
        const qs = todaysQuests();
        if (rest[0] && rest[0].toLowerCase() === 'claim') {
          const i = (+rest[1] || 1) - 1;
          if (!qs.list[i]) { print('QUESTS CLAIM 1, 2 or 3.'); break; }
          const q = qs.list[i];
          print(claimQuest(i) ? `Claimed: ${QUEST_BY_ID[q.id].text}.` : q.claimed ? 'Already claimed.' : 'That quest is not done yet.');
          break;
        }
        print(...qs.list.map((q, i) => {
          const d = QUEST_BY_ID[q.id];
          return `${i + 1}. ${pad(d.text, 40)}${pad(`${fmt(q.have)} / ${fmt(d.goal)}`, 18)}${q.claimed ? 'claimed' : q.have >= d.goal ? `ready: QUESTS CLAIM ${i + 1}` : `${d.coins} coins and ${ITEM_BY_ID[d.item].name}`}`;
        }), '');
        break;
      }
      case 'book': {
        if (rest[0] && rest[0].toLowerCase() === 'claim') {
          const p = BOOK.find(x => x.cat.toLowerCase() === (rest[1] || '').toLowerCase());
          if (!p) { print(`Pages: ${BOOK.map(x => x.cat).join(', ')}`); break; }
          print(claimPage(p) ? `Claimed the ${p.cat} page: ${rewardText(p)}.` : state.book[p.cat] ? 'Already claimed.' : 'That page is not complete yet.');
          break;
        }
        print(...BOOK.map(p => `${pad(p.cat, 11)}${pad(`${pageHave(p.cat)} / ${pageBadges(p.cat).length}`, 10)}${pad(rewardText(p), 28)}${state.book[p.cat] ? 'claimed' : pageHave(p.cat) === pageBadges(p.cat).length ? `ready: BOOK CLAIM ${p.cat}` : ''}`), '');
        break;
      }
      case 'badges': case 'collection': {
        if (!a) {
          print(...CATEGORIES.map(c => { const l = allBadges().filter(b => b.cat === c); return `${pad(c, 11)}${l.filter(b => state.counts[b.id]).length} / ${l.length}`; }), 'BADGES word lists the badges matching a word.', '');
          break;
        }
        if (a === 'blueprint' && unlockSkin('blueprint', 'Secret found')) print('You found the plans.');
        const l = allBadges().filter(b => `${b.name} ${b.desc} ${b.cat}`.toLowerCase().includes(a));
        print(...(l.length ? l.map(b => `${state.counts[b.id] ? '[x]' : '[ ]'} ${pad(b.name, 26)}${pad(RARITIES[b.rarity].name, 14)}${odds(b.p)}`) : ['Nothing matches.']), '');
        break;
      }
      case 'ach': case 'achievements':
        print(...ACHIEVEMENTS.map(x => `${state.ach[x.id] ? '[x]' : '[ ]'} ${pad(x.name, 28)}${x.desc}`), '');
        break;
      case 'prestige': {
        const need = prestigeNeed(), since = prestigeSince();
        if (a !== 'yes') {
          print(`Prestige ${state.prestige || 0}, drops and coins ×${prestigeBonus()}.`, `${fmt(Math.min(since, need))} of ${fmt(need)} rolls since the last one.`,
            since >= need ? 'PRESTIGE YES prestiges. Coins, items and active effects are cleared.' : 'Prestige clears coins, items and active effects.', '');
          break;
        }
        if (since < need) { print('Not yet.'); break; }
        doPrestige();
        print(`Prestige ${state.prestige}. Drops and coins ×${prestigeBonus()}.`);
        break;
      }
      case 'skins': print(...SKINS.filter(s => ownsSkin(s.id)).map(s => `${state.settings.theme === s.id ? '*' : ' '} ${pad(s.id, 10)}${s.name}`), ''); break;
      case 'skin':
        if (a && ownsSkin(a)) { wearSkin(a); print(`Now wearing ${SKIN_BY_ID[a].name}.`, ''); } else print('The system cannot find the skin specified.', '');
        break;
      case 'buy':
        if (a !== 'bundle') { print('BUY BUNDLE buys Gold, Ruby and Aurora.'); break; }
        print(buyBundle() ? 'Bought the bundle: Gold, Ruby and Aurora.' : SKINS.filter(s => s.how === 'bundle').every(s => ownsSkin(s.id)) ? 'You already own it.' : `It costs ${BUNDLE_PRICE} coins; you have ${fmt(state.coins)}.`);
        break;
      case 'sound':
        if (a === 'on' || a === 'off') { state.settings.sound = a === 'on'; paintSound(); save(); }
        print(`Sound is ${state.settings.sound ? 'on' : 'off'}.`);
        break;
      default:
        print(`${word} : The term '${word}' is not recognized as the name of a command.`, 'Type HELP for the list of commands.', '');
    }
  }
  // An output sink: print(...lines) appends, print.clear() empties.
  function sink(pre, scroller) {
    const print = (...lines) => {
      pre.append(lines.join('\n') + '\n');
      while (pre.childNodes.length > 400) pre.firstChild.remove();
      scroller.scrollTop = 1e9;
    };
    print.clear = () => { pre.textContent = ''; };
    return print;
  }
  const termPrint = sink($('termOut'), $('termOut'));
  termPrint.exit = () => { $('terminal').hidden = true; $('termToggle').setAttribute('aria-expanded', 'false'); };
  $('termToggle').addEventListener('click', () => {
    const open = $('terminal').hidden;
    $('terminal').hidden = !open;
    $('termToggle').setAttribute('aria-expanded', String(open));
    if (open) {
      if (!$('termOut').textContent) termPrint('RNGdle 10 command line', 'Type HELP for a list of commands.', '');
      $('termInput').focus();
    }
  });
  function wireInput(form, input, print) {
    const history = [];
    let at = 0;
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const line = input.value;
      print(PROMPT + line);
      if (line.trim()) { history.push(line); at = history.length; }
      input.value = '';
      shell(line, print);
    });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowUp' && at > 0) { input.value = history[--at]; ev.preventDefault(); }
      if (ev.key === 'ArrowDown') { at = Math.min(history.length, at + 1); input.value = history[at] || ''; ev.preventDefault(); }
    });
  }
  wireInput($('termForm'), $('termInput'), termPrint);

  // The Console skin: the page becomes one command line. Notices print as text, and Epic or rarer
  // rolls print as they happen during Auto and Endless.
  const conPrint = sink($('conOut'), $('console'));
  wireInput($('conForm'), $('conInput'), conPrint);
  function consoleOn() { return state.settings.theme === 'console'; }
  let conLineAt = 0;
  function consoleRoll(entry) {
    if (!auto || T(entry.tier) < T('epic')) return;
    const now = performance.now();
    if (now - conLineAt < 50) return; // at most 20 lines a second
    conLineAt = now;
    conPrint(rollLine(entry));
  }
  function paintConsole() {
    $('console').hidden = !consoleOn();
    if (!consoleOn()) return;
    if (!$('conOut').textContent) conPrint('RNGdle 10 Console', `Save file: ${slotName(slots.active)}. Type HELP for the commands, GUI for the clickable look.`, '');
    setTimeout(() => $('conInput').focus(), 0);
  }
  $('console').addEventListener('click', () => { if (!getSelection().toString()) $('conInput').focus(); });

  // Badge book: a page is complete once every badge of its category at 1 in 1,000,000 or likelier
  // is collected. Five pages give a legendary skin; the rest give items.
  const BOOK = [
    { cat: 'Size', item: 'luck1k', k: 3 },
    { cat: 'Math', skin: 'graph' },
    { cat: 'Sequences', skin: 'spiral' },
    { cat: 'Digits', skin: 'odometer' },
    { cat: 'Memes', skin: 'vapor' },
    { cat: 'Combos', skin: 'spectrum' },
    { cat: 'Powers', item: 'goose', k: 2 },
    { cat: 'Modulo', item: 'luck10k', k: 1 },
    { cat: 'Target', item: 'prism', k: 3 },
    { cat: 'Radar', item: 'overclock2', k: 3 },
  ];
  const BOOK_P = 1e-6;
  const pageBadges = cat => collectable().filter(b => b.cat === cat && b.p >= BOOK_P);
  const pageHave = cat => pageBadges(cat).filter(b => state.counts[b.id]).length;
  const rewardText = p => (p.skin ? `${SKIN_BY_ID[p.skin].name} skin` : `${ITEM_BY_ID[p.item].name}${p.k > 1 ? ` ×${p.k}` : ''}`);
  function renderBook() {
    $('book').innerHTML = BOOK.map(p => {
      const all = pageBadges(p.cat).length, have = pageHave(p.cat), done = have === all, claimed = state.book[p.cat];
      const action = claimed ? '<span class="muted">Claimed</span>'
        : `<button class="btn" type="button" data-page="${p.cat}" ${done ? '' : 'disabled'}>Claim</button>`;
      return `<li${p.skin ? ' class="legend"' : ''}><div><b>${esc(p.cat)}</b> <span class="muted num">${have} / ${all}</span><br>`
        + `<span class="muted">Reward: ${esc(rewardText(p))}</span><div class="progress"><i style="width:${(100 * have / all).toFixed(1)}%"></i></div></div>${action}</li>`;
    }).join('');
    const pages = BOOK.filter(p => state.book[p.cat]).length;
    $('bookCount').textContent = `${pages} of ${BOOK.length} pages claimed`;
  }
  $('book').addEventListener('click', ev => {
    const b = ev.target.closest('[data-page]');
    if (!b) return;
    claimPage(BOOK.find(x => x.cat === b.dataset.page));
  });
  function claimPage(p) {
    if (state.book[p.cat] || pageHave(p.cat) < pageBadges(p.cat).length) return false;
    state.book[p.cat] = Date.now();
    if (p.skin) unlockSkin(p.skin, `${p.cat} page complete`);
    else grant(p.item, `${p.cat} page complete`, p.k);
    save();
    if (!$('tab-collection').hidden) renderBook();
    return true;
  }

  // Daily quests: three a day per save file, picked from the date and the save file so they are
  // the same all day. Each pays coins and an item; finishing all three pays a bonus.
  const QUESTS = [
    { id: 'roll500', text: 'Roll 500 times', goal: 500, on: 'roll', coins: 5, item: 'luck10' },
    { id: 'roll2k', text: 'Roll 2,000 times', goal: 2000, on: 'roll', coins: 15, item: 'lens' },
    { id: 'roll10k', text: 'Roll 10,000 times', goal: 1e4, on: 'roll', coins: 40, item: 'overclock' },
    { id: 'rare10', text: 'Roll Rare or rarer 10 times', goal: 10, on: 'tier', tier: 'rare', coins: 8, item: 'luck10' },
    { id: 'epic3', text: 'Roll Epic or rarer 3 times', goal: 3, on: 'tier', tier: 'epic', coins: 10, item: 'luck100' },
    { id: 'legend', text: 'Roll Legendary or rarer', goal: 1, on: 'tier', tier: 'legendary', coins: 15, item: 'horn' },
    { id: 'mythic', text: 'Roll Mythic or rarer', goal: 1, on: 'tier', tier: 'mythic', coins: 40, item: 'luck1k' },
    { id: 'fresh', text: 'Collect a badge you did not have', goal: 1, on: 'fresh', coins: 10, item: 'lens' },
    { id: 'mult', text: 'Land a Rare or rarer multiplier', goal: 1, on: 'mult', coins: 8, item: 'prism' },
    { id: 'spin10', text: 'Spin the coin slot 10 times', goal: 10, on: 'spin', coins: 5, item: 'horn' },
    { id: 'coins5', text: 'Find 5 coins', goal: 5, on: 'coin', coins: 5, item: 'luck100' },
    ...MODES.map(m => ({ id: `mode-${m.id}`, text: `Roll 300 times in ${m.name} mode`, goal: 300, on: 'mode', mode: m.id, coins: 8, item: 'luck100' })),
  ];
  const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
  const QUEST_BONUS = 'luck1k';
  function todaysQuests() {
    const day = dayKey();
    if (state.quests.day !== day) {
      let h = 2166136261; // FNV-1a of the date and save file, so the pick is fixed for the day
      for (const c of day + slots.active) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
      const pool = QUESTS.map(q => q.id), pick = [];
      while (pick.length < 3) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0]); }
      state.quests = { day, list: pick.map(id => ({ id, have: 0, claimed: false })), bonus: false };
    }
    return state.quests;
  }
  function questEvent(on, amount = 1, test = () => true) {
    for (const q of todaysQuests().list) {
      const def = QUEST_BY_ID[q.id];
      if (def.on !== on || q.have >= def.goal || !test(def)) continue;
      q.have = Math.min(def.goal, q.have + amount);
      if (q.have >= def.goal) toast(`Quest done: <b>${esc(def.text)}</b>. Claim it in Trophies${consoleOn() ? ' or with QUESTS CLAIM' : ''}.`, 'rare');
      if (!$('tab-trophies').hidden && (q.have >= def.goal || !auto)) renderQuests();
    }
  }
  function renderQuests() {
    const qs = todaysQuests();
    $('quests').innerHTML = qs.list.map((q, i) => {
      const def = QUEST_BY_ID[q.id], done = q.have >= def.goal;
      const action = q.claimed ? '<span class="muted">Claimed</span>'
        : `<button class="btn" type="button" data-quest="${i}" ${done ? '' : 'disabled'}>Claim</button>`;
      return `<li><div><b>${esc(def.text)}</b> <span class="muted num">${fmt(q.have)} / ${fmt(def.goal)}</span><br>`
        + `<span class="muted">Reward: ${def.coins} coins and ${esc(ITEM_BY_ID[def.item].name)}</span>`
        + `<div class="progress"><i style="width:${(100 * q.have / def.goal).toFixed(1)}%"></i></div></div>${action}</li>`;
    }).join('') + `<li class="muted">Finish all three for a bonus ${esc(ITEM_BY_ID[QUEST_BONUS].name)}${qs.bonus ? ' (paid)' : ''}. New quests every day at midnight.</li>`;
  }
  $('quests').addEventListener('click', ev => {
    const b = ev.target.closest('[data-quest]');
    if (!b) return;
    claimQuest(+b.dataset.quest);
  });
  function claimQuest(i) {
    const qs = todaysQuests(), q = qs.list[i], def = QUEST_BY_ID[q.id];
    if (q.claimed || q.have < def.goal) return false;
    q.claimed = true;
    state.coins += def.coins;
    grant(def.item, `Quest reward, plus ${def.coins} coins`);
    if (!qs.bonus && qs.list.every(x => x.claimed)) { qs.bonus = true; grant(QUEST_BONUS, 'All quests done'); }
    save();
    if (!$('tab-trophies').hidden) renderQuests();
    return true;
  }

  // Prestige: once enough rolls have passed since the last one, trade in coins, items and active
  // effects for a permanent bonus: every drop and coin chance is multiplied by 1 + 0.5 per prestige.
  const PRESTIGE_STEP = 1e5;
  function prestigeBonus() { return 1 + 0.5 * (state.prestige || 0); }
  const prestigeNeed = () => PRESTIGE_STEP * ((state.prestige || 0) + 1);
  const prestigeSince = () => state.total - (state.prestigeAt || 0);
  function renderPrestige() {
    const P = state.prestige || 0, since = prestigeSince(), need = prestigeNeed();
    $('prestigeText').textContent = P
      ? `Prestige ${P}: drops and coins come ${prestigeBonus()} times as often.`
      : 'No prestige yet. Each one makes drops and coins come half again as often, for good.';
    $('prestigeProgress').textContent = `${fmt(Math.min(since, need))} of ${fmt(need)} rolls since the last prestige`;
    $('prestigeBar').style.width = `${Math.min(100, 100 * since / need).toFixed(1)}%`;
    $('prestigeBtn').disabled = since < need;
    $('prestigeBtn').textContent = `Prestige to ${P + 1} (×${1 + 0.5 * (P + 1)} drops)`;
    paintPrestigeMark();
  }
  function paintPrestigeMark() {
    const P = state.prestige || 0;
    $('prestigeMark').hidden = !P;
    $('prestigeMark').textContent = `P${P}`;
    $('prestigeMark').setAttribute('aria-label', `Prestige ${P}`);
  }
  $('prestigeBtn').addEventListener('click', () => {
    if (prestigeSince() < prestigeNeed()) return;
    if (confirm('Prestige? Your coins, every item and every active effect are cleared. Rolls, badges, skins, achievements and the hall of fame stay.')) doPrestige();
  });
  function doPrestige() {
    setAuto(null);
    state.prestige = (state.prestige || 0) + 1;
    state.prestigeAt = state.total;
    Object.assign(state, { coins: 0, inv: {}, effects: {} });
    toast(`Prestige ${state.prestige}: drops and coins ×${prestigeBonus()}`, 'mythic');
    writeSave();
    renderPrestige();
    paintStatus();
  }

  // Start
  if (state.lastGift !== dayKey()) { // one free charm a day, per save file
    state.lastGift = dayKey();
    setTimeout(() => { grant('luck10', 'Daily gift'); save(); }, 600);
  }
  for (const k of Object.keys(state.daily).sort().slice(0, -60)) delete state.daily[k]; // keep two months of daily counts
  applySettings();
  paintPrestigeMark();
  $('chartMode').value = state.mode;
  paintSound();
  paintMult(MULT_BY_ID.unity);
  setMode(state.mode);
  for (const m of MODE_IDS) warm(m);
  if (state.log.length) {
    const last = state.log[0];
    warm(last.mode).then(() => {
      if (location.hash || shown) return;
      setReels(last);
      showResult(last);
    });
  }
  fromHash();
})();
