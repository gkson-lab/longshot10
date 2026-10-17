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

  // Storage, carrying older saves forward.
  const KEY = 'rngdle10:v3';
  const LOG_LIMIT = 200;
  const perMode = make => Object.fromEntries(MODE_IDS.map(id => [id, make()]));
  const blank = () => ({
    v: 4, log: [], total: 0, totals: perMode(() => 0), counts: {}, first: {}, mults: {}, firstMult: {},
    tiers: perMode(() => ({})), hof: perMode(() => []), favs: [], ach: {}, huntsDone: 0, shares: 0,
    settings: { theme: 'midnight', effects: 'full', sound: true }, mode: 'classic',
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
      const old = JSON.parse(localStorage.getItem('rngdle9:v2'));
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
  let saveTimer = 0, storageOk = true;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch { storageOk = false; }
      $('storageNotice').hidden = storageOk;
    }, 200);
  }

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
    state.tiers[x.mode][tier.id] = (state.tiers[x.mode][tier.id] || 0) + 1;
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
    const base = speed === 1 ? 650 : 240, stagger = speed === 1 ? 100 : 30, spins = speed === 1 ? 24 : 10;
    $('expWrap').hidden = !x.e;
    const jobs = reels.map((r, i) => spinReel(r, s[i], base + i * stagger, spins + i * 2, i < lead, digitFace, speed === 1 ? () => tick(i) : null));
    const end = base + reels.length * stagger;
    if (x.e) jobs.push(spinReel($('expReel'), x.e, end + (speed === 1 ? 200 : 50), spins + 20, false, digitFace, null));
    const m = MULT_BY_ID[x.x];
    jobs.push(spinReel($('multReel'), m.symbol, end + (speed === 1 ? 450 : 100), spins + 26, false, multFace, () => paintMult(m)));
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
    for (const r of reels.concat($('expReel'))) { r.style.setProperty('--tc', tierVar(tierId)); r.classList.toggle('hit', i >= T('anomaly') && !r.classList.contains('lead')); }
    if (speed !== 3) fanfare(i);
    if (effects() !== 'full' || (speed === 3 && i < T('mythic'))) return;
    if (i >= T('rare')) burst(color, Math.min(400, 20 * 2 ** (i - 2)), 6 + i);
    // No shake or flash in Turbo, and never more than one flash every 3 seconds.
    if (i >= T('anomaly') && speed !== 3 && Date.now() - lastFlash > 3000) {
      lastFlash = Date.now();
      const c = $('cabinet');
      c.classList.remove('shake', 'shake-big'); void c.offsetWidth;
      c.classList.add(i >= T('divine') ? 'shake-big' : 'shake');
      const f = $('flash');
      f.style.setProperty('--tc', color);
      f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    }
  }

  function toast(html, colorId) {
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
  function showResult(x, { animate = false, speed = 1, preview = false, fresh = null } = {}) {
    const r = scoreOf(x);
    const rt = G.rollTier(r.rank, x.mode), { pct, tier } = rt;
    shown = { x, r, pct, tier, preview, odds: rt };
    $('firstRun').hidden = true;
    $('result').hidden = false;

    const w = $('tierWord'), i = T(tier.id);
    w.textContent = tier.name;
    w.style.setProperty('--tc', tierVar(tier.id));
    w.className = 'tier-word' + (i >= T('epic') ? ' glow' : '');
    if (animate && speed !== 3 && effects() !== 'off') { void w.offsetWidth; w.classList.add(i >= T('mythic') ? 'sheen' : 'pop'); }
    $('oneIn').textContent = oneText(rt);
    $('oneIn').style.setProperty('--tc', tierVar(tier.id));
    $('oneInNote').textContent = rt.estimated
      ? 'estimated: rarer than any of the two million sampled rolls'
      : `of ${MODE_BY_ID[x.mode].name} rolls do at least this well`;

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
  function renderBoards() {
    const mode = state.mode, name = MODE_BY_ID[mode].name;
    for (const el of document.querySelectorAll('[data-board]')) {
      const all = el.dataset.board === 'all';
      const list = all ? state.hof[mode] : session.best[mode];
      const sub = `${name} · ${rollsText(all ? state.totals[mode] : session.rolls)}`;
      const items = list.map((x, k) => `<li${x === freshEntry ? ' class="fresh"' : ''} style="--tc:${tierVar(x.tier)}"><a href="${hashOf(x)}"><span class="rank num">${k + 1}</span><span class="n num">${esc(label(x))}</span><span class="sc num">${esc(oneText(x))}</span><span class="tier">${ROLL_TIERS[T(x.tier)].name}${x.x && x.x !== 'unity' ? ` <span class="x">× ${esc(MULT_BY_ID[x.x].symbol)}</span>` : ''}</span></a></li>`).join('');
      el.innerHTML = `<h2>${all ? 'All time' : 'This session'}</h2><p class="sub num">${sub}</p>`
        + (items ? `<ol>${items}</ol>` : `<p class="empty">${all ? 'Your ten best rolls ever land here.' : 'Your ten best rolls this session land here.'}</p>`);
    }
  }

  // Rolling
  let speed = 1, auto = null, busy = false, hunt = '', huntRolls = 0;
  const huntName = id => (id.startsWith('x:') ? `× ${MULT_BY_ID[id.slice(2)].symbol} ${MULT_BY_ID[id.slice(2)].name}` : findBadge(id).name);
  const huntP = id => (id.startsWith('x:') ? MULT_BY_ID[id.slice(2)].p : findBadge(id).p);

  async function rollOnce() {
    const mode = state.mode, roll = G.randomParams(mode), n = G.randomRoll();
    const x = { n, t: Date.now(), mode, x: roll.mult };
    if (roll.e) x.e = roll.e;
    if (roll.m) x.m = roll.m;
    if (roll.t !== undefined) x.tg = roll.t;
    const rec = record(x);
    save();
    for (const b of rec.r.badges) if (rec.fresh.has(b.id)) toast(`New badge: <b>${esc(b.name)}</b> (${RARITIES[b.rarity].name})`, RARITIES[b.rarity].id);
    if (rec.freshMult) toast(`New multiplier: <b>× ${esc(rec.r.mult.symbol)} ${esc(rec.r.mult.name)}</b>`, RARITIES[rec.r.mult.rarity].id);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const sp = auto && speed === 3 ? 3 : speed;
    if (sp !== 3) $('result').hidden = true;
    await spinTo(x, sp);
    showResult(x, { animate: true, speed: sp, fresh: rec.fresh });
    celebrate(rec.tier.id, sp);
    freshEntry = rec.madeSession || rec.madeHof ? rec.entry : null;
    renderBoards();

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
    checkAchievements(rec);
    paintStatus();
    return { tier: rec.tier, found };
  }

  function paintStatus() {
    const parts = [];
    if (session.rolls) {
      const best = session.best[state.mode][0];
      parts.push(`This session: <b class="num">${fmt(session.rolls)}</b> ${session.rolls === 1 ? 'roll' : 'rolls'}`
        + (best ? `, best <b style="color:${tierVar(best.tier)}">${ROLL_TIERS[T(best.tier)].name}</b>` : ''));
    }
    if (auto === 'endless') {
      const mins = (Date.now() - session.start) / 60000;
      parts.push(`Endless keeps rolling until you press Stop${mins > 0.5 ? `, about ${fmt(session.rolls / mins)} rolls a minute` : ''}`);
    }
    if (hunt) parts.push(`Hunting <b>${esc(huntName(hunt))}</b> (${odds(huntP(hunt))}), <span class="num">${fmt(huntRolls)}</span> rolls so far`);
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
    auto = kind;
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
      const { tier, found } = await rollOnce();
      if (kind === 'auto' && auto === 'auto' && (found || T(tier.id) >= +$('stopAt').value)) { setAuto(null); break; }
      await sleep(speed === 1 ? 800 : speed === 2 ? 300 : 40);
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
      ['transcendent', 'Beyond'], ['ethereal', 'Ethereal'], ['celestial', 'Written in the stars'], ['eternal', 'Forever']]
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
  ];
  function checkAchievements(rec) {
    for (const a of ACHIEVEMENTS) {
      if (state.ach[a.id] || !a.test(rec)) continue;
      state.ach[a.id] = Date.now();
      toast(`Achievement: <b>${esc(a.name)}</b>`, 'rare');
    }
  }

  // Trophies
  for (const m of MODES) $('hofMode').appendChild(new Option(m.name, m.id));
  function rowHtml(x, removable) {
    const tier = ROLL_TIERS[T(x.tier)];
    const tag = `${MODE_BY_ID[x.mode].name}${x.x && x.x !== 'unity' ? ` × ${MULT_BY_ID[x.x].symbol}` : ''}`;
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
    $('log').innerHTML = state.log.length ? state.log.map(x => rowHtml(entryFor(x), false)).join('')
      : '<li class="empty-state">No rolls yet. Your last 200 rolls appear here.</li>';
  }

  // Tabs, with arrow-key movement between them
  const TABS = ['roll', 'collection', 'trophies', 'log'];
  function selectTab(name) {
    document.querySelectorAll('.tabs [role="tab"]').forEach(b => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    for (const t of TABS) $('tab-' + t).hidden = t !== name;
    if (name === 'collection') renderCollection();
    if (name === 'trophies') renderTrophies();
    if (name === 'log') renderLog();
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
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.effects = s.effects;
    document.querySelector('meta[name="theme-color"]').content = cssVar('--bg');
    for (const r of document.querySelectorAll('#settingsDialog input[name="theme"]')) r.checked = r.value === s.theme;
    for (const r of document.querySelectorAll('#settingsDialog input[name="effects"]')) r.checked = r.value === s.effects;
  }
  $('settingsBtn').addEventListener('click', () => { $('dataMsg').textContent = ''; paintInstall(); $('settingsDialog').showModal(); });
  $('settingsDialog').addEventListener('change', ev => {
    if (ev.target.name === 'theme') state.settings.theme = ev.target.value;
    if (ev.target.name === 'effects') state.settings.effects = ev.target.value;
    applySettings();
    save();
  });

  let installPrompt = null;
  addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); installPrompt = ev; paintInstall(); });
  function paintInstall() {
    const text = $('installText');
    $('installBtn').hidden = !installPrompt;
    if (matchMedia('(display-mode: standalone)').matches) text.textContent = 'Installed. It runs offline.';
    else if (location.protocol === 'file:') text.innerHTML = 'Installing works from the hosted copy: open <a href="https://gkson-lab.github.io/rngdle9/">gkson-lab.github.io/rngdle9</a>.';
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

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ game: 'rngdle10', version: 4, state })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rngdle10-save-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    $('dataMsg').textContent = `Saved ${fmt(state.total)} rolls to a file.`;
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch { /* reported below */ }
    const s = data && ['rngdle10', 'rngdle9'].includes(data.game) && data.state;
    if (!s || !Array.isArray(s.log) || typeof s.total !== 'number') {
      $('dataMsg').textContent = 'That file is not an RNGdle save, so nothing changed.';
      return;
    }
    if (!confirm(`Replace your progress (${fmt(state.total)} rolls) with this save (${fmt(s.total)} rolls)?`)) return;
    setAuto(null);
    const b = blank();
    Object.assign(state, b, s, { settings: state.settings });
    for (const k of ['totals', 'tiers', 'hof']) state[k] = Object.assign(b[k], s[k]);
    if (data.game === 'rngdle9') state.totals.classic = s.total;
    state.log = s.log.filter(x => Number.isInteger(x.n) && x.n >= 0 && x.n < G.SPACE).slice(0, LOG_LIMIT).map(upgradeEntry);
    state.favs = (s.favs || []).map(upgradeEntry);
    for (const id of MODE_IDS) state.hof[id] = state.hof[id].map(upgradeEntry);
    if (!(s.v >= 4)) rescale(state);
    save();
    renderBoards();
    $('dataMsg').textContent = `Loaded a save with ${fmt(state.total)} rolls.`;
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Erase every roll, badge, multiplier, star and achievement in this browser? This cannot be undone.')) return;
    setAuto(null);
    const keep = state.settings;
    Object.assign(state, blank(), { settings: keep });
    session.rolls = 0;
    session.best = perMode(() => []);
    try { localStorage.removeItem('rngdle9:v2'); } catch { /* nothing to remove */ }
    save();
    renderBoards();
    paintStatus();
    $('dataMsg').textContent = 'Everything was erased.';
  });

  // Start
  applySettings();
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
