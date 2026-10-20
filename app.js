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
  const rollOf = x => ({ mode: x.mode, e: x.e, m: x.m, t: x.tg, mult: x.x, d: x.d });
  const scoreOf = x => G.score(x.n, dayKey(x.t), rollOf(x));
  const label = x => fmt(x.n) + (x.e > 1 ? sup(x.e) : '');
  function hashOf(x) {
    const q = new URLSearchParams({ n: x.n });
    if (x.mode !== 'classic') q.set('mode', x.mode);
    if (x.e) q.set('e', x.e);
    if (x.m) q.set('m', x.m);
    if (x.tg !== undefined) q.set('t', x.tg);
    if (x.x && x.x !== 'unity') q.set('x', x.x);
    if (x.d) q.set('d', x.d);
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
    difficulty: 'standard', tokens: 0, luckLevel: 0,
    bestPlain: {}, rec: {},
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
        if (!s.bestPlain) { // saves from before v3.5: the hall of fame holds the best plain rolls it kept
          for (const id of MODE_IDS) {
            const e = st.hof[id].find(x => !x.b && !x.lens && !x.d && x.oneInLog !== undefined);
            if (e) st.bestPlain[id] = { l: e.oneInLog, n: e.n, t: e.t, est: !!e.estimated };
          }
        }
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
  // Records that only grow: the busiest session and day. Called after every roll and every batch.
  function noteRecords() {
    const rc = state.rec;
    rc.session = Math.max(rc.session || 0, session.rolls);
    rc.day = Math.max(rc.day || 0, state.daily[dayKey()] || 0);
    noteStreak();
  }

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
    if (x.b || x.lens || x.d) state.boosted++;
    else {
      state.tiers[x.mode][tier.id] = (state.tiers[x.mode][tier.id] || 0) + 1;
      const bp = state.bestPlain[x.mode]; // for How lucky you have been
      if (!bp || oneInLog > bp.l) state.bestPlain[x.mode] = { l: oneInLog, n: x.n, t: x.t, est: !!estimated };
    }
    const rc = state.rec;
    rc.badges = Math.max(rc.badges || 0, r.badges.length);
    rc.streak = tier.id === 'trash' ? 0 : (rc.streak || 0) + 1; // played rolls in a row without Trash
    rc.streakBest = Math.max(rc.streakBest || 0, rc.streak);
    const madeHof = insertTop(state.hof[x.mode], entry);
    const madeSession = insertTop(session.best[x.mode], entry);
    session.rolls++;
    noteRecords();
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
    if (state.difficulty && state.difficulty !== 'standard') {
      w.style.setProperty('--rc', 'var(--line)');
      w.classList.add('unity');
      setReel($('multReel'), '–', false);
      $('multName').textContent = `No multiplier on ${G.DIFF_BY_ID[state.difficulty].name}`;
      $('multMeta').textContent = 'Only your badges count';
      return;
    }
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

  // `kind` lets a player switch off a whole family of notices in Settings: badge, item, quest or ach.
  // Anything else (hunts, skins, prestige) always shows.
  function toast(html, colorId, kind = '') {
    if (kind && state.settings.notices && state.settings.notices[kind] === false) return;
    if (fullSkin()) { fullNotice(plain(html)); return; }
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

  // Badge mastery: four levels, for earning a badge 1, 10, 100 and 1,000 times. Drawn as four small
  // reel cells, filled up to the level reached.
  const MASTERY = [1, 10, 100, 1000];
  const masteryOf = k => MASTERY.filter(t => (k || 0) >= t).length;
  const masteryTotal = () => collectable().reduce((t, b) => t + masteryOf(state.counts[b.id]), 0);
  const masteryCells = lv => `<span class="mastery" role="img" aria-label="Mastery ${lv} of ${MASTERY.length}">${MASTERY.map((_, i) => `<i${i < lv ? ' class="on"' : ''}></i>`).join('')}</span>`;
  function card({ title, desc, rarity, right, odd, locked = false, delay = null, isNew = false, onOpen, mastery = null }) {
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
    if (mastery !== null) btn.querySelector('.right').insertAdjacentHTML('beforeend', masteryCells(mastery));
    btn.addEventListener('click', onOpen);
    li.appendChild(btn);
    return li;
  }
  const badgeCard = (b, o = {}) => card({
    title: b.name, desc: b.desc, rarity: b.rarity, right: (b.factor ? '×' : '+') + fmt(b.ep),
    odd: o.times ? `${odds(b.p)}, earned ${fmt(o.times)}×` : odds(b.p), onOpen: () => openBadge(b), mastery: b.cat === 'Daily' ? null : masteryOf(state.counts[b.id]), ...o,
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
    $('bdAlso').hidden = !huntId || !hunt || huntId === hunt;
    $('bdAlso').textContent = 'Also hunt';
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
        ['Mastery', `level ${masteryOf(have)} of ${MASTERY.length}${masteryOf(have) < MASTERY.length ? `, next at ${fmt(MASTERY[masteryOf(have)])} ${MASTERY[masteryOf(have)] === 1 ? 'time' : 'times'}` : ''}`],
        [`Expected in your ${fmt(rolls)} ${b.mode ? MODE_BY_ID[b.mode].name + ' ' : ''}rolls`, (rolls * b.p).toFixed(rolls * b.p < 10 ? 2 : 0)],
        ['Chance in your next 1,000 plain rolls', chanceText(-Math.expm1(1000 * Math.log1p(-b.p)))],
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
  $('bdAlso').addEventListener('click', () => {
    const b = !dialogTarget.startsWith('x:') && findBadge(dialogTarget);
    if (b && b.mode && state.mode !== b.mode) { $('bdAlso').textContent = `Only in ${MODE_BY_ID[b.mode].name}: use Hunt this badge`; return; }
    if (!addAlsoHunt(dialogTarget)) { $('bdAlso').textContent = `Already hunting ${MAX_ALSO + 1} things`; return; }
    $('badgeDialog').close();
    selectTab('roll');
  });
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
    if (r.diff && r.diff.root > 1) s = `(${s})${r.diff.root === 1.5 ? '²ᐟ³' : r.diff.root === 2 ? '¹ᐟ²' : '¹ᐟ³'}`;
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
      + (x.b ? `, rolled with luck ×${fmt(x.b)}` : '') + (x.lens ? `, with the ${x.lens === 100 ? 'Kaleidoscope' : x.lens === 10 ? 'Prism' : 'Multiplier'} Lens` : '');

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
      `Long Shot 10 · ${MODE_BY_ID[x.mode].name}`,
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
    g.fillStyle = v('--ink'); g.font = `800 34px ${sans}`; g.fillText('Long Shot 10', 60, 80);
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
      a.download = `longshot10-${x.mode}-${x.n}.png`;
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
  let batching = null; // a batch roll in progress: { n, done }
  let speed = 1, auto = null, busy = false, hunt = '', huntRolls = 0;
  let alsoHunt = []; // up to two more hunt targets beside the one in Auto settings: { id, rolls }
  const MAX_ALSO = 2;
  const hunting = () => !!hunt || alsoHunt.length > 0;
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
    luckItem('luck10m', 'Charm of Ten Million', 1e7, 1, 9, ['luck100m', 10]),
    luckItem('luck100m', 'Charm of a Hundred Million', 1e8, 1, 10, ['luck1b', 10]),
    luckItem('luck1b', 'Charm of a Billion', 1e9, 1, 11, ['luck10b', 10]),
    luckItem('luck10b', 'Charm of Ten Billion', 1e10, 1, 13),
    dropItem('horn', 'Horn of Plenty', 25, 200, 3, ['goose', 5]),
    dropItem('goose', 'Golden Goose', 100, 100, 5, ['goose2', 5]),
    dropItem('goose2', 'Diamond Goose', 1000, 100, 7, ['goose3', 10]),
    dropItem('goose3', 'Platinum Goose', 1e4, 100, 9, ['goose4', 10]),
    dropItem('goose4', 'Cosmic Goose', 1e5, 100, 11),
    { id: 'lens', name: 'Multiplier Lens', kind: 'lens', tries: 2, rolls: 30, rarity: 2, next: ['prism', 10], desc: 'For 30 rolls the multiplier reel spins twice and keeps the bigger multiplier.' },
    { id: 'prism', name: 'Prism Lens', kind: 'lens', tries: 10, rolls: 30, rarity: 4, next: ['kaleido', 10], desc: 'For 30 rolls the multiplier reel spins ten times and keeps the biggest multiplier.' },
    { id: 'kaleido', name: 'Kaleidoscope Lens', kind: 'lens', tries: 100, rolls: 30, rarity: 7, desc: 'For 30 rolls the multiplier reel spins a hundred times and keeps the biggest multiplier.' },
    { id: 'overclock', name: 'Overclock', kind: 'overclock', speedup: 2, minutes: 3, rarity: 2, next: ['overclock2', 5], desc: 'Turbo rolls twice as fast for 3 minutes.' },
    { id: 'overclock2', name: 'Overclock II', kind: 'overclock', speedup: 4, minutes: 3, rarity: 4, next: ['overclock3', 10], desc: 'Turbo rolls four times as fast for 3 minutes.' },
    { id: 'overclock3', name: 'Overclock III', kind: 'overclock', speedup: 8, minutes: 3, rarity: 7, desc: 'Turbo rolls eight times as fast for 3 minutes.' },
    { id: 'coinmag', name: 'Coin Magnet', kind: 'coin', coin: 5, rolls: 500, rarity: 4, desc: 'Coins drop 5 times as often for 500 plain rolls.' },
    { id: 'tokencharm', name: 'Token Charm', kind: 'token', token: 3, rolls: 500, rarity: 4, desc: 'Three times the lucky tokens for 500 rolls.' },
    // Passive items are never used by hand: they do their job on their own.
    { id: 'freeze', name: 'Streak Freeze', kind: 'passive', rarity: 3, desc: 'Covers one missed day of your daily streak, on its own.' },
    { id: 'ticket', name: 'Quest Ticket', kind: 'passive', rarity: 2, desc: 'Rerolls a daily quest once the free reroll of the day is used.' },
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
    [1e4, [['luck10', 0.3], ['lens', 0.15], ['overclock', 0.05], ['horn', 0.03], ['coinmag', 0.02]]],
    [1e5, [['luck10', 0.4], ['luck100', 0.25], ['overclock', 0.2], ['horn', 0.1], ['tokencharm', 0.05]]],
    [1e6, [['luck100', 0.5], ['luck1k', 0.1], ['overclock', 0.4], ['horn', 0.2], ['prism', 0.05], ['coinmag', 0.1], ['tokencharm', 0.1]]],
    [1e7, [['luck1k', 0.3], ['goose', 0.1], ['prism', 0.2]]],
    [1e8, [['luck10k', 0.2], ['goose', 0.3], ['overclock2', 0.2]]],
    [1e9, [['luck100k', 0.15], ['luck1m', 0.03], ['goose2', 0.1], ['overclock2', 0.3]]],
    [1e10, [['luck1m', 0.2], ['luck10m', 0.05], ['goose3', 0.05], ['kaleido', 0.2], ['overclock3', 0.3]]],
    [1e12, [['luck10m', 0.3], ['luck100m', 0.05], ['goose3', 0.2], ['goose4', 0.02], ['kaleido', 0.5]]],
    [1e15, [['luck100m', 0.3], ['luck1b', 0.05], ['goose4', 0.1], ['overclock3', 1]]],
    [1e20, [['luck1b', 0.3], ['luck10b', 0.05], ['goose4', 0.3]]],
  ];
  const COIN_FROM = 100; // coins drop from rolls of 1 in 100 or rarer
  const tierOfN = n => ROLL_TIERS[1 + RARITIES.findIndex(r => 1 / n >= r.min)].id;
  // The coin slot: each spin costs one coin and pays out from this table. Chances are whole parts
  // of a billion and add up to exactly one billion. [item, quantity, parts, reel symbol]
  const COIN_CHANCE = 1 / 3;
  const SLOT_UNITS = 1e9;
  const SLOT_PRIZES = [ // every spin wins something
    ['luck10', 1, 389996880, '×10'], // the base prize; it gave 3,120 parts to the v3.3 prizes and 10,000,000 to the v3.6 ones
    ['luck10', 3, 150000000, '×10'],
    ['lens', 1, 120000000, 'Lens'],
    ['overclock', 1, 90000000, 'OC'],
    ['luck100', 1, 90000000, '×100'],
    ['horn', 1, 60000000, 'Horn'],
    ['luck100', 3, 30000000, '×100'],
    ['prism', 1, 22500000, 'Prism'],
    ['luck1k', 1, 19500000, '×1k'],
    ['overclock2', 1, 15000000, 'OC II'],
    ['coinmag', 1, 5000000, 'Magnet'],
    ['tokencharm', 1, 5000000, 'Token'],
    ['goose', 1, 1200000, 'Goose'],
    ['goose', 2, 225000, 'Goose'],
    ['goose', 5, 75000, 'Goose'],
    ['luck10k', 1, 900000, '×10k'],
    ['goose2', 1, 450000, 'Diamond'],
    ['luck100k', 1, 141750, '×100k'],
    ['luck1m', 1, 7500, '×1M'],
    ['luck10m', 1, 750, '×10M'],
    ['kaleido', 1, 1500, 'Kaleido'],
    ['overclock3', 1, 1500, 'OC III'],
    ['luck100m', 1, 75, '×100M'],
    ['goose3', 1, 45, 'Platinum'],
  ];
  if (SLOT_PRIZES.reduce((t, p) => t + p[2], 0) !== SLOT_UNITS) throw new Error('slot prize table does not add up');
  // Hard pity: go this many spins without one of these and the next spin pays it out for sure.
  // A natural win resets the count. If several are due at once, the rarest is paid first.
  const SLOT_PITY = { goose: 2000, luck10k: 3000, goose2: 7000, luck100k: 20000, luck1m: 250000, luck10m: 2500000, luck100m: 30000000 };
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
  const ACH_REWARD = { uncommon: 'luck10', rare: 'luck10', epic: 'lens', legendary: 'luck100', anomaly: 'horn', mythic: 'luck1k', divine: 'luck10k', cosmic: 'luck100k', transcendent: 'luck1m', ethereal: 'luck1m', celestial: 'luck10m', eternal: 'luck10m', infinite: 'luck10m', omega: 'luck10m', absolute: 'luck10m', primordial: 'luck10m', unfathomable: 'luck10m', c25: 'horn', c60: 'goose', c100: 'goose2', call: 'luck10m', slot100: 'prism', paradox: 'luck100m', singularity: 'luck100m', multiversal: 'luck1b', omniversal: 'luck1b', ineffable: 'luck10b', beyond: 'luck10b', oblivionRare: 'luck10m', abyssUncommon: 'luck1m', nmUncommon: 'goose2', hcEpic: 'goose', luck100lv: 'luck10m', r1m: 'luck1m', r10m: 'luck10m', c200: 'goose', c250: 'goose2', c300: 'luck10m', m100: 'luck1m', slot10k: 'luck100k', fuse100: 'goose', p5: 'luck1m', workshop1: 'tokencharm', workshopMax: 'luck1m', shop1: 'coinmag', shop1k: 'goose', streak7: 'freeze', streak30: 'goose2', weekly1: 'ticket', weeklyAll: 'luck1m', bingo1: 'prism', bingoFull: 'luck10m', mastery100: 'luck1k', mastery400: 'goose2', sheetRoll: 'overclock2', arcade1: 'luck10', hl5: 'luck100', hl10: 'luck10k', digit5: 'goose', wheel7: 'horn', wheelTop: 'luck10k', scratchWin: 'tokencharm', sevens: 'luck1m', bounty1: 'tokencharm', bounty10: 'goose', hunt3: 'lens', pageAll: 'luck10m', skinAll: 'goose2', secrets: 'luck100k', month: 'luck100k', chest: 'goose' };
  function grant(id, why, count = 1) {
    state.inv[id] = (state.inv[id] || 0) + count;
    const it = ITEM_BY_ID[id];
    toast(`${esc(why)}: <b>${esc(it.name)}</b>${count > 1 ? ` ×${fmt(count)}` : ''}`, RARITIES[it.rarity].id, 'item');
    if (!$('tab-inventory').hidden) renderInventory();
  }
  // A drop booster multiplies each chance; past 100% the whole part drops for sure and the rest is a chance at one more.
  function rollDrops(oneInLog) {
    const fx = state.effects, boost = dropActive(), magnet = coinActive();
    if (boost > 1) fx.drop.left--;
    if (magnet > 1) fx.coin.left--;
    const bag = {}, P = boost * prestigeBonus();
    dropsInto(bag, 10 ** oneInLog, P * wsBonus('itemSense') * eventDrops(), P * wsBonus('coinSense') * magnet * eventCoins());
    payDrops(bag);
  }
  // What one plain roll of 1 in n drops with item boost D and coin boost C, added to `bag`
  // ({ coins, [item]: count }).
  function dropsInto(bag, n, D, C = D) {
    if (n >= COIN_FROM) { // a 1 in 3 chance of a coin for the slot machine, boosted like any other drop
      const c = COIN_CHANCE * C, k = Math.floor(c) + (Math.random() < c % 1 ? 1 : 0);
      if (k) bag.coins = (bag.coins || 0) + k;
    }
    const row = [...DROPS].reverse().find(([from]) => n >= from);
    if (!row) return;
    for (const [id, chance] of row[1]) {
      const c = chance * D, k = Math.floor(c) + (Math.random() < c % 1 ? 1 : 0);
      if (k) bag[id] = (bag[id] || 0) + k;
    }
  }
  function payDrops(bag) {
    const { coins: k, ...items } = bag;
    if (k) {
      state.coins += k;
      questEvent('coin', k);
      toast(`Coin found${k > 1 ? `: <b>×${fmt(k)}</b>` : ''}, ${fmt(state.coins)} in hand`, 'mythic', 'item');
      if (!$('tab-inventory').hidden) renderSlot();
    }
    for (const [id, k] of Object.entries(items)) grant(id, 'Item found', k);
    if (Object.keys(items).length) autoFuse();
  }
  const luckActive = () => (state.effects.luck && state.effects.luck.left > 0 ? state.effects.luck.L : 1);
  const dropActive = () => (state.effects.drop && state.effects.drop.left > 0 ? state.effects.drop.D : 1);
  const coinActive = () => (state.effects.coin && state.effects.coin.left > 0 ? state.effects.coin.C : 1);
  const tokenActive = () => (state.effects.token && state.effects.token.left > 0 ? state.effects.token.K : 1);
  // Boosts that last a number of rolls: the effect slot, its power key, and the word for it.
  const BOOST_KEY = { luck: 'L', drop: 'D', coin: 'C', token: 'K' };
  const BOOST_WORD = { luck: 'Luck', drop: 'Drops', coin: 'Coins', token: 'Tokens' };
  // Tokens come in whole numbers; a fraction is a chance at one more.
  function addTokens(x) { state.tokens = (state.tokens || 0) + Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); }
  // Multiplier spins per roll: 100 with the Kaleidoscope Lens, 10 with the Prism Lens, 2 with the Multiplier Lens, else 1.
  const lensActive = () => ((state.effects.kaleido || 0) > 0 ? 100 : (state.effects.prism || 0) > 0 ? 10 : (state.effects.lens || 0) > 0 ? 2 : 1);
  const overclockLeft = () => Math.max(0, (state.effects.overclock || 0) - Date.now());
  const overclock2Left = () => Math.max(0, (state.effects.overclock2 || 0) - Date.now());
  const overclock3Left = () => Math.max(0, (state.effects.overclock3 || 0) - Date.now());
  const turboSpeedup = () => (overclock3Left() ? 8 : overclock2Left() ? 4 : overclockLeft() ? 2 : 1);
  // Use `times` of an item at once (Infinity: all of them). Their rolls or minutes add up.
  // `quiet`: used by Keep boosts going, which must never stop to ask.
  function useItem(id, times = 1, quiet = false) {
    const it = ITEM_BY_ID[id], fx = state.effects;
    if (!(state.inv[id] > 0) || it.kind === 'passive') return;
    const k = Math.min(times, state.inv[id]);
    if (it.kind in BOOST_KEY) {
      const slot = it.kind, power = it[it.kind], key = BOOST_KEY[it.kind], word = BOOST_WORD[it.kind];
      const cur = fx[slot] && fx[slot].left > 0 ? fx[slot] : null;
      if (cur && cur[key] > power) { $('invMsg').textContent = `${word} ×${fmt(cur[key])} is still active, so ${it.name} would do nothing yet.`; return; }
      if (cur && cur[key] < power && (quiet || !confirm(`${word} ×${fmt(cur[key])} has ${rollsText(cur.left)} left. Replace it with ×${fmt(power)}?`))) return;
      // The item id is kept so Keep boosts going knows what to use next.
      fx[slot] = cur && cur[key] === power ? { [key]: power, left: cur.left + k * it.rolls, id } : { [key]: power, left: k * it.rolls, id };
    }
    if (it.kind === 'lens') fx[it.id] = (fx[it.id] || 0) + k * it.rolls;
    if (it.kind === 'overclock') fx[it.id] = Math.max(Date.now(), fx[it.id] || 0) + k * it.minutes * 60000;
    state.inv[id] -= k;
    state.used = (state.used || 0) + k;
    checkAchievements();
    $('invMsg').textContent = k > 1 ? `Used ${fmt(k)} ${it.name}.` : `Used ${it.name}.`;
    if (quiet) toast(`Kept going: <b>${esc(it.name)}</b>, ${fmt(state.inv[id])} left`, RARITIES[it.rarity].id, 'item');
    save();
    if (!quiet || !$('tab-inventory').hidden) renderInventory();
    paintStatus();
  }
  // Keep boosts going: when a charm, lens or drop booster has just run out, use another of the same
  // item, if there is one. Called after every roll that uses up a boost.
  function renewBoosts() {
    if (!state.settings.renew) return;
    const fx = state.effects;
    for (const slot of Object.keys(BOOST_KEY)) {
      const e = fx[slot];
      if (e && e.left <= 0 && e.id && state.inv[e.id] > 0) useItem(e.id, 1, true);
    }
    for (const id of ['kaleido', 'prism', 'lens']) if (fx[id] === 0 && state.inv[id] > 0) useItem(id, 1, true);
  }
  $('renewBox').checked = !!state.settings.renew;
  $('renewBox').addEventListener('change', () => { state.settings.renew = $('renewBox').checked; renewBoosts(); save(); });
  // Lucky tokens: a 1 in 2 chance on every roll, more on harder difficulties. They buy permanent
  // luck levels; level k makes every roll the best of k + 1. Each level costs 12% more than the last.
  const TOKENS_PER = { standard: 1, hardcore: 2, nightmare: 3, abyss: 5, oblivion: 10 };
  const levelCost = k => Math.ceil(20 * 1.12 ** k);
  function upgradeLuck(times = 1) {
    let k = 0;
    while (k < times && (state.tokens || 0) >= levelCost(state.luckLevel || 0)) {
      state.tokens -= levelCost(state.luckLevel || 0);
      state.luckLevel = (state.luckLevel || 0) + 1;
      k++;
    }
    if (k) {
      toast(`Luck upgraded to level ${fmt(state.luckLevel)}: every roll is the best of ${fmt(permLuck())}`, 'legendary');
      checkAchievements();
      save();
      if (!$('tab-inventory').hidden) renderInventory();
      paintStatus();
    }
    return k;
  }
  function renderTokens() {
    const lv = state.luckLevel || 0, cost = levelCost(lv);
    $('tokenCount').textContent = fmt(state.tokens || 0);
    $('luckLevel').textContent = `Level ${fmt(lv)}: permanent luck ×${fmt(permLuck())}`;
    $('nextLevel').textContent = `Next level costs ${fmt(cost)} tokens and makes every roll the best of ${fmt(permLuck() + 1)}.`;
    $('upgradeOne').disabled = (state.tokens || 0) < cost;
    let n = 0, t = state.tokens || 0;
    while (t >= levelCost(lv + n) && n < 1e4) { t -= levelCost(lv + n); n++; }
    $('upgradeMax').disabled = n < 2;
    $('upgradeMax').textContent = n > 1 ? `Upgrade ${fmt(n)} levels` : 'Upgrade max';
  }
  // Token workshop: lasting upgrades bought with lucky tokens, kept through prestige like luck levels.
  // Each level adds `step` to a multiplier; each costs `grow` times the last.
  const WORKSHOP = [
    { id: 'coinSense', name: 'Coin sense', short: 'coins', step: 0.1, max: 20, base: 150, grow: 1.4, desc: 'Coins drop 10% more often per level.' },
    { id: 'itemSense', name: 'Item sense', short: 'item drops', step: 0.1, max: 20, base: 150, grow: 1.4, desc: 'Items drop 10% more often per level.' },
    { id: 'tokenSense', name: 'Token sense', short: 'tokens', step: 0.1, max: 20, base: 100, grow: 1.4, desc: '10% more lucky tokens per level.' },
    { id: 'questSense', name: 'Quest sense', short: 'quest coins', step: 0.25, max: 8, base: 300, grow: 1.8, desc: 'Daily quests pay 25% more coins per level.' },
  ];
  const WS_BY_ID = Object.fromEntries(WORKSHOP.map(w => [w.id, w]));
  const wsLevel = id => (state.workshop && state.workshop[id]) || 0;
  const wsBonus = id => 1 + WS_BY_ID[id].step * wsLevel(id);
  const wsCost = (w, lv) => Math.ceil(w.base * w.grow ** lv);
  function buyWorkshop(id) {
    const w = WS_BY_ID[id], lv = wsLevel(id);
    if (!w || lv >= w.max || (state.tokens || 0) < wsCost(w, lv)) return false;
    state.tokens -= wsCost(w, lv);
    state.workshop = { ...state.workshop, [id]: lv + 1 };
    toast(`${esc(w.name)} level ${lv + 1}: ${esc(w.short)} ×${+wsBonus(id).toFixed(2)}`, 'legendary');
    checkAchievements();
    save();
    if (!$('tab-inventory').hidden) renderInventory();
    paintStatus();
    return true;
  }
  function renderWorkshop() {
    $('workshop').innerHTML = WORKSHOP.map(w => {
      const lv = wsLevel(w.id), maxed = lv >= w.max, cost = wsCost(w, lv);
      return `<li style="--rc:${tierVar(maxed ? 'legendary' : 'uncommon')}"><div><b>${esc(w.name)}</b> <span class="muted num">level ${lv} of ${w.max}</span><br>`
        + `<span class="muted">${esc(w.desc)} Now ×${+wsBonus(w.id).toFixed(2)}${maxed ? ', the most it goes.' : `; next level ×${+(1 + w.step * (lv + 1)).toFixed(2)}.`}</span>`
        + `<div class="progress"><i style="width:${(100 * lv / w.max).toFixed(1)}%"></i></div></div>`
        + `<div class="item-actions">${maxed ? '<span class="muted">Maxed</span>' : `<button class="btn" type="button" data-ws="${w.id}" ${(state.tokens || 0) >= cost ? '' : 'disabled'} aria-label="Buy ${esc(w.name)} level ${lv + 1} for ${fmt(cost)} tokens">${fmt(cost)} tokens</button>`}</div></li>`;
    }).join('');
  }
  $('workshop').addEventListener('click', ev => { const b = ev.target.closest('[data-ws]'); if (b) buyWorkshop(b.dataset.ws); });

  // Coin shop: fixed prices, a sure way to an item. Each costs more coins than the slot needs on
  // average to pay it out, so the slot stays the better deal and the shop the dependable one.
  const SHOP = [['lens', 4], ['overclock', 5], ['luck100', 8], ['horn', 12], ['ticket', 20], ['freeze', 60], ['coinmag', 25], ['tokencharm', 25], ['prism', 30], ['overclock2', 40], ['luck1k', 60], ['goose', 900], ['luck10k', 1500]];
  function buyShop(id, k = 1) {
    const row = SHOP.find(x => x[0] === id);
    if (!row) return 0;
    k = Math.min(k, Math.floor(state.coins / row[1]));
    if (k < 1) return 0;
    state.coins -= k * row[1];
    state.shopSpent = (state.shopSpent || 0) + k * row[1];
    state.inv[id] = (state.inv[id] || 0) + k;
    $('shopMsg').textContent = `Bought ${k > 1 ? `${fmt(k)} ` : ''}${ITEM_BY_ID[id].name} for ${fmt(k * row[1])} ${k * row[1] === 1 ? 'coin' : 'coins'}. ${fmt(state.coins)} left.`;
    checkAchievements();
    autoFuse();
    save();
    if (!$('tab-inventory').hidden) { renderInventory(); renderSlot(); }
    return k;
  }
  function renderShop() {
    $('shopList').innerHTML = SHOP.map(([id, price]) => {
      const it = ITEM_BY_ID[id], can = Math.floor(state.coins / price);
      return `<li style="--rc:${tierVar(RARITIES[it.rarity].id)}"><div><b>${esc(it.name)}</b> <span class="muted num">${fmt(price)} ${price === 1 ? 'coin' : 'coins'}</span><br><span class="muted">${esc(it.desc)}</span></div>`
        + `<div class="item-actions"><button class="btn" type="button" data-buy="${id}" ${can ? '' : 'disabled'} aria-label="Buy one ${esc(it.name)} for ${price} coins">Buy</button>`
        + `<button class="btn" type="button" data-buy10="${id}" ${can >= 10 ? '' : 'disabled'} aria-label="Buy ten ${esc(it.name)} for ${fmt(price * 10)} coins">Buy 10</button></div></li>`;
    }).join('');
  }
  $('shopList').addEventListener('click', ev => {
    const one = ev.target.closest('[data-buy]'), ten = ev.target.closest('[data-buy10]');
    if (one) buyShop(one.dataset.buy, 1);
    if (ten) buyShop(ten.dataset.buy10, 10);
  });

  // Auto-fuse: Fuse everything on its own after drops, slot spins, purchases and rewards.
  function autoFuse() { if (state.settings.autoFuse) fuseEverything(true); }
  $('autoFuseBox').checked = !!state.settings.autoFuse;
  $('autoFuseBox').addEventListener('change', () => { state.settings.autoFuse = $('autoFuseBox').checked; autoFuse(); save(); });

  // Quick use: up to four items pinned in the Inventory sit under the roll buttons. The buttons are
  // only rebuilt when the pins change; counts update in place, so a click is never lost to a redraw.
  const MAX_PINS = 4;
  let pinKey = '';
  function renderQuickbar() {
    const pins = (state.settings.pins || []).filter(id => ITEM_BY_ID[id]);
    const bar = $('quickbar');
    bar.hidden = !pins.length;
    if (pins.join() !== pinKey) {
      pinKey = pins.join();
      bar.innerHTML = '<span class="muted">Quick use</span>' + pins.map(id => `<button class="btn" type="button" data-quick="${id}"><span></span></button>`).join('');
    }
    for (const b of bar.querySelectorAll('[data-quick]')) {
      const id = b.dataset.quick, k = state.inv[id] || 0;
      b.firstChild.textContent = `${ITEM_BY_ID[id].name} ×${fmt(k)}`;
      b.disabled = !k;
      b.setAttribute('aria-label', `Use ${ITEM_BY_ID[id].name}, ${fmt(k)} left`);
    }
  }
  $('quickbar').addEventListener('click', ev => { const b = ev.target.closest('[data-quick]'); if (b) useItem(b.dataset.quick); });
  function togglePin(id) {
    const pins = (state.settings.pins || []).filter(x => x !== id);
    if (pins.length === (state.settings.pins || []).length) {
      if (pins.length >= MAX_PINS) { $('invMsg').textContent = `Quick use holds ${MAX_PINS} items. Unpin one first.`; return; }
      pins.push(id);
    }
    state.settings.pins = pins;
    save();
    renderInventory();
    renderQuickbar();
  }

  $('upgradeOne').addEventListener('click', () => upgradeLuck(1));
  $('upgradeMax').addEventListener('click', () => upgradeLuck(Infinity));
  function effectsText() {
    const out = [];
    if (permLuck() > 1) out.push(`Permanent luck ×${fmt(permLuck())}`);
    if (luckActive() > 1) out.push(`Luck ×${fmt(state.effects.luck.L)}, ${rollsText(state.effects.luck.left)} left`);
    if (dropActive() > 1) out.push(`Drops ×${fmt(state.effects.drop.D)}, ${rollsText(state.effects.drop.left)} left`);
    if (coinActive() > 1) out.push(`Coin Magnet, coins ×${fmt(state.effects.coin.C)}, ${rollsText(state.effects.coin.left)} left`);
    if (tokenActive() > 1) out.push(`Token Charm, tokens ×${fmt(state.effects.token.K)}, ${rollsText(state.effects.token.left)} left`);
    for (const w of WORKSHOP) if (wsLevel(w.id)) out.push(`${w.name} level ${wsLevel(w.id)}, ${w.short} ×${+wsBonus(w.id).toFixed(2)}`);
    if ((state.effects.kaleido || 0) > 0) out.push(`Kaleidoscope Lens, ${rollsText(state.effects.kaleido)} left`);
    if ((state.effects.prism || 0) > 0) out.push(`Prism Lens, ${rollsText(state.effects.prism)} left`);
    if ((state.effects.lens || 0) > 0) out.push(`Multiplier Lens, ${rollsText(state.effects.lens)} left`);
    const clock = ms => {
      const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
      if (d >= 1) return `${fmt(d)} ${d === 1 ? 'day' : 'days'} ${h % 24} h`;
      if (h >= 1) return `${h} h ${m % 60} min`;
      return `${m}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
    };
    if (overclock3Left()) out.push(`Overclock III, ${clock(overclock3Left())} left`);
    if (overclock2Left()) out.push(`Overclock II, ${clock(overclock2Left())} left`);
    if (overclockLeft()) out.push(`Overclock, ${clock(overclockLeft())} left`);
    return out;
  }
  function renderInventory() {
    renderTokens();
    renderWorkshop();
    renderShop();
    renderQuickbar();
    const fx = effectsText();
    $('effects').innerHTML = fx.length ? fx.map(t => `<li>${esc(t)}</li>`).join('') : '<li class="muted">Nothing active. Use an item below.</li>';
    const total = ITEMS.reduce((t, i) => t + (state.inv[i.id] || 0), 0);
    $('invCount').textContent = `${fmt(total)} ${total === 1 ? 'item' : 'items'}`;
    $('fuseEverything').disabled = !ITEMS.some(it => it.next && (state.inv[it.id] || 0) >= it.next[1]);
    $('invList').innerHTML = ITEMS.filter(it => !it.retired || state.inv[it.id] > 0).map(it => {
      const k = state.inv[it.id] || 0;
      if (it.retired && !it.desc.includes('Retired')) it.desc += ' Retired: it no longer drops or comes from the slot, but it still works and fuses upwards.';
      const can = it.next ? Math.floor(k / it.next[1]) : 0;
      const fuse = it.next ? `<button class="btn" type="button" data-fuse="${it.id}" ${can ? '' : 'disabled'} aria-label="Fuse ${it.next[1]} ${esc(it.name)} into one ${esc(ITEM_BY_ID[it.next[0]].name)}">Fuse ${it.next[1]} → 1</button>`
        + `<button class="btn" type="button" data-fuse-all="${it.id}" ${can > 1 ? '' : 'disabled'} aria-label="Fuse every ${esc(it.name)} you can">Fuse all${can > 1 ? ` (${fmt(can)})` : ''}</button>` : '';
      return `<li class="item${k ? '' : ' none'}" style="--rc:${tierVar(RARITIES[it.rarity].id)}"><div><b>${esc(it.name)}</b> <span class="muted num">×${fmt(k)}</span><br><span class="muted">${esc(it.desc)}${it.next ? ` Fuse ${it.next[1]} into a ${esc(ITEM_BY_ID[it.next[0]].name)}.` : ''}</span></div>`
        + (it.kind === 'passive' ? '<div class="item-actions"><span class="muted">Works on its own</span></div></li>'
          : `<div class="item-actions">${fuse}<button class="btn" type="button" data-use="${it.id}" ${k ? '' : 'disabled'} aria-label="Use ${esc(it.name)}">Use</button>`
          + `<button class="btn" type="button" data-pin="${it.id}" aria-pressed="${(state.settings.pins || []).includes(it.id)}" aria-label="Pin ${esc(it.name)} to Quick use on the Roll tab">Pin</button>`
          + `<button class="btn" type="button" data-use-all="${it.id}" ${k > 1 ? '' : 'disabled'} aria-label="Use every ${esc(it.name)}">Use all${k > 1 ? ` (${fmt(k)})` : ''}</button></div></li>`);
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
  // Big batches: up to SPIN_EXACT spins are played one by one. Past that, prizes are counted
  // without playing each spin, so a billion spins take milliseconds. Each pity prize is its own
  // run of wins, each gap the shorter of a natural wait (geometric at the prize's chance) and its
  // pity count; every other spin draws from the rest of the table, counted with binomial draws.
  const SPIN_EXACT = 1e5;
  const rbuf = new Uint32Array(4096);
  let rpos = rbuf.length;
  const rand01 = () => { if (rpos === rbuf.length) { crypto.getRandomValues(rbuf); rpos = 0; } return (rbuf[rpos++] + 0.5) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rand01())) * Math.cos(2 * Math.PI * rand01());
  const geometric = p => Math.floor(Math.log(rand01()) / Math.log1p(-p)) + 1; // trials until the first success
  function binomial(n, p) {
    if (n <= 0 || p <= 0) return 0;
    if (p >= 1) return n;
    if (n * p < 1000) { let k = 0; for (let at = geometric(p); at <= n; at += geometric(p)) k++; return k; }
    return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * gauss())));
  }
  function spinBatch(n) {
    const totals = new Map(), add = (id, q) => totals.set(id, (totals.get(id) || 0) + q);
    let pityWins = 0, used = 0;
    for (const id of Object.keys(SLOT_PITY)) {
      const rows = SLOT_PRIZES.filter(r => r[0] === id), parts = rows.reduce((t, r) => t + r[2], 0), p = parts / SLOT_UNITS, cap = SLOT_PITY[id];
      let at = 0, since = state.pity[id] || 0;
      for (;;) {
        const wait = geometric(p), pity = cap - since; // spins until the next natural win, and until pity pays
        const step = Math.min(wait, pity);
        if (at + step > n) { since += n - at; break; }
        at += step;
        since = 0;
        used++;
        if (wait < pity) { let u = rand01() * parts; const row = rows.find(r => (u -= r[2]) < 0) || rows[0]; add(id, row[1]); }
        else { add(id, rows[0][1]); pityWins++; }
      }
      state.pity[id] = since;
    }
    let left = n - used, mass = SLOT_PRIZES.filter(r => !(r[0] in SLOT_PITY)).reduce((t, r) => t + r[2], 0);
    for (const [id, qty, parts] of SLOT_PRIZES) {
      if (id in SLOT_PITY) continue;
      const k = mass === parts ? left : binomial(left, parts / mass);
      if (k) add(id, k * qty);
      left -= k;
      mass -= parts;
    }
    return { totals, pityWins };
  }
  async function spinSlot(n) {
    if (n === 'all') n = state.coins;
    if (slotBusy || n < 1 || state.coins < n) return;
    slotBusy = true;
    state.coins -= n;
    state.spins += n;
    let results = null, totals, pityWins;
    if (n <= SPIN_EXACT) {
      results = Array.from({ length: n }, spinOnce);
      totals = new Map();
      for (const [id, qty] of results) totals.set(id, (totals.get(id) || 0) + qty);
      pityWins = results.filter(p => p.pity).length;
    } else ({ totals, pityWins } = spinBatch(n));
    questEvent('spin', n);
    for (const [id, qty] of totals) state.inv[id] = (state.inv[id] || 0) + qty;
    autoFuse();
    checkAchievements();
    save();
    renderSlot();
    // Show the best prize of the batch on the reels as three matching symbols.
    const best = SLOT_PRIZES.filter(r => totals.has(r[0])).reduce((a, b) => (b[2] < a[2] ? b : a));
    const faces = [best[3], best[3], best[3]];
    const color = tierVar(RARITIES[ITEM_BY_ID[best[0]].rarity].id);
    if (effects() === 'off') slotReels.forEach((r, i) => setReel(r, faces[i], false));
    else await Promise.all(slotReels.map((r, i) => spinReel(r, faces[i], 500 + i * 220, 14 + i * 4, false, slotFace, () => tick(i))));
    slotReels.forEach(r => { r.style.setProperty('--tc', color); r.classList.toggle('hit', ITEM_BY_ID[best[0]].rarity >= 5); });
    const prizeText = p => `${ITEM_BY_ID[p[0]].name}${p[1] > 1 ? ` ×${p[1]}` : ''}${p.pity ? ' (pity)' : ''}`;
    const colored = (id, text) => `<b style="color:${tierVar(RARITIES[ITEM_BY_ID[id].rarity].id)}">${esc(text)}</b>`;
    if (n <= 5) {
      $('slotResult').innerHTML = (n > 1 ? results.map((p, k) => `<li>Spin ${k + 1}: ${colored(p[0], prizeText(p))}</li>`).join('') : '')
        + `<li><b>Won ${results.map(prizeText).map(esc).join(', ')}</b></li>`;
    } else { // bigger batches: totals per item, rarest first
      const rows = [...totals].sort((a, b) => ITEM_BY_ID[b[0]].rarity - ITEM_BY_ID[a[0]].rarity);
      $('slotResult').innerHTML = `<li><b>${fmt(n)} spins won:</b></li>`
        + `<li>${rows.map(([id, k]) => colored(id, `${ITEM_BY_ID[id].name} ×${fmt(k)}`)).join(', ')}</li>`
        + (pityWins ? `<li class="muted">${fmt(pityWins)} of them paid out by pity</li>` : '');
    }
    const top = [...totals.keys()].filter(id => ITEM_BY_ID[id].rarity >= 5).sort((a, b) => ITEM_BY_ID[b].rarity - ITEM_BY_ID[a].rarity)[0];
    if (top) {
      toast(`Jackpot: <b>${esc(ITEM_BY_ID[top].name)}${totals.get(top) > 1 ? ` ×${fmt(totals.get(top))}` : ''}</b>`, RARITIES[ITEM_BY_ID[top].rarity].id);
      if (effects() === 'full') burst(cssVar(`--r-${RARITIES[ITEM_BY_ID[top].rarity].id}`), 200, 14);
      fanfare(8);
    } else fanfare(Math.min(6, 2 + n));
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

  // Fuse `times` sets of an item into the next one up (Infinity: as many as you have).
  function fuseItem(id, times = 1) {
    const it = ITEM_BY_ID[id];
    if (!it.next) return 0;
    const k = Math.min(times, Math.floor((state.inv[id] || 0) / it.next[1]));
    if (!k) return 0;
    state.inv[id] -= k * it.next[1];
    state.fused = (state.fused || 0) + k;
    grant(it.next[0], `Fused ${fmt(k * it.next[1])} ${it.name}`, k);
    checkAchievements();
    save();
    renderInventory();
    return k;
  }
  // Fuse everything: every item fuses as far up its line as it can go, bottom first, so the
  // results of one fuse can feed the next.
  // `quiet`: from auto-fuse, which skips redrawing an Inventory tab nobody is looking at.
  function fuseEverything(quiet = false) {
    const before = { ...state.inv };
    let fused = 0;
    for (let again = true; again;) {
      again = false;
      for (const it of ITEMS) {
        if (!it.next) continue;
        const k = Math.floor((state.inv[it.id] || 0) / it.next[1]);
        if (!k) continue;
        state.inv[it.id] -= k * it.next[1];
        state.inv[it.next[0]] = (state.inv[it.next[0]] || 0) + k;
        fused += k;
        again = true;
      }
    }
    if (!fused) return '';
    state.fused = (state.fused || 0) + fused;
    const gained = ITEMS.filter(it => (state.inv[it.id] || 0) > (before[it.id] || 0)).map(it => `${it.name} ×${fmt(state.inv[it.id] - (before[it.id] || 0))}`);
    const text = `Fused everything: ${fmt(fused)} ${fused === 1 ? 'fuse' : 'fuses'}, gaining ${gained.join(', ')}.`;
    if (!fullSkin()) toast(esc(text), 'legendary', quiet ? 'item' : '');
    $('invMsg').textContent = text;
    checkAchievements();
    save();
    if (!quiet || !$('tab-inventory').hidden) renderInventory();
    return text;
  }
  $('fuseEverything').addEventListener('click', fuseEverything);
  // Luck: keep the best of L independent rolls. Up to INLINE_LUCK the L rolls are really rolled;
  // beyond it the lucky roll is built (see pickSync below).
  const INLINE_LUCK = 8;
  function pickInline(mode, L, lens, t) {
    let pick = null;
    for (let k = 0; k < L; k++) {
      const roll = G.randomParams(mode), n = G.randomRoll();
      if (state.difficulty !== 'standard') { roll.d = state.difficulty; roll.mult = 'unity'; }
      for (let j = 1; j < lens; j++) { const alt = G.randomParams(mode).mult; if (MULT_BY_ID[alt].log > MULT_BY_ID[roll.mult].log) roll.mult = alt; }
      const rank = L > 1 ? G.score(n, dayKey(t), roll).rank : 0;
      if (!pick || rank > pick.rank) pick = { roll, n, rank };
    }
    return pick;
  }
  // Luck in play: a charm times your permanent luck level, on every difficulty. Above INLINE_LUCK the
  // best of L is not rolled L times: its luck is drawn from the exact odds of a best-of-L and a real
  // roll that lucky is built, which takes about a millisecond however big L is. On Standard the roll is
  // built from the multiplier reel (G.luckyPick); the harder difficulties have no reel, so it is built
  // from rare badge numbers (G.hardPick). A lens multiplies the tries like luck does; with no reel to
  // spin, lenses do nothing off Standard.
  const permLuck = () => (state.luckLevel || 0) + 1;
  const hard = () => state.difficulty && state.difficulty !== 'standard';
  const effLuck = () => luckActive() * permLuck();
  const effLens = () => (hard() ? 1 : lensActive());
  function pickSync(mode, L, lens, t) {
    if (L <= INLINE_LUCK) return pickInline(mode, L, lens, t);
    const built = hard() ? G.hardPick(mode, L, dayKey(t), state.difficulty) : G.luckyPick(mode, L * lens, dayKey(t));
    return built || pickInline(mode, INLINE_LUCK, lens, t);
  }
  async function pickRoll(mode, L, lens, t) { return pickSync(mode, L, lens, t); }
  // One roll's bookkeeping, with no drawing, so Turbo can take several per screen frame.
  const takeRoll = () => { const t = Date.now(), L = effLuck(), lens = effLens(); return commitRoll(pickSync(state.mode, L, lens, t), state.mode, L, lens, t); };
  async function takeRollAsync() {
    const mode = state.mode, L = effLuck(), lens = effLens(), t = Date.now();
    return commitRoll(await pickRoll(mode, L, lens, t), mode, L, lens, t);
  }
  function commitRoll(pick, mode, L, lens, t) {
    const { roll, n } = pick;
    const x = { n, t, mode, x: roll.mult };
    if (roll.e) x.e = roll.e;
    if (roll.m) x.m = roll.m;
    if (roll.t !== undefined) x.tg = roll.t;
    if (hard()) x.d = state.difficulty;
    const charmed = luckActive() > 1; // charms block drops; permanent luck does not
    if (L > 1) x.b = L;
    if (charmed) state.effects.luck.left = Math.max(0, state.effects.luck.left - 1);
    if (lens > 1) {
      x.lens = lens;
      const which = lens === 100 ? 'kaleido' : lens === 10 ? 'prism' : 'lens';
      state.effects[which] = Math.max(0, state.effects[which] - 1);
    }
    const rec = record(x);
    if (auto && (!run.best || rec.entry.oneInLog > run.best.oneInLog)) run.best = rec.entry;
    if (!charmed && !x.lens) rollDrops(rec.entry.oneInLog); // charm and lens rolls never drop items, so boosts cannot feed themselves
    const tk = tokenActive();
    if (tk > 1) state.effects.token.left--;
    if (randInt(2) === 0) addTokens(TOKENS_PER[state.difficulty || 'standard'] * tk * wsBonus('tokenSense')); // lucky tokens: 1 in 2 rolls, any tier
    renewBoosts();
    save();
    run.rolls++;
    for (const b of rec.r.badges) {
      if (!rec.fresh.has(b.id)) continue;
      toast(`New badge: <b>${esc(b.name)}</b> (${RARITIES[b.rarity].name})`, RARITIES[b.rarity].id, 'badge');
      const skin = SKINS.find(k => k.badge === b.id);
      if (skin) unlockSkin(skin.id, b.name);
    }
    if (rec.freshMult) toast(`New multiplier: <b>× ${esc(rec.r.mult.symbol)} ${esc(rec.r.mult.name)}</b>`, RARITIES[rec.r.mult.rarity].id, 'badge');
    let found = false;
    const hit = id => (id.startsWith('x:') ? rec.r.mult.id === id.slice(2) : rec.r.badges.some(b => b.id === id));
    const foundIt = (id, rolls) => {
      toast(`Found <b>${esc(huntName(id))}</b> after ${fmt(rolls)} ${rolls === 1 ? 'roll' : 'rolls'}`, 'rare');
      state.huntsDone++;
      state.lastHuntP = huntP(id);
      state.rec.hunt = Math.max(state.rec.hunt || 0, rolls);
      found = true;
    };
    if (hunt) { huntRolls++; if (hit(hunt)) { foundIt(hunt, huntRolls); huntRolls = 0; } }
    for (const h of alsoHunt) { h.rolls++; if (hit(h.id)) { foundIt(h.id, h.rolls); h.done = true; } }
    if (alsoHunt.some(h => h.done)) { alsoHunt = alsoHunt.filter(h => !h.done); paintAlsoHunt(); }
    markBingo(rec.r.badges);
    checkBounties(rec);
    questEvent('roll');
    questEvent('mode', 1, q => q.mode === x.mode);
    questEvent('tier', 1, q => T(rec.entry.tier) >= T(q.tier));
    if (rec.fresh.size) questEvent('fresh');
    if (rec.r.mult.id !== 'unity' && rec.r.mult.rarity >= 2) questEvent('mult');
    checkAchievements(rec);
    if (fullSkin()) fullRoll(rec.entry);
    // `stop`: what ends Auto. A hunt target, or with the setting on, a badge you did not have.
    return { x, rec, found, stop: found || (!!state.settings.stopNew && rec.fresh.size > 0) };
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
  // `instant`: the Roll button shows its result at once, with no reels spinning and no badges
  // trickling in. Auto keeps the reels at its 1× and 2× speeds.
  async function rollOnce(instant = false) {
    const roll = await takeRollAsync();
    if (!instant && speed !== 3) $('result').hidden = true;
    await spinTo(roll.x, instant || consoleOn() ? 3 : speed); // the Console shows no reels, so nothing to wait for
    freshEntry = roll.rec.madeSession || roll.rec.madeHof ? roll.rec.entry : null;
    drawRoll(roll, instant ? Math.max(speed, 2) : speed, !!freshEntry);
    return { tier: roll.rec.tier, found: roll.found, stop: roll.stop };
  }

  // Turbo: rolls run on their own steady clock (90 to 1,000 a second, set under Auto settings) in small slices that never block the
  // page for more than a few milliseconds. Drawing happens at most once per screen frame and shows
  // the rarest roll since the last frame, so a Mythic is never skipped over. A hidden tab or a
  // throttled screen slows the drawing, never the rolling.
  const TURBO_RATES = [90, 250, 500, 1000, 2000, 5000]; // rolls per second
  const turboRate = () => (TURBO_RATES.includes(state.settings.turboRate) ? state.settings.turboRate : 90);
  async function turboLoop(kind) {
    let last = performance.now(), owed = 0, best = null, changed = false, framePending = false, statusAt = 0;
    const draw = () => {
      framePending = false;
      if (best && !document.hidden) { drawRoll(best, 3, changed); best = null; changed = false; }
    };
    while (auto === kind && speed === 3 && ready[state.mode]) {
      await sleep(15);
      const now = performance.now();
      const rate = turboRate() * turboSpeedup();
      owed = Math.min(owed + ((now - last) / 1000) * rate, rate); // at most a second of catch-up
      // Small slices keep the page smooth; when the browser throttles timers (a hidden tab), ticks
      // come late, so take a bigger slice, still under the 50 ms that feels like lag.
      // Faster rates get a bigger slice of each tick.
      const budget = now - last > 100 ? 40 : rate >= 2000 ? 12 : rate > 300 ? 10 : 6;
      last = now;
      let stop = false;
      const start = performance.now();
      while (owed >= 1 && performance.now() - start < budget && auto === kind) {
        owed--;
        const roll = takeRoll();
        if (roll.rec.madeSession || roll.rec.madeHof) { changed = true; freshEntry = roll.rec.entry; }
        if (!best || roll.rec.entry.oneInLog > best.rec.entry.oneInLog) best = roll;
        if (kind === 'auto' && (roll.stop || T(roll.rec.tier.id) >= +$('stopAt').value)) { best = roll; stop = true; break; }
        if (kind === 'endless' && endlessDone()) { stop = 'limit'; break; }
      }
      if (stop) { draw(); if (stop === 'limit') stopEndless(); else setAuto(null); return; }
      if (best && !framePending) { framePending = true; requestAnimationFrame(draw); }
      if (now - statusAt > 250 && !document.hidden) { statusAt = now; paintStatus(); } // counters stay current even when frames are slow
    }
  }

  function paintStatus() {
    const parts = [];
    if (session.rolls) {
      const best = session.best[state.mode][0];
      parts.push(`This session: <b class="num">${fmt(session.rolls)}</b> ${session.rolls === 1 ? 'roll' : 'rolls'}`
        + (best ? `, best <b style="color:${tierVar(best.tier)}">${ROLL_TIERS[T(best.tier)].name}</b>` : ''));
    }
    if (auto === 'endless') {
      const secs = (performance.now() - run.start) / 1000;
      const L = effLuck();
      if (secs > 10) state.rec.rate = Math.max(state.rec.rate || 0, run.rolls / secs); // a fair rate needs a few seconds
      parts.push(`Endless keeps rolling until you press Stop${secs > 3 ? `, about ${fmt(run.rolls / secs)} rolls a second` : ''}`
        + (L > 1 && speed === 3 ? ` (luck ×${fmt(L)} makes every roll the best of ${fmt(L)}, which is slower than a plain roll)` : ''));
    }
    if (hunt) parts.push(`Hunting <b>${esc(huntName(hunt))}</b> (${odds(huntP(hunt))}), <span class="num">${fmt(huntRolls)}</span> rolls so far`);
    for (const h of alsoHunt) parts.push(`Also hunting <b>${esc(huntName(h.id))}</b> (${odds(huntP(h.id))}), <span class="num">${fmt(h.rolls)}</span> rolls so far`);
    if (auto === 'endless' && state.settings.endlessLimit) parts.push(`Stops after ${esc($('endlessLimit').selectedOptions[0].textContent)}`);
    if (hard()) parts.push(`<b>${esc(G.DIFF_BY_ID[state.difficulty].name)}:</b> no multiplier, only badges count`);
    const fx = effectsText();
    if (inLuckyHour()) fx.unshift(`Lucky hour, drops and coins ×2 until ${hourText(luckyHour() + 1)}`);
    if (weekend()) fx.unshift('Weekend, coins ×2');
    if (fx.length) parts.push(`<b>Active:</b> ${esc(fx.join(' · '))}`);
    parts.push(`<span class="muted">Lucky tokens: <b class="num">${fmt(state.tokens || 0)}</b></span>`);
    $('status').innerHTML = parts.join('<br>');
    renderQuickbar();
  }

  async function rollClicked() {
    if (auto) { setAuto(null); return; }
    if (batching) { batching.stop = true; return; } // a batch played roll by roll for a hunt
    if (busy || !ready[state.mode]) return;
    busy = true;
    paintRollButton();
    await rollOnce(true);
    busy = false;
    paintRollButton();
  }
  $('rollBtn').addEventListener('click', rollClicked);

  // Batch roll: n rolls at once, drawn with the best of the batch and a count per tier.
  // The batch is counted, not played one roll at a time, so it takes a few milliseconds at any size.
  // Its best roll is real: the best of m rolls with luck L is one roll with luck m × L, built at
  // once like any lucky roll and recorded like any other. The other m - 1 rolls are drawn from the
  // same odds, below the best, and land as if played: tiers, item drops, coins, lucky tokens, totals
  // and quest progress. They do not collect badges or enter the roll log. A charm, lens or drop
  // booster that runs out partway splits the batch, so each part rolls with what was active.
  // While a hunt is on, a batch plays every roll instead, so the hunt can find its target.
  // Bands of 1 in N a counted roll can land in: every tier edge, every drop row and the coin edge.
  const BAND_FROM = [...new Set([...RARITIES.map(r => r.from), ...DROPS.map(d => d[0]), COIN_FROM])].sort((a, b) => a - b);
  const BAND_TIER = BAND_FROM.map(N => RARITIES.filter(r => r.from <= N).pop().id);
  const reachCache = {};
  // For each band edge, the chance that one plain roll reaches it; `trash`: the chance of leaving Trash.
  function reachLadder(mode) {
    const d = state.difficulty || 'standard', key = mode + d;
    return reachCache[key] || (reachCache[key] = {
      trash: G.reachChance(0.99, mode, d),
      edges: BAND_FROM.map(N => G.reachChance(1 / N, mode, d)),
    });
  }
  // How m rolls with luck Leff, none beating band `top` (-1: none beating Trash), spread over the
  // bands. A roll with luck misses an edge only if all Leff of its tries miss it: (1 - s)^Leff.
  function spreadRolls(m, Leff, top, mode) {
    const { trash, edges } = reachLadder(mode);
    const miss = s => Math.exp(Leff * Math.log1p(-Math.min(s, 1)));
    const w = [miss(trash)]; // index 0 is Trash, index j + 1 is band j
    for (let j = 0; j <= top; j++) w.push((j + 1 < edges.length ? miss(edges[j + 1]) : 1) - (j ? miss(edges[j]) : miss(trash)));
    const cum = [];
    let total = 0;
    for (const x of w) cum.push(total += Math.max(0, x));
    const counts = new Array(w.length).fill(0);
    if (!(total > 0)) { counts[w.length - 1] = m; return counts; }
    for (let i = 0; i < m; i++) {
      const u = Math.random() * total;
      let k = 0;
      while (k < cum.length - 1 && u >= cum[k]) k++;
      counts[k]++;
    }
    return counts;
  }
  function heads(k) { // how many of k fair coin flips come up heads
    const buf = new Uint32Array(Math.ceil(k / 32) || 1);
    crypto.getRandomValues(buf);
    let h = 0;
    for (let i = 0; i < k; i++) h += (buf[i >> 5] >>> (i & 31)) & 1;
    return h;
  }
  function countBatch(n) {
    const tiers = {}, bag = {}, add = (id, k) => { tiers[id] = (tiers[id] || 0) + k; };
    let best = null, changed = false, left = n;
    while (left > 0) {
      const fx = state.effects, mode = state.mode, t = Date.now();
      const L = effLuck(), lens = effLens(), charmed = luckActive() > 1, plain = !charmed && lens === 1;
      const lensKey = lens === 100 ? 'kaleido' : lens === 10 ? 'prism' : 'lens';
      const boost = plain ? dropActive() : 1, magnet = plain ? coinActive() : 1, tk = tokenActive();
      let m = left;
      if (charmed) m = Math.min(m, fx.luck.left);
      if (lens > 1) m = Math.min(m, fx[lensKey]);
      if (boost > 1) m = Math.min(m, fx.drop.left);
      if (magnet > 1) m = Math.min(m, fx.coin.left);
      if (tk > 1) m = Math.min(m, fx.token.left);
      left -= m;
      // The part's best, built and played for real (it uses up one charm, lens and booster roll).
      const roll = commitRoll(pickSync(mode, L * m, lens, t), mode, L, lens, t);
      add(roll.rec.tier.id, 1);
      if (roll.rec.madeSession || roll.rec.madeHof) { changed = true; freshEntry = roll.rec.entry; }
      if (!best || roll.rec.entry.oneInLog > best.rec.entry.oneInLog) best = roll;
      const r = m - 1;
      if (!r) continue;
      const N = 10 ** roll.rec.entry.oneInLog;
      const top = roll.rec.tier.id === 'trash' ? -1 : BAND_FROM.filter(f => f <= N * (1 + 1e-9)).length - 1;
      const counts = spreadRolls(r, hard() ? L : L * lens, top, mode);
      state.total += r;
      state.totals[mode] += r;
      const day = dayKey(t);
      state.daily[day] = (state.daily[day] || 0) + r;
      session.rolls += r;
      run.rolls += r;
      if (L > 1 || lens > 1 || hard()) state.boosted += r;
      if (charmed) fx.luck.left = Math.max(0, fx.luck.left - r);
      if (lens > 1) fx[lensKey] = Math.max(0, fx[lensKey] - r);
      if (boost > 1) fx.drop.left = Math.max(0, fx.drop.left - r);
      if (magnet > 1) fx.coin.left = Math.max(0, fx.coin.left - r);
      if (tk > 1) fx.token.left = Math.max(0, fx.token.left - r);
      renewBoosts(); // the next part of the batch rolls with the renewed boost
      const D = boost * prestigeBonus() * wsBonus('itemSense') * eventDrops(), C = boost * prestigeBonus() * wsBonus('coinSense') * magnet * eventCoins();
      counts.forEach((c, k) => {
        if (!c) return;
        const id = k ? BAND_TIER[k - 1] : 'trash';
        add(id, c);
        if (!(L > 1 || lens > 1 || hard())) state.tiers[mode][id] = (state.tiers[mode][id] || 0) + c;
        questEvent('tier', c, q => T(id) >= T(q.tier));
        if (plain && k && BAND_FROM[k - 1] >= COIN_FROM) for (let i = 0; i < c; i++) dropsInto(bag, BAND_FROM[k - 1], D, C);
      });
      addTokens(heads(r) * TOKENS_PER[state.difficulty || 'standard'] * tk * wsBonus('tokenSense'));
      questEvent('roll', r);
      questEvent('mode', r, q => q.mode === mode);
    }
    payDrops(bag);
    noteRecords();
    checkAchievements();
    save();
    return { tiers, best, changed };
  }
  // Gives the page a turn without a timer: browsers slow timers in background tabs to one a second,
  // but not messages.
  const yieldNow = () => new Promise(resolve => { const c = new MessageChannel(); c.port1.onmessage = () => resolve(); c.port2.postMessage(0); });
  // n rolls, then draws the best of them: counted at once, or played one by one during a hunt
  // (stopping early if `keepGoing` turns false).
  async function runBatch(n, keepGoing = () => true) {
    if (!hunting()) {
      const start = performance.now(), { tiers, best, changed } = countBatch(n);
      if (best) drawRoll(best, 3, changed);
      return { n, secs: (performance.now() - start) / 1000, tiers, best };
    }
    batching = { n, done: 0, stop: false };
    paintRollButton();
    const start = performance.now(), tiers = {};
    let best = null, changed = false, hit = false;
    while (batching.done < n && keepGoing() && !batching.stop) {
      const slice = performance.now();
      while (batching.done < n && performance.now() - slice < 40) {
        const roll = takeRoll();
        batching.done++;
        tiers[roll.rec.tier.id] = (tiers[roll.rec.tier.id] || 0) + 1;
        if (roll.rec.madeSession || roll.rec.madeHof) { changed = true; freshEntry = roll.rec.entry; }
        if (!best || roll.rec.entry.oneInLog > best.rec.entry.oneInLog) best = roll;
        if (roll.found) { hit = true; break; } // the hunt is over, so the rest of the batch need not be played
      }
      paintBatch();
      if (hit) break;
      await yieldNow();
    }
    const done = batching.done, secs = (performance.now() - start) / 1000;
    batching = null;
    if (best) drawRoll(best, 3, changed);
    return { n: done, secs, tiers, best, played: true };
  }
  const tierList = tiers => ROLL_TIERS.filter(t => tiers[t.id]).reverse()
    .map(t => `<b style="color:${tierVar(t.id)}">${t.name}</b> ${fmt(tiers[t.id])}`).join(', ');
  async function batchRoll(n) {
    if (auto || busy || batching || !ready[state.mode]) return;
    busy = true;
    paintRollButton();
    const r = await runBatch(n);
    busy = false;
    $('batchResult').hidden = false;
    $('batchResult').innerHTML = (r.played ? `${fmt(r.n)} of ${fmt(n)} rolls in ${r.secs.toFixed(1)} s, played one by one for the hunt${r.n < n ? ', stopped early' : ''}.` : `${fmt(r.n)} rolls.`)
      + ` Best shown above. ${tierList(r.tiers)}`;
    paintRollButton();
    paintBatch();
  }
  // Endless in batches: one batch a second, each shown with its stats and the run's totals. A
  // background tab whose timers were slowed rolls the batches it missed when it wakes, up to a
  // minute's worth. Stop ends it at once.
  const BATCH_EVERY = 1000; // ms
  async function batchLoop() {
    const tot = { batches: 0, n: 0, tiers: {}, best: null, start: performance.now() };
    let next = performance.now();
    while (auto === 'endless' && ready[state.mode]) {
      const size = +state.settings.batch || 0;
      if (!size) return;
      const r = await runBatch(size, () => auto === 'endless');
      tot.batches++;
      tot.n += r.n;
      for (const [k, v] of Object.entries(r.tiers)) tot.tiers[k] = (tot.tiers[k] || 0) + v;
      if (r.best && (!tot.best || r.best.rec.entry.oneInLog > tot.best.oneInLog)) tot.best = r.best.rec.entry;
      const bestText = e => (e ? `<b style="color:${tierVar(e.tier)}">${ROLL_TIERS[T(e.tier)].name}</b> ${esc(oneText(e))}` : 'none');
      const secs = Math.max((performance.now() - tot.start) / 1000, 1);
      if (secs > 10) state.rec.rate = Math.max(state.rec.rate || 0, tot.n / secs);
      $('batchResult').hidden = false;
      $('batchResult').innerHTML = `<b>Batch ${fmt(tot.batches)}:</b> ${fmt(r.n)} rolls${r.played ? ` in ${r.secs.toFixed(1)} s` : ''}, best ${bestText(r.best && r.best.rec.entry)}. ${tierList(r.tiers)}`
        + `<br><b>This run:</b> ${fmt(tot.n)} rolls, about ${fmt(tot.n / secs)} a second, best ${bestText(tot.best)}. ${tierList(tot.tiers)}`;
      paintStatus();
      if (endlessDone()) { stopEndless(); return; }
      next += BATCH_EVERY;
      if (next - performance.now() < -60000) next = performance.now();
      await yieldNow();
      while (auto === 'endless' && performance.now() < next) await sleep(Math.min(100, next - performance.now())); // short naps, so Stop lands at once
    }
  }
  function paintBatch() {
    for (const b of document.querySelectorAll('[data-batch]')) b.disabled = !!(auto || busy || batching || !ready[state.mode]);
    if (batching) { $('batchResult').hidden = false; $('batchResult').textContent = `Rolling ${fmt(batching.done)} of ${fmt(batching.n)}…`; }
  }
  $('batchRow').addEventListener('click', ev => { const b = ev.target.closest('[data-batch]'); if (b) batchRoll(+b.dataset.batch); });
  function setAuto(kind) {
    if (kind !== auto) {
      if (auto && !kind) showRunSummary();
      run.start = performance.now(); run.rolls = 0; run.best = null;
      if (kind) run.snap = snapRun();
    }
    auto = kind;
    if (!kind) releaseResultHeight();
    if (!kind && saveTimer) writeSave();
    $('autoBtn').setAttribute('aria-pressed', String(kind === 'auto'));
    $('endlessBtn').setAttribute('aria-pressed', String(kind === 'endless'));
    paintRollButton();
    paintStatus();
    if (kind && !busy) autoLoop();
  }
  // Run summary: when Auto or Endless stops after 100 rolls or more, what the run brought, shown
  // where batch results go.
  const itemCount = () => Object.values(state.inv).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const snapRun = () => ({ coins: state.coins, items: itemCount(), tokens: state.tokens || 0, badges: collected(), mults: multsFound() });
  function showRunSummary() {
    if (run.rolls < 100 || !run.snap) return;
    const secs = (performance.now() - run.start) / 1000, s0 = run.snap;
    const time = secs >= 60 ? `${Math.floor(secs / 60)} min ${Math.round(secs % 60)} s` : `${secs.toFixed(1)} s`;
    const gained = [[collected() - s0.badges, 'new badge'], [multsFound() - s0.mults, 'new multiplier'], [state.coins - s0.coins, 'coin'], [itemCount() - s0.items, 'item'], [(state.tokens || 0) - s0.tokens, 'lucky token']]
      .filter(([k]) => k > 0).map(([k, w]) => `${fmt(k)} ${w}${k === 1 ? '' : 's'}`);
    const b = run.best;
    const html = `<b>Run over:</b> ${rollsText(run.rolls)} in ${time}, about ${fmt(run.rolls / Math.max(secs, 0.001))} a second.`
      + (b ? ` Best <b style="color:${tierVar(b.tier)}">${ROLL_TIERS[T(b.tier)].name}</b> ${esc(oneText(b))}.` : '')
      + (gained.length ? ` Brought ${gained.join(', ')}.` : '') + ' Coins and items spent during the run count against these.';
    if (fullSkin()) { fullNotice(plain(html)); return; }
    $('batchResult').hidden = false;
    $('batchResult').innerHTML = html;
  }
  async function autoLoop() {
    busy = true;
    while (auto) {
      if (!ready[state.mode]) { await warm(state.mode); continue; }
      const kind = auto;
      if (kind === 'endless' && +state.settings.batch > 0) { await batchLoop(); continue; }
      if (speed === 3) { await turboLoop(kind); continue; }
      const { tier, stop } = await rollOnce();
      if (kind === 'auto' && auto === 'auto' && (stop || T(tier.id) >= +$('stopAt').value)) { setAuto(null); break; }
      if (kind === 'endless' && auto === 'endless' && endlessDone()) { stopEndless(); break; }
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
  $('batchSize').value = String(+state.settings.batch || 0);
  $('batchSize').addEventListener('change', () => { state.settings.batch = +$('batchSize').value; save(); });

  function paintRollButton() {
    const btn = $('rollBtn');
    paintBatch();
    if (auto) { btn.textContent = 'Stop'; btn.disabled = false; return; }
    if (batching) { btn.textContent = 'Stop batch'; btn.disabled = false; return; }
    btn.textContent = ready[state.mode] ? 'Roll' : 'Loading odds…';
    btn.disabled = !ready[state.mode] || busy;
  }

  // Keys. `roll`: only on the Roll tab. The Keys dialog (?) lists this same table.
  const KEYS = [
    ['Space', 'Roll, or stop Auto, Endless or a batch', true],
    ['A', 'Auto on or off', true],
    ['E', 'Endless on or off', true],
    ['B', 'Batch ×1,000', true],
    ['T', 'Next speed: 1×, 2×, Turbo', true],
    ['M', 'Next mode', true],
    ['S', 'Star or unstar the roll shown', true],
    ['1 to 6', 'Roll, Inventory, Collection, Trophies, Arcade, Log'],
    ['← →', 'Next tab, when a tab has focus'],
    ['?', 'This list'],
    ['Esc', 'Close a dialog'],
  ];
  $('keysList').innerHTML = KEYS.map(([k, what, roll]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(what)}${roll ? ' <span class="muted">(Roll tab)</span>' : ''}</dd>`).join('');
  document.addEventListener('keydown', ev => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector('dialog[open]') || fullSkin()) return;
    const t = ev.target.closest ? ev.target : document.body;
    if (t.closest('input, select, textarea')) return;
    if (ev.key === '?') { $('keysDialog').showModal(); return; }
    if (/^Digit[1-6]$/.test(ev.code)) { selectTab(TABS[+ev.code.slice(5) - 1]); return; }
    if ($('tab-roll').hidden) return;
    if (ev.code === 'Space') {
      if (t.closest('button, a')) return; // the focused control handles Space itself
      ev.preventDefault();
      rollClicked();
    }
    if (ev.code === 'KeyA') setAuto(auto === 'auto' ? null : 'auto');
    if (ev.code === 'KeyE') setAuto(auto === 'endless' ? null : 'endless');
    if (ev.code === 'KeyB') batchRoll(1000);
    if (ev.code === 'KeyT') $('speed').querySelector(`[data-speed="${speed % 3 + 1}"]`).click();
    if (ev.code === 'KeyM') setMode(MODE_IDS[(MODE_IDS.indexOf(state.mode) + 1) % MODE_IDS.length]);
    if (ev.code === 'KeyS' && shown && !shown.preview) $('starBtn').click();
  });
  // Buttons that open a dialog by id (the footer's What's new, the Keys link under the controls).
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-open]');
    if (!b) return;
    if (b.dataset.open === 'newsDialog') renderNews();
    $(b.dataset.open).showModal();
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
  for (const d of G.DIFFICULTIES) $('diffSel').appendChild(new Option(d.name, d.id));
  function setDifficulty(id) {
    if (!G.DIFF_BY_ID[id]) return;
    state.difficulty = id;
    $('diffSel').value = id;
    $('diffDesc').textContent = id === 'standard' ? '' : `${G.DIFF_BY_ID[id].desc} Lucky tokens ×${TOKENS_PER[id]}.`;
    document.documentElement.dataset.difficulty = id;
    paintMult(MULT_BY_ID.unity);
    paintStatus();
    save();
  }
  $('diffSel').addEventListener('change', () => setDifficulty($('diffSel').value));

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
    const before = alsoHunt.length; // a mode badge can only turn up in its own mode
    alsoHunt = alsoHunt.filter(h => { const b = !h.id.startsWith('x:') && findBadge(h.id); return !b || !b.mode || b.mode === state.mode; });
    if (alsoHunt.length !== before) paintAlsoHunt();
  }
  function setHunt(id) {
    if (id !== hunt) huntRolls = 0;
    hunt = id;
    $('hunt').value = id;
    if (id) { $('opts').hidden = false; $('optsBtn').setAttribute('aria-expanded', 'true'); }
    paintStatus();
  }
  $('hunt').addEventListener('change', () => setHunt($('hunt').value));
  // Also hunt: the badge dialog adds a second and third target, shown under the Hunt menu.
  function addAlsoHunt(id) {
    if (!hunt) { setHunt(id); return true; }
    if (id === hunt || alsoHunt.some(h => h.id === id)) return true;
    if (alsoHunt.length >= MAX_ALSO) return false;
    alsoHunt.push({ id, rolls: 0 });
    paintAlsoHunt();
    checkAchievements();
    return true;
  }
  function paintAlsoHunt() {
    const box = $('alsoHunt');
    box.hidden = !alsoHunt.length;
    box.innerHTML = alsoHunt.map(h => `<span class="chip">Also hunting ${esc(huntName(h.id))} <button class="btn" type="button" data-unhunt="${esc(h.id)}" aria-label="Stop hunting ${esc(huntName(h.id))}">Remove</button></span>`).join('');
    if (alsoHunt.length) { $('opts').hidden = false; $('optsBtn').setAttribute('aria-expanded', 'true'); }
    paintStatus();
  }
  $('alsoHunt').addEventListener('click', ev => {
    const b = ev.target.closest('[data-unhunt]');
    if (!b) return;
    alsoHunt = alsoHunt.filter(h => h.id !== b.dataset.unhunt);
    paintAlsoHunt();
  });
  // Endless limits and Stop on new badge, both under Auto settings.
  function endlessDone() {
    const v = state.settings.endlessLimit || '';
    if (!v || auto !== 'endless') return false;
    const n = +v.slice(1);
    return v[0] === 'r' ? run.rolls >= n : performance.now() - run.start >= n * 60000;
  }
  function stopEndless() {
    const k = run.rolls;
    setAuto(null);
    toast(`Endless stopped after ${rollsText(k)}, as set in Auto settings`, 'rare');
  }
  $('endlessLimit').value = state.settings.endlessLimit || '';
  $('endlessLimit').addEventListener('change', () => { state.settings.endlessLimit = $('endlessLimit').value; save(); paintStatus(); });
  $('stopNewBox').checked = !!state.settings.stopNew;
  $('stopNewBox').addEventListener('change', () => { state.settings.stopNew = $('stopNewBox').checked; save(); });

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
      if (G.DIFF_BY_ID[q.get('d')] && q.get('d') !== 'standard') x.d = q.get('d');
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
    if (raw === '07734' && unlockSkin('calc', 'hELLO')) { wearSkin('calc'); return; }
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
      ['infinite', 'To infinity'], ['omega', 'The last letter'], ['absolute', 'Absolute unit'], ['primordial', 'Before time'], ['unfathomable', 'Unfathomable'],
      ['paradox', 'Paradox'], ['singularity', 'Event horizon'], ['multiversal', 'Many worlds'], ['omniversal', 'Everything everywhere'],
      ['ineffable', 'Words fail'], ['beyond', 'Beyond a googol']]
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
    // v3.1
    { id: 'r500k', name: 'Half a million', desc: 'Roll 500,000 times', test: () => state.total >= 5e5 },
    { id: 'r1m', name: 'Millionaire', desc: 'Roll 1,000,000 times', test: () => state.total >= 1e6 },
    { id: 'r10m', name: 'Ten million strong', desc: 'Roll 10,000,000 times', test: () => state.total >= 1e7 },
    { id: 'busyDay', name: 'Busy day', desc: 'Roll 10,000 times in one day', test: () => (state.daily[dayKey()] || 0) >= 1e4 },
    { id: 'week', name: 'Regular', desc: 'Roll on 7 different days', test: () => Object.keys(state.daily).length >= 7 },
    { id: 'month', name: 'Devoted', desc: 'Roll on 30 different days', test: () => Object.keys(state.daily).length >= 30 },
    { id: 'c150', name: 'Hoarder', desc: 'Collect 150 different badges', test: () => collected() >= 150 },
    { id: 'c200', name: 'Museum', desc: 'Collect 200 different badges', test: () => collected() >= 200 },
    { id: 'c250', name: 'Encyclopedia', desc: 'Collect 250 different badges', test: () => collected() >= 250 },
    { id: 'c300', name: 'Grand library', desc: 'Collect 300 different badges', test: () => collected() >= 300 },
    { id: 'm75', name: 'Three quarters', desc: 'Land 75 different multipliers', test: () => multsFound() >= 75 },
    { id: 'm100', name: 'Full table', desc: 'Land all 100 multipliers', test: () => multsFound() >= 100 },
    ...MODES.map(m => ({ id: `fan-${m.id}`, name: `${m.name} fan`, desc: `Roll 1,000 times in ${m.name} mode`, test: () => state.totals[m.id] >= 1000 })),
    { id: 'purse', name: 'Coin purse', desc: 'Hold 100 coins at once', test: () => state.coins >= 100 },
    { id: 'chest', name: 'Treasure chest', desc: 'Hold 1,000 coins at once', test: () => state.coins >= 1000 },
    { id: 'slot1k', name: 'One-armed bandit', desc: 'Spin the coin slot 1,000 times', test: () => state.spins >= 1000 },
    { id: 'slot10k', name: 'Casino floor', desc: 'Spin the coin slot 10,000 times', test: () => state.spins >= 1e4 },
    { id: 'fuse1', name: 'Fusion', desc: 'Fuse items once', test: () => (state.fused || 0) >= 1 },
    { id: 'fuse100', name: 'Forge master', desc: 'Fuse items 100 times', test: () => (state.fused || 0) >= 100 },
    { id: 'use10', name: 'Item user', desc: 'Use 10 items', test: () => (state.used || 0) >= 10 },
    { id: 'use100', name: 'Power user', desc: 'Use 100 items', test: () => (state.used || 0) >= 100 },
    { id: 'goose', name: 'Golden egg', desc: 'Own a Golden Goose', test: () => state.inv.goose > 0 },
    { id: 'diamond', name: 'Diamond hands', desc: 'Own a Diamond Goose', test: () => state.inv.goose2 > 0 },
    { id: 'tenmil', name: 'Ten million in hand', desc: 'Own a Charm of Ten Million', test: () => state.inv.luck10m > 0 },
    { id: 'quest1', name: 'Quest taker', desc: 'Claim a daily quest', test: () => (state.questsDone || 0) >= 1 },
    { id: 'quest25', name: 'Quest master', desc: 'Claim 25 daily quests', test: () => (state.questsDone || 0) >= 25 },
    { id: 'questDay', name: 'Full day', desc: 'Finish all three quests of a day', test: () => !!(state.quests && state.quests.bonus) },
    { id: 'p1', name: 'Reborn', desc: 'Prestige once', test: () => (state.prestige || 0) >= 1 },
    { id: 'p3', name: 'Phoenix', desc: 'Reach prestige 3', test: () => (state.prestige || 0) >= 3 },
    { id: 'p5', name: 'Ascended', desc: 'Reach prestige 5', test: () => (state.prestige || 0) >= 5 },
    { id: 'page1', name: 'First page', desc: 'Claim a badge book page', test: () => Object.keys(state.book).length >= 1 },
    { id: 'page5', name: 'Bookworm', desc: 'Claim 5 badge book pages', test: () => Object.keys(state.book).length >= 5 },
    { id: 'pageAll', name: 'Complete works', desc: 'Claim every badge book page', test: () => Object.keys(state.book).length >= BOOK.length },
    { id: 'skin1', name: 'New look', desc: 'Own a skin that is not free', test: () => state.skins.length >= 1 },
    { id: 'skin8', name: 'Wardrobe', desc: 'Own 8 skins', test: () => SKINS.filter(x => ownsSkin(x.id)).length >= 8 },
    { id: 'skinAll', name: 'Fashion icon', desc: 'Own every skin', test: () => SKINS.every(x => ownsSkin(x.id)) },
    { id: 'secrets', name: 'Secret agent', desc: 'Find every secret skin', test: () => SKINS.filter(x => x.how === 'secret').every(x => ownsSkin(x.id)) },
    { id: 'bundle', name: 'Big spender', desc: 'Buy the skin bundle', test: () => SKINS.filter(x => x.how === 'bundle').every(x => ownsSkin(x.id)) },
    { id: 'hacker', name: 'Hacker', desc: 'Enter the secret code', test: () => ownsSkin('terminal') },
    { id: 'cmd100', name: 'Command line hero', desc: 'Type 100 commands', test: () => (state.cmds || 0) >= 100 },
    { id: 'luck1k', name: 'Loaded dice', desc: 'Roll with luck ×1,000 or more', test: rec => rec && rec.entry.b >= 1000 },
    { id: 'prismRoll', name: 'Through the prism', desc: 'Roll with the Prism Lens', test: rec => rec && rec.entry.lens === 10 },
    { id: 'trash100', name: 'Trash collector', desc: 'Roll Trash 100 times', test: () => MODE_IDS.reduce((t, m) => t + (state.tiers[m].trash || 0), 0) >= 100 },
    { id: 'hcEpic', name: 'Hardcore', desc: 'Roll Epic or rarer on Hardcore', test: rec => rec && rec.entry.d === 'hardcore' && T(rec.entry.tier) >= T('epic') },
    { id: 'nmUncommon', name: 'Woke up screaming', desc: 'Roll Uncommon or rarer on Nightmare', test: rec => rec && rec.entry.d === 'nightmare' && T(rec.entry.tier) >= T('uncommon') },
    { id: 'abyssUncommon', name: 'Stared back', desc: 'Roll Uncommon or rarer on Abyss', test: rec => rec && rec.entry.d === 'abyss' && T(rec.entry.tier) >= T('uncommon') },
    { id: 'oblivionCommon', name: 'Not forgotten', desc: 'Roll anything but Trash on Oblivion', test: rec => rec && rec.entry.d === 'oblivion' && rec.entry.tier !== 'trash' },
    { id: 'oblivionRare', name: 'Impossible', desc: 'Roll Rare or rarer on Oblivion', test: rec => rec && rec.entry.d === 'oblivion' && T(rec.entry.tier) >= T('rare') },
    { id: 'luck10lv', name: 'Lucky streak', desc: 'Reach luck level 10', test: () => (state.luckLevel || 0) >= 10 },
    { id: 'luck50lv', name: 'Born lucky', desc: 'Reach luck level 50', test: () => (state.luckLevel || 0) >= 50 },
    { id: 'luck100lv', name: 'Fortune incarnate', desc: 'Reach luck level 100', test: () => (state.luckLevel || 0) >= 100 },
    { id: 'pile12', name: 'Badge avalanche', desc: 'Earn 12 or more badges on one roll', test: rec => rec && rec.r.badges.length >= 12 },
    // v3.6
    { id: 'workshop1', name: 'Tinkerer', desc: 'Buy an upgrade in the token workshop', test: () => WORKSHOP.some(w => wsLevel(w.id) > 0) },
    { id: 'workshopMax', name: 'Master craftsman', desc: 'Max out an upgrade in the token workshop', test: () => WORKSHOP.some(w => wsLevel(w.id) >= w.max) },
    { id: 'shop1', name: 'Customer', desc: 'Buy something in the coin shop', test: () => (state.shopSpent || 0) > 0 },
    { id: 'shop1k', name: 'Regular customer', desc: 'Spend 1,000 coins in the coin shop', test: () => (state.shopSpent || 0) >= 1000 },
    // v3.7
    { id: 'streak7', name: 'Seven days straight', desc: 'Roll on 7 days in a row', test: () => ((state.streak && state.streak.best) || 0) >= 7 },
    { id: 'streak30', name: 'A month of mornings', desc: 'Roll on 30 days in a row', test: () => ((state.streak && state.streak.best) || 0) >= 30 },
    { id: 'weekly1', name: 'Week\'s work', desc: 'Claim a weekly quest', test: () => (state.weeklyDone || 0) >= 1 },
    { id: 'bingo1', name: 'Bingo', desc: 'Complete a line on the bingo card', test: () => (state.bingoLines || 0) >= 1 },
    { id: 'bingoFull', name: 'Full house', desc: 'Mark every cell of a bingo card', test: () => (state.bingoFull || 0) >= 1 },
    { id: 'bounty1', name: 'Bounty hunter', desc: 'Collect a bounty', test: () => (state.bountiesDone || 0) >= 1 },
    { id: 'bounty10', name: 'Most wanted', desc: 'Collect 10 bounties', test: () => (state.bountiesDone || 0) >= 10 },
    { id: 'mastery100', name: 'Practised', desc: 'Reach 100 levels of badge mastery', test: () => masteryTotal() >= 100 },
    { id: 'mastery400', name: 'Virtuoso', desc: 'Reach 400 levels of badge mastery', test: () => masteryTotal() >= 400 },
    { id: 'sheetRoll', name: 'Spreadsheet wizard', desc: 'Roll from a formula', test: () => !!state.formula },
    // v4.0
    { id: 'arcade1', name: 'Pocket change', desc: 'Play a game in the arcade', test: () => (arc().played || 0) >= 1 },
    { id: 'hl5', name: 'Called it', desc: 'Call higher or lower right 5 times in a row', test: () => (arc().hlBest || 0) >= 5 },
    { id: 'hl10', name: 'Psychic', desc: 'Call higher or lower right 10 times in a row', test: () => (arc().hlBest || 0) >= 10 },
    { id: 'digit5', name: 'Lucky digit', desc: 'Draw five or more of your digit in Digit pick', test: () => (arc().digitBest || 0) >= 5 },
    { id: 'wheel7', name: 'Wheel regular', desc: 'Spin the daily wheel on 7 days', test: () => (arc().wheelDays || 0) >= 7 },
    { id: 'wheelTop', name: 'Top of the wheel', desc: 'Land the Charm of Ten Thousand on the daily wheel', test: () => !!arc().wheelJackpot },
    { id: 'scratchWin', name: 'Scratch and win', desc: 'Win on a scratch card', test: () => (arc().scratchWins || 0) >= 1 },
    { id: 'sevens', name: 'Lucky sevens', desc: 'Scratch a row of three Sevens', test: () => !!arc().sevens },
    { id: 'hunt3', name: 'Three at once', desc: 'Hunt three things at the same time', test: () => !!hunt && alsoHunt.length >= MAX_ALSO },
    { id: 'weeklyAll', name: 'Clean sweep', desc: 'Finish all three weekly quests of a week', test: () => (state.weeklyBonuses || 0) >= 1 },
  ];
  function checkAchievements(rec) {
    for (const a of ACHIEVEMENTS) {
      if (state.ach[a.id] || !a.test(rec)) continue;
      state.ach[a.id] = Date.now();
      toast(`Achievement: <b>${esc(a.name)}</b>`, 'rare', 'ach');
      grant(ACH_REWARD[a.id] || 'luck10', 'Achievement reward');
      const skin = SKINS.find(x => x.ach === a.id);
      if (skin) unlockSkin(skin.id, a.name);
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
  // Collection order: likeliest or rarest first, most earned, most recently found, or by name.
  // `times` and `first` read how often an entry was earned and the roll that first earned it.
  function sorter(times, first) {
    const when = x => { const f = first(x); return f && typeof f === 'object' ? f.t || 0 : 0; };
    const by = {
      likely: (a, b) => b.p - a.p,
      rare: (a, b) => a.p - b.p,
      most: (a, b) => (times(b) || 0) - (times(a) || 0) || b.p - a.p,
      recent: (a, b) => when(b) - when(a) || b.p - a.p,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return by[$('collSort').value] || by.likely;
  }
  function renderCollection() {
    const all = allBadges();
    const haveB = all.filter(b => state.counts[b.id]).length, haveM = multsFound();
    const total = all.length + MULTS.length;
    $('collCount').textContent = `${haveB + haveM} of ${total} collected · mastery ${fmt(masteryTotal())} of ${fmt(collectable().length * MASTERY.length)}`;
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
      .sort(sorter(m => state.mults[m.id], m => state.firstMult[m.id])).map(m => multCard(m, { locked: !state.mults[m.id], times: state.mults[m.id] || 0 }));
    section('Multipliers', `${haveM} of ${MULTS.length} landed`, multItems);
    for (const cat of CATEGORIES) {
      const inCat = all.filter(b => b.cat === cat);
      const list = inCat.filter(b => keep(`${b.name} ${b.desc}`, b.rarity, state.counts[b.id])).sort(sorter(b => state.counts[b.id], b => state.first[b.id]));
      const mode = inCat[0] && inCat[0].mode;
      const note = `${inCat.filter(b => state.counts[b.id]).length} of ${inCat.length}${mode ? `, ${MODE_BY_ID[mode].name} mode only` : cat === 'Daily' ? ', change with the date' : ''}`;
      section(cat, note, list.map(b => badgeCard(b, { locked: !state.counts[b.id], times: state.counts[b.id] || 0 })));
    }
    if (!count) {
      root.innerHTML = '<p class="empty-state">Nothing matches these filters. <button class="btn" type="button" id="clearFilters">Clear filters</button></p>';
      $('clearFilters').addEventListener('click', () => { $('collSearch').value = ''; $('collStatus').value = 'all'; $('collRarity').value = ''; renderCollection(); });
    }
  }
  for (const id of ['collSearch', 'collStatus', 'collRarity', 'collSort']) $(id).addEventListener('input', renderCollection);

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
    $('luckNote').textContent = state.boosted ? `${rollsText(state.boosted)} made with luck, a lens or a harder difficulty are left out, since they are not plain rolls.` : '';
    renderRecentRolls();
    renderCharts();
    renderLuckRating();
    renderOddsCalc();
    renderRecords();
    renderMilestones();
  }

  // Recent rolls, filtered by mode and by tier, and exported as CSV.
  for (const m of MODES) $('logMode').appendChild(new Option(`${m.name} only`, m.id));
  ROLL_TIERS.slice(T('uncommon')).forEach(t => $('logTier').appendChild(new Option(`${t.name} or rarer`, String(T(t.id)))));
  function renderRecentRolls() {
    const mode = $('logMode').value, min = +$('logTier').value;
    const list = state.log.filter(x => !mode || x.mode === mode).map(entryFor).filter(e => T(e.tier) >= min);
    $('log').innerHTML = list.length ? list.map(e => rowHtml(e, false)).join('')
      : state.log.length ? '<li class="empty-state">None of your last 200 rolls match these filters.</li>'
        : '<li class="empty-state">No rolls yet. Your last 200 rolls appear here.</li>';
    $('csvBtn').disabled = !state.log.length;
  }
  for (const id of ['logMode', 'logTier']) $(id).addEventListener('change', renderRecentRolls);
  $('csvBtn').addEventListener('click', () => {
    const cell = v => (v === undefined || v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const head = ['time', 'number', 'mode', 'tier', 'one_in', 'score_log10', 'multiplier', 'exponent', 'modulus', 'target', 'luck', 'lens', 'difficulty', 'starred'];
    const rows = state.log.map(entryFor).map(e => [new Date(e.t).toISOString(), e.n, e.mode, ROLL_TIERS[T(e.tier)].name, `${e.estimated ? '~' : ''}${+(10 ** e.oneInLog).toPrecision(6)}`,
      e.log.toFixed(4), e.x && e.x !== 'unity' ? MULT_BY_ID[e.x].name : '', e.e || '', e.m || '', e.tg ?? '', e.b || '', e.lens || '', e.d || 'standard', isFav(e) ? 'yes' : '']);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[head, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n'], { type: 'text/csv' }));
    a.download = `longshot10-rolls-${dayKey()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // How lucky you have been: your best plain roll of each mode against everyone with as many plain
  // rolls. Plain rolls are a fair draw, so the best of R of them reaches 1/N or rarer with chance
  // 1 - (1 - 1/N)^R exactly.
  // Never rounds up to 100%: 99.996% shows as such, and anything closer is "more than 99.9999%".
  const chanceText = p => (p >= 0.9999995 ? 'more than 99.9999%' : p >= 0.99 ? `${(Math.floor(1e6 * p) / 1e4).toFixed(4)}%` : p >= 0.01 ? `${(100 * p).toFixed(1)}%` : p > 0 ? `1 in ${fmt(1 / p)}` : '0%');
  function renderLuckRating() {
    const rows = MODES.map(m => {
      const R = tierTotal(m.id), bp = state.bestPlain[m.id];
      if (!R || !bp) return '';
      const p = -Math.expm1(R * Math.log1p(-(10 ** -bp.l)));
      const verdict = p < 0.05 ? 'very lucky' : p < 0.25 ? 'lucky' : p <= 0.75 ? 'about as lucky as expected' : 'less lucky than most, so far';
      return `<li style="--tc:${tierVar(tierOfN(10 ** bp.l))}"><b>${esc(m.name)}:</b> ${verdict}. Your best plain roll, <a class="num" href="${hashOf({ n: bp.n, mode: m.id, x: 'unity' })}">${esc(fmt(bp.n))}</a>, was <b class="tc">${bp.est ? '≈ ' : ''}1/${esc(bigText(bp.l))}</b> after ${rollsText(R)}. `
        + `A best that good or better turns up for ${chanceText(p)} of players after as many rolls.</li>`;
    }).filter(Boolean);
    $('luckRating').innerHTML = rows.length ? `<ul class="rating">${rows.join('')}</ul><p class="muted">Plain rolls only: luck charms, lenses and harder difficulties are left out, as in the Luck table.</p>`
      : '<p class="empty-state">Roll a few plain rolls (no charm, lens or harder difficulty) and this compares your best one with what everyone gets.</p>';
  }

  // Odds calculator: the chance of at least one roll of a tier or rarer in R rolls, in your current
  // mode and difficulty, with your current luck. One roll with luck L reaches it with 1 - (1 - q)^L.
  RARITIES.slice(1).forEach(r => $('ocTier').appendChild(new Option(`${r.name} or rarer (1/${fmt(r.from)})`, r.id)));
  $('ocTier').value = 'mythic';
  function renderOddsCalc() {
    const mode = state.mode, d = state.difficulty || 'standard', L = effLuck();
    $('calcFor').textContent = `${MODE_BY_ID[mode].name}, ${G.DIFF_BY_ID[d].name}${L > 1 ? `, luck ×${fmt(L)}` : ''}`;
    const R = Math.floor(+$('ocRolls').value.replace(/[\s,_]/g, ''));
    if (!ready[mode]) { $('ocOut').textContent = 'The odds are still loading.'; return; }
    if (!(R >= 1 && R <= 1e15)) { $('ocOut').textContent = 'Enter a number of rolls from 1 to 1,000,000,000,000,000.'; return; }
    const r = RARITIES.find(x => x.id === $('ocTier').value);
    const q1 = G.reachChance(1 / r.from, mode, d), q = -Math.expm1(L * Math.log1p(-Math.min(q1, 1 - 1e-16)));
    const p = -Math.expm1(R * Math.log1p(-Math.min(q, 1 - 1e-16)));
    $('ocOut').innerHTML = q > 0 ? `<b class="num">${esc(chanceText(p))}</b> chance. One roll in <b class="num">${esc(1 / q < 1e15 ? fmt(Math.max(1, 1 / q)) : bigText(-Math.log10(q)))}</b> reaches ${esc(r.name)} or rarer on average${q1 < 1 / r.from ? `, rarer than on Standard (1 in ${fmt(r.from)})` : ''}.`
      : `${esc(r.name)} is out of reach on ${esc(G.DIFF_BY_ID[d].name)} without luck.`;
  }
  $('oddsCalc').addEventListener('input', renderOddsCalc);
  $('oddsCalc').addEventListener('submit', ev => { ev.preventDefault(); renderOddsCalc(); });

  // Records that only ever go up, and the first time each tier was reached.
  function renderRecords() {
    const rc = state.rec;
    const rarest = collectable().filter(b => state.counts[b.id]).sort((a, b) => a.p - b.p)[0];
    const bigMult = MULTS.filter(m => state.mults[m.id]).sort((a, b) => b.log - a.log)[0];
    const rows = [
      ['Most rolls in one session', rc.session ? rollsText(rc.session) : ''],
      ['Most rolls in one day', rc.day ? rollsText(rc.day) : ''],
      ['Fastest Endless run', rc.rate ? `${fmt(rc.rate)} rolls a second` : ''],
      ['Most badges on one roll', rc.badges ? String(rc.badges) : ''],
      ['Longest run without Trash', rc.streakBest ? rollsText(rc.streakBest) : ''],
      ['Longest hunt', rc.hunt ? rollsText(rc.hunt) : ''],
      ['Rarest badge', rarest ? `${rarest.name}, ${odds(rarest.p)}` : ''],
      ['Biggest multiplier', bigMult ? `${bigMult.symbol} ${bigMult.name}, ${odds(bigMult.p)}` : ''],
    ].filter(r => r[1]);
    $('records').innerHTML = rows.length ? rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd>`).join('')
      : '<dd class="empty-state">Records start with your first roll.</dd>';
  }
  function renderMilestones() {
    const got = ROLL_TIERS.slice(T('uncommon')).filter(t => state.ach[t.id]).map(t => ({ t, when: state.ach[t.id] })).sort((a, b) => a.when - b.when);
    if (state.ach.first) got.unshift({ t: { id: 'common', name: 'First roll' }, when: state.ach.first });
    $('milestones').innerHTML = got.length ? got.map(({ t, when }) => `<li style="--tc:${tierVar(t.id)}"><b>${esc(t.name)}</b><span class="muted num">${esc(new Date(when).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))}</span></li>`).join('')
      : '<li class="empty-state">Each tier you reach for the first time lands here with its date.</li>';
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

  // Arcade: four games, each with its exact odds and its payback (what it returns on average for
  // each coin or token played) printed beside it. Arcade rolls are drawn like any roll of your mode
  // but are not recorded: they count for nothing outside the arcade.
  const arc = () => state.arcade || (state.arcade = { played: 0, coinsIn: 0, coinsOut: 0, hlBest: 0, wheelDay: '', wheelDays: 0 });
  function arcadeRoll() {
    const mode = ready[state.mode] ? state.mode : 'classic';
    const roll = G.randomParams(mode), n = G.randomRoll(), r = G.score(n, dayKey(), roll), t = G.rollTier(r.rank, mode);
    const p = Math.min(1, Math.max(1 - G.percentile(r.rank, mode) / 100, 1e-300)); // the true chance to do at least this well
    return { n, mode, rank: r.rank, p, tier: t.tier.id, oneInLog: t.oneInLog, estimated: t.estimated, x: roll.mult, e: roll.e };
  }
  // Ten small reel cells, leading zeros dimmed; `mark` lights every cell showing that digit.
  function miniReels(id, n, mark = null) {
    const s = String(n).padStart(G.DIGITS, '0'), lead = leadCount(n);
    $(id).innerHTML = [...s].map((d, i) => `<span class="mini-cell num${i < lead ? ' lead' : ''}${mark !== null && +d === mark ? ' mark' : ''}">${d}</span>`).join('');
    $(id).setAttribute('aria-label', s.split('').join(' '));
  }
  function payPrize(kind, amount, why) {
    if (kind === 'coins') { state.coins += amount; toast(`${esc(why)}: <b>${fmt(amount)} coins</b>`, 'mythic', 'item'); }
    else if (kind === 'tokens') { addTokens(amount); toast(`${esc(why)}: <b>${fmt(amount)} lucky tokens</b>`, 'uncommon', 'item'); }
    else grant(kind, why, amount);
  }
  const prizeName = (kind, amount) => (kind === 'coins' ? `${fmt(amount)} coins` : kind === 'tokens' ? `${fmt(amount)} lucky tokens` : `${ITEM_BY_ID[kind].name}${amount > 1 ? ` ×${amount}` : ''}`);
  function renderArcadeIntro() {
    const a = arc();
    $('arcadeIntro').textContent = `Arcade rolls are drawn like real rolls of your mode, but they are not recorded. Every game shows its exact chances and its payback: what it returns on average for each coin or token played.${a.coinsIn ? ` You have played ${fmt(a.coinsIn)} coins here and won ${fmt(a.coinsOut)} back.` : ''}`;
  }

  // Higher or lower: is the next roll rarer or commoner than this one? A roll of 1/N is beaten by
  // the next with chance exactly 1/N (the true chance, not the 1/2 floor shown for ordinary rolls),
  // so each call pays 95% of the fair price.
  const HL_RETURN = 0.95;
  const hl = { cur: null, streak: 0 };
  const hlPays = q => Math.floor((HL_RETURN / q) * 100) / 100;
  function paintHl() {
    if (!hl.cur) hl.cur = arcadeRoll();
    const c = hl.cur, bet = +$('hlBet').value;
    miniReels('hlReels', c.n);
    $('hlNow').innerHTML = `<b style="color:${tierVar(c.tier)}">${ROLL_TIERS[T(c.tier)].name}</b> <span class="num">${esc(oneText(c))}</span> <span class="muted">· beaten by ${chanceText(c.p)} of rolls</span>`;
    $('hlRarer').textContent = `Rarer: pays ${hlPays(c.p)}×`;
    $('hlCommoner').textContent = `Commoner: pays ${hlPays(1 - c.p)}×`;
    $('hlRarer').setAttribute('aria-label', `Rarer, a ${chanceText(c.p)} chance, pays ${hlPays(c.p)} times the bet`);
    $('hlCommoner').setAttribute('aria-label', `Commoner, a ${chanceText(1 - c.p)} chance, pays ${hlPays(1 - c.p)} times the bet`);
    $('hlRarer').disabled = $('hlCommoner').disabled = state.coins < bet;
    $('hlStreak').textContent = hl.streak ? `${hl.streak} right in a row` : arc().hlBest ? `best ${arc().hlBest} in a row` : '';
  }
  function playHl(rarer) {
    const bet = +$('hlBet').value, a = arc();
    if (state.coins < bet) { $('hlOut').textContent = `That bet needs ${bet} coins; you have ${fmt(state.coins)}.`; return null; }
    const c = hl.cur || arcadeRoll(), next = arcadeRoll(), q = rarer ? c.p : 1 - c.p;
    const won = rarer ? next.rank > c.rank : next.rank < c.rank;
    state.coins -= bet;
    a.coinsIn += bet;
    a.played++;
    let pay = 0;
    if (won) { pay = Math.floor(bet * hlPays(q)); state.coins += pay; a.coinsOut += pay; hl.streak++; a.hlBest = Math.max(a.hlBest, hl.streak); } else hl.streak = 0;
    const text = `Next roll: ${ROLL_TIERS[T(next.tier)].name} ${oneText(next)}. ${won ? `Right, ${fmt(pay)} coins back.` : `Wrong, the ${fmt(bet)} ${bet === 1 ? 'coin is' : 'coins are'} gone.`}`;
    $('hlOut').innerHTML = `<b style="color:${tierVar(next.tier)}">${esc(text.split('.')[0])}</b>${esc(text.slice(text.indexOf('.')))}`;
    hl.cur = next;
    checkAchievements();
    save();
    paintHl();
    renderArcadeIntro();
    return text;
  }
  $('hlRarer').addEventListener('click', () => playHl(true));
  $('hlCommoner').addEventListener('click', () => playHl(false));
  $('hlBet').addEventListener('change', paintHl);

  // Digit pick: choose a digit; a ten-digit number is drawn (leading zeros included, every cell
  // uniform and independent), and you are paid by how many cells show your digit, a binomial count.
  const DIGIT_PAYS = [0, 0, 1, 5, 15, 80, 500, 5000, 50000, 1e6, 1e7]; // bet multiplier by cells matched
  const binom10 = k => { let c = 1; for (let i = 0; i < k; i++) c = (c * (10 - i)) / (i + 1); return c * 0.1 ** k * 0.9 ** (10 - k); };
  const DIGIT_RETURN = DIGIT_PAYS.reduce((t, m, k) => t + m * binom10(k), 0);
  for (let d = 0; d <= 9; d++) $('digitSeg').insertAdjacentHTML('beforeend', `<button type="button" data-digit="${d}" aria-pressed="false">${d}</button>`);
  function paintDigit() {
    const d = state.settings.digit ?? 7;
    $('digitSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.digit === d)));
    $('digitDraw').disabled = state.coins < +$('digitBet').value;
    $('digitTable').innerHTML = `<thead><tr><th>Cells showing ${d}</th><th>Chance</th><th>Pays</th></tr></thead><tbody>`
      + DIGIT_PAYS.map((m, k) => `<tr><td>${k}</td><td class="num">${chanceText(binom10(k))}</td><td class="num">${m ? `${fmt(m)}×` : 'nothing'}</td></tr>`).join('')
      + `<tr><td><b>Payback</b></td><td></td><td class="num"><b>${(100 * DIGIT_RETURN).toFixed(1)}%</b></td></tr></tbody>`;
  }
  function playDigit() {
    const bet = +$('digitBet').value, d = state.settings.digit ?? 7, a = arc();
    if (state.coins < bet) { $('digitOut').textContent = `That bet needs ${bet} coins; you have ${fmt(state.coins)}.`; return null; }
    const n = G.randomRoll(), k = [...String(n).padStart(G.DIGITS, '0')].filter(c => +c === d).length, pay = bet * DIGIT_PAYS[k];
    state.coins -= bet - pay;
    a.coinsIn += bet;
    a.coinsOut += pay;
    a.played++;
    a.digitBest = Math.max(a.digitBest || 0, k);
    miniReels('digitReels', n, d);
    const text = `${k} ${k === 1 ? 'cell shows' : 'cells show'} ${d}: ${pay ? `${fmt(pay)} ${pay === 1 ? 'coin' : 'coins'} back` : `the ${fmt(bet)} ${bet === 1 ? 'coin is' : 'coins are'} gone`}.`;
    $('digitOut').textContent = text;
    checkAchievements();
    save();
    paintDigit();
    renderArcadeIntro();
    return text;
  }
  $('digitSeg').addEventListener('click', ev => { const b = ev.target.closest('[data-digit]'); if (b) { state.settings.digit = +b.dataset.digit; save(); paintDigit(); } });
  $('digitDraw').addEventListener('click', playDigit);
  $('digitBet').addEventListener('change', paintDigit);

  // Daily wheel: one free spin a day. Each segment's size is its true chance, so the wheel shows the
  // odds as they are; the table lists them exactly. [prize, amount, parts of 1,000]
  const WHEEL = [['luck10', 1, 300], ['coins', 5, 250], ['tokens', 500, 200], ['lens', 1, 120], ['luck100', 1, 80], ['horn', 1, 35], ['goose', 1, 12], ['luck10k', 1, 3]];
  if (WHEEL.reduce((t, w) => t + w[2], 0) !== 1000) throw new Error('wheel table does not add up');
  let wheelTurn = 0;
  function drawWheel() {
    let a0 = 0, svg = '<g id="wheelSpinGroup">';
    const pt = (deg, r) => { const t = (deg - 90) * Math.PI / 180; return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`; };
    WHEEL.forEach(([kind, amount, parts], i) => {
      const a1 = a0 + parts * 0.36, mid = (a0 + a1) / 2, big = a1 - a0 > 180 ? 1 : 0;
      svg += `<path class="seg${i % 2 ? ' alt' : ''}" data-seg="${i}" d="M0 0L${pt(a0, 100)}A100 100 0 ${big} 1 ${pt(a1, 100)}Z"/>`;
      if (parts >= 80) svg += `<text transform="rotate(${mid.toFixed(1)}) translate(0 -62) rotate(${mid > 90 && mid < 270 ? 180 : 0})" text-anchor="middle" dominant-baseline="middle">${esc(kind === 'coins' ? `${amount} coins` : kind === 'tokens' ? `${amount} tokens` : ITEM_BY_ID[kind].name.replace('Charm of ', '×').replace('a Hundred', '100').replace('Ten', '10').replace('Multiplier ', ''))}</text>`;
      a0 = a1;
    });
    $('wheel').innerHTML = svg + '</g><circle r="12" class="hub"/>';
  }
  function paintWheel() {
    const a = arc(), done = a.wheelDay === dayKey();
    $('wheelSpin').disabled = done;
    $('wheelSpin').textContent = done ? 'Spun today' : 'Spin';
    $('wheelSub').textContent = done ? 'next free spin tomorrow' : 'one free spin a day';
    $('wheelTable').innerHTML = '<thead><tr><th>Prize</th><th>Chance</th></tr></thead><tbody>'
      + WHEEL.map(([kind, amount, parts]) => `<tr><td>${esc(prizeName(kind, amount))}</td><td class="num">${(parts / 10).toFixed(1)}%</td></tr>`).join('') + '</tbody>';
  }
  async function spinWheel() {
    const a = arc();
    if (a.wheelDay === dayKey()) return null;
    a.wheelDay = dayKey();
    a.wheelDays = (a.wheelDays || 0) + 1;
    let u = randInt(1000), i = 0;
    while (u >= WHEEL[i][2]) { u -= WHEEL[i][2]; i++; }
    const [kind, amount] = WHEEL[i];
    const start = WHEEL.slice(0, i).reduce((t, w) => t + w[2], 0) * 0.36, mid = start + WHEEL[i][2] * 0.18;
    save();
    paintWheel();
    const g = $('wheelSpinGroup');
    wheelTurn += 360 * 5 + ((360 - mid) - (wheelTurn % 360) + 360) % 360;
    if (effects() !== 'off' && g) { g.style.transform = `rotate(${wheelTurn}deg)`; await sleep(3200); }
    else if (g) g.style.transform = `rotate(${wheelTurn}deg)`;
    payPrize(kind, amount, 'Daily wheel');
    if (kind === 'luck10k') a.wheelJackpot = true;
    const text = `The wheel stops on ${prizeName(kind, amount)}.`;
    $('wheelOut').textContent = text;
    $('wheel').querySelectorAll('.seg').forEach(p => p.classList.toggle('won', +p.dataset.seg === i));
    autoFuse();
    checkAchievements();
    save();
    return text;
  }
  $('wheelSpin').addEventListener('click', spinWheel);

  // Scratch card: three rows of three cells. A row of three matching symbols pays that symbol's
  // prize, so each row wins with the sum of each symbol's chance cubed. [symbol, parts of 1,000, prize]
  const SCRATCH_COST = 300; // lucky tokens
  const SCRATCH = [['Coin', 400, 'coins', 10], ['Clover', 300, 'tokens', 1000], ['Charm', 200, 'luck100', 1], ['Goose', 80, 'goose', 1], ['Seven', 20, 'luck10k', 1]];
  const rowChance = parts => (parts / 1000) ** 3;
  const SCRATCH_ANY = 1 - (1 - SCRATCH.reduce((t, s) => t + rowChance(s[1]), 0)) ** 3;
  let scratchCard = null;
  function paintScratch() {
    $('scratchBuy').textContent = `Buy a card for ${SCRATCH_COST} tokens`;
    $('scratchBuy').disabled = (state.tokens || 0) < SCRATCH_COST;
    $('scratchSub').textContent = `${fmt(state.tokens || 0)} tokens`;
    $('scratchAll').disabled = !scratchCard || scratchCard.shown.every(Boolean);
    $('scratch').innerHTML = scratchCard ? scratchCard.cells.map((s, i) => `<button class="scr${scratchCard.shown[i] ? ' shown' : ''}" type="button" data-scr="${i}" ${scratchCard.shown[i] ? 'disabled' : ''} aria-label="${scratchCard.shown[i] ? s : `Cell ${i + 1}, not scratched`}">${scratchCard.shown[i] ? esc(s) : ''}</button>`).join('')
      : '<p class="empty-state">Buy a card to scratch it.</p>';
    $('scratchTable').innerHTML = '<thead><tr><th>Row of three</th><th>Chance per row</th><th>Pays</th></tr></thead><tbody>'
      + SCRATCH.map(([sym, parts, kind, amount]) => `<tr><td>${sym}</td><td class="num">${chanceText(rowChance(parts))}</td><td>${esc(prizeName(kind, amount))}</td></tr>`).join('')
      + `<tr><td><b>Any win on a card</b></td><td class="num"><b>${chanceText(SCRATCH_ANY)}</b></td><td></td></tr></tbody>`;
  }
  // The card is drawn and paid when bought; scratching only uncovers it.
  function buyScratch() {
    if ((state.tokens || 0) < SCRATCH_COST) return null;
    state.tokens -= SCRATCH_COST;
    arc().played++;
    const pick = () => { let u = randInt(1000), i = 0; while (u >= SCRATCH[i][1]) { u -= SCRATCH[i][1]; i++; } return SCRATCH[i][0]; };
    const cells = Array.from({ length: 9 }, pick), wins = [];
    for (let r = 0; r < 3; r++) { const row = cells.slice(r * 3, r * 3 + 3); if (row.every(x => x === row[0])) wins.push(SCRATCH.find(s => s[0] === row[0])); }
    scratchCard = { cells, shown: cells.map(() => false), wins, told: false };
    for (const [sym, , kind, amount] of wins) payPrize(kind, amount, `Scratch card, three ${sym}s`);
    if (wins.length) arc().scratchWins = (arc().scratchWins || 0) + 1;
    if (wins.some(w => w[0] === 'Seven')) arc().sevens = true;
    $('scratchOut').textContent = '';
    checkAchievements();
    save();
    paintScratch();
    return wins.length ? `Won ${wins.map(w => prizeName(w[2], w[3])).join(' and ')}.` : 'No row of three this time.';
  }
  function scratchCell(i) {
    if (!scratchCard) return;
    scratchCard.shown[i] = true;
    if (scratchCard.shown.every(Boolean) && !scratchCard.told) {
      scratchCard.told = true;
      $('scratchOut').textContent = scratchCard.wins.length ? `Won ${scratchCard.wins.map(w => prizeName(w[2], w[3])).join(' and ')}.` : 'No row of three this time.';
    }
    paintScratch();
  }
  $('scratchBuy').addEventListener('click', buyScratch);
  $('scratchAll').addEventListener('click', () => { if (scratchCard) scratchCard.shown.forEach((_, i) => { scratchCard.shown[i] = i === 8 ? scratchCard.shown[i] : true; }); scratchCell(8); });
  $('scratch').addEventListener('click', ev => { const b = ev.target.closest('[data-scr]'); if (b) scratchCell(+b.dataset.scr); });
  function renderArcade() { renderArcadeIntro(); paintHl(); paintDigit(); paintWheel(); paintScratch(); }
  drawWheel();

  // Tabs, with arrow-key movement between them
  const TABS = ['roll', 'inventory', 'collection', 'trophies', 'arcade', 'log'];
  function selectTab(name) {
    document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    for (const t of TABS) $('tab-' + t).hidden = t !== name;
    if (name === 'collection') { renderBingo(); renderBounties(); renderBook(); renderCollection(); }
    if (name === 'trophies') { renderQuests(); renderPrestige(); renderTrophies(); }
    if (name === 'log') renderLog();
    if (name === 'arcade') renderArcade();
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
    paintFull();
    s.tone = SKIN_BY_ID[s.theme].light ? 'light' : 'dark'; // read by the first-paint script in index.html
    document.documentElement.dataset.effects = s.effects;
    document.documentElement.dataset.text = s.text || 'normal';
    document.querySelector('meta[name="theme-color"]').content = cssVar('--bg');
    for (const r of document.querySelectorAll('#settingsDialog input[name="effects"]')) r.checked = r.value === s.effects;
    for (const r of document.querySelectorAll('#settingsDialog input[name="text"]')) r.checked = r.value === (s.text || 'normal');
    for (const r of document.querySelectorAll('#settingsDialog input[name="notice"]')) r.checked = !s.notices || s.notices[r.value] !== false;
  }
  $('settingsBtn').addEventListener('click', () => { $('dataMsg').textContent = ''; paintInstall(); renderSlots(); renderSkins(); $('settingsDialog').showModal(); });
  $('settingsDialog').addEventListener('change', ev => {
    const { name, value } = ev.target;
    if (name === 'effects') state.settings.effects = value;
    else if (name === 'text') state.settings.text = value;
    else if (name === 'notice') state.settings.notices = { ...state.settings.notices, [value]: ev.target.checked };
    else return;
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
  const fileName = name => `longshot10-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'save'}.json`;
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
      $('dataMsg').textContent = 'That file is not a Long Shot 10 save, so nothing was imported.';
      return;
    }
    const st = Object.assign(blank(), s, { settings: { ...state.settings } });
    const b = blank();
    for (const k of ['totals', 'tiers', 'hof']) st[k] = Object.assign(b[k], s[k]);
    if (data.game === 'rngdle9') st.totals.classic = s.total;
    if (data.game === 'rngdle9' || !s.tiers || !s.hof) st.v = 3; // rebuild tiers and hall of fame from the log on first load
    st.log = s.log.filter(x => x && Number.isInteger(x.n) && x.n >= 0 && x.n < G.SPACE).slice(0, LOG_LIMIT);
    const name = String(data.name || file.name.replace(/\.json$/i, '').replace(/^(rngdle10|longshot10)-/, '') || 'Imported save').slice(0, 40);
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
    const use = ev.target.closest('[data-use]'), fuse = ev.target.closest('[data-fuse]'), all = ev.target.closest('[data-fuse-all]'), useAll = ev.target.closest('[data-use-all]');
    if (use) useItem(use.dataset.use);
    if (useAll) useItem(useAll.dataset.useAll, Infinity);
    if (fuse) fuseItem(fuse.dataset.fuse);
    if (all) fuseItem(all.dataset.fuseAll, Infinity);
    const pin = ev.target.closest('[data-pin]');
    if (pin) togglePin(pin.dataset.pin);
  });

  // Skins. Free ones are always owned; the rest are found in the page, bought as one bundle, or
  // earned from the badge book. Owned skins belong to the save file.
  const SKINS = [
    { id: 'midnight', name: 'Midnight', how: 'free' },
    { id: 'felt', name: 'Felt', how: 'free' },
    { id: 'daylight', name: 'Daylight', how: 'free', light: true },
    { id: 'contrast', name: 'High Contrast', how: 'free' },
    { id: 'neon', name: 'Neon', how: 'secret', hint: 'The logo hides something.' },
    { id: 'lcd', name: 'LCD', how: 'secret', hint: 'Keep pressing the version number.' },
    { id: 'blueprint', name: 'Blueprint', how: 'secret', hint: 'Search the collection for the plans.' },
    { id: 'terminal', name: 'Terminal', how: 'secret', hint: 'Settings has a command line somewhere.' },
    { id: 'console', name: 'Console', how: 'secret', hint: 'Comes with Terminal.' },
    { id: 'chat', name: 'Chat', how: 'secret', hint: 'Say hello to a command line.' },
    { id: 'handheld', name: 'Handheld', how: 'secret', hint: 'An old cheat code still works.' },
    { id: 'calc', name: 'Calculator', how: 'secret', hint: 'Say hello the calculator way, in the number lookup.' },
    { id: 'sheet', name: 'Spreadsheet', how: 'secret', hint: 'A command line that is spoken to in formulas.', light: true },
    { id: 'gold', name: 'Gold', how: 'bundle' },
    { id: 'ruby', name: 'Ruby', how: 'bundle' },
    { id: 'aurora', name: 'Aurora', how: 'bundle' },
    { id: 'graph', name: 'Graph Paper', how: 'book', light: true },
    { id: 'spiral', name: 'Golden Spiral', how: 'book' },
    { id: 'odometer', name: 'Odometer', how: 'book' },
    { id: 'vapor', name: 'Vaporwave', how: 'book' },
    { id: 'spectrum', name: 'Spectrum', how: 'book', light: true },
    // Achievement rewards: each comes with one achievement, named in Settings.
    { id: 'chalk', name: 'Chalkboard', how: 'reward', ach: 'modes' },
    { id: 'nixie', name: 'Nixie', how: 'reward', badge: 'uniq' },
    { id: 'card', name: 'Index Card', how: 'reward', ach: 'share', light: true },
    { id: 'steel', name: 'Steel', how: 'reward', ach: 'workshop1' },
    { id: 'ledger', name: 'Ledger', how: 'reward', ach: 'shop1', light: true },
    { id: 'sakura', name: 'Sakura', how: 'reward', ach: 'streak7', light: true },
    { id: 'glacier', name: 'Glacier', how: 'reward', ach: 'weeklyAll', light: true },
    { id: 'bingo', name: 'Bingo Hall', how: 'reward', ach: 'bingo1', light: true },
    { id: 'punch', name: 'Punch Card', how: 'reward', ach: 'bounty10', light: true },
    { id: 'casino', name: 'Casino', how: 'reward', ach: 'hl5' },
    { id: 'marquee', name: 'Marquee', how: 'reward', ach: 'wheel7' },
    // Coin skins: bought one at a time for coins, in Settings.
    { id: 'olive', name: 'Olive', how: 'coins', price: 2000 },
  ];
  const SKIN_BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const BUNDLE_PRICE = 500;
  const ownsSkin = id => SKIN_BY_ID[id] && (SKIN_BY_ID[id].how === 'free' || state.skins.includes(id));
  function unlockSkin(id, why) {
    if (ownsSkin(id)) return false;
    state.skins.push(id);
    toast(`${esc(why)}: <b>${esc(SKIN_BY_ID[id].name)}</b> skin unlocked`, 'legendary');
    checkAchievements();
    save();
    if ($('settingsDialog').open) renderSkins();
    return true;
  }
  function wearSkin(id) {
    if (!ownsSkin(id)) return;
    if (FULL_SKINS.includes(id) && !FULL_SKINS.includes(state.settings.theme)) state.settings.prevSkin = state.settings.theme;
    state.settings.theme = id;
    // A full-screen skin worn from the Settings command line would otherwise sit under the open dialog.
    if (FULL_SKINS.includes(id)) for (const d of document.querySelectorAll('dialog[open]')) d.close();
    applySettings();
    save();
  }
  // What earns a reward skin: one achievement, or one badge.
  function rewardNote(s) {
    if (s.badge) { const b = findBadge(s.badge); return `Find the ${b.name} badge (${odds(b.p)})`; }
    const a = ACHIEVEMENTS.find(x => x.id === s.ach);
    return `Earn ${a.name}: ${a.desc.charAt(0).toLowerCase()}${a.desc.slice(1)}`;
  }
  function renderSkins() {
    const groups = [['free', 'Free'], ['secret', 'Secret'], ['bundle', `Bundle, ${BUNDLE_PRICE} coins`], ['coins', 'For coins'], ['book', 'Badge book'], ['reward', 'Achievement rewards']];
    $('skinList').innerHTML = groups.map(([how, title]) => `<li class="skin-group"><b>${title}</b></li>` + SKINS.filter(s => s.how === how).map(s => {
      const own = ownsSkin(s.id), on = state.settings.theme === s.id;
      const page = BOOK.find(p => p.skin === s.id);
      const note = own ? '' : how === 'secret' ? s.hint : how === 'book' ? `Complete the ${page.cat} page`
        : how === 'reward' ? rewardNote(s) : how === 'coins' ? `${fmt(s.price)} coins` : `${BUNDLE_PRICE} coins`;
      return `<li><button class="skin${on ? ' on' : ''}" type="button" data-skin="${s.id}" aria-pressed="${on}" ${own ? '' : 'disabled'}>`
        + `<span class="swatch" data-swatch="${s.id}" aria-hidden="true"></span><span><b>${own || how !== 'secret' ? esc(s.name) : '???'}</b>`
        + `${note ? `<br><span class="muted">${esc(note)}</span>` : ''}</span></button>`
        + (how === 'coins' && !own ? `<button class="btn buy-skin" type="button" data-buyskin="${s.id}" ${state.coins >= s.price ? '' : 'disabled'} aria-label="Buy the ${esc(s.name)} skin for ${fmt(s.price)} coins">Buy for ${fmt(s.price)} coins</button>` : '') + '</li>';
    }).join('')).join('');
    const bundleOwned = SKINS.filter(s => s.how === 'bundle').every(s => ownsSkin(s.id));
    $('buyBundle').hidden = bundleOwned;
    $('buyBundle').disabled = state.coins < BUNDLE_PRICE;
    $('buyBundle').textContent = `Buy Gold, Ruby and Aurora for ${BUNDLE_PRICE} coins (you have ${fmt(state.coins)})`;
  }
  function buySkin(id) {
    const s = SKIN_BY_ID[id];
    if (!s || s.how !== 'coins' || ownsSkin(id) || state.coins < s.price) return false;
    state.coins -= s.price;
    unlockSkin(id, `Bought for ${fmt(s.price)} coins`);
    return true;
  }
  $('skinList').addEventListener('click', ev => {
    const buy = ev.target.closest('[data-buyskin]');
    if (buy) { if (buySkin(buy.dataset.buyskin)) wearSkin(buy.dataset.buyskin); renderSkins(); return; }
    const b = ev.target.closest('[data-skin]');
    if (b) { wearSkin(b.dataset.skin); renderSkins(); }
  });
  function buyBundle() {
    if (state.coins < BUNDLE_PRICE || SKINS.filter(s => s.how === 'bundle').every(s => ownsSkin(s.id))) return false;
    state.coins -= BUNDLE_PRICE;
    for (const s of SKINS) if (s.how === 'bundle' && !ownsSkin(s.id)) state.skins.push(s.id);
    toast('Bundle bought: <b>Gold, Ruby and Aurora</b> skins unlocked', 'legendary');
    checkAchievements();
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
  const PROMPT = 'PS C:\\LongShot10> ';
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
    'RATE 90 to 5000        Turbo rolls per second: 90, 250, 500, 1000, 2000 or 5000.',
    'MODE [name]            Show or change the mode.',
    'DIFF [name]            Difficulty: standard, hardcore, nightmare, abyss, oblivion.',
    'TOKENS, UPGRADE [n|MAX]  Lucky tokens, and buying permanent luck levels.',
    'STATS                  Totals, best roll, collection.',
    'LUCK [mode]            Your tiers against the expected shares.',
    'LOG [n]                Your last n rolls (default 10).',
    'BEST [mode]            Hall of fame.',
    'INV                    Inventory and active effects.',
    'USE item [ALL]         Use an item, or all of it, e.g. USE luck100 or USE goose ALL.',
    'FUSE item [ALL]        Fuse an item into the next one up, once or as often as you can.',
    'FUSE ALL               Fuse everything as far up as it goes.',
    'SPIN [n|ALL]           Spin the coin slot.',
    'ODDS                   The slot prize table and your pity.',
    'QUESTS [CLAIM n|REROLL n]  Today\'s and this week\'s quests; claim one (W1 for weekly) or reroll one.',
    'BOOK [CLAIM page]      Badge book pages, or claim one.',
    'BADGES [word]          Badges by category, or the ones matching a word.',
    'ACH                    Achievements.',
    'RECORDS                Records and how lucky you have been.',
    'BINGO                  This week\'s bingo card.',
    'HL RARER|COMMONER [bet]  Higher or lower in the arcade.',
    'DIGIT d [bet]          Digit pick: bet on how many of ten cells show d.',
    'WHEEL                  Spin the daily wheel.',
    'SCRATCH                Buy and scratch a scratch card.',
    'BOUNTIES               The bounty board.',
    'WORKSHOP [BUY id]      Token workshop upgrades, or buy the next level of one.',
    'SHOP [BUY item [n]]    The coin shop, or buy from it, e.g. SHOP BUY luck100 10.',
    'CHANCE tier [n]        Chance of that tier or rarer in n rolls, e.g. CHANCE mythic 5000.',
    'PRESTIGE [YES]         Prestige progress, or prestige.',
    'SKINS, SKIN id         Your skins, or wear one.  BUY BUNDLE buys three.',
    'SOUND ON|OFF           Sound.',
    'VER, CLS, GUI          Version, clear the screen, back to the clickable look.',
  ];
  function shell(line, print) {
    let cmd = line.trim();
    if (!cmd) return;
    if (cmd.startsWith('=')) { // a formula: unlocks the Spreadsheet skin, then runs as its command
      if (unlockSkin('sheet', 'Formula entered')) print('Formulas work here. SKIN sheet opens the Spreadsheet skin.');
      const f = formulaToCommand(cmd);
      if (f.value !== undefined) { print(`${cmd} = ${+f.value.toPrecision(12)}`, ''); return; }
      cmd = f.cmd;
      if (/^roll\b/i.test(cmd)) state.formula = true;
      if (!cmd) return;
    }
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
      case 'ver': print('', `Long Shot 10 [Version ${$('version').textContent.slice(1)}]`, ''); break;
      case 'cls': case 'clear': print.clear(); break;
      case 'exit': if (print.exit) print.exit(); else print('Type GUI to leave the Console skin.'); break;
      case 'gui': leaveFull(); break;
      case 'hello': case 'hi': case 'hey':
        print(unlockSkin('chat', 'Someone said hello') ? 'Hello! You unlocked the Chat skin. SKIN chat to talk to Tenny.' : 'Hello again!', '');
        break;
      case 'roll': {
        if (!ready[state.mode]) { print('The odds are still loading. Try again in a moment.'); break; }
        if (auto) setAuto(null);
        const n = Math.max(1, Math.min(1e4, Math.floor(+arg.replace(/,/g, '') || 1)));
        (() => {
          let best = null;
          for (let i = 0; i < n; i++) {
            const r = takeRoll();
            if (!best || r.rec.entry.oneInLog > best.rec.entry.oneInLog) best = r;
            if (n <= 10) print(rollLine(r.rec.entry));
          }
          if (n > 10) print(`${fmt(n)} rolls. Best:`, rollLine(best.rec.entry));
          drawRoll(best, 3, true);
        })();
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
      case 'diff': case 'difficulty': {
        const d = a && G.DIFFICULTIES.find(x => x.id === a || x.name.toLowerCase() === a);
        if (a && !d) { print(`Difficulties: ${G.DIFFICULTIES.map(x => x.id).join(', ')}`); break; }
        if (d) setDifficulty(d.id);
        const cur = G.DIFF_BY_ID[state.difficulty || 'standard'];
        print(`${cur.name}: ${cur.desc} Lucky tokens ×${TOKENS_PER[cur.id]}.`);
        break;
      }
      case 'tokens':
        print(`Lucky tokens: ${fmt(state.tokens || 0)}`, `Luck level ${fmt(state.luckLevel || 0)}: every roll is the best of ${fmt(permLuck())}.`, `Next level: ${fmt(levelCost(state.luckLevel || 0))} tokens. UPGRADE or UPGRADE MAX.`, '');
        break;
      case 'upgrade': {
        const k = upgradeLuck(a === 'max' || a === 'all' ? Infinity : Math.max(1, Math.floor(+a || 1)));
        print(k ? `Upgraded ${fmt(k)} ${k === 1 ? 'level' : 'levels'}: luck level ${fmt(state.luckLevel)}, every roll the best of ${fmt(permLuck())}. ${fmt(state.tokens)} tokens left.` : `Not enough tokens: the next level costs ${fmt(levelCost(state.luckLevel || 0))}, you have ${fmt(state.tokens || 0)}.`, '');
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
          `Prestige       ${state.prestige || 0} (drops ×${prestigeBonus()})`, `Lucky tokens   ${fmt(state.tokens || 0)}, luck level ${fmt(state.luckLevel || 0)}`,
          `Difficulty     ${G.DIFF_BY_ID[state.difficulty || 'standard'].name}`, '');
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
        if (w === 'fuse' && (a === 'all' || a === 'everything')) { print(fuseEverything() || 'Nothing has enough to fuse.', ''); break; }
        if (w === 'fuse' && / all$/.test(a)) {
          const it = findItem(a.replace(/ all$/, ''));
          const k = it ? fuseItem(it.id, Infinity) : 0;
          print(k ? `Fused ${fmt(k)} times into ${ITEM_BY_ID[it.next[0]].name}.` : 'Nothing to fuse there.', '');
          break;
        }
        const many = w === 'use' && / all$/.test(a);
        const it = arg && findItem(many ? a.replace(/ all$/, '') : arg);
        if (!it) { print(`No item called ${arg || '(nothing)'}. INV lists yours.`); break; }
        const before = state.inv[it.id] || 0;
        $('invMsg').textContent = '';
        if (w === 'use') useItem(it.id, many ? Infinity : 1); else fuseItem(it.id);
        if ((state.inv[it.id] || 0) !== before) print(w === 'use' ? `Used ${fmt(before - (state.inv[it.id] || 0))} ${it.name}. Active: ${effectsText().join(', ')}` : `Fused into ${ITEM_BY_ID[it.next[0]].name}.`);
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
        const qs = todaysQuests(), wk = weeksQuests(), sub = (rest[0] || '').toLowerCase();
        const line = (q, tag) => {
          const d = QUEST_BY_ID[q.id];
          return `${pad(tag + '.', 4)}${pad(d.text, 40)}${pad(`${fmt(q.have)} / ${fmt(d.goal)}`, 18)}${q.claimed ? 'claimed' : q.have >= d.goal ? `ready: QUESTS CLAIM ${tag}` : `${questCoins(d)} coins and ${ITEM_BY_ID[d.item].name}`}`;
        };
        if (sub === 'claim') {
          const tag = (rest[1] || '1').toLowerCase(), weekly = tag.startsWith('w'), i = (+tag.replace('w', '') || 1) - 1;
          const q = (weekly ? wk : qs).list[i];
          if (!q) { print('QUESTS CLAIM 1, 2 or 3, or W1, W2 or W3 for weekly quests.'); break; }
          print(claimQuest(weekly ? 'w' + i : i) ? `Claimed: ${QUEST_BY_ID[q.id].text}.` : q.claimed ? 'Already claimed.' : 'That quest is not done yet.');
          break;
        }
        if (sub === 'reroll') {
          const i = (+rest[1] || 1) - 1, old = qs.list[i];
          const next = old && rerollQuest(i);
          print(next ? `Swapped ${QUEST_BY_ID[old.id].text} for ${next.text}.` : !old ? 'QUESTS REROLL 1, 2 or 3.' : old.claimed ? 'That quest is claimed.' : 'No rerolls left today. A Quest Ticket buys one more.', '');
          break;
        }
        print('Today', ...qs.list.map((q, i) => line(q, String(i + 1))), 'This week', ...wk.list.map((q, i) => line(q, 'W' + (i + 1))),
          `Rerolls: ${freeRerolls() ? '1 free today' : `${fmt(state.inv.ticket || 0)} Quest Tickets`}. QUESTS REROLL n swaps one.`, '');
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
      case 'workshop': case 'work': {
        if (rest[0] && rest[0].toLowerCase() === 'buy') {
          const w = WORKSHOP.find(x => x.id.toLowerCase() === (rest[1] || '').toLowerCase() || x.name.toLowerCase().startsWith((rest[1] || '-').toLowerCase()));
          if (!w) { print(`WORKSHOP BUY ${WORKSHOP.map(x => x.id).join('|')}`); break; }
          const cost = wsCost(w, wsLevel(w.id));
          print(buyWorkshop(w.id) ? `${w.name} is now level ${wsLevel(w.id)}: ${w.short} ×${+wsBonus(w.id).toFixed(2)}. ${fmt(state.tokens)} tokens left.`
            : wsLevel(w.id) >= w.max ? `${w.name} is maxed.` : `It costs ${fmt(cost)} tokens; you have ${fmt(state.tokens || 0)}.`, '');
          break;
        }
        print(`Lucky tokens: ${fmt(state.tokens || 0)}`, ...WORKSHOP.map(w => `${pad(w.id, 12)}${pad(`level ${wsLevel(w.id)}/${w.max}`, 14)}${pad(`×${+wsBonus(w.id).toFixed(2)} ${w.short}`, 22)}${wsLevel(w.id) >= w.max ? 'maxed' : `next ${fmt(wsCost(w, wsLevel(w.id)))} tokens`}`), '');
        break;
      }
      case 'shop': {
        if (rest[0] && rest[0].toLowerCase() === 'buy') {
          const it = rest[1] && findItem(rest[1]);
          const row = it && SHOP.find(x => x[0] === it.id);
          if (!row) { print(`The shop sells: ${SHOP.map(x => x[0]).join(', ')}`); break; }
          const k = buyShop(it.id, Math.max(1, Math.floor(+rest[2] || 1)));
          print(k ? $('shopMsg').textContent : `It costs ${fmt(row[1])} coins each; you have ${fmt(state.coins)}.`, '');
          break;
        }
        print(`Coins: ${fmt(state.coins)}`, ...SHOP.map(([id, price]) => `${pad(id, 12)}${pad(fmt(price) + ' coins', 14)}${ITEM_BY_ID[id].name}`), '');
        break;
      }
      case 'hl': {
        const pick = (rest[0] || '').toLowerCase();
        if (!hl.cur) hl.cur = arcadeRoll();
        if (!['rarer', 'commoner', 'higher', 'lower'].includes(pick)) {
          print(`This roll: ${ROLL_TIERS[T(hl.cur.tier)].name} ${oneText(hl.cur)}. Rarer pays ${hlPays(hl.cur.p)}× (${chanceText(hl.cur.p)}), commoner ${hlPays(1 - hl.cur.p)}× (${chanceText(1 - hl.cur.p)}).`, 'HL RARER [bet] or HL COMMONER [bet]; bets are 1, 5, 25 or 100 coins.', '');
          break;
        }
        const bet = [1, 5, 25, 100].includes(+rest[1]) ? +rest[1] : 1;
        $('hlBet').value = String(bet);
        print(playHl(pick === 'rarer' || pick === 'higher') || $('hlOut').textContent, '');
        break;
      }
      case 'digit': {
        const d = +rest[0];
        if (!/^\d$/.test(rest[0] || '')) { print(`DIGIT d [bet]: pays by how many of ten cells show d. Payback ${(100 * DIGIT_RETURN).toFixed(1)}%.`, ...DIGIT_PAYS.map((m, k) => `${pad(k + ' cells', 10)}${pad(chanceText(binom10(k)), 22)}${m ? fmt(m) + '×' : 'nothing'}`), ''); break; }
        state.settings.digit = d;
        $('digitBet').value = String([1, 5, 25, 100].includes(+rest[1]) ? +rest[1] : 1);
        print(playDigit() || $('digitOut').textContent, '');
        break;
      }
      case 'wheel':
        if (arc().wheelDay === dayKey()) { print('The wheel has been spun today. A new free spin comes tomorrow.'); break; }
        spinWheel().then(t => print(t || 'The wheel has been spun today.', ''));
        break;
      case 'scratch': {
        const r = buyScratch();
        if (!r) { print(`A card costs ${SCRATCH_COST} lucky tokens; you have ${fmt(state.tokens || 0)}.`); break; }
        print(...[0, 1, 2].map(i => scratchCard.cells.slice(i * 3, i * 3 + 3).map(c => pad(c, 8)).join('')), r, '');
        scratchCard.shown = scratchCard.cells.map(() => true);
        scratchCard.told = true;
        break;
      }
      case 'bingo': {
        const card = bingoCard(), w = 13;
        print(...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => {
          const i = r * 5 + c, id = card.cells[i];
          return pad(`${card.marked[i] ? '[x]' : '[ ]'} ${id === 'free' ? 'FREE' : findBadge(id).name}`.slice(0, w - 1), w);
        }).join('')), `${card.marked.filter(Boolean).length - 1} of 24 marked, ${card.lines.length} lines. Full card: ${card.full ? 'done' : 'not yet'}.`, '');
        break;
      }
      case 'bounties': case 'bounty': {
        const bs = bounties(), left = (bs.at + 1) * BOUNTY_EVERY - Date.now();
        print(...bs.list.map(b => { const r = bountyReward(b.id); return `${b.done ? '[x]' : '[ ]'} ${pad(huntName(b.id), 32)}${pad(odds(huntP(b.id)), 18)}${r.coins} coins, ${fmt(r.tokens)} tokens`; }),
          `New board in ${Math.floor(left / 3600e3)} h ${Math.floor(left / 60000) % 60} min.`, '');
        break;
      }
      case 'records': {
        renderRecords();
        renderLuckRating();
        const rows = [...$('records').querySelectorAll('dt')].map(dt => `${pad(dt.textContent, 28)}${dt.nextElementSibling.textContent}`);
        print(...(rows.length ? rows : ['No records yet.']), '', ...[...$('luckRating').querySelectorAll('li')].map(li => li.textContent), '');
        break;
      }
      case 'chance': {
        const [tierWord, count] = rest;
        const r = tierWord && RARITIES.find(x => x.id === tierWord.toLowerCase() || x.name.toLowerCase() === tierWord.toLowerCase());
        if (!r || r.id === 'common') { print('CHANCE tier [n], e.g. CHANCE mythic 5000. Tiers: ' + RARITIES.slice(1).map(x => x.id).join(', ')); break; }
        $('ocTier').value = r.id;
        $('ocRolls').value = count || '1000';
        renderOddsCalc();
        print(`${r.name} or rarer in ${fmt(+String(count || 1000).replace(/,/g, '') || 0)} rolls (${$('calcFor').textContent}):`, $('ocOut').textContent, '');
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
        if (SKIN_BY_ID[a] && SKIN_BY_ID[a].how === 'coins') { print(buySkin(a) ? `Bought the ${SKIN_BY_ID[a].name} skin. SKIN ${a} wears it.` : ownsSkin(a) ? 'You already own it.' : `It costs ${fmt(SKIN_BY_ID[a].price)} coins; you have ${fmt(state.coins)}.`); break; }
        if (a !== 'bundle') { print(`BUY BUNDLE buys Gold, Ruby and Aurora. ${SKINS.filter(x => x.how === 'coins').map(x => `BUY ${x.id.toUpperCase()} buys ${x.name} for ${fmt(x.price)} coins.`).join(' ')}`); break; }
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
      if (!$('termOut').textContent) termPrint('Long Shot 10 command line', 'Type HELP for a list of commands.', '');
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
      if (line.trim()) { history.push(line); at = history.length; state.cmds = (state.cmds || 0) + 1; }
      input.value = '';
      shell(line, print);
      checkAchievements();
      save();
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
    if (!$('conOut').textContent) conPrint('Long Shot 10 Console', `Save file: ${slotName(slots.active)}. Type HELP for the commands, GUI for the clickable look.`, '');
    setTimeout(() => $('conInput').focus(), 0);
  }
  $('console').addEventListener('click', () => { if (!getSelection().toString()) $('conInput').focus(); });

  // Full-screen skins: Console, Chat, Handheld and Calculator each replace the page with their own
  // way to play. They all drive the same game through the same functions; Leave returns to the skin
  // worn before.
  const FULL_SKINS = ['console', 'chat', 'handheld', 'calc', 'sheet'];
  const fullSkin = () => (FULL_SKINS.includes(state.settings.theme) ? state.settings.theme : null);
  function leaveFull() {
    const back = state.settings.prevSkin;
    wearSkin(back && ownsSkin(back) && !FULL_SKINS.includes(back) ? back : 'midnight');
  }
  // Every full-screen skin hears about each roll shown and each notice.
  function fullRoll(entry, manual) {
    const f = fullSkin();
    if (f === 'console') consoleRoll(entry);
    if (f === 'chat') chatRoll(entry, manual);
    if (f === 'handheld') { hh.last = entry; hhPaintSoon(); }
    if (f === 'calc') { calc.last = entry; calcPaintSoon(); }
    if (f === 'sheet') sheetRoll(entry);
  }
  function fullNotice(text) {
    const f = fullSkin();
    if (f === 'console') conPrint(text);
    if (f === 'chat') addBubble('note', text);
    if (f === 'handheld') { hh.note = text; hh.noteAt = performance.now(); hhPaintSoon(); }
    if (f === 'calc') { calc.note = text; calc.noteAt = performance.now(); calcPaintSoon(); }
    if (f === 'sheet') $('shOut').textContent = text;
  }
  function paintFull() {
    const f = fullSkin();
    paintConsole();
    $('chat').hidden = f !== 'chat';
    $('handheld').hidden = f !== 'handheld';
    $('calc').hidden = f !== 'calc';
    $('sheet').hidden = f !== 'sheet';
    if (f === 'sheet') { sheetPaint(); setTimeout(() => $('shInput').focus(), 0); }
    if (f === 'chat') {
      if (!$('chatLog').children.length) {
        addBubble('bot', `Hi, I'm Tenny. I roll the numbers around here.`);
        addBubble('bot', `Tap a button below or just tell me what to do: "roll 100", "endless", "stats", "use luck100"… Say "help" for everything I understand.`);
      }
      setTimeout(() => $('chatInput').focus(), 0);
    }
    if (f === 'handheld') hhPaint();
    if (f === 'calc') calcPaint();
  }
  for (const b of document.querySelectorAll('[data-leave]')) b.addEventListener('click', leaveFull);

  // Chat: the game as a conversation with Tenny, a chatty bot.
  const REACT = [
    ['trash', ['Oof. That one goes in the bin.', 'Bottom 1%. Impressive, in a way.']],
    ['common', ['A perfectly ordinary number.', 'Nothing special, but it is yours.', 'Plain and simple.']],
    ['uncommon', ['Ooh, a little better than usual.', 'Not bad!']],
    ['rare', ['Rare! Nice one.', 'Now we are talking.']],
    ['epic', ['EPIC! I felt that one.', 'Big roll!']],
    ['legendary', ['LEGENDARY. Screenshot that.', 'I need a moment.']],
    ['anomaly', ['That is not supposed to happen. Anomaly!', 'My circuits are tingling.']],
  ];
  const reactTo = tier => {
    const i = T(tier);
    const list = i > T('anomaly') ? [`${ROLL_TIERS[i].name}?! I am telling everyone about this.`, `A ${ROLL_TIERS[i].name} roll. Words fail me.`] : REACT.find(r => r[0] === tier)[1];
    return list[Math.floor(Math.random() * list.length)];
  };
  function addBubble(who, text) {
    const li = document.createElement('li');
    li.className = `bubble ${who}`;
    li.textContent = text;
    $('chatLog').appendChild(li);
    while ($('chatLog').children.length > 200) $('chatLog').firstChild.remove();
    $('chatLog').scrollTop = 1e9;
  }
  const chatPrint = (...lines) => { const t = lines.join('\n').replace(/\n+$/, ''); if (t.trim()) addBubble('bot mono', t); };
  chatPrint.clear = () => $('chatLog').replaceChildren();
  chatPrint.exit = leaveFull;
  let chatAt = 0;
  function chatRoll(entry, manual) {
    if (manual) return;
    if (!auto || T(entry.tier) < T('legendary')) return;
    const now = performance.now();
    if (now - chatAt < 400) return;
    chatAt = now;
    addBubble('bot', `${label(entry)}: ${ROLL_TIERS[T(entry.tier)].name}, ${oneText(entry)}. ${reactTo(entry.tier)}`);
  }
  function chatSay(line) {
    const t = line.trim();
    if (!t) return;
    addBubble('me', t);
    state.cmds = (state.cmds || 0) + 1;
    const low = t.toLowerCase().replace(/[!.?]+$/, '');
    if (/^(hi|hello|hey|yo|sup)\b/.test(low)) { addBubble('bot', 'Hey! Want me to roll something?'); return; }
    if (/^(thanks|thank you|ty|thx)\b/.test(low)) { addBubble('bot', 'Any time. Rolling is what I live for.'); return; }
    if (/^(bye|leave|exit|quit)\b/.test(low)) { addBubble('bot', 'See you around!'); setTimeout(leaveFull, 500); return; }
    const before = state.total;
    shell(t.replace(/^(please |can you |could you )/i, '').replace(/^(roll it|again)$/i, 'roll'), chatPrint);
    if (/^roll\b/i.test(t) && state.total > before && state.log[0]) {
      const best = state.log.slice(0, Math.min(200, state.total - before)).map(entryFor).sort((a, b) => b.oneInLog - a.oneInLog)[0];
      if (best) addBubble('bot', reactTo(best.tier));
    }
    checkAchievements();
    save();
  }
  $('chatForm').addEventListener('submit', ev => { ev.preventDefault(); const v = $('chatInput').value; $('chatInput').value = ''; chatSay(v); });
  $('chatChips').addEventListener('click', ev => { const b = ev.target.closest('[data-say]'); if (b) chatSay(b.dataset.say); });

  // Handheld: a pocket console with a four-shade screen, a D-pad and A and B buttons.
  const hh = { menu: 'main', cur: 0, top: 0, last: null, note: '', noteAt: 0, lines: null };
  const HH_MAIN = ['Roll', 'Roll x10', 'Auto', 'Endless', 'Items', 'Slot', 'Stats', 'Quests', 'Mode', 'Power off'];
  let hhFrame = 0;
  const hhPaintSoon = () => { if (!hhFrame) hhFrame = requestAnimationFrame(() => { hhFrame = 0; hhPaint(); }); };
  function hhCapture(cmd) { const out = []; const p = (...l) => out.push(...l); p.clear = () => {}; shell(cmd, p); return out.filter(l => l !== ''); }
  function hhItems() {
    if (hh.menu === 'main') return HH_MAIN.map(x => (x === 'Endless' && auto === 'endless') || (x === 'Auto' && auto === 'auto') ? 'Stop' : x);
    if (hh.menu === 'items') { const l = ITEMS.filter(i => state.inv[i.id] > 0).map(i => `${i.name} x${fmt(state.inv[i.id])}`); return l.length ? l : ['(no items)']; }
    if (hh.menu === 'slot') return ['Spin x1', 'Spin x10', 'Spin all'];
    if (hh.menu === 'mode') return MODES.map(m => (m.id === state.mode ? '* ' : '  ') + m.name);
    return hh.lines || [];
  }
  function hhPaint() {
    if (fullSkin() !== 'handheld') return;
    const e = hh.last || (state.log[0] && entryFor(state.log[0]));
    const head = e ? `${label(e)}\n${ROLL_TIERS[T(e.tier)].name.toUpperCase()}  ${oneText(e)}` : 'PRESS A TO ROLL\n';
    const items = hhItems(), rows = 6;
    hh.cur = Math.max(0, Math.min(hh.cur, items.length - 1));
    if (hh.cur < hh.top) hh.top = hh.cur;
    if (hh.cur >= hh.top + rows) hh.top = hh.cur - rows + 1;
    const pick = !['stats', 'quests'].includes(hh.menu);
    const body = items.slice(hh.top, hh.top + rows).map((t, i) => `${pick && hh.top + i === hh.cur ? '>' : ' '} ${t}`).join('\n');
    const note = performance.now() - hh.noteAt < 3000 ? hh.note : `${MODE_BY_ID[state.mode].name.toUpperCase()}  ${fmt(state.coins)}c${auto ? '  ' + auto.toUpperCase() : ''}`;
    $('hhScreen').textContent = `${head}\n${'-'.repeat(22)}\n${body}\n${'\n'.repeat(Math.max(0, rows - Math.min(rows, items.length)))}${'-'.repeat(22)}\n${note.slice(0, 44)}`;
  }
  function hhPress(btn) {
    if (fullSkin() !== 'handheld') return;
    const items = hhItems();
    tone(btn === 'a' ? 660 : btn === 'b' ? 440 : 520, 0.05, { type: 'square', gain: 0.02 });
    if (btn === 'up') hh.cur = hh.menu === 'stats' || hh.menu === 'quests' ? (hh.top = Math.max(0, hh.top - 1)) : hh.cur - 1;
    if (btn === 'down') hh.cur = hh.menu === 'stats' || hh.menu === 'quests' ? (hh.top = Math.min(Math.max(0, items.length - 6), hh.top + 1)) : hh.cur + 1;
    if (btn === 'b' && hh.menu !== 'main') { hh.menu = 'main'; hh.cur = 0; hh.top = 0; }
    if (btn === 'start') shell(auto ? 'stop' : 'endless', () => {});
    if (btn === 'select') { const i = MODE_IDS.indexOf(state.mode); setMode(MODE_IDS[(i + 1) % MODE_IDS.length]); }
    if (btn === 'a') {
      const pick = items[hh.cur] || '';
      const go = (menu, lines) => { hh.menu = menu; hh.cur = 0; hh.top = 0; hh.lines = lines || null; };
      if (hh.menu === 'main') {
        if (pick === 'Roll') shell('roll', () => {});
        if (pick === 'Roll x10') shell('roll 10', () => {});
        if (pick === 'Auto') shell('auto', () => {});
        if (pick === 'Endless') shell('endless', () => {});
        if (pick === 'Stop') shell('stop', () => {});
        if (pick === 'Items') go('items');
        if (pick === 'Slot') go('slot');
        if (pick === 'Stats') go('stats', hhCapture('stats').map(l => l.replace(/\s{2,}/g, ' ').slice(0, 22)));
        if (pick === 'Quests') go('quests', todaysQuests().list.flatMap((q, i) => { const d = QUEST_BY_ID[q.id]; return [`${i + 1} ${d.text}`.slice(0, 22), `  ${fmt(q.have)}/${fmt(d.goal)}${q.claimed ? ' done' : q.have >= d.goal ? ' CLAIMED' : ''}`]; }));
        if (pick === 'Quests') todaysQuests().list.forEach((q, i) => { if (!q.claimed && q.have >= QUEST_BY_ID[q.id].goal) claimQuest(i); });
        if (pick === 'Mode') go('mode');
        if (pick === 'Power off') { leaveFull(); return; }
      } else if (hh.menu === 'items') {
        const it = ITEMS.filter(i => state.inv[i.id] > 0)[hh.cur];
        if (it) { useItem(it.id); hh.note = `USED ${it.name.toUpperCase()}`; hh.noteAt = performance.now(); }
      } else if (hh.menu === 'slot') {
        const n = [1, 10, 'all'][hh.cur];
        if (state.coins > 0) spinSlot(n === 'all' ? 'all' : Math.min(n, state.coins)).then(() => { hh.note = [...$('slotResult').children].map(li => li.textContent).join(' ').toUpperCase(); hh.noteAt = performance.now(); hhPaint(); });
        else { hh.note = 'NO COINS'; hh.noteAt = performance.now(); }
      } else if (hh.menu === 'mode') setMode(MODE_IDS[hh.cur]);
    }
    if (btn === 'right' && hh.menu === 'items') {
      const it = ITEMS.filter(i => state.inv[i.id] > 0)[hh.cur];
      if (it && fuseItem(it.id, Infinity)) { hh.note = `FUSED ${it.name.toUpperCase()}`; hh.noteAt = performance.now(); }
    }
    hhPaint();
  }
  $('handheld').addEventListener('click', ev => { const b = ev.target.closest('[data-hh]'); if (b) hhPress(b.dataset.hh); });
  const HH_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', z: 'a', Z: 'a', Enter: 'a', x: 'b', X: 'b', Backspace: 'b', Escape: 'b', ' ': 'start', Shift: 'select' };

  // Calculator: type how many rolls, press = to roll them. The display holds ten digits, exactly
  // one roll.
  const calc = { entry: '', last: null, note: '', noteAt: 0, memo: false };
  let calcFrame = 0;
  const calcPaintSoon = () => { if (!calcFrame) calcFrame = requestAnimationFrame(() => { calcFrame = 0; calcPaint(); }); };
  function calcPaint() {
    if (fullSkin() !== 'calc') return;
    const e = calc.memo ? MODE_IDS.map(m => state.hof[m][0]).filter(Boolean).sort((a, b) => b.log - a.log)[0] : calc.last || (state.log[0] && entryFor(state.log[0]));
    $('calcMain').textContent = calc.entry ? `×${calc.entry}` : e ? String(e.n) + (e.e > 1 ? sup(e.e) : '') : '0';
    const sub = performance.now() - calc.noteAt < 3000 ? calc.note
      : e ? `${calc.memo ? 'MR  ' : ''}${ROLL_TIERS[T(e.tier)].name}  ${oneText(e)}` : 'Type a count, then =';
    $('calcSub').textContent = sub;
    $('calcFlags').textContent = [MODE_BY_ID[state.mode].name.toUpperCase(), auto ? auto.toUpperCase() : '', luckActive() > 1 ? `L×${fmt(luckActive())}` : '', `${fmt(state.coins)}c`].filter(Boolean).join('  ');
  }
  const calcSay = text => { calc.note = text; calc.noteAt = performance.now(); };
  function calcKey(k) {
    if (fullSkin() !== 'calc') return;
    tone(700 + '0123456789'.indexOf(k) * 30, 0.03, { type: 'sine', gain: 0.03 });
    calc.memo = false;
    if (/^\d$/.test(k)) { if (calc.entry.length < 5) calc.entry = (calc.entry + k).replace(/^0+/, ''); }
    else if (k === 'C') { if (auto) shell('stop', () => {}); calc.entry = ''; calcSay('Cleared'); }
    else if (k === '=') {
      const n = Math.max(1, Math.min(1e4, +calc.entry || 1));
      calc.entry = '';
      const out = hhCapture(`roll ${n}`);
      calcSay(n > 1 ? `Best of ${fmt(n)} rolls` : out[0] ? out[0].split(/\s{2,}/)[1] || '' : '');
      if (!out.length) calcSay('Odds still loading');
    } else if (k === '+') { shell(auto === 'endless' ? 'stop' : 'endless', () => {}); calcSay(auto ? 'Endless on, C stops' : 'Stopped'); }
    else if (k === '−') { shell('stop', () => {}); calcSay('Stopped'); }
    else if (k === '×') {
      const it = [...ITEMS].filter(i => i.kind === 'luck' && state.inv[i.id] > 0).sort((a, b) => b.luck - a.luck)[0];
      if (it) { useItem(it.id); calcSay(`Luck ×${fmt(it.luck)} on`); } else calcSay('No luck charms');
    } else if (k === '÷') calcSay(fuseEverything() ? 'Fused everything' : 'Nothing to fuse');
    else if (k === 'MR') { calc.memo = true; }
    else if (k === 'M+') { const t = state.log[0]; if (t && !state.favs.some(f => f.n === t.n && f.t === t.t)) { state.favs.push(t); save(); calcSay('Starred'); } }
    else if (k === 'MODE') { const i = MODE_IDS.indexOf(state.mode); setMode(MODE_IDS[(i + 1) % MODE_IDS.length]); calcSay(MODE_BY_ID[state.mode].name); }
    else if (k === 'SPIN') {
      const n = Math.max(1, Math.min(state.coins, +calc.entry || 1));
      calc.entry = '';
      if (!state.coins) calcSay('No coins');
      else spinSlot(n).then(() => { calcSay([...$('slotResult').children].map(li => li.textContent).join(' ')); calcPaint(); });
    } else if (k === 'OFF') { leaveFull(); return; }
    checkAchievements();
    calcPaint();
  }
  $('calc').addEventListener('click', ev => { const b = ev.target.closest('[data-key]'); if (b) calcKey(b.dataset.key); });
  const CALC_KEYS = { Enter: '=', '=': '=', '+': '+', '-': '−', '*': '×', x: '×', '/': '÷', Escape: 'C', Delete: 'C', c: 'C', m: 'MODE', s: 'SPIN' };

  // Spreadsheet: the game as a sheet. Every roll is a row; the formula bar takes =ROLL(100) and every
  // other command as a formula (or typed plain); the tabs along the bottom turn command output into
  // tables, one column per field.
  const SHEET_COLS = ['Time', 'Number', 'Mode', 'Tier', '1/N', 'Score', 'Multiplier', 'Badges'];
  const SHEET_TABS = [['Rolls', ''], ['Stats', 'stats'], ['Luck', 'luck'], ['Items', 'inv'], ['Quests', 'quests'], ['Best', 'best'], ['Records', 'records'], ['Help', 'help']];
  const sheet = { tab: 'Rolls', rows: [], at: 0 };
  // =ROLL(100) → "roll 100", =USE("goose", "ALL") → "use goose all"; SUM, AVERAGE, MIN and MAX of
  // plain numbers work as they would in any sheet.
  function formulaToCommand(text) {
    const m = text.trim().match(/^=\s*([A-Za-z]+)\s*(?:\((.*)\))?\s*$/);
    if (!m) return { cmd: text.replace(/^=\s*/, '') };
    const name = m[1].toLowerCase(), args = (m[2] || '').split(',').map(a => a.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean);
    const nums = args.map(a => +a.replace(/,/g, ''));
    const math = { sum: v => v.reduce((a, b) => a + b, 0), average: v => v.reduce((a, b) => a + b, 0) / v.length, min: v => Math.min(...v), max: v => Math.max(...v) };
    if (math[name] && nums.length && nums.every(Number.isFinite)) return { value: math[name](nums) };
    return { cmd: [name, ...args].join(' ') };
  }
  function sheetRow(e) {
    return [new Date(e.t).toLocaleTimeString(), fmt(e.n) + (e.e > 1 ? sup(e.e) : ''), MODE_BY_ID[e.mode].name, ROLL_TIERS[T(e.tier)].name, oneText(e),
      bigText(e.log), e.x && e.x !== 'unity' ? `× ${MULT_BY_ID[e.x].symbol}` : '', String(scoreOf(e).badges.length)];
  }
  function sheetRoll(entry) {
    // While Auto or Endless runs, only Rare or rarer rows land, at most twenty a second, so the sheet stays readable.
    if (auto) {
      if (T(entry.tier) < T('rare')) return;
      const now = performance.now();
      if (now - sheet.at < 50) return;
      sheet.at = now;
    }
    sheet.rows.unshift({ cells: sheetRow(entry), tier: entry.tier });
    if (sheet.rows.length > 200) sheet.rows.length = 200;
    if (sheet.tab === 'Rolls') sheetPaintSoon();
  }
  let sheetFrame = 0;
  const sheetPaintSoon = () => { if (!sheetFrame) sheetFrame = requestAnimationFrame(() => { sheetFrame = 0; sheetPaint(); }); };
  const colName = i => String.fromCharCode(65 + i);
  function sheetPaint() {
    if (fullSkin() !== 'sheet') return;
    let head, rows;
    if (sheet.tab === 'Rolls') {
      if (!sheet.rows.length) sheet.rows = state.log.slice(0, 50).map(entryFor).map(e => ({ cells: sheetRow(e), tier: e.tier }));
      head = SHEET_COLS;
      rows = sheet.rows;
    } else {
      const lines = hhCapture(SHEET_TABS.find(t => t[0] === sheet.tab)[1]);
      rows = lines.map(l => ({ cells: l.trim().split(/\s{2,}/) }));
      head = Array.from({ length: Math.max(1, ...rows.map(r => r.cells.length)) }, () => '');
    }
    const width = head.length;
    const th = `<tr><th class="corner" scope="col"></th>${head.map((_, i) => `<th scope="col">${colName(i)}</th>`).join('')}</tr>`;
    const titles = sheet.tab === 'Rolls' ? `<tr class="names"><th scope="row">1</th>${head.map(h => `<td>${esc(h)}</td>`).join('')}</tr>` : '';
    const first = sheet.tab === 'Rolls' ? 2 : 1;
    const body = rows.length ? rows.map((r, k) => `<tr${r.tier ? ` style="--tc:${tierVar(r.tier)}"` : ''}><th scope="row">${k + first}</th>${Array.from({ length: width }, (_, i) => `<td${r.tier && i === 3 ? ' class="tier"' : ''}>${esc(r.cells[i] || '')}</td>`).join('')}</tr>`).join('')
      : `<tr><th scope="row">${first}</th><td colspan="${width}" class="empty">${sheet.tab === 'Rolls' ? 'Type =ROLL() in the formula bar, or =ROLL(1000) for a thousand.' : 'Nothing here yet.'}</td></tr>`;
    $('shGrid').innerHTML = `<thead>${th}</thead><tbody>${titles}${body}</tbody>`;
    $('shStatus').textContent = `${MODE_BY_ID[state.mode].name} · ${fmt(state.coins)} coins${auto ? ` · ${auto}` : ''}`;
    $('shTabs').innerHTML = SHEET_TABS.map(([name]) => `<button type="button" role="tab" aria-selected="${name === sheet.tab}" data-sheet="${name}">${name}</button>`).join('');
  }
  const shPrint = (...lines) => { const t = lines.filter(l => l !== '').join('  ·  '); if (t) $('shOut').textContent = t; };
  shPrint.clear = () => { sheet.rows = []; sheetPaint(); };
  shPrint.exit = leaveFull;
  $('shForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const text = $('shInput').value;
    if (!text.trim()) return;
    $('shInput').value = '';
    state.cmds = (state.cmds || 0) + 1;
    const f = formulaToCommand(text);
    if (f.value !== undefined) $('shOut').textContent = `${text.trim()} = ${+f.value.toPrecision(12)}`;
    else { $('shOut').textContent = ''; if (/^=/.test(text.trim()) && /^roll\b/i.test(f.cmd)) state.formula = true; shell(f.cmd, shPrint); }
    checkAchievements();
    save();
    sheetPaint();
  });
  $('shTabs').addEventListener('click', ev => { const b = ev.target.closest('[data-sheet]'); if (b) { sheet.tab = b.dataset.sheet; sheetPaint(); } });
  $('shTabs').addEventListener('keydown', ev => {
    if (!['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const i = SHEET_TABS.findIndex(t => t[0] === sheet.tab), next = SHEET_TABS[(i + (ev.key === 'ArrowRight' ? 1 : SHEET_TABS.length - 1)) % SHEET_TABS.length][0];
    sheet.tab = next;
    sheetPaint();
    $('shTabs').querySelector(`[data-sheet="${next}"]`).focus();
  });

  // Keys for the handheld and calculator, and the Konami code that unlocks the handheld.
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konami = 0;
  document.addEventListener('keydown', ev => {
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    konami = k === KONAMI[konami] ? konami + 1 : k === KONAMI[0] ? 1 : 0;
    if (konami === KONAMI.length) { konami = 0; if (unlockSkin('handheld', 'Cheat code')) wearSkin('handheld'); }
    if (ev.ctrlKey || ev.metaKey || ev.altKey || document.querySelector('dialog[open]')) return;
    const f = fullSkin();
    if (f === 'handheld' && HH_KEYS[ev.key]) { ev.preventDefault(); hhPress(HH_KEYS[ev.key]); }
    if (f === 'calc') {
      if (ev.key === 'Backspace') { calc.entry = calc.entry.slice(0, -1); calcPaint(); ev.preventDefault(); return; }
      const key = /^\d$/.test(ev.key) ? ev.key : CALC_KEYS[ev.key];
      if (key) { ev.preventDefault(); calcKey(key); }
    }
  });

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
    checkAchievements();
    save();
    if (!$('tab-collection').hidden) renderBook();
    return true;
  }

  // Bingo: a new 5 × 5 card every Monday, 24 badges around a free centre, picked from the week and
  // the save file. A badge marks its cell when a played roll earns it (counted batch rolls collect no
  // badges). Each row, column and diagonal pays once; a full card pays a Diamond Goose.
  const BINGO_LINES = [
    ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
    ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
  ];
  // Eight common cells, eight uncommon, six rare and two very rare: from 1 in 20 down to 1 in 200,000.
  const BINGO_BANDS = [[1 / 20, 1 / 200, 8], [1 / 200, 1 / 2000, 8], [1 / 2000, 1 / 20000, 6], [1 / 20000, 1 / 200000, 2]];
  const BINGO_LINE_COINS = 15, BINGO_FULL_COINS = 100;
  function bingoCard() {
    const week = weekKey();
    if (!state.bingo || state.bingo.week !== week) {
      const next = seeded('bingo' + week + slots.active);
      const pool = BADGES.filter(b => !b.group && b.cat !== 'Daily'), pick = [];
      for (const [hi, lo, k] of BINGO_BANDS) {
        const band = pool.filter(b => b.p <= hi && b.p > lo);
        for (let i = 0; i < k && band.length; i++) pick.push(band.splice(next() % band.length, 1)[0].id);
      }
      for (let i = pick.length - 1; i > 0; i--) { const j = next() % (i + 1); [pick[i], pick[j]] = [pick[j], pick[i]]; }
      pick.splice(12, 0, 'free');
      state.bingo = { week, cells: pick, marked: pick.map(id => id === 'free'), lines: [], full: false };
    }
    return state.bingo;
  }
  function markBingo(badges) {
    const card = bingoCard();
    let changed = false;
    for (const b of badges) {
      const i = card.cells.indexOf(b.id);
      if (i < 0 || card.marked[i]) continue;
      card.marked[i] = changed = true;
      toast(`Bingo: <b>${esc(b.name)}</b> marked`, RARITIES[b.rarity].id, 'quest');
    }
    if (!changed) return;
    BINGO_LINES.forEach((line, k) => {
      if (card.lines.includes(k) || !line.every(i => card.marked[i])) return;
      card.lines.push(k);
      state.bingoLines = (state.bingoLines || 0) + 1;
      state.coins += BINGO_LINE_COINS;
      grant('luck100', `Bingo line, plus ${BINGO_LINE_COINS} coins`);
    });
    if (!card.full && card.marked.every(Boolean)) {
      card.full = true;
      state.bingoFull = (state.bingoFull || 0) + 1;
      state.coins += BINGO_FULL_COINS;
      grant('goose2', `Full bingo card, plus ${BINGO_FULL_COINS} coins`);
    }
    checkAchievements();
    if (!$('tab-collection').hidden) renderBingo();
  }
  function renderBingo() {
    const card = bingoCard();
    $('bingo').innerHTML = [0, 1, 2, 3, 4].map(r => `<div role="row">${[0, 1, 2, 3, 4].map(c => {
      const i = r * 5 + c, id = card.cells[i], on = card.marked[i];
      if (id === 'free') return '<span class="cell free on" role="gridcell" aria-label="Free centre, marked">Free</span>';
      const b = findBadge(id);
      return `<button class="cell${on ? ' on' : ''}" type="button" role="gridcell" data-bingo="${esc(id)}" style="--rc:${tierVar(RARITIES[b.rarity].id)}" aria-label="${esc(b.name)}, ${odds(b.p)}${on ? ', marked' : ''}">${esc(b.name)}</button>`;
    }).join('')}</div>`).join('');
    const marked = card.marked.filter(Boolean).length - 1;
    $('bingoSub').textContent = `${marked} of 24 marked, ${card.lines.length} ${card.lines.length === 1 ? 'line' : 'lines'}`;
    const ends = new Date(card.week + 'T00:00'); ends.setDate(ends.getDate() + 7);
    $('bingoNote').textContent = `Each line pays ${BINGO_LINE_COINS} coins and a Charm of a Hundred; a full card pays ${BINGO_FULL_COINS} coins and a Diamond Goose. A new card on ${ends.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}. Select a cell for its odds.`;
  }
  $('bingo').addEventListener('click', ev => { const b = ev.target.closest('[data-bingo]'); if (b) openBadge(findBadge(b.dataset.bingo)); });

  // Bounty board: three targets, badges or multipliers from 1 in 500 to 1 in 200,000, that change
  // every six hours. Landing one before it changes pays coins and lucky tokens, more for rarer ones.
  const BOUNTY_EVERY = 6 * 3600e3;
  const bountyReward = id => { const p = huntP(id); return { coins: Math.ceil(Math.log10(1 / p) ** 2), tokens: Math.round(1 / p / 20) }; };
  function bounties() {
    const at = Math.floor(Date.now() / BOUNTY_EVERY);
    if (!state.bounty || state.bounty.at !== at) {
      const next = seeded('bounty' + at + slots.active);
      const pool = BADGES.filter(b => !b.group && b.cat !== 'Daily' && b.p <= 2e-3 && b.p >= 5e-6).map(b => b.id)
        .concat(MULTS.filter(m => m.p <= 2e-3 && m.p >= 5e-6).map(m => 'x:' + m.id));
      const list = [];
      while (list.length < 3) list.push({ id: pool.splice(next() % pool.length, 1)[0], done: false });
      state.bounty = { at, list };
    }
    return state.bounty;
  }
  function checkBounties(rec) {
    let paid = false;
    for (const b of bounties().list) {
      if (b.done) continue;
      const hit = b.id.startsWith('x:') ? rec.r.mult.id === b.id.slice(2) : rec.r.badges.some(x => x.id === b.id);
      if (!hit) continue;
      const { coins, tokens } = bountyReward(b.id);
      b.done = paid = true;
      state.coins += coins;
      addTokens(tokens);
      state.bountiesDone = (state.bountiesDone || 0) + 1;
      toast(`Bounty: <b>${esc(huntName(b.id))}</b>, ${fmt(coins)} coins and ${fmt(tokens)} tokens`, 'legendary', 'quest');
    }
    if (!paid) return;
    checkAchievements();
    if (!$('tab-collection').hidden) renderBounties();
  }
  function renderBounties() {
    const bs = bounties(), left = (bs.at + 1) * BOUNTY_EVERY - Date.now();
    $('bountySub').textContent = `new board in ${Math.floor(left / 3600e3)} h ${Math.floor(left / 60000) % 60} min`;
    $('bounties').innerHTML = bs.list.map(b => {
      const { coins, tokens } = bountyReward(b.id), p = huntP(b.id);
      const rarity = b.id.startsWith('x:') ? MULT_BY_ID[b.id.slice(2)].rarity : findBadge(b.id).rarity;
      return `<li style="--rc:${tierVar(RARITIES[rarity].id)}"${b.done ? ' class="none"' : ''}><div><b>${esc(huntName(b.id))}</b> <span class="muted num">${odds(p)}</span><br>`
        + `<span class="muted">${b.done ? 'Collected' : `Pays ${fmt(coins)} coins and ${fmt(tokens)} lucky tokens`}</span></div>`
        + `<div class="item-actions">${b.done ? '<span class="muted">Done</span>' : `<button class="btn" type="button" data-bounty="${esc(b.id)}" aria-label="Hunt ${esc(huntName(b.id))}">Hunt</button>`}</div></li>`;
    }).join('');
  }
  $('bounties').addEventListener('click', ev => {
    const b = ev.target.closest('[data-bounty]');
    if (!b) return;
    if (!addAlsoHunt(b.dataset.bounty)) setHunt(b.dataset.bounty);
    selectTab('roll');
  });

  // Daily quests: three a day per save file, picked from the date and the save file so they are
  // the same all day. Each pays coins and an item; finishing all three pays a bonus. Weekly quests
  // work the same way over a week from Monday, with bigger goals and rewards.
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
  const WEEKLY = [
    { id: 'w-roll50k', text: 'Roll 50,000 times', goal: 5e4, on: 'roll', coins: 60, item: 'goose' },
    { id: 'w-roll250k', text: 'Roll 250,000 times', goal: 2.5e5, on: 'roll', coins: 150, item: 'luck10k' },
    { id: 'w-mythic3', text: 'Roll Mythic or rarer 3 times', goal: 3, on: 'tier', tier: 'mythic', coins: 80, item: 'luck1k' },
    { id: 'w-divine', text: 'Roll Divine or rarer', goal: 1, on: 'tier', tier: 'divine', coins: 100, item: 'goose' },
    { id: 'w-fresh5', text: 'Collect 5 badges you did not have', goal: 5, on: 'fresh', coins: 80, item: 'prism' },
    { id: 'w-spin500', text: 'Spin the coin slot 500 times', goal: 500, on: 'spin', coins: 50, item: 'coinmag' },
    { id: 'w-coins100', text: 'Find 100 coins', goal: 100, on: 'coin', coins: 50, item: 'tokencharm' },
    { id: 'w-mult10', text: 'Land 10 Rare or rarer multipliers', goal: 10, on: 'mult', coins: 60, item: 'prism' },
    { id: 'w-daily', text: 'Claim 9 daily quests', goal: 9, on: 'claim', coins: 100, item: 'goose' },
  ];
  const QUEST_BY_ID = Object.fromEntries(QUESTS.concat(WEEKLY).map(q => [q.id, q]));
  const questCoins = def => Math.round(def.coins * wsBonus('questSense')); // Quest sense in the workshop
  const QUEST_BONUS = 'luck1k', WEEKLY_BONUS = 'goose2';
  // FNV-1a of a text, then a step of a small mixer: the same picks all day (or week) for a save file.
  function seeded(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    return () => (h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0);
  }
  const pickQuests = (pool, seed) => { const next = seeded(seed), ids = pool.map(q => q.id), pick = []; while (pick.length < 3) pick.push(ids.splice(next() % ids.length, 1)[0]); return pick; };
  function todaysQuests() {
    const day = dayKey();
    if (state.quests.day !== day) {
      state.quests = { day, list: pickQuests(QUESTS, day + slots.active).map(id => ({ id, have: 0, claimed: false })), bonus: false, rerolls: 0 };
    }
    return state.quests;
  }
  const weekKey = () => { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dayKey(d.getTime()); }; // Monday's date
  function weeksQuests() {
    const week = weekKey();
    if (!state.weekly || state.weekly.week !== week) {
      state.weekly = { week, list: pickQuests(WEEKLY, 'w' + week + slots.active).map(id => ({ id, have: 0, claimed: false })), bonus: false };
    }
    return state.weekly;
  }
  function questEvent(on, amount = 1, test = () => true) {
    for (const [qs, weekly] of [[todaysQuests(), false], [weeksQuests(), true]]) {
      for (const q of qs.list) {
        const def = QUEST_BY_ID[q.id];
        if (def.on !== on || q.have >= def.goal || !test(def)) continue;
        q.have = Math.min(def.goal, q.have + amount);
        if (q.have >= def.goal) toast(`${weekly ? 'Weekly quest' : 'Quest'} done: <b>${esc(def.text)}</b>. Claim it in Trophies${consoleOn() ? ' or with QUESTS CLAIM' : ''}.`, 'rare', 'quest');
        if (!$('tab-trophies').hidden && (q.have >= def.goal || !auto)) renderQuests();
      }
    }
  }
  // One free reroll a day; after that each reroll costs a Quest Ticket. Claimed quests stay put.
  const freeRerolls = () => Math.max(0, 1 - (todaysQuests().rerolls || 0));
  function rerollQuest(i) {
    const qs = todaysQuests(), q = qs.list[i];
    if (!q || q.claimed) return false;
    const free = freeRerolls() > 0;
    if (!free && !(state.inv.ticket > 0)) return false;
    const pool = QUESTS.filter(d => !qs.list.some(x => x.id === d.id));
    const next = pool[randInt(pool.length)];
    if (free) qs.rerolls = (qs.rerolls || 0) + 1; else state.inv.ticket--;
    qs.list[i] = { id: next.id, have: 0, claimed: false };
    save();
    if (!$('tab-trophies').hidden) renderQuests();
    return next;
  }
  function questRow(q, i, weekly) {
    const def = QUEST_BY_ID[q.id], done = q.have >= def.goal;
    const canReroll = !weekly && !q.claimed && (freeRerolls() > 0 || state.inv.ticket > 0);
    const action = q.claimed ? '<span class="muted">Claimed</span>'
      : `<button class="btn" type="button" data-quest="${weekly ? 'w' : ''}${i}" ${done ? '' : 'disabled'}>Claim</button>`
        + (weekly || done ? '' : `<button class="btn" type="button" data-reroll="${i}" ${canReroll ? '' : 'disabled'} aria-label="Swap ${esc(def.text)} for another quest">Reroll</button>`);
    return `<li><div><b>${esc(def.text)}</b> <span class="muted num">${fmt(q.have)} / ${fmt(def.goal)}</span><br>`
      + `<span class="muted">Reward: ${questCoins(def)} coins and ${esc(ITEM_BY_ID[def.item].name)}</span>`
      + `<div class="progress"><i style="width:${(100 * q.have / def.goal).toFixed(1)}%"></i></div></div><div class="item-actions">${action}</div></li>`;
  }
  function renderQuests() {
    const qs = todaysQuests(), wk = weeksQuests();
    $('quests').innerHTML = qs.list.map((q, i) => questRow(q, i, false)).join('')
      + `<li class="muted">Finish all three for a bonus ${esc(ITEM_BY_ID[QUEST_BONUS].name)}${qs.bonus ? ' (paid)' : ''}. New quests every day at midnight.</li>`;
    $('rerollNote').textContent = freeRerolls() ? '1 free reroll today' : state.inv.ticket > 0 ? `${fmt(state.inv.ticket)} Quest ${state.inv.ticket === 1 ? 'Ticket' : 'Tickets'} for rerolls` : 'no rerolls left today';
    $('weekly').innerHTML = wk.list.map((q, i) => questRow(q, i, true)).join('')
      + `<li class="muted">Finish all three for a bonus ${esc(ITEM_BY_ID[WEEKLY_BONUS].name)}${wk.bonus ? ' (paid)' : ''}. New weekly quests every Monday.</li>`;
    const ends = new Date(wk.week + 'T00:00'); ends.setDate(ends.getDate() + 7);
    $('weekNote').textContent = `until ${ends.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
    renderStreak();
  }
  for (const id of ['quests', 'weekly']) {
    $(id).addEventListener('click', ev => {
      const b = ev.target.closest('[data-quest]'), r = ev.target.closest('[data-reroll]');
      if (b) claimQuest(b.dataset.quest);
      if (r) rerollQuest(+r.dataset.reroll);
    });
  }
  // `which`: a daily quest's index, or "w" and the index of a weekly one.
  function claimQuest(which) {
    const weekly = String(which).startsWith('w'), i = +String(which).replace('w', '');
    const qs = weekly ? weeksQuests() : todaysQuests(), q = qs.list[i];
    if (!q) return false;
    const def = QUEST_BY_ID[q.id];
    if (q.claimed || q.have < def.goal) return false;
    q.claimed = true;
    state.questsDone = (state.questsDone || 0) + 1;
    if (weekly) state.weeklyDone = (state.weeklyDone || 0) + 1;
    const coins = questCoins(def);
    state.coins += coins;
    grant(def.item, `${weekly ? 'Weekly quest' : 'Quest'} reward, plus ${coins} coins`);
    if (!weekly) questEvent('claim');
    if (!qs.bonus && qs.list.every(x => x.claimed)) {
      qs.bonus = true;
      if (weekly) state.weeklyBonuses = (state.weeklyBonuses || 0) + 1;
      grant(weekly ? WEEKLY_BONUS : QUEST_BONUS, weekly ? 'All weekly quests done' : 'All quests done');
    }
    autoFuse();
    checkAchievements();
    save();
    if (!$('tab-trophies').hidden) renderQuests();
    return true;
  }

  // Daily streak: days in a row with at least one roll. A Streak Freeze covers one missed day and is
  // used on its own; milestones pay out once each, and every seventh day brings a Streak Freeze.
  const STREAK_REWARDS = { 3: ['lens', 3], 7: ['luck100', 3], 14: ['horn', 2], 30: ['goose', 1], 60: ['luck10k', 1], 100: ['goose2', 1], 365: ['luck1m', 1] };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  function noteStreak() {
    const today = dayKey(), st = state.streak || (state.streak = { days: 0, last: '', best: 0 });
    if (st.last === today) return;
    const gap = st.last ? daysBetween(st.last, today) : 0, missed = gap - 1;
    let kept = gap === 1;
    if (gap > 1 && (state.inv.freeze || 0) >= missed) { state.inv.freeze -= missed; kept = true; toast(`${fmt(missed)} Streak ${missed === 1 ? 'Freeze' : 'Freezes'} kept your streak going`, 'rare'); }
    st.days = kept ? st.days + 1 : 1;
    st.last = today;
    st.best = Math.max(st.best || 0, st.days);
    if (st.days > 1) toast(`Daily streak: <b>${fmt(st.days)} days</b>`, 'uncommon');
    const reward = STREAK_REWARDS[st.days];
    if (reward) grant(reward[0], `${st.days}-day streak`, reward[1]);
    if (st.days % 7 === 0) grant('freeze', `${st.days}-day streak`);
    if (!$('tab-trophies').hidden) renderStreak();
  }
  // Lucky hour: one hour a day, picked from the date and the save file, when drops and coins come
  // twice as often. Weekends double coins. Both are shown in the status line while they run.
  const luckyHour = () => 9 + seeded('hour' + dayKey() + slots.active)() % 14; // from 9 a.m. to 10 p.m.
  const inLuckyHour = () => new Date().getHours() === luckyHour();
  const weekend = () => [0, 6].includes(new Date().getDay());
  const eventDrops = () => (inLuckyHour() ? 2 : 1);
  const eventCoins = () => eventDrops() * (weekend() ? 2 : 1);
  const hourText = h => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' });
  function renderStreak() {
    const st = state.streak || { days: 0, best: 0 };
    const alive = st.last && daysBetween(st.last, dayKey()) <= 1 + (state.inv.freeze || 0);
    const days = alive ? st.days : 0;
    const next = Object.keys(STREAK_REWARDS).map(Number).find(d => d > days);
    $('streakSub').textContent = st.best ? `best ${fmt(st.best)} ${st.best === 1 ? 'day' : 'days'}` : '';
    $('streakPanel').innerHTML = `<div class="coins-in-hand"><span class="num">${fmt(days)}</span><span>${days === 1 ? 'day' : 'days'} in a row${st.last === dayKey() ? ', today included' : alive && days ? ', roll today to keep it' : ''}</span></div>`
      + `<p class="muted">${next ? `Day ${next} pays ${esc(ITEM_BY_ID[STREAK_REWARDS[next][0]].name)}${STREAK_REWARDS[next][1] > 1 ? ` ×${STREAK_REWARDS[next][1]}` : ''}. ` : ''}Every seventh day brings a Streak Freeze, which covers one missed day on its own. You have ${fmt(state.inv.freeze || 0)}.</p>`
      + `<p class="muted">Today's lucky hour: ${hourText(luckyHour())} to ${hourText(luckyHour() + 1)}, when drops and coins come twice as often.${weekend() ? ' It is the weekend, so coins come twice as often all day.' : ' Coins come twice as often on Saturdays and Sundays.'}</p>`;
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
    checkAchievements();
    writeSave();
    renderPrestige();
    paintStatus();
  }

  // What's new: every release, newest first, with the UTC time it went out (from the repository's
  // history for the older ones). The newest one names the version shown in the footer.
  const RELEASES = [
    { v: 'v4.0', at: '2026-10-20 03:55', title: 'The arcade (major update)', items: [
      'A new Arcade tab with four games. Each shows its exact chances and its payback, and arcade rolls never touch your records.',
      'Higher or lower: will the next roll be rarer or commoner? The chance is exact (a roll beaten by a share q of rolls is beaten next time with chance q), and a right call pays 95% of the fair price.',
      'Digit pick: pick a digit, bet coins, and draw ten cells. Pays by how many show your digit, from your bet back for two up to ×10,000,000 for all ten. Payback 90.8%.',
      'Daily wheel: one free spin a day, with every segment drawn at the size of its true chance.',
      'Scratch card: 300 lucky tokens for three rows of three. A row of three matching symbols pays, up to a Charm of Ten Thousand for three Sevens.',
      'HL, DIGIT, WHEEL and SCRATCH in the command line. 1 to 6 now switch tabs.',
      'Two skins: Casino, the reward for Called it (five right calls in a row), and Marquee, the reward for a week of wheel spins. Eight new achievements.',
    ] },
    { v: 'v3.9', at: '2026-10-20 03:47', title: 'Spreadsheet', items: [
      'Spreadsheet, a full-screen secret skin: every roll is a row, the formula bar takes =ROLL(100), =USE("goose") and every other command, and sheet tabs turn your stats, luck, items, quests, best rolls and records into tables. SUM, AVERAGE, MIN and MAX work too. Its hint is in Settings.',
      'Run summary: when Auto or Endless stops after 100 rolls or more, you see how long it ran, how fast, its best roll, and the badges, coins, items and tokens it brought.',
      'Sort the Collection by likeliest, rarest, earned most, found most recently, or name.',
      'Badge mastery: four levels per badge, for earning it 1, 10, 100 and 1,000 times, shown as four small cells on its card. The Collection counts your total.',
      'Olive, a skin you buy for 2,000 coins in Settings (or BUY OLIVE). Three new achievements.',
    ] },
    { v: 'v3.8', at: '2026-10-20 03:37', title: 'Bingo and bounties', items: [
      'Bingo (Collection): a new 5 × 5 card of badges every Monday. Each line pays 15 coins and a Charm of a Hundred, a full card 100 coins and a Diamond Goose.',
      'Bounty board (Collection): three badges or multipliers that change every six hours. Land one in time for coins and lucky tokens, more for rarer ones. Hunt sets it as your target.',
      'Also hunt: hunt up to three things at once, from a badge\'s details or the bounty board.',
      'Auto can also stop on a badge you did not have (Auto settings).',
      'Endless can stop on its own after a number of rolls or minutes (Auto settings).',
      'BINGO and BOUNTIES in the command line.',
      'Two skins: Bingo Hall, the reward for a first bingo line, and Punch Card, the reward for ten bounties. Five new achievements.',
    ] },
    { v: 'v3.7', at: '2026-10-20 03:29', title: 'Every day', items: [
      'Daily streak (Trophies): days in a row with at least one roll. Day 3, 7, 14, 30, 60, 100 and 365 pay rewards, and every seventh day brings a Streak Freeze.',
      'Streak Freeze: covers one missed day on its own. From every seventh streak day, the coin shop, and Seven days straight.',
      'Lucky hour: one hour a day, different for each save file, when drops and coins come twice as often. The status line shows it while it runs.',
      'Weekends: coins come twice as often on Saturdays and Sundays.',
      'Quest rerolls: swap a daily quest you have not finished for another, once a day for free and then with a Quest Ticket (coin shop).',
      'Weekly quests: three bigger quests from Monday to Sunday, with a Diamond Goose for finishing all three. QUESTS lists both, QUESTS CLAIM W1 claims a weekly one, QUESTS REROLL swaps a daily one.',
      'Two skins: Sakura, the reward for a seven-day streak, and Glacier, the reward for a clean sweep of the weekly quests. Four new achievements.',
    ] },
    { v: 'v3.6', at: '2026-10-20 03:21', title: 'Workshop and shop', items: [
      'Token workshop (Inventory): four lasting upgrades bought with lucky tokens, kept through prestige. Coin sense and Item sense make coins and items drop up to 3 times as often, Token sense brings up to 3 times the tokens, and Quest sense makes quests pay up to 3 times the coins.',
      'Coin shop (Inventory): eleven items at fixed prices, for when you want a sure thing instead of a spin.',
      'Two items: the Coin Magnet (coins ×5 for 500 plain rolls) and the Token Charm (tokens ×3 for 500 rolls). Both drop from rare rolls, come from the slot and sell in the shop.',
      'Auto-fuse: Fuse everything can run on its own whenever items come in.',
      'Quick use: pin up to four items in the Inventory and use them from buttons under Roll.',
      'WORKSHOP and SHOP in the command line.',
      'Two skins: Steel, the reward for Tinkerer, and Ledger, the reward for Customer. Four new achievements.',
    ] },
    { v: 'v3.5', at: '2026-10-20 03:14', title: 'Records and luck', items: [
      'How lucky you have been (Log): your best plain roll of each mode against everyone with as many plain rolls, as an exact share of players.',
      'Odds calculator (Log): the chance of at least one roll of a tier or rarer in any number of rolls, in your mode and difficulty, with your luck. CHANCE does the same in the command line.',
      'Records (Log): busiest session and day, fastest Endless run, most badges on one roll, longest run without Trash, longest hunt, rarest badge, biggest multiplier. RECORDS lists them.',
      'Milestones (Log): the date and time you first reached each tier.',
      'Recent rolls can be filtered by mode and by tier, and exported as a CSV file with every detail of each roll.',
      'A badge\'s details now give your chance of finding it in the next 1,000 plain rolls.',
      'Two skins: Nixie, the reward for the Pandigital badge, and Index Card, the reward for Show and tell. Reward skins can now come from a badge as well as an achievement.',
    ] },
    { v: 'v3.4', at: '2026-10-20 03:06', title: 'Settings and shortcuts', items: [
      'What\'s new: this list, with the time of every release.',
      'Keys: press ? for every keyboard shortcut. New ones: B batches ×1,000, T changes speed, M changes mode, S stars the roll, 1 to 5 switch tabs.',
      'Text size: Normal, Large or Larger, in Settings.',
      'Notices: switch off the pop-ups for new badges, items and coins, quests or achievements.',
      'Batch ×25,000 and ×100,000. A batch played roll by roll for a hunt now stops when the hunt finds its target, and Stop batch ends it early.',
      'Keep boosts going: when a charm, lens or drop booster runs out, the next one of the same item is used (Inventory).',
      'Two skins: High Contrast, free, with white text on black and a yellow focus ring; Chalkboard, the reward for Mathematician.',
      'Fixes: the Trophies tab no longer runs off a phone screen, the Terminal skin no longer pushes the header buttons off it, and a full-screen skin worn from the Settings command line no longer opens under Settings.',
    ] },
    { v: 'v3.33', at: '2026-10-19 23:29', title: 'Instant rolls', items: ['Roll shows its result at once, and batches are counted instead of played, so ×5,000 takes milliseconds.'] },
    { v: 'v3.32', at: '2026-10-19 00:20', title: 'Batch rolls', items: ['Roll ×100, ×1,000 or ×5,000 at once; Endless can roll in batches.'] },
    { v: 'v3.31', at: '2026-10-19 00:14', title: 'Fast luck everywhere', items: ['Luck charms work in full on every difficulty, about a millisecond per lucky roll.'] },
    { v: 'v3.3', at: '2026-10-18 22:25', title: 'More tiers and items', items: ['Six tiers past Unfathomable up to Beyond, bigger charms, Platinum and Cosmic Goose, Kaleidoscope Lens, Overclock III.'] },
    { v: 'v3.26', at: '2026-10-18 22:18', title: 'Luck on every difficulty', items: ['Charms and permanent luck work on every difficulty.'] },
    { v: 'v3.25', at: '2026-10-18 21:35', title: 'Spin a billion coins', items: ['The coin slot handles any number of coins; Use all.'] },
    { v: 'v3.2', at: '2026-10-18 16:08', title: 'Difficulties', items: ['Hardcore, Nightmare, Abyss and Oblivion, and lucky tokens for permanent luck.'] },
    { v: 'v3.1', at: '2026-10-18 02:53', title: 'Long Shot 10', items: ['Renamed, 308 badges, Chat, Handheld and Calculator skins.'] },
    { v: 'v3.0', at: '2026-10-18 02:24', title: 'Skins', items: ['Sixteen skins, Console mode, quests, prestige and charts.'] },
  ];
  $('version').textContent = RELEASES[0].v;
  function renderNews() {
    $('newsList').innerHTML = RELEASES.map(r => `<section class="release"><h3>${esc(r.v)} <span class="muted">${esc(r.title)}</span></h3>`
      + `<p class="muted num"><time datetime="${esc(r.at.replace(' ', 'T'))}Z">${esc(r.at)} UTC</time></p>`
      + `<ul>${r.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></section>`).join('');
  }

  // Start
  if (state.lastGift !== dayKey()) { // one free charm a day, per save file
    state.lastGift = dayKey();
    setTimeout(() => { grant('luck10', 'Daily gift'); save(); }, 600);
  }
  for (const k of Object.keys(state.daily).sort().slice(0, -60)) delete state.daily[k]; // keep two months of daily counts
  for (const s of SKINS) if (((s.ach && state.ach[s.ach]) || (s.badge && state.counts[s.badge])) && !state.skins.includes(s.id)) state.skins.push(s.id); // earned before the skin existed
  applySettings();
  paintPrestigeMark();
  $('chartMode').value = state.mode;
  paintSound();
  paintMult(MULT_BY_ID.unity);
  setMode(state.mode);
  setDifficulty(G.DIFF_BY_ID[state.difficulty] ? state.difficulty : 'standard');
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
